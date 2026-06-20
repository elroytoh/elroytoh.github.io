const { Client } = require("@notionhq/client/build/src");
const fs = require("fs");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
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
  return title.toLowerCase().replace(/\s+/g, "-");
}

function getDate(page) {
  return page.properties.Date?.date?.start || "2026-01-01";
}

function getCategory(page) {
  return page.properties.Category?.select?.name || "general";
}

async function getContent(pageId) {
  const response = await notion.blocks.children.list({ block_id: pageId });
  let content = "";
  for (const block of response.results) {
    if (block.type === "paragraph") {
      const text = block.paragraph.rich_text.map(t => t.plain_text).join("");
      content += `<p>${text}</p>\n`;
    } else if (block.type === "heading_1") {
      const text = block.heading_1.rich_text.map(t => t.plain_text).join("");
      content += `<h1>${text}</h1>\n`;
    } else if (block.type === "heading_2") {
      const text = block.heading_2.rich_text.map(t => t.plain_text).join("");
      content += `<h2>${text}</h2>\n`;
    } else if (block.type === "bulleted_list_item") {
      const text = block.bulleted_list_item.rich_text.map(t => t.plain_text).join("");
      content += `<li>${text}</li>\n`;
    }
  }
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
  <title>${title}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <nav><a href="index.html">Home</a> | <a href="blog.html">Blog</a></nav>
  <h1>${title}</h1>
  <p><em>${date} · ${category}</em></p>
  <article>
    ${content}
  </article>
</body>
</html>`;

    fs.writeFileSync(`post-${slug}.html`, postHtml);
    console.log(`Created: post-${slug}.html`);

    blogLinks += `<li><a href="post-${slug}.html">${title}</a> <em>${date}</em></li>\n`;
  }

  const blogHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <nav><a href="index.html">Home</a></nav>
  <h1>My Blog</h1>
  <ul>
    ${blogLinks}
  </ul>
</body>
</html>`;

  fs.writeFileSync("blog.html", blogHtml);
  console.log("blog.html updated!");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
