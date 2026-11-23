# HireReady – AI-powered ATS Resume Builder

Build, optimise and download ATS-friendly resumes for free. Node.js + Express backend, vanilla-JS frontend (no build step), Google Gemini for AI.

## Run

```bash
npm install
cp .env.example .env      # then put your Gemini key in .env
npm start                 # http://localhost:3000
```

## Environment (`.env`, never committed)

| Variable | Purpose |
| --- | --- |
| `AI_PROVIDER` | `gemini` (add more providers in `server/ai/provider.js`) |
| `GEMINI_API_KEY` | Your Gemini key — read only on the server |
| `GEMINI_MODEL` | Primary model (default `gemini-flash-lite-latest` — biggest free-tier daily quota) |
| `GEMINI_FALLBACK_MODELS` | Comma-separated fallbacks used when the primary is busy (default `gemini-flash-latest`) |
| `RATE_LIMIT_PER_MINUTE` | AI requests per IP per minute (default 20) |
| `AI_DAILY_LIMIT_PER_USER` | AI requests per IP per day, resets midnight Pacific (default 25) |
| `AI_CACHE_MINUTES` | How long identical AI requests are served from cache (default 360) |
| `PORT` | Server port (default 3000) |

## Structure

```
server/
  index.js              Express app, security headers, rate limits, static files
  ai/gemini.js          Gemini provider: timeouts, retries, model fallback, JSON parsing
  ai/provider.js        Provider factory (swap AI vendor here)
  ai/prompts.js         All AI prompts + "never invent facts" rules
  routes/ai.js          /api/ai/* endpoints (+ safe job-URL fetcher)
  routes/files.js       Resume upload text extraction (PDF/DOCX/TXT), DOCX export
  export/docx.js        ATS-safe DOCX builder
  middleware/rateLimit.js
public/
  js/schema.js          Shared resume schema (used by browser and server)
  js/store.js           Local-first storage (browser localStorage)
  js/render.js          Resume renderer (preview + PDF) and ATS plain text
  js/templates.js       22 templates (18 ATS-safe, 4 creative)
  js/ats.js             10 ATS compatibility checks + one-click fixes
  js/pages/*            Dashboard, onboarding, editor, analysis, tools, misc
```

## AI endpoints (`POST /api/ai/...`)

`generate-resume`, `parse-resume`, `summary`, `headline`, `analyze-job`, `match`, `optimize`, `bullets`, `skills`, `improve`, `grammar-scan`, `cover-letter`, `linkedin`, `interview-questions`, `skills-gap`, `fetch-job`.

## Security

- **API key:** lives only in `.env` (git-ignored), read only by `server/ai/provider.js`. It is never sent to the browser, logged, or included in error messages. Never commit `.env`; on a host, set `GEMINI_API_KEY` in the dashboard's environment variables.
- **Headers:** strict Content-Security-Policy (no inline scripts), clickjacking protection, no-sniff, no-referrer, COOP/CORP, HSTS over HTTPS (`server/middleware/security.js`).
- **API protection:** same-origin check + custom header on every POST, per-minute rate limit, per-user and site-wide daily AI caps, input size limits, response caching.
- **Uploads:** 5 MB max, real file-type check (magic bytes), processed in memory and discarded.
- **Job-link fetcher:** http(s) only, blocks private/internal addresses on every redirect, 1 MB read cap.
- **Production:** set `FORCE_HTTPS=1` and `TRUST_PROXY=1` (when behind a proxy). Static serving refuses dotfiles.

## Notes

- PDF download uses the browser's print engine ("Save as PDF"), giving real selectable/searchable text.
- Resumes are stored in the user's browser only. Add a database-backed `store.js` for accounts / cloud sync.
- The ATS score reflects HireReady's own checks; it does not guarantee results in any employer's ATS.
