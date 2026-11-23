// Builds an ATS-safe, single-column DOCX from the resume JSON.
// Uses real Word headings, bullets and tab stops — no tables, text boxes or images.
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, TabStopType, LevelFormat, ExternalHyperlink,
} from 'docx';
import { SECTIONS, visibleSections, sectionTitle, sectionKind, dateRange } from '../../public/js/schema.js';

const SAFE_FONTS = ['Calibri', 'Arial', 'Georgia', 'Cambria', 'Garamond', 'Helvetica', 'Times New Roman', 'Verdana', 'Tahoma', 'Lato', 'Roboto', 'Open Sans'];

export async function buildDocx(r) {
  const s = r.style || {};
  const font = SAFE_FONTS.find((f) => (s.font || '').includes(f)) || 'Calibri';
  const accent = String(s.accent || '#1b7a3e').replace('#', '');
  const base = Math.round((Number(s.fontSize) || 10.5) * 2); // half-points
  const fmt = s.dateFormat || 'MMM YYYY';
  const letter = s.pageSize === 'letter';
  const marginTw = Math.round((Number(s.margin) || 16) * 56.7); // mm -> twips
  const RIGHT = (letter ? 12240 : 11906) - marginTw * 2;

  const p = r.personal || {};
  const children = [];

  children.push(new Paragraph({
    alignment: s.headerAlign === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({ text: p.fullName || 'Your Name', bold: true, size: base + 18, color: '222222' })],
  }));
  if (p.headline) {
    children.push(new Paragraph({
      alignment: s.headerAlign === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: p.headline, size: base + 4, color: accent })],
    }));
  }
  const contact = [p.phone, p.email, p.location, p.linkedin, p.website, p.github].filter(Boolean).join('  |  ');
  if (contact) {
    children.push(new Paragraph({
      alignment: s.headerAlign === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 120 },
      children: [new TextRun({ text: contact, size: base - 2, color: '444444' })],
    }));
  }

  const heading = (text) => new Paragraph({
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: accent, space: 2 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: base + 2, color: accent, characterSpacing: 20 })],
  });
  const bullet = (text) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text, size: base })] });

  for (const key of visibleSections(r)) {
    const cfg = SECTIONS[key] || { kind: 'list' };
    children.push(heading(sectionTitle(r, key)));
    const kind = sectionKind(key);

    if (key === 'summary') {
      children.push(new Paragraph({ children: [new TextRun({ text: r.summary, size: base })] }));
    } else if (kind === 'tags') {
      children.push(new Paragraph({ children: [new TextRun({ text: (r.sections.skills || []).filter(Boolean).join(' • '), size: base })] }));
    } else if (kind === 'list') {
      (r.sections[key] || []).filter((x) => String(x).trim()).forEach((t) => children.push(bullet(String(t))));
    } else if (cfg.inline) {
      const txt = (r.sections[key] || []).filter((e) => e[cfg.head]).map((e) => (e[cfg.meta] ? `${e[cfg.head]} (${e[cfg.meta]})` : e[cfg.head])).join(' • ');
      children.push(new Paragraph({ children: [new TextRun({ text: txt, size: base })] }));
    } else {
      for (const e of r.sections[key] || []) {
        if (!e[cfg.head] && !(cfg.sub || []).some((k) => e[k])) continue;
        const dates = dateRange(e, cfg, fmt);
        children.push(new Paragraph({
          spacing: { before: 100 },
          tabStops: [{ type: TabStopType.RIGHT, position: RIGHT }],
          children: [
            new TextRun({ text: e[cfg.head] || '', bold: true, size: base + 1 }),
            ...(dates ? [new TextRun({ text: `\t${dates}`, size: base - 1, color: '555555' })] : []),
          ],
        }));
        const sub = (cfg.sub || []).map((k) => e[k]).filter(Boolean).join(', ');
        const meta = cfg.meta && e[cfg.meta] ? `${sub ? '  |  ' : ''}${e[cfg.meta]}` : '';
        if (sub || meta) {
          children.push(new Paragraph({ children: [new TextRun({ text: sub + meta, italics: true, size: base, color: '444444' })] }));
        }
        if (cfg.link && e[cfg.link]) {
          const url = /^https?:/i.test(e[cfg.link]) ? e[cfg.link] : `https://${e[cfg.link]}`;
          children.push(new Paragraph({ children: [new ExternalHyperlink({ link: url, children: [new TextRun({ text: e[cfg.link], size: base - 1, style: 'Hyperlink' })] })] }));
        }
        (e.bullets || []).filter((b) => b && b.trim()).forEach((b) => children.push(bullet(b)));
      }
    }
  }

  const doc = new Document({
    creator: 'HireReady',
    title: `${p.fullName || 'Resume'} - Resume`,
    styles: { default: { document: { run: { font, size: base } } } },
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: letter ? { width: 12240, height: 15840 } : { width: 11906, height: 16838 },
          margin: { top: marginTw, bottom: marginTw, left: marginTw, right: marginTw },
        },
      },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}
