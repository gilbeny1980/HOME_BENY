const { subPut, auth } = require('./_lib');
module.exports = async (req, res) => {
  if (!auth(req, res)) return;
  if (req.method === 'GET') return res.status(200).json({ key: process.env.VAPID_PUBLIC_KEY || '' });
  try {
    const sub = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!sub || !sub.endpoint) return res.status(400).json({ error: 'bad sub' });
    await subPut(sub);
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
