import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Payload {
  subject?: string;
  message: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validate caller is admin
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { subject, message }: Payload = await req.json();
    if (!message || !message.trim()) {
      return new Response(JSON.stringify({ error: 'Mensagem obrigatória' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({
        error: 'RESEND_API_KEY não configurada. Adicione a chave da Resend nas configurações do projeto para enviar e-mails.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const FROM = Deno.env.get('RESEND_FROM') || 'Riot Vips <onboarding@resend.dev>';

    // Collect all registered user emails
    const { data: profiles } = await admin.from('profiles').select('email, full_name');
    const emails = (profiles || [])
      .map((p: any) => (p.email || '').trim())
      .filter((e: string) => e && /.+@.+\..+/.test(e));

    const uniqueEmails = Array.from(new Set(emails));

    const subj = (subject || 'Aviso do sistema Riot Vips').trim();
    const safeMessage = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `
      <div style="font-family:'Segoe UI',Arial,Helvetica,sans-serif;background:#0B1120;padding:32px 16px;">
        <div style="max-width:560px;margin:0 auto;background:#111827;border:1px solid #1F2937;border-radius:18px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#0e7490,#06B6D4);padding:20px 28px;">
            <div style="color:#04141a;font-size:11px;letter-spacing:2px;font-weight:bold;">RIOT VIPS</div>
            <div style="color:#052027;font-size:13px;margin-top:2px;">Aviso do sistema</div>
          </div>
          <div style="padding:28px;">
            <div style="display:inline-block;background:rgba(239,68,68,.12);color:#F87171;font-size:11px;font-weight:bold;letter-spacing:1px;padding:6px 12px;border-radius:999px;margin-bottom:16px;">COMUNICADO IMPORTANTE</div>
            <h1 style="margin:0 0 14px;font-size:20px;color:#F1F5F9;line-height:1.35;">${subj}</h1>
            <div style="background:#0B1120;border:1px solid #1F2937;border-left:3px solid #06B6D4;border-radius:12px;padding:16px 18px;">
              <p style="line-height:1.65;color:#CBD5E1;white-space:pre-wrap;margin:0;font-size:15px;">${safeMessage}</p>
            </div>
            <a href="https://riotvips.com/dashboard"
               style="display:inline-block;margin-top:22px;background:#06B6D4;color:#04141a;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;font-size:14px;">
              Acessar minha conta
            </a>
            <hr style="border:none;border-top:1px solid #1F2937;margin:26px 0 16px;">
            <p style="font-size:12px;color:#94A3B8;margin:0;line-height:1.6;">
              Você recebeu este e-mail porque tem uma conta na Riot Vips.<br>
              Equipe Riot Vips · riotvips.com
            </p>
          </div>
        </div>
      </div>`;

    const batchId = crypto.randomUUID();
    let sent = 0;
    let failed = 0;
    const logRows: any[] = [];
    const batchSize = 8;
    for (let i = 0; i < uniqueEmails.length; i += batchSize) {
      const chunk = uniqueEmails.slice(i, i + batchSize);
      await Promise.all(chunk.map(async (to) => {
        let errorMessage: string | null = null;
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ from: FROM, to: [to], subject: subj, html }),
          });
          if (res.ok) sent += 1;
          else { failed += 1; errorMessage = `${res.status} ${await res.text()}`; console.error('resend failed', to, errorMessage); }
        } catch (e) {
          failed += 1;
          errorMessage = String(e);
          console.error('resend exception', to, e);
        }
        logRows.push({
          batch_id: batchId,
          kind: 'aviso',
          subject: subj,
          message,
          recipient_email: to,
          status: errorMessage ? 'failed' : 'sent',
          error_message: errorMessage,
          sent_by: user.id,
        });
      }));
      await new Promise((r) => setTimeout(r, 1200));
    }

    if (logRows.length) {
      for (let i = 0; i < logRows.length; i += 200) {
        await admin.from('email_broadcast_log').insert(logRows.slice(i, i + 200));
      }
    }

    await admin.from('maintenance_banner_history')
      .update({ notified_at: new Date().toISOString(), notified_count: sent })
      .is('ended_at', null)
      .eq('message', message);

    return new Response(JSON.stringify({ ok: true, total: uniqueEmails.length, sent, failed, batchId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('notify-users-email error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});