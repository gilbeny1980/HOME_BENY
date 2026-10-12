const webpush = require('web-push');
const { auth, subGet } = require('./_lib');
// Sends a test notification to the calling device's own registered subscription.
module.exports = async (req, res) => {
  if (!(await auth(req, res))) return;
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const sub = await subGet(b.endpoint);
    if (!sub) return res.status(404).json({ error: 'device not registered on server' });
    const clean = v => String(v || '').replace(/[^A-Za-z0-9_-]/g, '');
    webpush.setVapidDetails((process.env.VAPID_SUBJECT || 'mailto:admin@example.com').trim(), clean(process.env.VAPID_PUBLIC_KEY), clean(process.env.VAPID_PRIVATE_KEY));
    await webpush.sendNotification(sub, JSON.stringify({ title: 'בדיקת התראה ✔', body: 'ההתראות עובדות במכשיר הזה' }));
    res.status(200).json({ ok: true });
  } catch (e) { res.status(502).json({ error: String(e.body || e.message || e), status: e.statusCode || null }); }
};
