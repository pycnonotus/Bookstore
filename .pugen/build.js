const fs = require("node:fs");
const path = require("node:path");
const pug = require("pug");

const booksDir = path.join(__dirname, "..", "seed");
const templatePath = path.join(__dirname, "index.pug");

function loadBooks() {
  return fs.readdirSync(booksDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const folder = entry.name;
      const jsonPath = path.join(booksDir, folder, "metadata.json");

      if (!fs.existsSync(jsonPath)) return null;

      const book = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

      return {
        ...book,
        image: `fake_books_bundle/${folder}/${book.image_file}`
      };
    })
    .filter(Boolean);
}

function render() {
  const books = loadBooks();
  const html = pug.renderFile(templatePath, { books, pretty: true });
  return { html, books };
}

module.exports = { booksDir, loadBooks, render };

if (require.main === module) {
  const { html, books } = render();
  fs.writeFileSync(path.join(__dirname, "..", "index.html"), html);
  console.log(`Generated index.html with ${books.length} books`);
}
