import JSZip from 'jszip';
import type { ConceptTemplateData } from '../types';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

interface Para { style: string; text: string }

function isPlaceholder(t: string): boolean {
  return /^\[.+\]$/.test(t.trim());
}

// Handles both Italian (Titolo1/2) and English (Heading1/2) Word styles
function isHeading(style: string): boolean {
  return /^(Titolo|Heading)\d+$/i.test(style);
}

async function extractParas(file: File): Promise<Para[]> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const xmlEntry = zip.file('word/document.xml');
  if (!xmlEntry) throw new Error('Formato documento non valido (document.xml non trovato).');
  const xmlStr = await xmlEntry.async('string');
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');

  const result: Para[] = [];
  for (const p of Array.from(doc.getElementsByTagNameNS(W, 'p'))) {
    const styleEl = p.getElementsByTagNameNS(W, 'pStyle')[0];
    const style = styleEl?.getAttributeNS(W, 'val') ?? 'Normal';
    const text = Array.from(p.getElementsByTagNameNS(W, 't'))
      .map((t) => t.textContent ?? '').join('').trim();
    if (text) result.push({ style, text });
  }
  return result;
}

// Find index of a heading whose text includes `needle` (case-insensitive)
function findHeadingIdx(paras: Para[], needle: string, after = 0): number {
  const low = needle.toLowerCase();
  return paras.findIndex((p, i) => i >= after && isHeading(p.style) && p.text.toLowerCase().includes(low));
}

// Collect content paragraphs starting from an already-known heading index
function sectionContentFrom(paras: Para[], startIdx: number, filterLabels: string[] = []): string {
  if (startIdx < 0) return '';
  const labelSet = new Set(filterLabels.map((l) => l.toLowerCase()));
  const lines: string[] = [];
  for (let i = startIdx + 1; i < paras.length; i++) {
    if (isHeading(paras[i].style)) break;
    const t = paras[i].text;
    if (isPlaceholder(t)) continue;
    if (labelSet.has(t.toLowerCase())) continue;
    lines.push(t);
  }
  return lines.join('\n');
}

// Collect content paragraphs for a heading identified by `needle`
function sectionContent(paras: Para[], needle: string, filterLabels: string[] = []): string {
  return sectionContentFrom(paras, findHeadingIdx(paras, needle), filterLabels);
}

// Get the value that follows an exact label paragraph
function getAfter(paras: Para[], label: string): string {
  for (let i = 0; i < paras.length; i++) {
    if (paras[i].text === label) {
      for (let j = i + 1; j < paras.length; j++) {
        if (!isPlaceholder(paras[j].text)) return paras[j].text;
      }
      return '';
    }
  }
  return '';
}

// Return paragraphs from a heading index up to the next heading
function sliceSectionFrom(paras: Para[], startIdx: number): Para[] {
  if (startIdx < 0) return [];
  const end = paras.findIndex((p, i) => i > startIdx && isHeading(p.style));
  return paras.slice(startIdx + 1, end < 0 ? undefined : end);
}

// Collect paragraphs between two headings (by needle)
function sliceSection(paras: Para[], needle: string): Para[] {
  return sliceSectionFrom(paras, findHeadingIdx(paras, needle));
}

export async function parseConceptDocx(file: File): Promise<Partial<ConceptTemplateData>> {
  const paras = await extractParas(file);
  const result: Partial<ConceptTemplateData> = {};

  // ── Cover metadata ──────────────────────────────────────────────────────────
  const projectName = getAfter(paras, 'Project / Technology name');
  const leadOrg     = getAfter(paras, 'Lead organisation');
  const authors     = getAfter(paras, 'Author(s)');
  const version     = getAfter(paras, 'Version');
  const trlCover    = getAfter(paras, 'Current TRL');

  if (projectName && !isPlaceholder(projectName)) result.project_name     = projectName;
  if (leadOrg     && !isPlaceholder(leadOrg))     result.lead_organisation = leadOrg;
  if (authors     && !isPlaceholder(authors))     result.authors           = authors;
  if (version     && !isPlaceholder(version))     result.version           = version;
  if (trlCover    && !isPlaceholder(trlCover))    result.trl_current       = trlCover;

  // ── 1.1 Technology ──────────────────────────────────────────────────────────
  result.tech_description = sectionContent(paras, '1.1');

  // ── 1.2 Product (new) + 1.2 Current TRL and evidence ───────────────────────
  // New template has TWO headings numbered "1.2":
  //   first  → "1.2 Product"
  //   second → "1.2 Current TRL and evidence"
  // Old template had a single "1.2" heading for TRL.
  const first12Idx  = findHeadingIdx(paras, '1.2');
  const second12Idx = first12Idx >= 0 ? findHeadingIdx(paras, '1.2', first12Idx + 1) : -1;

  const trl12Labels = ['Current TRL', 'Key evidence', 'Maturity gaps', 'Next TRL milestone'];
  const parseTrlFields = (sec12: Para[]) => {
    const findLabeled = (label: string): string => {
      const idx = sec12.findIndex((p) => p.text === label);
      if (idx < 0) return '';
      for (let j = idx + 1; j < sec12.length; j++) {
        if (trl12Labels.includes(sec12[j].text)) break;
        if (isHeading(sec12[j].style)) break;
        if (!isPlaceholder(sec12[j].text)) return sec12[j].text;
      }
      return '';
    };
    result.trl_justification  = findLabeled('Current TRL');
    result.trl_evidence       = findLabeled('Key evidence');
    result.trl_gaps           = findLabeled('Maturity gaps');
    result.trl_next_milestone = findLabeled('Next TRL milestone');
  };

  if (second12Idx >= 0) {
    // New template: first 1.2 = Product description, second 1.2 = TRL table
    result.product_description = sectionContentFrom(paras, first12Idx);
    parseTrlFields(sliceSectionFrom(paras, second12Idx));
  } else if (first12Idx >= 0) {
    // Old template: single 1.2 = TRL
    parseTrlFields(sliceSectionFrom(paras, first12Idx));
  }

  // ── 1.3 Intellectual property ───────────────────────────────────────────────
  result.ip = sectionContent(paras, '1.3');

  // ── 2.1 Problem statement ───────────────────────────────────────────────────
  result.problem_statement = sectionContent(paras, '2.1');

  // ── 2.2 Value Proposition (single field in new template) ────────────────────
  result.value_proposition = sectionContent(paras, '2.2');

  // ── 3.1 Market size — TAM / SAM / SOM ──────────────────────────────────────
  const sec31 = sliceSection(paras, '3.1');
  const marketNoise = new Set(['Indicator', 'Definition / methodology', 'Value']);
  const marketPrefixes = ['Total Addressable Market', 'Serviceable Available Market', 'Serviceable Obtainable Market'];
  let currentMarket: 'tam' | 'sam' | 'som' | null = null;
  for (const p of sec31) {
    if (p.text === 'TAM') { currentMarket = 'tam'; continue; }
    if (p.text === 'SAM') { currentMarket = 'sam'; continue; }
    if (p.text === 'SOM') { currentMarket = 'som'; continue; }
    if (marketNoise.has(p.text)) continue;
    if (marketPrefixes.some((d) => p.text.startsWith(d))) continue;
    if (isPlaceholder(p.text)) continue;
    if (currentMarket && !result[currentMarket]) result[currentMarket] = p.text;
  }

  // ── 4.1 Roadmap ─────────────────────────────────────────────────────────────
  const roadmapColumnHeaders = new Set(['Phase', 'TRL', 'Key activities and demonstrators', 'Decision gate / milestone']);
  result.roadmap = sectionContent(paras, '4.1', [...roadmapColumnHeaders]);

  // ── 5. Risks / assumptions ──────────────────────────────────────────────────
  result.risk_assumptions = sectionContent(paras, 'assumptions to validate');

  return result;
}
