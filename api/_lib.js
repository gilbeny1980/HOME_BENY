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
    'CREATE TABLE IF NOT EXISTS sess (h TEXT PRIMARY KEY, exp INTEGER, role TEXT, uname TEXT)',
    'CREATE TABLE IF NOT EXISTS login_log (ts INTEGER)',
    'CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, data TEXT)',
    'CREATE TABLE IF NOT EXISTS snoozes (id INTEGER PRIMARY KEY AUTOINCREMENT, endpoint TEXT, t INTEGER, title TEXT, body TEXT, eid TEXT, at INTEGER)',
  ]).then(() => client().execute('ALTER TABLE subs ADD COLUMN uname TEXT').catch(() => {})).catch(e => { ready = null; throw e; });
  return ready;
}
async function exec(sql, args = []) { await init(); return client().execute({ sql, args }); }
const getJSON = async k => { const r = await exec('SELECT v FROM kv WHERE k = ?', [k]); return r.rows[0] ? JSON.parse(r.rows[0].v) : null; };
const setJSON = (k, v) => exec('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', [k, JSON.stringify(v)]);
const subPut = (sub, uname) => exec('INSERT INTO subs (endpoint, data, uname) VALUES (?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET data = excluded.data, uname = excluded.uname', [sub.endpoint, JSON.stringify(sub), uname || null]);
const subsAll = async () => (await exec('SELECT data, uname FROM subs')).rows.map(r => ({ sub: JSON.parse(r.data), uname: r.uname || null }));
const subGet = async endpoint => { const r = await exec('SELECT data FROM subs WHERE endpoint = ?', [endpoint]); return r.rows[0] ? JSON.parse(r.rows[0].data) : null; };
const subCount = async () => Number((await exec('SELECT COUNT(*) AS n FROM subs')).rows[0].n);
const snoozeAdd = (endpoint, t, title, body, eid, at) => exec('INSERT INTO snoozes (endpoint, t, title, body, eid, at) VALUES (?, ?, ?, ?, ?, ?)', [endpoint, t, title, body, eid || '', at || 0]);
const snoozesDue = async now => (await exec('SELECT id, endpoint, title, body, eid, at FROM snoozes WHERE t <= ?', [now])).rows;
const snoozeDel = id => exec('DELETE FROM snoozes WHERE id = ?', [id]);
const wasFired = async k => (await exec('SELECT 1 AS x FROM fired WHERE k = ?', [k])).rows.length > 0;
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
const crypto = require('crypto');
const sha = v => crypto.createHash('sha256').update(String(v)).digest('hex');

// ---- sessions: role 'user' (family login) or 'admin' (email one-time code) ----
async function newSession(role, uname, days) {
  const token = crypto.randomBytes(32).toString('hex');
  await exec('DELETE FROM sess WHERE exp < ?', [Date.now()]);
  await exec('INSERT INTO sess (h, exp, role, uname) VALUES (?, ?, ?, ?)', [sha(token), Date.now() + days * 86400000, role, uname]);
  return token;
}
async function getSession(token) {
  if (!token) return null;
  const r = await exec('SELECT exp, role, uname FROM sess WHERE h = ?', [sha(token)]);
  const row = r.rows[0];
  return row && Number(row.exp) > Date.now() ? { role: row.role, uname: row.uname } : null;
}
// any logged-in session (user or admin)
async function auth(req, res) {
  const s = await getSession(req.headers['x-token']);
  if (!s) { res.status(401).json({ error: 'login required' }); return false; }
  req.session = s;
  return true;
}
async function isAdmin(req) {
  const s = await getSession(req.headers['x-admin-code']);
  return !!s && s.role === 'admin';
}

// ---- users & shared family password ----
const DEFAULT_USERS = [{ u: 'gil', n: 'גיל', p: true }, { u: 'adva', n: 'אדוה', p: true }, { u: 'linoy', n: 'לינוי' }, { u: 'romi', n: 'רומי' }, { u: 'aline', n: 'אלין' }];
async function getUsers() { return (await getJSON('bny:users')) || DEFAULT_USERS; }
const hashPw = (pw, salt) => crypto.scryptSync(String(pw), salt, 32).toString('hex');
async function checkPassword(pw) {
  const rec = await getJSON('bny:pw');
  if (rec) return crypto.timingSafeEqual(Buffer.from(hashPw(pw, rec.salt)), Buffer.from(rec.h));
  const init = process.env.FAMILY_CODE; // initial password until the manager changes it in the app
  return !!init && String(pw) === init;
}
async function setPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  await setJSON('bny:pw', { salt, h: hashPw(pw, salt) });
  await exec("DELETE FROM sess WHERE role = 'user'"); // everyone must log in again with the new password
}

module.exports = { snoozeAdd, snoozesDue, snoozeDel, wasFired, subGet, subCount, exec, sha, isAdmin, newSession, getSession, getUsers, checkPassword, setPassword, subPut, subsAll, subDel, markFired, getJSON, setJSON, merge, auth };
