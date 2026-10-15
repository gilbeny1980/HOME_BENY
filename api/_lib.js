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
const subUname = async endpoint => { const r = await exec('SELECT uname FROM subs WHERE endpoint = ?', [endpoint]); return r.rows[0] ? (r.rows[0].uname || null) : undefined; };
// who may confirm "done": the parents (flag p) and the manager
async function canConfirm(uname, admin) {
  if (admin || uname === 'admin') return true;
  return !!(await getUsers()).find(x => x.u === uname && x.p);
}
// ---- ntfy (urgent push app): each person who opts in gets a secret topic ----
const ntfyTopics = async () => (await getJSON('bny:ntfy')) || {};
async function ntfyTopic(uname, create) {
  const m = await ntfyTopics();
  if (!m[uname] && create) { m[uname] = 'bny-' + crypto.randomBytes(10).toString('hex'); await setJSON('bny:ntfy', m); }
  return m[uname] || null;
}
async function ntfyUserByTopic(t) { const m = await ntfyTopics(); return Object.keys(m).find(u => m[u] === t) || null; }
async function ntfyPublish(msg) {
  const r = await fetch('https://ntfy.sh/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority: 5, tags: ['bell'], ...msg }) });
  if (!r.ok) throw new Error('ntfy ' + r.status);
}
// ---- Telegram bot (heads-up message notifications on the phone): people link their chat via a /start code ----
const TGAPI = m => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${m}`;
async function tg(method, body) {
  const r = await fetch(TGAPI(method), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || ('telegram ' + r.status));
  return j.result;
}
const tgConfigured = () => !!process.env.TELEGRAM_BOT_TOKEN;
const tgChats = async () => (await getJSON('bny:tg')) || {};
async function tgBotName() { const c = await getJSON('bny:tgbot'); if (c) return c; const me = await tg('getMe'); await setJSON('bny:tgbot', me.username); return me.username; }
async function tgNewCode(uname) {
  const codes = (await getJSON('bny:tgcodes')) || {}, now = Date.now();
  for (const k of Object.keys(codes)) if (now - codes[k].t > 3600000) delete codes[k];
  const code = crypto.randomBytes(6).toString('hex'); codes[code] = { u: uname, t: now };
  await setJSON('bny:tgcodes', codes); return code;
}
// reads new messages sent to the bot: "/start <code>" links a person; button presses confirm / snooze
async function tgPoll() {
  if (!tgConfigured()) return;
  const off = Number(await getJSON('bny:tgoffset')) || 0;
  const ups = await tg('getUpdates', { offset: off, timeout: 0, allowed_updates: ['message', 'callback_query'] });
  if (!ups.length) return;
  await setJSON('bny:tgoffset', ups[ups.length - 1].update_id + 1);
  for (const u of ups) {
    try {
      if (u.message && u.message.text && u.message.text.startsWith('/start')) {
        const code = u.message.text.split(' ')[1], codes = (await getJSON('bny:tgcodes')) || {}, chat = u.message.chat.id;
        if (code && codes[code]) {
          const chats = await tgChats(); chats[codes[code].u] = chat; await setJSON('bny:tg', chats); delete codes[code]; await setJSON('bny:tgcodes', codes);
          const un = (await getUsers()).find(x => x.u === Object.keys(chats).find(k => chats[k] === chat));
          await tg('sendMessage', { chat_id: chat, text: `✅ מחובר${un ? ' – שלום ' + un.n : ''}! מעכשיו התזכורות של משפחת בן יהודה יגיעו לכאן.` });
        } else await tg('sendMessage', { chat_id: chat, text: 'כדי להתחבר פתחו את אפליקציית בן יהודה ← הכפתור עם השם ← "התראות בטלגרם".' });
      } else if (u.callback_query) {
        const cq = u.callback_query, [k, eid, at] = String(cq.data || '').split(':'), chats = await tgChats();
        const uname = Object.keys(chats).find(x => chats[x] === cq.from.id);
        if (!uname) { await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'לא מחובר' }); continue; }
        let text = 'נרשם ✔';
        if (k === 'k') await markFired(`ack:${eid}:${at}`);
        else if (!(await canConfirm(uname, false))) text = 'רק גיל או אדוה יכולים לאשר';
        else if (k === 'd') { await markFired(`done:${eid}:${at}`); text = 'אושר ✔ – ההתראות נפסקו'; }
        else if (k === 'p') { await setJSON(`bny:pause:${eid}:${at}`, Date.now() + 10 * 60000); text = 'נודניק 10 דקות ⏰'; }
        await tg('answerCallbackQuery', { callback_query_id: cq.id, text });
        if (cq.message && text !== 'רק גיל או אדוה יכולים לאשר') await tg('editMessageReplyMarkup', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
      }
    } catch (e) { /* ignore a single bad update */ }
  }
}
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
const DEFAULT_USERS = [{ u: 'gil', n: 'גיל', p: true, c: '#e8912d' }, { u: 'adva', n: 'אדוה', p: true, c: '#3b82c4' }, { u: 'linoy', n: 'לינוי', c: '#e0527a' }, { u: 'romi', n: 'רומי', c: '#8e5bd6' }, { u: 'aline', n: 'אלין', c: '#2f9e8f' }];
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

module.exports = { tg, tgConfigured, tgChats, tgBotName, tgNewCode, tgPoll, ntfyTopics, ntfyTopic, ntfyUserByTopic, ntfyPublish, subUname, canConfirm, snoozeAdd, snoozesDue, snoozeDel, wasFired, subGet, subCount, exec, sha, isAdmin, newSession, getSession, getUsers, checkPassword, setPassword, subPut, subsAll, subDel, markFired, getJSON, setJSON, merge, auth };
