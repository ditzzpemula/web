require("dotenv").config();

const express = require("express");
const axios = require("axios");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const path = require("path");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const PANEL_URL = (process.env.PTERODACTYL_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.PTERODACTYL_API_KEY || "";

const NODE_ID = Number(process.env.NODE_ID || 1);
const NEST_ID = Number(process.env.NEST_ID || 5);
const EGG_ID = Number(process.env.EGG_ID || 15);

const RAM_MB = Number(process.env.RAM_MB || 2048);
const DISK_MB = Number(process.env.DISK_MB || 2048);
const CPU = Number(process.env.CPU || 100);

const PORT_MIN = Number(process.env.PORT_MIN || 7000);
const PORT_MAX = Number(process.env.PORT_MAX || 7777);

if (!PANEL_URL || !API_KEY) {
  console.error("ERROR: PTERODACTYL_URL dan PTERODACTYL_API_KEY wajib diisi di .env");
  process.exit(1);
}

const api = axios.create({
  baseURL: `${PANEL_URL}/api/application`,
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    Accept: "Application/vnd.pterodactyl.v1+json",
    "Content-Type": "application/json"
  },
  timeout: 20000
});

app.use(helmet({
  crossOriginResourcePolicy: false
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const createLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Terlalu banyak percobaan. Coba lagi beberapa menit." }
});

function cleanUsername(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
}

function cleanServerName(value) {
  return String(value || "")
    .replace(/[^\p{L}\p{N} _.-]/gu, "")
    .trim()
    .slice(0, 40);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function randomPassword(length = 14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  while (out.length < length) {
    const n = crypto.randomInt(0, chars.length);
    out += chars[n];
  }
  return out;
}

async function getNode() {
  const r = await api.get(`/nodes/${NODE_ID}?include=location`);
  return r.data.attributes;
}

async function getLocationId() {
  if (process.env.LOCATION_ID) return Number(process.env.LOCATION_ID);

  const r = await api.get(`/nodes/${NODE_ID}?include=location`);
  const rel = r.data.relationships && r.data.relationships.location;
  const id = rel && rel.data && rel.data.id;
  if (!id) {
    throw new Error("LOCATION_ID tidak ditemukan otomatis. Isi LOCATION_ID di .env.");
  }
  return Number(id);
}

async function getEgg() {
  const r = await api.get(`/nests/${NEST_ID}/eggs/${EGG_ID}?include=variables`);
  return r.data;
}

function buildEnvironment(eggData) {
  const variables = eggData.relationships?.variables?.data || [];
  const env = {};

  for (const item of variables) {
    const a = item.attributes || {};
    const key = a.env_variable;
    if (key) env[key] = a.default_value ?? "";
  }

  // Override umum SA-MP bila egg kamu memakai nama variable berikut.
  if (process.env.SAMP_SERVER_NAME) {
    if ("SERVER_NAME" in env) env.SERVER_NAME = process.env.SAMP_SERVER_NAME;
  }

  return env;
}

async function findExistingUser(email) {
  const r = await api.get("/users", {
    params: { filter: `email:${email}`, per_page: 10 }
  });
  return r.data.data?.[0] || null;
}

async function createUser({ username, email, password }) {
  const existing = await findExistingUser(email);
  if (existing) {
    const err = new Error("Email tersebut sudah terdaftar di panel.");
    err.code = "EMAIL_EXISTS";
    throw err;
  }

  const r = await api.post("/users", {
    username,
    email,
    first_name: username.slice(0, 30),
    last_name: "Customer",
    password,
    root_admin: false,
    language: "en"
  });

  return r.data.attributes;
}

async function createServer({ name, userId, eggData, locationId }) {
  const egg = eggData.attributes;

  const payload = {
    name,
    user: userId,
    nest: NEST_ID,
    egg: EGG_ID,
    docker_image: egg.docker_image,
    startup: egg.startup,
    environment: buildEnvironment(eggData),
    limits: {
      memory: RAM_MB,
      swap: 0,
      disk: DISK_MB,
      io: 500,
      cpu: CPU
    },
    feature_limits: {
      databases: 1,
      allocations: 1,
      backups: 0
    },
    deployment: {
      locations: [locationId],
      port_range: [String(PORT_MIN) + "-" + String(PORT_MAX)],
      dedicated_ip: false,
      tags: []
    },
    start_on_completion: false
  };

  const r = await api.post("/servers", payload);
  return r.data.attributes;
}

app.get("/api/config", async (req, res) => {
  try {
    const node = await getNode();
    res.json({
      ok: true,
      node: node.name,
      location: node.location_id,
      ram: RAM_MB,
      disk: DISK_MB,
      cpu: CPU,
      port_range: `${PORT_MIN}-${PORT_MAX}`
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Panel tidak dapat dihubungi." });
  }
});

app.post("/api/create", createLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const username = cleanUsername(req.body.username);
    const serverName = cleanServerName(req.body.serverName);

    if (!validEmail(email)) {
      return res.status(400).json({ error: "Email tidak valid." });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: "Username minimal 3 karakter." });
    }

    if (serverName.length < 3) {
      return res.status(400).json({ error: "Nama server minimal 3 karakter." });
    }

    const locationId = await getLocationId();
    const eggData = await getEgg();

    const password = randomPassword();
    const user = await createUser({ username, email, password });

    let server;
    try {
      server = await createServer({
        name: serverName,
        userId: user.id,
        eggData,
        locationId
      });
    } catch (serverError) {
      // Jika server gagal dibuat, hapus user yang baru dibuat agar tidak meninggalkan akun yatim.
      try {
        await api.delete(`/users/${user.id}`);
      } catch (_) {}
      throw serverError;
    }

    res.json({
      ok: true,
      message: "Server berhasil dibuat.",
      account: {
        username: user.username,
        email: user.email,
        password
      },
      server: {
        id: server.id,
        identifier: server.identifier,
        name: server.name,
        node: server.node,
        allocation: server.allocation,
        status: server.status
      },
      panel: PANEL_URL
    });
  } catch (e) {
    const status = e.response?.status || 500;
    const apiMessage = e.response?.data?.errors?.[0]?.detail;

    console.error("CREATE ERROR:", status, e.response?.data || e.message);

    res.status(status).json({
      error:
        e.code === "EMAIL_EXISTS"
          ? e.message
          : apiMessage || "Gagal membuat server. Periksa konfigurasi Pterodactyl dan allocation 7000-7777."
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`GreenCloud Auto SA-MP berjalan di http://127.0.0.1:${PORT}`);
});
