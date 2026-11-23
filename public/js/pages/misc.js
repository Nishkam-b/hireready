import { icon, esc, $, $$, toast, confirmDialog } from '../ui.js';
import { listResumes, createResume, saveResume, clearAll, exportAll, importResumes } from '../store.js';
import { TEMPLATES, CATEGORIES } from '../templates.js';
import { renderResume } from '../render.js';
import { SAMPLE } from '../data.js';
import { resumeRow, bindResumeRows } from './dashboard.js';

export function renderResumes(view) {
  const draw = () => {
    const resumes = listResumes();
    const byParent = new Map();
    view.innerHTML = `<div class="page-head"><div><h1>My Resumes</h1><p>Create separate versions for each job — your original is never overwritten.</p></div>
      <div class="add-row"><label class="btn">${icon('upload', 18)}Import backup<input type="file" id="imp" accept=".json" hidden></label><a class="btn btn-primary" href="#/new">${icon('plus', 18)}New resume</a></div></div>
      <div class="card rlist" id="rlist">${resumes.length ? resumes.map(resumeRow).join('') : `<div class="empty">${icon('file', 36)}<p>No resumes yet.</p><a class="btn btn-primary" href="#/new">Create Resume</a></div>`}</div>`;
    void byParent;
    bindResumeRows($('#rlist', view), draw);
    $('#imp', view).addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const n = importResumes(await f.text()); toast(`${n} resume${n === 1 ? '' : 's'} imported`); draw(); } catch { toast('That file is not a valid HireReady backup', 'error'); }
    });
  };
  draw();
}

export function renderTemplates(view, query) {
  let cat = query.get('cat') || 'all';
  const draw = () => {
    const shown = TEMPLATES.filter((t) => cat === 'all' || (cat === 'ats' ? t.ats : t.category === cat));
    view.innerHTML = `<div class="page-head"><div><h1>Templates</h1><p>${TEMPLATES.length} professional designs. ATS-safe templates are single-column with standard headings; creative ones are best for portfolios and direct emails.</p></div></div>
      <div class="filters">${CATEGORIES.map((c) => `<button class="chip ${c.id === cat ? 'on' : ''}" data-cat="${c.id}">${c.label}</button>`).join('')}</div>
      <div class="tpl-grid">${shown.map((t) => `<button class="tpl-card" data-tpl="${t.id}"><div class="tpl-thumb"><div class="tpl-scale">${renderResume({ ...SAMPLE, style: { ...SAMPLE.style, template: t.id } })}</div></div>
        <div class="tpl-info"><b>${t.name}</b><small>${t.desc}</small><br>${t.ats ? '<span class="badge">ATS-friendly</span>' : '<span class="badge warn">Check ATS compatibility</span>'}</div></button>`).join('')}</div>`;
    $$('[data-cat]', view).forEach((b) => b.addEventListener('click', () => { cat = b.dataset.cat; draw(); }));
    $$('[data-tpl]', view).forEach((b) => b.addEventListener('click', () => {
      const r = createResume({ title: 'My Resume' });
      r.style.template = b.dataset.tpl;
      saveResume(r);
      location.hash = `#/editor/${r.id}`;
    }));
  };
  draw();
}

export function renderSettings(view) {
  view.innerHTML = `<div class="page-head"><div><h1>Settings &amp; Privacy</h1><p>Your data, your control.</p></div></div>
    <div class="two-col">
      <div class="card card-pad"><h3>${icon('lock', 24)}Where your data lives</h3>
        <ul class="small" style="line-height:1.8;color:var(--ink-2)">
          <li>Resumes are saved <b>only in this browser</b> (local storage). There are no public resume URLs.</li>
          <li>When you use an AI feature, the relevant resume text (without your photo) is sent securely to our server and on to Google Gemini to generate the result. It is not stored on our server.</li>
          <li>Uploaded files are read in memory to extract text and discarded immediately.</li>
          <li>We never sell your data. Clearing your browser data also deletes your resumes — download a backup first.</li>
        </ul></div>
      <div class="card card-pad"><h3>${icon('settings', 24)}Manage data</h3>
        <div class="add-row" style="margin-top:16px"><button class="btn" id="backup">${icon('download', 18)}Download backup of all resumes</button></div>
        <div class="add-row" style="margin-top:12px"><button class="btn btn-danger" id="wipe">${icon('trash', 18)}Delete all my data</button></div>
        <p class="small muted">${listResumes().length} resume(s) stored in this browser.</p></div>
    </div>`;
  $('#backup', view).addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportAll()], { type: 'application/json' }));
    a.download = 'hireready-backup.json'; a.click();
  });
  $('#wipe', view).addEventListener('click', async () => {
    if (await confirmDialog('Delete all data?', 'All resumes, cover letters and settings in this browser will be permanently deleted. This cannot be undone.', 'Delete everything', true)) {
      clearAll(); toast('All data deleted'); location.hash = '#/';
    }
  });
}

const FAQ = [
  ['What is an ATS?', 'An Applicant Tracking System is software many employers use to collect and search resumes. It extracts the text from your file, so simple layouts, standard headings and relevant keywords help it read your resume correctly.'],
  ['Does a high ATS score guarantee a shortlist?', 'No. Employers use different systems and settings. HireReady\'s score reflects our own compatibility checks — it helps you avoid common problems, but no tool can guarantee results.'],
  ['Will the AI make things up?', 'No. HireReady\'s AI is instructed to only rephrase what you provide. Where a number would help, it adds a placeholder like [X%] for you to fill with a real figure — or remove.'],
  ['PDF or DOCX?', 'Follow the employer\'s instructions. PDF keeps your design exactly; DOCX is easy to edit. Both are free with no watermark.'],
  ['Should I add a photo?', 'For most jobs in India, the US and the UK, no. Photos can confuse some ATS and are not needed. Creative templates support one for portfolios.'],
  ['How do I tailor my resume for each job?', 'Open a resume → "Optimise for Job" → paste the job description → "One-click optimise" → "Save as new version". Each application gets its own version.'],
  ['I\'m a fresher with no experience. What do I add?', 'Education, college projects, internships, certifications, achievements and activities. Choose "Fresher" when creating your resume and HireReady puts these first.'],
  ['Employment gap?', 'Be honest and brief. You can add courses, freelance or volunteer work done during the gap, and mention it in your cover letter if needed.'],
];

export function renderHelp(view) {
  view.innerHTML = `<div class="page-head"><div><h1>Help &amp; Guides</h1><p>Everything you need to write a resume that gets read.</p></div></div>
    <div class="two-col"><div class="card card-pad">${FAQ.map(([q, a]) => `<details class="check-row" style="display:block"><summary style="cursor:pointer;font-weight:600">${esc(q)}</summary><p class="muted" style="margin:8px 0 0">${esc(a)}</p></details>`).join('')}</div>
    <div class="card card-pad"><h3>${icon('bulb', 24)}Resume writing rules</h3><ul class="small" style="line-height:1.9;color:var(--ink-2)">
      <li>Start bullets with action verbs: Led, Built, Increased, Managed.</li><li>Show results with real numbers wherever possible.</li><li>Keep it to 1 page (freshers) or 2 pages maximum.</li>
      <li>Use standard headings: Work Experience, Education, Skills.</li><li>Use a professional email address.</li><li>Tailor your resume to every job you apply for.</li><li>Don't use tables, text boxes or images for important text.</li></ul>
      <a class="btn btn-primary" href="#/new">Start building ${icon('arrowRight', 18)}</a></div></div>`;
}
