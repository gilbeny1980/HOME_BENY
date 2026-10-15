const webpush = require('web-push');
const { subPut, subGet, auth, ntfyTopic, ntfyPublish, tg, tgConfigured, tgChats, tgBotName, tgNewCode, tgPoll } = require('./_lib');
module.exports = async (req, res) => {
  if (!(await auth(req, res))) return;
  if (req.method === 'GET' && req.query && req.query.tg) { // Telegram: is it set up, am I linked, my personal /start link
    try {
      if (!tgConfigured()) return res.status(200).json({ configured: false });
      await tgPoll().catch(() => {}); // pick up a fresh /start right away
      const linked = !!(await tgChats())[req.session.uname];
      const bot = await tgBotName();
      return res.status(200).json({ configured: true, linked, link: linked ? null : `https://t.me/${bot}?start=${await tgNewCode(req.session.uname)}`, bot });
    } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
  }
  if (req.method === 'GET' && req.query && req.query.ntfy) { // my private ntfy topic (created on first request)
    try { return res.status(200).json({ topic: await ntfyTopic(req.session.uname, true), server: 'ntfy.sh' }); }
    catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
  }
  if (req.method === 'GET') return res.status(200).json({ key: String(process.env.VAPID_PUBLIC_KEY || '').replace(/[^A-Za-z0-9_-]/g, '') });
  try {
    const sub = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (sub && sub.tgTest) {
      const chat = (await tgChats())[req.session.uname];
      if (!chat) return res.status(404).json({ error: 'not linked' });
      try { await tg('sendMessage', { chat_id: chat, text: '🔔 בדיקת התראה – אם ראית את זה על המסך, הטלגרם מוגדר נכון ✔' }); return res.status(200).json({ ok: true }); }
      catch (e) { return res.status(502).json({ error: String(e.message || e) }); }
    }
    if (sub && sub.ntfyTest) { // test urgent notification to my ntfy topic
      const topic = await ntfyTopic(req.session.uname, false);
      if (!topic) return res.status(404).json({ error: 'no topic yet' });
      try { await ntfyPublish({ topic, title: 'בדיקת התראה דחופה ✔', message: 'אם ראית את זה על המסך – ntfy מוגדר נכון', click: `https://${req.headers['x-forwarded-host'] || req.headers.host}/` }); return res.status(200).json({ ok: true }); }
      catch (e) { return res.status(502).json({ error: String(e.message || e) }); }
    }
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
