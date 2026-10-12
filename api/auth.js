const { auth, isAdmin } = require('./_lib');
module.exports = async (req, res) => {
  if (!auth(req, res)) return;
  try {
    if (!(await isAdmin(req))) return res.status(401).json({ error: 'bad admin code' });
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
