const { getJSON, setJSON, merge, auth } = require('./_lib');
module.exports = async (req, res) => {
  if (!auth(req, res)) return;
  try {
    const cur = (await getJSON('bny:data')) || {};
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const merged = merge(cur, body);
      await setJSON('bny:data', merged);
      return res.status(200).json(merged);
    }
    res.status(200).json(merge(cur, {}));
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
