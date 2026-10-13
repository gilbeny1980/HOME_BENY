const webpush = require('web-push');
const { markFired, wasFired, subsAll, subDel, subGet, snoozesDue, snoozeDel, getJSON, getUsers } = require('./_lib');
const REC = require('../rec.js');
// Called every 5 minutes by GitHub Actions. Public on purpose: it only sends reminders that are already due,
// and each reminder is sent once (markFired), so calling it extra times is harmless.
const TZ = 'Asia/Jerusalem';
const dayStr = (ms) => { const d = new Date(new Date(ms).toLocaleString('en-US', { timeZone: TZ })); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
module.exports = async (req, res) => {
  try {
    const clean = v => String(v || '').replace(/[^A-Za-z0-9_-]/g, ''); // tolerate stray spaces/quotes/dots from copy-paste
    webpush.setVapidDetails((process.env.VAPID_SUBJECT || 'mailto:admin@example.com').trim(), clean(process.env.VAPID_PUBLIC_KEY), clean(process.env.VAPID_PRIVATE_KEY));
    const db = (await getJSON('bny:data')) || {};
    const users = await getUsers();
    const parents = users.filter(x => x.p).map(x => x.u);
    // a reminder about a child goes to that child and to the parents; no person = everyone (to: null)
    const recipients = kids => {
      if (!kids.length) return null;
      const set = new Set(parents);
      for (const k of kids) { const u = users.find(x => x.n === k); if (u) set.add(u.u); }
      return [...set];
    };
    const now = Date.now(), msgs = [];
    const toDate = dayStr(now + 2 * 86400000);
    for (const e of (db.events || [])) {
      if (e.del || !(e.remind >= 0) || !e.date) continue;
      const kids = e.kids && e.kids.length ? e.kids : (e.kid ? [e.kid] : []);
      const nag = Number(e.nag) > 0 ? Number(e.nag) : 0;
      for (const date of REC.occDates(e, toDate)) {
        const at = REC.ilToMs(date, e.time), fire = at - e.remind * 60000;
        if (now < fire || now >= at + 3600000) continue;
        const title = 'תזכורת: ' + e.title + (kids.length ? ` (${kids.join(', ')})` : ''), body = `${date} בשעה ${e.time}`, to = recipients(kids);
        const first = await markFired(`${e.id}:${at}`);
        if (first) msgs.push({ title, body, to, eid: e.id, at });
        // repeat every `nag` minutes (up to 3 times) until someone taps "got it" or snoozes
        if (nag && !first && !(await wasFired(`ack:${e.id}:${at}`))) {
          const k = Math.min(3, Math.floor((now - fire) / (nag * 60000)));
          if (k >= 1) {
            for (let j = 1; j < k; j++) await markFired(`${e.id}:${at}:n${j}`);
            if (await markFired(`${e.id}:${at}:n${k}`)) msgs.push({ title: '🔁 ' + title, body, to, eid: e.id, at });
          }
        }
      }
    }
    // daily task digest at 08:00-08:59 Israel time (parents / manager only)
    const il = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
    const day = dayStr(now);
    if (il.getHours() >= 8) {
      const n = (db.tasks || []).filter(t => !t.del && !t.done && t.due && t.due <= day).length;
      if (n && await markFired('digest:' + day)) msgs.push({ title: 'משימות להיום', body: `יש ${n} משימות פתוחות להיום או באיחור`, to: parents });
    }
    const subs = await subsAll();
    let sent = 0;
    for (const m of msgs) for (const { sub, uname } of subs) {
      if (m.to && uname && uname !== 'admin' && !m.to.includes(uname)) continue;
      try { await webpush.sendNotification(sub, JSON.stringify({ title: m.title, body: m.body, eid: m.eid || '', at: m.at || 0 })); sent++; }
      catch (err) { if (err.statusCode === 404 || err.statusCode === 410) await subDel(sub.endpoint); }
    }
    // due snoozes go back only to the device that asked
    for (const s of await snoozesDue(now)) {
      const sub = await subGet(s.endpoint);
      await snoozeDel(s.id);
      if (!sub) continue;
      try { await webpush.sendNotification(sub, JSON.stringify({ title: '⏰ ' + s.title, body: s.body, eid: s.eid, at: Number(s.at) })); sent++; }
      catch (err) { if (err.statusCode === 404 || err.statusCode === 410) await subDel(s.endpoint); }
    }
    res.status(200).json({ messages: msgs.length, sent });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
