// backend/src/mailer.js — отправка одноразового кода.
//
// Режимы:
// 1) Если задан MAIL_WEBHOOK_URL — шлём POST { to, subject, text } с Bearer-токеном
//    из MAIL_WEBHOOK_TOKEN (можно подключить любой почтовый шлюз/API).
// 2) Иначе — код пишется в лог и возвращается в ответе как debugCode (режим разработки).

export async function sendCode(email, code) {
  const url = process.env.MAIL_WEBHOOK_URL;
  if (url) {
    const token = process.env.MAIL_WEBHOOK_TOKEN || "";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        to: email,
        subject: "Код входа в Marvel Timeline Board",
        text: `Ваш одноразовый код: ${code}. Никому не сообщайте его.`,
      }),
    });
    if (!res.ok) {
      throw new Error(`Mail webhook failed (${res.status})`);
    }
    return false; // debug-код не показываем
  }
  console.log(`[mailer:dev] code for ${email}: ${code}`);
  return true; // debug-код показываем в ответе
}