// Resume editor: 4-step wizard with live preview, autosave, undo/redo and AI help.
import { icon, esc, $, $$, toast, busy, modal, copyText, timeAgo } from '../ui.js';
import { getResume, saveResume, uid } from '../store.js';
import { ai, downloadDocx } from '../api.js';
import { SECTIONS, PERSONAL_FIELDS, hasContent, sectionTitle, sectionKind, visibleSections } from '../schema.js';
import { renderResume, styleOf, plainText } from '../render.js';
import { TEMPLATES, CATEGORIES, FONTS, ACCENTS, getTemplate } from '../templates.js';
import { runAtsChecks } from '../ats.js';
import { SAMPLE } from '../data.js';
import { atsReportHTML, applyAtsFix, grammarReview, jobPanel, printResume, defaultFileName } from './analysis.js';
import { siteFooter } from '../app.js';

const STEPS = [
  { id: 'details', label: 'Add Details' },
  { id: 'template', label: 'Choose Template' },
  { id: 'optimise', label: 'Optimise for Job' },
  { id: 'download', label: 'Review & Download' },
];

const DEFAULT_ENABLED = {
  experienced: ['summary', 'experience', 'education', 'skills', 'projects', 'certifications'],
  switcher: ['summary', 'experience', 'skills', 'projects', 'education', 'certifications', 'courses'],
  fresher: ['summary', 'education', 'projects', 'internships', 'skills', 'certifications', 'achievements'],
  student: ['summary', 'education', 'projects', 'internships', 'skills', 'achievements', 'activities'],
};

export function renderEditor(root, id, step, query) {
  const stored = getResume(id);
  if (!stored) {
    root.innerHTML = `<div class="empty" style="padding:80px">${icon('file', 40)}<h2>Resume not found</h2><p>It may have been deleted or saved in another browser.</p><a class="btn btn-primary" href="#/">Go to dashboard</a></div>`;
    return;
  }
  let r = JSON.parse(JSON.stringify(stored));
  r.enabled ||= [...new Set([...(DEFAULT_ENABLED[r.experienceLevel] || DEFAULT_ENABLED.experienced), ...r.sectionOrder.filter((k) => hasContent(r, k))])];
  r.customTitles ||= {};
  r.hidden ||= {};

  let active = query.get('section') || 'personal';
  let zoom = 'fit';
  let prevTab = 'preview';
  const history = [JSON.stringify(r)];
  let hIndex = 0;
  let histTimer;

  root.innerHTML = `
    <header class="ed-top">
      <a class="brand" href="#/"><img class="brand-logo" src="img/logo.svg" alt="HireReady home"><span><b>HireReady</b><small>ATS Resume Builder</small></span></a>
      <nav class="wizard" aria-label="Steps">${STEPS.map((s, i) => `${i ? `<span class="wz-sep">${icon('chevRight', 16)}</span>` : ''}<button class="wz" data-step="${s.id}"><i>${i + 1}</i><span>${s.label}</span></button>`).join('')}</nav>
      <div class="ed-actions">
        <button class="icon-btn" id="undo" aria-label="Undo" title="Undo (Ctrl+Z)">${icon('undo')}</button>
        <button class="icon-btn" id="redo" aria-label="Redo" title="Redo (Ctrl+Y)">${icon('redo')}</button>
        <button class="btn mobile-prev-toggle" id="mprev">${icon('eye', 18)}<span>Preview</span></button>
        <button class="btn" id="save">${icon('cloud', 18)}<span>Save</span></button>
        <button class="btn btn-primary" id="next"><span>Next</span>${icon('arrowRight', 18)}</button>
      </div>
    </header>
    <div class="editor">
      <aside class="ed-nav" id="ed-nav"></aside>
      <section class="ed-form" id="ed-form"></section>
      <section class="ed-prev mobile-hidden" id="ed-prev">
        <div class="prev-tabs">
          <button class="ptab on" data-ptab="preview">Resume Preview</button>
          <button class="ptab" data-ptab="ats">ATS Analysis <span class="pill" id="ats-pill">–</span></button>
          <button class="icon-btn" id="expand" aria-label="Full preview">${icon('expand')}</button>
        </div>
        <div class="prev-scroll" id="prev-scroll"><div class="prev-stage page-guides" id="stage"></div></div>
        <div class="prev-foot">
          <span class="muted small" id="pages">Page 1 / 1</span>
          <div class="zoom"><button class="icon-btn" id="zout" aria-label="Zoom out">${icon('minus', 18)}</button><span id="zlbl">Fit</span><button class="icon-btn" id="zin" aria-label="Zoom in">${icon('plus', 18)}</button></div>
          <button class="btn btn-sm" id="full">${icon('expand', 16)}Full Preview</button>
        </div>
      </section>
    </div>
    ${siteFooter('slim')}`;

  const form = $('#ed-form', root);
  const nav = $('#ed-nav', root);

  /* ---------- state changes ---------- */
  function change(nr = r, { silent = false, noHistory = false } = {}) {
    r = nr;
    saveResume(r);
    if (!noHistory) {
      clearTimeout(histTimer);
      histTimer = setTimeout(() => {
        const snap = JSON.stringify(r);
        if (snap === history[hIndex]) return;
        history.splice(hIndex + 1);
        history.push(snap);
        if (history.length > 80) history.shift();
        hIndex = history.length - 1;
        updateUndo();
      }, 500);
    }
    updatePreview();
    updateNavStatus();
    if (!silent) updateSaved();
  }
  const updateUndo = () => { $('#undo', root).disabled = hIndex <= 0; $('#redo', root).disabled = hIndex >= history.length - 1; };
  function travel(d) {
    clearTimeout(histTimer);
    const ni = hIndex + d;
    if (ni < 0 || ni >= history.length) return;
    hIndex = ni;
    r = JSON.parse(history[hIndex]);
    saveResume(r);
    renderAll();
    updateUndo();
  }
  const updateSaved = () => { const el = $('#saved', root); if (el) el.textContent = `Last saved ${timeAgo(r.updatedAt)}`; };

  /* ---------- preview ---------- */
  function updatePreview() {
    const stage = $('#stage', root);
    const scroll = $('#prev-scroll', root);
    if (prevTab === 'ats') {
      stage.style.transform = '';
      stage.innerHTML = atsReportHTML(r, { compact: true });
      bindAtsFixes(stage);
    } else {
      stage.innerHTML = renderResume(r, { placeholder: true });
      const st = styleOf(r);
      const avail = scroll.clientWidth - 44;
      const scale = zoom === 'fit' ? Math.min(1, avail / st.page.w) : zoom;
      stage.style.transform = `scale(${scale})`;
      stage.style.width = `${st.page.w}px`;
      const doc = stage.firstElementChild;
      const h = doc.offsetHeight;
      const padPx = st.margin * 3.7795;
      const usable = st.page.h - padPx * 2;
      const pages = Math.max(1, Math.ceil((h - padPx * 2 - 1) / usable));
      for (let i = 1; i < pages; i++) {
        const line = document.createElement('div');
        line.className = 'pg-line';
        line.style.top = `${padPx + usable * i}px`;
        line.innerHTML = `<span>Page ${i + 1}</span>`;
        stage.appendChild(line);
      }
      stage.style.height = `${h}px`;
      stage.parentElement.style.height = '';
      $('#stage', root).style.marginBottom = `${-(h * (1 - scale))}px`;
      $('#pages', root).textContent = `${pages} page${pages > 1 ? 's' : ''} · ${st.tpl.name}`;
      $('#zlbl', root).textContent = zoom === 'fit' ? `${Math.round(scale * 100)}%` : `${Math.round(zoom * 100)}%`;
      r._pages = pages;
    }
    const score = runAtsChecks(r).score;
    const pill = $('#ats-pill', root);
    pill.textContent = `${score}%`;
    pill.className = `pill ${score >= 80 ? '' : score >= 60 ? 'warn' : 'bad'}`;
  }

  function bindAtsFixes(scope) {
    $$('[data-fix]', scope).forEach((b) => b.addEventListener('click', () => applyAtsFix(r, b.dataset.fix, b, {
      change: (nr) => { change(nr); renderForm(); },
      goto: (sec) => {
        if (sec === 'optimise') return setStep('optimise');
        if (!r.enabled.includes(sec) && SECTIONS[sec]) r.enabled.push(sec);
        active = sec; setStep('details');
      },
    })));
  }

  /* ---------- left nav ---------- */
  function personalStatus() {
    const req = PERSONAL_FIELDS.filter((f) => f.required);
    const n = req.filter((f) => r.personal[f.key]?.trim()).length;
    return n === req.length ? 'full' : n ? 'part' : '';
  }
  function navItems() {
    const order = r.sectionOrder.filter((k) => r.enabled.includes(k));
    return order;
  }
  function renderNav() {
    if (step !== 'details') {
      nav.innerHTML = `<div class="ed-title"><div><b>${esc(r.title)}</b><small id="saved">Last saved ${timeAgo(r.updatedAt)}</small></div></div>
        <div class="sec-nav">${STEPS.map((s, i) => `<button class="sec-item ${s.id === step ? 'on' : ''}" data-step="${s.id}">${icon(['user', 'grid', 'target', 'download'][i], 20)}${s.label}</button>`).join('')}</div>
        ${aiBox()}`;
      $$('[data-step]', nav).forEach((b) => b.addEventListener('click', () => setStep(b.dataset.step)));
      bindAiBox();
      return;
    }
    nav.innerHTML = `<div class="ed-title"><div style="min-width:0;flex:1"><b id="rtitle">${esc(r.title)}</b><small id="saved">Last saved ${timeAgo(r.updatedAt)}</small></div><button class="icon-btn" id="rename" aria-label="Rename resume">${icon('pencil', 18)}</button></div>
      <div class="sec-nav" id="sec-nav">
        <button class="sec-item ${active === 'personal' ? 'on' : ''}" data-sec="personal">${icon('user', 21)}Personal Info<span class="ok ${personalStatus()}" data-ok="personal"></span></button>
        ${navItems().map((k) => `<button class="sec-item ${active === k ? 'on' : ''}" data-sec="${k}" draggable="true"><span class="grip" title="Drag to reorder">${icon('drag', 14)}</span>${icon(SECTIONS[k]?.icon || 'file', 21)}<span style="min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(SECTIONS[k] ? SECTIONS[k].label : sectionTitle(r, k))}</span>${r.hidden[k] ? `<span class="hid" title="Hidden from resume">${icon('eyeOff', 16)}</span>` : `<span class="ok" data-ok="${k}"></span>`}</button>`).join('')}
        <button class="sec-item ${active === 'add' ? 'on' : ''}" data-sec="add">${icon('plusCircle', 21)}Additional Sections</button>
      </div>
      ${aiBox()}`;
    updateNavStatus();
    $$('[data-sec]', nav).forEach((b) => b.addEventListener('click', () => { active = b.dataset.sec; renderNav(); renderForm(); form.scrollTop = 0; }));
    $('#rename', nav).addEventListener('click', () => {
      const t = $('#rtitle', nav);
      t.outerHTML = `<input id="rtitle-in" value="${esc(r.title)}" aria-label="Resume name">`;
      const inp = $('#rtitle-in', nav);
      inp.focus(); inp.select();
      const done = () => { r.title = inp.value.trim() || r.title; change(); renderNav(); };
      inp.addEventListener('blur', done);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
    });
    // Drag & drop reordering
    let dragKey = null;
    $$('[draggable]', nav).forEach((el) => {
      el.addEventListener('dragstart', (e) => { dragKey = el.dataset.sec; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
      el.addEventListener('dragend', () => { el.classList.remove('dragging'); $$('.drop-above', nav).forEach((x) => x.classList.remove('drop-above')); });
      el.addEventListener('dragover', (e) => { e.preventDefault(); $$('.drop-above', nav).forEach((x) => x.classList.remove('drop-above')); el.classList.add('drop-above'); });
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        const to = el.dataset.sec;
        if (!dragKey || dragKey === to) return;
        moveSection(dragKey, to);
      });
    });
    bindAiBox();
  }
  function moveSection(key, beforeKey) {
    const o = r.sectionOrder.filter((k) => k !== key);
    o.splice(o.indexOf(beforeKey), 0, key);
    r.sectionOrder = o;
    change(); renderNav();
  }
  function shiftSection(key, d) {
    const items = navItems();
    const i = items.indexOf(key);
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const o = [...r.sectionOrder];
    const a = o.indexOf(items[i]); const b = o.indexOf(items[j]);
    [o[a], o[b]] = [o[b], o[a]];
    r.sectionOrder = o;
    change(); renderNav(); renderForm();
  }
  function updateNavStatus() {
    $$('[data-ok]', nav).forEach((el) => {
      const k = el.dataset.ok;
      const s = k === 'personal' ? personalStatus() : hasContent(r, k) ? 'full' : '';
      el.className = `ok ${s}`;
      el.innerHTML = s === 'full' ? icon('check', 14) : s === 'part' ? icon('check', 16) : '';
    });
    updateSaved();
  }

  const aiBox = () => `<div class="ai-box"><h4>${icon('sparkles', 20)}AI Writing Assistant</h4><p>Improve your content, fix grammar and make it more professional.</p><button class="btn btn-outline btn-block" id="improve-all">${icon('sparkles', 18)}Improve My Resume</button></div>`;
  const bindAiBox = () => $('#improve-all', nav)?.addEventListener('click', (e) => grammarReview(r, e.currentTarget, (nr) => { change(nr); renderForm(); }));

  /* ---------- forms ---------- */
  function renderForm() {
    if (step === 'template') return templateForm();
    if (step === 'optimise') return optimiseForm();
    if (step === 'download') return downloadForm();
    if (active === 'personal') return personalForm();
    if (active === 'add') return addSectionForm();
    const kind = sectionKind(active);
    if (active === 'summary') return summaryForm();
    if (kind === 'tags') return skillsForm();
    if (kind === 'list') return listForm(active);
    return entriesForm(active);
  }

  function sectionHead(key, lead) {
    const items = navItems();
    const i = items.indexOf(key);
    return `<div class="form-head"><div><h2>${esc(sectionTitle(r, key))}</h2><p class="lead">${esc(lead || SECTIONS[key]?.hint || '')}</p></div>
      <div style="display:flex;gap:2px;flex:none">
        <button class="icon-btn" data-h="up" aria-label="Move section up" ${i <= 0 ? 'disabled' : ''}>${icon('chevUp', 18)}</button>
        <button class="icon-btn" data-h="down" aria-label="Move section down" ${i >= items.length - 1 ? 'disabled' : ''}>${icon('chevDown', 18)}</button>
        <button class="icon-btn" data-h="rename" aria-label="Rename heading" title="Rename heading">${icon('pencil', 18)}</button>
        <button class="icon-btn" data-h="hide" aria-label="${r.hidden[key] ? 'Show on resume' : 'Hide from resume'}" title="${r.hidden[key] ? 'Show on resume' : 'Hide from resume'}">${icon(r.hidden[key] ? 'eyeOff' : 'eye', 18)}</button>
        <button class="icon-btn" data-h="remove" aria-label="Remove section" title="Remove section">${icon('trash', 18)}</button>
      </div></div>
      ${r.hidden[key] ? `<div class="hint">${icon('eyeOff', 18)}<div>This section is hidden and won't appear on your resume.</div></div>` : ''}`;
  }
  function bindSectionHead(key) {
    $('[data-h=up]', form)?.addEventListener('click', () => shiftSection(key, -1));
    $('[data-h=down]', form)?.addEventListener('click', () => shiftSection(key, 1));
    $('[data-h=hide]', form)?.addEventListener('click', () => { r.hidden[key] = !r.hidden[key]; change(); renderNav(); renderForm(); });
    $('[data-h=remove]', form)?.addEventListener('click', () => {
      if (hasContent(r, key) && !window.confirm('Remove this section and its content from the resume?')) return;
      r.enabled = r.enabled.filter((k) => k !== key);
      if (key === 'summary') r.summary = ''; else r.sections[key] = [];
      if (!SECTIONS[key]) { r.sectionOrder = r.sectionOrder.filter((k) => k !== key); delete r.sections[key]; delete r.customTitles[key]; }
      active = 'personal'; change(); renderNav(); renderForm();
    });
    $('[data-h=rename]', form)?.addEventListener('click', () => {
      const m = modal({
        title: 'Rename section heading',
        body: `<div class="field"><label for="hn">Heading</label><input class="input" id="hn" value="${esc(sectionTitle(r, key))}"></div><p class="small muted">${icon('info', 14)} ATS systems recognise standard headings like "Work Experience" best.</p>`,
        footer: `${SECTIONS[key] ? '<button class="btn" id="hreset">Reset to standard</button>' : ''}<button class="btn btn-primary" id="hsave">Save</button>`,
      });
      $('#hsave', m.el).addEventListener('click', () => { const v = $('#hn', m.el).value.trim(); if (v) r.customTitles[key] = v; change(); m.close(); renderNav(); renderForm(); });
      $('#hreset', m.el)?.addEventListener('click', () => { delete r.customTitles[key]; change(); m.close(); renderForm(); });
    });
  }

  function footerNav() {
    const items = ['personal', ...navItems()];
    const i = items.indexOf(active);
    const prev = items[i - 1];
    const next = items[i + 1];
    return `<div class="form-foot">${prev ? `<button class="btn" data-go="${prev}">${icon('arrowLeft', 18)}Back</button>` : '<span></span>'}
      ${next ? `<button class="btn btn-primary" data-go="${next}">Next: ${esc(next === 'personal' ? 'Personal Info' : SECTIONS[next]?.label || sectionTitle(r, next))}${icon('arrowRight', 18)}</button>` : `<button class="btn btn-primary" data-step-next>Choose a template ${icon('arrowRight', 18)}</button>`}</div>`;
  }
  function bindFooter() {
    $$('[data-go]', form).forEach((b) => b.addEventListener('click', () => { active = b.dataset.go; renderNav(); renderForm(); form.scrollTop = 0; }));
    $('[data-step-next]', form)?.addEventListener('click', () => setStep('template'));
  }

  /* Personal info */
  function personalForm() {
    const p = r.personal;
    const tpl = getTemplate(r.style.template);
    const q = r.pending?.questions || [];
    form.innerHTML = `<h2>Personal Information</h2><p class="lead">Add your basic details. Keep it professional and up to date.</p>
      ${q.length ? `<div class="ai-sug"><div class="ai-sug-head"><span class="ai-tag">${icon('sparkles', 16)}AI needs a few details</span><button class="icon-btn" id="q-x" aria-label="Dismiss">${icon('x', 16)}</button></div><ul class="small" style="margin:0;padding-left:18px">${q.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      <div class="grid2">
        ${PERSONAL_FIELDS.map((f) => `<div class="field ${f.half ? '' : 'full'}">
          <label for="p-${f.key}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}${f.optional ? ' <span class="opt">(Optional)</span>' : ''}${f.tip ? ` <span class="tipi" title="${esc(f.tip)}">${icon('info', 14)}</span>` : ''}</label>
          ${f.icon ? `<div class="with-ic">${icon(f.icon, 18)}` : ''}<input class="input" id="p-${f.key}" data-p="${f.key}" type="${f.type || 'text'}" value="${esc(p[f.key])}" placeholder="${esc(f.placeholder || '')}" ${f.max ? `maxlength="${f.max}"` : ''} ${f.list ? `list="${f.list}"` : ''} autocomplete="${{ fullName: 'name', email: 'email', phone: 'tel' }[f.key] || 'off'}">${f.icon ? '</div>' : ''}
          ${f.max ? `<span class="counter" id="cnt-${f.key}">${(p[f.key] || '').length}/${f.max}</span>` : ''}
          <span class="err hidden" id="err-${f.key}"></span>
          ${f.key === 'headline' ? '<div id="hl-slot"></div>' : ''}
        </div>`).join('')}
      </div>
      <div class="field"><span class="lbl">Profile Photo <span class="opt">(Optional)</span></span>
        <div class="photo-row"><div class="photo">${p.photo ? `<img src="${esc(p.photo)}" alt="Profile photo">` : icon('user', 40)}</div>
          <div><div class="add-row"><label class="btn">${icon('upload', 18)}${p.photo ? 'Change Photo' : 'Upload Photo'}<input type="file" id="photo" accept="image/jpeg,image/png" hidden></label>${p.photo ? `<button class="btn" id="photo-rm">${icon('trash', 18)}Remove</button>` : ''}</div>
          <p class="small muted" style="margin:8px 0 0">JPG or PNG, max 2 MB. Photos only show on creative templates${tpl.photo ? '' : ` — "${esc(tpl.name)}" won't show it`}. Most ATS and Indian/US employers don't need one.</p></div></div>
      </div>
      ${footerNav()}`;

    $('#q-x', form)?.addEventListener('click', () => { r.pending.questions = []; change(); personalForm(); });
    $$('[data-p]', form).forEach((inp) => inp.addEventListener('input', () => {
      const k = inp.dataset.p;
      r.personal[k] = inp.value;
      const c = $(`#cnt-${k}`, form); if (c) c.textContent = `${inp.value.length}/${inp.maxLength}`;
      change();
    }));
    $$('[data-p]', form).forEach((inp) => inp.addEventListener('blur', () => validate(inp)));
    headlineBox();
    $('#photo', form).addEventListener('change', (e) => loadPhoto(e.target.files[0]));
    $('#photo-rm', form)?.addEventListener('click', () => { r.personal.photo = ''; change(); personalForm(); });
    bindFooter();
  }
  function validate(inp) {
    const k = inp.dataset.p; const v = inp.value.trim(); const err = $(`#err-${k}`, form);
    let msg = '';
    if (k === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg = 'Please enter a valid email, e.g. name@gmail.com';
    if (k === 'phone' && v) {
      const d = v.replace(/\D/g, '');
      if (d.length < 10) msg = 'Phone number looks too short';
      else if ((v.startsWith('+91') || d.length === 10) && !/^(91)?[6-9]\d{9}$/.test(d)) msg = 'Indian mobile numbers have 10 digits starting with 6–9 (e.g. +91 98765 43210)';
    }
    if (k === 'phone' && v && /^[6-9]\d{9}$/.test(v.replace(/\s/g, ''))) {
      const d = v.replace(/\s/g, ''); inp.value = `+91 ${d.slice(0, 5)} ${d.slice(5)}`; r.personal.phone = inp.value; change();
    }
    inp.classList.toggle('invalid', !!msg);
    err.textContent = msg; err.classList.toggle('hidden', !msg);
  }
  function headlineBox() {
    const slot = $('#hl-slot', form);
    const draw = (list = r._headlines || []) => {
      slot.innerHTML = `<div class="ai-sug" style="margin:8px 0 0"><div class="ai-sug-head"><span class="ai-tag">${icon('sparkles', 16)}AI Suggestion</span><button class="icon-btn" id="hl-go" aria-label="Get headline ideas" title="Get headline ideas">${icon('refresh', 18)}</button></div>
        ${list.length ? `<p class="small" style="margin:0 0 10px">Professional headline ideas for you:</p><div class="chips">${list.map((h) => `<button class="chip ${h === r.personal.headline ? 'on' : ''}" data-hl="${esc(h)}">${esc(h)}${h === r.personal.headline ? icon('check', 16) : ''}</button>`).join('')}</div>` : '<p class="small muted" style="margin:0">Click refresh to get headline ideas based on your details and target job.</p>'}</div>`;
      $('#hl-go', slot).addEventListener('click', async (e) => {
        const res = await busy(e.currentTarget, () => ai('headline', { resume: r, targetJob: r.targetJob }), '');
        if (res?.headlines) { r._headlines = res.headlines.slice(0, 5); draw(); }
      });
      $$('[data-hl]', slot).forEach((b) => b.addEventListener('click', () => {
        r.personal.headline = b.dataset.hl.slice(0, 60);
        $('#p-headline', form).value = r.personal.headline;
        $('#cnt-headline', form).textContent = `${r.personal.headline.length}/60`;
        change(); draw();
      }));
    };
    draw();
  }
  function loadPhoto(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast('Photo must be under 2 MB', 'error');
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const c = document.createElement('canvas'); c.width = c.height = 300;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 300, 300);
      r.personal.photo = c.toDataURL('image/jpeg', 0.85);
      URL.revokeObjectURL(img.src);
      change(); personalForm();
    };
    img.onerror = () => toast('Could not read that image', 'error');
    img.src = URL.createObjectURL(file);
  }

  /* Summary */
  function summaryForm() {
    const key = 'summary';
    form.innerHTML = `${sectionHead(key)}
      <div class="field"><label for="sum">Summary</label><textarea class="textarea" id="sum" rows="6" placeholder="${esc(SECTIONS.summary.example)}">${esc(r.summary)}</textarea><span class="counter" id="sum-c">${(r.summary || '').split(/\s+/).filter(Boolean).length} words · aim for 40–80</span></div>
      <div class="add-row">
        <button class="btn btn-soft" id="sum-gen">${icon('sparkles', 18)}Generate with AI</button>
        <div style="display:inline-flex;gap:6px;align-items:center"><select class="select" id="sum-mode" style="width:auto"><option value="professional">Make professional</option><option value="concise">Make concise</option><option value="impactful">More impactful</option><option value="simplify">Simplify language</option><option value="grammar-only">Fix grammar only</option></select><button class="btn" id="sum-imp">Improve</button></div>
      </div>
      <div id="sum-out" style="margin-top:16px"></div>
      ${footerNav()}`;
    bindSectionHead(key);
    const ta = $('#sum', form);
    ta.addEventListener('input', () => { r.summary = ta.value; $('#sum-c', form).textContent = `${ta.value.split(/\s+/).filter(Boolean).length} words · aim for 40–80`; change(); });
    $('#sum-gen', form).addEventListener('click', async (e) => {
      const res = await busy(e.currentTarget, () => ai('summary', { resume: r, targetJob: r.targetJob, jobDescription: r.jobDescription }), 'Writing…');
      if (!res?.options) return;
      $('#sum-out', form).innerHTML = res.options.map((o, i) => `<div class="result-box"><b class="small">${esc(o.label)}</b><p style="margin:6px 0 0">${esc(o.text)}</p><div class="acts"><button class="btn btn-sm btn-primary" data-use="${i}">Use this</button></div></div>`).join('') + (res.note ? `<p class="why">${icon('info', 14)}${esc(res.note)}</p>` : '');
      $$('[data-use]', form).forEach((b) => b.addEventListener('click', () => { r.summary = res.options[+b.dataset.use].text; change(); summaryForm(); toast('Summary updated'); }));
    });
    $('#sum-imp', form).addEventListener('click', async (e) => {
      if (!r.summary.trim()) return toast('Write a summary first, or use Generate with AI', 'error');
      improveText(e.currentTarget, r.summary, $('#sum-mode', form).value, (t) => { r.summary = t; change(); summaryForm(); });
    });
    bindFooter();
  }
  async function improveText(btn, text, mode, apply) {
    const res = await busy(btn, () => ai('improve', { text, mode }), 'Improving…');
    if (!res?.improved) return;
    const m = modal({
      title: 'AI-improved version', wide: true,
      body: `<div class="diff"><div class="old"><h5>Before</h5>${esc(text)}</div><div class="new"><h5>After (suggested)</h5>${esc(res.improved)}</div></div>
        ${res.changes?.length ? `<h4 style="margin:18px 0 8px;font-size:14px">Why these changes</h4><ul class="small">${res.changes.slice(0, 8).map((c) => `<li><b>${esc(c.from)}</b> → ${esc(c.to)} <span class="muted">— ${esc(c.why)}</span></li>`).join('')}</ul>` : ''}`,
      footer: '<button class="btn" data-close>Keep original</button><button class="btn btn-primary" id="acc">Use improved version</button>',
    });
    $('#acc', m.el).addEventListener('click', () => { apply(res.improved); m.close(); toast('Updated'); });
  }

  /* Skills */
  function skillsForm() {
    const key = 'skills';
    const skills = r.sections.skills;
    const pend = (r.pending?.suggestedSkills || []).filter((s) => !skills.some((x) => x.toLowerCase() === s.toLowerCase()));
    form.innerHTML = `${sectionHead(key)}
      <div class="field"><label for="tag-in">Your skills</label><div class="tags-ed" id="tags">${skills.map((s, i) => `<span class="tag">${esc(s)}<button data-rm="${i}" aria-label="Remove ${esc(s)}">${icon('x', 14)}</button></span>`).join('')}<input id="tag-in" placeholder="${skills.length ? 'Add another…' : 'Type a skill and press Enter, e.g. SEO'}"></div>
      <span class="small muted">Tip: separate several with commas. Drag isn't needed — AI can reorder by relevance in the Optimise step.</span></div>
      ${pend.length ? `<div class="ai-sug"><div class="ai-sug-head"><span class="ai-tag">${icon('sparkles', 16)}Common for ${esc(r.targetJob || 'your target job')}</span></div><p class="small" style="margin:0 0 10px">Add only the skills you really have:</p><div class="chips">${pend.map((s) => `<button class="chip add" data-add="${esc(s)}">${icon('plus', 14)}${esc(s)}</button>`).join('')}</div></div>` : ''}
      <button class="btn btn-soft" id="sk-ai">${icon('sparkles', 18)}Suggest skills with AI</button>
      <div id="sk-out" style="margin-top:16px"></div>
      ${footerNav()}`;
    bindSectionHead(key);
    const inp = $('#tag-in', form);
    const add = (val) => {
      const vals = val.split(',').map((s) => s.trim()).filter(Boolean);
      for (const v of vals) if (!skills.some((x) => x.toLowerCase() === v.toLowerCase())) skills.push(v);
      change(); skillsForm(); $('#tag-in', form).focus();
    };
    inp.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ',') && inp.value.trim()) { e.preventDefault(); add(inp.value); }
      if (e.key === 'Backspace' && !inp.value && skills.length) { skills.pop(); change(); skillsForm(); $('#tag-in', form).focus(); }
    });
    inp.addEventListener('blur', () => { if (inp.value.trim()) add(inp.value); });
    $$('[data-rm]', form).forEach((b) => b.addEventListener('click', () => { skills.splice(+b.dataset.rm, 1); change(); skillsForm(); }));
    $$('[data-add]', form).forEach((b) => b.addEventListener('click', () => add(b.dataset.add)));
    $('#sk-ai', form).addEventListener('click', async (e) => {
      const res = await busy(e.currentTarget, () => ai('skills', { resume: r, targetJob: r.targetJob, jobDescription: r.jobDescription }), 'Thinking…');
      if (!res) return;
      const chip = (s, why, cls) => `<button class="chip add ${cls}" data-add="${esc(s)}" title="${esc(why || '')}">${icon('plus', 14)}${esc(s)}</button>`;
      $('#sk-out', form).innerHTML = `
        ${res.evidenced?.length ? `<div class="result-box"><b>Shown in your resume but not listed</b><p class="small muted">Your experience already proves these.</p><div class="chips">${res.evidenced.map((x) => chip(x.skill, x.evidence, '')).join('')}</div></div>` : ''}
        ${res.recommended?.length ? `<div class="result-box"><b>Recommended for ${esc(r.targetJob || 'this role')}</b><p class="small muted">Add only if you genuinely have them. Hover for why.</p><div class="chips">${res.recommended.map((x) => chip(x.skill, x.why, 'miss')).join('')}</div></div>` : ''}
        ${res.softSkills?.length ? `<div class="result-box"><b>Soft skills</b><div class="chips">${res.softSkills.map((s) => chip(s, '', 'miss')).join('')}</div></div>` : ''}`;
      $$('#sk-out [data-add]', form).forEach((b) => b.addEventListener('click', () => {
        const v = b.dataset.add;
        if (!skills.some((x) => x.toLowerCase() === v.toLowerCase())) skills.push(v);
        b.remove(); change();
        const tags = $('#tags', form);
        const sp = document.createElement('span'); sp.className = 'tag'; sp.textContent = v; tags.insertBefore(sp, $('#tag-in', form));
      }));
    });
    bindFooter();
  }

  /* Simple list (achievements, custom) */
  function listForm(key) {
    const arr = (r.sections[key] ||= []);
    if (!arr.length) arr.push('');
    const cfg = SECTIONS[key] || { hint: 'Add one item per line.', placeholder: '' };
    form.innerHTML = `${sectionHead(key, cfg.hint)}
      <div id="items">${arr.map((v, i) => `<div class="bullet-ed"><span class="dotc">•</span><textarea class="textarea" rows="1" data-i="${i}" placeholder="${esc(cfg.placeholder || '')}">${esc(v)}</textarea><button class="icon-btn" data-rm="${i}" aria-label="Remove">${icon('trash', 18)}</button></div>`).join('')}</div>
      <div class="add-row"><button class="btn" id="add-item">${icon('plus', 18)}Add item</button><button class="btn btn-soft" id="imp-items">${icon('sparkles', 18)}Improve with AI</button></div>
      ${footerNav()}`;
    bindSectionHead(key);
    $$('[data-i]', form).forEach((t) => t.addEventListener('input', () => { arr[+t.dataset.i] = t.value; change(); }));
    $$('[data-rm]', form).forEach((b) => b.addEventListener('click', () => { arr.splice(+b.dataset.rm, 1); change(); listForm(key); }));
    $('#add-item', form).addEventListener('click', () => { arr.push(''); change(); listForm(key); $$('[data-i]', form).pop()?.focus(); });
    $('#imp-items', form).addEventListener('click', (e) => rewriteBullets(e.currentTarget, arr.filter((x) => x.trim()), sectionTitle(r, key), (out) => { r.sections[key] = out; change(); listForm(key); }));
    bindFooter();
  }

  /* Entries (experience, education, projects…) */
  function entriesForm(key) {
    const cfg = SECTIONS[key];
    const arr = (r.sections[key] ||= []);
    const open = r._open?.[key] ?? (arr.length ? arr[arr.length - 1].id : null);
    form.innerHTML = `${sectionHead(key)}
      ${arr.map((e, i) => {
        const isOpen = e.id === open;
        const sub = [(cfg.sub || []).map((k) => e[k]).filter(Boolean).join(', ')].filter(Boolean).join('');
        return `<div class="entry" data-id="${e.id}">
          <div class="entry-head" data-toggle="${e.id}">${icon(isOpen ? 'chevDown' : 'chevRight', 18)}<div style="min-width:0"><b>${esc(e[cfg.head] || `New ${cfg.label.replace(/s$/, '').toLowerCase()}`)}</b><small>${esc(sub || 'Click to edit')}</small></div>
            <div class="acts"><button class="icon-btn" data-up="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${icon('chevUp', 16)}</button><button class="icon-btn" data-down="${i}" aria-label="Move down" ${i === arr.length - 1 ? 'disabled' : ''}>${icon('chevDown', 16)}</button><button class="icon-btn" data-del="${i}" aria-label="Delete entry">${icon('trash', 16)}</button></div></div>
          ${isOpen ? `<div class="entry-body"><div class="grid2">${cfg.fields.map((f) => fieldHTML(f, e)).join('')}</div></div>` : ''}
        </div>`;
      }).join('')}
      ${!arr.length ? `<div class="hint">${icon('info', 18)}<div>${esc(cfg.hint)} Click below to add your first entry.</div></div>` : ''}
      <div class="add-row"><button class="btn btn-outline" id="add-entry">${icon('plus', 18)}Add ${esc(cfg.label.replace(/s$/, '').replace(/ies$/, 'y'))}</button></div>
      ${footerNav()}`;
    bindSectionHead(key);

    const setOpen = (id) => { r._open = { ...(r._open || {}), [key]: id }; entriesForm(key); };
    $$('[data-toggle]', form).forEach((h) => h.addEventListener('click', (ev) => { if (ev.target.closest('.acts')) return; setOpen(h.dataset.toggle === open ? '' : h.dataset.toggle); }));
    $$('[data-del]', form).forEach((b) => b.addEventListener('click', () => { if (!window.confirm('Delete this entry?')) return; arr.splice(+b.dataset.del, 1); change(); entriesForm(key); }));
    $$('[data-up]', form).forEach((b) => b.addEventListener('click', () => { const i = +b.dataset.up; [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; change(); entriesForm(key); }));
    $$('[data-down]', form).forEach((b) => b.addEventListener('click', () => { const i = +b.dataset.down; [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; change(); entriesForm(key); }));
    $('#add-entry', form).addEventListener('click', () => {
      const e = { id: uid() };
      for (const f of cfg.fields) if (f.type === 'bullets') e.bullets = ['']; else if (f.type === 'checkbox') e[f.key] = false; else if (f.type !== 'spacer') e[f.key] = '';
      arr.push(e); change(); setOpen(e.id);
      $('.entry-body input', form)?.focus();
    });

    const entry = arr.find((e) => e.id === open);
    if (!entry) return bindFooter();
    const body = $(`.entry[data-id="${open}"] .entry-body`, form);
    $$('[data-f]', body).forEach((inp) => {
      const k = inp.dataset.f;
      const ev = inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input';
      inp.addEventListener(ev, () => {
        entry[k] = inp.type === 'checkbox' ? inp.checked : inp.value;
        if (k === 'current') { const end = $('[data-f=end]', body); if (end) { end.disabled = inp.checked; if (inp.checked) { end.value = ''; entry.end = ''; } } }
        if (k === cfg.head || (cfg.sub || []).includes(k)) {
          const h = $(`.entry[data-id="${open}"] .entry-head b`, form); if (k === cfg.head && h) h.textContent = inp.value || 'Untitled';
        }
        change();
      });
    });
    // Bullets
    const bl = $('[data-bullets]', body);
    if (bl) {
      const drawBullets = () => {
        entry.bullets ||= [''];
        bl.innerHTML = `${entry.bullets.map((b, i) => `<div class="bullet-ed"><span class="dotc">•</span><textarea class="textarea" rows="2" data-b="${i}" placeholder="${esc(cfg.fields.find((f) => f.type === 'bullets').placeholder)}">${esc(b)}</textarea><button class="icon-btn" data-brm="${i}" aria-label="Remove bullet">${icon('x', 16)}</button></div>`).join('')}
          <div class="add-row"><button class="btn btn-sm" data-badd>${icon('plus', 16)}Add bullet</button><button class="btn btn-sm btn-soft" data-bai>${icon('sparkles', 16)}Rewrite with AI</button></div>
          <p class="why">${icon('info', 14)}Write in plain words — e.g. "I handled insta page and made posts". AI turns it into a professional, accomplishment-focused bullet without adding fake facts.</p>`;
        $$('[data-b]', bl).forEach((t) => {
          t.addEventListener('input', () => { entry.bullets[+t.dataset.b] = t.value; change(); });
          t.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); entry.bullets.splice(+t.dataset.b + 1, 0, ''); change(); drawBullets(); $(`[data-b="${+t.dataset.b + 1}"]`, bl)?.focus(); } });
        });
        $$('[data-brm]', bl).forEach((b) => b.addEventListener('click', () => { entry.bullets.splice(+b.dataset.brm, 1); if (!entry.bullets.length) entry.bullets.push(''); change(); drawBullets(); }));
        $('[data-badd]', bl).addEventListener('click', () => { entry.bullets.push(''); change(); drawBullets(); $$('[data-b]', bl).pop()?.focus(); });
        $('[data-bai]', bl).addEventListener('click', (e) => {
          const src = entry.bullets.filter((b) => b.trim());
          if (!src.length) return toast('Write at least one bullet in your own words first', 'error');
          const role = [entry.title || entry.name || entry.degree, entry.company || entry.institution || entry.tech].filter(Boolean).join(' at ');
          rewriteBullets(e.currentTarget, src, role, (out) => { entry.bullets = out; change(); drawBullets(); });
        });
      };
      drawBullets();
    }
    bindFooter();
  }

  function fieldHTML(f, e) {
    if (f.type === 'spacer') return '<div></div>';
    const id = `f-${f.key}-${e.id}`;
    const label = `<label for="${id}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>`;
    const cls = f.half ? '' : 'full';
    if (f.type === 'bullets') return `<div class="field full"><span class="lbl">${esc(f.label)}</span><div data-bullets></div></div>`;
    if (f.type === 'checkbox') return `<label class="check full"><input type="checkbox" data-f="${f.key}" ${e[f.key] ? 'checked' : ''}>${esc(f.label)}</label>`;
    if (f.type === 'select') return `<div class="field ${cls}">${label}<select class="select" id="${id}" data-f="${f.key}"><option value="">Select…</option>${f.options.map((o) => `<option ${e[f.key] === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
    if (f.type === 'month') {
      const v = e[f.key] || '';
      const isMonth = /^\d{4}-\d{2}$/.test(v) || !v;
      const dis = f.key === 'end' && e.current ? 'disabled' : '';
      return `<div class="field ${cls}">${label}<input class="input" id="${id}" data-f="${f.key}" type="${isMonth ? 'month' : 'text'}" value="${esc(v)}" placeholder="YYYY-MM" ${dis}></div>`;
    }
    return `<div class="field ${cls}">${label}<input class="input" id="${id}" data-f="${f.key}" value="${esc(e[f.key] || '')}" placeholder="${esc(f.placeholder || '')}"></div>`;
  }

  async function rewriteBullets(btn, bullets, role, apply) {
    const res = await busy(btn, () => ai('bullets', { bullets, role, targetJob: r.targetJob }), 'Rewriting…');
    if (!res?.bullets?.length) return;
    const m = modal({
      title: 'AI-improved bullet points', wide: true,
      body: `<p class="small muted" style="margin-top:0">Tick the versions you want to keep. Replace any [number] placeholders with your real figures.</p>
        ${res.bullets.map((b, i) => `<div class="result-box"><label class="check" style="margin:0 0 8px"><input type="checkbox" data-k="${i}" checked> Use improved version</label>
          <div class="diff"><div class="old"><h5>Before</h5>${esc(b.original)}</div><div class="new"><h5>After</h5><textarea class="textarea" rows="2" data-t="${i}" style="min-height:0;background:transparent;border:0;padding:0">${esc(b.improved)}</textarea></div></div>
          ${b.why ? `<p class="why">${icon('info', 14)}${esc(b.why)}</p>` : ''}</div>`).join('')}`,
      footer: '<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="bok">Apply selected</button>',
    });
    $('#bok', m.el).addEventListener('click', () => {
      const out = res.bullets.map((b, i) => ($(`[data-k="${i}"]`, m.el).checked ? $(`[data-t="${i}"]`, m.el).value.trim() : b.original)).filter(Boolean);
      apply(out); m.close(); toast('Bullets updated');
    });
  }

  /* Additional sections */
  function addSectionForm() {
    const avail = Object.entries(SECTIONS).filter(([k]) => !r.enabled.includes(k));
    form.innerHTML = `<h2>Additional Sections</h2><p class="lead">Add sections that strengthen your resume. Empty sections are hidden automatically.</p>
      <div class="tpl-grid" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px">
        ${avail.map(([k, c]) => `<button class="start-card" style="padding:18px" data-addsec="${k}">${icon(c.icon, 24)}<b style="font-size:16px">${esc(c.label)}</b><p class="small">${esc(c.hint)}</p></button>`).join('')}
        <button class="start-card" style="padding:18px" id="custom">${icon('plusCircle', 24)}<b style="font-size:16px">Custom section</b><p class="small">Create your own, e.g. "Hobbies" or "Training".</p></button>
      </div>
      <h3 style="margin:30px 0 10px;font-size:18px">Formatting options</h3>
      <label class="check"><input type="checkbox" id="hide-empty" checked disabled>Hide empty sections automatically</label>`;
    $$('[data-addsec]', form).forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.addsec;
      r.enabled.push(k);
      if (!r.sectionOrder.includes(k)) r.sectionOrder.push(k);
      r.sections[k] ||= [];
      active = k; change(); renderNav(); renderForm();
    }));
    $('#custom', form).addEventListener('click', () => {
      const m = modal({ title: 'Custom section', body: '<div class="field"><label for="cs">Section heading</label><input class="input" id="cs" placeholder="e.g. Training & Workshops"></div>', footer: '<button class="btn btn-primary" id="csok">Add section</button>' });
      $('#csok', m.el).addEventListener('click', () => {
        const name = $('#cs', m.el).value.trim(); if (!name) return;
        const k = `custom_${uid()}`;
        r.customTitles[k] = name; r.sections[k] = ['']; r.enabled.push(k); r.sectionOrder.push(k);
        active = k; m.close(); change(); renderNav(); renderForm();
      });
    });
  }

  /* Step 2: Templates & design */
  function templateForm() {
    const s = r.style;
    const cat = r._cat || 'all';
    const base = r.personal.fullName ? r : { ...SAMPLE, personal: { ...SAMPLE.personal } };
    const shown = TEMPLATES.filter((t) => cat === 'all' || (cat === 'ats' ? t.ats : t.category === cat));
    form.innerHTML = `<h2>Choose a Template</h2><p class="lead">Switch anytime — your content is kept. <b>ATS-safe</b> templates are single-column and tested with our checker.</p>
      <div class="filters">${CATEGORIES.map((c) => `<button class="chip ${c.id === cat ? 'on' : ''}" data-cat="${c.id}">${c.label}</button>`).join('')}</div>
      <div class="tpl-grid" style="margin-bottom:34px">${shown.map((t) => `<button class="tpl-card ${t.id === s.template ? 'on' : ''}" data-tpl="${t.id}"><div class="tpl-thumb"><div class="tpl-scale">${renderResume({ ...base, style: { ...s, template: t.id, font: '', accent: '' } })}</div></div><div class="tpl-info"><b>${t.name}</b><small>${t.desc}</small><br>${t.ats ? '<span class="badge">ATS-friendly</span>' : '<span class="badge warn">Check ATS compatibility</span>'}</div></button>`).join('')}</div>

      <h3 style="font-size:20px;margin-bottom:14px">Customise design</h3>
      <div class="style-panel">
        <div class="field"><label for="st-font">Font</label><select class="select" id="st-font"><option value="">Template default</option>${Object.keys(FONTS).map((f) => `<option ${s.font === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
        <div class="field"><span class="lbl">Accent colour</span><div class="swatches">${ACCENTS.map((c) => `<button class="sw ${s.accent === c ? 'on' : ''}" style="background:${c}" data-acc="${c}" aria-label="Accent ${c}"></button>`).join('')}<input type="color" id="st-acc" value="${s.accent || getTemplate(s.template).accent}" style="width:32px;height:30px;border:0;background:none;padding:0" aria-label="Custom colour"></div></div>
        ${range('fontSize', 'Font size', 9, 12.5, 0.5, 'pt')}
        ${range('lineHeight', 'Line spacing', 1.1, 1.7, 0.05, '')}
        ${range('margin', 'Page margins', 8, 25, 1, 'mm')}
        ${range('sectionGap', 'Section spacing', 4, 26, 1, 'px')}
        <div class="field"><span class="lbl">Page size</span><div class="seg"><button data-ps="a4" class="${s.pageSize !== 'letter' ? 'on' : ''}">A4</button><button data-ps="letter" class="${s.pageSize === 'letter' ? 'on' : ''}">US Letter</button></div></div>
        <div class="field"><label for="st-df">Date format</label><select class="select" id="st-df">${['MMM YYYY', 'MMMM YYYY', 'MM/YYYY', 'YYYY'].map((f) => `<option ${s.dateFormat === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
        <div class="field"><span class="lbl">Length</span><button class="btn btn-sm" id="fit1">${icon('compare', 16)}Fit to one page</button></div>
        <label class="check" style="align-self:end"><input type="checkbox" id="st-photo" ${s.showPhoto !== false ? 'checked' : ''}>Show photo (creative templates)</label>
      </div>
      <div class="form-foot"><button class="btn" data-stepgo="details">${icon('arrowLeft', 18)}Back to details</button><button class="btn btn-primary" data-stepgo="optimise">Next: Optimise for Job ${icon('arrowRight', 18)}</button></div>`;

    $$('[data-cat]', form).forEach((b) => b.addEventListener('click', () => { r._cat = b.dataset.cat; templateForm(); }));
    $$('[data-tpl]', form).forEach((b) => b.addEventListener('click', () => {
      s.template = b.dataset.tpl; s.font = ''; s.accent = '';
      const t = getTemplate(s.template);
      change(); templateForm();
      toast(t.ats ? `${t.name} applied` : `${t.name} applied — great for portfolios, but use an ATS-safe template for online applications`, t.ats ? 'ok' : 'info', 4500);
    }));
    $('#st-font', form).addEventListener('change', (e) => { s.font = e.target.value; change(); });
    $$('[data-acc]', form).forEach((b) => b.addEventListener('click', () => { s.accent = b.dataset.acc; change(); $$('[data-acc]', form).forEach((x) => x.classList.toggle('on', x === b)); }));
    $('#st-acc', form).addEventListener('input', (e) => { s.accent = e.target.value; change(); });
    $$('[data-range]', form).forEach((inp) => inp.addEventListener('input', () => { s[inp.dataset.range] = +inp.value; inp.nextElementSibling.textContent = `${inp.value}${inp.dataset.unit}`; change(); }));
    $$('[data-ps]', form).forEach((b) => b.addEventListener('click', () => { s.pageSize = b.dataset.ps; change(); templateForm(); }));
    $('#st-df', form).addEventListener('change', (e) => { s.dateFormat = e.target.value; change(); });
    $('#st-photo', form).addEventListener('change', (e) => { s.showPhoto = e.target.checked; change(); });
    $('#fit1', form).addEventListener('click', () => {
      const tries = [['sectionGap', 8], ['lineHeight', 1.25], ['margin', 12], ['fontSize', 10], ['sectionGap', 6], ['lineHeight', 1.15], ['fontSize', 9.5], ['margin', 10]];
      for (const [k, v] of tries) {
        if (r._pages <= 1) break;
        if (s[k] > v) { s[k] = v; updatePreview(); }
      }
      change(); templateForm();
      toast(r._pages <= 1 ? 'Fitted to one page' : 'Still more than one page — try shortening older roles or bullets', r._pages <= 1 ? 'ok' : 'info');
    });
    $$('[data-stepgo]', form).forEach((b) => b.addEventListener('click', () => setStep(b.dataset.stepgo)));
  }
  function range(key, label, min, max, stp, unit) {
    const v = r.style[key];
    return `<div class="field"><label>${label}</label><div class="range-row"><input type="range" min="${min}" max="${max}" step="${stp}" value="${v}" data-range="${key}" data-unit="${unit}" aria-label="${label}"><output>${v}${unit}</output></div></div>`;
  }

  /* Step 3: Optimise */
  function optimiseForm() {
    form.innerHTML = `<h2>Optimise for Job</h2><p class="lead">Paste the job description. AI analyses it, scores your match and tailors your resume — without inventing anything.</p><div id="jp"></div>
      <div class="form-foot"><button class="btn" data-stepgo="template">${icon('arrowLeft', 18)}Back</button><button class="btn btn-primary" data-stepgo="download">Next: Review &amp; Download ${icon('arrowRight', 18)}</button></div>`;
    jobPanel($('#jp', form), () => r, (nr, o) => change(nr, o), {
      onNewVersion: (saved) => { location.hash = `#/editor/${saved.id}/optimise`; },
    });
    $$('[data-stepgo]', form).forEach((b) => b.addEventListener('click', () => setStep(b.dataset.stepgo)));
  }

  /* Step 4: Download */
  function downloadForm() {
    const rep = runAtsChecks(r);
    const issues = rep.checks.filter((c) => c.status === 'fail');
    const fname = r._fileName || defaultFileName(r);
    const tpl = getTemplate(r.style.template);
    form.innerHTML = `<h2>Review &amp; Download</h2><p class="lead">Final scan before export. Downloads are free, with no watermark.</p>
      ${atsReportHTML(r, { compact: true })}
      ${issues.length ? `<div class="hint" style="margin-top:16px;background:var(--bad-bg);border-color:#fecaca">${icon('alert', 18)}<div><b>${issues.length} important issue${issues.length > 1 ? 's' : ''}</b> found. You can still download, but fixing ${issues.length > 1 ? 'them' : 'it'} first is recommended.</div></div>` : ''}
      ${!tpl.ats ? `<div class="hint" style="margin-top:16px">${icon('info', 18)}<div>You're using a creative template. The PDF keeps the design; the DOCX is always exported in an ATS-safe single-column layout.</div></div>` : ''}
      <div class="card card-pad" style="margin-top:16px">
        <div class="field"><label for="fname">File name</label><input class="input" id="fname" value="${esc(fname)}"></div>
        <div class="add-row">
          <button class="btn btn-primary btn-lg" id="dl-pdf">${icon('download', 18)}Download PDF</button>
          <button class="btn btn-lg" id="dl-docx">${icon('file', 18)}Download DOCX</button>
          <button class="btn btn-lg" id="dl-print">${icon('print', 18)}Print</button>
        </div>
        <p class="small muted" style="margin:12px 0 0">${icon('info', 14)} PDF opens your browser's print dialog — choose <b>"Save as PDF"</b> as the destination. The PDF has real, selectable and searchable text. Use the format the employer asks for.</p>
        <div class="add-row" style="margin-top:14px"><button class="btn btn-sm" id="cp-txt">${icon('copy', 16)}Copy plain text</button><button class="btn btn-sm" id="dl-json">${icon('download', 16)}Backup (.json)</button><a class="btn btn-sm" href="#/tools/cover-letter?resume=${r.id}">${icon('mail', 16)}Write a cover letter</a><a class="btn btn-sm" href="#/tools/linkedin?resume=${r.id}">${icon('linkedin', 16)}LinkedIn summary</a></div>
      </div>
      <div class="form-foot"><button class="btn" data-stepgo="optimise">${icon('arrowLeft', 18)}Back</button><a class="btn btn-primary" href="#/">Finish ${icon('check', 18)}</a></div>`;
    bindAtsFixes(form);
    const name = () => { const v = $('#fname', form).value.trim().replace(/[^\w\- ]+/g, '') || 'Resume'; r._fileName = v; change(r, { noHistory: true }); return v; };
    $('#dl-pdf', form).addEventListener('click', () => printResume(r, name()));
    $('#dl-print', form).addEventListener('click', () => printResume(r, name()));
    $('#dl-docx', form).addEventListener('click', (e) => busy(e.currentTarget, () => downloadDocx(r, name()).then(() => toast('DOCX downloaded')), 'Preparing…'));
    $('#cp-txt', form).addEventListener('click', () => copyText(plainText(r)));
    $('#dl-json', form).addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }));
      a.download = `${name()}.json`; a.click();
    });
    $$('[data-stepgo]', form).forEach((b) => b.addEventListener('click', () => setStep(b.dataset.stepgo)));
  }

  /* ---------- step switching ---------- */
  function setStep(s) {
    step = s;
    window.history.replaceState(null, '', `#/editor/${r.id}/${s}`);
    $$('.wz', root).forEach((b) => {
      const i = STEPS.findIndex((x) => x.id === b.dataset.step);
      const cur = STEPS.findIndex((x) => x.id === s);
      b.classList.toggle('on', b.dataset.step === s);
      b.classList.toggle('done', i < cur);
    });
    $('#next span', root).textContent = s === 'download' ? 'Finish' : 'Next';
    renderNav(); renderForm(); form.scrollTop = 0;
  }
  function renderAll() { renderNav(); renderForm(); updatePreview(); }

  /* ---------- top bar & preview controls ---------- */
  $$('.wz', root).forEach((b) => b.addEventListener('click', () => setStep(b.dataset.step)));
  $('#next', root).addEventListener('click', () => {
    const i = STEPS.findIndex((x) => x.id === step);
    if (i === STEPS.length - 1) location.hash = '#/'; else setStep(STEPS[i + 1].id);
  });
  $('#save', root).addEventListener('click', () => { saveResume(r); updateSaved(); toast('Saved in this browser'); });
  $('#undo', root).addEventListener('click', () => travel(-1));
  $('#redo', root).addEventListener('click', () => travel(1));
  $('#mprev', root).addEventListener('click', () => { $('#ed-prev', root).classList.toggle('mobile-hidden'); updatePreview(); $('#ed-prev', root).scrollIntoView({ behavior: 'smooth' }); });
  $$('[data-ptab]', root).forEach((b) => b.addEventListener('click', () => {
    prevTab = b.dataset.ptab;
    $$('[data-ptab]', root).forEach((x) => x.classList.toggle('on', x === b));
    updatePreview();
  }));
  const full = () => {
    const m = modal({ title: 'Full preview', wide: true, body: `<div style="overflow:auto;display:flex;justify-content:center;background:#f3f4f6;padding:20px;border-radius:10px">${renderResume(r)}</div>`, footer: `<button class="btn" data-close>Close</button><button class="btn btn-primary" id="fp-dl">${icon('download', 18)}Download</button>` });
    $('#fp-dl', m.el).addEventListener('click', () => { m.close(); setStep('download'); });
  };
  $('#expand', root).addEventListener('click', full);
  $('#full', root).addEventListener('click', full);
  $('#zin', root).addEventListener('click', () => { const cur = zoom === 'fit' ? parseFloat($('#stage', root).style.transform.slice(6)) || 0.7 : zoom; zoom = Math.min(1.5, +(cur + 0.1).toFixed(2)); updatePreview(); });
  $('#zout', root).addEventListener('click', () => { const cur = zoom === 'fit' ? parseFloat($('#stage', root).style.transform.slice(6)) || 0.7 : zoom; zoom = Math.max(0.3, +(cur - 0.1).toFixed(2)); updatePreview(); });
  $('#zlbl', root).addEventListener('dblclick', () => { zoom = 'fit'; updatePreview(); });

  const onKey = (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if (typing || !(e.ctrlKey || e.metaKey)) return;
    if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); travel(-1); }
    if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); travel(1); }
  };
  const onResize = () => updatePreview();
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  const savedTimer = setInterval(updateSaved, 30000);
  if (document.fonts?.ready) document.fonts.ready.then(() => updatePreview());

  if (!STEPS.some((s) => s.id === step)) step = 'details';
  setStep(step);
  updatePreview();
  updateUndo();

  return () => {
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    clearInterval(savedTimer);
    clearTimeout(histTimer);
  };
}
