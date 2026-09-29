import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REVANTPAY_API_URL = (Deno.env.get('REVANTPAY_BASE_URL') || 'https://atnxzbiowkgyvqqjaaed.supabase.co/functions/v1/public-api').replace(/\/$/, '');

function shortError(value: unknown) {
  if (!value) return null;
  if (value instanceof Error) return value.message.slice(0, 500);
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.slice(0, 500);
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isTransientStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function statusEndpoints(chargeId: string) {
  const encoded = encodeURIComponent(chargeId);
  return [
    `${REVANTPAY_API_URL}/v1/charges/${encoded}`,
    `${REVANTPAY_API_URL}/charges/${encoded}`,
  ];
}

async function fetchChargeStatus(apiKey: string, chargeId: string) {
  let lastResponse: Response | null = null;
  let lastBody = '';
  let lastError: unknown = null;

  for (const endpoint of statusEndpoints(chargeId)) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetchWithTimeout(endpoint, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'x-api-key': apiKey,
            'Accept': 'application/json',
          },
        }, 8000);

        if (response.ok) return { response, body: '', endpoint, attempt };

        const body = await response.text();
        lastResponse = response;
        lastBody = body;

        const shouldTryNextEndpoint = response.status === 404 || response.status === 405;
        if (shouldTryNextEndpoint) break;
        if (!isTransientStatus(response.status)) return { response, body, endpoint, attempt };
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
          continue;
        }
        // A rota principal pode estar degradada enquanto a rota de compatibilidade responde.
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
          continue;
        }
        // Timeout/network failure: try the compatibility endpoint before giving up.
        break;
      }
    }
  }

  if (!lastResponse && lastError) throw lastError;
  return { response: lastResponse, body: lastBody, endpoint: statusEndpoints(chargeId).at(-1) || '', attempt: 2 };
}

function isDeliveryConfirmed(events: any[]) {
  return events.some((event) =>
    ['pix_text_sent', 'payment_instructions_sent'].includes(event.event_type) && event.success === true
  );
}

function hasRecentRepairAttempt(events: any[]) {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  return events.some((event) =>
    event.event_type === 'pix_delivery_repair_attempt' && new Date(event.created_at).getTime() > tenMinutesAgo
  );
}

function hasRecentReconcileInstability(events: any[]) {
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
  return events.some((event) =>
    ['reconcile_transient_error', 'reconcile_retry'].includes(event.event_type) &&
    new Date(event.created_at).getTime() > thirtyMinutesAgo
  );
}

async function recentPaymentEvents(supabase: any, orderId: string) {
  const { data } = await supabase
    .from('telegram_payment_events')
    .select('event_type, success, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
      .limit(80);
  return data || [];
}

async function telegramJson(botToken: string, method: string, body: Record<string, unknown>, timeoutMs = 6000) {
  const res = await fetchWithTimeout(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, timeoutMs);
  const data = await res.json().catch(() => null);
  return { ok: res.ok && data?.ok !== false, status: res.status, data };
}

async function repairPixDelivery(
  supabase: any,
  order: any,
  audit: (order: any, eventType: string, extra?: Record<string, unknown>, success?: boolean | null, errorMessage?: string | null) => Promise<void>
) {
  const botToken = order.bots?.token;
  const chatId = order.telegram_user_id;
  const pixCode = order.pix_code;
  if (!botToken || !chatId || !pixCode) return;
  const createdAt = new Date(order.created_at).getTime();
  if (!Number.isFinite(createdAt) || createdAt < Date.now() - 2 * 60 * 60 * 1000) return;

  const orderEvents = await recentPaymentEvents(supabase, order.id);
  if (isDeliveryConfirmed(orderEvents) || hasRecentRepairAttempt(orderEvents)) return;

  await audit(order, 'pix_delivery_repair_attempt', { reason: 'pending_order_missing_delivery_audit' }, null);

  const amount = Number(order.amount || 0).toFixed(2);
  const planName = order.subscription_plans?.name || order.upsell_offers?.name || 'Oferta';
  const protect = order.bots?.anti_clone || false;

  const header = await telegramJson(botToken, 'sendMessage', {
    chat_id: chatId,
    text: `💳 Pagamento PIX\n\n📦 Plano: ${planName}\n💰 Valor: R$ ${amount}\n⏰ Válido por: 1 hora\n\n📋 Copie o código PIX abaixo:`,
    protect_content: protect || undefined,
  });
  const code = await telegramJson(botToken, 'sendMessage', {
    chat_id: chatId,
    text: pixCode,
    protect_content: protect || undefined,
  });

  await audit(order, 'pix_text_sent', { repaired: true, header_ok: header.ok, code_ok: code.ok }, header.ok && code.ok, shortError(!header.ok ? header.data : !code.ok ? code.data : null));

  const repairQrUrl = pixCode
    ? `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&margin=16&ecc=M&format=png&data=${encodeURIComponent(pixCode)}`
    : (order.pix_qrcode_url && /^https?:\/\//i.test(order.pix_qrcode_url) ? order.pix_qrcode_url : null);
  if (repairQrUrl) {
    const qr = await telegramJson(botToken, 'sendPhoto', {
      chat_id: chatId,
      photo: repairQrUrl,
      caption: `📱 Escaneie o QR Code para pagar R$ ${amount}`,
      protect_content: protect || undefined,
    }, 6000);
    await audit(order, 'pix_qr_sent', { repaired: true }, qr.ok, shortError(qr.ok ? null : qr.data));
  }

  const instructions = await telegramJson(botToken, 'sendMessage', {
    chat_id: chatId,
    text: '📱 Como pagar:\n1. Abra o app do seu banco\n2. Escolha pagar com PIX Copia e Cola\n3. Cole o código acima\n4. Confirme o pagamento\n\n✅ Após o pagamento, seu acesso será liberado automaticamente!',
    reply_markup: { inline_keyboard: [[{ text: '🔙 Voltar', callback_data: 'back_to_start' }]] },
    protect_content: protect || undefined,
  });
  await audit(order, 'payment_instructions_sent', { repaired: true }, instructions.ok, shortError(instructions.ok ? null : instructions.data));
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function webhookHeaders(body: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const secret = Deno.env.get('REVANTPAY_WEBHOOK_SECRET');
  if (secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    headers['X-Revantpay-Signature'] = `t=${timestamp},v1=${await hmacHex(secret, `${timestamp}.${body}`)}`;
  }
  return headers;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    let options: Record<string, unknown> = {};
    if (req.method !== 'GET') {
      try { options = await req.json(); } catch (_) { options = {}; }
    }

    // Automatic mode checks the last 48h. Manual backfills can pass from/to/limit/order.
    const from = String(options.from || url.searchParams.get('from') || new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
    const toValue = options.to || url.searchParams.get('to');
    const to = toValue ? String(toValue) : null;
    const requestedLimit = Number(options.limit || url.searchParams.get('limit') || 24);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 24, 1), 40);
    const requestedConcurrency = Number(options.concurrency || url.searchParams.get('concurrency') || 5);
    const concurrency = Math.min(Math.max(Number.isFinite(requestedConcurrency) ? requestedConcurrency : 6, 1), 8);
    const orderParam = String(options.order || url.searchParams.get('order') || 'desc').toLowerCase();
    const ascending = orderParam === 'asc';
    const idsOption = Array.isArray(options.ids) ? options.ids : [];
    const externalIdsOption = Array.isArray(options.external_ids) ? options.external_ids : [];
    const ids = idsOption.map((value) => String(value)).filter(Boolean);
    const externalIds = externalIdsOption.map((value) => String(value)).filter(Boolean);
    
    let pendingQuery = supabase
      .from('payment_orders')
      .select('*, bots(*), subscription_plans(*), upsell_offers(*)')
      .eq('status', 'pending')
      .not('external_id', 'is', null);

    if (ids.length > 0) {
      pendingQuery = pendingQuery.in('id', ids).limit(Math.min(ids.length, 20));
    } else if (externalIds.length > 0) {
      pendingQuery = pendingQuery.in('external_id', externalIds).limit(Math.min(externalIds.length, 20));
    } else {
      pendingQuery = pendingQuery
        .gte('created_at', from)
        .order('last_checked_at', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending })
        .limit(limit);
    }

    if (to && ids.length === 0 && externalIds.length === 0) pendingQuery = pendingQuery.lte('created_at', to);

    const { data: pendingOrders, error } = await pendingQuery;

    if (error) {
      console.error('Error fetching pending orders:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pendingOrders || pendingOrders.length === 0) {
      console.log('No pending orders to check');
      return new Response(JSON.stringify({ ok: true, checked: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Checking ${pendingOrders.length} pending orders from=${from} to=${to || 'now'} limit=${limit} concurrency=${concurrency}...`);
    let confirmed = 0;

    const audit = async (order: any, event_type: string, extra: Record<string, unknown> = {}, success: boolean | null = true, error_message: string | null = null) => {
      try {
        await supabase.from('telegram_payment_events').insert({
          bot_id: order.bot_id,
          order_id: order.id,
          plan_id: order.plan_id ?? null,
          telegram_user_id: Number(order.telegram_user_id),
          event_type,
          source_type: 'check-pending-payments',
          success,
          error_message: shortError(error_message),
          metadata: extra,
        });
      } catch (err) {
        console.error('[AUDIT] reconciliation insert failed', event_type, err);
      }
    };

    const processOrder = async (order: any) => {
      try {
        try {
          const createdAtMs = new Date(order.created_at).getTime();
          if (Number.isFinite(createdAtMs) && createdAtMs > Date.now() - 2 * 60 * 60 * 1000) {
            await repairPixDelivery(supabase, order, audit);
          }
        } catch (deliveryErr) {
          console.warn(`PIX delivery repair failed for ${order.id}:`, deliveryErr);
          await audit(order, 'pix_delivery_repair_failed', { stage: 'repair_exception' }, false, shortError(deliveryErr));
        }

        // Get API key from bot owner's profile first, then per-bot gateway
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('revantpay_api_key')
          .eq('id', order.bots.user_id)
          .single();

        const { data: gateway } = await supabase
          .from('payment_gateways')
          .select('token')
          .eq('bot_id', order.bot_id)
          .eq('gateway_name', 'revantpay')
          .eq('is_connected', true)
          .maybeSingle();

        const apiKey = ownerProfile?.revantpay_api_key || gateway?.token || Deno.env.get('REVANTPAY_API_KEY');
        if (!apiKey) return;

        // Check status on RevantPay - GET /v1/charges/{charge_id}; fallback to /charges/{charge_id}.
        const statusResult = await fetchChargeStatus(apiKey, order.external_id);
        const res = statusResult.response;
        let errText = statusResult.body;

        if (!res) {
          await audit(order, 'reconcile_error', { stage: 'no_response', endpoint: statusResult.endpoint }, false, errText);
          return;
        }

        if (!res.ok) {
          errText = errText || await res.text();
          console.error(`Error checking ${order.external_id}:`, res.status, errText);
          const transient = isTransientStatus(res.status);
          const recentEvents = transient ? await recentPaymentEvents(supabase, order.id) : [];
          if (!transient || !hasRecentReconcileInstability(recentEvents)) {
            await audit(
              order,
              transient ? 'reconcile_transient_error' : 'reconcile_error',
              { status: res.status, transient, endpoint: statusResult.endpoint, attempt: statusResult.attempt },
              transient ? null : false,
              errText,
            );
          }
          return;
        }

        const raw = await res.json();
        const data = raw?.data || raw;
        const statusText = String(data.status ?? '').toLowerCase();
        const isPaid = data.paid === true
          || ['approved', 'paid', 'completed', 'confirmed'].includes(statusText);
        console.log(`Order ${order.external_id}: status=${data.status} paid=${data.paid === true}`);

        if (isPaid) {
          // Trigger payment-webhook
          console.log(`Payment ${order.external_id} confirmed! Triggering webhook...`);
          
          const webhookBody = JSON.stringify({
            charge_id: order.external_id,
            external_id: order.external_id,
            status: 'approved',
            paid_at: data.paid_at || data.approved_at || data.updated_at || null,
          });
          const webhookRes = await fetch(`${supabaseUrl}/functions/v1/payment-webhook`, {
            method: 'POST',
            headers: await webhookHeaders(webhookBody),
            body: webhookBody,
          });

          if (webhookRes.ok) {
            confirmed++;
            console.log(`Successfully processed ${order.external_id}`);
            await audit(order, 'reconciled_paid', { external_id: order.external_id });
          } else {
            const errText = await webhookRes.text();
            console.error(`Webhook failed for ${order.external_id}:`, errText);
            await audit(order, 'reconcile_error', { stage: 'webhook' }, false, errText.slice(0, 500));
          }
        } else if (statusText === 'cancelled' || statusText === 'canceled') {
          await supabase.from('payment_orders').update({ status: 'cancelled' }).eq('id', order.id);
          await audit(order, 'order_cancelled', { external_status: data.status });
        } else if (statusText === 'expired') {
          // Never expire on a query hiccup: only when the charge's own deadline has really passed.
          const deadline = data.expires_at || order.expires_at;
          const deadlineMs = deadline ? new Date(deadline).getTime() : NaN;
          if (Number.isFinite(deadlineMs) && deadlineMs < Date.now()) {
            await supabase.from('payment_orders').update({ status: 'expired' }).eq('id', order.id);
            console.log(`Marked ${order.external_id} as expired`);
            await audit(order, 'order_expired', { external_status: data.status, expires_at: deadline });
          }
        }
      } catch (err) {
        const transient = err instanceof DOMException && err.name === 'AbortError'
          || err instanceof TypeError;
        if (transient) {
          console.warn(`Transient RevantPay status check failure for ${order.id}:`, shortError(err));
        } else {
          console.error(`Error checking order ${order.id}:`, err);
        }
        const recentEvents = transient ? await recentPaymentEvents(supabase, order.id) : [];
        if (!transient || !hasRecentReconcileInstability(recentEvents)) {
          await audit(
            order,
            transient ? 'reconcile_transient_error' : 'reconcile_error',
            { stage: 'exception', transient },
            transient ? null : false,
            shortError(err),
          );
        }
      }
    };

    // Mark this batch as checked up-front so the next cron run rotates to other pending orders.
    await supabase
      .from('payment_orders')
      .update({ last_checked_at: new Date().toISOString() })
      .in('id', pendingOrders.map((o: any) => o.id));

    const queue = [...pendingOrders];
    await Promise.all(
      Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        while (queue.length > 0) {
          const next = queue.shift();
          if (!next) break;
          await processOrder(next);
        }
      }),
    );

    return new Response(JSON.stringify({ ok: true, checked: pendingOrders.length, confirmed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
