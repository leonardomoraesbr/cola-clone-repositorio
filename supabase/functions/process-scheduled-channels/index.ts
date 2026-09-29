import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Retorna dia da semana atual em horário São Paulo (0=Domingo..6=Sábado)
function nowInSaoPaulo(): { weekday: number; hhmm: string; iso: string } {
  const nowUtc = new Date();
  // São Paulo é UTC-3 (sem DST desde 2019)
  const spTime = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);
  return {
    weekday: spTime.getUTCDay(),
    hhmm: `${String(spTime.getUTCHours()).padStart(2, '0')}:${String(spTime.getUTCMinutes()).padStart(2, '0')}`,
    iso: nowUtc.toISOString(),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: pending } = await supabase
      .from('channel_messages')
      .select('*')
      .in('status', ['scheduled', 'recurring'])
      .eq('is_active', true);

    const sp = nowInSaoPaulo();
    const toRun: Array<{ id: string; bot_id: string; isWeekly: boolean }> = [];

    for (const m of pending || []) {
      if (m.schedule_type === 'weekly') {
        const wds: number[] = Array.isArray(m.weekdays) ? m.weekdays : [];
        const times: string[] = Array.isArray(m.times) ? m.times : [];
        if (!wds.includes(sp.weekday)) continue;
        // Se algum horário bate no minuto atual
        if (!times.includes(sp.hhmm)) continue;
        // Evitar duplicidade: só dispara se last_sent_at não é neste minuto
        if (m.last_sent_at) {
          const last = new Date(m.last_sent_at);
          const spLast = new Date(last.getTime() - 3 * 60 * 60 * 1000);
          const lastKey = `${spLast.getUTCFullYear()}-${spLast.getUTCMonth()}-${spLast.getUTCDate()}-${spLast.getUTCHours()}-${spLast.getUTCMinutes()}`;
          const nowKey = `${new Date(Date.now()-3*3600*1000).getUTCFullYear()}-${new Date(Date.now()-3*3600*1000).getUTCMonth()}-${new Date(Date.now()-3*3600*1000).getUTCDate()}-${new Date(Date.now()-3*3600*1000).getUTCHours()}-${new Date(Date.now()-3*3600*1000).getUTCMinutes()}`;
          if (lastKey === nowKey) continue;
        }
        toRun.push({ id: m.id, bot_id: m.bot_id, isWeekly: true });
      } else {
        const dueAt = m.next_send_at || m.scheduled_at;
        if (!dueAt) continue;
        if (new Date(dueAt).getTime() <= Date.now()) {
          toRun.push({ id: m.id, bot_id: m.bot_id, isWeekly: false });
        }
      }
    }

    console.log(`[SCHEDULED-CHANNELS] ${toRun.length} due`);

    let triggered = 0;
    await Promise.all(toRun.map(async (m) => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-channel-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ message_id: m.id, bot_id: m.bot_id }),
        });
        if (res.ok) triggered++;
      } catch (e) {
        console.error('[SCHEDULED-CHANNELS] err', m.id, e);
      }
    }));

    return new Response(JSON.stringify({ ok: true, triggered }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[SCHEDULED-CHANNELS] fatal', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});