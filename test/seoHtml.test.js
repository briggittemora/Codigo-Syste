const test = require('node:test');
const assert = require('node:assert/strict');
const { updateSeoMetadata } = require('../src/utils/seoHtml');

test('updateSeoMetadata replaces homepage metadata with page-specific values', () => {
  const html = '<html><head><title>Home</title><meta name="description" content="Home description" /><meta property="og:title" content="Home" /><meta property="og:description" content="Home description" /><meta property="og:image" content="/home.png" /><meta property="og:url" content="https://example.com/" /><link rel="canonical" href="https://example.com/" /></head></html>';
  const result = updateSeoMetadata(html, {
    title: 'Mi plantilla | SysteCode',
    description: 'Descripción única',
    image: 'https://example.com/preview.png',
    canonicalUrl: 'https://example.com/archivos/mi-plantilla/12',
  });

  assert.match(result, /<title>Mi plantilla \| SysteCode<\/title>/);
  assert.match(result, /name="description" content="Descripción única"/);
  assert.match(result, /property="og:title" content="Mi plantilla \| SysteCode"/);
  assert.match(result, /property="og:url" content="https:\/\/example\.com\/archivos\/mi-plantilla\/12"/);
  assert.match(result, /rel="canonical" href="https:\/\/example\.com\/archivos\/mi-plantilla\/12"/);
  assert.match(result, /name="twitter:title" content="Mi plantilla \| SysteCode"/);
});

test('updateSeoMetadata escapes dynamic values before inserting them into HTML', () => {
  const result = updateSeoMetadata('<html><head></head></html>', {
    title: 'Amor & <más>',
    description: 'Texto "personalizado"',
    image: 'https://example.com/image.png?x=1&y=2',
    canonicalUrl: 'https://example.com/archivos/a?x=1&y=2',
  });

  assert.match(result, /<title>Amor &amp; &lt;más&gt;<\/title>/);
  assert.match(result, /content="Texto &quot;personalizado&quot;"/);
  assert.match(result, /content="https:\/\/example\.com\/image\.png\?x=1&amp;y=2"/);
});