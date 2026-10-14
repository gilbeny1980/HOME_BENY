const { subGet, subUname, canConfirm, snoozeAdd, markFired } = require('./_lib');
// Called by the service worker / alarm screen (no login there): the device's own push endpoint is the credential for snooze.
// action 'ack' = "got it": stops repeat reminders for that occurrence.
module.exports = async (req, res) => {
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    if (b.action === 'done') { // "task done" tapped on a notification: only a parent's / the manager's device counts
      if (!b.eid || !b.at || !b.endpoint) return res.status(400).json({ error: 'missing' });
      const un = await subUname(b.endpoint);
      if (un === undefined) return res.status(404).json({ error: 'device not registered' });
      if (un !== null && !(await canConfirm(un, false))) return res.status(403).json({ error: 'only a parent can confirm' });
      await markFired(`done:${b.eid}:${b.at}`);
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'ack') {
      if (!b.eid || !b.at) return res.status(400).json({ error: 'missing' });
      await markFired(`ack:${b.eid}:${b.at}`);
      return res.status(200).json({ ok: true });
    }
    if (!b.endpoint || !(await subGet(b.endpoint))) return res.status(404).json({ error: 'device not registered' });
    const min = Math.min(Math.max(Number(b.minutes) || 10, 1), 24 * 60);
    await snoozeAdd(b.endpoint, Date.now() + min * 60000, String(b.title || 'תזכורת').slice(0, 200), String(b.body || '').slice(0, 300), b.eid, b.at);
    if (b.eid && b.at) await markFired(`ack:${b.eid}:${b.at}`); // snoozing also stops the repeat series
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
