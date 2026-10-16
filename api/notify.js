const webpush = require('web-push');
const { isAdmin, auth, getJSON, setJSON, getUsers, subsAll, subDel } = require('./_lib');
const REC = require('../rec.js');
// Manager only: send an event's reminder right now to everyone who should get it (the people it is for + the parents).
module.exports = async (req, res) => {
  try {
    if (!(await auth(req, res))) return;
    if (!(await isAdmin(req))) return res.status(401).json({ error: 'admin only' });
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const db = (await getJSON('bny:data')) || {};
    const e = (db.events || []).find(x => x.id === b.eid && !x.del);
    if (!e) return res.status(404).json({ error: 'event not found' });
    const users = await getUsers();
    const parents = users.filter(x => x.p).map(x => x.u);
    const kids = e.kids && e.kids.length ? e.kids : (e.kid ? [e.kid] : []);
    let to = null;
    if (kids.length) { const set = new Set(parents); for (const k of kids) { const u = users.find(x => x.n === k); if (u) set.add(u.u); } to = [...set]; }
    // the occurrence date: today's if it recurs today, else the next one
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const ds = REC.occDates(e, new Date(Date.now() + 800 * 864e5).toISOString().slice(0, 10));
    const date = (e.rep ? (ds.find(d => d >= t) || ds[ds.length - 1]) : e.date) || e.date;
    const clean = v => String(v || '').replace(/[^A-Za-z0-9_-]/g, '');
    webpush.setVapidDetails((process.env.VAPID_SUBJECT || 'mailto:admin@example.com').trim(), clean(process.env.VAPID_PUBLIC_KEY), clean(process.env.VAPID_PRIVATE_KEY));
    const payload = JSON.stringify({ title: 'תזכורת: ' + e.title + (kids.length ? ` (${kids.join(', ')})` : ''), body: `${date} בשעה ${REC.timeOn(e, date)}`, eid: e.id, at: REC.ilToMs(date, REC.timeOn(e, date)) });
    let sent = 0; const fails = [];
    for (const { sub, uname } of await subsAll()) {
      if (to && uname && uname !== 'admin' && !to.includes(uname)) continue;
      try { await webpush.sendNotification(sub, payload); sent++; }
      catch (err) { fails.push(err.statusCode || String(err.message || err).slice(0, 40)); if (err.statusCode === 404 || err.statusCode === 410) await subDel(sub.endpoint); }
    }
    const sl = ((await getJSON('bny:sendlog')) || []).slice(-9);
    sl.push({ t: Date.now(), msgs: [(to ? to.join('+') : 'all') + ' (manual)'], sent, fails });
    await setJSON('bny:sendlog', sl);
    res.status(200).json({ sent, failed: fails.length, to: to || 'all' });
  } catch (err) { res.status(500).json({ error: String(err.message || err) }); }
};
