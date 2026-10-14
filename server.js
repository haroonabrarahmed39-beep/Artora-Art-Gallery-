const express = require("express");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

function clean(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function validEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
function validVisitor(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(value);
}
function serverError(res, error, message) {
  console.error(message, error);
  return res.status(500).json({ error: message });
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "ARTORA API" });
});

app.get("/api/categories", (req, res) => {
  try {
    res.json(db.prepare(`
      SELECT category, COUNT(*) AS artworkCount
      FROM artworks
      GROUP BY category
      ORDER BY category COLLATE NOCASE
    `).all());
  } catch (error) {
    serverError(res, error, "Could not load categories.");
  }
});

app.get("/api/artworks", (req, res) => {
  try {
    const category = clean(req.query.category || "all", 80);
    const search = clean(req.query.search || "", 100);
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);

    if (!Number.isSafeInteger(page) || page < 1 ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ error: "Invalid page or limit (1–100)." });
    }

    const conditions = [];
    const params = [];
    if (category.toLowerCase() !== "all") {
      conditions.push("category = ? COLLATE NOCASE");
      params.push(category);
    }
    if (search) {
      const escaped = search.replace(/[\\%_]/g, "\\$&");
      const pattern = `%${escaped}%`;
      conditions.push("(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\')");
      params.push(pattern, pattern, pattern);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const total = db.prepare(`SELECT COUNT(*) AS count FROM artworks ${where}`).get(...params).count;
    const data = db.prepare(`
      SELECT id, title, category, description, image, created_at
      FROM artworks ${where}
      ORDER BY id DESC LIMIT ? OFFSET ?
    `).all(...params, limit, (page - 1) * limit);

    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    serverError(res, error, "Could not load artworks.");
  }
});

app.get("/api/artworks/:id", (req, res) => {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid artwork ID." });

  try {
    const artwork = db.prepare(`
      SELECT id, title, category, description, image, created_at
      FROM artworks WHERE id = ?
    `).get(id);
    if (!artwork) return res.status(404).json({ error: "Artwork not found." });
    res.json(artwork);
  } catch (error) {
    serverError(res, error, "Could not load artwork.");
  }
});

app.post("/api/contact", (req, res) => {
  const name = clean(req.body?.name, 100);
  const email = clean(req.body?.email, 254).toLowerCase();
  const subject = clean(req.body?.subject, 150);
  const message = clean(req.body?.message, 5000);

  if (name.length < 2) return res.status(400).json({ error: "Name must contain at least 2 characters." });
  if (!validEmail(email)) return res.status(400).json({ error: "Please enter a valid email address." });
  if (message.length < 10) return res.status(400).json({ error: "Message must contain at least 10 characters." });

  try {
    const result = db.prepare(`
      INSERT INTO contact_messages (name, email, subject, message)
      VALUES (?, ?, ?, ?)
    `).run(name, email, subject, message);
    res.status(201).json({ message: "Your message was received.", id: Number(result.lastInsertRowid) });
  } catch (error) {
    serverError(res, error, "Could not save your message.");
  }
});

app.post("/api/subscribe", (req, res) => {
  const email = clean(req.body?.email, 254).toLowerCase();
  if (!validEmail(email)) return res.status(400).json({ error: "Please enter a valid email address." });

  try {
    const result = db.prepare(`
      INSERT INTO subscribers (email) VALUES (?)
      ON CONFLICT(email) DO NOTHING
    `).run(email);
    if (!result.changes) return res.status(409).json({ error: "This email is already subscribed." });
    res.status(201).json({ message: "You're on the ARTORA list!" });
  } catch (error) {
    serverError(res, error, "Could not save your subscription.");
  }
});

app.get("/api/favourites/:visitorId", (req, res) => {
  const visitorId = req.params.visitorId;
  if (!validVisitor(visitorId)) return res.status(400).json({ error: "Invalid visitor ID." });

  try {
    const rows = db.prepare(`
      SELECT artwork_id FROM favourites WHERE visitor_id = ? ORDER BY id DESC
    `).all(visitorId);
    res.json(rows.map(row => row.artwork_id));
  } catch (error) {
    serverError(res, error, "Could not load favourites.");
  }
});

app.post("/api/favourites", (req, res) => {
  const visitorId = req.body?.visitorId;
  const artworkId = validId(req.body?.artworkId);
  if (!validVisitor(visitorId)) return res.status(400).json({ error: "Invalid visitor ID." });
  if (!artworkId) return res.status(400).json({ error: "Invalid artwork ID." });

  try {
    const exists = db.prepare("SELECT id FROM artworks WHERE id = ?").get(artworkId);
    if (!exists) return res.status(404).json({ error: "Artwork not found." });

    db.prepare(`
      INSERT INTO favourites (visitor_id, artwork_id) VALUES (?, ?)
      ON CONFLICT(visitor_id, artwork_id) DO NOTHING
    `).run(visitorId, artworkId);
    res.json({ message: "Artwork saved." });
  } catch (error) {
    serverError(res, error, "Could not save favourite.");
  }
});

app.delete("/api/favourites", (req, res) => {
  const visitorId = req.body?.visitorId;
  const artworkId = validId(req.body?.artworkId);
  if (!validVisitor(visitorId) || !artworkId) {
    return res.status(400).json({ error: "Valid visitor ID and artwork ID are required." });
  }

  try {
    db.prepare("DELETE FROM favourites WHERE visitor_id = ? AND artwork_id = ?").run(visitorId, artworkId);
    res.json({ message: "Artwork removed from favourites." });
  } catch (error) {
    serverError(res, error, "Could not remove favourite.");
  }
});

app.use("/api", (req, res) => res.status(404).json({ error: "API route not found." }));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ error: "Invalid JSON request body." });
  }
  console.error("Unexpected server error:", error);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

const server = app.listen(PORT, () => {
  console.log(`ARTORA is running at http://localhost:${PORT}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
