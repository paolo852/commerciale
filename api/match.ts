// Vercel Serverless Function (Edge runtime)
// Riceve un lead + lista bandi (con eventuale PDF base64), chiama Gemini per il matching AI,
// e ritorna i match con score e motivazione.

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

interface FundingCallInput {
  id: string;
  code: string;
  name: string;
  body: string | null;
  deadline: string | null;
  description: string | null; // testo descrittivo del bando
  notes: string | null;
  probability?: number;
  pdf_base64?: string; // base64 del PDF del bando, se disponibile
}

interface RequestBody {
  leadName: string;
  leadDescription: string;
  leadPi?: string | null;
  leadEnte?: string | null;
  fundingCalls: FundingCallInput[];
}

interface MatchResult {
  funding_call_id: string;
  score: number;
  rationale: string;
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';

function buildParts(body: RequestBody): GeminiPart[] {
  const hasPdfs = body.fundingCalls.some((fc) => fc.pdf_base64);

  const callsList = body.fundingCalls.map((fc, i) => {
    const lines = [
      `${i + 1}. ID: ${fc.id}`,
      `   Codice: ${fc.code}`,
      `   Nome: ${fc.name}`,
      `   Ente erogatore: ${fc.body ?? 'non specificato'}`,
      `   Scadenza: ${fc.deadline ?? 'non specificata'}`,
    ];
    if (fc.description) lines.push(`   Descrizione: ${fc.description}`);
    if (fc.notes) lines.push(`   Note: ${fc.notes}`);
    if (fc.pdf_base64) lines.push(`   [Testo completo del bando disponibile come documento allegato]`);
    return lines.join('\n');
  }).join('\n\n');

  const promptText = `Sei un esperto di trasferimento tecnologico e matching tra tecnologie da brevetto e bandi di finanziamento pubblici/privati. Devi analizzare se una tecnologia in valutazione potrebbe rispondere con successo a uno o più bandi.

# TECNOLOGIA IN VALUTAZIONE
Nome: ${body.leadName}
${body.leadPi ? `Principal Investigator: ${body.leadPi}` : ''}
${body.leadEnte ? `Ente di riferimento: ${body.leadEnte}` : ''}
Descrizione:
${body.leadDescription}

# BANDI DISPONIBILI (non scaduti)
${callsList}
${hasPdfs ? '\nI PDF dei bandi contrassegnati sono allegati in sequenza dopo questo testo. Leggili attentamente per valutare i criteri di ammissibilità, gli obiettivi specifici e le priorità tematiche.\n' : ''}
# COMPITO
Per ogni bando, valuta in modo approfondito (NON tramite semplice keyword matching) se la tecnologia descritta — anche attraverso possibili declinazioni applicative non immediatamente evidenti — possa rispondere alle richieste della call. Considera:
- Match tematico/applicativo: la tecnologia, anche in applicazioni derivate, rientra nello scope del bando?
- Possibili use-case in cui la tecnologia diventa rilevante per quel bando
- Tipologia di soggetti ammissibili (PMI, università, startup, ecc.) coerente con l'ente proponente
- Maturità tecnologica plausibile (TRL) richiesta vs presunta della tecnologia
${hasPdfs ? '- Per i bandi con PDF allegato, usa il testo integrale per una valutazione più precisa\n' : ''}
# OUTPUT
Rispondi SOLO con un oggetto JSON valido (nessun testo extra) nel formato:
{
  "matches": [
    {
      "funding_call_id": "<id-del-bando>",
      "score": <intero 0-100, dove 100 = match perfetto>,
      "rationale": "<spiegazione di 2-3 frasi: perché c'è match, quale declinazione applicativa, eventuali criticità>"
    }
  ]
}

Includi SOLO i bandi con score >= 30. Ordina dal punteggio più alto al più basso. Se nessun bando ha score >= 30, ritorna { "matches": [] }.`;

  const parts: GeminiPart[] = [{ text: promptText }];

  // Allega i PDF in ordine (solo quelli con pdf_base64)
  for (const fc of body.fundingCalls) {
    if (fc.pdf_base64) {
      parts.push({ text: `\n--- PDF del bando "${fc.code} — ${fc.name}" (ID: ${fc.id}) ---\n` });
      parts.push({ inlineData: { mimeType: 'application/pdf', data: fc.pdf_base64 } });
    }
  }

  return parts;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY non configurata su Vercel' }), { status: 500 });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON non valido' }), { status: 400 });
  }

  if (!body.leadName || !body.leadDescription) {
    return new Response(JSON.stringify({ error: 'leadName e leadDescription sono obbligatori' }), { status: 400 });
  }
  if (!Array.isArray(body.fundingCalls) || body.fundingCalls.length === 0) {
    return new Response(JSON.stringify({ matches: [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  const parts = buildParts(body);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const geminiBody = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  };

  let geminiRes: Response;
  try {
    geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Errore di rete verso Gemini', detail: String(e) }), { status: 502 });
  }

  if (!geminiRes.ok) {
    const txt = await geminiRes.text();
    const status429 = geminiRes.status === 429
      ? ' — rate limit superato, riprova tra qualche minuto o usa un modello diverso (imposta GEMINI_MODEL su Vercel)'
      : '';
    return new Response(JSON.stringify({ error: `Gemini ha risposto ${geminiRes.status}${status429}`, detail: txt }), {
      status: 502,
    });
  }

  const data = await geminiRes.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  let parsed: { matches: MatchResult[] };
  try {
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return new Response(JSON.stringify({ error: 'Gemini ha restituito JSON non valido', raw: text }), { status: 502 });
  }

  const matches = (parsed.matches ?? [])
    .filter((m): m is MatchResult =>
      typeof m?.funding_call_id === 'string' &&
      typeof m?.score === 'number' &&
      typeof m?.rationale === 'string'
    )
    .map((m) => ({ ...m, score: Math.max(0, Math.min(100, Math.round(m.score))) }))
    .sort((a, b) => b.score - a.score);

  return new Response(JSON.stringify({ matches, model: MODEL }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
