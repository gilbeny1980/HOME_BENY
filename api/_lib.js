const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
async function redis(...cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
const getJSON = async k => { const v = await redis('GET', k); return v ? JSON.parse(v) : null; };
const setJSON = (k, v) => redis('SET', k, JSON.stringify(v));
const COLS = ['tasks', 'events', 'contacts', 'notes'];
function mergeList(a = [], b = []) {
  const m = new Map();
  for (const x of [...a, ...b]) { const o = m.get(x.id); if (!o || (x.u || 0) >= (o.u || 0)) m.set(x.id, x); }
  return [...m.values()];
}
function merge(a = {}, b = {}) { const out = {}; for (const c of COLS) out[c] = mergeList(a[c], b[c]); return out; }
function auth(req, res) {
  const code = process.env.FAMILY_CODE;
  if (!code || req.headers['x-family-code'] !== code) { res.status(401).json({ error: 'bad code' }); return false; }
  return true;
}
module.exports = { redis, getJSON, setJSON, merge, auth };
