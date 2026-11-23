// Where the HireReady API server lives.
// - Local dev / Render-hosted page: same origin as the page ('').
// - GitHub Pages (nishtek.in/hireready): the Render server below.
// If you rename the Render service or add a custom domain (e.g. api.nishtek.in),
// update REMOTE_API here AND the connect-src in index.html's CSP meta tag.
export const REMOTE_API = 'https://hireready-api.onrender.com';

const sameOrigin = ['localhost', '127.0.0.1'].includes(location.hostname) || location.hostname.endsWith('.onrender.com');
export const API_BASE = sameOrigin ? '' : REMOTE_API;
