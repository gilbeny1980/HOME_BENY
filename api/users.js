const { auth, isAdmin, getUsers, setPassword, setJSON } = require('./_lib');
// GET: any logged-in family member (names + colors). POST: manager only (add/rename/recolor/remove users, change the shared password).
module.exports = async (req, res) => {
  try {
    if (!(await auth(req, res))) return;
    let users = await getUsers();
    if (req.method === 'POST') {
      if (!(await isAdmin(req))) return res.status(401).json({ error: 'admin only' });
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      if (b.action === 'password') {
        if (String(b.password || '').length < 6) return res.status(400).json({ error: 'password too short' });
        await setPassword(b.password);
      } else if (b.action === 'save') {
        const u = String(b.u || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        const n = String(b.n || '').trim();
        if (!u || !n) return res.status(400).json({ error: 'missing fields' });
        const old = users.find(x => x.u === u) || {};
        const c = /^#[0-9a-fA-F]{6}$/.test(b.c || '') ? b.c : old.c;
        const rec = { u, n }; if (b.p) rec.p = true; if (c) rec.c = c;
        users = users.filter(x => x.u !== u).concat([rec]);
        await setJSON('bny:users', users);
      } else if (b.action === 'remove') {
        users = users.filter(x => x.u !== b.u);
        await setJSON('bny:users', users);
      } else return res.status(400).json({ error: 'bad action' });
    }
    res.status(200).json({ users });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
