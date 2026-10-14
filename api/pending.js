const { auth, isAdmin, getJSON, canConfirm, markFired, wasFired } = require('./_lib');
const REC = require('../rec.js');
// Tasks that need a parent's "done" confirmation. GET: the open list. POST {eid, at}: confirm one (parents / manager only).
module.exports = async (req, res) => {
  try {
    if (!(await auth(req, res))) return;
    const ok = await canConfirm(req.session.uname, await isAdmin(req));
    if (req.method === 'POST') {
      if (!ok) return res.status(403).json({ error: 'only a parent can confirm' });
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      if (!b.eid || !b.at) return res.status(400).json({ error: 'missing' });
      await markFired(`done:${b.eid}:${b.at}`);
      return res.status(200).json({ ok: true });
    }
    if (!ok) return res.status(200).json({ can: false, pending: [] });
    const db = (await getJSON('bny:data')) || {};
    const now = Date.now(), pending = [];
    const day = ms => new Date(ms).toISOString().slice(0, 10);
    for (const e of (db.events || [])) {
      if (e.del || !e.req || !e.date) continue;
      for (const date of REC.occDates(e, day(now + 2 * 864e5))) {
        if (date < day(now - 7 * 864e5)) continue;
        const at = REC.ilToMs(date, e.time), fire = at - Math.max(Number(e.remind) || 0, 0) * 60000;
        if (now >= fire && !(await wasFired(`done:${e.id}:${at}`))) pending.push({ eid: e.id, at, title: e.title, date, time: e.time, kids: e.kids || [] });
      }
    }
    pending.sort((a, b) => a.at - b.at);
    res.status(200).json({ can: true, pending });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
