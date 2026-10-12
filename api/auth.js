const { auth, isAdmin } = require('./_lib');
module.exports = (req, res) => {
  if (!auth(req, res)) return;
  if (!isAdmin(req)) return res.status(401).json({ error: 'bad admin code' });
  res.status(200).json({ ok: true });
};
