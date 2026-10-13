const { subGet, snoozeAdd } = require('./_lib');
// Called by the service worker (no login there): the device's own push endpoint acts as the credential.
module.exports = async (req, res) => {
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    if (!b.endpoint || !(await subGet(b.endpoint))) return res.status(404).json({ error: 'device not registered' });
    const min = Math.min(Math.max(Number(b.minutes) || 10, 1), 24 * 60);
    await snoozeAdd(b.endpoint, Date.now() + min * 60000, String(b.title || 'תזכורת').slice(0, 200), String(b.body || '').slice(0, 300), b.eid, b.at);
    if (b.eid && b.at) await require('./_lib').markFired(`ack:${b.eid}:${b.at}`); // snoozing also stops the repeat series
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
