import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'notifiche@yourdomain.com';
const FROM_NAME = Deno.env.get('FROM_NAME') ?? 'Gestione Commerciale';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Payload {
  to: string;
  subject: string;
  body: string;
  url?: string | null;
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

  const ctaButton = payload.url
    ? `<div style="margin-top: 20px;">
        <a href="${payload.url}"
           style="display: inline-block; padding: 10px 20px; background-color: #6366f1; color: #ffffff;
                  text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
          Apri →
        </a>
       </div>`
    : '';

  const htmlBody = `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; color: #1e293b; padding: 24px; max-width: 600px; margin: 0 auto;">
  <div style="border-left: 4px solid #6366f1; padding-left: 16px; margin-bottom: 24px;">
    <p style="margin: 0; font-size: 15px; line-height: 1.6;">${payload.body.replace(/\n/g, '<br>')}</p>
    ${ctaButton}
  </div>
  <p style="margin: 0; font-size: 12px; color: #94a3b8;">Gestione Commerciale — notifica automatica</p>
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
