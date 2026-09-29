import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { firePushcut, checkGatewayInstability } from "../_shared/pushcut.ts";

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

function isRepeatedDigits(value: string) {
  return /^(\d)\1+$/.test(value);
}

function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || isRepeatedDigits(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  return digit === Number(cpf[10]);
}

function normalizeCustomerDocument(value: unknown) {
  const digits = onlyDigits(value);
  if (digits.length === 11 && isValidCpf(digits)) return digits;
  if (digits.length === 14 && !isRepeatedDigits(digits)) return digits;
  return null;
}

function customerName(firstName: string, userId: number) {
  return (firstName || '').trim() || `Cliente Telegram ${userId}`;
}

function customerEmail(userId: number) {
  return `tg${userId}@bot.local`;
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

function markdownText(value: unknown) {
  return String(value || '').replace(/([_*`\[])/g, '\\$1');
}

// ---- Robustness helpers (PIX delivery) ----

/** fetch with an explicit abort timeout so a stalled upstream never hangs the handler. */
async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Run work after the HTTP response is sent, so Telegram never times out the webhook. */
function background(task: Promise<unknown>) {
  const guarded = Promise.resolve(task).catch((err) => {
    console.error('[PIX] background task failed:', err instanceof Error ? err.message : String(err));
  });
  try {
    (globalThis as any).EdgeRuntime?.waitUntil?.(guarded);
  } catch (_) { /* not available locally */ }
}

/** Upstream errors that are transient (gateway relay, rate limit, locked login) and worth retrying. */
function isTransientGatewayFailure(status: number, body: string) {
  if (status === 408 || status === 425 || status === 429 || status >= 500) return true;
  return /429|too many|temporarily locked|timeout|timed out|relay|try again|unavailable|econn|failed to fetch/i.test(body || '');
}

/** Create the PIX charge with retries and automatic fallback to an alternate API key. */
async function createPixCharge(
  endpoint: string,
  apiKeys: string[],
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<{ status: number; raw: string; contentType: string; keyIndex: number; attempts: number }> {
  const keys = apiKeys.filter(Boolean).filter((k, i, a) => a.indexOf(k) === i);
  let last = { status: 0, raw: 'sem resposta do gateway', contentType: '', keyIndex: 0, attempts: 0 };
  let attempts = 0;
  // Stable per-charge key so a retry never creates a duplicate charge upstream.
  const idemBase = idempotencyKey || crypto.randomUUID();
  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    for (let attempt = 0; attempt < 3; attempt++) {
      attempts++;
      try {
        const res = await fetchWithTimeout(endpoint, {
          method: 'POST',
          headers: {
            'x-api-key': keys[keyIndex],
            'Content-Type': 'application/json',
            'Idempotency-Key': `${idemBase}-${keyIndex}`,
          },
          body: JSON.stringify(body),
        }, 12000);
        const raw = await res.text();
        const contentType = res.headers.get('content-type') || '';
        last = { status: res.status, raw, contentType, keyIndex, attempts };
        if (res.ok && contentType.includes('json') && !raw.trim().startsWith('<')) return last;
        if (!isTransientGatewayFailure(res.status, raw)) break; // permanent error: try next key
        console.warn(`[PIX] gateway transient (${res.status}) attempt ${attempt + 1}/3 key ${keyIndex + 1}`);
      } catch (err) {
        last = { status: 0, raw: err instanceof Error ? err.message : String(err), contentType: '', keyIndex, attempts };
      }
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return last;
}

/** In-memory dedupe of Telegram update_id (Telegram re-delivers when it thinks we failed). */
const seenUpdates = new Map<number, number>();
function isDuplicateUpdate(updateId: unknown) {
  if (typeof updateId !== 'number') return false;
  const now = Date.now();
  for (const [id, ts] of seenUpdates) {
    if (now - ts > 5 * 60 * 1000) seenUpdates.delete(id);
  }
  if (seenUpdates.has(updateId)) return true;
  seenUpdates.set(updateId, now);
  return false;
}

function buildPendingPaymentContext(plan: any, isDownsell: boolean, sourceType: string) {
  return {
    plan: {
      id: plan.id,
      name: plan.name,
      price: Number(plan.price),
      upsell_offer_id: plan.upsell_offer_id ?? null,
      duration: plan.duration ?? null,
      duration_days: plan.duration_days ?? null,
    },
    isDownsell,
    sourceType,
    requested_at: new Date().toISOString(),
  };
}

function shortError(value: unknown) {
  if (!value) return null;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.slice(0, 500);
}

async function recordPaymentEvent(
  supabase: any,
  payload: {
    bot_id: string;
    telegram_user_id: number;
    event_type: string;
    order_id?: string | null;
    plan_id?: string | null;
    source_type?: string | null;
    external_status?: number | null;
    success?: boolean | null;
    error_message?: unknown;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    const { error } = await supabase.from('telegram_payment_events').insert({
      bot_id: payload.bot_id,
      order_id: payload.order_id ?? null,
      plan_id: payload.plan_id ?? null,
      telegram_user_id: payload.telegram_user_id,
      event_type: payload.event_type,
      source_type: payload.source_type ?? null,
      external_status: payload.external_status ?? null,
      success: payload.success ?? null,
      error_message: shortError(payload.error_message),
      metadata: payload.metadata ?? {},
    });
    if (error) console.error('[PIX_AUDIT] insert failed:', error.message);
  } catch (err) {
    console.error('[PIX_AUDIT] threw:', err instanceof Error ? err.message : String(err));
  }

  // Fire seller webhooks (PushCut) for relevant PIX events
  try {
    const failureEvents = [
      'revantpay_failed',
      'revantpay_invalid_json',
      'revantpay_missing_pix_fields',
      'order_insert_failed',
      'gateway_key_missing',
      'minimum_amount_failed',
    ];
    if (payload.event_type === 'pix_generated') {
      await firePushcut(supabase, {
        event: 'transaction_created',
        botId: payload.bot_id,
        title: 'PIX gerado',
        text: `Nova cobrança PIX gerada${payload.metadata?.amount ? ` de R$ ${payload.metadata.amount}` : ''}.`,
        meta: { bot_id: payload.bot_id, order_id: payload.order_id ?? null },
      });
    } else if (failureEvents.includes(payload.event_type)) {
      await firePushcut(supabase, {
        event: 'pix_error',
        botId: payload.bot_id,
        title: 'Erro ao gerar PIX',
        text: shortError(payload.error_message) || `Falha na geração do PIX (${payload.event_type}).`,
        meta: { bot_id: payload.bot_id, event: payload.event_type },
      });
      await checkGatewayInstability(supabase, payload.bot_id, 'Bot');
    }
  } catch (err) {
    console.error('[PUSHCUT] dispatch failed:', err instanceof Error ? err.message : String(err));
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const botToken = url.searchParams.get('token');
    
    if (!botToken) {
      console.error('No bot token provided');
      return new Response(JSON.stringify({ error: 'No bot token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('*, subscription_plans(*)')
      .eq('token', botToken)
      .maybeSingle();

    if (botError || !bot) {
      console.log('Bot not found for token, ignoring webhook');
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const update = await req.json();
    console.log('Received update:', JSON.stringify(update));

    if (isDuplicateUpdate(update?.update_id)) {
      console.log(`[TG] duplicate update_id=${update.update_id} ignored`);
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || '';
      const userId = update.message.from.id;
      const username = update.message.from.username || '';
      const firstName = update.message.from.first_name || '';

      // Check blacklist
      const { data: blacklisted } = await supabase
        .from('blacklisted_users')
        .select('id')
        .eq('bot_id', bot.id)
        .eq('telegram_user_id', userId)
        .maybeSingle();

      if (blacklisted) {
        console.log(`User ${userId} is blacklisted, ignoring`);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const command = text.trim().split(/[\s@]/)[0].toLowerCase();
      const isCommand = command.startsWith('/');

      if (text && !isCommand) {
        const { data: pendingUser } = await supabase
          .from('bot_users')
          .select('pending_payment_context')
          .eq('bot_id', bot.id)
          .eq('telegram_user_id', userId)
          .maybeSingle();

        const pendingContext = pendingUser?.pending_payment_context as any;
        if (pendingContext?.plan) {
          const document = normalizeCustomerDocument(text);
          if (!document) {
            await sendMessage(botToken, chatId, 'CPF inválido. Envie apenas um CPF válido para gerar o PIX.', undefined, undefined, bot.anti_clone || false);
            return new Response(JSON.stringify({ ok: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          await supabase
            .from('bot_users')
            .update({
              customer_cpf: document,
              customer_name: customerName(firstName, userId),
              pending_payment_context: null,
              telegram_username: username,
              telegram_first_name: firstName,
              last_interaction_at: new Date().toISOString(),
            })
            .eq('bot_id', bot.id)
            .eq('telegram_user_id', userId);

          background(generatePayment(botToken, chatId, bot, pendingContext.plan, userId, username, firstName, supabase, supabaseUrl, Boolean(pendingContext.isDownsell), pendingContext.sourceType || 'direct'));
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Handle /suporte command
      if (command === '/suporte') {
        const supportContact = bot.support_contact;
        if (supportContact) {
          const supportUsername = supportContact.replace('@', '');
          const keyboard = {
            inline_keyboard: [
              [{ text: '💬 Falar com Suporte', url: `https://t.me/${supportUsername}` }]
            ]
          };
          await sendMessage(botToken, chatId, '📞 *Suporte*\n\nClique no botão abaixo para falar com nosso suporte:', 'Markdown', keyboard);
        } else {
          await sendMessage(botToken, chatId, '❌ Suporte não configurado. Entre em contato com o administrador.', undefined);
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (command === '/ajuda') {
        await sendMessage(
          botToken,
          chatId,
          'ℹ️ *Como funciona*\n\n1️⃣ Escolha um plano em /planos\n2️⃣ Pague o PIX gerado na hora (copia e cola)\n3️⃣ O acesso é liberado automaticamente após o pagamento\n\nJá pagou e não recebeu? Use /pix e toque em "Já paguei".',
          'Markdown',
        );
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (command === '/vip') {
        const { data: vip } = await supabase
          .from('vip_members')
          .select('expires_at, subscription_plans(name)')
          .eq('bot_id', bot.id)
          .eq('telegram_user_id', userId)
          .eq('is_active', true)
          .gte('expires_at', new Date().toISOString())
          .maybeSingle();

        if (vip) {
          const exp = new Date(vip.expires_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
          await sendMessage(botToken, chatId, `✅ *Acesso VIP ativo*\n\nPlano: ${(vip as any).subscription_plans?.name || 'VIP'}\nVálido até: ${exp}`, 'Markdown');
        } else {
          await sendMessage(botToken, chatId, '❌ Você ainda não tem acesso VIP ativo. Envie /planos para assinar.');
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (command === '/pix') {
        const { data: lastOrder } = await supabase
          .from('payment_orders')
          .select('id, amount, pix_code, status')
          .eq('bot_id', bot.id)
          .eq('telegram_user_id', userId)
          .eq('status', 'pending')
          .not('pix_code', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastOrder?.pix_code) {
          await sendMessageDetailed(
            botToken,
            chatId,
            `💠 <b>Seu PIX de R$ ${Number(lastOrder.amount).toFixed(2)}</b>\n\nToque no código abaixo para copiar:\n\n<code>${lastOrder.pix_code}</code>`,
            'HTML',
            { inline_keyboard: [[{ text: '✅ Já paguei', callback_data: `check_payment_${lastOrder.id}` }]] },
            false,
          );
        } else {
          await sendMessage(botToken, chatId, 'Você não tem nenhum PIX pendente. Envie /planos para escolher um plano.');
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (command === '/planos') {
        background(ensureBotCommands(botToken, bot.id));
        await sendStartMessage(botToken, chatId, bot, supabase, userId, { skipVipCheck: true });
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (command === '/start') {
        background(ensureBotCommands(botToken, bot.id));
        // Extract deep link parameter (e.g., /start link_UUID)
        const startParam = text.split(' ')[1] || '';
        let trackedLinkId: string | null = null;

        if (startParam.startsWith('link_')) {
          trackedLinkId = startParam.replace('link_', '');
          console.log(`User ${userId} came from tracked link: ${trackedLinkId}`);
        }

        // Handle cross-bot upsell: /start crossupsell_{order_id}
        let isCrossUpsell = false;
        let crossUpsellOrderId: string | null = null;
        if (startParam.startsWith('crossupsell_')) {
          crossUpsellOrderId = startParam.replace('crossupsell_', '');
          console.log(`User ${userId} came from cross-bot upsell, order: ${crossUpsellOrderId}`);

          // Verify the original order belongs to the same owner
          const { data: originalOrder } = await supabase
            .from('payment_orders')
            .select('bot_id, bots(user_id)')
            .eq('id', crossUpsellOrderId)
            .eq('status', 'paid')
            .single();

          if (originalOrder && (originalOrder as any).bots?.user_id === bot.user_id) {
            isCrossUpsell = true;
            console.log(`Cross-bot upsell verified for user ${userId}`);
          } else {
            console.log('Cross-bot upsell verification failed');
            crossUpsellOrderId = null;
          }
        }

        const upsertData: any = {
          bot_id: bot.id,
          telegram_user_id: userId,
          telegram_username: username,
          telegram_first_name: firstName,
          last_interaction_at: new Date().toISOString(),
        };

        // Only set tracked_link_id if user came from a tracked link
        // Don't overwrite existing attribution on subsequent /start commands
        if (trackedLinkId) {
          const { data: existingUser } = await supabase
            .from('bot_users')
            .select('tracked_link_id')
            .eq('bot_id', bot.id)
            .eq('telegram_user_id', userId)
            .single();

          if (!existingUser?.tracked_link_id) {
            upsertData.tracked_link_id = trackedLinkId;
          }
        }

        await supabase.from('bot_users').upsert(upsertData, { onConflict: 'bot_id,telegram_user_id', ignoreDuplicates: false });

        // If cross-bot upsell, go straight to plans with upsell source
        if (isCrossUpsell && crossUpsellOrderId) {
          // Store the cross upsell info in a temporary way via the bot_users table
          // The generatePayment function will use source_type='upsell' and original_bot_id
          await supabase.from('bot_users').update({
            cross_upsell_from_order_id: crossUpsellOrderId,
          }).eq('bot_id', bot.id).eq('telegram_user_id', userId);
          
          await sendStartMessage(botToken, chatId, bot, supabase, userId);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // NOTE: VIP/delivery links are ONLY sent after payment confirmation via payment-webhook
        // Do NOT send vip_link or group links here on /start

        await sendStartMessage(botToken, chatId, bot, supabase, userId);
      }
    }

    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const userId = callbackQuery.from.id;
      const username = callbackQuery.from.username || '';
      const firstName = callbackQuery.from.first_name || '';
      const data = callbackQuery.data;

      // Check blacklist for callback queries too
      const { data: blacklistedCb } = await supabase
        .from('blacklisted_users')
        .select('id')
        .eq('bot_id', bot.id)
        .eq('telegram_user_id', userId)
        .maybeSingle();

      if (blacklistedCb) {
        console.log(`User ${userId} is blacklisted, ignoring callback`);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQuery.id }),
      });

      await supabase.from('bot_users').upsert({
        bot_id: bot.id,
        telegram_user_id: userId,
        telegram_username: username,
        telegram_first_name: firstName,
        has_clicked_button: true,
        last_interaction_at: new Date().toISOString(),
      }, { onConflict: 'bot_id,telegram_user_id', ignoreDuplicates: false });

      // Track A/B test click event
      if (data.startsWith('plan_') || data.startsWith('mailing_plan_') || data.startsWith('mp_')) {
        const { data: activeAbTest } = await supabase
          .from('ab_tests')
          .select('id')
          .eq('bot_id', bot.id)
          .eq('is_active', true)
          .maybeSingle();
        if (activeAbTest) {
          const abVariant = userId % 2 === 0 ? 'a' : 'b';
          await supabase.from('ab_test_events').insert({
            ab_test_id: activeAbTest.id,
            variant: abVariant,
            telegram_user_id: userId,
            event_type: 'click',
          });
        }
      }

      if (data.startsWith('plan_')) {
        const planId = data.replace('plan_', '');
        let plan = bot.subscription_plans?.find((p: any) => p.id === planId);
        // Apply A/B test overrides at purchase time so price/bump match what the user saw
        if (plan) {
          const { data: activeAb } = await supabase
            .from('ab_tests')
            .select('*')
            .eq('bot_id', bot.id)
            .eq('is_active', true)
            .maybeSingle();
          if (activeAb) {
            const v = userId % 2 === 0 ? 'a' : 'b';
            const vPlanId = v === 'a' ? activeAb.variant_a_plan_id : activeAb.variant_b_plan_id;
            const vBumpId = v === 'a' ? activeAb.variant_a_bump_plan_id : activeAb.variant_b_bump_plan_id;
            const vPrice = v === 'a' ? activeAb.variant_a_price_override : activeAb.variant_b_price_override;
            if (!vPlanId || vPlanId === plan.id) {
              plan = { ...plan };
              if (vPrice != null && !isNaN(Number(vPrice))) plan.price = Number(vPrice);
              if (vBumpId) {
                const bumpPlan = bot.subscription_plans?.find((bp: any) => bp.id === vBumpId);
                if (bumpPlan) {
                  plan.order_bump_enabled = true;
                  plan.order_bump_name = bumpPlan.order_bump_name || bumpPlan.name;
                  plan.order_bump_price = bumpPlan.order_bump_price ?? bumpPlan.price;
                  plan.order_bump_media_url = bumpPlan.order_bump_media_url;
                  plan.order_bump_media_type = bumpPlan.order_bump_media_type;
                  plan.order_bump_description = bumpPlan.order_bump_description;
                }
              }
            }
          }
        }
        if (plan) {
          if (plan.order_bump_enabled && plan.order_bump_name && plan.order_bump_price) {
            try {
              await showOrderBumpOffer(botToken, chatId, bot, plan, userId, username, firstName, supabase, supabaseUrl);
            } catch (err) {
              console.error('[BUMP] offer failed, falling back to direct payment:', err instanceof Error ? err.message : String(err));
              background(generatePayment(botToken, chatId, bot, plan, userId, username, firstName, supabase, supabaseUrl, false, 'direct'));
            }
          } else {
            background(generatePayment(botToken, chatId, bot, plan, userId, username, firstName, supabase, supabaseUrl, false, 'direct'));
          }
        }
      }

      // Mailing-originated plan clicks.
      // Legacy: mailing_plan_{planId}_{mailingId} (over Telegram's 64-byte cap, kept for old messages)
      // Compact: mp_{plan uuid w/o dashes}_{first 8 hex of mailing id}
      if (data.startsWith('mailing_plan_') || data.startsWith('mp_')) {
        let planId: string | undefined;
        let mailingId: string | undefined;
        if (data.startsWith('mp_')) {
          const [rawPlan, mailingPrefix] = data.slice(3).split('_');
          planId = rawPlan?.length === 32
            ? `${rawPlan.slice(0, 8)}-${rawPlan.slice(8, 12)}-${rawPlan.slice(12, 16)}-${rawPlan.slice(16, 20)}-${rawPlan.slice(20)}`
            : rawPlan;
          if (mailingPrefix) {
            const { data: mailings } = await supabase
              .from('mailing_messages')
              .select('id')
              .eq('bot_id', bot.id);
            mailingId = (mailings || []).find((m: any) => String(m.id).replace(/-/g, '').startsWith(mailingPrefix))?.id;
          }
        } else {
          const parts = data.replace('mailing_plan_', '').split('_');
          planId = parts[0];
          mailingId = parts[1];
        }
        let plan = bot.subscription_plans?.find((p: any) => p.id === planId);
        // Apply mailing custom price/label overrides if defined
        if (plan && mailingId) {
          try {
            const { data: mailing } = await supabase
              .from('mailing_messages')
              .select('buttons')
              .eq('id', mailingId)
              .maybeSingle();
            const btn = (mailing?.buttons || []).find((b: any) => b.plan_id === planId);
            if (btn) {
              plan = { ...plan };
              if (typeof btn.custom_price === 'number' && !isNaN(btn.custom_price)) {
                plan.price = btn.custom_price;
                // Disable order bump when price is overridden by mailing
                plan.order_bump_enabled = false;
              }
              if (btn.custom_label) {
                plan.name = btn.custom_label;
              }
            }
          } catch (e) {
            console.error('[MAILING] Failed to load mailing overrides', e);
          }
        }
        if (plan) {
          if (plan.order_bump_enabled && plan.order_bump_name && plan.order_bump_price) {
            try {
              await showOrderBumpOffer(botToken, chatId, bot, plan, userId, username, firstName, supabase, supabaseUrl, 'mailing');
            } catch (err) {
              console.error('[BUMP] mailing offer failed, falling back to direct payment:', err instanceof Error ? err.message : String(err));
              background(generatePayment(botToken, chatId, bot, plan, userId, username, firstName, supabase, supabaseUrl, false, 'mailing'));
            }
          } else {
            background(generatePayment(botToken, chatId, bot, plan, userId, username, firstName, supabase, supabaseUrl, false, 'mailing'));
          }
        }
      }

      if (data.startsWith('orderbump_yes_')) {
        const parts = data.replace('orderbump_yes_', '').split('_');
        const planId = parts[0];
        const sourceFromBump = parts[1] || 'order_bump';
        const plan = bot.subscription_plans?.find((p: any) => p.id === planId);
        if (plan) {
          const bumpedPlan = {
            ...plan,
            price: Number(plan.price) + Number(plan.order_bump_price),
            name: `${plan.name} + ${plan.order_bump_name}`
          };
          background(generatePayment(botToken, chatId, bot, bumpedPlan, userId, username, firstName, supabase, supabaseUrl, false, sourceFromBump === 'mailing' ? 'mailing' : 'order_bump'));
        }
      }

      if (data.startsWith('orderbump_no_')) {
        const parts = data.replace('orderbump_no_', '').split('_');
        const planId = parts[0];
        const sourceFromBump = parts[1] || 'direct';
        const plan = bot.subscription_plans?.find((p: any) => p.id === planId);
        if (plan) {
          background(generatePayment(botToken, chatId, bot, plan, userId, username, firstName, supabase, supabaseUrl, false, sourceFromBump === 'mailing' ? 'mailing' : 'direct'));
        }
      }

      if (data.startsWith('downsell_')) {
        const parts = data.replace('downsell_', '').split('_');
        const planId = parts[0];
        const discountPercentage = parseInt(parts[1]) || 0;
        const plan = bot.subscription_plans?.find((p: any) => p.id === planId);
        if (plan) {
          const discountedPlan = {
            ...plan,
            price: Number(plan.price) * (1 - discountPercentage / 100),
            name: `${plan.name} (${discountPercentage}% OFF)`
          };
          background(generatePayment(botToken, chatId, bot, discountedPlan, userId, username, firstName, supabase, supabaseUrl, true, 'downsell'));
        }
      }

      // Upsell callback: upsell_{offer_id}
      if (data.startsWith('upsell_')) {
        const offerId = data.replace('upsell_', '');
        const { data: offer, error: offerError } = await supabase
          .from('upsell_offers')
          .select('*')
          .eq('id', offerId)
          .eq('bot_id', bot.id)
          .eq('is_active', true)
          .maybeSingle();
        if (offerError) {
          console.error('Error loading upsell offer:', offerError);
        }
        if (offer) {
          const upsellPlan = {
            id: offer.id,
            name: offer.name,
            price: Number(offer.price),
            upsell_offer_id: offer.id,
          };
          background(generatePayment(botToken, chatId, bot, upsellPlan, userId, username, firstName, supabase, supabaseUrl, false, 'upsell'));
        } else {
          await sendMessage(botToken, chatId, '❌ Esta oferta não está mais disponível.', undefined, undefined, bot.anti_clone || false);
        }
      }

      if (data.startsWith('check_payment_')) {
        const orderId = data.replace('check_payment_', '');
        await checkPaymentStatus(botToken, chatId, orderId, supabase, bot);
      }

      // Upsell decline: resend the delivery link so the buyer never gets stuck.
      if (data.startsWith('skip_upsell_')) {
        const orderId = data.replace('skip_upsell_', '');
        const { data: order } = await supabase
          .from('payment_orders')
          .select('*, subscription_plans(name), upsell_offers(name)')
          .eq('id', orderId)
          .maybeSingle();

        let deliveryLink: string | null = null;
        let isUnique = false;
        if (bot.vip_id) {
          try {
            const invResp = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: bot.vip_id, member_limit: 1, name: `VIP ${Date.now()}` }),
            });
            const invData = await invResp.json();
            if (invData.ok && invData.result?.invite_link) {
              deliveryLink = invData.result.invite_link;
              isUnique = true;
            }
          } catch (e) {
            console.error('skip_upsell invite link error:', e);
          }
        }
        if (!deliveryLink && bot.vip_link) deliveryLink = bot.vip_link;

        const planName = order?.subscription_plans?.name || order?.upsell_offers?.name || 'VIP';
        const deliverySection = deliveryLink
          ? `\n\n🔗 *Acesse o grupo VIP:*\n${deliveryLink}\n\n${isUnique ? '⚠️ _Este link é pessoal, intransferível e de uso único._' : '_Este link é pessoal e intransferível._'}`
          : '\n\n_Entre em contato com o suporte para receber o acesso._';

        const text = `✅ *Seu acesso está liberado!*\n\n📦 Plano: *${planName}*${deliverySection}`;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
          }),
        });
      }

      if (data === 'back_to_start') {
        await sendStartMessage(botToken, chatId, bot, supabase, userId);
      }

      if (data === 'buy_another') {
        await sendStartMessage(botToken, chatId, bot, supabase, userId, { skipVipCheck: true });
      }
    }

    // Handle chat join requests for auto-approval
    if (update.chat_join_request) {
      const request = update.chat_join_request;
      const chatId = request.chat.id;
      const userId = request.from.id;
      const firstName = request.from.first_name || '';

      if (bot.auto_approve_enabled && bot.auto_approve_channel_id) {
        const approveChannelId = String(bot.auto_approve_channel_id);
        const requestChatId = String(chatId);

        if (approveChannelId === requestChatId) {
          try {
            await fetch(`https://api.telegram.org/bot${botToken}/approveChatJoinRequest`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, user_id: userId }),
            });
            console.log(`Auto-approved user ${userId} in chat ${chatId}`);

            if (bot.auto_approve_welcome_message) {
              const welcomeMsg = bot.auto_approve_welcome_message
                .replace('{name}', firstName)
                .replace('{first_name}', firstName);
              try {
                await sendMessage(botToken, userId, welcomeMsg, 'Markdown');
              } catch (e) {
                console.error('Could not send welcome DM:', e);
              }
            }
          } catch (err) {
            console.error('Error approving join request:', err);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
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

const BOT_COMMANDS = [
  { command: 'start', description: '🚀 Ver ofertas e planos' },
  { command: 'planos', description: '💎 Ver todos os planos disponíveis' },
  { command: 'pix', description: '📲 Reenviar meu código PIX' },
  { command: 'vip', description: '✅ Consultar meu acesso VIP' },
  { command: 'suporte', description: '💬 Falar com o suporte' },
  { command: 'ajuda', description: 'ℹ️ Como funciona' },
];

const commandsSyncedBots = new Set<string>();

async function ensureBotCommands(botToken: string, botId: string) {
  if (commandsSyncedBots.has(botId)) return;
  commandsSyncedBots.add(botId);
  try {
    await fetchWithTimeout(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: BOT_COMMANDS }),
    }, 8000);
  } catch (err) {
    console.error('[TG] setMyCommands failed', err);
  }
}

/**
 * Sends the initial media with the plans keyboard.
 * Reliability rules (a silent failure here means the lead never sees any button):
 *  - reuse the cached Telegram file_id (way faster + immune to URL fetch failures)
 *  - retry once respecting 429 retry_after
 *  - if media keeps failing, ALWAYS fall back to a text message with the same keyboard
 */
async function sendStartMedia(
  botToken: string, chatId: number, bot: any, supabase: any,
  mediaUrl: string, mediaType: string, caption: string, keyboard: any, protect: boolean,
): Promise<{ ok: boolean; via: string; error?: string }> {
  const method = mediaType === 'video' ? 'sendVideo' : mediaType === 'audio' ? 'sendAudio' : 'sendPhoto';
  const field = mediaType === 'video' ? 'video' : mediaType === 'audio' ? 'audio' : 'photo';
  const cachedId = bot.initial_media_file_key === mediaUrl ? bot.initial_media_file_id : null;

  const attempt = async (source: string) => {
    const res = await fetchWithTimeout(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        [field]: source,
        caption,
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        protect_content: protect || undefined,
      }),
    }, 20000);
    const body = await res.json().catch(() => null);
    return { ok: Boolean(body?.ok), body, status: res.status };
  };

  const sources = cachedId ? [cachedId, mediaUrl] : [mediaUrl];
  let lastError = '';

  for (const source of sources) {
    for (let i = 0; i < 2; i++) {
      try {
        const r = await attempt(source);
        if (r.ok) {
          const result = r.body?.result || {};
          const fileId = result.video?.file_id
            || result.audio?.file_id
            || (Array.isArray(result.photo) ? result.photo[result.photo.length - 1]?.file_id : null);
          if (fileId && fileId !== cachedId) {
            await supabase.from('bots')
              .update({ initial_media_file_id: fileId, initial_media_file_key: mediaUrl })
              .eq('id', bot.id);
          }
          return { ok: true, via: source === cachedId ? 'file_id' : 'url' };
        }
        lastError = JSON.stringify(r.body).slice(0, 300);
        const retryAfter = r.body?.parameters?.retry_after;
        if (retryAfter && retryAfter <= 5) {
          await new Promise((res) => setTimeout(res, (retryAfter + 0.3) * 1000));
          continue;
        }
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  console.error('[START] media send failed, falling back to text:', lastError);
  const fallback = await sendMessageDetailed(botToken, chatId, caption, 'Markdown', keyboard, protect);
  return { ok: fallback.ok, via: 'text_fallback', error: lastError };
}

async function sendStartMessage(botToken: string, chatId: number, bot: any, supabase: any, userId: number, opts: { skipVipCheck?: boolean } = {}) {
  try {
    await sendStartMessageInner(botToken, chatId, bot, supabase, userId, opts);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[START] failed:', detail);
    await firePushcut(supabase, {
      event: 'bot_start_error',
      userId: bot?.user_id ?? null,
      botId: bot?.id ?? null,
      title: 'Erro no start do bot',
      text: `Falha ao responder /start no bot @${bot?.username ?? '?'}: ${detail.slice(0, 200)}`,
      meta: { bot_id: bot?.id ?? null, telegram_user_id: userId },
    });
    throw err;
  }
}

async function sendStartMessageInner(botToken: string, chatId: number, bot: any, supabase: any, userId: number, opts: { skipVipCheck?: boolean } = {}) {
  // Check if user is already VIP (unless explicitly skipped, e.g. buying another plan)
  const { data: member } = opts.skipVipCheck ? { data: null } : await supabase
    .from('vip_members')
    .select('*, subscription_plans(*)')
    .eq('bot_id', bot.id)
    .eq('telegram_user_id', userId)
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString())
    .single();

  if (member) {
    const expiresAt = new Date(member.expires_at);
    
    // Generate a unique invite link for existing VIP members too
    let vipAccessText = '';
    if (bot.vip_id) {
      try {
        const inviteResp = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: bot.vip_id, member_limit: 1, name: `VIP ${Date.now()}` }),
        });
        const inviteData = await inviteResp.json();
        if (inviteData.ok && inviteData.result?.invite_link) {
          vipAccessText = `\n\n🔗 Acesse o grupo: ${inviteData.result.invite_link}\n⚠️ _Link de uso único_`;
        }
      } catch (e) {
        console.error('Error generating unique link for VIP member:', e);
      }
    }
    
    const vipMessage = `🌟 *Você já é VIP!*\n\n` +
      `📦 Plano: ${member.subscription_plans?.name || 'VIP'}\n` +
      `📅 Válido até: ${expiresAt.toLocaleDateString('pt-BR')}` +
      vipAccessText;

    const renewCallback = member.plan_id ? `plan_${member.plan_id}` : 'buy_another';
    const keyboard = {
      inline_keyboard: [
        [{ text: '🔄 Renovar Assinatura', callback_data: renewCallback }],
        [{ text: '🛒 Comprar outro plano', callback_data: 'buy_another' }],
      ]
    };

    const protect = bot.anti_clone || false;
    if (bot.initial_media_url && bot.initial_media_type) {
      const mediaMethod = bot.initial_media_type === 'video' ? 'sendVideo' : 'sendPhoto';
      const mediaField = bot.initial_media_type === 'video' ? 'video' : 'photo';
      await fetch(`https://api.telegram.org/bot${botToken}/${mediaMethod}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          [mediaField]: bot.initial_media_url,
          caption: vipMessage,
          parse_mode: 'Markdown',
          reply_markup: keyboard,
          protect_content: protect || undefined,
        }),
      });
    } else {
      await sendMessage(botToken, chatId, vipMessage, 'Markdown', keyboard, protect);
    }
    return;
  }

  // Check if VIP link is configured - if not, show setup instructions
  if (!bot.vip_link && !bot.vip_id) {
    const setupInstructions = `❌ *Erro: Link de VIP não configurado!*\n\n` +
      `Siga os passos abaixo para configurar rapidamente:\n\n` +
      `1️⃣ Adicione o bot @${bot.username} ao seu grupo ou canal VIP com todas as permissões.\n\n` +
      `2️⃣ Obtenha o ID do seu grupo ou canal usando @ScanIDBot:\n` +
      `• Para canais: encaminhe qualquer mensagem do canal para @ScanIDBot e receba o ID.\n` +
      `• Para grupos: adicione @ScanIDBot como administrador; ele enviará o ID automaticamente.\n\n` +
      `3️⃣ Acesse o nosso painel de controle e insira o ID do VIP no campo correspondente.\n\n` +
      `4️⃣ Se o link não funcionar mesmo após configurar:\n` +
      `• Insira um número aleatório no campo do ID, salve, depois coloque o ID correto novamente.\n\n` +
      `5️⃣ Dicas rápidas:\n` +
      `• IDs geralmente começam com -100.\n` +
      `• Para grupos, deixe o histórico visível.\n` +
      `• Repita o processo para outros canais ou grupos se necessário.\n\n` +
      `Após seguir esses passos, o link VIP será gerado automaticamente.`;

    // The lead must never see the seller's setup tutorial — send a neutral notice
    // to the customer and route the real instructions to the seller's channel.
    await sendMessage(
      botToken,
      chatId,
      '⏳ Estamos finalizando alguns ajustes por aqui. Volte em alguns minutos e envie /start novamente.',
    );

    const sellerChannel = bot.notification_channel_id || bot.registro_id;
    if (sellerChannel) {
      await sendMessageToChat(
        botToken,
        sellerChannel,
        `⚠️ *Seu bot @${bot.username} está perdendo vendas!*\n\n${setupInstructions}`,
      );
    }
    return;
  }

  if (bot.welcome_card_enabled && bot.welcome_card_text) {
    const cardText = bot.welcome_card_text;
    const cardKeyboard = {
      inline_keyboard: [
        [{ text: '▶️ /start', callback_data: 'back_to_start' }]
      ]
    };
    await sendMessage(botToken, chatId, cardText, 'Markdown', cardKeyboard);
  }

  // Check for active A/B test
  const { data: abTest } = await supabase
    .from('ab_tests')
    .select('*')
    .eq('bot_id', bot.id)
    .eq('is_active', true)
    .maybeSingle();

  let initialMessage = bot.initial_message || `Bem-vindo ao ${bot.name}! 🎉`;
  let abVariant: string | null = null;

  if (abTest) {
    // Assign variant based on user ID (deterministic 50/50 split)
    abVariant = userId % 2 === 0 ? 'a' : 'b';
    initialMessage = abVariant === 'a' ? abTest.variant_a_message : abTest.variant_b_message;

    // Track the start event
    await supabase.from('ab_test_events').insert({
      ab_test_id: abTest.id,
      variant: abVariant,
      telegram_user_id: userId,
      event_type: 'start',
    });
  }

  let activePlans = (bot.subscription_plans?.filter((p: any) => p.is_active) || [])
    .sort((a: any, b: any) => (a.sort_order ?? 999999) - (b.sort_order ?? 999999));

  // A/B test: apply plan filter + price override + bump override per variant
  if (abTest && abVariant) {
    const vPlanId = abVariant === 'a' ? abTest.variant_a_plan_id : abTest.variant_b_plan_id;
    const vBumpId = abVariant === 'a' ? abTest.variant_a_bump_plan_id : abTest.variant_b_bump_plan_id;
    const vPrice = abVariant === 'a' ? abTest.variant_a_price_override : abTest.variant_b_price_override;
    if (vPlanId) {
      activePlans = activePlans.filter((p: any) => p.id === vPlanId);
    }
    activePlans = activePlans.map((p: any) => {
      const clone = { ...p };
      if (vPrice != null && !isNaN(Number(vPrice))) clone.price = Number(vPrice);
      if (vBumpId) {
        const bumpPlan = bot.subscription_plans?.find((bp: any) => bp.id === vBumpId);
        if (bumpPlan) {
          clone.order_bump_enabled = true;
          clone.order_bump_name = bumpPlan.order_bump_name || bumpPlan.name;
          clone.order_bump_price = bumpPlan.order_bump_price ?? bumpPlan.price;
          clone.order_bump_media_url = bumpPlan.order_bump_media_url;
          clone.order_bump_media_type = bumpPlan.order_bump_media_type;
          clone.order_bump_description = bumpPlan.order_bump_description;
        }
      }
      return clone;
    });
  }

  const urlButtons = (bot.initial_buttons || []).filter((b: any) => b.text && b.url);
  
  const keyboard = {
    inline_keyboard: [
      ...activePlans.map((plan: any) => {
        const btn: any = {
          text: `${plan.name} - R$ ${Number(plan.price).toFixed(2)}`,
          callback_data: `plan_${plan.id}`
        };
        if (plan.button_style) btn.style = plan.button_style;
        return [btn];
      }),
      ...urlButtons.map((btn: any) => {
        const urlBtn: any = { text: btn.text, url: btn.url };
        if (btn.style) urlBtn.style = btn.style;
        return [urlBtn];
      })
    ]
  };

  const protect = bot.anti_clone || false;
  
  // Use A/B test media if available
  let mediaUrl = bot.initial_media_url;
  let mediaType = bot.initial_media_type;
  if (abTest && abVariant) {
    const testMediaUrl = abVariant === 'a' ? abTest.variant_a_media_url : abTest.variant_b_media_url;
    const testMediaType = abVariant === 'a' ? abTest.variant_a_media_type : abTest.variant_b_media_type;
    if (testMediaUrl) { mediaUrl = testMediaUrl; mediaType = testMediaType; }
  }
  
  if (activePlans.length === 0) {
    console.error(`[START] bot ${bot.username} has no active plans — lead sees no buttons`);
  }

  let delivered = false;
  let deliveryVia = 'text';
  let deliveryError: string | null = null;

  if (mediaUrl && mediaType) {
    const r = await sendStartMedia(botToken, chatId, bot, supabase, mediaUrl, mediaType, initialMessage, keyboard, protect);
    delivered = r.ok;
    deliveryVia = r.via;
    deliveryError = r.error ?? null;
  } else {
    const r = await sendMessageDetailed(botToken, chatId, initialMessage, 'Markdown', keyboard, protect);
    delivered = r.ok;
    deliveryError = r.ok ? null : JSON.stringify(r.error).slice(0, 300);
  }

  await recordPaymentEvent(supabase, {
    bot_id: bot.id,
    telegram_user_id: userId,
    event_type: delivered ? 'start_message_sent' : 'start_message_failed',
    source_type: 'telegram-webhook',
    success: delivered,
    error_message: deliveryError,
    metadata: { via: deliveryVia, plans: activePlans.length, chat_id: chatId },
  });
}

async function generatePayment(
  botToken: string, chatId: number, bot: any, plan: any,
  userId: number, username: string, firstName: string,
  supabase: any, supabaseUrl: string, isDownsell: boolean = false,
  sourceType: string = 'direct'
) {
  const protect = bot.anti_clone || false;
  let generationMessageId: number | null = null;
  const baseAudit = {
    bot_id: bot.id,
    telegram_user_id: userId,
    plan_id: plan.id ?? null,
    source_type: sourceType,
  };

  await recordPaymentEvent(supabase, {
    ...baseAudit,
    event_type: 'payment_started',
    success: true,
    metadata: {
      chat_id: chatId,
      plan_name: plan.name,
      amount: moneyAmount(plan.price),
      is_downsell: isDownsell,
    },
  });

  const { data: botUser } = await supabase
    .from('bot_users')
    .select('tracked_link_id, cross_upsell_from_order_id, customer_cpf, customer_name')
    .eq('bot_id', bot.id)
    .eq('telegram_user_id', userId)
    .maybeSingle();

  const customerDocument = normalizeCustomerDocument(botUser?.customer_cpf);
  const planPrice = moneyAmount(plan.price);
  const isUpsellPurchase = sourceType === 'upsell' || Boolean(plan.upsell_offer_id);
  // RevantPay/CartWave permite PIX anônimo até R$ 1.000. Só exige CPF acima disso.
  const requiresCpf = planPrice > 1000;
  if (!customerDocument && requiresCpf) {
    await supabase.from('bot_users').upsert({
      bot_id: bot.id,
      telegram_user_id: userId,
      telegram_username: username,
      telegram_first_name: firstName,
      pending_payment_context: buildPendingPaymentContext(plan, isDownsell, sourceType),
      last_interaction_at: new Date().toISOString(),
    }, { onConflict: 'bot_id,telegram_user_id', ignoreDuplicates: false });

    const cpfPromptOk = await sendMessage(
      botToken,
      chatId,
      `Para gerar seu PIX com segurança, envie seu CPF.\n\nPlano: ${markdownText(plan.name)}\nValor: R$ ${planPrice.toFixed(2)}`,
      undefined,
      undefined,
      protect,
    );
    await recordPaymentEvent(supabase, {
      ...baseAudit,
      event_type: 'cpf_required',
      success: cpfPromptOk,
      metadata: { amount: planPrice },
    });
    return;
  }

  const generationMessage = await sendMessageDetailed(
    botToken,
    chatId,
    '⏳ Gerando pagamento PIX...\n\nSe demorar alguns segundos, toque no plano novamente ou chame o suporte do vendedor.',
    undefined,
    undefined,
    protect,
  );
  generationMessageId = generationMessage.messageId;
  await recordPaymentEvent(supabase, {
    ...baseAudit,
    event_type: 'generation_notice_sent',
    external_status: generationMessage.status,
    success: generationMessage.ok,
    error_message: generationMessage.error,
  });

  // Get API key from bot owner's profile first, then per-bot gateway, then env var
  const revantPayKey = Deno.env.get('REVANTPAY_API_KEY');
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('revantpay_api_key, platform_fee_override')
    .eq('id', bot.user_id)
    .single();

  const { data: gateway } = await supabase
    .from('payment_gateways').select('token')
    .eq('bot_id', bot.id).eq('gateway_name', 'revantpay').eq('is_connected', true).limit(1).maybeSingle();

  const apiKeyCandidates = [ownerProfile?.revantpay_api_key, gateway?.token, revantPayKey].filter(Boolean) as string[];
  const apiKey = apiKeyCandidates[0];
  if (!apiKey) {
    await recordPaymentEvent(supabase, {
      ...baseAudit,
      event_type: 'gateway_key_missing',
      success: false,
    });
    await editTelegramMessage(botToken, chatId, generationMessageId, '❌ Gateway de pagamento não configurado. Entre em contato com o suporte.');
    await sendMessage(botToken, chatId, '❌ Gateway de pagamento não configurado. Entre em contato com o suporte.', undefined);
    return;
  }

  // Get platform fee
  const { data: feeSetting } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'platform_fee')
    .maybeSingle();
  
  const overrideFee = ownerProfile?.platform_fee_override;
  const platformFee = overrideFee !== null && overrideFee !== undefined
    ? Number(overrideFee)
    : (feeSetting ? parseFloat(feeSetting.value) : 0.60);
  const totalAmount = moneyAmount(plan.price); // Buyer pays plan price only, fee is deducted from vendor
  if (totalAmount < 5) {
    await recordPaymentEvent(supabase, {
      ...baseAudit,
      event_type: 'minimum_amount_failed',
      success: false,
      metadata: { amount: totalAmount },
    });
    await editTelegramMessage(botToken, chatId, generationMessageId, '❌ O valor mínimo para gerar PIX é R$ 5,00.');
    await sendMessage(botToken, chatId, 'O valor mínimo para gerar PIX é R$ 5,00.', undefined, undefined, protect);
    return;
  }

  const orderId = crypto.randomUUID();
  const externalId = orderId;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  let pixCode: string | null = null;
  let pixQrCodeUrl: string | null = null;
  let chargeId = externalId;

  try {
    const endpoint = `${REVANTPAY_API_URL}/charges/pix`;
    const requiresCustomer = totalAmount > 1000;
    if (requiresCustomer && !customerDocument) {
      await recordPaymentEvent(supabase, {
        ...baseAudit,
        event_type: 'cpf_missing_for_high_amount',
        success: false,
        metadata: { amount: totalAmount },
      });
      await editTelegramMessage(botToken, chatId, generationMessageId, '❌ Para pagamentos acima de R$ 1.000 é necessário CPF.');
      await sendMessage(botToken, chatId, 'Para pagamentos acima de R$ 1.000 é necessário CPF. Contate o vendedor.', undefined, undefined, protect);
      return;
    }
    const pixBody: Record<string, unknown> = {
      amount: totalAmount,
      description: paymentDescription(plan.name, bot.username),
      external_id: externalId,
      webhook_url: paymentWebhookUrl(supabaseUrl),
    };
    if (requiresCustomer) {
      pixBody.customer_name = botUser?.customer_name || customerName(firstName, userId);
      pixBody.customer_email = customerEmail(userId);
      pixBody.customer_cpf = customerDocument;
    }
    let attemptResult = await createPixCharge(endpoint, apiKeyCandidates, pixBody, orderId);

    const chargeCreated = attemptResult.status >= 200 && attemptResult.status < 300;
    // Only retry without webhook_url when the gateway actually rejected the charge.
    // A 201 success body also mentions "webhook_url", and retrying it created a
    // duplicate charge upstream and delayed PIX delivery by ~2s.
    if (!chargeCreated && /webhook/i.test(attemptResult.raw)) {
      await recordPaymentEvent(supabase, {
        ...baseAudit,
        event_type: 'revantpay_webhook_url_retry',
        external_status: attemptResult.status,
        success: null,
        error_message: attemptResult.raw.slice(0, 400),
      });
      const retryBody = { ...pixBody };
      delete retryBody.webhook_url;
      attemptResult = await createPixCharge(endpoint, apiKeyCandidates, retryBody, `${orderId}-nw`);
    }

    const paymentResponse = { status: attemptResult.status, ok: attemptResult.status >= 200 && attemptResult.status < 300 };
    const rawBody = attemptResult.raw;
    const contentType = attemptResult.contentType;
    const looksLikeHtml = rawBody.trim().startsWith('<');
    console.log('RevantPay status:', paymentResponse.status, 'ct:', contentType, 'attempts:', attemptResult.attempts, 'key#', attemptResult.keyIndex + 1, 'endpoint:', endpoint, 'body:', rawBody);

    if (!paymentResponse.ok || looksLikeHtml || !contentType.includes('json')) {
      const snippet = looksLikeHtml
        ? 'endpoint respondeu HTML (URL da API incorreta)'
        : (rawBody ? rawBody.slice(0, 400) : 'resposta vazia');
      console.error('RevantPay error:', paymentResponse.status, snippet);
      await recordPaymentEvent(supabase, {
        ...baseAudit,
        event_type: 'revantpay_failed',
        external_status: paymentResponse.status,
        success: false,
        error_message: snippet,
        metadata: { endpoint, content_type: contentType, attempts: attemptResult.attempts, keys_tried: apiKeyCandidates.length },
      });
      const credentialIssue = /temporarily locked|invalid|unauthor|api[_ -]?key|credential|auth-token/i.test(snippet) || paymentResponse.status === 401 || paymentResponse.status === 403;
      const leadText = credentialIssue
        ? '⚠️ O pagamento está temporariamente indisponível. Já avisamos o vendedor e assim que normalizar você poderá finalizar a compra. Tente novamente em alguns minutos.'
        : '❌ Não foi possível gerar o PIX agora. Tente novamente em alguns segundos.';
      await editTelegramMessage(botToken, chatId, generationMessageId, leadText);
      if (credentialIssue) {
        // Flag the seller's account so the dashboard can warn them to renew the key.
        try {
          await supabase
            .from('profiles')
            .update({
              revantpay_key_status: 'invalid',
              revantpay_key_error: String(snippet).slice(0, 300),
              revantpay_key_checked_at: new Date().toISOString(),
            })
            .eq('id', bot.user_id);
        } catch (flagErr) {
          console.error('[PIX] failed to flag invalid key', flagErr);
        }
        // Really warn the seller (throttled to one alert per bot per hour).
        try {
          const alertTarget = bot.notification_channel_id || bot.registro_id;
          if (alertTarget) {
            const { count } = await supabase
              .from('telegram_payment_events')
              .select('id', { count: 'exact', head: true })
              .eq('bot_id', bot.id)
              .eq('event_type', 'seller_gateway_alert_sent')
              .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
            if (!count) {
              const alertRes = await sendMessageDetailed(
                botToken,
                alertTarget as unknown as number,
                `🚨 *Falha no gateway de pagamento*\n\n` +
                `Bot: @${bot.username}\n` +
                `Erro do gateway: \`${String(snippet).slice(0, 200)}\`\n\n` +
                `Seus leads não estão conseguindo gerar PIX. Gere uma nova chave de API na RevantPay e reconecte em Pagamentos.`,
                'Markdown',
              );
              await recordPaymentEvent(supabase, {
                ...baseAudit,
                event_type: 'seller_gateway_alert_sent',
                external_status: alertRes.status,
                success: alertRes.ok,
                error_message: alertRes.error,
              });
            }
          }
        } catch (alertErr) {
          console.error('[PIX] seller alert failed', alertErr);
        }
      }
      return;
    }

    let paymentData: any;
    try {
      paymentData = JSON.parse(rawBody);
    } catch (_) {
      await recordPaymentEvent(supabase, {
        ...baseAudit,
        event_type: 'revantpay_invalid_json',
        external_status: paymentResponse.status,
        success: false,
        error_message: rawBody.slice(0, 400),
      });
      await editTelegramMessage(botToken, chatId, generationMessageId, '❌ O gateway retornou uma resposta inválida. Tente novamente.');
      await sendMessage(botToken, chatId, `❌ Resposta inválida do gateway (não-JSON) em ${endpoint}.`, undefined, undefined, protect);
      return;
    }
    console.log('RevantPay response:', JSON.stringify(paymentData));
    chargeId = paymentData.id || paymentData.charge_id || paymentData.data?.id || externalId;
    pixCode = paymentData.pix?.qr_code || paymentData.data?.pix?.qr_code || null;
    pixQrCodeUrl = paymentData.pix?.qr_code_url || paymentData.data?.pix?.qr_code_url || null;
    if (!pixCode && !pixQrCodeUrl) {
      console.error('RevantPay response missing PIX fields:', JSON.stringify(paymentData));
      await recordPaymentEvent(supabase, {
        ...baseAudit,
        event_type: 'revantpay_missing_pix_fields',
        external_status: paymentResponse.status,
        success: false,
        error_message: paymentData,
      });
      await editTelegramMessage(botToken, chatId, generationMessageId, '❌ A cobrança foi criada, mas o PIX não voltou. Tente novamente.');
      await sendMessage(botToken, chatId, '❌ O gateway criou a cobrança, mas não retornou o PIX. Tente novamente em alguns segundos.', undefined, undefined, protect);
      return;
    }
    console.log(`[PIX] revantpay_ok chat=${chatId} user=${userId} charge=${chargeId} has_code=${Boolean(pixCode)} has_qr=${Boolean(pixQrCodeUrl)}`);
    await recordPaymentEvent(supabase, {
      ...baseAudit,
      event_type: 'revantpay_success',
      external_status: paymentResponse.status,
      success: true,
      metadata: { charge_id: chargeId, has_pix_code: Boolean(pixCode), has_qr: Boolean(pixQrCodeUrl) },
    });
    // Key worked — clear any previous "invalid key" flag on the seller's profile.
    try {
      await supabase
        .from('profiles')
        .update({
          revantpay_key_status: 'valid',
          revantpay_key_error: null,
          revantpay_key_checked_at: new Date().toISOString(),
        })
        .eq('id', bot.user_id);
    } catch (_) { /* non-critical */ }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error calling RevantPay:', msg);
    await recordPaymentEvent(supabase, {
      ...baseAudit,
      event_type: 'revantpay_failed',
      success: false,
      error_message: msg,
    });
    await editTelegramMessage(botToken, chatId, generationMessageId, '❌ Erro de conexão ao gerar o PIX. Tente novamente em alguns segundos.');
    await sendMessage(botToken, chatId, `❌ Erro de conexão com o gateway de pagamento. Tente novamente em alguns segundos.`, undefined, undefined, protect);
    return;
  }

  let originalBotId: string | null = null;
  let originalTrackedLinkId: string | null = null;
  let effectiveSourceType = sourceType;

  // Check if this is a cross-bot upsell
  if (botUser?.cross_upsell_from_order_id && !isUpsellPurchase) {
    const { data: originalOrder } = await supabase
      .from('payment_orders')
      .select('bot_id, tracked_link_id')
      .eq('id', botUser.cross_upsell_from_order_id)
      .single();
    
    if (originalOrder) {
      originalBotId = originalOrder.bot_id;
      originalTrackedLinkId = originalOrder.tracked_link_id;
      effectiveSourceType = 'cross_bot';
      console.log(`Cross-bot upsell payment: original bot ${originalBotId}`);
      
      // Clear the cross upsell flag after use
      await supabase.from('bot_users').update({
        cross_upsell_from_order_id: null,
      }).eq('bot_id', bot.id).eq('telegram_user_id', userId);
    }
  } else if (botUser?.cross_upsell_from_order_id && isUpsellPurchase) {
    await supabase.from('bot_users').update({
      cross_upsell_from_order_id: null,
    }).eq('bot_id', bot.id).eq('telegram_user_id', userId);
  }

  // Cross-bot tracking: if no tracked_link in current bot and not cross-upsell, search other bots of same owner
  if (!botUser?.tracked_link_id && !originalBotId) {
    const { data: crossBotUser } = await supabase
      .from('bot_users')
      .select('tracked_link_id, bot_id')
      .eq('telegram_user_id', userId)
      .not('tracked_link_id', 'is', null)
      .not('bot_id', 'eq', bot.id)
      .limit(1)
      .maybeSingle();

    if (crossBotUser?.tracked_link_id) {
      // Verify it's from the same owner
      const { data: crossBot } = await supabase
        .from('bots').select('user_id').eq('id', crossBotUser.bot_id).single();
      if (crossBot?.user_id === bot.user_id) {
        originalBotId = crossBotUser.bot_id;
        originalTrackedLinkId = crossBotUser.tracked_link_id;
        console.log(`Cross-bot attribution: user ${userId} from bot ${originalBotId} link ${originalTrackedLinkId}`);
      }
    }
  }

  const { data: order, error: orderError } = await supabase
    .from('payment_orders')
    .insert({
      id: orderId,
      bot_id: bot.id,
      plan_id: isUpsellPurchase ? null : plan.id,
      upsell_offer_id: isUpsellPurchase ? (plan.upsell_offer_id || plan.id) : null,
      telegram_user_id: userId,
      telegram_username: username, telegram_first_name: firstName,
      amount: totalAmount, platform_fee: platformFee,
      external_id: chargeId,
      pix_code: pixCode, pix_qrcode_url: pixQrCodeUrl,
      customer_name: customerDocument ? (botUser?.customer_name || customerName(firstName, userId)) : null,
      customer_email: customerDocument ? customerEmail(userId) : null,
      customer_cpf: customerDocument || null,
      expires_at: expiresAt.toISOString(), is_downsell: isDownsell,
      tracked_link_id: botUser?.tracked_link_id || null,
      source_type: isUpsellPurchase ? 'upsell' : effectiveSourceType,
      original_bot_id: originalBotId,
      original_tracked_link_id: originalTrackedLinkId,
    })
    .select().single();

  if (orderError) {
    console.error('Error creating order:', orderError);
    await recordPaymentEvent(supabase, {
      ...baseAudit,
      event_type: 'order_insert_failed',
      success: false,
      error_message: orderError.message || orderError,
      metadata: { charge_id: chargeId },
    });
    await editTelegramMessage(botToken, chatId, generationMessageId, '❌ PIX criado, mas houve erro ao registrar o pedido. Tente novamente.');
    await sendMessage(botToken, chatId, '❌ Erro ao registrar o pagamento. Tente novamente em alguns segundos.', undefined, undefined, protect);
    return;
  }
  console.log(`[PIX] order_inserted order=${order.id} chat=${chatId} user=${userId}`);
  const orderAudit = { ...baseAudit, order_id: order.id, source_type: isUpsellPurchase ? 'upsell' : effectiveSourceType };
  await recordPaymentEvent(supabase, {
    ...orderAudit,
    event_type: 'order_created',
    success: true,
    metadata: { charge_id: chargeId, amount: totalAmount, has_pix_code: Boolean(pixCode), has_qr: Boolean(pixQrCodeUrl) },
  });
  await recordPaymentEvent(supabase, {
    ...orderAudit,
    event_type: 'pix_generated',
    success: true,
    metadata: { charge_id: chargeId, has_pix_code: Boolean(pixCode), has_qr: Boolean(pixQrCodeUrl) },
  });

  // Attach the pre-order events (payment_started, generation_notice_sent, revantpay_success...)
  // to this order so the audited timeline is complete from the first click.
  try {
    const linkWindow = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await supabase
      .from('telegram_payment_events')
      .update({ order_id: order.id })
      .eq('bot_id', bot.id)
      .eq('telegram_user_id', userId)
      .is('order_id', null)
      .gte('created_at', linkWindow);
  } catch (err) {
    console.error('[PIX_AUDIT] backfill link failed:', err);
  }

  const planLabel = String(plan.name || 'Plano');
  const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const priceLabel = `R$${totalAmount.toFixed(2).replace('.', ',')}`;

  // Single consolidated payment message: QR photo on top, plan + PIX code in the
  // caption, and the action buttons right below (matches the approved layout).
  const pixCaption = [
    '🌟 Você selecionou o seguinte plano:',
    '',
    `🎁 Plano: ${escapeHtml(planLabel.toUpperCase())}`,
    `💰 Valor: ${priceLabel}`,
    '',
    '🔷 Pague via Pix Copia e Cola (ou QR Code em alguns bancos):',
    '',
    pixCode ? `<blockquote><code>${escapeHtml(pixCode)}</code></blockquote>` : '',
    '',
    '👆 Toque na chave PIX acima para copiá-la',
    '',
    '‼️ Após o pagamento, clique no botão abaixo para verificar o status:',
  ].filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n');

  const pixKeyboard = {
    inline_keyboard: [
      [{ text: 'Verificar Status do Pagamento', callback_data: `check_payment_${order.id}` }],
      ...(pixCode ? [[{ text: 'Copiar Chave Pix', copy_text: { text: pixCode } }]] : []),
      [{ text: '🔙 Voltar', callback_data: 'back_to_start' }],
    ],
  };

  if (!pixCode) {
    console.error(`[PIX] missing_pix_code order=${order.id}`);
    await recordPaymentEvent(supabase, {
      ...orderAudit,
      event_type: 'pix_code_missing_after_order',
      success: false,
    });
  }

  // Remove the "gerando pagamento..." placeholder so only the final card remains.
  try {
    if (generationMessageId) {
      await fetchWithTimeout(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: generationMessageId }),
      }, 8000);
    }
  } catch (_) { /* non-blocking */ }

  // QR code image carries the whole payment card as its caption.
  // The gateway image is low resolution (~228px), which renders tiny/blurry in
  // Telegram and fails to scan. Always prefer a high-resolution QR rendered from
  // the payload itself; the gateway image is only a fallback.
  const providerQr = pixQrCodeUrl && (pixQrCodeUrl.startsWith('data:image/') || /^https?:\/\//i.test(pixQrCodeUrl))
    ? pixQrCodeUrl
    : null;
  const hiResQrUrl = pixCode
    ? `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&margin=16&ecc=M&format=png&data=${encodeURIComponent(pixCode)}`
    : null;
  const qrSource = hiResQrUrl || providerQr;
  let cardSent = false;
  if (qrSource) {
    pixQrCodeUrl = qrSource;
    const caption = pixCaption;
    let qrSent = false;
    try {
      if (pixQrCodeUrl.startsWith('data:image/')) {
        const base64Data = pixQrCodeUrl.split(',')[1] || '';
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'image/png' });

        const formData = new FormData();
        formData.append('chat_id', String(chatId));
        formData.append('photo', blob, 'qrcode.png');
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
        formData.append('reply_markup', JSON.stringify(pixKeyboard));

        const res = await fetchWithTimeout(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST', body: formData,
        }, 20000);
        const body = await res.json().catch(() => null);
        qrSent = res.ok && body?.ok !== false;
        console.log(`[PIX] sendPhoto_upload order=${order.id} status=${res.status} ok=${qrSent}${qrSent ? '' : ' body=' + JSON.stringify(body)}`);
        await recordPaymentEvent(supabase, {
          ...orderAudit,
          event_type: 'pix_qr_sent',
          external_status: res.status,
          success: qrSent,
          error_message: qrSent ? null : body,
          metadata: { mode: 'upload' },
        });
      } else {
        const res = await fetchWithTimeout(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, photo: pixQrCodeUrl, caption, parse_mode: 'HTML', reply_markup: pixKeyboard }),
        }, 20000);
        const body = await res.json().catch(() => null);
        qrSent = res.ok && body?.ok !== false;
        console.log(`[PIX] sendPhoto_url order=${order.id} status=${res.status} ok=${qrSent}${qrSent ? '' : ' body=' + JSON.stringify(body)}`);
        await recordPaymentEvent(supabase, {
          ...orderAudit,
          event_type: 'pix_qr_sent',
          external_status: res.status,
          success: qrSent,
          error_message: qrSent ? null : body,
          metadata: { mode: 'url' },
        });
      }
    } catch (err) {
      console.error(`[PIX] sendPhoto threw order=${order.id}:`, err instanceof Error ? err.message : String(err));
      await recordPaymentEvent(supabase, {
        ...orderAudit,
        event_type: 'pix_qr_sent',
        success: false,
        error_message: err instanceof Error ? err.message : String(err),
      });
    }

    // Fallback: if the upload failed and we have a plain http(s) URL, try sending it as a link photo.
    // Final fallback: fetch the image bytes ourselves and upload them, which works even when
    // Telegram cannot fetch the remote URL ("wrong remote file identifier" / unreachable host).
    if (!qrSent && (providerQr || pixCode)) {
      try {
        let bytes: Uint8Array | null = null;
        if (providerQr && providerQr.startsWith('data:image/')) {
          const base64Data = providerQr.split(',')[1] || '';
          const binaryString = atob(base64Data);
          bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        } else {
          const genUrl = providerQr && /^https?:\/\//i.test(providerQr)
            ? providerQr
            : `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&margin=16&ecc=M&format=png&data=${encodeURIComponent(pixCode || '')}`;
          const imgRes = await fetchWithTimeout(genUrl, { method: 'GET' }, 12000);
          if (imgRes.ok) bytes = new Uint8Array(await imgRes.arrayBuffer());
        }
        if (bytes) {
          const formData = new FormData();
          formData.append('chat_id', String(chatId));
          formData.append('photo', new Blob([bytes], { type: 'image/png' }), 'qrcode.png');
          formData.append('caption', caption);
          formData.append('parse_mode', 'HTML');
          formData.append('reply_markup', JSON.stringify(pixKeyboard));
          const res = await fetchWithTimeout(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: 'POST', body: formData,
          }, 20000);
          const body = await res.json().catch(() => null);
          const ok = res.ok && body?.ok !== false;
          qrSent = qrSent || ok;
          console.log(`[PIX] sendPhoto_fallback order=${order.id} status=${res.status} ok=${ok}`);
          await recordPaymentEvent(supabase, {
            ...orderAudit,
            event_type: 'pix_qr_fallback_sent',
            external_status: res.status,
            success: ok,
            error_message: ok ? null : body,
            metadata: { mode: 'generated_upload' },
          });
        }
      } catch (_) { /* already logged above */ }
    }
    cardSent = qrSent;
  }

  // Text-only fallback: if the QR photo could not be delivered, the payable card
  // still reaches the customer with the code and the same buttons.
  if (!cardSent) {
    let textResult = await sendMessageDetailed(botToken, chatId, pixCaption, 'HTML', pixKeyboard, false);
    if (!textResult.ok && pixCode) {
      textResult = await sendMessageDetailed(botToken, chatId, pixCode, undefined, pixKeyboard, false);
    }
    await recordPaymentEvent(supabase, {
      ...orderAudit,
      event_type: 'pix_text_sent',
      external_status: textResult.status,
      success: textResult.ok,
      error_message: textResult.ok ? null : textResult.error,
      metadata: { mode: 'text_fallback' },
    });
  }
  await recordPaymentEvent(supabase, {
    ...orderAudit,
    event_type: 'payment_instructions_sent',
    success: true,
  });

  // Payment confirmation is handled by the payment-webhook (called by RevantPay webhook_url)
  // and by the check-pending-payments cron fallback
}

// Polling removed — payment confirmation handled by webhook + cron fallback

async function checkPaymentStatus(botToken: string, chatId: number, orderId: string, supabase: any, bot: any) {
  let { data: order } = await supabase
    .from('payment_orders').select('*, subscription_plans(*), upsell_offers(*)').eq('id', orderId).single();

  if (!order) {
    await sendMessage(botToken, chatId, '❌ Pedido não encontrado.', undefined);
    return;
  }

  // Live reconciliation before answering: never tell a paying lead "não identificamos"
  // just because the gateway webhook is a few seconds late.
  if (order.status === 'pending') {
    try {
      const url = Deno.env.get('SUPABASE_URL')!;
      await fetchWithTimeout(`${url}/functions/v1/check-pending-payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ ids: [orderId] }),
      }, 10000);
      const { data: fresh } = await supabase
        .from('payment_orders').select('*, subscription_plans(*), upsell_offers(*)').eq('id', orderId).single();
      if (fresh) order = fresh;
    } catch (err) {
      console.warn('[PIX] live reconcile on check_payment failed:', err instanceof Error ? err.message : err);
    }
  }

  if (order.status === 'paid') {
    const expiresAt = new Date(order.paid_at);
    expiresAt.setDate(expiresAt.getDate() + (order.subscription_plans?.duration_days || 30));
    const orderName = order.subscription_plans?.name || order.upsell_offers?.name || 'Oferta Especial';
    
    // Generate unique link for payment check too
    let linkText = '🎉 Seu acesso foi liberado!';
    if (bot.vip_id) {
      try {
        const invResp = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: bot.vip_id, member_limit: 1, name: `VIP check ${Date.now()}` }),
        });
        const invData = await invResp.json();
        if (invData.ok && invData.result?.invite_link) {
          linkText = `🔗 Acesse o grupo VIP: ${invData.result.invite_link}\n⚠️ _Link de uso único_`;
        }
      } catch (e) {
        console.error('Error generating unique link in checkPayment:', e);
      }
    }
    
    await sendMessage(botToken, chatId,
      `✅ *Pagamento Confirmado!*\n\n📦 Plano: ${markdownText(orderName)}\n📅 Válido até: ${expiresAt.toLocaleDateString('pt-BR')}\n\n${linkText}`,
      'Markdown'
    );
  } else if (new Date(order.expires_at) < new Date()) {
    const retryCallback = order.upsell_offer_id ? `upsell_${order.upsell_offer_id}` : `plan_${order.plan_id}`;
    await sendMessage(botToken, chatId, `⏰ *Pagamento Expirado*\n\nO tempo para pagamento expirou.\nClique abaixo para gerar um novo PIX.`, 'Markdown', {
      inline_keyboard: [[{ text: '🔄 Gerar novo pagamento', callback_data: retryCallback }]]
    });
  } else {
    await sendMessage(botToken, chatId, `⏳ *Aguardando Pagamento*\n\nAinda não identificamos seu pagamento.\nApós pagar, aguarde alguns segundos e clique em verificar novamente.`, 'Markdown', {
      inline_keyboard: [
        [{ text: '🔄 Verificar novamente', callback_data: `check_payment_${orderId}` }],
        [{ text: '🔙 Voltar', callback_data: 'back_to_start' }]
      ]
    });
  }
}

async function sendMessage(botToken: string, chatId: number, text: string, parseMode?: string, replyMarkup?: any, protectContent?: boolean) {
  const result = await sendMessageDetailed(botToken, chatId, text, parseMode, replyMarkup, protectContent);
  return result.ok;
}

/** Send to an arbitrary chat id (channel/group ids are stored as strings). */
async function sendMessageToChat(botToken: string, chatId: string | number, text: string) {
  try {
    const res = await fetchWithTimeout(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
    return res.ok;
  } catch (e) {
    console.error('[NOTIFY] sendMessageToChat failed', e);
    return false;
  }
}

async function sendMessageDetailed(botToken: string, chatId: number, text: string, parseMode?: string, replyMarkup?: any, protectContent?: boolean) {
  try {
    const res = await fetchWithTimeout(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode, reply_markup: replyMarkup, protect_content: protectContent || undefined, disable_web_page_preview: true }),
    }, 15000);
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.ok === false) {
      console.error('[TG] sendMessage failed:', res.status, JSON.stringify(body));
      // Markdown parse errors are the most common cause — retry once as plain text.
      if (parseMode) {
        const retry = await fetchWithTimeout(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup, protect_content: protectContent || undefined, disable_web_page_preview: true }),
        }, 15000);
        const retryBody = await retry.json().catch(() => null);
        if (!retry.ok || retryBody?.ok === false) {
          console.error('[TG] sendMessage plain-text retry failed:', retry.status, JSON.stringify(retryBody));
          return { ok: false, status: retry.status, error: retryBody, messageId: null };
        }
        return { ok: true, status: retry.status, error: null, messageId: retryBody?.result?.message_id ?? null };
      }
      return { ok: false, status: res.status, error: body, messageId: null };
    }
    return { ok: true, status: res.status, error: null, messageId: body?.result?.message_id ?? null };
  } catch (err) {
    console.error('[TG] sendMessage threw:', err instanceof Error ? err.message : String(err));
    return { ok: false, status: null, error: err instanceof Error ? err.message : String(err), messageId: null };
  }
}

async function editTelegramMessage(botToken: string, chatId: number, messageId: number | null, text: string) {
  if (!messageId) return false;
  try {
    const res = await fetchWithTimeout(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text }),
    }, 15000);
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.ok === false) {
      console.error('[TG] editMessageText failed:', res.status, JSON.stringify(body));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[TG] editMessageText threw:', err instanceof Error ? err.message : String(err));
    return false;
  }
}

async function showOrderBumpOffer(
  botToken: string, chatId: number, bot: any, plan: any,
  userId: number, username: string, firstName: string,
  supabase: any, supabaseUrl: string, _sourceOverride?: string
) {
  const protect = bot.anti_clone || false;
  const totalWithBump = Number(plan.price) + Number(plan.order_bump_price);
  const bumpAudit = {
    bot_id: bot.id,
    telegram_user_id: userId,
    plan_id: plan.id ?? null,
    source_type: _sourceOverride || 'order_bump',
  };

  const title = (plan.order_bump_title && String(plan.order_bump_title).trim())
    ? String(plan.order_bump_title).trim()
    : '🎁 *Oferta Especial!*';
  let message = `${title}\n\n` +
    `Plano: *${plan.name}* - R$ ${Number(plan.price).toFixed(2)}\n\n` +
    `➕ *${plan.order_bump_name}* por apenas *R$ ${Number(plan.order_bump_price).toFixed(2)}*\n\n` +
    (plan.order_bump_description ? `${plan.order_bump_description}\n\n` : '') +
    `💰 Total com oferta: *R$ ${totalWithBump.toFixed(2)}*\n\n` +
    `Deseja adicionar?`;

  const priceMode = plan.order_bump_button_price_mode || 'auto';
  const customPrice = (plan.order_bump_button_price_custom || '').trim();
  const yesBase = (plan.order_bump_yes_button_text && String(plan.order_bump_yes_button_text).trim()) || '✅ Sim, quero!';
  const noBase = (plan.order_bump_no_button_text && String(plan.order_bump_no_button_text).trim()) || '❌ Não, apenas o plano';
  const yesPriceSuffix = priceMode === 'auto'
    ? ` (R$ ${totalWithBump.toFixed(2)})`
    : priceMode === 'custom' && customPrice
      ? ` ${customPrice}`
      : '';
  const noPriceSuffix = priceMode === 'auto'
    ? ` (R$ ${Number(plan.price).toFixed(2)})`
    : '';
  const yesText = `${yesBase}${yesPriceSuffix}`;
  const noText = `${noBase}${noPriceSuffix}`;

  const sourceSuffix = _sourceOverride ? `_${_sourceOverride}` : '';
  const keyboard = {
    inline_keyboard: [
      [{ text: yesText, callback_data: `orderbump_yes_${plan.id}${sourceSuffix}` }],
      [{ text: noText, callback_data: `orderbump_no_${plan.id}${sourceSuffix}` }],
    ]
  };

  await recordPaymentEvent(supabase, {
    ...bumpAudit,
    event_type: 'order_bump_started',
    success: true,
    metadata: {
      plan_name: plan.name,
      bump_name: plan.order_bump_name,
      base_price: Number(plan.price),
      bump_price: Number(plan.order_bump_price),
      total: totalWithBump,
    },
  });

  if (plan.order_bump_media_url && plan.order_bump_media_type) {
    const url = String(plan.order_bump_media_url);
    const isVideo = plan.order_bump_media_type === 'video';
    // Telegram cannot fetch some formats (avif/webp/heic) — those must fall back to text.
    const unsupported = /\.(avif|heic|heif|tiff)(\?|$)/i.test(url);
    let mediaOk = false;

    if (!unsupported) {
      const mediaMethod = isVideo ? 'sendVideo' : 'sendPhoto';
      const mediaField = isVideo ? 'video' : 'photo';
      for (const parseMode of ['Markdown', undefined]) {
        try {
          const res = await fetchWithTimeout(`https://api.telegram.org/bot${botToken}/${mediaMethod}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              [mediaField]: url,
              caption: message,
              parse_mode: parseMode,
              reply_markup: keyboard,
              protect_content: protect || undefined,
            }),
          }, 20000);
          const body = await res.json().catch(() => null);
          const ok = res.ok && body?.ok !== false;
          await recordPaymentEvent(supabase, {
            ...bumpAudit,
            event_type: 'order_bump_media_sent',
            external_status: res.status,
            success: ok,
            error_message: ok ? null : body,
            metadata: { media_type: plan.order_bump_media_type, parse_mode: parseMode || 'plain' },
          });
          if (ok) { mediaOk = true; break; }
          console.error('[BUMP] media send failed:', mediaMethod, res.status, JSON.stringify(body));
        } catch (err) {
          console.error('[BUMP] media send threw:', err instanceof Error ? err.message : String(err));
          await recordPaymentEvent(supabase, {
            ...bumpAudit,
            event_type: 'order_bump_media_sent',
            success: false,
            error_message: err instanceof Error ? err.message : String(err),
            metadata: { media_type: plan.order_bump_media_type },
          });
        }
      }
    } else {
      console.error('[BUMP] unsupported media format for Telegram, sending text only:', url);
      await recordPaymentEvent(supabase, {
        ...bumpAudit,
        event_type: 'order_bump_media_unsupported',
        success: false,
        error_message: url,
        metadata: { media_type: plan.order_bump_media_type },
      });
    }

    // Never leave the lead with nothing: always deliver the offer + buttons.
    if (!mediaOk) {
      const textOk = await sendMessage(botToken, chatId, message, 'Markdown', keyboard, protect);
      await recordPaymentEvent(supabase, {
        ...bumpAudit,
        event_type: 'order_bump_text_fallback_sent',
        success: textOk,
      });
    } else {
      await recordPaymentEvent(supabase, {
        ...bumpAudit,
        event_type: 'order_bump_offer_sent',
        success: true,
        metadata: { mode: 'media' },
      });
    }
  } else {
    const textOk = await sendMessage(botToken, chatId, message, 'Markdown', keyboard, protect);
    await recordPaymentEvent(supabase, {
      ...bumpAudit,
      event_type: 'order_bump_offer_sent',
      success: textOk,
      metadata: { mode: 'text' },
    });
  }
}
