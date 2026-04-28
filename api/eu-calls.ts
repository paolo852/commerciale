// Vercel Serverless Function (Edge runtime)
// Proxy verso l'API pubblica del EU Funding & Tenders Portal.
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
  title?: Array<{ value?: string } | string>;
  deadlineDate?: string[];
  programmePeriod?: string[];
  frameworkProgramme?: string[];
  status?: string[];
  description?: Array<{ value?: string } | string>;
}

interface EUApiResult {
  metadata?: EUApiMetadata;
}

interface EUApiResponse {
  results?: EUApiResult[];
  totalCount?: number;
}

const EU_API = 'https://api.tech.ec.europa.eu/search-api/get-results';

function first(arr: unknown[] | undefined): string | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const v = arr[0];
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && 'value' in v) {
    return String((v as Record<string, unknown>).value ?? '');
  }
  return null;
}

async function callEU(text: string, pageSize: number, pageNumber: number, programme: string): Promise<{ res: Response; method: string; url: string; body?: string }> {
  // Prova 1: POST con form-data (come fa il portale EU dal frontend)
  // L'API SEDIA accetta i parametri nel body x-www-form-urlencoded con la key in URL
  const urlPost = `${EU_API}?apiKey=SEDIA&text=${encodeURIComponent(text)}&pageSize=${pageSize}&pageNumber=${pageNumber}`;
  const formBody = new URLSearchParams({
    languages: 'en',
    sortBy: 'sortStatus',
    order: 'ASC',
  });
  if (programme) {
    formBody.set('query', JSON.stringify({ bool: { must: [{ terms: { 'metadata.frameworkProgramme': [programme] } }] } }));
  }

  const postRes = await fetch(urlPost, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'commerciale-app/1.0',
    },
    body: formBody.toString(),
  });
  if (postRes.ok) return { res: postRes, method: 'POST', url: urlPost, body: formBody.toString() };

  // Prova 2: GET semplice
  const params = new URLSearchParams({
    apiKey: 'SEDIA',
    text,
    pageSize: String(pageSize),
    pageNumber: String(pageNumber),
    order: 'ASC',
    sortBy: 'sortStatus',
    output: 'json',
  });
  const urlGet = `${EU_API}?${params.toString()}`;
  const getRes = await fetch(urlGet, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'commerciale-app/1.0',
    },
  });
  return { res: getRes, method: 'GET', url: urlGet };
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

  let result: { res: Response; method: string; url: string; body?: string };
  try {
    result = await callEU(text, fetchSize, pageNumber, programme);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Errore di rete verso EU Portal', detail: String(e) }), { status: 502 });
  }

  const { res: euRes, method, url, body } = result;
  if (!euRes.ok) {
    const txt = await euRes.text().catch(() => '');
    const safeUrl = url.replace(/apiKey=[^&]+/, 'apiKey=***');
    return new Response(
      JSON.stringify({
        error: `EU Portal ha risposto ${euRes.status} (${method})`,
        detail: txt.slice(0, 800),
        url: safeUrl,
        method,
        body: body ?? null,
      }),
      { status: 502 },
    );
  }

  const raw = await euRes.json() as EUApiResponse;
  const results: EUApiResult[] = raw.results ?? [];

  const today = new Date().toISOString().slice(0, 10);

  const calls: EUCall[] = results
    .map((r) => {
      const m = r.metadata ?? {};
      const id = first(m.identifier);
      const title = first(m.title);
      if (!id || !title) return null;
      const prog = first(m.frameworkProgramme) ?? first(m.programmePeriod) ?? '';
      const rawDeadline = first(m.deadlineDate);
      const deadline = rawDeadline ? rawDeadline.slice(0, 10) : null;
      const description = first(m.description);
      const portalUrl = `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${encodeURIComponent(id.toLowerCase())}`;
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
    JSON.stringify({ calls, total: raw.totalCount ?? calls.length, method }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
