// backend/src/watched.js — синхронизация отметок «Просмотрено».
//
// Стратегия: last-write-wins по updatedAt для каждого mediaId.
// Клиент шлёт свои локальные изменения (включая офлайн-очередь),
// сервер мержит и возвращает актуальное состояние.

import { json, readJson, nowIso } from "./utils.js";
import { store } from "./store.js";
import { bearerToken } from "./auth.js";

async function requireUser(req) {
  const token = bearerToken(req.headers);
  const session = token ? await store.getSession(token) : null;
  if (!session) return null;
  return store.getUser(session.userId);
}

export async function handleGetWatched(req) {
  const user = await requireUser(req);
  if (!user) return json(401, { error: "unauthorized" });
  const watched = await store.getWatched(user.id);
  return json(200, { items: watched.items });
}

export async function handleMergeWatched(req) {
  const user = await requireUser(req);
  if (!user) return json(401, { error: "unauthorized" });

  const { items } = readJson(req.body);
  if (!items || typeof items !== "object") {
    return json(400, { error: "invalid_items" });
  }

  const current = await store.getWatched(user.id);
  const merged = { ...current.items };

  for (const [mediaId, item] of Object.entries(items)) {
    if (!mediaId || typeof item?.updatedAt !== "string") continue;
    const cur = merged[mediaId];
    if (!cur || String(item.updatedAt) >= String(cur.updatedAt)) {
      merged[mediaId] = {
        watched: Boolean(item.watched),
        updatedAt: String(item.updatedAt),
      };
    }
  }

  await store.putWatched(user.id, merged, nowIso());
  return json(200, { items: merged });
}