import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'notifiche@yourdomain.com';

interface Payload {
  to: string;
  subject: string;
  body: string;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const payload: Payload = await req.json();

  if (!payload.to || !payload.subject) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [payload.to],
      subject: payload.subject,
      html: `<p>${payload.body.replace(/\n/g, '<br>')}</p>`,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return new Response(JSON.stringify({ error: data }), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ id: data.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
