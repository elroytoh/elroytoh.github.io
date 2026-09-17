const { Client } = require("@notionhq/client");
const fs = require("fs");

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

const databaseId = process.env.NOTION_DATABASE_ID;

async function getPosts() {
  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: "Published",
      checkbox: {
        equals: true
      }
    },
    sorts: [
      {
        property: "Date",
        direction: "descending"
      }
    ]
  });

  return response.results;
}

function getTitle(page) {
  const titleProp = Object.values(page.properties)
    .find(p => p.type === "title");

  return titleProp?.title?.[0]?.plain_text || "Untitled";
}

function getSlug(title) {
  return title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function getDate(page) {
  return page.properties.Date?.date?.start || "2026-01-01";
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderRichText(richText) {
  return richText.map(t => {
    let text = escapeHtml(t.plain_text);

    if (t.annotations.bold) {
      text = `<strong>${text}</strong>`;
    }

    if (t.annotations.italic) {
      text = `<em>${text}</em>`;
    }

    if (t.annotations.code) {
      text = `<code>${text}</code>`;
    }

    return text;
  }).join("");
}

async function getContent(pageId) {
  const response = await notion.blocks.children.list({
    block_id: pageId
  });

  let content = "";
  let inList = false;

  for (const block of response.results) {

    if (
      block.type !== "bulleted_list_item" &&
      inList
    ) {
      content += `</ul>\n`;
      inList = false;
    }

    if (block.type === "paragraph") {
      const text = renderRichText(block.paragraph.rich_text);

      if (text) {
        content += `<p>${text}</p>\n`;
      }

    } else if (block.type === "heading_1") {
      const text = renderRichText(block.heading_1.rich_text);
      content += `<h1>${text}</h1>\n`;

    } else if (block.type === "heading_2") {
      const text = renderRichText(block.heading_2.rich_text);
      content += `<h2>${text}</h2>\n`;

    } else if (block.type === "heading_3") {
      const text = renderRichText(block.heading_3.rich_text);
      content += `<h3>${text}</h3>\n`;

    } else if (block.type === "bulleted_list_item") {

      if (!inList) {
        content += `<ul>\n`;
        inList = true;
      }

      const text = renderRichText(
        block.bulleted_list_item.rich_text
      );

      content += `<li>${text}</li>\n`;

    } else if (block.type === "numbered_list_item") {

      const text = renderRichText(
        block.numbered_list_item.rich_text
      );

      content += `<ol>\n<li>${text}</li>\n</ol>\n`;
    }
  }

  if (inList) {
    content += `</ul>\n`;
  }

  return content;
}


/* ============================================
   Generated footer
   ============================================ */

const FOOTER = `
<footer>
  <p>© Elroy Toh</p>
</footer>`;


/* ============================================
   Generate individual blog post
   ============================================ */

function generatePostHtml(title, date, content) {

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>${escapeHtml(title)} – Elroy Toh</title>

  <link rel="stylesheet" href="style.css">
</head>

<body>

<main class="post-container">

  <article class="blog-post">

    <header>
      <h1>${escapeHtml(title)}</h1>

      <time
        class="date"
        datetime="${date}">
        ${formatDate(date)}
      </time>
    </header>

    <section class="post-content">
      ${content}
    </section>

    <footer class="post-footer">
      <a href="index.html">← Back to home</a>
    </footer>

  </article>

</main>

${FOOTER}

</body>
</html>`;
}


/* ============================================
   Generate Writings section
   ============================================ */

function generateWritingLinks(posts) {

  let writingLinks = "";

  for (const post of posts) {

    const title = getTitle(post);
    const slug = getSlug(title);
    const date = getDate(post);

    writingLinks += `
      <li>
        <a href="post-${slug}.html">
          ${escapeHtml(title)}
        </a>
        <span class="date">
          ${formatDate(date)}
        </span>
      </li>
`;
  }

  return writingLinks;
}


/* ============================================
   Update index.html
   ============================================ */

function updateIndexHtml(posts) {

  const indexPath = "index.html";

  if (!fs.existsSync(indexPath)) {
    console.log("index.html not found. Skipping homepage update.");
    return;
  }

  let indexHtml = fs.readFileSync(indexPath, "utf8");

  const writingLinks = generateWritingLinks(posts);

  const writingsSection = `
  <section>
    <h2>Writings</h2>

    <ul class="list">
${writingLinks}
    </ul>
  </section>
`;

  /*
   * Replace the existing Writings section.
   * It looks for the first section containing <h2>Writings</h2>.
   */

  const sectionRegex =
    /<section>\s*<h2>Writings<\/h2>[\s\S]*?<\/section>/i;

  if (sectionRegex.test(indexHtml)) {

    indexHtml = indexHtml.replace(
      sectionRegex,
      writingsSection.trim()
    );

  } else {

    /*
     * If no Writings section exists,
     * insert one at the beginning of <main>.
     */

    indexHtml = indexHtml.replace(
      /<main>/i,
      `<main>\n${writingsSection}`
    );
  }

  fs.writeFileSync(indexPath, indexHtml);

  console.log("index.html Writings section updated!");
}


/* ============================================
   Main
   ============================================ */

async function main() {

  const posts = await getPosts();

  console.log(`Found ${posts.length} published posts.`);

  for (const post of posts) {

    const title = getTitle(post);
    const slug = getSlug(title);
    const date = getDate(post);

    console.log(`Syncing: ${title}`);

    const content = await getContent(post.id);

    const postHtml = generatePostHtml(
      title,
      date,
      content
    );

    fs.writeFileSync(
      `post-${slug}.html`,
      postHtml
    );

    console.log(
      `Created: post-${slug}.html`
    );
  }


  /*
   * Update homepage from Notion posts.
   */

  updateIndexHtml(posts);


  /*
   * Keep blog.html for now.
   * This means your existing setup won't break.
   */

  const blogLinks = generateWritingLinks(posts);

  const blogHtml = `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>Blog – Elroy Toh</title>

  <link rel="stylesheet" href="style.css">
</head>

<body>

<main class="post-container">

  <h1>Blog</h1>

  <ul class="list">
    ${blogLinks}
  </ul>

</main>

${FOOTER}

</body>
</html>`;

  fs.writeFileSync(
    "blog.html",
    blogHtml
  );

  console.log("blog.html updated!");
}


main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
