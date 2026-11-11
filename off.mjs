// BRUDEL food lookup using the free Open Food Facts database (no key needed).
// Data © Open Food Facts contributors, ODbL license.
const UA = "BRUDEL/1.0 (personal fitness tracker)";
const num = v => (v == null || v === "" || isNaN(+v)) ? null : +v;

function pick(p) {
  const n = p.nutriments || {};
  const servK = num(n["energy-kcal_serving"]);
  const per = servK != null ? "_serving" : "_100g";
  const k = servK != null ? servK : num(n["energy-kcal_100g"]);
  if (k == null) return null;
  const g = s => num(n[s + per]) || 0;
  const name = [String(p.brands || "").split(",")[0].trim(), p.product_name || ""].filter(Boolean).join(" ").trim();
  if (!name) return null;
  return { n: name.slice(0, 80), sv: servK != null ? (p.serving_size || "1 serving") : "100 g", k, p: g("proteins"), c: g("carbohydrates"), f: g("fat"), code: p.code || "" };
}

async function getJSON(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/json" } });
  if (!r.ok) throw new Error("status " + r.status);
  return r.json();
}

export default async (req) => {
  const u = new URL(req.url);
  const code = (u.searchParams.get("code") || "").trim();
  const q = (u.searchParams.get("q") || "").trim().slice(0, 60);
  const fields = "code,product_name,brands,serving_size,nutriments";
  const headers = { "Cache-Control": "public, max-age=3600" };

  if (code) {
    if (!/^\d{6,14}$/.test(code)) return Response.json({ found: false }, { status: 400 });
    try {
      const j = await getJSON(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`);
      const f = j && j.product ? pick({ ...j.product, code }) : null;
      return Response.json(f ? { found: true, food: f } : { found: false }, { headers });
    } catch { return Response.json({ found: false, error: "lookup_failed" }, { status: 502 }); }
  }

  if (q) {
    const enc = encodeURIComponent(q);
    let list = [];
    try {
      const j = await getJSON(`https://search.openfoodfacts.org/search?q=${enc}&page_size=24&langs=en&fields=${fields}`);
      list = j.hits || [];
    } catch {}
    if (!list.length) {
      try {
        const j = await getJSON(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${enc}&search_simple=1&action=process&json=1&page_size=24&fields=${fields}`);
        list = j.products || [];
      } catch {}
    }
    const seen = new Set(), out = [];
    for (const p of list) {
      const f = pick(p);
      if (!f) continue;
      const key = f.n.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key); out.push(f);
      if (out.length >= 12) break;
    }
    return Response.json({ foods: out }, { headers });
  }
  return Response.json({ ok: true });
};

export const config = { path: "/api/off" };
