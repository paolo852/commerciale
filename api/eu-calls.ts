// Vercel Serverless Function (Edge runtime)
// Proxy verso l'API pubblica del EU Funding & Tenders Portal (SEDIA).
// Restituisce i bandi aperti (deadline futura) con i campi normalizzati.

export const config = { runtime: 'edge' };

export interface EUCall {
  identifier: string;
  title: string;
  programme: string;
  deadline: string | null;
  status: string;
  description: string | null;
  url: string;
}

interface EUApiMetadata {
  identifier?: string[];
  title?: Array<{ value?: string } | string> | string;
  deadlineDate?: string[];
  programmePeriod?: string[];
  frameworkProgramme?: string[];
  status?: string[];
  description?: Array<{ value?: string } | string> | string;
}

interface EUApiResult {
  metadata?: EUApiMetadata;
  reference?: string;
  url?: string;
  summary?: string;
  title?: string;
  language?: string;
}

interface EUApiResponse {
  results?: EUApiResult[];
  totalResults?: number;
  totalCount?: number;
}

// Endpoint corretto del portale SEDIA (verificato via 404 path-not-found su /get-results)
const EU_API = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search';

function first(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length > 0) return first(v[0]);
  if (typeof v === 'object' && v !== null && 'value' in v) {
    return String((v as Record<string, unknown>).value ?? '');
  }
  return null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { searchParams } = new URL(req.url);
  const pageSize = Math.min(Number(searchParams.get('pageSize') ?? '50'), 100);
  const pageNumber = Number(searchParams.get('pageNumber') ?? '1');
  const text = searchParams.get('text')?.trim() || '*';
  const programme = searchParams.get('programme') ?? '';
  const fetchSize = Math.min(pageSize * 2, 100);

  // L'API SEDIA accetta POST con multipart/form-data o x-www-form-urlencoded.
  // Costruiamo la query Elasticsearch nel body.
  const url = `${EU_API}?apiKey=SEDIA&text=${encodeURIComponent(text)}&pageSize=${fetchSize}&pageNumber=${pageNumber}`;

  const today = new Date().toISOString().slice(0, 10);
  const mustClauses: object[] = [
    { terms: { type: ['1', '2', '8'] } }, // 1=tenders, 2=grants, 8=calls
    { range: { deadlineDate: { gte: today } } },
    { term: { status: '31094502' } }, // 31094502 = OPEN
  ];
  if (programme) {
    mustClauses.push({ terms: { frameworkProgramme: [programme] } });
  }

  const formBody = new URLSearchParams({
    languages: 'en',
    query: JSON.stringify({ bool: { must: mustClauses } }),
    sort: JSON.stringify({ field: 'deadlineDate', order: 'ASC' }),
  });

  let euRes: Response;
  try {
    euRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'commerciale-app/1.0',
      },
      body: formBody.toString(),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Errore di rete verso EU Portal', detail: String(e) }), { status: 502 });
  }

  if (!euRes.ok) {
    const txt = await euRes.text().catch(() => '');
    return new Response(
      JSON.stringify({
        error: `EU Portal ha risposto ${euRes.status}`,
        detail: txt.slice(0, 800),
        url: url.replace(/apiKey=[^&]+/, 'apiKey=***'),
        body: formBody.toString().slice(0, 500),
      }),
      { status: 502 },
    );
  }

  let raw: EUApiResponse;
  try {
    raw = await euRes.json() as EUApiResponse;
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Risposta EU Portal non è JSON', detail: String(e) }),
      { status: 502 },
    );
  }

  const results: EUApiResult[] = raw.results ?? [];

  const calls: EUCall[] = results
    .map((r) => {
      const m = r.metadata ?? {};
      const id = first(m.identifier) ?? r.reference ?? null;
      const title = first(m.title) ?? r.title ?? null;
      if (!id || !title) return null;
      const prog = first(m.frameworkProgramme) ?? first(m.programmePeriod) ?? '';
      const rawDeadline = first(m.deadlineDate);
      const deadline = rawDeadline ? rawDeadline.slice(0, 10) : null;
      const description = first(m.description) ?? r.summary ?? null;
      const portalUrl = r.url ?? `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${encodeURIComponent(id.toLowerCase())}`;
      return {
        identifier: id,
        title,
        programme: prog,
        deadline,
        status: first(m.status) ?? 'OPEN',
        description,
        url: portalUrl,
      } satisfies EUCall;
    })
    .filter((c): c is EUCall => c !== null)
    .filter((c) => !c.deadline || c.deadline >= today)
    .slice(0, pageSize);

  return new Response(
    JSON.stringify({ calls, total: raw.totalResults ?? raw.totalCount ?? calls.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
