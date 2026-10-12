const { getJSON, setJSON, merge, auth, isAdmin } = require('./_lib');
module.exports = async (req, res) => {
  if (!(await auth(req, res))) return;
  try {
    const admin = await isAdmin(req);
    const cur = (await getJSON('bny:data')) || {};
    let out = merge(cur, {});
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      if (!admin) delete body.tasks; // משימות נכתבות רק ממצב ניהול
      out = merge(cur, body);
      await setJSON('bny:data', out);
    }
    if (!admin) delete out.tasks; // משימות נקראות רק ממצב ניהול
    res.status(200).json(out);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
