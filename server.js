const express = require("express");
const Database = require("better-sqlite3");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "16kb" }));

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const DB_PATH = process.env.DB_PATH || "./keys.db";

if (!ADMIN_TOKEN) {
  console.error("Falta configurar ADMIN_TOKEN en las variables de entorno.");
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS keys (
    key TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL
  );
`);

const findKey = db.prepare("SELECT key, expires_at, status FROM keys WHERE key = ?");
const insertKey = db.prepare("INSERT INTO keys (key, expires_at, status, created_at) VALUES (?, ?, 'active', ?)");
const setStatus = db.prepare("UPDATE keys SET status = ? WHERE key = ?");
const listKeys = db.prepare("SELECT key, expires_at, status, created_at FROM keys ORDER BY created_at DESC LIMIT 500");

function adminOnly(req, res, next) {
  const supplied = req.get("x-admin-token") || "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(ADMIN_TOKEN);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

app.get("/", (_req, res) => {
  res.json({ service: "PROXY HANZX TEAM key server", status: "online" });
});

// Compatible shape for clients expecting { valida, vence, segundos, firma }.
// The firma here is an informational SHA-256 digest, not proof of authenticity.
app.get("/api/llave", (req, res) => {
  const key = String(req.query.k || "").trim().toUpperCase();
  if (!key || key.length > 128) {
    return res.status(400).json({ valida: false, error: "missing_or_invalid_key" });
  }

  const row = findKey.get(key);
  if (!row) return res.json({ valida: false, error: "invalid_key" });
  if (row.status !== "active") return res.json({ valida: false, error: row.status === "revoked" ? "key_banned" : "key_paused" });

  const now = Math.floor(Date.now() / 1000);
  const seconds = row.expires_at - now;
  if (seconds <= 0) return res.json({ valida: false, error: "key_expired" });

  const firma = crypto.createHash("sha256").update(`${row.key}:${row.expires_at}`).digest("hex");
  return res.json({ valida: true, vence: new Date(row.expires_at * 1000).toISOString(), segundos: seconds, firma });
});

// Create a key. expiresInSeconds must be a positive integer.
app.post("/admin/keys", adminOnly, (req, res) => {
  const duration = Number(req.body.expiresInSeconds);
  if (!Number.isSafeInteger(duration) || duration < 60 || duration > 31536000) {
    return res.status(400).json({ ok: false, error: "expiresInSeconds must be 60..31536000" });
  }
  const key = "HANZX-" + crypto.randomBytes(4).toString("hex").toUpperCase() + "-" +
    crypto.randomBytes(4).toString("hex").toUpperCase() + "-" +
    crypto.randomBytes(4).toString("hex").toUpperCase();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + duration;
  insertKey.run(key, expiresAt, now);
  res.status(201).json({ ok: true, key, vence: new Date(expiresAt * 1000).toISOString() });
});

app.get("/admin/keys", adminOnly, (_req, res) => {
  res.json({ ok: true, keys: listKeys.all() });
});

app.post("/admin/keys/status", adminOnly, (req, res) => {
  const key = String(req.body.key || "").trim().toUpperCase();
  const status = String(req.body.status || "");
  if (!["active", "paused", "revoked"].includes(status)) {
    return res.status(400).json({ ok: false, error: "status must be active, paused, or revoked" });
  }
  const result = setStatus.run(status, key);
  if (!result.changes) return res.status(404).json({ ok: false, error: "key_not_found" });
  res.json({ ok: true, key, status });
});

app.listen(PORT, "0.0.0.0", () => console.log(`Key server listening on ${PORT}`));
