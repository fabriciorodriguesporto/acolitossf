const { hasValidAdminSession, sendError, sendJson } = require("../lib/server");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Método não permitido." });
  }

  try {
    return sendJson(res, 200, { authenticated: hasValidAdminSession(req) });
  } catch (error) {
    return sendError(res, error, "Falha ao verificar a sessão administrativa.");
  }
};
