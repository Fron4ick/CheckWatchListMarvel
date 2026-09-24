// lib/api.ts — клиент serverless REST API (backend/).
// Все вызовы идут на базовый URL из NEXT_PUBLIC_API_URL; если переменная
// не задана, запросы отключаются и приложение работает только локально.

export type ApiUser = {
  id: string;
  email: string | null;
  name: string;
  provider: string;
  providerId: string | null;
};

export type WatchedItem = { watched: boolean; updatedAt: string };
export type WatchedMap = Record<string, WatchedItem>;

export type VerifyResult = {
  token: string;
  user: ApiUser;
  watched: { items: WatchedMap };
};

export type MeResult = {
  user: ApiUser;
  watched: { items: WatchedMap };
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");

export function apiEnabled(): boolean {
  return API_BASE.length > 0;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE) throw new Error("API недоступен: не задан NEXT_PUBLIC_API_URL");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) || `Ошибка сервера (HTTP ${res.status})`;
    throw new Error(typeof message === "string" ? message : "Неизвестная ошибка");
  }
  return data as T;
}

export const api = {
  /** Запросить одноразовый код на email. В dev-режиме возвращает debugCode. */
  requestCode: (email: string) =>
    apiRequest<{ ok: boolean; debugCode?: string }>("/auth/code", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  /** Проверить код и получить токен сессии вместе со списком просмотренных. */
  verifyCode: (email: string, code: string) =>
    apiRequest<VerifyResult>("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),

  me: (token: string) =>
    apiRequest<MeResult>("/me", { headers: { Authorization: `Bearer ${token}` } }),

  getWatched: (token: string) =>
    apiRequest<{ items: WatchedMap }>("/me/watched", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /** LWW-слияние: сервер вернёт актуальное состояние после мержа. */
  mergeWatched: (token: string, items: WatchedMap) =>
    apiRequest<{ items: WatchedMap }>("/me/watched/merge", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items }),
    }),

  logout: (token: string) =>
    apiRequest<{ ok: boolean }>("/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),
};