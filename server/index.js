import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import aiRoutes from './routes/ai.js';
import fileRoutes from './routes/files.js';
import { rateLimit } from './middleware/rateLimit.js';
import { securityHeaders, httpsRedirect, sameOriginOnly, cors } from './middleware/security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Fail fast if the AI key is missing — never print the key itself.
if (!process.env.GEMINI_API_KEY) {
  console.warn('[security] GEMINI_API_KEY is not set — AI features will be unavailable.');
}

app.disable('x-powered-by');
// Only trust X-Forwarded-For when deployed behind a real proxy (Render, Railway, Nginx…).
// Otherwise anyone could fake their IP and bypass rate limits.
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY : false);

app.use(httpsRedirect);
app.use(securityHeaders);
app.use('/api', cors);
app.use('/api', sameOriginOnly);
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const limit = Number(process.env.RATE_LIMIT_PER_MINUTE) || 20;
app.use('/api/ai', rateLimit({ windowMs: 60_000, max: limit }), aiRoutes);
app.use('/api/files', rateLimit({ windowMs: 60_000, max: limit * 2 }), fileRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Only the public/ folder is served. dotfiles (like .env) are always refused.
app.use(express.static(PUBLIC_DIR, { extensions: ['html'], dotfiles: 'deny', index: 'index.html' }));
app.get('*', (req, res) => {
  if (/\/\.|\.(env|js|json|map|md)$/i.test(req.path)) return res.status(404).send('Not found');
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Never leak stack traces or internal messages to the browser.
app.use((err, _req, res, _next) => {
  const status = err.type === 'entity.too.large' ? 413 : err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status === 413 ? 'Request too large. Shorten the text and try again.' : status < 500 && err.expose ? err.message : 'Something went wrong.' });
});

app.listen(PORT, () => console.log(`HireReady running at http://localhost:${PORT}`));
