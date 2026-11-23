import { icon, esc, $, $$, modal } from './ui.js';
import { getState, setProfile, listResumes } from './store.js';
import { IN_CITIES, JOB_PROFILES } from './data.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderStart } from './pages/start.js';
import { renderEditor } from './pages/editor.js';
import { renderResumes, renderTemplates, renderSettings, renderHelp } from './pages/misc.js';
import { renderTerms, renderPrivacy } from './pages/legal.js';
import { renderAtsPage, renderOptimiserPage } from './pages/analysis.js';
import { renderTool, TOOLS } from './pages/tools.js';
import { API_BASE } from './config.js';

// Wake the API server early (Render's free plan sleeps when idle), so AI is
// ready by the time the user needs it.
fetch(`${API_BASE}/api/health`, { method: 'GET', cache: 'no-store' }).catch(() => {});

$('#in-cities').innerHTML = IN_CITIES.map((c) => `<option value="${esc(c)}">`).join('');
$('#job-profiles').innerHTML = JOB_PROFILES.map((c) => `<option value="${esc(c)}">`).join('');

const root = $('#root');
let cleanup = null;

export const navigate = (hash) => { location.hash = hash; };

export function userName() {
  const s = getState();
  if (s.profile.name) return s.profile.name;
  const r = listResumes().find((x) => x.personal.fullName);
  return r ? r.personal.fullName.split(' ')[0] : '';
}

const NAV = [
  { id: 'home', href: '#/', label: 'Home', icon: 'home' },
  { id: 'resumes', href: '#/resumes', label: 'My Resumes', icon: 'file' },
  { id: 'templates', href: '#/templates', label: 'Templates', icon: 'grid' },
  { id: 'optimiser', href: '#/optimiser', label: 'Job Optimiser', icon: 'target' },
  { id: 'ats', href: '#/ats', label: 'ATS Checker', icon: 'shield' },
];

function shell(active) {
  const name = userName();
  const toolsOpen = active === 'tools';
  return `<div class="app">
    <aside class="sidebar" id="sidebar">
      <a class="brand" href="#/"><img class="brand-logo" src="img/logo.svg" alt=""><span><b>HireReady</b><small>ATS Resume Builder</small></span></a>
      <nav class="nav" aria-label="Main">
        ${NAV.map((n) => `<a href="${n.href}" class="${active === n.id ? 'active' : ''}">${icon(n.icon, 22)}${n.label}</a>`).join('')}
        <button class="nav-item" id="tools-toggle" aria-expanded="${toolsOpen}">${icon('sparkles', 22)}AI Tools${icon('chevDown', 18, `nav-chev ${toolsOpen ? 'open' : ''}`)}</button>
        <div class="sub ${toolsOpen ? 'open' : ''}" id="tools-sub">
          ${Object.entries(TOOLS).map(([id, t]) => `<a href="#/tools/${id}" class="${location.hash === `#/tools/${id}` ? 'active' : ''}">${t.label}</a>`).join('')}
        </div>
      </nav>
      <div class="side-spacer"></div>
      <div class="side-sep"></div>
      <nav class="nav">
        <a href="#/help" class="${active === 'help' ? 'active' : ''}">${icon('help', 22)}Help &amp; Guides</a>
        <a href="#/settings" class="${active === 'settings' ? 'active' : ''}">${icon('settings', 22)}Settings</a>
      </nav>
      <div class="side-sep"></div>
      <div class="free-box">
        <h4>${icon('crown', 22)}100% Free</h4>
        <ul>${['Build & download resumes', 'ATS-friendly templates', 'AI writing assistant', 'No watermark'].map((x) => `<li>${icon('check', 16)}${x}</li>`).join('')}</ul>
      </div>
      <p class="made-by">HireReady is created by <b>Nishkam</b></p>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-btn" id="menu-btn" aria-label="Open menu">${icon('menu')}</button>
        <button class="icon-btn" aria-label="Notifications" id="bell">${icon('bell', 24)}</button>
        <button class="user-chip" id="user-chip"><span class="avatar">${esc((name || 'U')[0].toUpperCase())}</span><span>${esc(name || 'Guest')}</span>${icon('chevDown', 18)}</button>
      </header>
      <main class="page" id="view"></main>
      ${siteFooter()}
    </div>
  </div>`;
}

// Shown at the bottom of every screen (including the editor).
export function siteFooter(extra = '') {
  return `<footer class="site-foot ${extra}">
    <span>Vibecoded with <span class="heart" aria-label="love">❤</span> by <b>Nishkam</b></span>
    <nav aria-label="Legal"><a href="#/terms">Terms &amp; Conditions</a><a href="#/privacy">Privacy Policy</a><a href="#/help">Help</a></nav>
    <span class="muted">© ${new Date().getFullYear()} HireReady · Created by Nishkam</span>
  </footer>`;
}

function bindShell() {
  $('#tools-toggle').addEventListener('click', () => {
    $('#tools-sub').classList.toggle('open');
    $('#tools-toggle .nav-chev').classList.toggle('open');
  });
  $('#menu-btn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $$('#sidebar a').forEach((a) => a.addEventListener('click', () => $('#sidebar').classList.remove('open')));
  $('#bell').addEventListener('click', () => modal({ title: 'Notifications', body: '<p class="muted">You\'re all caught up. Tips and reminders will appear here.</p>' }));
  $('#user-chip').addEventListener('click', () => {
    const m = modal({
      title: 'Your profile',
      body: `<div class="field"><label for="pn">What should we call you?</label><input class="input" id="pn" value="${esc(getState().profile.name || '')}" placeholder="First name"></div>
        <p class="small muted">${icon('lock', 14)} Your resumes are saved only in this browser. Nothing is stored on our servers.</p>`,
      footer: '<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="pn-save">Save</button>',
    });
    $('#pn-save', m.el).addEventListener('click', () => { setProfile({ name: $('#pn', m.el).value.trim() }); m.close(); route(); });
  });
}

function parse() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(query) };
}

function route() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  window.scrollTo(0, 0);
  const { parts, query } = parse();
  const [a, b, c] = parts;

  if (a === 'editor' && b) {
    document.title = 'Resume Editor – HireReady by Nishkam';
    cleanup = renderEditor(root, b, c || 'details', query);
    return;
  }
  const active = !a ? 'home' : a === 'new' ? 'home' : a;
  root.innerHTML = shell(active);
  bindShell();
  const view = $('#view');
  switch (a) {
    case undefined: cleanup = renderDashboard(view); break;
    case 'new': cleanup = renderStart(view, query); break;
    case 'resumes': cleanup = renderResumes(view); break;
    case 'templates': cleanup = renderTemplates(view, query); break;
    case 'ats': cleanup = renderAtsPage(view, b); break;
    case 'optimiser': cleanup = renderOptimiserPage(view, b); break;
    case 'tools': cleanup = renderTool(view, b || 'cover-letter', query); break;
    case 'settings': cleanup = renderSettings(view); break;
    case 'help': cleanup = renderHelp(view); break;
    case 'terms': cleanup = renderTerms(view); break;
    case 'privacy': cleanup = renderPrivacy(view); break;
    default: view.innerHTML = `<div class="empty"><h2>Page not found</h2><p><a href="#/">Go home</a></p></div>`;
  }
  document.title = a === 'terms' ? 'Terms & Conditions – HireReady' : a === 'privacy' ? 'Privacy Policy – HireReady' : 'HireReady – ATS Resume Builder by Nishkam';
}

window.addEventListener('hashchange', route);
window.addEventListener('hr:save-error', () => import('./ui.js').then(({ toast }) => toast('Could not save — browser storage is full. Try removing a photo or old resumes.', 'error', 6000)));
route();
