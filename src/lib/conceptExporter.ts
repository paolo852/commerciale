import JSZip from 'jszip';
import type { ConceptTemplateData } from '../types';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const TEMPLATE_URL = '/Product_Concept_Template.docx';

// ── XML helpers ──────────────────────────────────────────────────────────────

function paraText(p: Element): string {
  return Array.from(p.getElementsByTagNameNS(W, 't'))
    .map((t) => t.textContent ?? '')
    .join('')
    .trim();
}

function paraStyle(p: Element): string {
  const styleEl = p.getElementsByTagNameNS(W, 'pStyle')[0];
  return styleEl?.getAttributeNS(W, 'val') ?? 'Normal';
}

function isHeading(style: string): boolean {
  return /^(heading|titolo|ttulo|titulo|titre|berschrift|title)\d+$/i.test(style);
}

// Replace all runs in a paragraph with a single run containing `text`.
// Keeps the paragraph's <w:pPr> (styling) intact.
function setParaText(doc: Document, p: Element, text: string): void {
  Array.from(p.getElementsByTagNameNS(W, 'r')).forEach((r) => p.removeChild(r));
  if (!text) return;
  const r = doc.createElementNS(W, 'w:r');
  const t = doc.createElementNS(W, 'w:t');
  t.setAttribute('xml:space', 'preserve');
  t.textContent = text;
  r.appendChild(t);
  p.appendChild(r);
}

// Build a new <w:p> with same styling as `template` but containing `text`.
function cloneParaWithText(doc: Document, template: Element, text: string): Element {
  const clone = template.cloneNode(false) as Element;
  const pPr = template.getElementsByTagNameNS(W, 'pPr')[0];
  if (pPr) clone.appendChild(pPr.cloneNode(true));
  setParaText(doc, clone, text);
  return clone;
}

// ── Section helpers ──────────────────────────────────────────────────────────

// Find first <w:p> under body with heading style whose text starts with `prefix`.
function findHeading(body: Element, prefix: string): Element | null {
  const low = prefix.toLowerCase();
  for (const p of Array.from(body.getElementsByTagNameNS(W, 'p'))) {
    if (!isHeading(paraStyle(p))) continue;
    if (paraText(p).toLowerCase().startsWith(low)) return p;
  }
  return null;
}

// Find heading whose text CONTAINS `needle` (fallback for section 5 which starts with "5.").
function findHeadingContaining(body: Element, needle: string): Element | null {
  const low = needle.toLowerCase();
  for (const p of Array.from(body.getElementsByTagNameNS(W, 'p'))) {
    if (!isHeading(paraStyle(p))) continue;
    if (paraText(p).toLowerCase().includes(low)) return p;
  }
  return null;
}

// Replace the paragraphs that sit between `heading` and the next heading/table
// with new paragraphs (one per line of `content`). If content is empty, keep template as-is.
// Table siblings act as boundaries — we do NOT remove them.
function replaceSectionBody(doc: Document, heading: Element, content: string): void {
  if (!content.trim()) return;
  const body = heading.parentNode as Element;
  if (!body) return;

  // Collect victim paragraphs (w:p siblings until next heading or table).
  const victims: Element[] = [];
  let node: Node | null = heading.nextSibling;
  while (node) {
    if (node.nodeType === 1) {
      const el = node as Element;
      if (el.namespaceURI === W) {
        if (el.localName === 'p') {
          if (isHeading(paraStyle(el))) break;
          victims.push(el);
        } else if (el.localName === 'tbl') {
          break;
        } else if (el.localName === 'sectPr') {
          break;
        }
      }
    }
    node = node.nextSibling;
  }

  if (victims.length === 0) return;

  // Build new paragraphs, one per line, styled like the first victim.
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return;

  const templatePara = victims[0];
  const newParas = lines.map((line) => cloneParaWithText(doc, templatePara, line));

  // Insert new paragraphs before the first victim, then remove all victims.
  const anchor = victims[0];
  for (const np of newParas) body.insertBefore(np, anchor);
  for (const v of victims) body.removeChild(v);
}

// ── Table helpers ────────────────────────────────────────────────────────────

interface TableRow {
  cells: Element[]; // <w:tc> elements
}

function tableRows(tbl: Element): TableRow[] {
  return Array.from(tbl.getElementsByTagNameNS(W, 'tr')).map((tr) => ({
    cells: Array.from(tr.getElementsByTagNameNS(W, 'tc')),
  }));
}

function cellText(tc: Element): string {
  return Array.from(tc.getElementsByTagNameNS(W, 't'))
    .map((t) => t.textContent ?? '')
    .join('')
    .trim();
}

// Replace all paragraphs inside a cell with a single paragraph containing `text`,
// preserving the styling of the first existing paragraph. Keeps the cell's structure.
function setCellText(doc: Document, tc: Element, text: string): void {
  if (!text) return;
  const paras = Array.from(tc.getElementsByTagNameNS(W, 'p'));
  if (paras.length === 0) return;
  const templatePara = paras[0];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return;

  const newParas = lines.map((line) => cloneParaWithText(doc, templatePara, line));
  for (const np of newParas) tc.insertBefore(np, templatePara);
  for (const p of paras) tc.removeChild(p);
}

// Find table whose first row's first cell text equals `firstCellLabel`.
function findTableByFirstCell(body: Element, firstCellLabel: string): Element | null {
  const low = firstCellLabel.toLowerCase();
  for (const tbl of Array.from(body.getElementsByTagNameNS(W, 'tbl'))) {
    const rows = tableRows(tbl);
    if (rows.length === 0 || rows[0].cells.length === 0) continue;
    if (cellText(rows[0].cells[0]).toLowerCase() === low) return tbl;
  }
  return null;
}

// For a "label → value" table, replace the value cell of the row whose first cell matches `label`.
function fillLabelValueTable(
  doc: Document, tbl: Element, entries: { label: string; value: string }[],
): void {
  const rows = tableRows(tbl);
  for (const { label, value } of entries) {
    if (!value) continue;
    const row = rows.find((r) => r.cells.length >= 2 && cellText(r.cells[0]).toLowerCase() === label.toLowerCase());
    if (row) setCellText(doc, row.cells[1], value);
  }
}

// ── Main export ──────────────────────────────────────────────────────────────

async function fetchTemplate(): Promise<ArrayBuffer> {
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error(`Impossibile caricare il template (${res.status})`);
  return await res.arrayBuffer();
}

function buildDoc(xmlStr: string): { doc: Document; body: Element } {
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  if (!body) throw new Error('body non trovato nel template');
  return { doc, body };
}

function safeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned || 'concept';
}

export async function exportConceptDocx(
  data: ConceptTemplateData | null,
): Promise<Blob> {
  const buf = await fetchTemplate();
  const zip = await JSZip.loadAsync(buf);
  const xmlEntry = zip.file('word/document.xml');
  if (!xmlEntry) throw new Error('Template invalido: word/document.xml mancante');
  const xmlStr = await xmlEntry.async('string');
  const { doc, body } = buildDoc(xmlStr);

  const d = data ?? null;
  if (d) {
    // Cover table (label → value)
    const coverTbl = findTableByFirstCell(body, 'Project / Technology name');
    if (coverTbl) {
      fillLabelValueTable(doc, coverTbl, [
        { label: 'Project / Technology name', value: d.project_name },
        { label: 'Lead organisation', value: d.lead_organisation },
        { label: 'Author(s)', value: d.authors },
        { label: 'Version', value: d.version },
        { label: 'Current TRL', value: d.trl_current },
      ]);
    }

    // 1.3 TRL table (label → value)
    const trlTbl = findTableByFirstCell(body, 'Current TRL');
    // trlTbl may equal coverTbl if the cover also has 'Current TRL' as first cell of some row;
    // safer: find the SECOND occurrence with a longer signature.
    // Both tables have Current TRL row, but only the 1.3 table has 'Key evidence' as another row's first cell.
    let trlValueTbl: Element | null = null;
    for (const tbl of Array.from(body.getElementsByTagNameNS(W, 'tbl'))) {
      const rows = tableRows(tbl);
      const firstCells = rows.map((r) => (r.cells[0] ? cellText(r.cells[0]) : ''));
      if (firstCells.includes('Key evidence')) { trlValueTbl = tbl; break; }
    }
    const targetTrlTbl = trlValueTbl ?? trlTbl;
    if (targetTrlTbl) {
      fillLabelValueTable(doc, targetTrlTbl, [
        { label: 'Current TRL', value: d.trl_justification },
        { label: 'Key evidence', value: d.trl_evidence },
        { label: 'Maturity gaps', value: d.trl_gaps },
        { label: 'Next TRL milestone', value: d.trl_next_milestone },
      ]);
    }

    // 3.1 Market table: TAM / SAM / SOM in third column
    const marketTbl = findTableByFirstCell(body, 'Indicator');
    if (marketTbl) {
      const rows = tableRows(marketTbl);
      const mapping: { label: string; value: string }[] = [
        { label: 'TAM', value: d.tam },
        { label: 'SAM', value: d.sam },
        { label: 'SOM', value: d.som },
      ];
      for (const { label, value } of mapping) {
        if (!value) continue;
        const row = rows.find((r) => r.cells.length >= 3 && cellText(r.cells[0]).toLowerCase() === label.toLowerCase());
        if (row) setCellText(doc, row.cells[2], value);
      }
    }

    // Body sections (paragraph-based)
    const h11 = findHeading(body, '1.1');
    if (h11) replaceSectionBody(doc, h11, d.tech_description);

    const h12 = findHeading(body, '1.2');
    if (h12) replaceSectionBody(doc, h12, d.product_description);

    const h14 = findHeading(body, '1.4');
    if (h14) replaceSectionBody(doc, h14, d.ip);

    const h21 = findHeading(body, '2.1');
    if (h21) replaceSectionBody(doc, h21, d.problem_statement);

    const h22 = findHeading(body, '2.2');
    if (h22) replaceSectionBody(doc, h22, d.value_proposition);

    // Section 5 heading may look like "5. Risks and Critical Assumptions" or "6.1 Riskiest assumptions..."
    const hRisk = findHeadingContaining(body, 'assumptions to validate') ?? findHeading(body, '5.');
    if (hRisk) replaceSectionBody(doc, hRisk, d.risk_assumptions);

    // 4.1 Roadmap: template has a static Phase-1/2/3 table. Rather than trying to
    // reshape the table, we inject the user's free-text roadmap immediately after
    // the section heading (before the description/table) so it's visible.
    const h41 = findHeading(body, '4.1');
    if (h41 && d.roadmap.trim()) {
      const lines = d.roadmap.split(/\r?\n/).filter((l) => l.trim().length > 0);
      // Use the next paragraph after the heading (the description) as styling template.
      let styleTemplate: Element | null = null;
      let node: Node | null = h41.nextSibling;
      while (node) {
        if (node.nodeType === 1 && (node as Element).namespaceURI === W && (node as Element).localName === 'p') {
          styleTemplate = node as Element;
          break;
        }
        node = node.nextSibling;
      }
      if (styleTemplate) {
        const parent = h41.parentNode as Element;
        const newParas = lines.map((line) => cloneParaWithText(doc, styleTemplate!, line));
        // Insert after the heading (before the description paragraph).
        for (const np of newParas) parent.insertBefore(np, styleTemplate);
      }
    }
  }

  const newXml = new XMLSerializer().serializeToString(doc);
  zip.file('word/document.xml', newXml);
  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export async function downloadConceptDocx(
  conceptName: string,
  data: ConceptTemplateData | null,
): Promise<void> {
  const blob = await exportConceptDocx(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFilename(conceptName)}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
