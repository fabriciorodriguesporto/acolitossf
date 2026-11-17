const { neon } = require("@neondatabase/serverless");
const { createHmac, timingSafeEqual } = require("node:crypto");

const SESSION_COOKIE = "acolitos_admin_session";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;
const DEFAULT_SETTINGS = { secondSaturdayTime: "18:00", fourthSaturdayTime: "17:00" };

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getSql() {
  return neon(requiredEnv("DATABASE_URL"));
}

function initialState() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const oneYearFromToday = new Date(Date.UTC(today.getUTCFullYear() + 1, today.getUTCMonth(), today.getUTCDate()));
  const masses = [];

  for (let offset = 0; offset <= 12; offset += 1) {
    const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1));
    for (const [ordinal, time] of [[2, DEFAULT_SETTINGS.secondSaturdayTime], [4, DEFAULT_SETTINGS.fourthSaturdayTime]]) {
      const firstDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
      const firstSaturday = 1 + ((6 - firstDay.getUTCDay() + 7) % 7);
      const date = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), firstSaturday + (ordinal - 1) * 7));
      if (date < today || date > oneYearFromToday) continue;
      masses.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        date: date.toISOString().slice(0, 10),
        time,
        massType: ordinal === 2 ? "first" : "second",
        assignments: []
      });
    }
  }

  masses.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  return { members: [], settings: { ...DEFAULT_SETTINGS }, masses, initialOrderApplied: false };
}

async function getStateRecord() {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS acolitos_state (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    data JSONB NOT NULL,
    initialized BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  let rows = await sql`SELECT data, initialized FROM acolitos_state WHERE id = 1`;
  if (rows.length === 0) {
    await sql`INSERT INTO acolitos_state (id, data, initialized)
      VALUES (1, ${JSON.stringify(initialState())}::jsonb, FALSE)
      ON CONFLICT (id) DO NOTHING`;
    rows = await sql`SELECT data, initialized FROM acolitos_state WHERE id = 1`;
  }
  if (rows.length === 0) throw new Error("Could not initialize the application state.");
  return rows[0];
}

async function updateState(data) {
  const sql = getSql();
  await getStateRecord();
  const rows = await sql`UPDATE acolitos_state
    SET data = ${JSON.stringify(data)}::jsonb, initialized = TRUE, updated_at = NOW()
    WHERE id = 1
    RETURNING data, initialized`;
  if (rows.length !== 1) throw new Error("Could not save the application state.");
  return rows[0];
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function sendError(res, error, context) {
  console.error(context, error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  const message = status >= 500 ? "Erro interno ao acessar o serviço." : error.message;
  sendJson(res, status, { error: message });
}

function requestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      const error = new Error("Corpo JSON inválido.");
      error.status = 400;
      throw error;
    }
  }
  const error = new Error("Corpo JSON obrigatório.");
  error.status = 400;
  throw error;
}

function requireSameOrigin(req) {
  const origin = req.headers.origin;
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  const forwardedProtocol = (req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProtocol || (process.env.NODE_ENV === "production" ? "https" : "http");
  if (!origin || !host) return false;
  try {
    return new URL(origin).origin === new URL(`${protocol}://${host}`).origin;
  } catch {
    return false;
  }
}

function sessionSecret() {
  const secret = requiredEnv("SESSION_SECRET");
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 bytes.");
  }
  return secret;
}

function createSessionToken(email) {
  const secret = sessionSecret();
  const payload = Buffer.from(JSON.stringify({
    email,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function cookieValue(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  const cookie = cookies.map(item => item.trim()).find(item => item.startsWith(`${name}=`));
  return cookie ? cookie.slice(name.length + 1) : "";
}

function hasValidAdminSession(req) {
  const token = cookieValue(req, SESSION_COOKIE);
  if (!token) return false;

  const [payload, signature, ...extra] = token.split(".");
  if (!payload || !signature || extra.length) return false;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.email === requiredEnv("ADMIN_EMAIL").trim().toLowerCase()
      && Number.isInteger(session.expiresAt)
      && session.expiresAt > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL === "1" ? "; Secure" : "";
  res.setHeader("Set-Cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_DURATION_SECONDS}; SameSite=Strict${secure}`);
}

function validateState(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)
    || !Array.isArray(data.members) || !Array.isArray(data.masses)
    || !data.settings || typeof data.settings !== "object"
    || typeof data.settings.secondSaturdayTime !== "string"
    || typeof data.settings.fourthSaturdayTime !== "string"
    || typeof data.initialOrderApplied !== "boolean") {
    const error = new Error("Formato dos dados inválido.");
    error.status = 400;
    throw error;
  }
  if (Buffer.byteLength(JSON.stringify(data), "utf8") > 3_000_000) {
    const error = new Error("Os dados excedem o limite permitido.");
    error.status = 413;
    throw error;
  }
}

module.exports = {
  createSessionToken,
  getStateRecord,
  hasValidAdminSession,
  requestBody,
  requireEnv: requiredEnv,
  requireSameOrigin,
  sendError,
  sendJson,
  setSessionCookie,
  updateState,
  validateState
};
