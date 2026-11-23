import { Router } from 'express';
import dns from 'node:dns/promises';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { getProvider } from '../ai/provider.js';
import { tasks, SYSTEM } from '../ai/prompts.js';

const router = Router();

// Endpoint -> prompt task + required fields.
const ENDPOINTS = {
  'generate-resume': { task: 'generateResume', require: ['about'] },
  'parse-resume': { task: 'parseResume', require: ['text'] },
  summary: { task: 'summary', require: ['resume'] },
  headline: { task: 'headline', require: ['resume'] },
  'analyze-job': { task: 'analyzeJob', require: ['jobDescription'] },
  match: { task: 'match', require: ['resume', 'jobDescription'] },
  optimize: { task: 'optimize', require: ['resume', 'jobDescription'] },
  bullets: { task: 'bullets', require: ['bullets'] },
  skills: { task: 'skills', require: ['resume'] },
  improve: { task: 'improve', require: ['text'] },
  'grammar-scan': { task: 'grammarScan', require: ['resume'] },
  'cover-letter': { task: 'coverLetter', require: ['resume'] },
  linkedin: { task: 'linkedin', require: ['resume'] },
  'interview-questions': { task: 'interviewQuestions', require: ['resume'] },
  'skills-gap': { task: 'skillsGap', require: ['resume'] },
};

/* ---------- Free-tier quota savers ---------- */
// 1) Cache: identical requests (same resume + same job) are answered without
//    calling Gemini again. Creative "give me new ideas" endpoints are not cached.
const NO_CACHE = new Set(['headline', 'summary', 'cover-letter', 'linkedin', 'interview-questions']);
const CACHE_TTL = (Number(process.env.AI_CACHE_MINUTES) || 360) * 60_000;
const cache = new Map();
const cacheKey = (path, body) => createHash('sha256').update(path + JSON.stringify(body)).digest('hex');
function cacheGet(k) {
  const hit = cache.get(k);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL) { cache.delete(k); return null; }
  return hit.result;
}
function cacheSet(k, result) {
  cache.set(k, { at: Date.now(), result });
  if (cache.size > 500) cache.delete(cache.keys().next().value); // drop oldest
}

// 2) Per-user daily cap so one person can't use the whole shared free quota.
//    Counts reset at midnight Pacific time, when Google resets its daily quota.
const DAILY_CAP = Number(process.env.AI_DAILY_LIMIT_PER_USER) || 25;
const usage = new Map();
const pacificDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
function takeQuota(ip) {
  const day = pacificDay();
  const u = usage.get(ip);
  if (!u || u.day !== day) { usage.set(ip, { day, n: 1 }); return DAILY_CAP - 1; }
  if (u.n >= DAILY_CAP) return -1;
  u.n++;
  return DAILY_CAP - u.n;
}
function refundQuota(ip) { const u = usage.get(ip); if (u && u.n > 0) u.n--; }

// 3) Site-wide daily budget, kept a little under Google's free quota so a burst
//    of users (or an attacker using many IPs) can't exhaust it.
const SITE_CAP = Number(process.env.AI_DAILY_GLOBAL_LIMIT) || 450;
const site = { day: '', n: 0 };
function takeSite() {
  const day = pacificDay();
  if (site.day !== day) { site.day = day; site.n = 0; }
  if (site.n >= SITE_CAP) return false;
  site.n++;
  return true;
}
function refundSite() { site.n = Math.max(0, site.n - 1); }

// Rejects oversized fields before anything is sent to the AI.
const MAX_CHARS = { about: 8000, text: 15000, jobDescription: 12000, resume: 60000, bullets: 4000 };
function tooLarge(input) {
  for (const [k, max] of Object.entries(MAX_CHARS)) {
    const v = input[k];
    if (v != null && JSON.stringify(v).length > max) return k;
  }
  return null;
}

for (const [path, { task, require }] of Object.entries(ENDPOINTS)) {
  router.post(`/${path}`, async (req, res) => {
    const input = req.body || {};
    const missing = require.filter((k) => {
      const v = input[k];
      return v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
    });
    if (missing.length) return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` });
    const big = tooLarge(input);
    if (big) return res.status(413).json({ error: 'That text is too long. Please shorten it and try again.' });

    const key = NO_CACHE.has(path) ? null : cacheKey(path, input);
    const cached = key && cacheGet(key);
    if (cached) { res.set('X-AI-Cache', 'hit'); return res.json({ result: cached }); }

    const ip = req.ip || 'unknown';
    const left = takeQuota(ip);
    if (left < 0) {
      return res.status(429).json({ error: `You've used today's ${DAILY_CAP} free AI requests. HireReady is free for everyone, so AI use is shared fairly — it resets at 1:30 PM IST. You can keep editing and downloading meanwhile.` });
    }
    if (!takeSite()) {
      refundQuota(ip);
      return res.status(429).json({ error: 'HireReady has reached today\'s free AI limit. It resets at 1:30 PM IST — you can keep editing and downloading meanwhile.' });
    }
    res.set('X-AI-Remaining-Today', String(left));

    try {
      const spec = tasks[task](input);
      const result = await getProvider().generate({ system: SYSTEM, ...spec });
      if (task === 'match' && typeof result.score === 'number') {
        result.score = Math.max(0, Math.min(100, Math.round(result.score)));
      }
      if (key) cacheSet(key, result);
      res.json({ result });
    } catch (err) {
      refundQuota(ip); // failed requests don't count against the user
      refundSite();
      console.error(`[ai:${path}]`, err.message);
      res.status(err.status || 500).json({ error: err.message || 'AI request failed.' });
    }
  });
}

// Fetch a job listing URL and return its readable text (public hosts only).
router.post('/fetch-job', async (req, res) => {
  try {
    let url = new URL(String(req.body?.url || ''));
    let r;
    // Follow redirects manually so every hop is checked against private addresses.
    for (let hop = 0; hop < 4; hop++) {
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http(s) links are supported.');
      const { address } = await dns.lookup(url.hostname);
      if (isPrivate(address)) throw new Error('That address is not allowed.');
      r = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(12000),
        headers: { 'User-Agent': 'Mozilla/5.0 (HireReady job reader)', Accept: 'text/html' },
      });
      const loc = r.status >= 300 && r.status < 400 && r.headers.get('location');
      if (!loc) break;
      url = new URL(loc, url);
    }
    if (!r.ok) throw new Error(`The page returned ${r.status}. Paste the job description instead.`);
    if (!/text\/html|text\/plain/i.test(r.headers.get('content-type') || '')) throw new Error('That link is not a web page. Paste the job description instead.');
    const html = await readCapped(r, 1_000_000);
    const text = html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<(br|\/p|\/li|\/h\d|\/div)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
      .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
    if (text.length < 200) throw new Error('Could not read the job description from that page (it may need a login). Paste the text instead.');
    res.json({ text: text.slice(0, 15000) });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not fetch that link.' });
  }
});

// Reads at most `max` bytes so a huge page can't exhaust server memory.
async function readCapped(r, max) {
  const reader = r.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    chunks.push(value);
    if (size >= max) { reader.cancel().catch(() => {}); break; }
  }
  return Buffer.concat(chunks).toString('utf8');
}

function isPrivate(ip) {
  if (net.isIPv6(ip)) return ip === '::1' || /^f[cd]/i.test(ip) || /^fe80/i.test(ip) || ip.startsWith('::ffff:127.');
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

export default router;
