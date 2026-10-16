// NoteMind cloud fallback – Vercel serverless function (Groq, OpenAI-compatible).
// Key comes only from env GROQ_API_KEY. Model configurable via GROQ_MODEL.
const MODELS = [process.env.GROQ_MODEL, "openai/gpt-oss-20b", "qwen/qwen3.8-27b"].filter(Boolean);
const clean = (t) => (t || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Server missing GROQ_API_KEY" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages.slice(0, 10) : [];
    if (!messages.length) return res.status(400).json({ error: "messages required" });
    let lastErr = "Groq error";
    for (const model of MODELS) {
      const payload = { model, messages, max_tokens: Math.min(Number(body.max_tokens) || 900, 2000), temperature: Number(body.temperature) || 0.6 };
      if (model.startsWith("openai/gpt-oss")) payload.include_reasoning = false;
      else if (model.startsWith("qwen/")) payload.reasoning_format = "hidden";
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return res.status(200).json({ text: clean(j.choices?.[0]?.message?.content), model });
      lastErr = j.error?.message || `Groq error ${r.status}`;
      if (r.status === 401) break;
    }
    res.status(502).json({ error: lastErr });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
