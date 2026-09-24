// lib/watchlist.ts — локальная копия списка «Просмотрено» и синхронизация
// с backend (LWW по updatedAt). Существующий ключ marvel-timeline-board-v1
// продолжает хранить только массив id (обратная совместимость), а метки
// времени для мержа живут в отдельном ключе.

import type { ApiUser, WatchedMap, WatchedItem } from "./api";

export const SYNC_TIMES_KEY = "marvel-timeline-board-times-v1";
export const AUTH_STORAGE_KEY = "marvel-timeline-board-auth-v1";

const EPOCH = "1970-01-01T00:00:00.000Z";

export function nowIso(): string {
  return new Date().toISOString();
}

export function toWatchedItems(ids: string[], times: Record<string, string>): WatchedMap {
  const items: WatchedMap = {};
  const seen = new Set<string>();
  for (const id of ids) {
    seen.add(id);
    items[id] = { watched: true, updatedAt: times[id] ?? EPOCH };
  }
  for (const [id, updatedAt] of Object.entries(times)) {
    if (!seen.has(id)) {
      items[id] = { watched: false, updatedAt };
    }
  }
  return items;
}

export function watchedIdsFromItems(items: WatchedMap): string[] {
  return Object.entries(items)
    .filter(([, item]) => item.watched)
    .map(([id]) => id);
}

export function timesFromItems(items: WatchedMap): Record<string, string> {
  const times: Record<string, string> = {};
  for (const [id, item] of Object.entries(items)) times[id] = item.updatedAt;
  return times;
}

/** LWW-слияние двух карт отметок: побеждает более поздний updatedAt. */
export function mergeWatchlists(a: WatchedMap, b: WatchedMap): WatchedMap {
  const out: WatchedMap = { ...a };
  for (const [id, item] of Object.entries(b)) {
    const cur = out[id];
    if (!cur || String(item.updatedAt) >= String(cur.updatedAt)) {
      out[id] = { watched: Boolean(item.watched), updatedAt: String(item.updatedAt) };
    }
  }
  return out;
}

export function loadSyncTimes(legacyIds: string[]): Record<string, string> {
  if (typeof window === "undefined") return {};
  let times: Record<string, string> = {};
  try {
    const raw = window.localStorage.getItem(SYNC_TIMES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") times = parsed;
    }
  } catch {
    times = {};
  }
  // Миграция со старого формата: у локальных id без метки времени ставим epoch,
  // чтобы при первом мерже серверные данные имели приоритет.
  for (const id of legacyIds) {
    if (!times[id]) times[id] = EPOCH;
  }
  return times;
}

export function saveSyncTimes(times: Record<string, string>): void {
  try {
    window.localStorage.setItem(SYNC_TIMES_KEY, JSON.stringify(times));
  } catch {
    // Квота localStorage — синхронизация просто отложится до следующего изменения.
  }
}

export type StoredSession = { token: string; user: ApiUser };

export function loadSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed || typeof parsed.token !== "string" || !parsed.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession | null): void {
  try {
    if (session) window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Не критично — сессия будет недоступна после перезагрузки.
  }
}

/** Нормализуем элемент карты: валидная структура либо null. */
export function normalizeWatchedItem(value: unknown): WatchedItem | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<WatchedItem>;
  if (typeof v.updatedAt !== "string") return null;
  return { watched: Boolean(v.watched), updatedAt: v.updatedAt };
}