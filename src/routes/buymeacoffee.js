const express = require('express');
const { supabaseDB } = require('../supabaseClient');
const { getUserRowByEmail } = require('../utils/supabaseAuth');
const { getWebhookSecret, normalizeExtraPurchase, verifyWebhookSignature } = require('../utils/buymeacoffee');

const router = express.Router();
const VIP_LEMON_VARIANT_ID = String(process.env.LEMONSQUEEZY_VIP_VARIANT_ID || '2161088');

const hasOtherVipPurchase = async (email) => {
  const [paypalResult, lemonResult, coffeeResult] = await Promise.all([
    supabaseDB.from('paypal_orders')
      .select('custom_id,amount,currency')
      .eq('email', email)
      .eq('status', 'COMPLETED')
      .limit(50),
    supabaseDB.from('lemonsqueezy_orders')
      .select('order_id')
      .eq('email', email)
      .eq('variant_id', VIP_LEMON_VARIANT_ID)
      .eq('status', 'paid')
      .limit(1),
    supabaseDB.from('buymeacoffee_membership_orders')
      .select('transaction_id')
      .eq('email', email)
      .eq('status', 'paid')
      .limit(1),
  ]);

  const error = paypalResult.error || lemonResult.error || coffeeResult.error;
  if (error) return { hasPurchase: false, error };

  const membershipCustomIds = new Set(['vip-permanent', 'vip-monthly', 'vip-membership']);
  const hasPaypalMembership = (paypalResult.data || []).some((order) => (
    membershipCustomIds.has(String(order.custom_id || '').trim().toLowerCase())
    || (Number(order.amount) === 4 && String(order.currency || '').toUpperCase() === 'USD')
  ));

  return {
    hasPurchase: hasPaypalMembership
      || (lemonResult.data || []).length > 0
      || (coffeeResult.data || []).length > 0,
    error: null,
  };
};

router.get('/buymeacoffee/membership-product', async (req, res) => {
  const { data: rows, error } = await supabaseDB
    .from('buymeacoffee_membership_products')
    .select('checkout_url')
    .eq('membership_type', 'vip')
    .limit(1);

  if (error) {
    console.error('Buy Me a Coffee membership lookup failed:', error.message || error);
    return res.status(500).json({ error: 'No se pudo cargar el enlace de membresía' });
  }

  const checkoutUrl = rows?.[0]?.checkout_url;
  if (!checkoutUrl) return res.status(404).json({ error: 'Membresía Buy Me a Coffee no configurada' });
  return res.json({ checkoutUrl });
});

router.get('/buymeacoffee/product/:fileId', async (req, res) => {
  const { data: rows, error } = await supabaseDB
    .from('buymeacoffee_products')
    .select('checkout_url')
    .eq('file_id', String(req.params.fileId))
    .limit(1);

  if (error) {
    console.error('Buy Me a Coffee product lookup failed:', error.message || error);
    return res.status(500).json({ error: 'No se pudo cargar el enlace de compra' });
  }

  const checkoutUrl = rows?.[0]?.checkout_url;
  if (!checkoutUrl) return res.status(404).json({ error: 'Compra con Buy Me a Coffee no configurada' });
  return res.json({ checkoutUrl });
});

router.post('/buymeacoffee/webhook', async (req, res) => {
  const secret = getWebhookSecret();
  if (!secret) return res.status(500).json({ error: 'Webhook de Buy Me a Coffee no configurado' });

  const signature = req.get('x-signature-sha256');
  if (!verifyWebhookSignature(req.rawBody, secret, signature)) {
    return res.status(401).json({ error: 'Firma de webhook inválida' });
  }

  const purchase = normalizeExtraPurchase(req.body);
  if (!purchase) return res.json({ received: true, ignored: true });
  if (!purchase.liveMode) return res.json({ received: true, ignored: true, reason: 'test_event' });
  if (!purchase.extras.length) return res.status(400).json({ error: 'Compra sin productos' });

  const status = purchase.refunded
    ? 'refunded'
    : (purchase.status === 'succeeded' ? 'paid' : purchase.status || 'pending');
  const unmappedProducts = [];
  let recorded = 0;

  try {
    for (const extra of purchase.extras) {
      const { data: membershipProducts, error: membershipProductError } = await supabaseDB
        .from('buymeacoffee_membership_products')
        .select('membership_type')
        .eq('extra_id', extra.id)
        .limit(1);

      if (membershipProductError) {
        console.error('Buy Me a Coffee membership lookup failed:', membershipProductError.message || membershipProductError);
        return res.status(500).json({ error: 'No se pudo identificar la membresía comprada' });
      }

      if (membershipProducts?.length) {
        const membershipType = String(membershipProducts[0].membership_type || '').trim().toLowerCase();
        const { error: orderError } = await supabaseDB.from('buymeacoffee_membership_orders').upsert([{
          transaction_id: purchase.transactionId,
          extra_id: extra.id,
          email: purchase.email,
          status,
          amount: extra.amount,
          currency: extra.currency,
          raw: req.body,
        }], { onConflict: 'transaction_id,extra_id' });

        if (orderError) {
          console.error('Buy Me a Coffee membership order upsert failed:', orderError.message || orderError);
          return res.status(500).json({ error: 'No se pudo registrar la compra de membresía' });
        }
        recorded += 1;

        if (membershipType !== 'vip' || !purchase.email) continue;

        const { row: dbUser, error: userError } = await getUserRowByEmail(purchase.email);
        if (userError) {
          console.error('Buy Me a Coffee membership user lookup failed:', userError.message || userError);
          return res.status(500).json({ error: 'No se pudo buscar la cuenta del comprador' });
        }
        if (!dbUser) continue;

        if (status === 'paid') {
          const { error: updateError } = await supabaseDB
            .from('users')
            .update({ modalidad: 'vip' })
            .eq('email', purchase.email);
          if (updateError) {
            console.error('Buy Me a Coffee VIP activation failed:', updateError.message || updateError);
            return res.status(500).json({ error: 'No se pudo activar la membresía VIP' });
          }
        } else if (status === 'refunded' && String(dbUser.modalidad || '').toLowerCase() === 'vip') {
          const { hasPurchase, error: sourceError } = await hasOtherVipPurchase(purchase.email);
          if (sourceError) {
            console.error('Buy Me a Coffee VIP refund check failed:', sourceError.message || sourceError);
            return res.status(500).json({ error: 'No se pudo verificar el estado VIP restante' });
          }
          if (!hasPurchase) {
            const { error: updateError } = await supabaseDB
              .from('users')
              .update({ modalidad: 'gratuita' })
              .eq('email', purchase.email);
            if (updateError) {
              console.error('Buy Me a Coffee VIP refund downgrade failed:', updateError.message || updateError);
              return res.status(500).json({ error: 'No se pudo actualizar el acceso VIP' });
            }
          }
        }
        continue;
      }

      const { data: mappings, error: mappingError } = await supabaseDB
        .from('buymeacoffee_products')
        .select('file_id')
        .eq('extra_id', extra.id)
        .limit(1);

      if (mappingError) {
        console.error('Buy Me a Coffee product mapping lookup failed:', mappingError.message || mappingError);
        return res.status(500).json({ error: 'No se pudo identificar el archivo comprado' });
      }

      const fileId = mappings?.[0]?.file_id;
      if (!fileId) {
        unmappedProducts.push(extra.id);
        console.warn('Unmapped Buy Me a Coffee product:', extra.id);
        continue;
      }

      const { error: orderError } = await supabaseDB.from('buymeacoffee_orders').upsert([{
        transaction_id: purchase.transactionId,
        extra_id: extra.id,
        file_id: String(fileId),
        email: purchase.email,
        status,
        amount: extra.amount,
        currency: extra.currency,
        quantity: extra.quantity,
        raw: req.body,
      }], { onConflict: 'transaction_id,extra_id' });

      if (orderError) {
        console.error('Buy Me a Coffee order upsert failed:', orderError.message || orderError);
        return res.status(500).json({ error: 'No se pudo registrar la compra' });
      }
      recorded += 1;
    }
  } catch (error) {
    console.error('Buy Me a Coffee webhook error:', error);
    return res.status(500).json({ error: 'No se pudo procesar la compra' });
  }

  return res.json({ received: true, recorded, unmappedProducts });
});

module.exports = router;