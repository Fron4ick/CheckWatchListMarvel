// backend/src/store.js — слой хранения данных.
//
// Две реализации с одинаковым интерфейсом:
//  * MemoryStore — для локальной разработки и тестов (STORAGE=memory или нет YDB_DOCAPI_ENDPOINT);
//  * YdbStore    — Yandex YDB Document API (DynamoDB-совместимый HTTP), без внешних SDK.
//
// Переменные окружения для YDB:
//  YDB_DOCAPI_ENDPOINT  — например https://docapi.serverless.yandexcloud.net/ru-central1/<db-id>
//  YDB_TABLE_PREFIX     — префикс таблиц (по умолчанию marvel_)
//  YDB_IAM_TOKEN        — опционально, статический IAM-токен (иначе берётся из metadata-сервиса функции)
//  STORAGE=memory       — принудительно использовать память

const USE_YDB = Boolean(process.env.YDB_DOCAPI_ENDPOINT) && process.env.STORAGE !== "memory";

class MemoryStore {
  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.codes = new Map();
    this.watched = new Map();
    this.emailIndex = new Map();
  }

  async findUserByEmail(email) {
    const id = this.emailIndex.get(email);
    return id ? this.users.get(id) || null : null;
  }

  async findUserByProvider(provider, providerId) {
    for (const u of this.users.values()) {
      if (u.provider === provider && u.providerId === providerId) return u;
    }
    return null;
  }

  async createUser(user) {
    this.users.set(user.id, user);
    if (user.email) this.emailIndex.set(user.email, user.id);
    return user;
  }

  async getUser(id) {
    return this.users.get(id) || null;
  }

  async updateUser(id, patch) {
    const user = this.users.get(id);
    if (!user) return null;
    // При смене email пересоздаём индекс, чтобы не осталось битого ключа.
    if (patch.email && patch.email !== user.email) this.emailIndex.delete(user.email);
    const next = { ...user, ...patch, updatedAt: patch.updatedAt || user.updatedAt };
    this.users.set(id, next);
    if (next.email) this.emailIndex.set(next.email, id);
    return next;
  }

  async createSession(session) {
    this.sessions.set(session.token, session);
    return session;
  }

  async getSession(token) {
    const s = this.sessions.get(token);
    if (!s) return null;
    if (Date.parse(s.expiresAt) < Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    return s;
  }

  async deleteSession(token) {
    this.sessions.delete(token);
  }

  async createCode(record) {
    this.codes.set(record.email, record);
    return record;
  }

  async getCode(email) {
    return this.codes.get(email) || null;
  }

  async deleteCode(email) {
    this.codes.delete(email);
  }

  async getWatched(userId) {
    return this.watched.get(userId) || { userId, items: {}, updatedAt: null };
  }

  async putWatched(userId, items, updatedAt) {
    const record = { userId, items, updatedAt };
    this.watched.set(userId, record);
    return record;
  }
}

class YdbStore {
  constructor() {
    this.endpoint = process.env.YDB_DOCAPI_ENDPOINT;
    this.prefix = process.env.YDB_TABLE_PREFIX || "marvel_";
    this.iamToken = process.env.YDB_IAM_TOKEN || "";
    // Кэш метаданных-токена: metadata-сервис отдаёт токен, живущий ~1 час,
    // поэтому запрашивать его на каждый docapi-вызов не нужно.
    this.metadataToken = { value: "", expiresAt: 0 };
  }

  async iam() {
    if (this.iamToken) return this.iamToken;
    if (this.metadataToken.value && Date.now() < this.metadataToken.expiresAt) {
      return this.metadataToken.value;
    }
    // Внутри Yandex Cloud Functions токен сервисного аккаунта доступен через metadata-сервис.
    const res = await fetch(
      "http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" } },
    );
    if (!res.ok) throw new Error("IAM token unavailable");
    const data = await res.json();
    this.metadataToken = {
      value: data.access_token,
      expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000,
    };
    return this.metadataToken.value;
  }

  async docapi(table, payload) {
    const token = await this.iam();
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...payload, TableName: this.prefix + table }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`YDB Document API failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  s(v) {
    return { S: String(v) };
  }

  read(data) {
    if (!data || !data.Item) return null;
    return JSON.parse(data.Item.data.S || "null");
  }

  async put(table, keyName, keyValue, data) {
    await this.docapi(table, {
      Item: { [keyName]: this.s(keyValue), data: this.s(JSON.stringify(data)) },
    });
    return data;
  }

  async get(table, keyName, keyValue) {
    const res = await this.docapi(table, { Key: { [keyName]: this.s(keyValue) } });
    return this.read(res);
  }

  async del(table, keyName, keyValue) {
    await this.docapi(table, { Key: { [keyName]: this.s(keyValue) } });
  }

  async findUserByEmail(email) {
    const ref = await this.get("users_by_email", "email", email);
    return ref ? this.get("users", "id", ref.userId) : null;
  }

  async findUserByProvider(provider, providerId) {
    const ref = await this.get("users_by_provider", "providerId", `${provider}:${providerId}`);
    return ref ? this.get("users", "id", ref.userId) : null;
  }

  async createUser(user) {
    await this.put("users", "id", user.id, user);
    if (user.email) await this.put("users_by_email", "email", user.email, { userId: user.id });
    if (user.providerId) {
      await this.put("users_by_provider", "providerId", `${user.provider}:${user.providerId}`, { userId: user.id });
    }
    return user;
  }

  async getUser(id) {
    return this.get("users", "id", id);
  }

  async updateUser(id, patch) {
    const user = await this.get("users", "id", id);
    if (!user) return null;
    const next = { ...user, ...patch, updatedAt: patch.updatedAt || user.updatedAt };
    await this.put("users", "id", id, next);
    if (next.email) await this.put("users_by_email", "email", next.email, { userId: id });
    return next;
  }

  async createSession(session) {
    await this.put("sessions", "token", session.token, session);
    return session;
  }

  async getSession(token) {
    const s = await this.get("sessions", "token", token);
    if (!s) return null;
    if (Date.parse(s.expiresAt) < Date.now()) {
      await this.del("sessions", "token", token);
      return null;
    }
    return s;
  }

  async deleteSession(token) {
    await this.del("sessions", "token", token);
  }

  async createCode(record) {
    await this.put("codes", "email", record.email, record);
    return record;
  }

  async getCode(email) {
    return this.get("codes", "email", email);
  }

  async deleteCode(email) {
    await this.del("codes", "email", email);
  }

  async getWatched(userId) {
    return (await this.get("watched", "userId", userId)) || { userId, items: {}, updatedAt: null };
  }

  async putWatched(userId, items, updatedAt) {
    const record = { userId, items, updatedAt };
    await this.put("watched", "userId", userId, record);
    return record;
  }
}

export const store = USE_YDB ? new YdbStore() : new MemoryStore();