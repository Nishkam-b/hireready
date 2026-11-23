// Shared resume schema — used by the browser (forms, preview, ATS checks)
// and the server (DOCX export). Keep this file dependency-free.

const DATES = [
  { key: 'start', label: 'Start date', type: 'month', half: true },
  { key: 'end', label: 'End date', type: 'month', half: true },
];

const jobLike = (titleLabel, orgLabel, titlePh, orgPh) => ({
  kind: 'entries',
  head: 'title',
  sub: ['company', 'location'],
  dated: true,
  fields: [
    { key: 'title', label: titleLabel, placeholder: titlePh, required: true, half: true },
    { key: 'company', label: orgLabel, placeholder: orgPh, required: true, half: true },
    { key: 'location', label: 'Location', placeholder: 'e.g. Jaipur, Rajasthan', half: true },
    { key: '_spacer', type: 'spacer', half: true },
    ...DATES,
    { key: 'current', label: 'I currently work here', type: 'checkbox' },
    { key: 'bullets', label: 'Responsibilities & achievements', type: 'bullets', placeholder: 'e.g. Managed social media accounts and created posts' },
  ],
});

export const SECTIONS = {
  summary: {
    label: 'Professional Summary', heading: 'Professional Summary', kind: 'text', icon: 'file',
    hint: '3–4 sentences about who you are, your key skills and what you want next.',
    example: 'Digital marketing professional with 5+ years of experience in content strategy and social media growth…',
  },
  experience: {
    label: 'Work Experience', heading: 'Work Experience', icon: 'briefcase',
    hint: 'Most recent job first. Focus on results, not just duties.',
    ...jobLike('Job title', 'Company', 'e.g. Digital Marketing Manager', 'e.g. Nishtek Media'),
  },
  internships: {
    label: 'Internships', heading: 'Internships', icon: 'briefcase',
    hint: 'Internships count as real experience — especially for freshers.',
    ...jobLike('Role', 'Organisation', 'e.g. Marketing Intern', 'e.g. Infosys'),
  },
  education: {
    label: 'Education', heading: 'Education', kind: 'entries', icon: 'cap', head: 'degree', sub: ['institution', 'location'], meta: 'score', dated: true,
    hint: 'Highest qualification first. Add CGPA/percentage if it is good.',
    fields: [
      { key: 'degree', label: 'Degree / Course', placeholder: 'e.g. Bachelor of Computer Applications (BCA)', required: true },
      { key: 'institution', label: 'College / University / School', placeholder: 'e.g. Rajasthan University', required: true, half: true },
      { key: 'location', label: 'Location', placeholder: 'e.g. Jaipur', half: true },
      ...DATES,
      { key: 'score', label: 'CGPA / Percentage', placeholder: 'e.g. 8.2 CGPA or 78%', half: true },
      { key: 'current', label: 'Currently studying', type: 'checkbox' },
      { key: 'bullets', label: 'Highlights (optional)', type: 'bullets', placeholder: 'e.g. Relevant coursework: Data Structures, DBMS' },
    ],
  },
  skills: {
    label: 'Skills', heading: 'Skills', kind: 'tags', icon: 'gear',
    hint: 'Add hard skills and tools recruiters search for. Press Enter after each.',
  },
  projects: {
    label: 'Projects', heading: 'Projects', kind: 'entries', icon: 'layers', head: 'name', sub: ['tech'], link: 'link', dated: true,
    hint: 'College, personal or freelance projects. Great for freshers.',
    fields: [
      { key: 'name', label: 'Project name', placeholder: 'e.g. E-commerce Analytics Dashboard', required: true, half: true },
      { key: 'tech', label: 'Tools / Technologies', placeholder: 'e.g. Python, Power BI', half: true },
      { key: 'link', label: 'Link (optional)', placeholder: 'e.g. github.com/you/project' },
      ...DATES,
      { key: 'bullets', label: 'What you did and the result', type: 'bullets', placeholder: 'e.g. Built a dashboard to track sales across 5 regions' },
    ],
  },
  certifications: {
    label: 'Certifications', heading: 'Certifications', kind: 'entries', icon: 'award', head: 'name', sub: ['issuer'], link: 'link', dateKey: 'date',
    hint: 'Professional certificates such as Google, Meta, AWS or NPTEL.',
    fields: [
      { key: 'name', label: 'Certificate name', placeholder: 'e.g. Google Digital Marketing & E-commerce', required: true },
      { key: 'issuer', label: 'Issued by', placeholder: 'e.g. Google / Coursera', half: true },
      { key: 'date', label: 'Date', type: 'month', half: true },
      { key: 'link', label: 'Credential link (optional)' },
    ],
  },
  courses: {
    label: 'Courses', heading: 'Courses', kind: 'entries', icon: 'book', head: 'name', sub: ['issuer'], dateKey: 'date',
    hint: 'Online or professional courses relevant to the job.',
    fields: [
      { key: 'name', label: 'Course name', required: true },
      { key: 'issuer', label: 'Provider', placeholder: 'e.g. Udemy, NPTEL', half: true },
      { key: 'date', label: 'Completed', type: 'month', half: true },
    ],
  },
  achievements: {
    label: 'Achievements', heading: 'Achievements', kind: 'list', icon: 'trophy',
    hint: 'Awards, rankings, recognitions. Only real ones.',
    placeholder: 'e.g. Ranked top 5% in college coding contest',
  },
  activities: {
    label: 'Extracurricular Activities', heading: 'Extracurricular Activities', kind: 'list', icon: 'star',
    hint: 'Clubs, events, sports, leadership roles.',
    placeholder: 'e.g. Organised annual tech fest with 1,200 attendees',
  },
  volunteer: {
    label: 'Volunteer Experience', heading: 'Volunteer Experience', icon: 'heart',
    hint: 'NGO work, community service or social initiatives.',
    ...jobLike('Role', 'Organisation', 'e.g. Volunteer Teacher', 'e.g. Teach For India'),
  },
  publications: {
    label: 'Publications', heading: 'Publications', kind: 'entries', icon: 'book', head: 'name', sub: ['issuer'], link: 'link', dateKey: 'date',
    hint: 'Articles, research papers or blog posts.',
    fields: [
      { key: 'name', label: 'Title', required: true },
      { key: 'issuer', label: 'Publisher / Journal', half: true },
      { key: 'date', label: 'Date', type: 'month', half: true },
      { key: 'link', label: 'Link (optional)' },
    ],
  },
  languages: {
    label: 'Languages', heading: 'Languages', kind: 'entries', inline: true, icon: 'globe', head: 'name', meta: 'level',
    hint: 'Languages you can work in.',
    fields: [
      { key: 'name', label: 'Language', placeholder: 'e.g. Hindi', required: true, half: true },
      { key: 'level', label: 'Proficiency', type: 'select', options: ['Native', 'Fluent', 'Professional', 'Intermediate', 'Basic'], half: true },
    ],
  },
  references: {
    label: 'References', heading: 'References', kind: 'entries', icon: 'user', head: 'name', sub: ['title', 'company'], meta: 'contact',
    hint: 'Optional. Many candidates write "Available on request" instead.',
    fields: [
      { key: 'name', label: 'Name', required: true, half: true },
      { key: 'title', label: 'Position', half: true },
      { key: 'company', label: 'Company', half: true },
      { key: 'contact', label: 'Email / Phone', half: true },
    ],
  },
};

export const DEFAULT_ORDER = ['summary', 'experience', 'internships', 'projects', 'education', 'skills', 'certifications', 'courses', 'achievements', 'activities', 'volunteer', 'publications', 'languages', 'references'];

// Personal info fields. `required` fields are marked with * in the UI.
export const PERSONAL_FIELDS = [
  { key: 'fullName', label: 'Full Name', required: true, placeholder: 'e.g. Nishkam Bhatia', tip: 'Use the name on your official documents.' },
  { key: 'headline', label: 'Professional Headline', required: true, placeholder: 'e.g. Digital Marketing & AI Content Creator', max: 60, tip: 'A short title that tells recruiters what you do or want to do.' },
  { key: 'email', label: 'Email', required: true, type: 'email', icon: 'mail', half: true, placeholder: 'you@example.com', tip: 'Use a professional address (firstname.lastname@…).' },
  { key: 'phone', label: 'Phone', required: true, type: 'tel', icon: 'phone', half: true, placeholder: '+91 98765 43210', tip: 'Include the country code, e.g. +91.' },
  { key: 'location', label: 'Location', icon: 'pin', half: true, placeholder: 'City, State', tip: 'City and state are enough. No full address needed.', list: 'in-cities' },
  { key: 'linkedin', label: 'LinkedIn', optional: true, icon: 'linkedin', half: true, placeholder: 'linkedin.com/in/yourname' },
  { key: 'website', label: 'Portfolio / Website', optional: true, icon: 'link', half: true, placeholder: 'https://yourportfolio.com' },
  { key: 'github', label: 'GitHub', optional: true, icon: 'code', half: true, placeholder: 'github.com/yourname' },
];

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Convert loose dates ("Jan 2023", "01/2023", "2023") to YYYY-MM or YYYY where possible.
export function normalizeDate(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (/^\d{4}-\d{2}$/.test(s) || /^\d{4}$/.test(s)) return s;
  if (/^(present|current|now|till date|ongoing)$/i.test(s)) return '';
  let m = s.match(/^(\d{1,2})[\/\-.](\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}`;
  m = s.match(/^([A-Za-z]{3,})\.?,?\s+(\d{4})$/);
  if (m) {
    const i = MONTHS.findIndex((x) => x.toLowerCase() === m[1].slice(0, 3).toLowerCase());
    if (i >= 0) return `${m[2]}-${String(i + 1).padStart(2, '0')}`;
  }
  return s;
}

export function formatDate(v, fmt = 'MMM YYYY') {
  if (!v) return '';
  const m = String(v).match(/^(\d{4})-(\d{2})$/);
  if (!m) return String(v);
  const [, y, mo] = m;
  if (fmt === 'YYYY') return y;
  if (fmt === 'MM/YYYY') return `${mo}/${y}`;
  if (fmt === 'MMMM YYYY') return `${new Date(+y, +mo - 1).toLocaleString('en-GB', { month: 'long' })} ${y}`;
  return `${MONTHS[+mo - 1]} ${y}`;
}

export function dateRange(e, cfg, fmt) {
  if (cfg.dateKey) return formatDate(e[cfg.dateKey], fmt);
  if (!cfg.dated) return '';
  const s = formatDate(e.start, fmt);
  const end = e.current ? 'Present' : formatDate(e.end, fmt);
  if (s && end) return `${s} – ${end}`;
  return s || end || '';
}

export function sectionTitle(resume, key) {
  return resume.customTitles?.[key] || SECTIONS[key]?.heading || 'Additional';
}

export function sectionKind(key) {
  return SECTIONS[key]?.kind || 'list';
}

export function hasContent(resume, key) {
  if (key === 'summary') return !!resume.summary?.trim();
  const v = resume.sections?.[key];
  if (!Array.isArray(v)) return false;
  return v.some((x) => (typeof x === 'string' ? x.trim() : Object.values(x).some((y) => (Array.isArray(y) ? y.some(Boolean) : typeof y === 'string' && y.trim()))));
}

// Sections that will actually be printed, in order.
export function visibleSections(resume) {
  return (resume.sectionOrder || DEFAULT_ORDER).filter((k) => !resume.hidden?.[k] && hasContent(resume, k));
}
