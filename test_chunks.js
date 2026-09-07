const { db } = require('./dist/server.cjs'); // Can't easily use db directly, I'll write a standalone script to read the json db
const fs = require('fs');
if (fs.existsSync('database.json')) {
  const data = JSON.parse(fs.readFileSync('database.json'));
  console.log("Total chunks:", data.chunks ? data.chunks.length : 0);
  if (data.chunks && data.chunks.length > 0) {
    console.log("Sample chunk:", data.chunks[0].text.slice(0, 100));
    console.log("Chunk doc IDs:", [...new Set(data.chunks.map(c => c.bookId))]);
  }
}
