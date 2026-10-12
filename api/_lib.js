const { createClient } = require('@libsql/client');
let db, ready;
function client() {
  if (!db) db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  return db;
}
function init() {
  if (!ready) ready = client().batch([
    'CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)',
    'CREATE TABLE IF NOT EXISTS subs (endpoint TEXT PRIMARY KEY, data TEXT)',
    'CREATE TABLE IF NOT EXISTS fired (k TEXT PRIMARY KEY)',
    'CREATE TABLE IF NOT EXISTS otp (id INTEGER PRIMARY KEY, h TEXT, exp INTEGER, tries INTEGER)',
    'CREATE TABLE IF NOT EXISTS otp_log (ts INTEGER)',
    'CREATE TABLE IF NOT EXISTS sessions (h TEXT PRIMARY KEY, exp INTEGER)',
  ]).catch(e => { ready = null; throw e; });
  return ready;
}
async function exec(sql, args = []) { await init(); return client().execute({ sql, args }); }
const getJSON = async k => { const r = await exec('SELECT v FROM kv WHERE k = ?', [k]); return r.rows[0] ? JSON.parse(r.rows[0].v) : null; };
const setJSON = (k, v) => exec('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', [k, JSON.stringify(v)]);
const subPut = sub => exec('INSERT INTO subs (endpoint, data) VALUES (?, ?) ON CONFLICT(endpoint) DO UPDATE SET data = excluded.data', [sub.endpoint, JSON.stringify(sub)]);
const subsAll = async () => (await exec('SELECT data FROM subs')).rows.map(r => JSON.parse(r.data));
const subDel = endpoint => exec('DELETE FROM subs WHERE endpoint = ?', [endpoint]);
// true only the first time a key is marked (prevents duplicate reminders)
const markFired = async k => (await exec('INSERT OR IGNORE INTO fired (k) VALUES (?)', [k])).rowsAffected > 0;
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
const sha = v => require('crypto').createHash('sha256').update(String(v)).digest('hex');
// Admin = the ADMIN_CODE password, or a session token issued after an email one-time code
async function isAdmin(req) {
  const given = req.headers['x-admin-code'];
  if (!given) return false;
  const code = process.env.ADMIN_CODE || process.env.FAMILY_CODE;
  if (code && given === code) return true;
  const r = await exec('SELECT exp FROM sessions WHERE h = ?', [sha(given)]);
  return !!r.rows[0] && Number(r.rows[0].exp) > Date.now();
}
module.exports = { exec, sha, isAdmin, subPut, subsAll, subDel, markFired, getJSON, setJSON, merge, auth };
