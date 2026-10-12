const { isAdmin, getUsers, setPassword } = require('./_lib');
const { setJSON } = require('./_lib');
// Manager only: list/add/rename/remove users, change the shared login password
module.exports = async (req, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(401).json({ error: 'admin only' });
    let users = await getUsers();
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      if (b.action === 'password') {
        if (String(b.password || '').length < 6) return res.status(400).json({ error: 'password too short' });
        await setPassword(b.password);
      } else if (b.action === 'save') {
        const u = String(b.u || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        const n = String(b.n || '').trim();
        if (!u || !n) return res.status(400).json({ error: 'missing fields' });
        users = users.filter(x => x.u !== u).concat([{ u, n }]);
        await setJSON('bny:users', users);
      } else if (b.action === 'remove') {
        users = users.filter(x => x.u !== b.u);
        await setJSON('bny:users', users);
      } else return res.status(400).json({ error: 'bad action' });
    }
    res.status(200).json({ users });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
