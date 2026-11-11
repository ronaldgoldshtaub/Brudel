// BRUDEL friends leagues. Each league has a 6-character code; each player
// can only update their own entry (protected by a secret kept on their phone).
import { getStore } from "@netlify/blobs";

const json = (obj, status = 200) => Response.json(obj, { status });
const CODE = /^[A-Z0-9]{6}$/;
const ID = /^[a-zA-Z0-9_-]{8,40}$/;

async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
const int = (v, max = 100000) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));

function clean(d) {
  const fives = {};
  if (d && typeof d.fives === "object") {
    for (const [k, v] of Object.entries(d.fives).slice(0, 60)) if (ID.test(k) && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) fives[k] = String(v);
  }
  return {
    name: String(d?.name || "Athlete").replace(/[<>]/g, "").slice(0, 20),
    goal: ["lose", "gain", "recomp", "endurance", "maintain"].includes(d?.goal) ? d.goal : "maintain",
    week: /^\d{4}-\d{2}-\d{2}$/.test(String(d?.week)) ? d.week : "",
    pts: int(d?.pts, 2000), gym: int(d?.gym, 14), cardio: int(d?.cardio, 21), protein: int(d?.protein, 7),
    water: int(d?.water, 7), sleep: int(d?.sleep, 7), streak: int(d?.streak, 1000), total: int(d?.total), fives,
    updatedAt: Date.now()
  };
}

export default async (req) => {
  const store = getStore({ name: "leagues", consistency: "strong" });
  const u = new URL(req.url);

  if (req.method === "GET") {
    if (u.searchParams.has("ping")) return json({ ok: true });
    const code = (u.searchParams.get("code") || "").toUpperCase();
    if (!CODE.test(code)) return json({ error: "bad_code" }, 400);
    const { blobs } = await store.list({ prefix: code + "/" });
    const players = [];
    for (const b of blobs.slice(0, 60)) {
      const p = await store.get(b.key, { type: "json" });
      if (p) { const { secretHash, ...pub } = p; players.push({ id: b.key.split("/")[1], ...pub }); }
    }
    return json({ players });
  }

  let body;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const code = String(body?.code || "").toUpperCase(), id = String(body?.id || ""), secret = String(body?.secret || "");
  if (!CODE.test(code) || !ID.test(id) || secret.length < 16 || secret.length > 80) return json({ error: "bad_request" }, 400);
  const key = `${code}/${id}`;
  const existing = await store.get(key, { type: "json" });
  const hash = await sha(secret);
  if (existing && existing.secretHash !== hash) return json({ error: "forbidden" }, 403);

  if (req.method === "DELETE") { await store.delete(key); return json({ ok: true }); }
  if (req.method === "POST") {
    if (!existing) {
      const { blobs } = await store.list({ prefix: code + "/" });
      if (blobs.length >= 50) return json({ error: "league_full" }, 409);
    }
    await store.setJSON(key, { ...clean(body.data), secretHash: hash });
    return json({ ok: true });
  }
  return json({ error: "method_not_allowed" }, 405);
};

export const config = { path: "/api/league" };
