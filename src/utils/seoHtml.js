const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const upsertTag = (html, pattern, tag) => (
  pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `${tag}\n</head>`)
);

const updateMeta = (html, attribute, key, content) => {
  const escapedKey = escapeHtml(key);
  const pattern = new RegExp(`<meta\\s+${attribute}=["']${escapeRegExp(key)}["'][^>]*>`, 'i');
  const tag = `<meta ${attribute}="${escapedKey}" content="${escapeHtml(content)}" />`;
  return upsertTag(html, pattern, tag);
};

function updateSeoMetadata(html, { title, description, image, canonicalUrl }) {
  let updated = upsertTag(html, /<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  updated = updateMeta(updated, 'name', 'description', description);
  updated = updateMeta(updated, 'property', 'og:title', title);
  updated = updateMeta(updated, 'property', 'og:description', description);
  updated = updateMeta(updated, 'property', 'og:image', image);
  updated = updateMeta(updated, 'property', 'og:url', canonicalUrl);
  updated = updateMeta(updated, 'name', 'twitter:title', title);
  updated = updateMeta(updated, 'name', 'twitter:description', description);
  updated = updateMeta(updated, 'name', 'twitter:image', image);
  updated = upsertTag(
    updated,
    /<link\s+rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
  );
  return updated;
}

module.exports = { updateSeoMetadata };