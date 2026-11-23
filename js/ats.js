// HireReady ATS compatibility checks. These are our own heuristic checks —
// they do not (and cannot) guarantee results in any particular employer's ATS.
import { SECTIONS, visibleSections, normalizeDate } from './schema.js';
import { getTemplate } from './templates.js';
import { plainText } from './render.js';

const STANDARD = /^(professional summary|summary|profile|objective|career objective|work experience|experience|professional experience|employment history|education|skills|technical skills|key skills|projects|certifications|internships?|achievements|awards|languages|volunteer( experience)?|publications|courses|references|extracurricular activities|activities)$/i;

const W = { readability: 12, formatting: 12, keywords: 16, headings: 8, contact: 12, experience: 12, education: 8, fileformat: 4, grammar: 8, consistency: 8 };

export function runAtsChecks(r) {
  const tpl = getTemplate(r.style?.template);
  const text = plainText(r);
  const lower = text.toLowerCase();
  const p = r.personal || {};
  const S = r.sections || {};
  const checks = [];
  const add = (c) => checks.push(c);
  const fresher = ['student', 'fresher'].includes(r.experienceLevel);

  // 1. Readability
  add(tpl.ats
    ? { id: 'readability', label: 'Readability', status: 'pass', detail: 'All text is real, selectable text in a simple reading order.' }
    : { id: 'readability', label: 'Readability', status: 'warn', detail: `"${tpl.name}" uses columns and icons. Some ATS read sidebars out of order or skip icon text.`, fix: { label: 'Switch to an ATS-safe template', action: 'switch-template' }, where: 'template' });

  // 2. Formatting
  const fmtIssues = [];
  if (tpl.layout !== 'single') fmtIssues.push('multi-column layout');
  if (tpl.photo && p.photo && r.style?.showPhoto !== false) fmtIssues.push('profile photo');
  add(fmtIssues.length
    ? { id: 'formatting', label: 'Formatting', status: 'warn', detail: `Excessive formatting found: ${fmtIssues.join(', ')}. Photos are not recommended for most applications in India, the US and the UK.`, fix: { label: tpl.layout !== 'single' ? 'Use ATS-safe template' : 'Hide photo', action: tpl.layout !== 'single' ? 'switch-template' : 'hide-photo' }, where: 'template' }
    : { id: 'formatting', label: 'Formatting', status: 'pass', detail: 'Single-column, clean structure with standard bullets.' });

  // 3. Keywords
  const kws = [...new Set([...(r.analysis?.keywords || []), ...(r.analysis?.requiredSkills || [])].map((k) => String(k).trim()).filter(Boolean))];
  if (!kws.length) {
    add({ id: 'keywords', label: 'Keywords', status: 'warn', detail: 'No job description added yet, so job-specific keywords could not be checked.', fix: { label: 'Add a job description', action: 'add-jd' }, partial: 0.5 });
  } else {
    const found = kws.filter((k) => lower.includes(k.toLowerCase()));
    const missing = kws.filter((k) => !lower.includes(k.toLowerCase()));
    const pct = Math.round((found.length / kws.length) * 100);
    add({
      id: 'keywords', label: 'Keywords', status: pct >= 70 ? 'pass' : pct >= 45 ? 'warn' : 'fail', partial: pct / 100,
      detail: `${found.length} of ${kws.length} job keywords found (${pct}%).${missing.length ? ` Not found: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}. Add them only where they truthfully apply.` : ''}`,
      fix: pct < 70 ? { label: 'Optimise for this job', action: 'optimise' } : null, found, missing,
    });
  }

  // 4. Headings
  const custom = visibleSections(r).filter((k) => r.customTitles?.[k] && !STANDARD.test(r.customTitles[k].trim()));
  add(custom.length
    ? { id: 'headings', label: 'Headings', status: 'warn', detail: `Non-standard heading${custom.length > 1 ? 's' : ''}: ${custom.map((k) => `"${r.customTitles[k]}"`).join(', ')}. ATS look for headings like "Work Experience" and "Education".`, fix: { label: 'Use standard headings', action: 'restore-headings' } }
    : { id: 'headings', label: 'Headings', status: 'pass', detail: 'Standard resume headings are used.' });

  // 5. Contact details
  const cMiss = [];
  if (!p.fullName?.trim()) cMiss.push('full name');
  if (!p.email?.trim()) cMiss.push('email');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email.trim())) cMiss.push('a valid email');
  if (!p.phone?.trim()) cMiss.push('phone');
  else if (p.phone.replace(/\D/g, '').length < 10) cMiss.push('a valid phone number');
  if (!p.location?.trim()) cMiss.push('city/location');
  add(cMiss.length
    ? { id: 'contact', label: 'Contact details', status: cMiss.length > 1 || cMiss.some((x) => /email|phone|name/.test(x)) ? 'fail' : 'warn', detail: `Missing ${cMiss.join(', ')}.`, fix: { label: 'Add contact details', action: 'goto:personal' }, where: 'personal' }
    : { id: 'contact', label: 'Contact details', status: 'pass', detail: 'Name, email, phone and location are present.' });

  // 6. Experience
  const jobs = [...(S.experience || []), ...(S.internships || [])].filter((e) => e.title || e.company);
  const projects = (S.projects || []).filter((e) => e.name);
  const jobProblems = jobs.filter((e) => !e.title || !e.company || !(e.start || e.end || e.current));
  const thin = jobs.filter((e) => (e.bullets || []).filter((b) => b.trim()).length < 2);
  if (!jobs.length && !(fresher && projects.length)) {
    add({ id: 'experience', label: 'Experience', status: fresher ? 'warn' : 'fail', detail: fresher ? 'No internships or projects yet. Add college projects or internships to show practical skills.' : 'No work experience found. Add your jobs with title, company and dates.', fix: { label: fresher ? 'Add projects' : 'Add experience', action: fresher ? 'goto:projects' : 'goto:experience' }, where: 'experience' });
  } else if (jobProblems.length) {
    add({ id: 'experience', label: 'Experience', status: 'warn', detail: `${jobProblems.length} entr${jobProblems.length > 1 ? 'ies are' : 'y is'} missing a job title, company or dates.`, fix: { label: 'Fix experience', action: 'goto:experience' }, where: 'experience' });
  } else if (thin.length) {
    add({ id: 'experience', label: 'Experience', status: 'warn', detail: `${thin.length} role${thin.length > 1 ? 's have' : ' has'} fewer than 2 bullet points. Aim for 3–5 accomplishment-focused bullets.`, fix: { label: 'Improve bullets with AI', action: 'goto:experience' }, where: 'experience' });
  } else {
    add({ id: 'experience', label: 'Experience', status: 'pass', detail: fresher && !jobs.length ? 'Projects clearly show your practical experience.' : 'Clear employment history with titles, companies and dates.' });
  }

  // 7. Education
  const edu = (S.education || []).filter((e) => e.degree || e.institution);
  add(!edu.length
    ? { id: 'education', label: 'Education', status: 'fail', detail: 'No education found. Most ATS filters check for a degree or qualification.', fix: { label: 'Add education', action: 'goto:education' }, where: 'education' }
    : edu.some((e) => !e.degree || !e.institution)
      ? { id: 'education', label: 'Education', status: 'warn', detail: 'An education entry is missing the degree or institution name.', fix: { label: 'Fix education', action: 'goto:education' }, where: 'education' }
      : { id: 'education', label: 'Education', status: 'pass', detail: 'Education details are clearly identifiable.' });

  // 8. File format
  add({ id: 'fileformat', label: 'File format', status: 'pass', detail: 'HireReady exports a text-based PDF (searchable, selectable) and a native DOCX.' });

  // 9. Grammar
  const g = r.ats?.grammar;
  if (!g) add({ id: 'grammar', label: 'Grammar', status: 'warn', detail: 'Spelling and grammar not checked yet.', fix: { label: 'Run AI grammar check', action: 'grammar-scan' }, partial: 0.6 });
  else if (g.issues?.length) add({ id: 'grammar', label: 'Grammar', status: g.issues.length > 4 ? 'fail' : 'warn', detail: `${g.issues.length} spelling/grammar issue${g.issues.length > 1 ? 's' : ''} found.`, fix: { label: 'Review fixes', action: 'grammar-review' }, issues: g.issues });
  else add({ id: 'grammar', label: 'Grammar', status: 'pass', detail: 'No spelling or grammar issues found.' });

  // 10. Consistency
  const cons = [];
  const allDated = [...jobs, ...(S.education || []), ...(S.projects || [])];
  const loose = allDated.filter((e) => [e.start, e.end].some((d) => d && !/^\d{4}(-\d{2})?$/.test(d)));
  if (loose.length) cons.push(`${loose.length} date${loose.length > 1 ? 's use' : ' uses'} an unclear format`);
  const backwards = allDated.filter((e) => e.start && e.end && /^\d{4}/.test(e.start) && /^\d{4}/.test(e.end) && e.end < e.start);
  if (backwards.length) cons.push('an end date is before its start date');
  const bullets = [...jobs, ...projects].flatMap((e) => (e.bullets || []).filter((b) => b.trim()));
  const dotted = bullets.filter((b) => /[.!]$/.test(b.trim())).length;
  if (bullets.length > 2 && dotted && dotted !== bullets.length) cons.push('some bullets end with a full stop and some do not');
  const pronouns = bullets.filter((b) => /^(i|my|we)\b/i.test(b.trim()));
  if (pronouns.length) cons.push(`${pronouns.length} bullet${pronouns.length > 1 ? 's start' : ' starts'} with "I/My/We"`);
  add(cons.length
    ? { id: 'consistency', label: 'Consistency', status: 'warn', detail: `${cons.join('; ')}.`, fix: { label: 'Auto-fix consistency', action: 'fix-consistency' } }
    : { id: 'consistency', label: 'Consistency', status: 'pass', detail: 'Dates, bullets and spacing are consistent.' });

  // Extra advisories (not scored).
  const tips = [];
  const words = text.split(/\s+/).length;
  if (words < 180) tips.push({ status: 'warn', text: `Your resume is short (${words} words). Add more detail about your work, projects and skills.` });
  if (words > 1100) tips.push({ status: 'warn', text: `Your resume is long (${words} words). Aim for 1 page (freshers) or 2 pages maximum.` });
  if (!r.summary?.trim()) tips.push({ status: 'warn', text: 'Add a professional summary — recruiters read it first.', action: 'goto:summary' });
  if ((S.skills || []).length < 5) tips.push({ status: 'warn', text: 'List at least 5–10 relevant skills.', action: 'goto:skills' });
  if (/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(text)) tips.push({ status: 'warn', text: 'Emojis found — remove them for ATS compatibility.' });

  const score = Math.round(checks.reduce((sum, c) => {
    const f = c.status === 'pass' ? 1 : c.status === 'warn' ? (c.partial ?? 0.55) : (c.partial ?? 0.1);
    return sum + (W[c.id] || 0) * f;
  }, 0));

  return { score, checks, tips, text, words };
}

// One-click fixes that need no AI.
export function normaliseConsistency(r) {
  const fixAll = (e) => {
    for (const k of ['start', 'end', 'date']) if (e[k]) e[k] = normalizeDate(e[k]);
  };
  for (const key of Object.keys(SECTIONS)) {
    const v = r.sections[key];
    if (!Array.isArray(v)) continue;
    v.forEach((e) => {
      if (typeof e !== 'object') return;
      fixAll(e);
      if (e.start && e.end && e.end < e.start) [e.start, e.end] = [e.end, e.start];
      if (Array.isArray(e.bullets)) {
        e.bullets = e.bullets.map((b) => {
          let t = b.trim().replace(/^(i|we)\s+/i, '').replace(/^my\s+/i, '');
          t = t.charAt(0).toUpperCase() + t.slice(1);
          if (t && !/[.!?]$/.test(t)) t += '.';
          return t;
        });
      }
    });
  }
  return r;
}
