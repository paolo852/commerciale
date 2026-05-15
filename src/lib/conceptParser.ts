import JSZip from 'jszip';
import type { ConceptTemplateData } from '../types';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

interface Para { style: string; text: string }

function isPlaceholder(t: string): boolean {
  return /^\[.+\]$/.test(t.trim());
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

function getAfter(paras: Para[], label: string, startIdx: number): { value: string; nextIdx: number } {
  for (let i = startIdx; i < paras.length; i++) {
    if (paras[i].text === label) {
      for (let j = i + 1; j < paras.length; j++) {
        if (!isPlaceholder(paras[j].text) && paras[j].style !== 'Titolo1' && paras[j].style !== 'Titolo2') {
          return { value: paras[j].text, nextIdx: j + 1 };
        }
        if (paras[j].style === 'Titolo1' || paras[j].style === 'Titolo2') break;
      }
      return { value: '', nextIdx: i + 1 };
    }
  }
  return { value: '', nextIdx: startIdx };
}

function sectionContent(paras: Para[], heading: string, filterLabels: string[] = []): string {
  const labelSet = new Set(filterLabels);
  let inSection = false;
  const lines: string[] = [];

  for (const p of paras) {
    if (p.style === 'Titolo1' || p.style === 'Titolo2') {
      if (p.text === heading) { inSection = true; continue; }
      if (inSection) break;
      continue;
    }
    if (!inSection) continue;
    if (labelSet.has(p.text)) continue;
    if (isPlaceholder(p.text)) continue;
    lines.push(p.text);
  }
  return lines.join('\n');
}

const SECTION_LABELS: Record<string, string> = {
  '1. Technology Snapshot': '1',
  '1.1 Description and novelty': '1.1',
  '1.2 Current TRL and evidence': '1.2',
  '1.3 Intellectual property': '1.3',
  '2. Problem and Value Proposition': '2',
  '2.1 Problem statement': '2.1',
  '2.2 Value proposition': '2.2',
  '2.3 Validation': '2.3',
  '3. Market and Competition': '3',
  '3.1 Market size': '3.1',
  '4. Development Roadmap': '4',
  '4.1 From current TRL to market': '4.1',
  '5. Risks and Critical Assumptions': '5',
  '6.1 Riskiest assumptions to validate': '5.1',
};

export async function parseConceptDocx(file: File): Promise<Partial<ConceptTemplateData>> {
  const paras = await extractParas(file);
  const result: Partial<ConceptTemplateData> = {};

  // Cover metadata
  const coverLabels = ['Project / Technology name', 'Lead organisation', 'Author(s)', 'Version', 'Current TRL', 'PRODUCT CONCEPT TEMPLATE', 'From Low-TRL Technology to Product Concept'];
  const { value: leadOrg } = getAfter(paras, 'Lead organisation', 0);
  const { value: authors } = getAfter(paras, 'Author(s)', 0);
  const { value: version } = getAfter(paras, 'Version', 0);
  const { value: trlCurrent } = getAfter(paras, 'Current TRL', 0);

  if (leadOrg) result.lead_organisation = leadOrg;
  if (authors) result.authors = authors;
  if (version && !isPlaceholder(version)) result.version = version;
  if (trlCurrent && !isPlaceholder(trlCurrent)) result.trl_current = trlCurrent;

  // 1.1 Description and novelty — free text
  result.tech_description = sectionContent(paras, '1.1 Description and novelty', [...coverLabels, ...Object.keys(SECTION_LABELS)]);

  // 1.2 TRL sub-fields
  const trl12Labels = ['Current TRL', 'Key evidence', 'Maturity gaps', 'Next TRL milestone'];
  const sec12Start = paras.findIndex((p) => p.text === '1.2 Current TRL and evidence');
  const sec12End = paras.findIndex((p, i) => i > sec12Start && (p.style === 'Titolo1' || p.style === 'Titolo2'));
  const sec12Paras = paras.slice(sec12Start + 1, sec12End < 0 ? undefined : sec12End);

  const findLabeled = (label: string): string => {
    const idx = sec12Paras.findIndex((p) => p.text === label);
    if (idx < 0) return '';
    for (let j = idx + 1; j < sec12Paras.length; j++) {
      if (trl12Labels.includes(sec12Paras[j].text)) break;
      if (!isPlaceholder(sec12Paras[j].text)) return sec12Paras[j].text;
    }
    return '';
  };
  result.trl_justification = findLabeled('Current TRL');
  result.trl_evidence = findLabeled('Key evidence');
  result.trl_gaps = findLabeled('Maturity gaps');
  result.trl_next_milestone = findLabeled('Next TRL milestone');

  // 1.3 IP
  result.ip = sectionContent(paras, '1.3 Intellectual property', []);

  // 2.1 Problem statement
  result.problem_statement = sectionContent(paras, '2.1 Problem statement', []);

  // 2.2 Value proposition — parse functional/economic/strategic bullet points
  const sec22Start = paras.findIndex((p) => p.text === '2.2 Value proposition');
  const sec22End = paras.findIndex((p, i) => i > sec22Start && (p.style === 'Titolo1' || p.style === 'Titolo2'));
  const sec22Paras = paras.slice(sec22Start + 1, sec22End < 0 ? undefined : sec22End).filter((p) => !isPlaceholder(p.text));

  const extractBullet = (prefix: string): string =>
    sec22Paras
      .filter((p) => p.text.toLowerCase().startsWith(prefix.toLowerCase()))
      .map((p) => p.text.replace(new RegExp(`^${prefix}:?\\s*`, 'i'), '').trim())
      .join('\n') ||
    sec22Paras
      .filter((p) => p.text === prefix.split(' ')[0] + ' benefits:' || p.text.startsWith(prefix + ':'))
      .map((p) => p.text).join('\n');

  result.value_functional = extractBullet('Functional benefits') || (sec22Paras.find((p) => p.text.toLowerCase().includes('functional'))?.text ?? '');
  result.value_economic   = extractBullet('Economic benefits')   || (sec22Paras.find((p) => p.text.toLowerCase().includes('economic'))?.text ?? '');
  result.value_strategic  = extractBullet('Strategic benefits')  || (sec22Paras.find((p) => p.text.toLowerCase().includes('strategic'))?.text ?? '');

  // 2.3 Validation
  result.validation = sectionContent(paras, '2.3 Validation', []);

  // 3.1 Market size — TAM/SAM/SOM
  const sec31Start = paras.findIndex((p) => p.text === '3.1 Market size');
  const sec31End = paras.findIndex((p, i) => i > sec31Start && (p.style === 'Titolo1' || p.style === 'Titolo2'));
  const sec31Paras = paras.slice(sec31Start + 1, sec31End < 0 ? undefined : sec31End);

  const marketNoise = new Set(['Indicator', 'Definition / methodology', 'Value']);
  const marketDescriptions = ['Total Addressable Market', 'Serviceable Available Market', 'Serviceable Obtainable Market'];

  let currentMarket: 'tam' | 'sam' | 'som' | null = null;
  for (const p of sec31Paras) {
    if (p.text === 'TAM') { currentMarket = 'tam'; continue; }
    if (p.text === 'SAM') { currentMarket = 'sam'; continue; }
    if (p.text === 'SOM') { currentMarket = 'som'; continue; }
    if (marketNoise.has(p.text)) continue;
    if (marketDescriptions.some((d) => p.text.startsWith(d))) continue;
    if (isPlaceholder(p.text)) continue;
    if (currentMarket && !result[currentMarket]) result[currentMarket] = p.text;
  }

  // 4.1 Roadmap — free text, skip table headers
  const roadmapNoise = new Set(['Phase', 'TRL', 'Key activities and demonstrators', 'Decision gate / milestone', 'Phase 1', 'Phase 2', 'Phase 3']);
  result.roadmap = sectionContent(paras, '4.1 From current TRL to market', [...roadmapNoise]);

  // 5. Risks / assumptions
  result.risk_assumptions = sectionContent(paras, '6.1 Riskiest assumptions to validate', []);

  return result;
}
