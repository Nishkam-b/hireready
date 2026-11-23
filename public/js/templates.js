// Template library. `ats: true` templates are single-column, standard-heading,
// text-only layouts. Creative templates look great but carry an ATS warning.

export const FONTS = {
  Inter: "'Inter', Arial, sans-serif",
  Lato: "'Lato', Arial, sans-serif",
  Calibri: "Calibri, Carlito, 'Segoe UI', Arial, sans-serif",
  Arial: 'Arial, Helvetica, sans-serif',
  Georgia: "Georgia, 'Times New Roman', serif",
  Merriweather: "'Merriweather', Georgia, serif",
  'Source Serif': "'Source Serif 4', Georgia, serif",
  Poppins: "'Poppins', Arial, sans-serif",
  Garamond: "'EB Garamond', Garamond, Georgia, serif",
};

export const ACCENTS = ['#1b7a3e', '#0f766e', '#1d4ed8', '#334155', '#111827', '#7c3aed', '#b91c1c', '#c2410c', '#0369a1', '#a16207'];

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'ats', label: 'ATS-safe' },
  { id: 'professional', label: 'Classic Professional' },
  { id: 'modern', label: 'Modern Minimal' },
  { id: 'executive', label: 'Corporate Executive' },
  { id: 'fresher', label: 'Student / Fresher' },
  { id: 'senior', label: 'Senior Professional' },
  { id: 'creative', label: 'Creative' },
];

const t = (id, name, category, o) => ({ id, name, category, ats: true, layout: 'single', header: 'left', heading: 'rule', font: 'Inter', accent: '#1b7a3e', photo: false, ...o });

export const TEMPLATES = [
  t('classic', 'Classic Professional', 'professional', { desc: 'Simple, clean, traditional', font: 'Calibri', accent: '#1f2937', heading: 'rule' }),
  t('harvard', 'Harvard', 'professional', { desc: 'Centred serif, university style', font: 'Garamond', accent: '#111827', header: 'center', heading: 'rule-center' }),
  t('banker', 'Banker', 'professional', { desc: 'Conservative, finance & banking', font: 'Georgia', accent: '#1e3a5f', header: 'center', heading: 'caps' }),
  t('govt', 'Government Format', 'professional', { desc: 'Plain and formal for public-sector jobs', font: 'Arial', accent: '#111827', heading: 'underline' }),
  t('modern', 'Modern Minimal', 'modern', { desc: 'Modern typography and spacing', font: 'Inter', accent: '#1b7a3e', heading: 'caps' }),
  t('clarity', 'Clarity', 'modern', { desc: 'Airy layout with accent headings', font: 'Lato', accent: '#0f766e', heading: 'bar' }),
  t('nordic', 'Nordic', 'modern', { desc: 'Quiet, lots of white space', font: 'Inter', accent: '#334155', heading: 'side' }),
  t('techie', 'Tech Lead', 'modern', { desc: 'Crisp for IT & software roles', font: 'Inter', accent: '#1d4ed8', heading: 'caps', header: 'split' }),
  t('executive', 'Corporate Executive', 'executive', { desc: 'For experienced professionals', font: 'Source Serif', accent: '#1e3a5f', header: 'band', heading: 'caps' }),
  t('boardroom', 'Boardroom', 'executive', { desc: 'Strong name, refined serif', font: 'Merriweather', accent: '#334155', header: 'center', heading: 'rule' }),
  t('director', 'Director', 'executive', { desc: 'Bold accents for leadership roles', font: 'Lato', accent: '#0369a1', header: 'band', heading: 'bar' }),
  t('fresher', 'Student / Fresher', 'fresher', { desc: 'Education and projects focused', font: 'Poppins', accent: '#1b7a3e', heading: 'pill' }),
  t('campus', 'Campus Placement', 'fresher', { desc: 'For college placements in India', font: 'Calibri', accent: '#1d4ed8', header: 'center', heading: 'rule' }),
  t('intern', 'Internship Ready', 'fresher', { desc: 'One page, skills up front', font: 'Lato', accent: '#7c3aed', heading: 'bar' }),
  t('graduate', 'Graduate', 'fresher', { desc: 'Simple and confident', font: 'Inter', accent: '#0f766e', heading: 'underline' }),
  t('senior', 'Senior Professional', 'senior', { desc: 'For senior-level candidates', font: 'Source Serif', accent: '#1f2937', heading: 'caps', header: 'split' }),
  t('consultant', 'Consultant', 'senior', { desc: 'Structured for consulting & strategy', font: 'Georgia', accent: '#0f766e', heading: 'rule' }),
  t('manager', 'Manager', 'senior', { desc: 'Achievements first, compact', font: 'Calibri', accent: '#b91c1c', heading: 'bar' }),
  t('creative', 'Creative Sidebar', 'creative', { ats: false, desc: 'Two-column with photo for creatives', font: 'Poppins', accent: '#1b7a3e', layout: 'sidebar', photo: true, heading: 'caps' }),
  t('studio', 'Studio', 'creative', { ats: false, desc: 'Bold header band with photo', font: 'Poppins', accent: '#7c3aed', header: 'band', photo: true, heading: 'pill' }),
  t('portfolio', 'Portfolio', 'creative', { ats: false, desc: 'Designer-friendly with photo', font: 'Lato', accent: '#c2410c', layout: 'sidebar', photo: true, heading: 'bar' }),
  t('influencer', 'Content Creator', 'creative', { ats: false, desc: 'Photo + accent for media roles', font: 'Inter', accent: '#1b7a3e', header: 'split', photo: true, heading: 'caps' }),
];

export const getTemplate = (id) => TEMPLATES.find((x) => x.id === id) || TEMPLATES[0];
