import { API_BASE } from './config.js';

// Thin client for the HireReady backend. The browser never sees the AI key.
async function request(url, body, { raw = false } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: body instanceof FormData ? { 'X-HireReady': '1' } : { 'Content-Type': 'application/json', 'X-HireReady': '1' },
      credentials: 'same-origin',
      body: body instanceof FormData ? body : JSON.stringify(body || {}),
    });
  } catch {
    throw new Error('Could not reach the HireReady server. Check your connection.');
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return raw ? res : res.json();
}

// Strip the photo before sending a resume to the AI (privacy + payload size).
const lean = (resume) => (resume ? { ...resume, personal: { ...resume.personal, photo: '' }, ats: undefined } : resume);

export const ai = (endpoint, payload = {}) => {
  const body = { ...payload };
  if (body.resume) body.resume = lean(body.resume);
  return request(`${API_BASE}/api/ai/${endpoint}`, body).then((d) => d.result);
};

export const fetchJob = (url) => request(`${API_BASE}/api/ai/fetch-job`, { url }).then((d) => d.text);

export async function extractFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  return request(`${API_BASE}/api/files/extract`, fd);
}

export async function downloadDocx(resume, fileName) {
  const res = await request(`${API_BASE}/api/files/export/docx`, { resume: lean(resume), fileName }, { raw: true });
  saveBlob(await res.blob(), `${fileName}.docx`);
}

export async function downloadPdf(resume, fileName) {
  const res = await request(`${API_BASE}/api/files/export/pdf`, { resume: lean(resume), fileName }, { raw: true });
  saveBlob(await res.blob(), `${fileName}.pdf`);
}

// Instagram / Facebook / other in-app browsers usually block file downloads.
export const inAppBrowser = () => /Instagram|FBAN|FBAV|FB_IAB|Line\/|Snapchat|; wv\)/i.test(navigator.userAgent);

export async function downloadCoverLetter(letter, name) {
  const res = await request(`${API_BASE}/api/files/export/cover-letter`, { letter, name }, { raw: true });
  saveBlob(await res.blob(), `${name || 'Cover'} Cover Letter.docx`);
}

export function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
