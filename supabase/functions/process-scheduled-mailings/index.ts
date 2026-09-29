import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const now = new Date().toISOString();

    // Buscar mailings prontos para disparo: scheduled/recurring com next_send_at (ou scheduled_at) no passado
    const { data: pending } = await supabase
      .from('mailing_messages')
      .select('id, bot_id, schedule_type, scheduled_at, next_send_at, recurring_interval_minutes, is_active, status')
      .in('status', ['scheduled', 'recurring'])
      .eq('is_active', true);

    let triggered = 0;
    const toRun: Array<{ id: string; bot_id: string }> = [];
    for (const m of pending || []) {
      const dueAt = m.next_send_at || m.scheduled_at;
      if (!dueAt) continue;
      if (new Date(dueAt).getTime() <= Date.now()) {
        toRun.push({ id: m.id, bot_id: m.bot_id });
      }
    }

    console.log(`[SCHEDULED-MAILING] ${toRun.length} mailings due`);

    // Disparar send-mailing para cada
    await Promise.all(toRun.map(async (m) => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-mailing`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ mailing_id: m.id, bot_id: m.bot_id }),
        });
        if (res.ok) triggered++;
        else console.error('[SCHEDULED-MAILING] failed', m.id, await res.text());
      } catch (e) {
        console.error('[SCHEDULED-MAILING] error', m.id, e);
      }
    }));

    return new Response(JSON.stringify({ ok: true, checked: pending?.length || 0, triggered }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[SCHEDULED-MAILING] fatal', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});