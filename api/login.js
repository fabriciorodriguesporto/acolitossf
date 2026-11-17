const {
  createSessionToken,
  requestBody,
  requireEnv,
  requireSameOrigin,
  sendError,
  sendJson,
  setSessionCookie
} = require("../lib/server");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { error: "Método não permitido." });
    }
    if (!requireSameOrigin(req)) return sendJson(res, 403, { error: "Origem da solicitação não autorizada." });

    const body = requestBody(req);
    const adminEmail = requireEnv("ADMIN_EMAIL").trim().toLowerCase();
    const adminPassword = requireEnv("ADMIN_PASSWORD");
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const { timingSafeEqual } = require("node:crypto");
    const passwordBuffer = Buffer.from(password);
    const expectedPassword = Buffer.from(adminPassword);
    const passwordMatches = passwordBuffer.length === expectedPassword.length
      && timingSafeEqual(passwordBuffer, expectedPassword);

    if (email !== adminEmail || !passwordMatches) {
      return sendJson(res, 401, { error: "Usuário ou senha incorretos." });
    }

    setSessionCookie(res, createSessionToken(adminEmail));
    return sendJson(res, 200, { authenticated: true });
  } catch (error) {
    return sendError(res, error, "Falha na autenticação do administrador.");
  }
};
