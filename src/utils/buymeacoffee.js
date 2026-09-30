const crypto = require('crypto');

const getWebhookSecret = (env = process.env) => {
  const isProduction = String(env.NODE_ENV || '').trim().toLowerCase() === 'production';
  const secret = isProduction
    ? env.BUYMECOFFEE_WEBHOOK_SECRET
    : (env.BUYMECOFFEE_WEBHOOK_SECRET_DEV || env.BUYMECOFFEE_WEBHOOK_SECRET);
  return String(secret || '').trim();
};

const verifyWebhookSignature = (rawBody, secret, signature) => {
  if (!rawBody || !secret || !signature) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(String(signature), 'hex');

  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

const normalizeExtraPurchase = (event) => {
  const data = event?.data || {};
  const type = String(event?.type || '').trim();
  if (!['extra_purchase.created', 'extra_purchase.updated', 'extra_purchase.refunded'].includes(type)) return null;

  const transactionId = String(data.transaction_id || data.id || '').trim();
  if (!transactionId) return null;

  const refunded = type === 'extra_purchase.refunded'
    || String(data.refunded || '').toLowerCase() === 'true'
    || String(data.status || '').toLowerCase() === 'refunded';
  const status = refunded ? 'refunded' : String(data.status || '').trim().toLowerCase();

  return {
    transactionId,
    email: String(data.supporter_email || '').trim().toLowerCase() || null,
    status,
    refunded,
    liveMode: event?.live_mode === true,
    extras: Array.isArray(data.extras)
      ? data.extras
        .filter((extra) => extra?.id !== null && typeof extra?.id !== 'undefined')
        .map((extra) => ({
          id: String(extra.id),
          quantity: Number(extra.quantity) || 1,
          amount: extra.amount !== null && typeof extra.amount !== 'undefined' && Number.isFinite(Number(extra.amount))
            ? Number(extra.amount)
            : null,
          currency: String(extra.currency || data.currency || '').trim().toUpperCase() || null,
        }))
      : [],
  };
};

module.exports = { getWebhookSecret, normalizeExtraPurchase, verifyWebhookSignature };