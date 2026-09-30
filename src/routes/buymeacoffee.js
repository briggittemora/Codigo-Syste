const express = require('express');
const { supabaseDB } = require('../supabaseClient');
const { getWebhookSecret, normalizeExtraPurchase, verifyWebhookSignature } = require('../utils/buymeacoffee');

const router = express.Router();

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