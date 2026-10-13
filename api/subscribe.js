const { subPut, auth } = require('./_lib');
module.exports = async (req, res) => {
  if (!(await auth(req, res))) return;
  if (req.method === 'GET') return res.status(200).json({ key: String(process.env.VAPID_PUBLIC_KEY || '').replace(/[^A-Za-z0-9_-]/g, '') });
  try {
    const sub = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!sub || !sub.endpoint) return res.status(400).json({ error: 'bad sub' });
    await subPut(sub, req.session && req.session.uname);
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
