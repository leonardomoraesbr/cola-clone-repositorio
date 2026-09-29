import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') || '';
    const bearer = authHeader.replace('Bearer ', '').trim();

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    let authorized = bearer && bearer === SERVICE_ROLE;
    if (!authorized) {
      const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
      const { data: userData } = await userClient.auth.getUser();
      if (userData?.user) {
        const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
        authorized = !!isAdmin;
      }
    }
    if (!authorized) return json({ error: 'Unauthorized' }, 401);

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY não configurada' }, 400);
    let FROM = Deno.env.get('RESEND_FROM') || 'Riot Vips <onboarding@resend.dev>';

    const body = await req.json().catch(() => ({}));
    const dryRun = !!body?.dryRun;
    if (body?.from) FROM = String(body.from);
    const testTo: string | null = body?.testTo ? String(body.testTo) : null;
    const checkDomains = !!body?.checkDomains;

    if (checkDomains) {
      const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } });
      return json({ status: r.status, domains: await r.json() });
    }
    const subject = (body?.subject || 'Riot Vips e Revant Pay voltaram a funcionar 🚀').toString();

    const { data: profiles } = await admin.from('profiles').select('email, full_name');
    const emails = Array.from(new Set(
      (profiles || [])
        .map((p: any) => (p.email || '').trim().toLowerCase())
        .filter((e: string) => e && /.+@.+\..+/.test(e))
    ));

    if (dryRun) return json({ ok: true, dryRun: true, total: emails.length, from: FROM });

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;background:#0F172A;padding:32px;">
        <div style="max-width:560px;margin:0 auto;background:#111827;border:1px solid #1F2937;border-radius:16px;padding:28px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
            <div style="width:8px;height:8px;border-radius:999px;background:#22D3EE;"></div>
            <strong style="color:#22D3EE;letter-spacing:.5px;font-size:12px;">RIOT VIPS</strong>
          </div>
          <h1 style="margin:0 0 14px;font-size:22px;color:#F1F5F9;">O PIX voltou a funcionar 🚀</h1>
          <p style="line-height:1.6;color:#CBD5E1;margin:0 0 14px;">
            Ficamos alguns dias com instabilidade no PIX da Revant Pay. Já está tudo normalizado:
            geração de PIX, confirmação de pagamento e entrega automática do acesso VIP estão operando normalmente.
          </p>
          <p style="line-height:1.6;color:#CBD5E1;margin:0 0 20px;">
            É só voltar a divulgar seus links — seus bots já estão prontos para vender.
          </p>
          <a href="https://riotvips.com/auth"
             style="display:inline-block;background:#06B6D4;color:#04141a;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px;">
            Acessar minha conta
          </a>
          <hr style="border:none;border-top:1px solid #1F2937;margin:26px 0;">
          <p style="font-size:12px;color:#94A3B8;margin:0;">Equipe Riot Vips · riotvips.com</p>
        </div>
      </div>`;

    const targets = testTo ? [testTo] : emails;
    const batchId = crypto.randomUUID();
    let sent = 0, failed = 0; let lastError: string | null = null;
    const logRows: any[] = [];
    const batch = 8;
    for (let i = 0; i < targets.length; i += batch) {
      const chunk = targets.slice(i, i + batch);
      await Promise.all(chunk.map(async (to) => {
        let errorMessage: string | null = null;
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: FROM, to: [to], subject, html }),
          });
          if (res.ok) sent++;
          else { failed++; errorMessage = `${res.status} ${await res.text()}`; lastError = errorMessage; console.error('resend failed', to, errorMessage); }
        } catch (e) { failed++; errorMessage = String(e); lastError = errorMessage; console.error('resend exception', to, e); }
        logRows.push({
          batch_id: batchId,
          kind: 'status',
          subject,
          message: 'Comunicado: PIX da Revant Pay normalizado.',
          recipient_email: to,
          status: errorMessage ? 'failed' : 'sent',
          error_message: errorMessage,
        });
      }));
      await new Promise((r) => setTimeout(r, 1200));
    }

    for (let i = 0; i < logRows.length; i += 200) {
      await admin.from('email_broadcast_log').insert(logRows.slice(i, i + 200));
    }

    return json({ ok: true, total: targets.length, sent, failed, from: FROM, lastError, batchId });
  } catch (err: any) {
    console.error('broadcast-status-email error', err);
    return json({ error: err?.message || 'Internal error' }, 500);
  }
});
