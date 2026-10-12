const webpush = require('web-push');
const { redis, getJSON } = require('./_lib');
// Called every 5 minutes (GitHub Actions) with Authorization: Bearer CRON_SECRET
module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorized' });
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const db = (await getJSON('bny:data')) || {};
    const now = Date.now(), msgs = [];
    for (const e of (db.events || [])) {
      if (e.del || !(e.remind >= 0) || !e.at) continue;
      const fire = e.at - e.remind * 60000;
      if (now >= fire && now < e.at + 3600000) {
        if (await redis('SADD', 'bny:fired', `${e.id}:${e.at}`)) msgs.push({ title: 'תזכורת: ' + e.title, body: `${e.date} בשעה ${e.time}` });
      }
    }
    // daily task digest at 08:00-08:59 Israel time
    const il = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const day = `${il.getFullYear()}-${String(il.getMonth() + 1).padStart(2, '0')}-${String(il.getDate()).padStart(2, '0')}`;
    if (il.getHours() >= 8) {
      const n = (db.tasks || []).filter(t => !t.del && !t.done && t.due && t.due <= day).length;
      if (n && await redis('SADD', 'bny:fired', 'digest:' + day)) msgs.push({ title: 'משימות להיום', body: `יש ${n} משימות פתוחות להיום או באיחור` });
    }
    const subs = Object.values(arrToObj((await redis('HGETALL', 'bny:subs')) || []));
    let sent = 0;
    for (const m of msgs) for (const s of subs) {
      try { await webpush.sendNotification(JSON.parse(s), JSON.stringify(m)); sent++; }
      catch (err) { if (err.statusCode === 404 || err.statusCode === 410) await redis('HDEL', 'bny:subs', JSON.parse(s).endpoint); }
    }
    res.status(200).json({ messages: msgs.length, sent });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
function arrToObj(a) { const o = {}; for (let i = 0; i < a.length; i += 2) o[a[i]] = a[i + 1]; return o; }
