// Funzione serverless Vercel: inoltra un messaggio al bot Telegram.
// Il token resta lato server (variabili d'ambiente), mai nel codice del sito.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  const { message } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: "Manca il campo 'message'" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return res.status(500).json({ error: "TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID non configurati su Vercel" });
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    if (!r.ok) {
      const dettaglio = await r.text();
      return res.status(502).json({ error: `Telegram ha risposto con errore: ${dettaglio}` });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
