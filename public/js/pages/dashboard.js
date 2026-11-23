import { icon, esc, $, $$, timeAgo, toast, confirmDialog } from '../ui.js';
import { listResumes, getState, setSetting, duplicateResume, deleteResume } from '../store.js';
import { runAtsChecks } from '../ats.js';
import { userName } from '../app.js';
import { TOOLS } from './tools.js';

export function resumeRow(r) {
  const score = r.match?.score;
  const ats = runAtsChecks(r).score;
  return `<div class="ritem" data-id="${r.id}">
    <div class="ritem-ic">${icon('file', 22)}</div>
    <div><b data-open>${esc(r.title)}</b><small>${r.targetJob ? `${esc(r.targetJob)} · ` : ''}Updated ${timeAgo(r.updatedAt)}</small></div>
    ${score != null ? `<span class="pill">${icon('target', 16)}${score}% Job Match</span>` : `<span class="pill grey">${icon('shield', 16)}ATS ${ats}%</span>`}
    <div class="ritem-actions">
      <button class="icon-btn" data-act="edit" aria-label="Edit">${icon('pencil')}</button>
      <button class="icon-btn" data-act="dup" aria-label="Duplicate">${icon('copy')}</button>
      <button class="icon-btn" data-act="more" aria-label="More actions">${icon('dots')}</button>
    </div>
  </div>`;
}

export function bindResumeRows(container, rerender) {
  $$('.ritem', container).forEach((row) => {
    const id = row.dataset.id;
    const open = () => { location.hash = `#/editor/${id}`; };
    $('[data-open]', row).addEventListener('click', open);
    $('[data-act=edit]', row).addEventListener('click', open);
    $('[data-act=dup]', row).addEventListener('click', () => { duplicateResume(id); toast('Resume duplicated'); rerender(); });
    $('[data-act=more]', row).addEventListener('click', (e) => {
      e.stopPropagation();
      $$('.dropdown').forEach((d) => d.remove());
      const dd = document.createElement('div');
      dd.className = 'dropdown';
      dd.innerHTML = `
        <button data-a="optimise">${icon('target', 18)}Optimise for a job</button>
        <button data-a="ats">${icon('shield', 18)}Check ATS score</button>
        <button data-a="download">${icon('download', 18)}Download</button>
        <button data-a="cover">${icon('mail', 18)}Write cover letter</button>
        <button data-a="delete" class="danger">${icon('trash', 18)}Delete</button>`;
      row.querySelector('.ritem-actions').appendChild(dd);
      const close = () => { dd.remove(); document.removeEventListener('click', close); };
      setTimeout(() => document.addEventListener('click', close));
      dd.addEventListener('click', async (ev) => {
        const a = ev.target.closest('button')?.dataset.a;
        if (a === 'optimise') location.hash = `#/editor/${id}/optimise`;
        if (a === 'ats') location.hash = `#/ats/${id}`;
        if (a === 'download') location.hash = `#/editor/${id}/download`;
        if (a === 'cover') location.hash = `#/tools/cover-letter?resume=${id}`;
        if (a === 'delete' && await confirmDialog('Delete resume?', 'This permanently removes the resume from this browser. This cannot be undone.', 'Delete', true)) {
          deleteResume(id); toast('Resume deleted'); rerender();
        }
      });
    });
  });
}

export function renderDashboard(view) {
  const draw = () => {
    const resumes = listResumes();
    const name = userName();
    const latest = resumes[0];
    const checks = latest ? runAtsChecks(latest).checks : null;
    const st = (id) => checks?.find((c) => c.id === id)?.status || 'pass';
    const sectionsOk = checks ? (['experience', 'education', 'contact'].every((x) => st(x) === 'pass') ? 'pass' : 'warn') : 'pass';
    const tipHidden = getState().settings.tipDismissed;

    view.innerHTML = `<div class="dash">
      <div>
        <div class="hello"><h1><span aria-hidden="true">👋</span> Hi ${esc(name || 'there')},</h1><p>Build, optimise and download your professional resume for free.</p></div>
        <div class="quick">
          <a class="quick-card featured" href="#/new?mode=ai">${icon('filePlus', 40)}<b>Create Resume</b><span>Build a new resume with AI</span></a>
          <a class="quick-card" href="#/new?mode=upload">${icon('upload', 40)}<b>Upload &amp; Improve</b><span>Import your existing resume</span></a>
          <a class="quick-card" href="#/optimiser">${icon('target', 40)}<b>Optimise for Job</b><span>Tailor your resume to a job</span></a>
          <a class="quick-card" href="#/ats">${icon('shieldCheck', 40)}<b>Check ATS Score</b><span>Analyse and improve ATS compatibility</span></a>
        </div>

        <h2 class="sec-title">Create a Resume</h2>
        <p class="sec-sub">Get started in minutes with a guided, beginner-friendly flow.</p>
        <div class="card steps-card">
          <div class="steps">
            ${[['briefcase', '1. Choose Job', 'Select a job profile<br>or paste a job description'], ['user', '2. Add Details', 'Fill your information<br>with AI suggestions'], ['grid', '3. Pick a Template', 'Choose from 20+<br>ATS-friendly designs'], ['download', '4. Download', 'Get your resume<br>in PDF or DOCX']]
              .map(([ic, t, d], i) => `${i ? `<div class="step-arrow">${icon('chevRight', 18)}</div>` : ''}<div class="step"><div class="step-ic">${icon(ic, 24)}</div><b>${t}</b><span>${d}</span></div>`).join('')}
          </div>
          <a class="btn btn-primary btn-lg" href="#/new">Create My Resume ${icon('arrowRight', 18)}</a>
        </div>

        <div class="list-head"><h2>My Resumes <span>(${resumes.length})</span></h2>${resumes.length ? '<a href="#/resumes" class="link-btn">View All</a>' : ''}</div>
        <div class="card rlist" id="rlist">
          ${resumes.length ? resumes.slice(0, 5).map(resumeRow).join('') : `<div class="empty">${icon('file', 36)}<p><b>No resumes yet.</b><br>Create your first resume — it takes about 10 minutes.</p><a class="btn btn-primary" href="#/new">Create Resume</a></div>`}
        </div>
      </div>

      <div class="right-col">
        <div class="card card-pad ats-card">
          <h3>${icon('shield', 28)}ATS Compatibility</h3>
          <p class="muted" style="margin:10px 0 0 40px">Check your resume for ATS friendliness and get improvement tips.</p>
          <div class="ats-body">
            <div class="mini-doc"><i style="width:60%;height:4px;background:#9ca3af"></i><i></i><i style="width:85%"></i><i style="width:70%"></i><i></i><i style="width:40%"></i><i style="width:75%"></i></div>
            <ul class="checklist">
              ${[['Formatting', st('formatting')], ['Keywords', st('keywords')], ['Sections', sectionsOk], ['Readability', st('readability')]]
                .map(([l, s]) => `<li><span class="tick ${checks ? (s === 'pass' ? '' : s) : ''}">${icon(s === 'pass' || !checks ? 'check' : s === 'fail' ? 'x' : 'alert', 15)}</span>${l}</li>`).join('')}
            </ul>
          </div>
          <a class="btn btn-outline btn-block" href="#/ats${latest ? `/${latest.id}` : ''}">Check My Resume ${icon('arrowRight', 18)}</a>
        </div>

        <div class="card card-pad">
          <h3>${icon('sparkles', 28)}AI Career Tools</h3>
          <div class="tools-list">
            ${Object.entries(TOOLS).filter(([, t]) => t.dash).map(([id, t]) => `<a class="tool-row" href="#/tools/${id}">${icon(t.icon, 22)}${t.label}${icon('chevRight', 18)}</a>`).join('')}
          </div>
        </div>

        ${tipHidden ? '' : `<div class="card card-pad tip-card" id="tip">
          <button class="icon-btn" id="tip-x" aria-label="Dismiss tip">${icon('x', 18)}</button>
          <div class="tip-in">${icon('bulb', 26)}<div><b>Quick Tip</b><p>Paste a job description to instantly optimise your resume for that role.</p></div></div>
        </div>`}
      </div>
    </div>`;

    bindResumeRows($('#rlist', view), draw);
    $('#tip-x', view)?.addEventListener('click', () => { setSetting('tipDismissed', true); $('#tip', view).remove(); });
  };
  draw();
}
