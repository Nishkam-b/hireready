// Job analysis, match, one-click optimisation, ATS report & fixes, PDF printing.
import { icon, esc, $, $$, toast, busy, modal, ring, copyText } from '../ui.js';
import { ai, fetchJob } from '../api.js';
import { runAtsChecks, normaliseConsistency } from '../ats.js';
import { renderResume, styleOf } from '../render.js';
import { listResumes, getResume, saveResume, duplicateResume, uid } from '../store.js';
import { SECTIONS, DEFAULT_ORDER } from '../schema.js';
import { TEMPLATES } from '../templates.js';

/* ---------------- PDF / print ---------------- */
export function printResume(r, fileName) {
  const st = styleOf(r);
  $('#print-root').innerHTML = renderResume(r);
  $('#page-style').textContent = `@page { size: ${r.style?.pageSize === 'letter' ? 'letter' : 'A4'}; margin: ${st.margin}mm; }
    @media print { #print-root .rs { padding: 0; }
      #print-root .hd-band .rs-head { margin: 0 0 var(--gap); padding: 14px 18px; border-radius: 6px; }
      #print-root .lay-sidebar .rs-side { margin: 0; padding: 10px 12px; } }`;
  const oldTitle = document.title;
  document.title = fileName || 'Resume'; // Chrome uses the title as the PDF file name
  const done = () => { document.title = oldTitle; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 50);
}

export const defaultFileName = (r) => `${(r.personal.fullName || 'My').trim().replace(/\s+/g, '_')}_Resume${r.targetJob ? `_${r.targetJob.replace(/[^\w]+/g, '_')}` : ''}`.replace(/_+/g, '_');

/* ---------------- Text replacement helpers ---------------- */
export function replaceEverywhere(r, from, to) {
  if (!from) return 0;
  let n = 0;
  const rep = (s) => { if (typeof s === 'string' && s.includes(from)) { n++; return s.split(from).join(to); } return s; };
  r.summary = rep(r.summary);
  r.personal.headline = rep(r.personal.headline);
  for (const k of Object.keys(r.sections)) {
    r.sections[k] = (r.sections[k] || []).map((e) => {
      if (typeof e === 'string') return rep(e);
      const o = { ...e };
      if (Array.isArray(o.bullets)) o.bullets = o.bullets.map(rep);
      for (const f of ['title', 'name', 'degree']) if (o[f]) o[f] = rep(o[f]);
      return o;
    });
  }
  return n;
}

/* ---------------- Grammar review ---------------- */
export async function grammarReview(r, btn, onChange) {
  const res = await busy(btn, () => ai('grammar-scan', { resume: r }), 'Checking…');
  if (!res) return;
  r.ats = { ...(r.ats || {}), grammar: { issues: res.issues || [], at: Date.now() } };
  onChange(r);
  if (!res.issues?.length) { toast('No spelling or grammar issues found'); return; }
  showGrammarIssues(r, onChange);
}

export function showGrammarIssues(r, onChange) {
  const issues = r.ats?.grammar?.issues || [];
  const m = modal({
    title: `${issues.length} writing issue${issues.length === 1 ? '' : 's'} found`,
    wide: true,
    body: issues.map((x, i) => `<div class="result-box" data-i="${i}">
      <div class="small muted">${esc(x.where || '')} · ${esc(x.type || '')}</div>
      <div class="diff" style="margin-top:8px"><div class="old"><h5>Current</h5>${esc(x.text)}</div><div class="new"><h5>Suggested</h5>${esc(x.fix)}</div></div>
      <div class="acts"><button class="btn btn-sm btn-primary" data-apply="${i}">${icon('check', 16)}Apply</button><button class="btn btn-sm" data-skip="${i}">Ignore</button></div>
    </div>`).join(''),
    footer: '<button class="btn" data-close>Close</button><button class="btn btn-primary" id="apply-all">Apply all</button>',
  });
  const apply = (i) => {
    const x = issues[i];
    const n = replaceEverywhere(r, x.text, x.fix);
    $(`[data-i="${i}"]`, m.el)?.remove();
    return n;
  };
  const finish = () => {
    const remaining = $$('[data-i]', m.el).map((el) => issues[+el.dataset.i]);
    r.ats.grammar.issues = remaining;
    onChange(r);
    if (!remaining.length) m.close();
  };
  m.el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-apply]');
    const s = e.target.closest('[data-skip]');
    if (a) { const n = apply(+a.dataset.apply); if (!n) toast('That text was already changed', 'info'); finish(); }
    if (s) { $(`[data-i="${s.dataset.skip}"]`, m.el)?.remove(); finish(); }
  });
  $('#apply-all', m.el).addEventListener('click', () => { $$('[data-i]', m.el).forEach((el) => apply(+el.dataset.i)); finish(); toast('Fixes applied'); m.close(); });
}

/* ---------------- ATS report ---------------- */
export function atsReportHTML(r, { compact = false } = {}) {
  const rep = runAtsChecks(r);
  const fails = rep.checks.filter((c) => c.status !== 'pass');
  const statusIc = (s) => `<span class="tick ${s === 'pass' ? '' : s}">${icon(s === 'pass' ? 'check' : s === 'fail' ? 'x' : 'alert', 15)}</span>`;
  return `<div class="card card-pad">
      <div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap">
        ${ring(rep.score, compact ? 86 : 110, 'ATS score')}
        <div style="flex:1;min-width:200px"><h3 style="margin-bottom:6px">${rep.score >= 80 ? 'Looking good!' : rep.score >= 60 ? 'Almost there' : 'Needs work'}</h3>
          <p class="muted small" style="margin:0">${rep.checks.length - fails.length} of ${rep.checks.length} checks passed. ${fails.length ? 'Fix the items below to improve compatibility.' : ''}</p>
          <p class="small muted" style="margin:6px 0 0">${icon('info', 14)} This score reflects HireReady's own compatibility checks. No tool can guarantee how every employer's ATS will read a resume.</p></div>
      </div>
    </div>
    <div class="card card-pad" style="margin-top:16px">
      ${rep.checks.map((c) => `<div class="check-row">${statusIc(c.status)}<div style="flex:1;min-width:0"><b>${esc(c.label)}</b><p>${esc(c.detail)}</p></div>${c.fix ? `<button class="btn btn-sm btn-soft" data-fix="${esc(c.fix.action)}">${esc(c.fix.label)}</button>` : ''}</div>`).join('')}
    </div>
    ${rep.tips.length ? `<div class="card card-pad" style="margin-top:16px"><h3 style="font-size:17px;margin-bottom:8px">${icon('bulb', 22)}More suggestions</h3>${rep.tips.map((t) => `<div class="check-row">${statusIc(t.status)}<div><p style="margin:0;color:var(--ink-2)">${esc(t.text)}</p></div>${t.action ? `<button class="btn btn-sm" data-fix="${t.action}">Fix</button>` : ''}</div>`).join('')}</div>` : ''}
    ${compact ? '' : `<div class="card card-pad" style="margin-top:16px"><div class="form-head"><h3 style="font-size:17px">${icon('eye', 22)}How an ATS reads your resume</h3><button class="btn btn-sm" id="copy-text">${icon('copy', 16)}Copy text</button></div>
      <p class="muted small">Extracted plain text, in reading order (${rep.words} words). If something looks wrong here, an ATS may misread it too.</p><div class="extract">${esc(rep.text)}</div></div>`}`;
}

// Handles one-click ATS fixes. `ctx.goto(section)` navigates within the editor.
export async function applyAtsFix(r, action, btn, ctx) {
  if (action === 'switch-template') {
    r.style.template = 'modern';
    toast('Switched to the ATS-safe "Modern Minimal" template');
  } else if (action === 'hide-photo') {
    r.style.showPhoto = false;
    toast('Photo hidden');
  } else if (action === 'restore-headings') {
    r.customTitles = Object.fromEntries(Object.entries(r.customTitles || {}).filter(([k]) => !SECTIONS[k]));
    toast('Standard headings restored');
  } else if (action === 'fix-consistency') {
    normaliseConsistency(r);
    toast('Dates and bullet punctuation made consistent');
  } else if (action === 'grammar-scan') {
    return grammarReview(r, btn, ctx.change);
  } else if (action === 'grammar-review') {
    return showGrammarIssues(r, ctx.change);
  } else if (action === 'add-jd' || action === 'optimise') {
    return ctx.goto('optimise');
  } else if (action.startsWith('goto:')) {
    return ctx.goto(action.slice(5));
  }
  ctx.change(r);
}

/* ---------------- Job panel (analyse / match / optimise) ---------------- */
const list = (arr, cls = '') => (arr?.length ? `<div class="tagcloud ${cls}">${arr.map((x) => `<span>${esc(typeof x === 'string' ? x : x.keyword || x.skill)}</span>`).join('')}</div>` : '<p class="muted small">None found</p>');

export function analysisHTML(a) {
  if (!a) return '';
  return `<div class="card card-pad" style="margin-top:16px"><h3 style="font-size:18px">${icon('search', 22)}Job description analysis</h3>
    ${a.plainSummary ? `<p class="muted" style="margin:8px 0 16px">${esc(a.plainSummary)}</p>` : ''}
    <div class="kv">
      <div><h4>Required skills</h4>${list(a.requiredSkills)}</div>
      <div><h4>Tools &amp; technologies</h4>${list(a.tools, 'grey')}</div>
      <div><h4>Important keywords</h4>${list(a.keywords, 'grey')}</div>
      ${a.preferredQualifications?.length ? `<div><h4>Preferred qualifications</h4><ul class="small">${a.preferredQualifications.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      <div class="grid2"><div><h4>Experience required</h4><p class="small">${esc(a.experienceRequired || 'Not stated')}</p></div><div><h4>Education</h4><p class="small">${esc(a.education || 'Not stated')}</p></div></div>
      ${a.responsibilities?.length ? `<div><h4>Key responsibilities</h4><ul class="small">${a.responsibilities.slice(0, 8).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${a.industryTerms?.length ? `<div><h4>Industry terms</h4>${list(a.industryTerms, 'grey')}</div>` : ''}
    </div></div>`;
}

export function matchHTML(m) {
  if (!m) return '';
  const b = m.breakdown || {};
  return `<div class="card card-pad" style="margin-top:16px">
    <div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap;margin-bottom:18px">${ring(m.score, 110, 'job match')}
      <div style="flex:1;min-width:220px"><h3 style="font-size:18px;margin-bottom:6px">Job Match Analysis</h3><p class="muted small" style="margin:0 0 10px">${esc(m.verdict || '')}</p>
      ${[['Keywords', b.keywords], ['Experience', b.experience], ['Education', b.education], ['Clarity', b.clarity]].filter(([, v]) => v != null).map(([l, v]) => `<div class="bar-row"><span>${l}</span><div class="bar"><i style="width:${Math.min(100, v)}%"></i></div><span>${Math.round(v)}%</span></div>`).join('')}</div></div>
    <div class="kv">
      <div><h4>Skills identified</h4>${list(m.matchedSkills)}</div>
      <div><h4>Not mentioned in your resume</h4><p class="small muted" style="margin:-4px 0 8px">Your background suggests you may have these — add them only if true.</p>${list(m.notMentioned, 'warn')}</div>
      <div><h4>Missing or underrepresented</h4><p class="small muted" style="margin:-4px 0 8px">No evidence in your resume. Consider learning these or addressing them honestly.</p>${list(m.missing, 'bad')}</div>
      ${m.suggestions?.length ? `<div><h4>Suggestions</h4><ul class="small">${m.suggestions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    </div></div>`;
}

// Builds an optimised copy from the AI result without adding new facts.
export function buildOptimised(r, o) {
  const c = JSON.parse(JSON.stringify(r));
  const changes = [];
  if (o.summary && o.summary !== r.summary) { changes.push({ label: 'Professional summary', old: r.summary || '(empty)', neu: o.summary }); c.summary = o.summary; }
  if (o.headline && o.headline !== r.personal.headline) { changes.push({ label: 'Headline', old: r.personal.headline || '(empty)', neu: o.headline }); c.personal.headline = o.headline; }
  for (const e of o.entries || []) {
    const arr = c.sections[e.section];
    const target = arr?.find((x) => x.id === e.id);
    if (!target || !Array.isArray(e.bullets) || !e.bullets.length) continue;
    if (e.bullets.join('\n').trim() === (target.bullets || []).join('\n').trim()) continue;
    const label = `${SECTIONS[e.section]?.label || e.section}: ${target.title || target.name || ''}`;
    changes.push({ label, old: target.bullets || [], neu: e.bullets });
    target.bullets = e.bullets;
  }
  // Only reorder skills the candidate already listed — never add new ones silently.
  const existing = c.sections.skills || [];
  const lower = existing.map((s) => s.toLowerCase());
  const reordered = (o.skills || []).filter((s) => lower.includes(String(s).toLowerCase())).map((s) => existing[lower.indexOf(String(s).toLowerCase())]);
  const merged = [...new Set([...reordered, ...existing])];
  if (merged.join() !== existing.join()) { changes.push({ label: 'Skills order (most relevant first)', old: existing.join(', '), neu: merged.join(', ') }); c.sections.skills = merged; }
  const validOrder = (o.sectionOrder || []).filter((k) => c.sectionOrder.includes(k));
  if (validOrder.length >= 3) {
    const newOrder = [...new Set([...validOrder, ...c.sectionOrder])];
    if (newOrder.join() !== c.sectionOrder.join()) { changes.push({ label: 'Section order', old: c.sectionOrder.filter((k) => !!SECTIONS[k]).slice(0, 6).map((k) => SECTIONS[k].label).join(' → '), neu: newOrder.filter((k) => !!SECTIONS[k]).slice(0, 6).map((k) => SECTIONS[k].label).join(' → ') }); c.sectionOrder = newOrder; }
  }
  return { copy: c, changes };
}

export function compareModal(r, o, { onSaveNew, onApply }) {
  const { copy, changes } = buildOptimised(r, o);
  const fmt = (v) => (Array.isArray(v) ? `<ul>${v.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : esc(v));
  const company = r.analysis?.company;
  const m = modal({
    title: 'Compare original and optimised resume',
    wide: true,
    body: `${changes.length ? changes.map((ch) => `<div class="result-box"><b>${esc(ch.label)}</b><div class="diff" style="margin-top:8px"><div class="old"><h5>Original</h5>${fmt(ch.old)}</div><div class="new"><h5>Optimised</h5>${fmt(ch.neu)}</div></div></div>`).join('') : '<p>No changes were needed — your resume is already well aligned.</p>'}
      ${o.suggestedSkills?.length ? `<div class="result-box"><b>Skills the job asks for</b><p class="small muted">Not added automatically. Add any you genuinely have from the Skills section.</p>${list(o.suggestedSkills, 'warn')}</div>` : ''}
      ${o.titleSuggestions?.length ? `<div class="result-box"><b>Job title wording</b>${o.titleSuggestions.map((t) => `<p class="small">"${esc(t.current)}" → "${esc(t.suggested)}" <span class="muted">— ${esc(t.why)}</span></p>`).join('')}<p class="small muted">Only change a title if it is factually equivalent to your real role.</p></div>` : ''}
      ${o.lessRelevant?.length ? `<div class="result-box"><b>Could be shortened</b><ul class="small">${o.lessRelevant.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      <div class="hint">${icon('alert', 18)}<div>Review every change. Replace any <b>[X%]</b> or <b>[number]</b> placeholders with real figures, or remove them.</div></div>
      <div class="field"><label for="vname">Save as version name</label><input class="input" id="vname" value="${esc(`${o.headline && r.targetJob ? r.targetJob : r.targetJob || 'Tailored'}${company ? ` – ${company}` : ''}`)}"></div>`,
    footer: '<button class="btn" data-close>Discard</button><button class="btn" id="apply-here">Apply to this resume</button><button class="btn btn-primary" id="save-new">Save as new version</button>',
  });
  $('#save-new', m.el).addEventListener('click', () => { onSaveNew(copy, $('#vname', m.el).value.trim()); m.close(); });
  $('#apply-here', m.el).addEventListener('click', () => { onApply(copy); m.close(); });
}

// Job panel used in the editor's "Optimise for Job" step and the standalone page.
export function jobPanel(container, getR, change, { onNewVersion } = {}) {
  const draw = () => {
    const r = getR();
    container.innerHTML = `
      <div class="field"><label for="tj">Target job title</label><input class="input" id="tj" list="job-profiles" value="${esc(r.targetJob)}" placeholder="e.g. Social Media Manager"></div>
      <div class="field"><label for="jdx">Job description <span class="opt">(paste the full listing)</span></label><textarea class="textarea" id="jdx" rows="8" placeholder="Paste the job description here…">${esc(r.jobDescription)}</textarea></div>
      <div class="field"><label for="jurl">…or job listing URL <span class="opt">(Optional)</span></label><div style="display:flex;gap:8px"><input class="input" id="jurl" placeholder="https://…"><button class="btn" id="jfetch">Fetch</button></div></div>
      <div class="add-row">
        <button class="btn btn-soft" id="b-analyse">${icon('search', 18)}Analyse job</button>
        <button class="btn btn-soft" id="b-match">${icon('target', 18)}Check match</button>
        <button class="btn btn-primary" id="b-opt">${icon('wand', 18)}One-click optimise</button>
      </div>
      <div id="j-out">${matchHTML(r.match)}${analysisHTML(r.analysis)}</div>`;

    const sync = () => {
      const r2 = getR();
      const jd = $('#jdx', container).value.trim();
      if (jd !== r2.jobDescription) { r2.jobDescription = jd; r2.match = null; }
      r2.targetJob = $('#tj', container).value.trim();
      change(r2, { silent: true });
      return r2;
    };
    $('#tj', container).addEventListener('change', sync);
    $('#jdx', container).addEventListener('change', sync);
    const needJD = () => { const r2 = sync(); if (!r2.jobDescription) { toast('Paste a job description first', 'error'); $('#jdx', container).focus(); return null; } return r2; };

    $('#jfetch', container).addEventListener('click', async (e) => {
      const url = $('#jurl', container).value.trim();
      if (!url) return;
      const text = await busy(e.currentTarget, () => fetchJob(url), 'Fetching…');
      if (text) { $('#jdx', container).value = text; sync(); toast('Job description fetched — check it looks right'); }
    });
    $('#b-analyse', container).addEventListener('click', async (e) => {
      const r2 = needJD(); if (!r2) return;
      const a = await busy(e.currentTarget, () => ai('analyze-job', { jobDescription: r2.jobDescription, targetJob: r2.targetJob }), 'Analysing…');
      if (!a) return;
      r2.analysis = a;
      if (!r2.targetJob && a.jobTitle) r2.targetJob = a.jobTitle;
      change(r2); draw();
    });
    $('#b-match', container).addEventListener('click', async (e) => {
      const r2 = needJD(); if (!r2) return;
      const res = await busy(e.currentTarget, async () => {
        if (!r2.analysis) r2.analysis = await ai('analyze-job', { jobDescription: r2.jobDescription, targetJob: r2.targetJob });
        return ai('match', { resume: r2, jobDescription: r2.jobDescription, targetJob: r2.targetJob });
      }, 'Comparing…');
      if (!res) return;
      r2.match = { ...res, at: Date.now() };
      change(r2); draw();
    });
    $('#b-opt', container).addEventListener('click', async (e) => {
      const r2 = needJD(); if (!r2) return;
      const o = await busy(e.currentTarget, async () => {
        if (!r2.analysis) r2.analysis = await ai('analyze-job', { jobDescription: r2.jobDescription, targetJob: r2.targetJob });
        return ai('optimize', { resume: r2, jobDescription: r2.jobDescription, targetJob: r2.targetJob, analysis: r2.analysis });
      }, 'Optimising…');
      if (!o) return;
      compareModal(r2, o, {
        onApply: (copy) => { copy.match = null; change(copy); toast('Optimised changes applied'); draw(); },
        onSaveNew: (copy, name) => {
          const saved = duplicateResume(r2.id);
          Object.assign(saved, copy, { id: saved.id, parentId: r2.id, title: name || `${r2.title} (Tailored)`, createdAt: Date.now(), match: null });
          saveResume(saved);
          toast('Saved as a new version — your original is unchanged');
          onNewVersion?.(saved);
        },
      });
    });
  };
  draw();
  return draw;
}

/* ---------------- Standalone pages ---------------- */
function pickResume(view, title, sub, target) {
  const resumes = listResumes();
  view.innerHTML = `<div class="page-head"><div><h1>${title}</h1><p>${sub}</p></div><a class="btn btn-primary" href="#/new">${icon('plus', 18)}New resume</a></div>
    ${resumes.length ? `<div class="card rlist">${resumes.map((r) => `<a class="ritem" style="grid-template-columns:auto 1fr auto" href="#/${target}/${r.id}"><div class="ritem-ic">${icon('file', 22)}</div><div><b>${esc(r.title)}</b><small>${esc(r.targetJob || 'No target job')}</small></div>${icon('chevRight', 20)}</a>`).join('')}</div>`
      : `<div class="card empty">${icon('file', 36)}<p>You don't have a resume yet.</p><div class="add-row" style="justify-content:center"><a class="btn btn-primary" href="#/new">Create Resume</a><a class="btn" href="#/new?mode=upload">Upload existing resume</a></div></div>`}`;
}

export function renderAtsPage(view, id) {
  const r0 = id && getResume(id);
  if (!r0) return pickResume(view, 'ATS Checker', 'Choose a resume to check for ATS compatibility.', 'ats');
  let r = JSON.parse(JSON.stringify(r0));
  const draw = () => {
    view.innerHTML = `<div class="page-head"><div><h1>ATS Checker</h1><p>${esc(r.title)}</p></div>
      <div class="add-row"><a class="btn" href="#/ats">Change resume</a><a class="btn btn-primary" href="#/editor/${r.id}">${icon('pencil', 18)}Open in editor</a></div></div>
      <div class="two-col"><div id="rep">${atsReportHTML(r)}</div>
      <div class="card" style="padding:16px;overflow:hidden"><div id="mini" style="transform-origin:top left"></div></div></div>`;
    const mini = $('#mini', view);
    mini.innerHTML = renderResume(r);
    const w = mini.parentElement.clientWidth - 32;
    const pw = styleOf(r).page.w;
    mini.style.transform = `scale(${Math.min(1, w / pw)})`;
    mini.parentElement.style.height = `${mini.firstElementChild.offsetHeight * Math.min(1, w / pw) + 32}px`;
    $('#copy-text', view)?.addEventListener('click', () => copyText(runAtsChecks(r).text));
    $$('[data-fix]', view).forEach((b) => b.addEventListener('click', () => applyAtsFix(r, b.dataset.fix, b, {
      change: (nr) => { r = nr; saveResume(r); draw(); },
      goto: (sec) => { location.hash = sec === 'optimise' ? `#/editor/${r.id}/optimise` : `#/editor/${r.id}/details?section=${sec}`; },
    })));
  };
  draw();
}

export function renderOptimiserPage(view, id) {
  const r0 = id && getResume(id);
  if (!r0) return pickResume(view, 'Job Optimiser', 'Choose the resume you want to tailor. Your original stays unchanged when you save a new version.', 'optimiser');
  let r = JSON.parse(JSON.stringify(r0));
  view.innerHTML = `<div class="page-head"><div><h1>Job Optimiser</h1><p>${esc(r.title)} — paste a job description to analyse, match and tailor your resume.</p></div>
    <div class="add-row"><a class="btn" href="#/optimiser">Change resume</a><a class="btn btn-primary" href="#/editor/${r.id}/optimise">Open in editor ${icon('arrowRight', 18)}</a></div></div>
    <div class="card card-pad" id="jp" style="max-width:980px"></div>`;
  jobPanel($('#jp', view), () => r, (nr) => { r = nr; saveResume(r); }, { onNewVersion: (s) => { location.hash = `#/editor/${s.id}`; } });
}

export { TEMPLATES, DEFAULT_ORDER, uid };
