// AI career tools: cover letter, LinkedIn, interview questions, skills gap, JD simplifier.
import { icon, esc, $, $$, toast, busy, copyText } from '../ui.js';
import { ai, downloadCoverLetter } from '../api.js';
import { listResumes, getResume, saveResume } from '../store.js';

export const TOOLS = {
  'cover-letter': { label: 'AI Cover Letter Generator', icon: 'mail', dash: true, desc: 'Generate a job-specific cover letter from your resume.' },
  linkedin: { label: 'LinkedIn Summary Generator', icon: 'linkedin', dash: true, desc: 'Create your LinkedIn About section and headline.' },
  interview: { label: 'Interview Question Generator', icon: 'chat', dash: true, desc: 'Likely questions for your job, with tips to answer.' },
  'skills-gap': { label: 'Skills Gap Analyser', icon: 'chart', dash: true, desc: 'See which skills to learn for your target job.' },
  'jd-simplifier': { label: 'Job Description Simplifier', icon: 'search', dash: false, desc: 'Understand a complicated job listing in plain English.' },
};

export function renderTool(view, id, query) {
  const tool = TOOLS[id];
  if (!tool) { view.innerHTML = '<div class="empty">Tool not found</div>'; return; }
  const resumes = listResumes();
  const preId = query.get('resume') || resumes[0]?.id;
  const needsResume = id !== 'jd-simplifier';

  view.innerHTML = `<div class="page-head"><div><h1>${icon(tool.icon, 28)} ${esc(tool.label)}</h1><p>${esc(tool.desc)}</p></div></div>
    <div class="two-col">
      <div class="card card-pad">
        ${needsResume ? (resumes.length ? `<div class="field"><label for="t-res">Resume</label><select class="select" id="t-res">${resumes.map((r) => `<option value="${r.id}" ${r.id === preId ? 'selected' : ''}>${esc(r.title)}</option>`).join('')}</select></div>`
          : `<div class="hint">${icon('info', 18)}<div>Create a resume first — this tool uses it so nothing is invented. <a href="#/new">Create resume</a></div></div>`) : ''}
        ${id !== 'jd-simplifier' ? `<div class="field"><label for="t-job">Target job</label><input class="input" id="t-job" list="job-profiles" placeholder="e.g. Content Writer"></div>` : ''}
        ${id === 'cover-letter' ? `<div class="grid2"><div class="field"><label for="t-co">Company <span class="opt">(Optional)</span></label><input class="input" id="t-co"></div><div class="field"><label for="t-hm">Hiring manager <span class="opt">(Optional)</span></label><input class="input" id="t-hm" placeholder="e.g. Ms. Sharma"></div></div>` : ''}
        ${id !== 'linkedin' ? `<div class="field"><label for="t-jd">Job description ${id === 'jd-simplifier' ? '' : '<span class="opt">(Recommended)</span>'}</label><textarea class="textarea" id="t-jd" rows="8" placeholder="Paste the job description…"></textarea></div>` : ''}
        ${['cover-letter', 'linkedin'].includes(id) ? `<div class="field"><label for="t-tone">Tone</label><select class="select" id="t-tone"><option>Professional and warm</option><option>Formal</option><option>Confident</option><option>Friendly</option><option>Enthusiastic (for freshers)</option></select></div>` : ''}
        <button class="btn btn-primary btn-lg" id="t-go" ${needsResume && !resumes.length ? 'disabled' : ''}>${icon('sparkles', 18)}Generate</button>
      </div>
      <div id="t-out"><div class="card card-pad empty">${icon(tool.icon, 36)}<p>Your result will appear here.</p></div></div>
    </div>`;

  const sel = $('#t-res', view);
  const fill = () => {
    const r = sel && getResume(sel.value);
    if (!r) return;
    if ($('#t-job', view)) $('#t-job', view).value = r.targetJob || '';
    if ($('#t-jd', view)) $('#t-jd', view).value = r.jobDescription || '';
    if ($('#t-co', view)) $('#t-co', view).value = r.analysis?.company || '';
  };
  sel?.addEventListener('change', fill);
  fill();

  const out = $('#t-out', view);
  $('#t-go', view).addEventListener('click', async (e) => {
    const r = sel ? getResume(sel.value) : null;
    const v = (s) => $(s, view)?.value.trim() || '';
    const p = { resume: r, targetJob: v('#t-job'), jobDescription: v('#t-jd'), tone: v('#t-tone') };
    if (id === 'jd-simplifier' && !p.jobDescription) return toast('Paste a job description first', 'error');
    out.innerHTML = '<div class="card card-pad"><div class="skeleton" style="width:60%"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton" style="width:80%"></div></div>';

    const res = await busy(e.currentTarget, () => {
      if (id === 'cover-letter') return ai('cover-letter', { ...p, company: v('#t-co'), hiringManager: v('#t-hm') });
      if (id === 'linkedin') return ai('linkedin', p);
      if (id === 'interview') return ai('interview-questions', p);
      if (id === 'skills-gap') return ai('skills-gap', p);
      return ai('analyze-job', p);
    }, 'Generating…');
    if (!res) { out.innerHTML = '<div class="card card-pad empty"><p>Something went wrong. Please try again.</p></div>'; return; }

    if (id === 'cover-letter') {
      out.innerHTML = `<div class="card card-pad">${res.subject ? `<p class="small muted">Email subject: <b>${esc(res.subject)}</b></p>` : ''}
        <textarea class="textarea letter" id="cl" rows="22">${esc(res.letter)}</textarea>
        <div class="add-row" style="margin-top:12px"><button class="btn" id="cl-copy">${icon('copy', 16)}Copy</button><button class="btn btn-primary" id="cl-dl">${icon('download', 16)}Download DOCX</button></div>
        <p class="why">${icon('info', 14)}Check every sentence is true for you before sending.</p></div>`;
      $('#cl-copy', out).addEventListener('click', () => copyText($('#cl', out).value));
      $('#cl-dl', out).addEventListener('click', (ev) => busy(ev.currentTarget, () => downloadCoverLetter($('#cl', out).value, r?.personal.fullName || ''), 'Preparing…'));
      if (r) { r.coverLetter = res.letter; saveResume(r); }
    } else if (id === 'linkedin') {
      out.innerHTML = `<div class="card card-pad"><h3 style="font-size:17px;margin-bottom:10px">Headlines</h3>
        ${(res.headlines || []).map((h) => `<div class="result-box">${esc(h)}<div class="acts"><button class="btn btn-sm" data-copy="${esc(h)}">${icon('copy', 14)}Copy</button></div></div>`).join('')}
        <h3 style="font-size:17px;margin:18px 0 10px">About section</h3><div class="result-box letter">${esc(res.about)}<div class="acts"><button class="btn btn-sm" data-copy="${esc(res.about)}">${icon('copy', 14)}Copy</button></div></div>
        ${res.hashtags?.length ? `<p class="small muted">${res.hashtags.map((x) => esc(x.startsWith('#') ? x : `#${x}`)).join(' ')}</p>` : ''}</div>`;
    } else if (id === 'interview') {
      out.innerHTML = `<div class="card card-pad">${(res.questions || []).map((q, i) => `<div class="result-box"><span class="badge">${esc(q.category)}</span><p style="margin:8px 0 4px"><b>${i + 1}. ${esc(q.question)}</b></p><p class="why">${icon('bulb', 14)}${esc(q.tip)}</p></div>`).join('')}</div>`;
    } else if (id === 'skills-gap') {
      out.innerHTML = `<div class="card card-pad"><p>${esc(res.summary || '')}</p><div class="kv"><div><h4>Skills you have</h4><div class="tagcloud">${(res.have || []).map((s) => `<span>${esc(s)}</span>`).join('')}</div></div>
        <div><h4>Skills to build</h4>${(res.gaps || []).map((g) => `<div class="result-box"><b>${esc(g.skill)}</b> <span class="pill ${g.priority === 'High' ? 'bad' : g.priority === 'Medium' ? 'warn' : 'grey'}">${esc(g.priority)}</span><p class="small" style="margin:6px 0 0">${esc(g.howToLearn)}</p></div>`).join('')}</div></div></div>`;
    } else {
      const { analysisHTML } = await import('./analysis.js');
      out.innerHTML = analysisHTML(res);
    }
    $$('[data-copy]', out).forEach((b) => b.addEventListener('click', () => copyText(b.dataset.copy)));
  });
}
