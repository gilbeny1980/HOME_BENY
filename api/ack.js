const { markFired } = require('./_lib');
// "Got it": stops repeat reminders for that occurrence (everyone).
module.exports = async (req, res) => {
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    if (!b.eid || !b.at) return res.status(400).json({ error: 'missing' });
    await markFired(`ack:${b.eid}:${b.at}`);
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
