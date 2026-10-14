const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "artora.db"));
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

// Non-destructive: creates only tables that do not already exist.
db.exec(`
  CREATE TABLE IF NOT EXISTS artworks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    image TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS favourites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT NOT NULL,
    artwork_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(visitor_id, artwork_id),
    FOREIGN KEY(artwork_id) REFERENCES artworks(id)
  );

  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add demo records only when the artworks table is empty.
const count = db.prepare("SELECT COUNT(*) AS count FROM artworks").get().count;
if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO artworks (title, category, description, image)
    VALUES (?, ?, ?, ?)
  `);
  const starter = [
    ["Mochi — Fox Spirit", "furry", "A curious fox spirit with warm colors, expressive eyes, and a playful personality.", ""],
    ["Nori — Moon Mage", "oc", "A quiet moon mage imagined for a fantasy world of stars, secrets, and soft magic.", ""],
    ["Kira — Neon Runner", "anime", "A bold anime-inspired character concept with energetic colors and a futuristic attitude.", ""],
    ["Rook — The Wanderer", "oc", "A thoughtful traveler designed around earthy tones and a mysterious backstory.", ""],
    ["Pip — Forest Buddy", "furry", "A friendly woodland creature concept with soft colors and a bright, welcoming mood.", ""],
    ["Starbyte — Fan Art Study", "anime", "A stylized fan-art study exploring dramatic shapes, expressive features, and color.", ""]
  ];
  const insertMany = db.transaction(rows => rows.forEach(row => insert.run(...row)));
  insertMany(starter);
}

module.exports = db;
