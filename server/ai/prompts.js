// Prompt templates for every HireReady AI feature. Each task returns
// { system, prompt, json, temperature } and is provider-agnostic.

export const HONESTY_RULES = `You are HireReady's resume writing assistant.
STRICT RULES — never break them:
- Never invent employers, job titles, dates, degrees, institutions, certifications, tools, metrics, numbers, percentages or achievements.
- Only rephrase, restructure and clarify facts present in the user's input.
- Keep every real number and metric the user gave, exactly as given.
- If a measurable result would help but none was given, use a placeholder like "[X%]" or "[number]" and say the user must fill in a real figure — never guess one.
- A skill may be suggested only as a *suggestion*, clearly separated from the candidate's confirmed skills.
- Use clear, professional, ATS-friendly language: strong action verbs, no first-person pronouns in bullets, no tables, emojis or graphics.
- Use the spelling convention of the user's input (default to British/Indian English).
- Output exactly the JSON shape requested, with no extra commentary.`;

const clip = (s, n = 12000) => String(s ?? '').slice(0, n);
const asJson = (o) => clip(JSON.stringify(o ?? {}, null, 1), 20000);

// Compact resume for prompts (drops photo/data URLs and styling).
export function compactResume(r = {}) {
  const { photo, ...personal } = r.personal || {};
  const out = { personal, summary: r.summary };
  for (const k of Object.keys(r.sections || {})) out[k] = r.sections[k];
  return out;
}

export const tasks = {
  // 1. AI Resume Writer — turn free-form answers into a structured resume draft.
  generateResume: ({ experienceLevel, targetJob, about }) => ({
    json: true,
    temperature: 0.4,
    prompt: `Create a structured resume draft from the candidate's own words.
Experience level: ${clip(experienceLevel, 80)}
Target job: ${clip(targetJob, 120)}
Candidate's information (only source of facts):
"""${clip(about, 8000)}"""

Return JSON:
{
 "personal": {"fullName":"","headline":"","email":"","phone":"","location":"","linkedin":"","website":"","github":""},
 "summary": "3-4 sentence professional summary for the target job using only given facts",
 "experience": [{"title":"","company":"","location":"","start":"","end":"","current":false,"bullets":["..."]}],
 "internships": [same shape as experience],
 "education": [{"degree":"","institution":"","location":"","start":"","end":"","score":""}],
 "projects": [{"name":"","tech":"","link":"","bullets":["..."]}],
 "certifications": [{"name":"","issuer":"","date":""}],
 "achievements": ["..."],
 "languages": [{"name":"","level":""}],
 "skills": ["skills the candidate actually mentioned"],
 "suggestedSkills": ["skills common for the target job the candidate did NOT mention — to be confirmed by them"],
 "missingInfo": ["short questions about important info that is missing, e.g. 'What were your dates at X?'"]
}
Leave any unknown field as an empty string or empty array. Dates as written by the user (e.g. "Jan 2023").`,
  }),

  // Parse text extracted from an uploaded resume.
  parseResume: ({ text }) => ({
    json: true,
    temperature: 0.1,
    prompt: `Extract this resume into JSON. Copy facts exactly; do not improve wording or add anything.
Resume text:
"""${clip(text, 15000)}"""

Return JSON:
{
 "personal": {"fullName":"","headline":"","email":"","phone":"","location":"","linkedin":"","website":"","github":""},
 "summary": "",
 "experience": [{"title":"","company":"","location":"","start":"","end":"","current":false,"bullets":[]}],
 "internships": [same shape],
 "education": [{"degree":"","institution":"","location":"","start":"","end":"","score":""}],
 "projects": [{"name":"","tech":"","link":"","bullets":[]}],
 "certifications": [{"name":"","issuer":"","date":""}],
 "achievements": [],
 "languages": [{"name":"","level":""}],
 "volunteer": [{"title":"","company":"","start":"","end":"","bullets":[]}],
 "skills": []
}`,
  }),

  // 2. Professional summary generator.
  summary: ({ resume, targetJob, jobDescription, tone }) => ({
    json: true,
    temperature: 0.6,
    prompt: `Write professional summary options for this resume.
Target job: ${clip(targetJob, 120) || 'not specified'}
Tone: ${clip(tone, 40) || 'professional'}
${jobDescription ? `Job description (for relevance only):\n"""${clip(jobDescription, 5000)}"""` : ''}
Resume:
${asJson(compactResume(resume))}

If the candidate has no work experience, focus on education, projects, skills and motivation.
Return JSON: {"options":[{"label":"short style name","text":"3-4 sentence summary, max 70 words"}], "note":"one sentence on what was emphasised"}
Give exactly 3 options.`,
  }),

  // Headline ideas.
  headline: ({ resume, targetJob }) => ({
    json: true,
    temperature: 0.7,
    prompt: `Suggest professional resume headlines (max 60 characters each) for this candidate.
Target job: ${clip(targetJob, 120) || 'not specified'}
Resume:
${asJson(compactResume(resume))}
Return JSON: {"headlines":["...", "...", "...", "..."]}`,
  }),

  // 3. Job description analyser.
  analyzeJob: ({ jobDescription, targetJob }) => ({
    json: true,
    temperature: 0.2,
    prompt: `Analyse this job description${targetJob ? ` for the role "${clip(targetJob, 120)}"` : ''}.
"""${clip(jobDescription, 12000)}"""

Return JSON:
{
 "jobTitle": "",
 "company": "",
 "seniority": "Fresher | Junior | Mid | Senior | Lead | Unknown",
 "requiredSkills": [],
 "preferredQualifications": [],
 "experienceRequired": "",
 "tools": ["technical tools and technologies"],
 "keywords": ["10-20 most important ATS keywords, short phrases"],
 "responsibilities": [],
 "industryTerms": [],
 "education": "",
 "softSkills": [],
 "plainSummary": "2-3 sentence plain-English explanation of what this job is about"
}`,
  }),

  // 5 & 6. Resume vs job match + missing keywords.
  match: ({ resume, jobDescription, targetJob }) => ({
    json: true,
    temperature: 0.1,
    prompt: `Compare this resume against the job description and score how well it aligns.
Target job: ${clip(targetJob, 120) || 'from description'}
Job description:
"""${clip(jobDescription, 10000)}"""
Resume:
${asJson(compactResume(resume))}

Scoring guidance (0-100): keyword/skill coverage 40%, relevant experience 30%, education/qualification fit 15%, clarity of summary and bullets 15%. Be realistic, not generous.
Distinguish between:
- "notMentioned": job keywords the resume does not show, but which the candidate's experience suggests they may have (they should add them only if true)
- "missing": job requirements with no evidence in the resume (genuine gaps to learn or address)

Return JSON:
{
 "score": 0,
 "breakdown": {"keywords":0,"experience":0,"education":0,"clarity":0},
 "matchedSkills": [],
 "notMentioned": [{"keyword":"","reason":""}],
 "missing": [{"keyword":"","reason":""}],
 "strengths": ["..."],
 "suggestions": ["specific, actionable improvement"],
 "verdict": "one sentence"
}`,
  }),

  // 4. Job-specific optimiser (creates a tailored version; client shows a diff).
  optimize: ({ resume, jobDescription, targetJob, analysis }) => ({
    json: true,
    temperature: 0.4,
    prompt: `Tailor this resume to the target job WITHOUT inventing anything.
Target job: ${clip(targetJob, 120) || 'from description'}
Job description:
"""${clip(jobDescription, 8000)}"""
${analysis ? `Job analysis: ${asJson(analysis)}` : ''}
Resume (entries have "id" fields — keep them):
${asJson(compactResume(resume))}

Extra rules for tailoring:
- Keep every real number, percentage and metric exactly as written in the resume. Never replace a real figure with a placeholder.
- Do NOT copy duties, tools or achievements from the job description into the resume unless the resume already states them. Only use the job's wording to rephrase things the candidate actually did.
- Do not state a total years-of-experience figure unless the resume states it.

Tasks:
1. Rewrite the summary for this job (only real facts).
2. Rewrite bullets of experience/internships/projects to use relevant job keywords where truthful, accomplishment-focused. Keep the same number of facts; don't add new claims. Use [X%] placeholders where a metric would help.
3. Order skills so the most job-relevant come first; list job skills the candidate did not mention separately as suggestions.
4. Recommend a section order for this job.
5. Point out content that is less relevant and could be shortened.
6. Suggest a headline. Suggest a job-title wording change ONLY if it is factually equivalent.

Return JSON:
{
 "headline": "",
 "summary": "",
 "entries": [{"section":"experience|internships|projects","id":"","bullets":["..."]}],
 "skills": ["candidate's existing skills, reordered by relevance"],
 "suggestedSkills": ["job skills to add only if the candidate really has them"],
 "sectionOrder": ["summary","experience","skills","projects","education","..."],
 "lessRelevant": ["..."],
 "titleSuggestions": [{"id":"","current":"","suggested":"","why":""}],
 "changes": ["short list of what was changed and why"]
}`,
  }),

  // 7. Bullet point rewriter.
  bullets: ({ bullets, role, targetJob, context }) => ({
    json: true,
    temperature: 0.5,
    prompt: `Rewrite these resume bullet points into concise, accomplishment-focused statements.
Role: ${clip(role, 160) || 'not specified'}
Target job: ${clip(targetJob, 120) || 'not specified'}
${context ? `Extra context from the candidate: ${clip(context, 1500)}` : ''}
Bullets:
${asJson(bullets)}

Each bullet: start with a strong action verb, 1 line (max ~25 words), no "I", keep every fact, add no new facts. If a number would strengthen it, add a [number] placeholder.
Return JSON: {"bullets":[{"original":"","improved":"","why":"short reason"}]}`,
  }),

  // 8. Skills recommendations.
  skills: ({ resume, targetJob, jobDescription }) => ({
    json: true,
    temperature: 0.4,
    prompt: `Recommend skills for this candidate.
Target job: ${clip(targetJob, 120) || 'not specified'}
${jobDescription ? `Job description:\n"""${clip(jobDescription, 5000)}"""` : ''}
Resume:
${asJson(compactResume(resume))}

Return JSON:
{
 "evidenced": [{"skill":"","evidence":"where the resume shows it"}],
 "recommended": [{"skill":"","why":"why it matters for the job — add only if the candidate really has it"}],
 "softSkills": ["..."]
}
"evidenced" = skills shown in the resume text but missing from the skills list.`,
  }),

  // 9. Grammar & writing improvement.
  improve: ({ text, tone, mode }) => ({
    json: true,
    temperature: 0.4,
    prompt: `Improve this resume text.
Mode: ${clip(mode, 40) || 'professional'} (one of: professional, concise, grammar-only, simplify, impactful)
Tone: ${clip(tone, 40) || 'professional'}
Text:
"""${clip(text, 6000)}"""

Keep every fact; add nothing new. For grammar-only, only fix spelling, grammar and punctuation.
Return JSON: {"improved":"", "changes":[{"from":"","to":"","why":""}]}`,
  }),

  // Whole-resume grammar scan (used by ATS checker).
  grammarScan: ({ resume }) => ({
    json: true,
    temperature: 0.1,
    prompt: `Find spelling, grammar, tense-consistency and repetition issues in this resume.
${asJson(compactResume(resume))}
Return JSON: {"issues":[{"where":"section/field","text":"original phrase","fix":"corrected phrase","type":"spelling|grammar|tense|repetition|style"}]}
Return at most 15 issues. Return an empty array if none.`,
  }),

  // 10. Cover letter.
  coverLetter: ({ resume, jobDescription, targetJob, company, hiringManager, tone }) => ({
    json: true,
    temperature: 0.6,
    prompt: `Write a cover letter for this candidate.
Job: ${clip(targetJob, 120) || 'from description'}
Company: ${clip(company, 120) || 'from description, else "your company"'}
Hiring manager: ${clip(hiringManager, 80) || 'Hiring Manager'}
Tone: ${clip(tone, 40) || 'professional and warm'}
${jobDescription ? `Job description:\n"""${clip(jobDescription, 6000)}"""` : ''}
Resume:
${asJson(compactResume(resume))}

250-350 words, 4 paragraphs, specific to the job, only real facts from the resume.
Return JSON: {"subject":"", "letter":"full letter text with greeting and sign-off using the candidate's name, paragraphs separated by blank lines"}`,
  }),

  // 11. LinkedIn summary.
  linkedin: ({ resume, targetJob, tone }) => ({
    json: true,
    temperature: 0.7,
    prompt: `Write LinkedIn profile content for this candidate.
Target role: ${clip(targetJob, 120) || 'not specified'}
Tone: ${clip(tone, 40) || 'friendly professional'}
Resume:
${asJson(compactResume(resume))}

Return JSON:
{"headlines":["3 LinkedIn headlines, max 220 chars"], "about":"LinkedIn About section, first person, 150-250 words, short paragraphs, only real facts", "hashtags":["5 relevant"]}`,
  }),

  interviewQuestions: ({ resume, targetJob, jobDescription }) => ({
    json: true,
    temperature: 0.6,
    prompt: `Generate likely interview questions for this candidate and job.
Target job: ${clip(targetJob, 120) || 'not specified'}
${jobDescription ? `Job description:\n"""${clip(jobDescription, 5000)}"""` : ''}
Resume:
${asJson(compactResume(resume))}
Return JSON: {"questions":[{"category":"Technical|Behavioural|Role-specific|About your resume","question":"","tip":"how to approach the answer"}]}
Give 12 questions.`,
  }),

  skillsGap: ({ resume, targetJob, jobDescription }) => ({
    json: true,
    temperature: 0.4,
    prompt: `Do a skills gap analysis for this candidate and target job.
Target job: ${clip(targetJob, 120) || 'not specified'}
${jobDescription ? `Job description:\n"""${clip(jobDescription, 5000)}"""` : ''}
Resume:
${asJson(compactResume(resume))}
Return JSON: {"have":["..."], "gaps":[{"skill":"","priority":"High|Medium|Low","howToLearn":"concrete free/low-cost way to learn it"}], "summary":"2 sentences"}`,
  }),
};

export const SYSTEM = HONESTY_RULES;
