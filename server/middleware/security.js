// Security middleware: headers, HTTPS enforcement and same-origin API protection.

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': process.env.FORCE_HTTPS === '1' ? `${CSP}; upgrade-insecure-requests` : CSP,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Permitted-Cross-Domain-Policies': 'none',
  });
  // HSTS only makes sense over HTTPS (i.e. in production).
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

// Set FORCE_HTTPS=1 in production so plain-http visits are redirected.
export function httpsRedirect(req, res, next) {
  if (process.env.FORCE_HTTPS === '1' && !req.secure && req.method === 'GET') {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
}

const allowedOrigins = () => new Set((process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean));

// CORS for the API: only the official front-end (e.g. https://nishtek.in) may call it.
export function cors(req, res, next) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins().has(origin)) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type, X-HireReady',
      'Access-Control-Expose-Headers': 'X-AI-Remaining-Today, X-AI-Cache',
      'Access-Control-Max-Age': '86400',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      Vary: 'Origin',
    });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(origin && allowedOrigins().has(origin) ? 204 : 403);
  next();
}

// Blocks other websites from using HireReady's API (and its AI quota) from a
// visitor's browser. Requests must come from our own pages and carry our header,
// which browsers can't add cross-site without a CORS preflight we never approve.
export function sameOriginOnly(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const allowed = allowedOrigins();
  const host = req.headers.host;
  const origin = req.headers.origin;
  const okOrigin = !origin || allowed.has(origin) || origin === `http://${host}` || origin === `https://${host}`;
  if (!okOrigin || req.get('X-HireReady') !== '1') {
    return res.status(403).json({ error: 'Request blocked.' });
  }
  next();
}
