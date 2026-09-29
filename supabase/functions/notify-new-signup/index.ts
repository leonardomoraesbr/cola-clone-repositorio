const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_EMAIL = 'contato.leonardomoraes0100@gmail.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim();
    const fullName = String(body.full_name || '').trim() || '(não informado)';
    const userId = String(body.user_id || '').trim();

    if (!email) {
      return new Response(JSON.stringify({ error: 'email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.warn('[notify-new-signup] RESEND_API_KEY missing — skipping email send');
      return new Response(JSON.stringify({ ok: false, skipped: true, reason: 'no_resend_key' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const FROM = Deno.env.get('RESEND_FROM') || 'Riot Vips <onboarding@resend.dev>';

    const when = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const html = `
      <div style="font-family: Arial, sans-serif; background:#0F172A; color:#E2E8F0; padding:32px;">
        <div style="max-width:560px;margin:0 auto;background:#1E293B;border-radius:14px;padding:28px;border:1px solid #334155;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
            <div style="width:8px;height:8px;border-radius:999px;background:#10B981;box-shadow:0 0 12px #10B981;"></div>
            <strong style="color:#34D399;letter-spacing:.5px;">NOVO USUÁRIO • RIOT VIPS</strong>
          </div>
          <h1 style="margin:0 0 12px;font-size:20px;color:#F1F5F9;">Um novo usuário criou conta</h1>
          <table style="width:100%;border-collapse:collapse;margin-top:12px;">
            <tr><td style="padding:8px 0;color:#94A3B8;">Nome</td><td style="padding:8px 0;color:#F1F5F9;">${fullName.replace(/</g,'&lt;')}</td></tr>
            <tr><td style="padding:8px 0;color:#94A3B8;">E-mail</td><td style="padding:8px 0;color:#F1F5F9;">${email.replace(/</g,'&lt;')}</td></tr>
            <tr><td style="padding:8px 0;color:#94A3B8;">User ID</td><td style="padding:8px 0;color:#F1F5F9;font-family:monospace;font-size:12px;">${userId.replace(/</g,'&lt;')}</td></tr>
            <tr><td style="padding:8px 0;color:#94A3B8;">Horário</td><td style="padding:8px 0;color:#F1F5F9;">${when} (BRT)</td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #334155;margin:24px 0;">
          <p style="font-size:12px;color:#94A3B8;margin:0;">Notificação automática de novo cadastro.</p>
        </div>
      </div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [ADMIN_EMAIL],
        subject: `🎉 Novo usuário Riot Vips: ${email}`,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[notify-new-signup] resend failed', res.status, text);
      return new Response(JSON.stringify({ ok: false, status: res.status, details: text }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[notify-new-signup] error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});