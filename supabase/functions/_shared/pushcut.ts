// Shared helper to dispatch PushCut (or any webhook URL) notifications
// configured by sellers in the "Webhooks" page.

export type WebhookEvent =
  | 'pix_error'
  | 'gateway_unstable'
  | 'bot_start_error'
  | 'bot_down'
  | 'transaction_created'
  | 'transaction_paid';

async function resolveUserId(supabase: any, userId?: string | null, botId?: string | null) {
  if (userId) return userId;
  if (!botId) return null;
  const { data } = await supabase.from('bots').select('user_id').eq('id', botId).maybeSingle();
  return data?.user_id ?? null;
}

export async function firePushcut(
  supabase: any,
  opts: {
    event: WebhookEvent;
    userId?: string | null;
    botId?: string | null;
    title: string;
    text: string;
    meta?: Record<string, unknown>;
  },
) {
  try {
    const userId = await resolveUserId(supabase, opts.userId, opts.botId);
    if (!userId) return;

    const { data: hook } = await supabase
      .from('notification_webhooks')
      .select('id, url, trigger_count')
      .eq('user_id', userId)
      .eq('event_type', opts.event)
      .eq('is_active', true)
      .maybeSingle();

    if (!hook?.url) return;

    const res = await fetch(hook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: opts.title,
        text: opts.text,
        input: JSON.stringify(opts.meta ?? {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[PUSHCUT] ${opts.event} failed [${res.status}]: ${body.slice(0, 200)}`);
      return;
    }

    await supabase
      .from('notification_webhooks')
      .update({
        last_triggered_at: new Date().toISOString(),
        trigger_count: (hook.trigger_count ?? 0) + 1,
      })
      .eq('id', hook.id);
  } catch (err) {
    console.error('[PUSHCUT] threw:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Checks the last 10 minutes of PIX emission attempts for a bot and fires the
 * "gateway unstable" alert when the failure rate goes above 50% with 5+ tries.
 */
export async function checkGatewayInstability(supabase: any, botId: string, botLabel: string) {
  try {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('telegram_payment_events')
      .select('event_type, success')
      .eq('bot_id', botId)
      .gte('created_at', since)
      .in('event_type', ['pix_generated', 'revantpay_failed', 'revantpay_invalid_json', 'revantpay_missing_pix_fields', 'order_insert_failed']);

    const rows = data ?? [];
    if (rows.length < 5) return;
    const failures = rows.filter((r: any) => r.event_type !== 'pix_generated').length;
    const rate = failures / rows.length;
    if (rate <= 0.5) return;

    await firePushcut(supabase, {
      event: 'gateway_unstable',
      botId,
      title: 'Gateway PIX instável',
      text: `${botLabel}: ${failures} de ${rows.length} tentativas falharam nos últimos 10 minutos (${Math.round(rate * 100)}%).`,
      meta: { bot_id: botId, failures, attempts: rows.length },
    });
  } catch (err) {
    console.error('[PUSHCUT] instability check failed:', err instanceof Error ? err.message : String(err));
  }
}