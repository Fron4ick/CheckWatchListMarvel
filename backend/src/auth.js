// backend/src/auth.js — passwordless-аутентификация.
//
// Вход по коду на email: POST /auth/code → POST /auth/verify → сессионный токен.
// OAuth (Яндекс/Google/VK) — каркас: требуется регистрация приложения и env-переменные
// OAUTH_<PROVIDER>_CLIENT_ID / OAUTH_<PROVIDER>_CLIENT_SECRET.

import { json, readJson, nowIso, randomToken, sha256, normalizeEmail, generateCode } from "./utils.js";
import { store } from "./store.js";
import { sendCode } from "./mailer.js";

const CODE_TTL_MS = 10 * 60 * 1000; // код живёт 10 минут
const CODE_RESEND_MS = 60 * 1000; // повторная отправка не чаще раза в минуту
const CODE_MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // сессия живёт 90 дней

export function bearerToken(headers) {
  const h = headers?.authorization || headers?.Authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

export async function handleCode(req) {
  const { email } = readJson(req.body);
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return json(400, { error: "invalid_email" });
  }

  const existing = await store.getCode(normalized);
  if (existing && Date.now() - Date.parse(existing.createdAt) < CODE_RESEND_MS) {
    return json(429, { error: "rate_limit" });
  }

  const code = generateCode();
  const record = {
    email: normalized,
    codeHash: await sha256(`${normalized}:${code}`),
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    attempts: 0,
  };
  await store.createCode(record);

  const debug = await sendCode(normalized, code);
  return json(200, { ok: true, ...(debug ? { debugCode: code } : {}) });
}

export async function handleVerify(req) {
  const { email, code } = readJson(req.body);
  const normalized = normalizeEmail(email);
  const record = await store.getCode(normalized);

  if (!record) return json(401, { error: "no_code" });
  if (Date.parse(record.expiresAt) < Date.now()) {
    await store.deleteCode(normalized);
    return json(401, { error: "code_expired" });
  }

  const hash = await sha256(`${normalized}:${String(code).trim()}`);
  if (hash !== record.codeHash) {
    record.attempts += 1;
    if (record.attempts >= CODE_MAX_ATTEMPTS) {
      await store.deleteCode(normalized);
    } else {
      await store.createCode(record);
    }
    return json(401, { error: "invalid_code" });
  }

  await store.deleteCode(normalized);

  let user = await store.findUserByEmail(normalized);
  if (!user) {
    user = {
      id: "u_" + randomToken(16),
      email: normalized,
      provider: "email",
      providerId: null,
      name: normalized.split("@")[0],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await store.createUser(user);
  }

  const watched = await store.getWatched(user.id);
  const token = "t_" + randomToken(32);
  await store.createSession({
    token,
    userId: user.id,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });

  return json(200, { token, user, watched: { items: watched.items } });
}

// ─── OAuth (Authorization Code Flow: Яндекс / Google / VK ID) ────────────

const OAUTH_PROVIDERS = {
  yandex: {
    authorizeUrl: "https://oauth.yandex.ru/authorize",
    tokenUrl: "https://oauth.yandex.ru/token",
    userUrl: "https://login.yandex.ru/info",
    scope: "login:email login:info",
    userInfo: (data) => ({
      providerId: String(data.id || ""),
      email: data.default_email || data.emails?.[0] || "",
      name: data.display_name || data.first_name || "",
    }),
  },
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    scope: "openid email profile",
    userInfo: (data) => ({
      providerId: String(data.id || ""),
      email: data.email || "",
      name: data.name || "",
    }),
  },
  vk: {
    authorizeUrl: "https://id.vk.com/authorize",
    tokenUrl: "https://id.vk.com/oauth2/auth",
    userUrl: "https://api.vk.com/method/users.get",
    scope: "email",
    userInfo: (data) => ({
      providerId: String(data.id || ""),
      email: data.email || "",
      name: [data.first_name, data.last_name].filter(Boolean).join(" ") || "",
    }),
  },
};

function oauthEnv(provider) {
  const key = provider.toUpperCase();
  const base =
    process.env.OAUTH_REDIRECT_BASE ||
    (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  return {
    clientId: process.env[`OAUTH_${key}_CLIENT_ID`] || "",
    clientSecret: process.env[`OAUTH_${key}_CLIENT_SECRET`] || "",
    redirectUri:
      process.env[`OAUTH_${key}_REDIRECT_URI`] ||
      `${base}/api/auth/oauth/${provider}/callback`,
  };
}

function oauthAuthorizeUrl(provider, state) {
  const cfg = OAUTH_PROVIDERS[provider];
  const { clientId, redirectUri } = oauthEnv(provider);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: cfg.scope,
    state,
  });
  if (provider === "vk") params.set("display", "page");
  return `${cfg.authorizeUrl}?${params.toString()}`;
}

async function oauthExchangeCode(provider, code) {
  const cfg = OAUTH_PROVIDERS[provider];
  const { clientId, clientSecret, redirectUri } = oauthEnv(provider);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: String(code),
    client_id: clientId,
    redirect_uri: redirectUri,
  });
  if (clientSecret) body.set("client_secret", clientSecret);
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(
      `OAuth token error (${provider}): ${data.error_description || data.error || res.status}`,
    );
  }
  return data;
}

async function oauthFetchProfile(provider, accessToken) {
  const cfg = OAUTH_PROVIDERS[provider];
  if (provider === "vk") {
    const res = await fetch(
      `${cfg.userUrl}?fields=first_name,last_name,email&v=5.199`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const data = await res.json().catch(() => ({}));
    const user = data?.response?.[0] || {};
    return cfg.userInfo(user);
  }
  const res = await fetch(cfg.userUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  return cfg.userInfo(data);
}

function redirect(statusCode, location) {
  return {
    statusCode,
    headers: { Location: location, "Access-Control-Allow-Origin": "*" },
    body: "",
  };
}

/**
 * GET /auth/oauth/:provider/authorize — перенаправляет пользователя
 * на страницу согласия провайдера (Authorization Code Flow).
 */
export async function handleOAuthAuthorize(provider) {
  const cfg = OAUTH_PROVIDERS[provider];
  if (!cfg) return json(400, { error: "unknown_provider", provider });
  const { clientId } = oauthEnv(provider);
  if (!clientId) return json(501, { error: "not_configured", provider });
  const state = randomToken(16);
  return redirect(302, oauthAuthorizeUrl(provider, state));
}

/**
 * GET/POST /auth/oauth/:provider/callback — обменивает авторизационный код
 * на токен, получает профиль, создаёт/находит пользователя и открывает сессию.
 * Возвращает 302 на FRONTEND_URL/?auth=<token>, либо JSON при ?format=json.
 */
export async function handleOAuthCallback(provider, query = {}) {
  const cfg = OAUTH_PROVIDERS[provider];
  if (!cfg) return json(400, { error: "unknown_provider", provider });

  const code = String(query.code || "");
  if (!code) return json(400, { error: "missing_code" });

  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  try {
    const tokenData = await oauthExchangeCode(provider, code);
    const profile = await oauthFetchProfile(provider, tokenData.access_token);
    if (!profile.providerId) throw new Error("OAuth профиль не содержит id");

    const email = normalizeEmail(profile.email) || null;
    let user = email ? await store.findUserByEmail(email) : null;
    if (!user) user = await store.findUserByProvider(provider, profile.providerId);
    if (!user) {
      user = {
        id: "u_" + randomToken(16),
        email,
        provider,
        providerId: profile.providerId,
        name: profile.name || email?.split("@")[0] || provider,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await store.createUser(user);
    } else if (user.provider !== provider) {
      // Связываем существующего пользователя с провайдером, чтобы
      // следующий вход находился через users_by_provider.
      await store.updateUser(user.id, { provider, providerId: profile.providerId });
    }

    const watched = await store.getWatched(user.id);
    const token = "t_" + randomToken(32);
    await store.createSession({
      token,
      userId: user.id,
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    });

    if (query.format === "json") {
      return json(200, { token, user, watched: { items: watched.items } });
    }
    return redirect(302, `${frontendUrl}/?auth=${encodeURIComponent(token)}`);
  } catch (error) {
    console.error("OAuth callback failed:", error);
    return json(502, { error: "oauth_exchange_failed", message: error?.message });
  }
}

export async function handleLogout(req) {
  const token = bearerToken(req.headers);
  if (token) await store.deleteSession(token);
  return json(200, { ok: true });
}

export async function handleMe(req) {
  const token = bearerToken(req.headers);
  const session = token ? await store.getSession(token) : null;
  if (!session) return json(401, { error: "unauthorized" });
  const user = await store.getUser(session.userId);
  if (!user) return json(401, { error: "unauthorized" });
  const watched = await store.getWatched(user.id);
  return json(200, { user, watched: { items: watched.items } });
}