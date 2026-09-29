import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { firePushcut } from "../_shared/pushcut.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-revantpay-event, x-revantpay-signature',
};

const REVANTPAY_API_URL = (Deno.env.get('REVANTPAY_BASE_URL') || 'https://atnxzbiowkgyvqqjaaed.supabase.co/functions/v1/public-api').replace(/\/$/, '');

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function onlyDigits(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function markdownText(value: unknown) {
  return String(value || '').replace(/([_*`\[])/g, '\\$1');
}

function shortError(value: unknown) {
  if (!value) return null;
  if (value instanceof Error) return value.message.slice(0, 500);
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.slice(0, 500);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function telegramPost(botToken: string, method: string, body: Record<string, unknown>, timeoutMs = 12000) {
  try {
    const response = await fetchWithTimeout(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, timeoutMs);
    const data = await response.json().catch(() => null);
    const ok = response.ok && data?.ok !== false;
    if (!ok) console.error(`[TG] ${method} failed:`, response.status, JSON.stringify(data));
    return { ok, status: response.status, data, error: ok ? null : data };
  } catch (err) {
    console.error(`[TG] ${method} threw:`, err instanceof Error ? err.message : String(err));
    return { ok: false, status: null, data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function sendTelegramMessage(botToken: string, body: Record<string, unknown>) {
  const first = await telegramPost(botToken, 'sendMessage', body);
  if (!first.ok && body.parse_mode) {
    const plainBody = { ...body };
    delete plainBody.parse_mode;
    return await telegramPost(botToken, 'sendMessage', plainBody);
  }
  return first;
}

async function recordPaymentEvent(supabase: any, payload: {
  bot_id?: string | null;
  order_id?: string | null;
  plan_id?: string | null;
  telegram_user_id?: number | string | null;
  event_type: string;
  source_type?: string | null;
  external_status?: number | null;
  success?: boolean | null;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    if (!payload.bot_id || !payload.telegram_user_id) return;
    const { error } = await supabase.from('telegram_payment_events').insert({
      bot_id: payload.bot_id,
      order_id: payload.order_id ?? null,
      plan_id: payload.plan_id ?? null,
      telegram_user_id: Number(payload.telegram_user_id),
      event_type: payload.event_type,
      source_type: payload.source_type ?? 'payment-webhook',
      external_status: payload.external_status ?? null,
      success: payload.success ?? null,
      error_message: payload.error_message ?? null,
      metadata: payload.metadata ?? {},
    });
    if (error) console.error('[AUDIT] insert failed', payload.event_type, error.message);
  } catch (err) {
    console.error('[AUDIT] insert threw', payload.event_type, err);
  }
}

async function hasSuccessfulPaymentEvent(supabase: any, orderId: string, eventTypes: string[]) {
  const { data } = await supabase
    .from('telegram_payment_events')
    .select('id')
    .eq('order_id', orderId)
    .in('event_type', eventTypes)
    .eq('success', true)
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

async function verifyRevantSignature(req: Request, rawBody: string) {
  const secret = Deno.env.get('REVANTPAY_WEBHOOK_SECRET');
  if (!secret) return true;

  const sigHeader = req.headers.get('X-Revantpay-Signature') || req.headers.get('x-revantpay-signature') || '';
  const parts = Object.fromEntries(sigHeader.split(',').map((part) => {
    const [key, ...rest] = part.split('=');
    return [key?.trim(), rest.join('=').trim()];
  }).filter(([key, value]) => key && value));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);
  return timingSafeEqual(expected, signature);
}

async function chargePlatformFee(supabase: any, order: any) {
  try {
    const platformFee = Number(order.platform_fee || 0);
    if (platformFee <= 0) {
      console.log('No platform fee to charge');
      return;
    }

    // Always record the fee in the ledger first, so revenue stays auditable even
    // when the platform gateway key is not configured yet.
    const sellerId = order.user_id || order.bots?.user_id;
    if (!sellerId) {
      console.log('Seller id missing, skipping platform fee charge');
      return;
    }

    await supabase.from('platform_fees_ledger').insert({
      user_id: sellerId,
      bot_id: order.bot_id,
      order_id: order.id,
      fee_amount: platformFee,
      status: 'pending',
    });

    const { data: platformKeySetting } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'platform_revantpay_key')
      .maybeSingle();

    if (!platformKeySetting?.value) {
      console.log('Platform RevantPay key not configured, fee recorded as pending only');
      return;
    }

    // Sum pending fees for this seller; only charge when reaching RevantPay minimum (R$5)
    const { data: pending } = await supabase
      .from('platform_fees_ledger')
      .select('id, fee_amount')
      .eq('user_id', sellerId)
      .eq('status', 'pending');
    const totalPending = (pending || []).reduce((s: number, r: any) => s + Number(r.fee_amount || 0), 0);
    if (totalPending < 5) {
      console.log(`Platform fee accumulated (R$${totalPending.toFixed(2)}), awaiting threshold`);
      return;
    }

    const customerCpf = onlyDigits(order.customer_cpf);
    if (customerCpf.length !== 11 && customerCpf.length !== 14) {
      console.log('Customer document missing, skipping platform fee charge');
      return;
    }

    const feeExternalId = `fee_${order.id}_${Date.now()}`;

    const response = await fetchWithTimeout(`${REVANTPAY_API_URL}/charges/pix`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${platformKeySetting.value}`,
        'x-api-key': platformKeySetting.value,
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        amount: Number(totalPending.toFixed(2)),
        description: `Taxa plataforma acumulada (${(pending || []).length} pedidos)`,
        customer_name: order.customer_name || 'Cliente Riot Vips',
        customer_email: `platform-fee@riotvips.com`,
        customer_cpf: customerCpf,
        external_id: feeExternalId,
      }),
    }, 12000);

    if (response.ok) {
      const raw = await response.json();
      const data = raw?.data || raw;
      const chargeId = data.id || data.charge_id || feeExternalId;
      console.log('Platform fee batch charge created:', JSON.stringify(data));
      const pendingIds = (pending || []).map((r: any) => r.id);
      await supabase
        .from('platform_fees_ledger')
        .update({ status: 'charged', batch_charge_id: chargeId, charged_at: new Date().toISOString() })
        .in('id', pendingIds);
      await supabase
        .from('payment_orders')
        .update({ platform_fee_charge_id: chargeId, platform_fee_status: 'charged' })
        .eq('id', order.id);
    } else {
      const errorText = await response.text();
      console.error('Failed to create platform fee charge:', response.status, errorText);
      
      await supabase
        .from('payment_orders')
        .update({ platform_fee_status: 'failed' })
        .eq('id', order.id);
    }
  } catch (error) {
    console.error('Error charging platform fee:', error);
  }
}

async function generateUniqueInviteLink(botToken: string, vipId: string): Promise<string | null> {
  try {
    const response = await telegramPost(botToken, 'createChatInviteLink', {
      chat_id: vipId,
      member_limit: 1,
      name: `VIP ${Date.now()}`,
    });
    const data = response.data;
    if (response.ok && data?.result?.invite_link) {
      console.log('Generated unique invite link:', data.result.invite_link);
      return data.result.invite_link;
    }
    console.error('Failed to generate invite link:', JSON.stringify(data));
    return null;
  } catch (err) {
    console.error('Error generating invite link:', err);
    return null;
  }
}

async function sendTelegramMessages(bot: any, plan: any, order: any, expiresAt: Date, supabase: any) {
  const planName = markdownText(plan.name || 'Oferta Especial');

  // Resolve delivery link (unique VIP invite when possible, else static vip_link).
  let deliveryLink: string | null = null;
  let isUnique = false;
  if (bot.vip_id) {
    const uniqueLink = await generateUniqueInviteLink(bot.token, bot.vip_id);
    if (uniqueLink) {
      deliveryLink = uniqueLink;
      isUnique = true;
    }
  }
  if (!deliveryLink && bot.vip_link) {
    deliveryLink = bot.vip_link;
  }

  // Send a single confirmation message that already includes the delivery link.
  const deliverySection = deliveryLink
    ? `\n\n🔗 *Acesse o grupo VIP:*\n${deliveryLink}\n\n${isUnique ? '⚠️ _Este link é pessoal, intransferível e de uso único._' : '_Este link é pessoal e intransferível._'}`
    : '';

  const successMessage = `✅ *Pagamento Confirmado!*\n\n` +
    `Plano: *${planName}*\n` +
    `Valor: R$ ${Number(order.amount).toFixed(2)}\n` +
    `Válido até: ${expiresAt.toLocaleDateString('pt-BR')}\n\n` +
    (order.source_type === 'upsell' ? `🎉 Sua oferta foi confirmada!` : `🎉 Seu acesso VIP foi liberado!`) +
    deliverySection;

  const deliveryResult = await sendTelegramMessage(bot.token, {
    chat_id: order.telegram_user_id,
    text: successMessage,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });

  try {
    await recordPaymentEvent(supabase, {
      bot_id: order.bot_id,
      order_id: order.id,
      plan_id: order.plan_id,
      telegram_user_id: order.telegram_user_id,
      event_type: 'delivery_message_sent',
      external_status: deliveryResult.status,
      success: deliveryResult.ok,
      error_message: deliveryResult.error,
      metadata: { has_link: Boolean(deliveryLink), unique_link: isUnique },
    });
  } catch (_) { /* audit must never block delivery */ }

  const deliveryBlocked = !deliveryResult.ok && String(shortError(deliveryResult.error) || '').toLowerCase().includes('bot was blocked');
  if (deliveryBlocked && bot.registro_id) {
    const fallbackLinkText = deliveryLink ? `\n\nLink do entregável para envio manual:\n${deliveryLink}` : '';
    const alertResult = await sendTelegramMessage(bot.token, {
      chat_id: bot.registro_id,
      text: `⚠️ *Venda paga, mas o lead bloqueou o bot*\n\n` +
        `Cliente: ${order.telegram_first_name || 'Usuário'} (@${order.telegram_username || 'sem username'})\n` +
        `Valor: R$ ${Number(order.amount).toFixed(2)}\n` +
        `Pedido: ${order.id}${fallbackLinkText}`,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
    await recordPaymentEvent(supabase, {
      bot_id: order.bot_id,
      order_id: order.id,
      plan_id: order.plan_id,
      telegram_user_id: order.telegram_user_id,
      event_type: 'seller_delivery_blocked_alert_sent',
      external_status: alertResult.status,
      success: alertResult.ok,
      error_message: alertResult.error,
      metadata: { reason: 'bot_blocked_by_user', has_link: Boolean(deliveryLink) },
    });
  }

  // Send upsell offers after the main payment only; do not loop offers after an upsell purchase.
  const { data: upsellOffers } = order.source_type === 'upsell'
    ? { data: [] }
    : await supabase
      .from('upsell_offers')
      .select('*')
      .eq('bot_id', order.bot_id)
      .eq('is_active', true);

  if (upsellOffers && upsellOffers.length > 0) {
    for (const offer of upsellOffers) {
      const offerName = markdownText(offer.name || 'Oferta Especial');
      const offerDescription = markdownText(offer.description || offer.message || '');
      const upsellMessage = `🌟 *Oferta Exclusiva!*\n\n` +
        `*${offerName}*\n` +
        `${offerDescription}\n\n` +
        `💰 Por apenas *R$ ${Number(offer.price).toFixed(2)}*`;

      const upsellKeyboard = {
        inline_keyboard: [
          [{ text: `✅ Quero! R$ ${Number(offer.price).toFixed(2)}`, callback_data: `upsell_${offer.id}` }],
          [{ text: '❌ Não, obrigado', callback_data: `skip_upsell_${order.id}` }],
        ]
      };

      if (offer.media_url && offer.media_type) {
        const mediaMethod = offer.media_type === 'video' ? 'sendVideo' : 'sendPhoto';
        const mediaField = offer.media_type === 'video' ? 'video' : 'photo';
        const mediaResult = await telegramPost(bot.token, mediaMethod, {
          chat_id: order.telegram_user_id,
          [mediaField]: offer.media_url,
          caption: upsellMessage,
          parse_mode: 'Markdown',
          reply_markup: upsellKeyboard,
        });
        if (!mediaResult.ok) {
          await sendTelegramMessage(bot.token, {
            chat_id: order.telegram_user_id,
            text: upsellMessage,
            parse_mode: 'Markdown',
            reply_markup: upsellKeyboard,
          });
        }
      } else {
        await sendTelegramMessage(bot.token, {
          chat_id: order.telegram_user_id,
          text: upsellMessage,
          parse_mode: 'Markdown',
          reply_markup: upsellKeyboard,
        });
      }
    }
  }

  // Notify sales channel
  if (bot.registro_id) {
    const notifyMessage = `💰 *Nova Venda!*\n\n` +
      `👤 ${order.telegram_first_name || 'Usuário'} (@${order.telegram_username || 'sem username'})\n` +
      `📦 ${planName}\n` +
      `💵 R$ ${Number(order.amount).toFixed(2)}`;

    const sellerNotify = await sendTelegramMessage(bot.token, {
      chat_id: bot.registro_id,
      text: notifyMessage,
      parse_mode: 'Markdown',
    });
    await recordPaymentEvent(supabase, {
      bot_id: order.bot_id,
      order_id: order.id,
      plan_id: order.plan_id,
      telegram_user_id: order.telegram_user_id,
      event_type: 'seller_registry_notified',
      external_status: sellerNotify.status,
      success: sellerNotify.ok,
      error_message: sellerNotify.error,
    });
  }

  // Notify admin registry channel
  const { data: registrySetting } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'registry_channel_id')
    .maybeSingle();

  if (registrySetting?.value) {
    const platformFee = Number(order.platform_fee || 0);
    const registryMessage = `📊 *Venda Riot Vips*\n\n` +
      `🤖 Bot: @${bot.username}\n` +
      `👤 ${order.telegram_first_name || 'Usuário'} (@${order.telegram_username || 'N/A'})\n` +
      `📦 ${planName}\n` +
      `💵 R$ ${Number(order.amount).toFixed(2)}` +
      (platformFee > 0 ? `\n💎 Taxa plataforma: R$ ${platformFee.toFixed(2)}` : '') +
      `\n📅 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;

    const registryNotify = await sendTelegramMessage(bot.token, {
      chat_id: registrySetting.value,
      text: registryMessage,
      parse_mode: 'Markdown',
    });
    await recordPaymentEvent(supabase, {
      bot_id: order.bot_id,
      order_id: order.id,
      plan_id: order.plan_id,
      telegram_user_id: order.telegram_user_id,
      event_type: 'registry_channel_notified',
      external_status: registryNotify.status,
      success: registryNotify.ok,
      error_message: registryNotify.error,
    });
  }
}

async function sendCrossBotUpsell(supabase: any, bot: any, order: any) {
  try {
    // Priority 1: Check if the tracked_link has a cross_bot_id
    let targetBotId = bot.cross_bot_upsell_bot_id;

    if (order.tracked_link_id) {
      const { data: trackedLink } = await supabase
        .from('tracked_links')
        .select('cross_bot_id')
        .eq('id', order.tracked_link_id)
        .single();

      if (trackedLink?.cross_bot_id) {
        targetBotId = trackedLink.cross_bot_id;
        console.log(`Using cross_bot_id from tracked_link: ${targetBotId}`);
      }
    }

    if (!targetBotId) return;

    // Fetch the target bot
    const { data: targetBot } = await supabase
      .from('bots')
      .select('id, username, user_id')
      .eq('id', targetBotId)
      .single();

    if (!targetBot || targetBot.user_id !== bot.user_id) {
      console.log('Cross-bot upsell target not found or different owner');
      return;
    }

    const message = bot.cross_bot_upsell_message || 
      `🌟 *Oferta Exclusiva!*\n\nTemos uma oferta especial para você! Clique abaixo para conferir:`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '🎁 Ver Oferta Especial', url: `https://t.me/${targetBot.username}?start=crossupsell_${order.id}` }]
      ]
    };

    await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: order.telegram_user_id,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }),
    });

    console.log(`Cross-bot upsell sent to user ${order.telegram_user_id} -> @${targetBot.username}`);
  } catch (error) {
    console.error('Error sending cross-bot upsell:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    if (!(await verifyRevantSignature(req, rawBody))) {
      return new Response(JSON.stringify({ error: 'invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.parse(rawBody);
    console.log('Payment webhook received:', JSON.stringify(payload));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // RevantPay may send both external_id (our request id) and charge_id (gateway UUID).
    // Riot stores the gateway UUID in payment_orders.external_id, so try charge identifiers first.
    const externalIdCandidates = Array.from(new Set([
      payload.data?.charge_id,
      payload.charge_id,
      payload.data?.id,
      payload.id,
      payload.data?.external_id,
      payload.external_id,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)));
    const externalId = externalIdCandidates[0];
    if (externalIdCandidates.length === 0) {
      return new Response(JSON.stringify({ error: 'missing charge identifier' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const status = payload.data?.status || payload.status || payload.payment_status;
    const eventName = String(payload.event || payload.type || payload.data?.event || '').toLowerCase();
    
    const normalizedStatus = String(status || '').toLowerCase();
    const isPaid = ['paid', 'approved', 'completed', 'confirmed'].includes(normalizedStatus)
      || payload.data?.paid === true
      || payload.paid === true
      || ['charge.paid', 'payment.paid', 'pix.paid'].includes(eventName)
      || (eventName.includes('paid') && !eventName.includes('unpaid'));

    if (!isPaid) {
      console.log('Payment not confirmed yet:', status);
      if (externalId && ['expired', 'EXPIRED', 'cancelled', 'CANCELLED', 'canceled', 'CANCELED'].includes(status)) {
        await supabase
          .from('payment_orders')
          .update({ status: status.toLowerCase().startsWith('cancel') ? 'cancelled' : 'expired' })
          .in('external_id', externalIdCandidates)
          .eq('status', 'pending');
      }
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let { data: order, error: orderError } = await supabase
      .from('payment_orders')
      .select('*, subscription_plans(*), upsell_offers(*), bots(*)')
      .in('external_id', externalIdCandidates)
      .maybeSingle();

    if (!order && !orderError) {
      const uuidCandidates = externalIdCandidates.filter(isUuid);
      if (uuidCandidates.length > 0) {
        const byId = await supabase
          .from('payment_orders')
          .select('*, subscription_plans(*), upsell_offers(*), bots(*)')
          .in('id', uuidCandidates)
          .maybeSingle();
        order = byId.data;
        orderError = byId.error;
      }
    }

    if (orderError || !order) {
      console.error('Order not found:', externalId, orderError);
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const wasAlreadyPaid = order.status === 'paid';

    if (!wasAlreadyPaid) {
      const providedPaidAt = (payload as any)?.paid_at || (payload as any)?.data?.paid_at;
      let paidAtIso = new Date().toISOString();
      if (providedPaidAt) {
        const parsed = new Date(providedPaidAt);
        if (!Number.isNaN(parsed.getTime()) && parsed.getTime() <= Date.now() + 60_000) {
          paidAtIso = parsed.toISOString();
        }
      }
      await supabase
        .from('payment_orders')
        .update({ status: 'paid', paid_at: paidAtIso })
        .eq('id', order.id);
    }

    const hasPaymentConfirmed = await hasSuccessfulPaymentEvent(supabase, order.id, ['payment_confirmed']);
    if (!hasPaymentConfirmed) {
      await recordPaymentEvent(supabase, {
        bot_id: order.bot_id,
        order_id: order.id,
        plan_id: order.plan_id,
        telegram_user_id: order.telegram_user_id,
        event_type: 'payment_confirmed',
        source_type: order.source_type || 'payment-webhook',
        success: true,
        metadata: { amount: order.amount, external_id: order.external_id, recovered: wasAlreadyPaid },
      });
    }

    if (!wasAlreadyPaid) {
      await firePushcut(supabase, {
        event: 'transaction_paid',
        botId: order.bot_id,
        title: 'PIX aprovado 💸',
        text: `Pagamento confirmado de R$ ${Number(order.amount || 0).toFixed(2)}.`,
        meta: { order_id: order.id, amount: order.amount },
      });
    }

    // Determine plan info - for upsells, plan_id references upsell_offers not subscription_plans
    let planName = order.subscription_plans?.name;
    let durationDays = order.subscription_plans?.duration_days || 30;
    let isUpsellOrder = false;

    if (!order.subscription_plans && order.source_type === 'upsell') {
      isUpsellOrder = true;
      let upsellOffer = order.upsell_offers;
      if (!upsellOffer && order.upsell_offer_id) {
        const { data } = await supabase
          .from('upsell_offers').select('name').eq('id', order.upsell_offer_id).maybeSingle();
        upsellOffer = data;
      }
      planName = upsellOffer?.name || 'Oferta Especial';
      // For upsell, extend existing VIP or use 30 days default
      const { data: existingVip } = await supabase
        .from('vip_members')
        .select('expires_at')
        .eq('bot_id', order.bot_id)
        .eq('telegram_user_id', order.telegram_user_id)
        .eq('is_active', true)
        .maybeSingle();
      if (existingVip?.expires_at) {
        // Upsell doesn't extend VIP duration, just confirm purchase
        durationDays = 0;
      }
    }

    const { data: currentVip } = durationDays > 0
      ? await supabase
        .from('vip_members')
        .select('id, expires_at')
        .eq('bot_id', order.bot_id)
        .eq('telegram_user_id', order.telegram_user_id)
        .maybeSingle()
      : { data: null };

    // Calculate VIP expiration. New renewals extend from the current active expiry;
    // idempotent reprocessing of an already-paid order does not extend twice.
    const paidBase = new Date(order.paid_at || Date.now());
    const currentExpiry = currentVip?.expires_at ? new Date(currentVip.expires_at) : null;
    const expiresAt = wasAlreadyPaid && currentExpiry
      ? new Date(currentExpiry)
      : new Date(!wasAlreadyPaid && currentExpiry && currentExpiry > paidBase ? currentExpiry : paidBase);
    if (!wasAlreadyPaid || !currentExpiry) {
      expiresAt.setDate(expiresAt.getDate() + durationDays);
    }

    // Add or update VIP member (skip for upsells that don't extend duration)
    if (durationDays > 0 && (!wasAlreadyPaid || !currentVip?.id)) {
      await supabase
        .from('vip_members')
        .upsert({
          bot_id: order.bot_id,
          telegram_user_id: order.telegram_user_id,
          telegram_username: order.telegram_username,
          telegram_first_name: order.telegram_first_name,
          plan_id: isUpsellOrder ? null : order.plan_id,
          expires_at: expiresAt.toISOString(),
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'bot_id,telegram_user_id' });
    }

    // Charge platform fee automatically
    const hasPlatformFeeLedger = await hasSuccessfulPaymentEvent(supabase, order.id, ['platform_fee_recorded']);
    if (!hasPlatformFeeLedger) {
      await chargePlatformFee(supabase, order);
      await recordPaymentEvent(supabase, {
        bot_id: order.bot_id,
        order_id: order.id,
        plan_id: order.plan_id,
        telegram_user_id: order.telegram_user_id,
        event_type: 'platform_fee_recorded',
        source_type: 'payment-webhook',
        success: true,
      });
    }

    // Notify global registry channel about the paid sale
    try {
      const { data: regToken } = await supabase.from('admin_settings').select('value').eq('key', 'registry_bot_token').maybeSingle();
      const { data: regChat } = await supabase.from('admin_settings').select('value').eq('key', 'registry_chat_id').maybeSingle();
      const hasGlobalRegistry = await hasSuccessfulPaymentEvent(supabase, order.id, ['global_registry_notified']);
      if (regToken?.value && regChat?.value && !hasGlobalRegistry) {
        const msg = `💰 *Venda confirmada — Riot Vips*\n\n` +
          `Bot: ${order.bots?.name || '-'}\n` +
          `Plano: ${planName || '-'}\n` +
          `Valor: R$ ${Number(order.amount).toFixed(2)}\n` +
          `Cliente: ${order.telegram_first_name || ''} @${order.telegram_username || '-'}\n` +
          `Pedido: \`${order.id}\`\n` +
          `Horário: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
        const globalNotify = await sendTelegramMessage(regToken.value, {
          chat_id: regChat.value,
          text: msg,
          parse_mode: 'Markdown',
        });
        await recordPaymentEvent(supabase, {
          bot_id: order.bot_id,
          order_id: order.id,
          plan_id: order.plan_id,
          telegram_user_id: order.telegram_user_id,
          event_type: 'global_registry_notified',
          external_status: globalNotify.status,
          success: globalNotify.ok,
          error_message: globalNotify.error,
        });
      }
    } catch (err) {
      console.error('Registry channel notify failed:', err);
    }

    // Send Telegram messages (works for both regular and upsell orders)
    if (order.bots) {
      const hasDelivery = await hasSuccessfulPaymentEvent(supabase, order.id, ['delivery_message_sent']);
      if (!hasDelivery) {
        const plan = order.subscription_plans || { name: planName, duration_days: durationDays };
        await sendTelegramMessages(order.bots, plan, order, expiresAt, supabase);
      } else {
        console.log('Delivery already confirmed, skipping duplicate delivery:', order.id);
      }
      
      // Send cross-bot upsell only after the main checkout, never after an upsell purchase.
      const hasCrossBotSent = await hasSuccessfulPaymentEvent(supabase, order.id, ['cross_bot_upsell_sent']);
      if (!isUpsellOrder && !hasCrossBotSent) {
        await sendCrossBotUpsell(supabase, order.bots, order);
        await recordPaymentEvent(supabase, {
          bot_id: order.bot_id,
          order_id: order.id,
          plan_id: order.plan_id,
          telegram_user_id: order.telegram_user_id,
          event_type: 'cross_bot_upsell_sent',
          success: true,
        });
      }
    }

    console.log('Payment processed successfully:', order.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
