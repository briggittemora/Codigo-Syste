const crypto = require('crypto');
const express = require('express');
const fetch = require('node-fetch');
const { supabaseDB } = require('../supabaseClient');
const { getSupabaseUserFromRequest, getUserRowByEmail } = require('../utils/supabaseAuth');

const router = express.Router();
const VIP_VARIANT_ID = String(process.env.LEMONSQUEEZY_VIP_VARIANT_ID || '2161088');
const FILE_VARIANT_ID = String(process.env.LEMONSQUEEZY_FILE_VARIANT_ID || '2161166');
const DONATION_VARIANT_ID = String(process.env.LEMONSQUEEZY_DONATION_VARIANT_ID || '').trim();
const LEMON_API_KEY = String(process.env.LEMONSQUEEZY_API_KEY || '').trim();

const getFilePrice = (record) => {
  const price = record?.price_usd !== null && typeof record?.price_usd !== 'undefined'
    ? Number(record.price_usd)
    : null;
  if (Number.isFinite(price) && price > 0) return price;

  const legacyPrice = String(record?.epago || '').trim().toLowerCase();
  if (legacyPrice === 'vip' || String(record?.tipo || record?.type || '').toLowerCase() === 'vip') return 2;
  const numericPrice = Number(legacyPrice);
  return Number.isFinite(numericPrice) && numericPrice > 0 ? numericPrice : null;
};

const signaturesMatch = (rawBody, signature, secret) => {
  if (!rawBody || !signature || !secret) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const actualBuffer = Buffer.from(String(signature), 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

router.post('/lemonsqueezy/create-file-checkout', async (req, res) => {
  try {
    if (!LEMON_API_KEY) return res.status(500).json({ error: 'Lemon Squeezy API no configurada' });

    const fileId = String(req.body?.fileId || '').trim();
    if (!fileId) return res.status(400).json({ error: 'fileId requerido' });

    const { user } = await getSupabaseUserFromRequest(req);
    const accountEmail = String(user?.email || '').trim().toLowerCase();
    const guestToken = user ? null : crypto.randomBytes(24).toString('hex');

    const { data: rows, error: fileError } = await supabaseDB
      .from('html_files')
      .select('id,filename,name,price_usd,epago,tipo,type')
      .eq('id', fileId)
      .limit(1);
    if (fileError) return res.status(500).json({ error: 'No se pudo leer el archivo' });

    const file = rows?.[0];
    const amount = getFilePrice(file);
    if (!file || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Archivo o precio inválido' });
    }

    const variantResponse = await fetch(`https://api.lemonsqueezy.com/v1/variants/${encodeURIComponent(FILE_VARIANT_ID)}`, {
      headers: {
        Accept: 'application/vnd.api+json',
        Authorization: `Bearer ${LEMON_API_KEY}`,
      },
    });
    const variantJson = await variantResponse.json().catch(() => ({}));
    const storeId = variantJson?.data?.relationships?.store?.data?.id;
    if (!variantResponse.ok || !storeId) {
      console.error('Lemon Squeezy variant lookup failed:', variantResponse.status, variantJson);
      return res.status(502).json({ error: 'No se pudo configurar el checkout de Lemon Squeezy' });
    }

    const customId = `vip-file-${fileId}`;
    const checkoutData = {
      custom: {
        file_id: fileId,
        custom_id: customId,
        account_email: accountEmail || null,
        guest_token: guestToken || null,
      },
    };
    if (accountEmail) checkoutData.email = accountEmail;

    const checkoutResponse = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${LEMON_API_KEY}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: checkoutData,
            product_options: {
              name: String(file.filename || file.name || `Archivo VIP ${fileId}`),
              description: 'Compra de archivo VIP digital',
              custom_price: Math.round(amount * 100),
              redirect_url: `${String(req.body?.returnUrl || '').trim() || process.env.CLIENT_URL_PROD || ''}`,
            },
          },
          relationships: {
            store: { data: { type: 'stores', id: String(storeId) } },
            variant: { data: { type: 'variants', id: FILE_VARIANT_ID } },
          },
        },
      }),
    });
    const checkoutJson = await checkoutResponse.json().catch(() => ({}));
    const checkoutUrl = checkoutJson?.data?.attributes?.url;
    if (!checkoutResponse.ok || !checkoutUrl) {
      console.error('Lemon Squeezy checkout creation failed:', checkoutResponse.status, checkoutJson);
      return res.status(502).json({ error: 'No se pudo crear el checkout de Lemon Squeezy' });
    }

    return res.json({ checkoutUrl, guestToken, amount });
  } catch (error) {
    console.error('POST /api/lemonsqueezy/create-file-checkout error:', error);
    return res.status(500).json({ error: 'No se pudo crear el checkout' });
  }
});

router.post('/lemonsqueezy/create-donation-checkout', async (req, res) => {
  try {
    if (!LEMON_API_KEY || !DONATION_VARIANT_ID) {
      return res.status(500).json({ error: 'Checkout de donaciones no configurado' });
    }

    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount < 0.5) {
      return res.status(400).json({ error: 'Monto de donación inválido' });
    }

    const { user } = await getSupabaseUserFromRequest(req);
    const email = String(user?.email || '').trim().toLowerCase();
    const variantResponse = await fetch(`https://api.lemonsqueezy.com/v1/variants/${encodeURIComponent(DONATION_VARIANT_ID)}`, {
      headers: {
        Accept: 'application/vnd.api+json',
        Authorization: `Bearer ${LEMON_API_KEY}`,
      },
    });
    const variantJson = await variantResponse.json().catch(() => ({}));
    const storeId = variantJson?.data?.relationships?.store?.data?.id;
    if (!variantResponse.ok || !storeId) {
      return res.status(502).json({ error: 'No se pudo configurar el checkout de donaciones' });
    }

    const checkoutData = { custom: { donation: true } };
    if (email) checkoutData.email = email;
    const checkoutResponse = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${LEMON_API_KEY}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: checkoutData,
            product_options: {
              custom_price: Math.round(amount * 100),
              redirect_url: String(req.body?.returnUrl || '').trim() || process.env.CLIENT_URL_PROD || '',
            },
          },
          relationships: {
            store: { data: { type: 'stores', id: String(storeId) } },
            variant: { data: { type: 'variants', id: DONATION_VARIANT_ID } },
          },
        },
      }),
    });
    const checkoutJson = await checkoutResponse.json().catch(() => ({}));
    const checkoutUrl = checkoutJson?.data?.attributes?.url;
    if (!checkoutResponse.ok || !checkoutUrl) {
      console.error('Lemon Squeezy donation checkout failed:', checkoutResponse.status, checkoutJson);
      return res.status(502).json({ error: 'No se pudo crear el checkout de donación' });
    }
    return res.json({ checkoutUrl, amount });
  } catch (error) {
    console.error('POST /api/lemonsqueezy/create-donation-checkout error:', error);
    return res.status(500).json({ error: 'No se pudo crear el checkout de donación' });
  }
});

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
  const customData = attributes.custom_data || {};
  const fileId = String(customData.file_id || '').trim();
  const customId = String(customData.custom_id || (fileId ? `vip-file-${fileId}` : '')).trim();
  const accountEmail = String(customData.account_email || '').trim().toLowerCase();
  const guestToken = String(customData.guest_token || '').trim();
  const orderEmail = guestToken ? `guest:${guestToken}` : (accountEmail || email);

  if (!orderId) return res.status(400).json({ error: 'Webhook sin identificador de orden' });

  if (eventName !== 'order_created' && eventName !== 'order_refunded') {
    return res.json({ received: true, ignored: true });
  }

  const { error: insertError } = await supabaseDB.from('lemonsqueezy_orders').insert([{
    order_id: orderId,
    event_name: eventName || null,
    email: orderEmail || null,
    variant_id: variantId || null,
    file_id: fileId || null,
    custom_id: customId || null,
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

  if (variantId === FILE_VARIANT_ID && fileId && status === 'paid') {
    return res.json({ received: true, activated: true, fileId, guestToken: guestToken || null });
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