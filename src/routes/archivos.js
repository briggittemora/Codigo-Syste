const express = require('express');
const { supabaseDB } = require('../supabaseClient');
const { sanitizeUrl } = require('../utils/security');
const { getGitHubPagesFileUrlForRecord } = require('../utils/githubPages');
const router = express.Router();

router.get('/archivos/:slug/:id', async (req, res) => {
  const { slug, id } = req.params;
  try {
    // Validar que id sea numérico para evitar error UUID
    if (!id || !/^\d+$/.test(String(id))) {
      return res.status(404).send('<h1>Archivo no encontrado</h1>');
    }
    const { data, error } = await supabaseDB.from('html_files').select('*').eq('id', id).limit(1);
    if (!error && data && data.length > 0) {
      const record = data[0];
      const possible = getGitHubPagesFileUrlForRecord({ ...record, id: record.id || id, name: record.name || record.filename || slug });
      const safePossible = sanitizeUrl(possible);
      if (safePossible) return res.redirect(safePossible);
      return res.status(404).send('<h1>Archivo no encontrado</h1>');
    }
  } catch (e) {
    console.warn('DB lookup error:', e.message || e);
  }
  // fallback to GH pages if configured
  const possible = getGitHubPagesFileUrlForRecord({ id, name: slug, filename: `${slug}.html` });
  const safePossible = sanitizeUrl(possible);
  if (safePossible) return res.redirect(safePossible);
  return res.status(404).send('<h1>Archivo no encontrado</h1>');
});

module.exports = router;
