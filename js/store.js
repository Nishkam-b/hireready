// Local-first storage. Resumes stay in this browser (localStorage) — nothing is
// stored on the server. Swap this module for an API-backed store to add cloud sync.
import { DEFAULT_ORDER, SECTIONS, normalizeDate } from './schema.js';

const KEY = 'hireready.v1';
const listeners = new Set();

let state = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && Array.isArray(raw.resumes)) return { profile: {}, settings: {}, ...raw };
  } catch { /* ignore */ }
  return { resumes: [], profile: {}, settings: { tipDismissed: false } };
}

let saveTimer;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Save failed', e);
      window.dispatchEvent(new CustomEvent('hr:save-error'));
    }
  }, 250);
  listeners.forEach((fn) => fn(state));
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export const getState = () => state;
export const listResumes = () => [...state.resumes].sort((a, b) => b.updatedAt - a.updatedAt);
export const getResume = (id) => state.resumes.find((r) => r.id === id);

export function orderFor(level) {
  if (level === 'fresher' || level === 'student') {
    return ['summary', 'education', 'projects', 'internships', 'skills', 'certifications', 'achievements', 'activities', 'experience', 'courses', 'volunteer', 'publications', 'languages', 'references'];
  }
  return [...DEFAULT_ORDER];
}

export function blankResume(opts = {}) {
  const sections = {};
  for (const [k, cfg] of Object.entries(SECTIONS)) if (k !== 'summary') sections[k] = [];
  const now = Date.now();
  return {
    id: uid(),
    title: opts.title || 'Untitled Resume',
    targetJob: opts.targetJob || '',
    experienceLevel: opts.experienceLevel || 'experienced',
    jobDescription: '',
    analysis: null,
    match: null,
    ats: null,
    parentId: opts.parentId || null,
    createdAt: now,
    updatedAt: now,
    personal: { fullName: state.profile.name || '', headline: '', email: '', phone: '', location: '', linkedin: '', website: '', github: '', photo: '' },
    summary: '',
    sections,
    sectionOrder: orderFor(opts.experienceLevel),
    hidden: {},
    customTitles: {},
    style: { template: 'classic', font: '', accent: '', fontSize: 10.5, lineHeight: 1.35, margin: 16, sectionGap: 12, pageSize: 'a4', dateFormat: 'MMM YYYY', showPhoto: false },
  };
}

export function createResume(opts) {
  const r = blankResume(opts);
  state.resumes.push(r);
  persist();
  return r;
}

export function saveResume(r) {
  r.updatedAt = Date.now();
  const i = state.resumes.findIndex((x) => x.id === r.id);
  if (i >= 0) state.resumes[i] = r; else state.resumes.push(r);
  persist();
  return r;
}

export function duplicateResume(id, patch = {}) {
  const src = getResume(id);
  if (!src) return null;
  const copy = JSON.parse(JSON.stringify(src));
  Object.assign(copy, { id: uid(), title: `${src.title} (Copy)`, createdAt: Date.now(), updatedAt: Date.now(), parentId: src.id }, patch);
  state.resumes.push(copy);
  persist();
  return copy;
}

export function deleteResume(id) {
  state.resumes = state.resumes.filter((r) => r.id !== id);
  persist();
}

export function setProfile(patch) { state.profile = { ...state.profile, ...patch }; persist(); }
export function setSetting(k, v) { state.settings = { ...state.settings, [k]: v }; persist(); }

export function clearAll() {
  state = { resumes: [], profile: {}, settings: {} };
  localStorage.removeItem(KEY);
  listeners.forEach((fn) => fn(state));
}

export function exportAll() { return JSON.stringify(state, null, 2); }

export function importResumes(json) {
  const data = JSON.parse(json);
  const list = Array.isArray(data) ? data : data.resumes || [data];
  let n = 0;
  for (const r of list) {
    if (!r?.personal) continue;
    state.resumes.push({ ...blankResume(), ...r, id: uid(), updatedAt: Date.now() });
    n++;
  }
  persist();
  return n;
}

// Merge AI-structured data (from generate/parse) into a resume.
export function applyStructured(r, d = {}) {
  const p = d.personal || {};
  for (const k of Object.keys(r.personal)) if (p[k] && !r.personal[k]) r.personal[k] = String(p[k]);
  if (d.summary && !r.summary) r.summary = d.summary;
  const withIds = (arr) => (Array.isArray(arr) ? arr : []).map((e) => {
    const o = { id: uid(), ...e };
    for (const k of ['start', 'end', 'date']) if (o[k]) o[k] = normalizeDate(o[k]);
    if (/present|current/i.test(e.end || '')) { o.current = true; o.end = ''; }
    if (o.bullets && !Array.isArray(o.bullets)) o.bullets = [String(o.bullets)];
    return o;
  });
  for (const k of Object.keys(SECTIONS)) {
    if (k === 'summary' || !d[k]) continue;
    const kind = SECTIONS[k].kind;
    if (kind === 'tags' || kind === 'list') {
      const vals = (d[k] || []).map(String).filter(Boolean);
      r.sections[k] = [...new Set([...(r.sections[k] || []), ...vals])];
    } else {
      r.sections[k] = [...(r.sections[k] || []), ...withIds(d[k]).filter((e) => Object.values(e).some((v) => v && v !== e.id))];
    }
  }
  return r;
}
