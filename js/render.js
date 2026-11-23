// Renders the resume document (preview, print/PDF) and its plain-text form.
import { SECTIONS, visibleSections, sectionTitle, sectionKind, dateRange } from './schema.js';
import { getTemplate, FONTS } from './templates.js';
import { esc, icon } from './ui.js';

const SIDEBAR_KEYS = ['skills', 'languages', 'certifications', 'courses'];
export const PAGE = { a4: { w: 794, h: 1123 }, letter: { w: 816, h: 1056 } };

const linkify = (v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);
const pretty = (v) => String(v || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

export function styleOf(r) {
  const tpl = getTemplate(r.style?.template);
  const s = r.style || {};
  return {
    tpl,
    font: FONTS[s.font] || FONTS[tpl.font] || FONTS.Inter,
    accent: s.accent || tpl.accent,
    size: Number(s.fontSize) || 10.5,
    lh: Number(s.lineHeight) || 1.35,
    margin: Number(s.margin) || 16,
    gap: Number(s.sectionGap) || 12,
    page: PAGE[s.pageSize] || PAGE.a4,
    fmt: s.dateFormat || 'MMM YYYY',
  };
}

function renderEntries(r, key, st) {
  const cfg = SECTIONS[key];
  const items = (r.sections[key] || []).filter((e) => e[cfg.head] || (cfg.sub || []).some((k) => e[k]));
  if (cfg.inline) {
    return `<p class="rs-inline">${items.map((e) => esc(e[cfg.meta] ? `${e[cfg.head]} (${e[cfg.meta]})` : e[cfg.head])).join(' <span class="rs-dot">•</span> ')}</p>`;
  }
  return items.map((e) => {
    const dates = dateRange(e, cfg, st.fmt);
    const sub = (cfg.sub || []).map((k) => e[k]).filter(Boolean).join(', ');
    const meta = cfg.meta && e[cfg.meta] ? e[cfg.meta] : '';
    const link = cfg.link && e[cfg.link] ? `<a href="${esc(linkify(e[cfg.link]))}">${esc(pretty(e[cfg.link]))}</a>` : '';
    const bullets = (e.bullets || []).filter((b) => b && b.trim());
    return `<div class="rs-entry" data-id="${esc(e.id || '')}">
      <div class="rs-row"><span class="rs-title">${esc(e[cfg.head] || '')}</span>${dates ? `<span class="rs-date">${esc(dates)}</span>` : ''}</div>
      ${sub || meta ? `<div class="rs-sub">${esc(sub)}${sub && meta ? ' <span class="rs-dot">|</span> ' : ''}${esc(meta)}</div>` : ''}
      ${link ? `<div class="rs-link">${link}</div>` : ''}
      ${bullets.length ? `<ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
    </div>`;
  }).join('');
}

function renderSection(r, key, st, { sidebar = false } = {}) {
  const kind = sectionKind(key);
  let body = '';
  if (key === 'summary') body = `<p>${esc(r.summary)}</p>`;
  else if (kind === 'tags') {
    const skills = (r.sections.skills || []).filter(Boolean);
    body = sidebar || st.tpl.heading === 'pill' || st.tpl.category === 'creative'
      ? `<div class="rs-tags">${skills.map((s) => `<span>${esc(s)}</span>`).join('')}</div>`
      : `<p class="rs-inline">${skills.map(esc).join(' <span class="rs-dot">•</span> ')}</p>`;
  } else if (kind === 'list') body = `<ul>${(r.sections[key] || []).filter((x) => String(x).trim()).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  else body = renderEntries(r, key, st);
  return `<section class="rs-sec" data-sec="${key}"><h2>${esc(sectionTitle(r, key))}</h2>${body}</section>`;
}

function contactItems(p, withIcons) {
  const it = [
    ['phone', p.phone, null],
    ['mail', p.email, p.email ? `mailto:${p.email}` : null],
    ['pin', p.location, null],
    ['linkedin', p.linkedin && pretty(p.linkedin), p.linkedin && linkify(p.linkedin)],
    ['link', p.website && pretty(p.website), p.website && linkify(p.website)],
    ['code', p.github && pretty(p.github), p.github && linkify(p.github)],
  ].filter((x) => x[1]);
  return it.map(([ic, txt, href]) => `<span class="rs-c">${withIcons ? icon(ic, 12) : ''}${href ? `<a href="${esc(href)}">${esc(txt)}</a>` : esc(txt)}</span>`);
}

export function renderResume(r, opts = {}) {
  const st = styleOf(r);
  const { tpl } = st;
  const p = r.personal || {};
  const showPhoto = tpl.photo && r.style?.showPhoto !== false && p.photo;
  const icons = !tpl.ats;
  const secs = visibleSections(r);
  const empty = !p.fullName && !secs.length;

  const header = `<header class="rs-head">
      <div class="rs-head-txt">
        <h1>${esc(p.fullName || (opts.placeholder ? 'Your Name' : ''))}</h1>
        ${p.headline ? `<div class="rs-headline">${esc(p.headline)}</div>` : ''}
        <div class="rs-contact">${contactItems(p, icons).join(tpl.ats ? '<span class="rs-sep">|</span>' : '')}</div>
      </div>
      ${showPhoto ? `<img class="rs-photo" src="${esc(p.photo)}" alt="">` : ''}
    </header>`;

  let body;
  if (tpl.layout === 'sidebar') {
    const side = secs.filter((k) => SIDEBAR_KEYS.includes(k));
    const main = secs.filter((k) => !SIDEBAR_KEYS.includes(k));
    body = `<div class="rs-cols"><aside class="rs-side">${side.map((k) => renderSection(r, k, st, { sidebar: true })).join('')}</aside>
      <div class="rs-main">${main.map((k) => renderSection(r, k, st)).join('')}</div></div>`;
  } else {
    body = secs.map((k) => renderSection(r, k, st)).join('');
  }

  const vars = `--acc:${st.accent};--font:${st.font};--fs:${st.size}pt;--lh:${st.lh};--pad:${st.margin}mm;--gap:${st.gap}px;--pw:${st.page.w}px;--ph:${st.page.h}px`;
  return `<article class="rs tpl-${tpl.id} lay-${tpl.layout} hd-${tpl.header} h-${tpl.heading} ${tpl.ats ? 'is-ats' : 'is-creative'}" style="${vars}">
    ${header}${body}
    ${empty && opts.placeholder ? '<p class="rs-empty">Start filling in your details — your resume will appear here as you type.</p>' : ''}
  </article>`;
}

// What an ATS would most likely extract: plain text in reading order.
export function plainText(r) {
  const st = styleOf(r);
  const p = r.personal || {};
  const out = [p.fullName, p.headline, [p.phone, p.email, p.location].filter(Boolean).join(' | '), [p.linkedin, p.website, p.github].filter(Boolean).join(' | '), ''];
  let keys = visibleSections(r);
  if (st.tpl.layout === 'sidebar') keys = [...keys.filter((k) => SIDEBAR_KEYS.includes(k)), ...keys.filter((k) => !SIDEBAR_KEYS.includes(k))];
  for (const key of keys) {
    out.push(sectionTitle(r, key).toUpperCase());
    const kind = sectionKind(key);
    const cfg = SECTIONS[key] || {};
    if (key === 'summary') out.push(r.summary);
    else if (kind === 'tags') out.push((r.sections.skills || []).join(', '));
    else if (kind === 'list') (r.sections[key] || []).forEach((x) => out.push(`• ${x}`));
    else {
      for (const e of r.sections[key] || []) {
        const d = dateRange(e, cfg, st.fmt);
        out.push([e[cfg.head], d].filter(Boolean).join('   '));
        const sub = [...(cfg.sub || []).map((k) => e[k]), cfg.meta && e[cfg.meta]].filter(Boolean).join(', ');
        if (sub) out.push(sub);
        (e.bullets || []).filter(Boolean).forEach((b) => out.push(`• ${b}`));
      }
    }
    out.push('');
  }
  return out.filter((x) => x !== undefined && x !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Small thumbnail preview for template cards (uses sample data).
export function sampleResume(templateId, base) {
  return {
    ...base,
    style: { ...(base.style || {}), template: templateId, font: '', accent: '' },
  };
}
