// BRUDEL AI helper. Keeps your Anthropic API key secret on the server
// and limits how many AI requests each person (and the whole site) can make per day.
import { getStore } from "@netlify/blobs";

const json = (obj, status = 200) => Response.json(obj, { status });

export default async (req, context) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (req.method === "GET") return json({ ok: !!key });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!key) return json({ error: "not_configured" }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const prompt = typeof body?.prompt === "string" ? body.prompt.slice(0, 6000) : "";
  const images = Array.isArray(body?.images) ? body.images.slice(0, 2) : [];
  if (!prompt) return json({ error: "bad_request" }, 400);
  for (const im of images) {
    if (!im || typeof im.data !== "string" || im.data.length > 2_000_000 || !/^image\/(jpeg|png|webp|gif)$/.test(im.type || "")) {
      return json({ error: "bad_image" }, 400);
    }
  }

  // Daily limits (per person by IP address, and for the whole site)
  const perPerson = Number(process.env.DAILY_LIMIT_PER_PERSON || 25);
  const perSite = Number(process.env.DAILY_LIMIT_TOTAL || 500);
  const day = new Date().toISOString().slice(0, 10);
  const ip = context.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
  const store = getStore("ai-usage");
  const userKey = `${day}/ip/${ip}`, siteKey = `${day}/total`;
  const [used, total] = await Promise.all([
    store.get(userKey, { type: "json" }), store.get(siteKey, { type: "json" })
  ]);
  if ((used || 0) >= perPerson) return json({ error: "daily_limit" }, 429);
  if ((total || 0) >= perSite) return json({ error: "site_limit" }, 429);
  await Promise.all([store.setJSON(userKey, (used || 0) + 1), store.setJSON(siteKey, (total || 0) + 1)]);

  const content = [
    ...images.map(im => ({ type: "image", source: { type: "base64", media_type: im.type, data: im.data } })),
    { type: "text", text: prompt }
  ];
  let r;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "claude-haiku-5-5",
        max_tokens: 1200,
        system: "You are the nutrition and fitness helper inside the BRUDEL app. Respond with only valid JSON and nothing else: no markdown, no code fences, no commentary.",
        messages: [{ role: "user", content }]
      })
    });
  } catch { return json({ error: "ai_unreachable" }, 502); }
  if (!r.ok) return json({ error: "ai_error", status: r.status }, 502);
  const data = await r.json();
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  return json({ text });
};

export const config = { path: "/api/ai" };
