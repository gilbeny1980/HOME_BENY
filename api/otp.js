const crypto = require('crypto');
const { auth, exec, sha } = require('./_lib');
// Forgot admin password: email a 6-digit one-time code to ADMIN_EMAIL, then exchange it for a session token.
module.exports = async (req, res) => {
  if (!auth(req, res)) return;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const now = Date.now();
    if (body.action === 'request') {
      const to = process.env.ADMIN_EMAIL, key = process.env.RESEND_API_KEY;
      if (!to || !key) return res.status(500).json({ error: 'email not configured' });
      await exec('DELETE FROM otp_log WHERE ts < ?', [now - 15 * 60000]);
      const n = Number((await exec('SELECT COUNT(*) AS n FROM otp_log')).rows[0].n);
      if (n >= 3) return res.status(429).json({ error: 'too many requests' });
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      await exec('INSERT INTO otp_log (ts) VALUES (?)', [now]);
      await exec('INSERT INTO otp (id, h, exp, tries) VALUES (1, ?, ?, 0) ON CONFLICT(id) DO UPDATE SET h = excluded.h, exp = excluded.exp, tries = 0', [sha(code), now + 10 * 60000]);
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.MAIL_FROM || 'Ben Yehuda <onboarding@resend.dev>', to: [to],
          subject: 'קוד כניסה לניהול – משפחת בן יהודה',
          html: `<div dir="rtl" style="font-family:Arial;font-size:16px">קוד הכניסה שלך לניהול:<br><b style="font-size:32px;letter-spacing:6px">${code}</b><br>הקוד תקף 10 דקות ופעם אחת בלבד.</div>`,
        }),
      });
      if (!r.ok) return res.status(502).json({ error: 'email failed' });
      return res.status(200).json({ ok: true });
    }
    if (body.action === 'verify') {
      const row = (await exec('SELECT h, exp, tries FROM otp WHERE id = 1')).rows[0];
      if (!row || Number(row.exp) < now || Number(row.tries) >= 5) return res.status(401).json({ error: 'expired' });
      if (sha(String(body.code || '').trim()) !== row.h) {
        await exec('UPDATE otp SET tries = tries + 1 WHERE id = 1');
        return res.status(401).json({ error: 'wrong code' });
      }
      await exec('DELETE FROM otp WHERE id = 1');
      const token = crypto.randomBytes(32).toString('hex');
      await exec('DELETE FROM sessions WHERE exp < ?', [now]);
      await exec('INSERT INTO sessions (h, exp) VALUES (?, ?)', [sha(token), now + 90 * 86400000]);
      return res.status(200).json({ token });
    }
    res.status(400).json({ error: 'bad action' });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
