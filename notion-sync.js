const { Client } = require("@notionhq/client");
const fs = require("fs");

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const databaseId = process.env.NOTION_DATABASE_ID;

async function getPosts() {
  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: "Published",
      checkbox: {
        equals: true,
      },
    },
    sorts: [
      {
        property: "Date",
        direction: "descending",
      },
    ],
  });

  return response.results;
}

function getTitle(page) {
  return page.properties.Name?.title?.[0]?.plain_text || "Untitled";
}

function getSlug(title) {
  return title.toLowerCase().replace(/\s+/g, "-");
}

async function main() {
  const posts = await getPosts();

  let links = "";

  for (const post of posts) {
    const title = getTitle(post);
    const slug = getSlug(title);

    links += `<li><a href="post-${slug}.html">${title}</a></li>\n`;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Blog</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>My Blog</h1>
  <ul>
    ${links}
  </ul>
</body>
</html>
`;

  fs.writeFileSync("blog.html", html);
  console.log("blog.html updated");
}

main();
