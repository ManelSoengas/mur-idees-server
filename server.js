const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const sessions = {};

// Crear sessió
app.post("/api/sessions", (req, res) => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  sessions[code] = {
    title: req.body.title,
    owner: req.body.owner,
    cards: [],
    limit: req.body.limit || 2,
    expiresAt: Date.now() + (req.body.ttlMin || 60) * 60000
  };

  res.json({ code });
});

// Obtenir sessió
app.get("/api/sessions/:code", (req, res) => {
  const session = sessions[req.params.code];
  if (!session) return res.status(404).json({ error: "No existeix" });

  res.json(session);
});

// Afegir targeta
app.post("/api/sessions/:code/cards", (req, res) => {
  const session = sessions[req.params.code];
  if (!session) return res.status(404).json({ error: "No existeix" });

  session.cards.push(req.body);
  res.json({ ok: true });
});

app.listen(3000, () => console.log("Server running"));
