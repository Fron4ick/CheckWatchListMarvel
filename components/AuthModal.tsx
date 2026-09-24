"use client";

import { useState } from "react";
import { api, apiEnabled, type ApiUser, type WatchedMap } from "@/lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onAuthed: (token: string, user: ApiUser, watched?: WatchedMap) => void;
};

const OAUTH_PROVIDERS: Array<{ id: string; label: string }> = [
  { id: "yandex", label: "Яндекс" },
  { id: "google", label: "Google" },
  { id: "vk", label: "VK" },
];

export function AuthModal({ open, onClose, onAuthed }: Props) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [debugCode, setDebugCode] = useState<string | null>(null);

  if (!open) return null;

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await api.requestCode(email.trim());
      setDebugCode(result.debugCode ?? null);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запросить код");
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await api.verifyCode(email.trim(), code.trim());
      onAuthed(result.token, result.user, result.watched?.items ?? {});
      setStep("email");
      setEmail("");
      setCode("");
      setDebugCode(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  };

  const startOAuth = (providerId: string) => {
    const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
    window.location.assign(`${base}/auth/oauth/${providerId}/authorize`);
  };

  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <section
        className="help-modal auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Закрыть">×</button>
        <span className="modal-kicker">СИНХРОНИЗАЦИЯ</span>
        <h2 id="auth-title">Вход по коду</h2>
        <p className="auth-note">
          Отметки «Просмотрено» будут сохраняться в облаке и синхронизироваться между
          устройствами. Локальные данные при этом не пропадут.
        </p>

        {step === "email" ? (
          <form className="auth-form" onSubmit={submitEmail}>
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              placeholder="user@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {debugCode && (
              <p className="auth-debug">
                Dev-код: <b>{debugCode}</b>
              </p>
            )}
            <button className="primary-button" type="submit" disabled={busy || !apiEnabled()}>
              {busy ? "Отправляем…" : "Получить код"}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={submitCode}>
            <label htmlFor="auth-code">Код из письма</label>
            <input
              id="auth-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              pattern="[0-9]{4,6}"
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
            {debugCode && (
              <p className="auth-debug">
                Dev-код: <b>{debugCode}</b>
              </p>
            )}
            <div className="auth-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setStep("email");
                  setDebugCode(null);
                }}
              >
                ← Другой email
              </button>
              <button className="primary-button" type="submit" disabled={busy}>
                {busy ? "Проверяем…" : "Войти"}
              </button>
            </div>
          </form>
        )}

        {error && <p className="auth-error" role="alert">{error}</p>}

        {!apiEnabled() && (
          <p className="auth-hint">
            Синхронизация выключена: не задан <code>NEXT_PUBLIC_API_URL</code>. Карта продолжит
            работать локально.
          </p>
        )}

        {apiEnabled() && (
          <div className="auth-oauth">
            <span className="auth-divider">или через</span>
            <div className="auth-oauth-buttons">
              {OAUTH_PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  className="secondary-button"
                  onClick={() => startOAuth(provider.id)}
                >
                  {provider.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}