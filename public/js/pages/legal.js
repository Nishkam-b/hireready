// Terms & Conditions and Privacy Policy pages.
// Edit LEGAL below before launch (contact email, AI billing tier, dates).
import { icon, esc } from '../ui.js';

export const LEGAL = {
  product: 'HireReady',
  owner: 'Nishkam',
  location: 'Sri Ganganagar, Rajasthan, India',
  contactEmail: 'nishkam.biz@gmail.com',
  effectiveDate: '23 November 2026',
  // Set to true once the Gemini API key is on a billing-linked (paid) Google project.
  // On Google's free tier, submitted content may be used by Google to improve its products.
  aiPaidTier: false,
};

const contact = () => `<a href="mailto:${esc(LEGAL.contactEmail)}"><b>${esc(LEGAL.contactEmail)}</b></a>`;
const toc = (items) => `<div class="toc">${items.map(([id, t]) => `<button type="button" class="chip" data-jump="${id}">${t}</button>`).join('')}</div>`;

function page(view, title, intro, sections) {
  view.innerHTML = `<article class="legal">
    <div class="page-head"><div><h1>${title}</h1><p>Effective ${esc(LEGAL.effectiveDate)} · ${esc(LEGAL.product)} is created and operated by ${esc(LEGAL.owner)}</p></div></div>
    <p>${intro}</p>
    ${toc(sections.map((s) => [s.id, s.title]))}
    ${sections.map((s) => `<h2 id="${s.id}">${s.title}</h2>${s.body}`).join('')}
    <div class="callout small">${icon('info', 16)} Questions about this page? Contact ${esc(LEGAL.owner)} at ${contact()}.</div>
  </article>`;
  view.querySelectorAll('[data-jump]').forEach((a) => a.addEventListener('click', () => document.getElementById(a.dataset.jump)?.scrollIntoView({ behavior: 'smooth' })));
}

export function renderTerms(view) {
  page(view, 'Terms &amp; Conditions',
    `These Terms &amp; Conditions ("Terms") govern your use of ${LEGAL.product}, a free AI-powered resume builder created by ${LEGAL.owner} ("we", "us"). By using ${LEGAL.product} you agree to these Terms. If you do not agree, please do not use the service.`,
    [
      { id: 't-service', title: '1. The service', body: `<p>${LEGAL.product} helps you write, format, optimise and download resumes, cover letters and related career documents. Core features, including PDF and DOCX downloads, are free and carry no watermark. We may add, change or remove features at any time.</p>` },
      { id: 't-eligibility', title: '2. Who can use it', body: `<p>You must be at least 16 years old, or have permission from a parent or guardian, to use ${LEGAL.product}. You are responsible for keeping your device and browser secure, because your resumes are stored there.</p>` },
      { id: 't-content', title: '3. Your content', body: `<ul><li>You own everything you write or upload. We claim no ownership of your resumes or documents.</li>
        <li>You give us a limited permission to process your content only to provide the features you use (for example, sending text to our AI provider to generate a summary).</li>
        <li>You confirm you have the right to use any content you upload, and that it does not contain other people's personal data without their permission.</li></ul>` },
      { id: 't-accuracy', title: '4. Accuracy &amp; honesty', body: `<p>You are solely responsible for the accuracy of your resume. Our AI is designed not to invent jobs, qualifications, dates, numbers or achievements, but AI can make mistakes. <b>Always review every suggestion before using it</b>, and replace placeholders such as [X%] with real figures or remove them. Do not use ${LEGAL.product} to create false, misleading or fraudulent documents.</p>` },
      { id: 't-ats', title: '5. No guarantee of results', body: `<p>ATS scores, job-match scores and suggestions reflect ${LEGAL.product}'s own checks and AI analysis. Employers use many different systems and settings. <b>We do not guarantee that any resume will pass an applicant tracking system, be shortlisted, or lead to an interview or job offer.</b></p>` },
      { id: 't-use', title: '6. Acceptable use', body: `<p>You agree not to:</p><ul><li>misuse, overload, scrape or attempt to break the service or its rate limits;</li><li>use automated tools to make bulk AI requests;</li><li>upload malware, illegal content, or content that is abusive or infringes others' rights;</li><li>attempt to access our servers, API keys or other users' data.</li></ul><p>We may limit or block access that breaks these rules.</p>` },
      { id: 't-ai', title: '7. Third-party AI', body: `<p>AI features are powered by Google Gemini. When you use them, the relevant text is processed by Google under its own terms. AI features may be slow or temporarily unavailable when the provider is busy, and daily usage limits apply.</p>` },
      { id: 't-ip', title: '8. Our intellectual property', body: `<p>The ${LEGAL.product} name, design, templates, code and branding belong to ${LEGAL.owner}. You may use the templates to create resumes for yourself, but may not copy, resell or redistribute the templates or the app itself.</p>` },
      { id: 't-liability', title: '9. Disclaimer &amp; limitation of liability', body: `<p>${LEGAL.product} is provided "as is" and "as available", without warranties of any kind. To the fullest extent permitted by law, ${LEGAL.owner} is not liable for any indirect or consequential loss, lost opportunities, or loss of data (including resumes lost when browser data is cleared). Please download backups of important documents.</p>` },
      { id: 't-changes', title: '10. Changes &amp; termination', body: `<p>We may update these Terms from time to time and will change the effective date above. Continued use after changes means you accept them. You can stop using ${LEGAL.product} at any time and delete your data from Settings.</p>` },
      { id: 't-law', title: '11. Governing law', body: `<p>These Terms are governed by the laws of India. Courts in Rajasthan, India have jurisdiction over any dispute, subject to any rights you have under applicable consumer law.</p>` },
    ]);
}

export function renderPrivacy(view) {
  const google = LEGAL.aiPaidTier
    ? 'We use Google\'s paid Gemini API. Under Google\'s terms for the paid service, your content is <b>not</b> used by Google to improve its products.'
    : '<b>Important:</b> HireReady currently uses Google\'s free Gemini API tier. Under Google\'s terms for the free tier, content sent to the API <b>may be used by Google to improve its products</b>, which can include human review. Avoid putting highly sensitive information (such as ID numbers, bank details or health information) into AI features.';
  page(view, 'Privacy Policy',
    `Your resume contains personal information, so privacy is a core feature of ${LEGAL.product}. This policy explains what we collect, how it is used and the choices you have. It is written to align with India's Digital Personal Data Protection Act, 2023.`,
    [
      { id: 'p-summary', title: 'In short', body: `<div class="callout"><ul style="margin:0">
        <li>Your resumes are saved <b>in your own browser</b>, not on our servers. There are no public resume links.</li>
        <li>No account or sign-up is needed. We don't sell your data or show ads.</li>
        <li>Text is sent to our AI provider (Google Gemini) <b>only when you use an AI feature</b>, and your photo is never sent.</li>
        <li>You can delete everything at any time from Settings.</li></ul></div>` },
      { id: 'p-collect', title: '1. Information we handle', body: `<ul>
        <li><b>Resume content you enter</b> — name, contact details, work history, education, skills, photo (optional). Stored in your browser's local storage on your device.</li>
        <li><b>Uploaded files</b> — PDF/DOCX/TXT resumes you import are read in our server's memory to extract text and are discarded immediately. They are not saved.</li>
        <li><b>Job descriptions and links</b> you paste, used to analyse and tailor your resume.</li>
        <li><b>Technical data</b> — your IP address is used briefly in memory for rate limiting (to prevent abuse) and may appear in short-lived server error logs. We do not use tracking cookies or analytics.</li></ul>` },
      { id: 'p-use', title: '2. How we use it', body: `<ul><li>To provide the features you ask for: building, previewing, scoring, optimising and exporting documents.</li><li>To protect the service from abuse (rate limiting).</li></ul><p>We do not use your data for advertising, profiling or selling to third parties.</p>` },
      { id: 'p-ai', title: '3. AI processing (Google Gemini)', body: `<p>When you click an AI feature, the relevant resume text and job description are sent securely (HTTPS) through our server to Google's Gemini API to generate the result. Our server does not store this content. Your profile photo is removed before sending.</p><p>${google}</p><p>See Google's <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Gemini API Terms</a> and <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>` },
      { id: 'p-storage', title: '4. Storage &amp; retention', body: `<p>Resumes stay in your browser until you delete them or clear your browser data. Uploaded files are not retained. Server memory used for rate limiting is cleared within minutes. If cloud accounts are added in future, this policy will be updated first.</p>` },
      { id: 'p-share', title: '5. Sharing', body: `<p>We share data only with Google (as the AI processor, when you use AI features) and our hosting provider (to run the server). We never sell or rent your personal data. We may disclose information if required by law.</p>` },
      { id: 'p-rights', title: '6. Your rights &amp; choices', body: `<ul><li><b>Access &amp; export:</b> download a backup of all your resumes from Settings.</li><li><b>Correction:</b> edit any information in the editor.</li><li><b>Deletion:</b> delete a resume, or use "Delete all my data" in Settings.</li><li><b>Avoid AI:</b> you can build a resume entirely without AI features; nothing is then sent to Google.</li><li><b>Grievances:</b> contact us at ${contact()}. We aim to respond within 30 days.</li></ul>` },
      { id: 'p-security', title: '7. Security', body: `<p>We use HTTPS, keep the AI API key only on the server, apply security headers and rate limits, and read uploads in memory only. No system is perfectly secure, so please keep your device protected.</p>` },
      { id: 'p-children', title: '8. Children', body: `<p>${LEGAL.product} is not intended for children under 16 without parental consent. If you believe a child has used it without consent, contact us and we will help remove any data.</p>` },
      { id: 'p-changes', title: '9. Changes', body: `<p>We will post any changes on this page and update the effective date. Significant changes will be highlighted in the app.</p>` },
    ]);
}
