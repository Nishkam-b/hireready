// Builds an ATS-safe, single-column PDF from the resume JSON.
// Real, selectable text (no images of text), standard fonts, simple layout —
// mirrors the DOCX export so both downloads match.
import PDFDocument from 'pdfkit';
import { SECTIONS, visibleSections, sectionTitle, sectionKind, dateRange } from '../../public/js/schema.js';

// The built-in PDF fonts only cover Latin-1-ish (WinAnsi) characters.
// Map common "smart" characters, then drop anything else that cannot be drawn.
const MAP = { '₹': 'Rs. ', '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '→': '->', '✓': '-', '★': '*', ' ': ' ' };
const clean = (v) => String(v ?? '')
  .replace(/[₹–—‘’“”…→✓★ ]/g, (c) => MAP[c])
  .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff•]/g, '')
  .trim();

const SERIF = /georgia|garamond|merriweather|serif|times|cambria/i;

export function buildPdf(r) {
  const s = r.style || {};
  const serif = SERIF.test(s.font || '');
  const F = serif
    ? { reg: 'Times-Roman', bold: 'Times-Bold', ital: 'Times-Italic' }
    : { reg: 'Helvetica', bold: 'Helvetica-Bold', ital: 'Helvetica-Oblique' };
  const accent = /^#[0-9a-f]{6}$/i.test(s.accent || '') ? s.accent : '#1b7a3e';
  const base = Math.min(13, Math.max(8.5, Number(s.fontSize) || 10.5));
  const fmt = s.dateFormat || 'MMM YYYY';
  const margin = Math.round((Number(s.margin) || 16) * 2.835); // mm -> pt
  const center = s.headerAlign === 'center';
  const p = r.personal || {};

  const doc = new PDFDocument({
    size: s.pageSize === 'letter' ? 'LETTER' : 'A4',
    margin,
    info: { Title: `${clean(p.fullName) || 'Resume'} - Resume`, Author: clean(p.fullName), Creator: 'HireReady' },
  });
  const W = doc.page.width - margin * 2;
  const L = margin;

  const text = (t, font, size, color = '#222222', opts = {}) => {
    const v = clean(t);
    if (!v) return;
    doc.font(font).fontSize(size).fillColor(color).text(v, L, undefined, { width: W, lineGap: 1.5, ...opts });
  };

  // Header
  text(p.fullName || 'Your Name', F.bold, base + 9, '#222222', { align: center ? 'center' : 'left' });
  if (p.headline) text(p.headline, F.reg, base + 2, accent, { align: center ? 'center' : 'left' });
  const contact = [p.phone, p.email, p.location, p.linkedin, p.website, p.github].map(clean).filter(Boolean).join('  |  ');
  if (contact) text(contact, F.reg, base - 1, '#444444', { align: center ? 'center' : 'left' });

  const heading = (t) => {
    doc.moveDown(0.7);
    if (doc.y > doc.page.height - margin - 60) doc.addPage();
    text(String(t).toUpperCase(), F.bold, base + 1, accent, { characterSpacing: 0.6 });
    const y = doc.y + 1;
    doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.8).strokeColor(accent).stroke();
    doc.y = y + 4;
  };
  const bullet = (t) => {
    const v = clean(t);
    if (!v) return;
    doc.font(F.reg).fontSize(base).fillColor('#222222');
    const y = doc.y;
    doc.text('•', L + 4, y, { width: 10, lineBreak: false });
    doc.text(v, L + 16, y, { width: W - 16, lineGap: 1.5 });
    doc.moveDown(0.15);
  };

  for (const key of visibleSections(r)) {
    const cfg = SECTIONS[key] || { kind: 'list' };
    heading(sectionTitle(r, key));
    const kind = sectionKind(key);

    if (key === 'summary') {
      text(r.summary, F.reg, base);
    } else if (kind === 'tags') {
      text((r.sections.skills || []).filter(Boolean).join(' • '), F.reg, base);
    } else if (kind === 'list') {
      (r.sections[key] || []).filter((x) => String(x).trim()).forEach(bullet);
    } else if (cfg.inline) {
      text((r.sections[key] || []).filter((e) => e[cfg.head]).map((e) => (e[cfg.meta] ? `${e[cfg.head]} (${e[cfg.meta]})` : e[cfg.head])).join(' • '), F.reg, base);
    } else {
      for (const e of r.sections[key] || []) {
        if (!e[cfg.head] && !(cfg.sub || []).some((k) => e[k])) continue;
        doc.moveDown(0.35);
        if (doc.y > doc.page.height - margin - 40) doc.addPage();
        const dates = clean(dateRange(e, cfg, fmt));
        const y = doc.y;
        const dw = dates ? doc.font(F.reg).fontSize(base - 1).widthOfString(dates) + 8 : 0;
        // Title first (ATS reading order), then the dates on the same line, right-aligned.
        doc.font(F.bold).fontSize(base + 0.5).fillColor('#222222').text(clean(e[cfg.head]) || ' ', L, y, { width: W - dw, lineGap: 1.5 });
        const after = doc.y;
        if (dates) doc.font(F.reg).fontSize(base - 1).fillColor('#555555').text(dates, L, y + 1, { width: W, align: 'right', lineBreak: false });
        doc.y = after;
        const sub = (cfg.sub || []).map((k) => clean(e[k])).filter(Boolean).join(', ');
        const meta = cfg.meta && e[cfg.meta] ? `${sub ? '  |  ' : ''}${clean(e[cfg.meta])}` : '';
        if (sub || meta) text(sub + meta, F.ital, base, '#444444');
        if (cfg.link && e[cfg.link]) {
          const url = /^https?:/i.test(e[cfg.link]) ? e[cfg.link] : `https://${e[cfg.link]}`;
          text(e[cfg.link], F.reg, base - 1, '#1a56db', { link: url });
        }
        doc.moveDown(0.15);
        (e.bullets || []).filter((b) => b && b.trim()).forEach(bullet);
      }
    }
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}
