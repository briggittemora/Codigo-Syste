const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const { getWebhookSecret, normalizeExtraPurchase, verifyWebhookSignature } = require('../src/utils/buymeacoffee');

test('getWebhookSecret separates development and production secrets', () => {
  assert.equal(getWebhookSecret({ NODE_ENV: 'development', BUYMECOFFEE_WEBHOOK_SECRET_DEV: 'dev-secret', BUYMECOFFEE_WEBHOOK_SECRET: 'prod-secret' }), 'dev-secret');
  assert.equal(getWebhookSecret({ NODE_ENV: 'production', BUYMECOFFEE_WEBHOOK_SECRET_DEV: 'dev-secret', BUYMECOFFEE_WEBHOOK_SECRET: 'prod-secret' }), 'prod-secret');
});

test('verifyWebhookSignature checks the raw body HMAC', () => {
  const rawBody = Buffer.from('{"type":"extra_purchase.created"}');
  const secret = 'test-signing-secret';
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  assert.equal(verifyWebhookSignature(rawBody, secret, signature), true);
  assert.equal(verifyWebhookSignature(rawBody, secret, 'invalid'), false);
  assert.equal(verifyWebhookSignature(rawBody, '', signature), false);
});

test('normalizeExtraPurchase extracts file product IDs and refund state', () => {
  const purchase = normalizeExtraPurchase({
    type: 'extra_purchase.created',
    live_mode: true,
    data: {
      id: 789,
      transaction_id: 'pi_123',
      status: 'succeeded',
      supporter_email: 'Buyer@Example.com',
      currency: 'usd',
      extras: [{ id: 42, quantity: 2, amount: 4.5 }, { title: 'missing id' }],
    },
  });

  assert.deepEqual(purchase, {
    transactionId: 'pi_123',
    email: 'buyer@example.com',
    status: 'succeeded',
    refunded: false,
    liveMode: true,
    extras: [{ id: '42', quantity: 2, amount: 4.5, currency: 'USD' }],
  });
  assert.equal(normalizeExtraPurchase({ type: 'donation.created', data: {} }), null);
});