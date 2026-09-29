import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REVANTPAY_API_URL = (Deno.env.get('REVANTPAY_BASE_URL') || 'https://atnxzbiowkgyvqqjaaed.supabase.co/functions/v1/public-api').replace(/\/$/, '');

function paymentWebhookUrl(supabaseUrl: string) {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/payment-webhook`;
}

function onlyDigits(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function hasValidDocumentLength(value: unknown) {
  const digits = onlyDigits(value);
  return digits.length === 11 || digits.length === 14;
}

function moneyAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
}

function paymentDescription(...parts: Array<unknown>) {
  const description = parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' - ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/@/g, '')
    .replace(/[^a-zA-Z0-9 .,_\-()/]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return description || 'Pagamento Riot Vips';
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
      source_type: payload.source_type ?? 'create-payment',
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      botId,
      planId,
      telegramUserId,
      telegramUsername,
      telegramFirstName,
      customerCpf,
      customerName,
      customerEmail,
      customerPhone,
    } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await recordPaymentEvent(supabase, {
      bot_id: botId,
      plan_id: planId,
      telegram_user_id: telegramUserId,
      event_type: 'payment_started',
      success: true,
    });

    // Get plan info
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*, bots(*)')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      throw new Error('Plan not found');
    }

    // Get API key from bot owner's profile, then fallback to per-bot gateway, then env var
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('revantpay_api_key, platform_fee_override')
      .eq('id', plan.bots.user_id)
      .single();

    const { data: gateway } = await supabase
      .from('payment_gateways')
      .select('token')
      .eq('bot_id', botId)
      .eq('gateway_name', 'revantpay')
      .eq('is_connected', true)
      .limit(1)
      .maybeSingle();

    const revantPayKey = Deno.env.get('REVANTPAY_API_KEY');
    const apiKey = ownerProfile?.revantpay_api_key || gateway?.token || revantPayKey;
    
    if (!apiKey) {
      throw new Error('Payment gateway not configured');
    }

    // Get platform fee
    const { data: feeSetting } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'platform_fee')
      .maybeSingle();
    
    const overrideFee = (ownerProfile as any)?.platform_fee_override;
    const platformFee = overrideFee !== null && overrideFee !== undefined
      ? Number(overrideFee)
      : (feeSetting ? parseFloat(feeSetting.value) : 0.60);
    const totalAmount = moneyAmount(plan.price); // Buyer pays plan price only, fee is deducted from vendor
    if (totalAmount < 5) {
      throw new Error('O valor mínimo para gerar PIX na RevantPay é R$ 5,00');
    }

    const cleanCpf = onlyDigits(customerCpf);
    const hasCpf = hasValidDocumentLength(cleanCpf);
    // PIX anônimo obrigatório até R$ 1.000 (spec RevantPay).
    // Acima disso, CPF/CNPJ do pagador é obrigatório.
    const requiresCustomer = totalAmount > 1000;
    if (requiresCustomer && !hasCpf) {
      throw new Error('customer_cpf obrigatório para valores acima de R$ 1.000');
    }
    const finalCustomerName = requiresCustomer
      ? String(customerName || telegramFirstName || `Cliente Telegram ${telegramUserId}`).trim()
      : undefined;
    const finalCustomerEmail = requiresCustomer
      ? String(customerEmail || `tg${telegramUserId}@bot.local`).trim()
      : undefined;

    const orderId = crypto.randomUUID();
    const externalId = orderId;

    // Create payment with RevantPay API - POST /charges/pix
    const idempotencyKey = crypto.randomUUID();
    const pixPayload: Record<string, unknown> = {
      amount: totalAmount,
      description: paymentDescription(plan.name, plan.bots.username),
      ...(requiresCustomer
        ? {
            customer_name: finalCustomerName,
            customer_email: finalCustomerEmail,
            customer_cpf: cleanCpf,
            ...(customerPhone ? { customer_phone: onlyDigits(customerPhone) } : {}),
          }
        : {}),
      external_id: externalId,
      webhook_url: paymentWebhookUrl(supabaseUrl),
    };

    let paymentResponse = await fetch(`${REVANTPAY_API_URL}/charges/pix`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(pixPayload),
    });

    let preReadErrorText: string | null = null;
    if (!paymentResponse.ok) {
      const firstErrorText = await paymentResponse.text();
      if (/webhook/i.test(firstErrorText)) {
        await recordPaymentEvent(supabase, {
          bot_id: botId,
          plan_id: planId,
          telegram_user_id: telegramUserId,
          event_type: 'revantpay_webhook_url_retry',
          external_status: paymentResponse.status,
          success: null,
          error_message: firstErrorText.slice(0, 500),
        });
        const retryPayload = { ...pixPayload };
        delete retryPayload.webhook_url;
        paymentResponse = await fetch(`${REVANTPAY_API_URL}/charges/pix`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify(retryPayload),
        });
      } else {
        preReadErrorText = firstErrorText;
      }
    }

    let pixCode = null;
    let pixQrcodeUrl = null;
    let chargeId = externalId;

    if (paymentResponse.ok) {
      const rawPaymentBody = await paymentResponse.text();
      const paymentData = JSON.parse(rawPaymentBody);
      console.log('RevantPay response:', JSON.stringify(paymentData));
      
      chargeId = paymentData.id || paymentData.charge_id || paymentData.data?.id || externalId;
      pixCode = paymentData.pix?.qr_code || paymentData.data?.pix?.qr_code;
      pixQrcodeUrl = paymentData.pix?.qr_code_url || paymentData.data?.pix?.qr_code_url;
      if (!pixCode && !pixQrcodeUrl) {
        console.error('RevantPay response missing PIX fields:', JSON.stringify(paymentData));
        await recordPaymentEvent(supabase, {
          bot_id: botId,
          plan_id: planId,
          telegram_user_id: telegramUserId,
          event_type: 'revantpay_error',
          external_status: paymentResponse.status,
          success: false,
          error_message: 'Cobranca criada sem campos PIX',
        });
        throw new Error('RevantPay criou a cobrança, mas não retornou o PIX');
      }
      await recordPaymentEvent(supabase, {
        bot_id: botId,
        plan_id: planId,
        telegram_user_id: telegramUserId,
        event_type: 'revantpay_success',
        external_status: paymentResponse.status,
        success: true,
        metadata: { charge_id: chargeId, has_qr: Boolean(pixQrcodeUrl) },
      });
    } else {
      const errorText = preReadErrorText ?? await paymentResponse.text();
      console.error('RevantPay error:', paymentResponse.status, errorText);
      let upstream = errorText;
      try { upstream = JSON.parse(errorText).error || errorText; } catch (_) { /* ignore */ }
      await recordPaymentEvent(supabase, {
        bot_id: botId,
        plan_id: planId,
        telegram_user_id: telegramUserId,
        event_type: 'revantpay_error',
        external_status: paymentResponse.status,
        success: false,
        error_message: String(upstream).slice(0, 500),
      });
      // Surface the actual upstream message so the seller can fix their gateway config.
      throw new Error(`RevantPay (${paymentResponse.status}): ${upstream}`);
    }

    // Create order in database
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const { data: order, error: orderError } = await supabase
      .from('payment_orders')
      .insert({
        id: orderId,
        bot_id: botId,
        plan_id: planId,
        telegram_user_id: telegramUserId,
        telegram_username: telegramUsername,
        telegram_first_name: telegramFirstName,
        amount: totalAmount,
        platform_fee: platformFee,
        external_id: chargeId,
        pix_code: pixCode,
        pix_qrcode_url: pixQrcodeUrl,
        customer_name: finalCustomerName ?? null,
        customer_email: finalCustomerEmail ?? null,
        customer_cpf: hasCpf ? cleanCpf : null,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      await recordPaymentEvent(supabase, {
        bot_id: botId,
        plan_id: planId,
        telegram_user_id: telegramUserId,
        event_type: 'order_error',
        success: false,
        error_message: orderError.message,
      });
      throw new Error('Failed to create order');
    }

    await recordPaymentEvent(supabase, {
      bot_id: botId,
      order_id: order.id,
      plan_id: planId,
      telegram_user_id: telegramUserId,
      event_type: 'order_created',
      success: true,
      metadata: { amount: totalAmount, external_id: chargeId },
    });

    await recordPaymentEvent(supabase, {
      bot_id: botId,
      order_id: order.id,
      plan_id: planId,
      telegram_user_id: telegramUserId,
      event_type: 'pix_generated',
      success: true,
      metadata: { has_pix_code: Boolean(pixCode), has_qr: Boolean(pixQrcodeUrl) },
    });

    try {
      const linkWindow = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      await supabase
        .from('telegram_payment_events')
        .update({ order_id: order.id })
        .eq('bot_id', botId)
        .eq('telegram_user_id', Number(telegramUserId))
        .is('order_id', null)
        .gte('created_at', linkWindow);
    } catch (err) {
      console.error('[AUDIT] failed to link pre-order events', err);
    }

    return new Response(JSON.stringify({
      success: true,
      order_id: order.id,
      charge_id: chargeId,
      pix_code: pixCode,
      pix_qrcode_url: pixQrcodeUrl,
      amount: totalAmount,
      platform_fee: platformFee,
      expires_at: expiresAt.toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error creating payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
