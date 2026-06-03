import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'notifiche@yourdomain.com';
const FROM_NAME = Deno.env.get('FROM_NAME') ?? 'Gestione Commerciale';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Field { label: string; value: string }

interface Payload {
  to: string;
  subject: string;
  body: string;
  url?: string | null;
  fields?: Field[] | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  const payload: Payload = await req.json();
  console.log('[notify] to:', payload.to, '| subject:', payload.subject, '| url:', payload.url ?? '—');

  if (!payload.to || !payload.subject) {
    console.error('[notify] missing required fields');
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  if (!BREVO_API_KEY) {
    console.error('[notify] BREVO_API_KEY not configured');
    return new Response(JSON.stringify({ error: 'BREVO_API_KEY not configured' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const fieldsTable = payload.fields && payload.fields.length > 0
    ? `<table style="width:100%; border-collapse:collapse; margin-top:16px; font-size:14px;">
        ${payload.fields.map((f, i) => `
        <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'};">
          <td style="padding:8px 12px; color:#64748b; font-weight:600; white-space:nowrap; width:35%;">${f.label}</td>
          <td style="padding:8px 12px; color:#1e293b;">${f.value}</td>
        </tr>`).join('')}
       </table>`
    : '';

  const ctaButton = payload.url
    ? `<div style="margin-top:24px;">
        <a href="${payload.url}"
           style="display:inline-block; padding:10px 22px; background-color:#6366f1; color:#ffffff;
                  text-decoration:none; border-radius:8px; font-size:14px; font-weight:600;">
          Apri →
        </a>
       </div>`
    : '';

  const htmlBody = `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f1f5f9; margin:0; padding:32px 16px;">
  <div style="max-width:580px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#6366f1; padding:20px 28px;">
      <p style="margin:0; font-size:13px; font-weight:600; color:#c7d2fe; letter-spacing:0.05em; text-transform:uppercase;">Gestione Commerciale</p>
      <h1 style="margin:4px 0 0; font-size:18px; font-weight:700; color:#ffffff;">${payload.subject}</h1>
    </div>

    <!-- Body -->
    <div style="padding:24px 28px;">
      <p style="margin:0 0 4px; font-size:15px; color:#334155; line-height:1.6;">${payload.body.replace(/\n/g, '<br>')}</p>

      ${fieldsTable}
      ${ctaButton}
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px; border-top:1px solid #e2e8f0; background:#f8fafc;">
      <p style="margin:0; font-size:12px; color:#94a3b8;">Notifica automatica — non rispondere a questa email.</p>
    </div>

  </div>
</body>
</html>`;

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: payload.to }],
      subject: payload.subject,
      htmlContent: htmlBody,
    }),
  });

  const data = await res.json();
  console.log('[notify] brevo status:', res.status, '| response:', JSON.stringify(data));

  if (!res.ok) {
    return new Response(JSON.stringify({ error: data }), {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ messageId: data.messageId }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
