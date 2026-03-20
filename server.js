const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const sessions = {};
const CARD_W = 230;
const CARD_H = 180;
const GAP = 18;
const DEFAULT_GRID_WIDTH = 940;

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "mur-idees-server",
    status: "running"
  });
});

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function uniqueCode() {
  let code = makeCode();
  while (sessions[code]) code = makeCode();
  return code;
}

function nowLabel() {
  return new Date().toLocaleString("ca-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function layoutForIndex(index, boardWidth = DEFAULT_GRID_WIDTH) {
  const cols = Math.max(1, Math.floor((boardWidth + GAP) / (CARD_W + GAP)));
  const col = index % cols;
  const row = Math.floor(index / cols);
  return { x: col * (CARD_W + GAP), y: row * (CARD_H + GAP) };
}

function getSession(code) {
  const session = sessions[code];
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    delete sessions[code];
    return null;
  }
  return session;
}

function purgeExpiredSessions() {
  const now = Date.now();
  for (const code of Object.keys(sessions)) {
    if (now > sessions[code].expiresAt) delete sessions[code];
  }
}

setInterval(purgeExpiredSessions, 30_000);

app.get("/health", (req, res) => {
  res.json({ ok: true, activeSessions: Object.keys(sessions).length });
});

app.post("/api/sessions", (req, res) => {
  const {
    title,
    owner,
    description = "",
    limit = 2,
    ttlMin = 60,
    themeColor = "#1397b8"
  } = req.body || {};

  if (!title || !owner) {
    return res.status(400).json({ error: "Cal indicar títol i presentador." });
  }

  const numericLimit = Number(limit);
  const numericTtl = Number(ttlMin);

  if (!Number.isFinite(numericLimit) || numericLimit < 1 || numericLimit > 20) {
    return res.status(400).json({ error: "El límit per persona ha d’estar entre 1 i 20." });
  }

  if (!Number.isFinite(numericTtl) || numericTtl < 10 || numericTtl > 360) {
    return res.status(400).json({ error: "La durada ha d’estar entre 10 i 360 minuts." });
  }

  const code = uniqueCode();
  const now = Date.now();

  sessions[code] = {
    code,
    title: String(title).trim(),
    owner: String(owner).trim(),
    description: String(description || "").trim(),
    limit: numericLimit,
    ttlMin: numericTtl,
    themeColor: String(themeColor || "#1397b8"),
    createdAt: now,
    expiresAt: now + numericTtl * 60 * 1000,
    cards: []
  };

  res.status(201).json(sessions[code]);
});

app.get("/api/sessions/:code", (req, res) => {
  const code = String(req.params.code || "").toUpperCase();
  const session = getSession(code);

  if (!session) {
    return res.status(404).json({ error: "Sessió no trobada o caducada." });
  }

  res.json(session);
});

app.delete("/api/sessions/:code", (req, res) => {
  const code = String(req.params.code || "").toUpperCase();
  if (!sessions[code]) {
    return res.status(404).json({ error: "Sessió no trobada." });
  }

  delete sessions[code];
  res.json({ ok: true });
});

app.post("/api/sessions/:code/cards", (req, res) => {
  const code = String(req.params.code || "").toUpperCase();
  const session = getSession(code);

  if (!session) {
    return res.status(404).json({ error: "Sessió no trobada o caducada." });
  }

  const {
    author,
    title = "",
    text,
    link = "",
    image = "",
    color = "yellow"
  } = req.body || {};

  if (!author || !text) {
    return res.status(400).json({ error: "Cal indicar autor i contingut." });
  }

  const byAuthor = session.cards.filter(
    c => String(c.author).toLowerCase() === String(author).toLowerCase()
  ).length;

  if (byAuthor >= session.limit) {
    return res.status(400).json({ error: `S’ha arribat al límit de ${session.limit} targetes per persona.` });
  }

  const idx = session.cards.length;
  const pos = layoutForIndex(idx);

  const card = {
    id: crypto.randomUUID(),
    author: String(author).trim(),
    title: String(title || "").trim(),
    text: String(text).trim(),
    link: String(link || "").trim(),
    image: String(image || "").trim(),
    color: String(color || "yellow"),
    x: pos.x,
    y: pos.y,
    order: idx,
    createdAt: new Date().toISOString(),
    createdLabel: nowLabel()
  };

  session.cards.push(card);
  res.status(201).json(card);
});

app.delete("/api/sessions/:code/cards/:id", (req, res) => {
  const code = String(req.params.code || "").toUpperCase();
  const id = String(req.params.id || "");
  const session = getSession(code);

  if (!session) {
    return res.status(404).json({ error: "Sessió no trobada o caducada." });
  }

  const before = session.cards.length;
  session.cards = session.cards.filter(c => c.id !== id);

  if (session.cards.length === before) {
    return res.status(404).json({ error: "Targeta no trobada." });
  }

  res.json({ ok: true });
});

app.post("/api/sessions/:code/organize", (req, res) => {
  const code = String(req.params.code || "").toUpperCase();
  const session = getSession(code);

  if (!session) {
    return res.status(404).json({ error: "Sessió no trobada o caducada." });
  }

  session.cards = session.cards.map((card, i) => ({
    ...card,
    ...layoutForIndex(i),
    order: i
  }));

  res.json(session);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
