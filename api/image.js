const crypto = require('crypto');
const { auth, exec } = require('./_lib');
// Event pictures (already resized/compressed in the browser). Kept out of the main synced document.
const OK = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
module.exports = async (req, res) => {
  if (!(await auth(req, res))) return;
  try {
    const id = String((req.query && req.query.id) || '');
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      if (!OK.test(b.data || '') || b.data.length > 900000) return res.status(400).json({ error: 'bad image' });
      const nid = crypto.randomBytes(8).toString('hex');
      await exec('INSERT INTO images (id, data) VALUES (?, ?)', [nid, b.data]);
      return res.status(200).json({ id: nid });
    }
    if (!/^[0-9a-f]{16}$/.test(id)) return res.status(400).json({ error: 'bad id' });
    if (req.method === 'DELETE') { await exec('DELETE FROM images WHERE id = ?', [id]); return res.status(200).json({ ok: true }); }
    const r = await exec('SELECT data FROM images WHERE id = ?', [id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'not found' });
    res.setHeader && res.setHeader('Cache-Control', 'private, max-age=86400');
    res.status(200).json({ data: r.rows[0].data });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
