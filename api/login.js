const { exec, getUsers, checkPassword, newSession } = require('./_lib');
// Family login: username (e.g. gil / adva / linoy / romi / aline) + shared password
module.exports = async (req, res) => {
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const now = Date.now();
    await exec('DELETE FROM login_log WHERE ts < ?', [now - 15 * 60000]);
    if (Number((await exec('SELECT COUNT(*) AS n FROM login_log')).rows[0].n) >= 15) return res.status(429).json({ error: 'too many attempts' });
    const uname = String(b.username || '').trim().toLowerCase();
    const user = (await getUsers()).find(x => x.u === uname);
    if (!user || !(await checkPassword(b.password || ''))) {
      await exec('INSERT INTO login_log (ts) VALUES (?)', [now]);
      return res.status(401).json({ error: 'bad login' });
    }
    res.status(200).json({ token: await newSession('user', user.u, 365), name: user.n, username: user.u });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
