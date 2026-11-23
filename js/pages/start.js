// Guided onboarding: how to start → experience level → target job → content.
import { icon, esc, $, $$, toast, busy } from '../ui.js';
import { createResume, saveResume, applyStructured, orderFor } from '../store.js';
import { ai, extractFile, fetchJob } from '../api.js';
import { EXPERIENCE_LEVELS, JOB_PROFILES } from '../data.js';

const MODES = [
  { id: 'ai', title: 'Build with AI', badge: 'Recommended', desc: 'Answer a few questions and let AI create your resume.', icon: 'sparkles' },
  { id: 'upload', title: 'Upload existing resume', desc: 'Import your old resume (PDF/DOCX) and improve it.', icon: 'upload' },
  { id: 'scratch', title: 'Start from scratch', desc: 'Create a resume manually using a template.', icon: 'filePlus' },
];

const AI_PROMPT = {
  experienced: `My name is …, email …, phone +91 …, I live in …
I work as … at … since … (what I do: …)
Before that I was … at … from … to …
Education: … from … (year)
Skills: …
Achievements / numbers I'm proud of: …`,
  fresher: `My name is …, email …, phone +91 …, I live in …
I completed … (degree) from … in … with … CGPA/%
Projects: … (what it did, tools used)
Internships / training: …
Skills: …
Activities / achievements: …`,
};

export function renderStart(view, query) {
  const st = { mode: query.get('mode') || 'ai', level: 'fresher', job: query.get('job') || '', jd: '', file: null };

  view.innerHTML = `<div class="wiz-card">
    <div class="page-head"><div><h1>Let's build your resume!</h1><p>Choose how you want to get started. You can change anything later.</p></div></div>

    <div class="wiz-step"><h3>1. How do you want to start?</h3><p></p>
      <div class="start-grid" id="modes">${MODES.map((m) => `<button class="start-card ${st.mode === m.id ? 'on' : ''}" data-mode="${m.id}">${m.badge ? `<span class="badge">${m.badge}</span>` : ''}${icon(m.icon, 30)}<b>${m.title}</b><p>${m.desc}</p></button>`).join('')}</div>
    </div>

    <div class="wiz-step"><h3>2. Your experience level</h3><p>This decides which sections we show first.</p>
      <div class="level-grid" id="levels">${EXPERIENCE_LEVELS.map((l) => `<button class="level ${st.level === l.id ? 'on' : ''}" data-level="${l.id}">${icon(l.icon, 22)}<b>${l.label}</b><small>${l.desc}</small></button>`).join('')}</div>
    </div>

    <div class="wiz-step"><h3>3. Target job</h3><p>Choose a job profile or type your own. Optional: paste the job description for a tailored resume.</p>
      <div class="field"><div class="with-ic">${icon('search', 18)}<input class="input" id="job" list="job-profiles" placeholder="Search job profiles, e.g. Data Analyst" value="${esc(st.job)}"></div></div>
      <div class="chips" id="job-chips" style="margin:-6px 0 16px">${JOB_PROFILES.slice(0, 10).map((j) => `<button class="chip" data-job="${esc(j)}">${esc(j)}</button>`).join('')}</div>
      <details id="jd-wrap"><summary class="link-btn" style="margin-bottom:12px">${icon('plus', 16)} Add a job description (optional)</summary>
        <div class="field"><label for="jd">Job description</label><textarea class="textarea" id="jd" rows="6" placeholder="Paste the full job description here…"></textarea></div>
        <div class="field"><label for="jd-url">…or job listing URL <span class="opt">(Optional)</span></label>
          <div style="display:flex;gap:8px"><input class="input" id="jd-url" placeholder="https://…"><button class="btn" id="jd-fetch">Fetch</button></div></div>
      </details>
    </div>

    <div class="wiz-step" id="step4"></div>
    <p class="small muted">By continuing you agree to the <a href="#/terms">Terms &amp; Conditions</a> and <a href="#/privacy">Privacy Policy</a>. AI features send your text (never your photo) to Google Gemini.</p>
  </div>`;

  const drawStep4 = () => {
    const el = $('#step4', view);
    if (st.mode === 'ai') {
      const ex = AI_PROMPT[['student', 'fresher'].includes(st.level) ? 'fresher' : 'experienced'];
      el.innerHTML = `<h3>4. Tell us about yourself</h3><p>Write in plain words — Hindi-English mix is fine. AI will turn it into a professional resume. It will <b>only</b> use what you write here; it never invents experience.</p>
        <div class="hint">${icon('info', 18)}<div>Cover: contact details, education, jobs/internships/projects with dates, skills, and any real numbers (followers, sales, marks).</div></div>
        <div class="field"><textarea class="textarea" id="about" rows="11" placeholder="${esc(ex)}"></textarea></div>
        <button class="btn btn-primary btn-lg" id="go">${icon('sparkles', 18)} Generate my resume</button>
        <button class="btn btn-ghost" id="skip-ai">Skip — fill a form instead</button>`;
      $('#go', el).addEventListener('click', (e) => go(e.currentTarget));
      $('#skip-ai', el).addEventListener('click', () => { st.mode = 'scratch'; go(); });
    } else if (st.mode === 'upload') {
      el.innerHTML = `<h3>4. Upload your resume</h3><p>PDF, DOCX or TXT up to 5 MB. Files are read in memory and not stored.</p>
        <label class="drop" id="drop">${icon('cloud', 40)}<p><b>Drag &amp; drop your file here</b><br><span class="muted">or click to browse</span></p><input type="file" id="file" accept=".pdf,.docx,.txt" hidden></label>
        <p id="fname" class="muted"></p><div class="progress hidden" id="prog"><i></i></div>
        <button class="btn btn-primary btn-lg" id="go" disabled>${icon('sparkles', 18)} Import &amp; improve</button>`;
      const drop = $('#drop', el);
      const setFile = (f) => { st.file = f; $('#fname', el).textContent = f ? `Selected: ${f.name}` : ''; $('#go', el).disabled = !f; };
      $('#file', el).addEventListener('change', (e) => setFile(e.target.files[0]));
      ['dragover', 'dragenter'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('over')));
      drop.addEventListener('drop', (e) => { e.preventDefault(); setFile(e.dataTransfer.files[0]); });
      $('#go', el).addEventListener('click', (e) => go(e.currentTarget));
    } else {
      el.innerHTML = `<h3>4. Ready</h3><p>We'll open the editor with the right sections for you. AI help is available on every field.</p>
        <button class="btn btn-primary btn-lg" id="go">Open the editor ${icon('arrowRight', 18)}</button>`;
      $('#go', el).addEventListener('click', () => go());
    }
  };

  async function go(btn) {
    st.job = $('#job', view).value.trim();
    st.jd = $('#jd', view).value.trim();
    const title = st.job ? `${st.job} Resume` : 'My Resume';
    const base = { title, targetJob: st.job, experienceLevel: st.level };

    if (st.mode === 'scratch') {
      const r = createResume(base);
      r.jobDescription = st.jd;
      saveResume(r);
      location.hash = `#/editor/${r.id}`;
      return;
    }

    if (st.mode === 'ai') {
      const about = $('#about', view).value.trim();
      if (about.length < 40) { toast('Please write a bit more about yourself (at least a few lines).', 'error'); return; }
      const data = await busy(btn, () => ai('generate-resume', { about, experienceLevel: st.level, targetJob: st.job }), 'Writing your resume…');
      if (!data) return;
      finish(base, data);
    }

    if (st.mode === 'upload') {
      const prog = $('#prog', view);
      prog.classList.remove('hidden');
      const bar = $('i', prog);
      const data = await busy(btn, async () => {
        bar.style.width = '25%';
        const { text } = await extractFile(st.file);
        bar.style.width = '60%';
        const parsed = await ai('parse-resume', { text });
        bar.style.width = '100%';
        return parsed;
      }, 'Reading your resume…');
      if (!data) { prog.classList.add('hidden'); return; }
      finish({ ...base, title: st.job ? base.title : `${data.personal?.fullName?.split(' ')[0] || 'Imported'} Resume` }, data);
    }
  }

  function finish(base, data) {
    const r = createResume(base);
    applyStructured(r, data);
    r.jobDescription = st.jd;
    r.sectionOrder = orderFor(st.level);
    r.pending = {
      suggestedSkills: (data.suggestedSkills || []).slice(0, 12),
      questions: (data.missingInfo || []).slice(0, 6),
    };
    saveResume(r);
    toast(st.mode === 'upload' ? 'Resume imported — review each section' : 'Your resume draft is ready!');
    location.hash = `#/editor/${r.id}`;
  }

  $$('[data-mode]', view).forEach((b) => b.addEventListener('click', () => {
    st.mode = b.dataset.mode;
    $$('[data-mode]', view).forEach((x) => x.classList.toggle('on', x === b));
    drawStep4();
  }));
  $$('[data-level]', view).forEach((b) => b.addEventListener('click', () => {
    st.level = b.dataset.level;
    $$('[data-level]', view).forEach((x) => x.classList.toggle('on', x === b));
    if (st.mode === 'ai') { const a = $('#about', view); const v = a.value; drawStep4(); $('#about', view).value = v; }
  }));
  $$('[data-job]', view).forEach((b) => b.addEventListener('click', () => {
    $('#job', view).value = b.dataset.job;
    $$('[data-job]', view).forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('#jd-fetch', view).addEventListener('click', async (e) => {
    const url = $('#jd-url', view).value.trim();
    if (!url) return;
    const text = await busy(e.currentTarget, () => fetchJob(url), 'Fetching…');
    if (text) { $('#jd', view).value = text; toast('Job description fetched — check it looks right'); }
  });
  drawStep4();
}
