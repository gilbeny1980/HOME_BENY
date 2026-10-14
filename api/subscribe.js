const webpush = require('web-push');
const { subPut, subGet, auth } = require('./_lib');
module.exports = async (req, res) => {
  if (!(await auth(req, res))) return;
  if (req.method === 'GET') return res.status(200).json({ key: String(process.env.VAPID_PUBLIC_KEY || '').replace(/[^A-Za-z0-9_-]/g, '') });
  try {
    const sub = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (sub && sub.test) { // test notification to the caller's own registered device
      const dev = await subGet(sub.endpoint);
      if (!dev) return res.status(404).json({ error: 'device not registered on server' });
      const clean = v => String(v || '').replace(/[^A-Za-z0-9_-]/g, '');
      webpush.setVapidDetails((process.env.VAPID_SUBJECT || 'mailto:admin@example.com').trim(), clean(process.env.VAPID_PUBLIC_KEY), clean(process.env.VAPID_PRIVATE_KEY));
      try { await webpush.sendNotification(dev, JSON.stringify({ title: 'בדיקת התראה ✔', body: 'ההתראות עובדות במכשיר הזה' })); return res.status(200).json({ ok: true }); }
      catch (e) { return res.status(502).json({ error: String(e.body || e.message || e), status: e.statusCode || null }); }
    }
    if (!sub || !sub.endpoint) return res.status(400).json({ error: 'bad sub' });
    await subPut(sub, req.session && req.session.uname);
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
