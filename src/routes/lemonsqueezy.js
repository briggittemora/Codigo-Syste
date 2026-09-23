const crypto = require('crypto');
const express = require('express');
const { supabaseDB } = require('../supabaseClient');
const { getUserRowByEmail } = require('../utils/supabaseAuth');

const router = express.Router();
const VIP_VARIANT_ID = String(process.env.LEMONSQUEEZY_VIP_VARIANT_ID || '2161088');

const signaturesMatch = (rawBody, signature, secret) => {
  if (!rawBody || !signature || !secret) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const actualBuffer = Buffer.from(String(signature), 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

router.post('/lemonsqueezy/webhook', async (req, res) => {
  const secret = String(process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '').trim();
  const signature = req.get('X-Signature');

  if (!signaturesMatch(req.rawBody, signature, secret)) {
    return res.status(401).json({ error: 'Firma de webhook inválida' });
  }

  const eventName = String(req.get('X-Event-Name') || '').trim();
  const data = req.body?.data || {};
  const attributes = data.attributes || {};
  const orderId = String(attributes.identifier || data.id || '').trim();
  const email = String(attributes.user_email || '').trim().toLowerCase();
  const variantId = String(attributes.variant_id || '').trim();
  const status = String(attributes.status || '').trim().toLowerCase();

  if (!orderId) return res.status(400).json({ error: 'Webhook sin identificador de orden' });

  if (eventName !== 'order_created' && eventName !== 'order_refunded') {
    return res.json({ received: true, ignored: true });
  }

  const { error: insertError } = await supabaseDB.from('lemonsqueezy_orders').insert([{
    order_id: orderId,
    event_name: eventName || null,
    email: email || null,
    variant_id: variantId || null,
    status: status || null,
    raw: req.body,
  }]);

  if (insertError) {
    if (String(insertError.code) === '23505') {
      return res.json({ received: true, duplicate: true });
    }
    console.error('Lemon Squeezy order insert error:', insertError.message || insertError);
    return res.status(500).json({ error: 'No se pudo registrar la orden' });
  }

  if (eventName === 'order_refunded') {
    return res.json({ received: true, refunded: true });
  }

  if (variantId !== VIP_VARIANT_ID || status !== 'paid' || !email) {
    return res.json({ received: true, activated: false });
  }

  const { row: dbUser, error: userError } = await getUserRowByEmail(email);
  if (userError) {
    console.error('Lemon Squeezy user lookup error:', userError.message || userError);
    return res.status(500).json({ error: 'No se pudo buscar el usuario' });
  }
  if (!dbUser) return res.json({ received: true, activated: false, reason: 'user_not_found' });

  const { error: updateError } = await supabaseDB
    .from('users')
    .update({ modalidad: 'vip' })
    .eq('email', email);

  if (updateError) {
    console.error('Lemon Squeezy VIP update error:', updateError.message || updateError);
    return res.status(500).json({ error: 'No se pudo activar la membresía' });
  }

  return res.json({ received: true, activated: true });
});

module.exports = router;