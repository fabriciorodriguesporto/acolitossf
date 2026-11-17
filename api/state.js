const {
  getStateRecord,
  hasValidAdminSession,
  requestBody,
  requireSameOrigin,
  sendError,
  sendJson,
  updateState,
  validateState
} = require("../lib/server");

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const record = await getStateRecord();
      return sendJson(res, 200, { state: record.data, initialized: record.initialized });
    }

    if (req.method !== "PUT") {
      res.setHeader("Allow", "GET, PUT");
      return sendJson(res, 405, { error: "Método não permitido." });
    }
    if (!requireSameOrigin(req)) return sendJson(res, 403, { error: "Origem da solicitação não autorizada." });
    if (!hasValidAdminSession(req)) return sendJson(res, 401, { error: "Sessão administrativa inválida ou expirada." });

    const state = requestBody(req);
    validateState(state);
    const record = await updateState(state);
    return sendJson(res, 200, { saved: true, initialized: record.initialized });
  } catch (error) {
    return sendError(res, error, "Falha na API de estado.");
  }
};
