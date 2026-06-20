const { Client } = require("@notionhq/client");
const fs = require("fs");
const notion = new Client({ auth: process.env.NOTION_TOKEN });
console.log("notion type:", typeof notion);
console.log("databases type:", typeof notion.databases);
console.log("databases keys:", Object.keys(notion.databases));
const databaseId = process.env.NOTION_DATABASE_ID;

async function getPosts() {
  const response = await notion.databases.query({
    database_id: databaseId,
    filter: { property: "Published", checkbox: { equals: true } },
    sorts: [{ property: "Date", direction: "descending" }],
  });
  return response.results;
}

function getTitle(page) {
  const titleProp = Object.values(page.properties).find(p => p.type === "title");
  return titleProp?.title?.[0]?.plain_text || "Untitled";
}

function getSlug(title) {
  return title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function getDate(page) {
  return page.properties.Date?.date?.start || "2026-01-01";
}

function getCategory(page) {
  return page.properties.Category?.select?.name || "general";
}

function renderRichText(richText) {
  return richText.map(t => {
    let text = t.plain_text;
    if (t.annotations.bold) text = `<strong>${text}</strong>`;
    if (t.annotations.italic) text = `<em>${text}</em>`;
    if (t.annotations.code) text = `<code>${text}</code>`;
    return text;
  }).join("");
}

async function getContent(pageId) {
  const response = await notion.blocks.children.list({ block_id: pageId });
  let content = "";
  let inList = false;

  for (const block of response.results) {
    if (block.type !== "bulleted_list_item" && inList) {
      content += `</ul>\n`;
      inList = false;
    }

    if (block.type === "paragraph") {
      const text = renderRichText(block.paragraph.rich_text);
      if (text) content += `<p>${text}</p>\n`;
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
      if (!inList) { content += `<ul>\n`; inList = true; }
      const text = renderRichText(block.bulleted_list_item.rich_text);
      content += `<li>${text}</li>\n`;
    } else if (block.type === "numbered_list_item") {
      const text = renderRichText(block.numbered_list_item.rich_text);
      content += `<li>${text}</li>\n`;
    }
  }

  if (inList) content += `</ul>\n`;
  return content;
}

async function main() {
  const posts = await getPosts();
  let blogLinks = "";

  for (const post of posts) {
    const title = getTitle(post);
    const slug = getSlug(title);
    const date = getDate(post);
    const category = getCategory(post);
    const content = await getContent(post.id);

    const postHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} – Elroy's Blog</title>
  <link rel="stylesheet" href="style.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <main class="post-container">
    <article class="blog-post">
      <header>
        <h1>${title}</h1>
        <time class="date" datetime="${date}">${new Date(date).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</time>
      </header>
      <section class="post-content">
        ${content}
      </section>
      <footer class="post-footer">
        <a href="blog.html">← Back to Blog</a>
      </footer>
    </article>
  </main>
</body>
</html>`;

    fs.writeFileSync(`post-${slug}.html`, postHtml);
    console.log(`Created: post-${slug}.html`);
    blogLinks += `<li><a href="post-${slug}.html">${title}</a> <em>${new Date(date).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</em></li>\n`;
  }

  const blogHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog – Elroy Toh</title>
  <link rel="stylesheet" href="style.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <main class="post-container">
    <h1>Blog</h1>
    <ul>
      ${blogLinks}
    </ul>
  </main>
</body>
</html>`;

  fs.writeFileSync("blog.html", blogHtml);
  console.log("blog.html updated!");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
