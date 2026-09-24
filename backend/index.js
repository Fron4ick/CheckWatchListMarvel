import { cors, json } from "./src/utils.js";
import {
  handleCode,
  handleVerify,
  handleOAuthAuthorize,
  handleOAuthCallback,
  handleLogout,
  handleMe,
} from "./src/auth.js";
import { handleGetWatched, handleMergeWatched } from "./src/watched.js";

/**
 * Yandex Cloud Functions entry point.
 * HTTP-триггер передаёт событие в формате, совместимом с API Gateway:
 * { httpMethod, path, headers, body, isBase64Encoded, queryStringParameters }.
 */
export const handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || "GET";
  const path = (event.path || event.requestContext?.http?.path || "/").split("?")[0];
  const headers = event.headers || {};
  const rawBody = event.body || "";
  const body = event.isBase64Encoded ? Buffer.from(rawBody, "base64").toString("utf8") : rawBody;
  const query = event.queryStringParameters || {};
  const req = { method, path, headers, body, query };

  if (method === "OPTIONS") return cors();

  try {
    if (path === "/health") return json(200, { ok: true });

    // ── Auth ─────────────────────────────────────────────────────────
    if (path === "/auth/code" && method === "POST") return await handleCode(req);
    if (path === "/auth/verify" && method === "POST") return await handleVerify(req);
    const oauthCallbackMatch = path.match(/^\/auth\/oauth\/([\w-]+)\/callback$/);
    if (oauthCallbackMatch && (method === "GET" || method === "POST")) {
      return await handleOAuthCallback(oauthCallbackMatch[1], req.query);
    }
    const oauthAuthMatch = path.match(/^\/auth\/oauth\/([\w-]+)\/authorize$/);
    if (oauthAuthMatch && method === "GET") return await handleOAuthAuthorize(oauthAuthMatch[1]);
    // Обратная совместимость: POST /auth/oauth/:provider запускает authorize-редирект.
    const oauthMatch = path.match(/^\/auth\/oauth\/([\w-]+)$/);
    if (oauthMatch && method === "POST") return await handleOAuthAuthorize(oauthMatch[1]);
    if (path === "/auth/logout" && method === "POST") return await handleLogout(req);
    if (path === "/me" && method === "GET") return await handleMe(req);

    // ── Watched sync ─────────────────────────────────────────────────
    if (path === "/me/watched" && method === "GET") return await handleGetWatched(req);
    if (path === "/me/watched/merge" && method === "POST") return await handleMergeWatched(req);

    return json(404, { error: "not_found" });
  } catch (err) {
    console.error(err);
    return json(500, { error: "internal_error", message: err?.message });
  }
};