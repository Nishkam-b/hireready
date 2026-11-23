// Safety net for the candidate's name. Small models sometimes shorten
// "Riya Malhotra" to "Riya". The user's own text is the source of truth:
// if it contains a longer version of the name the AI returned, use that.

const NAME_WORD = /^[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ.'-]*$/;
const STOP = new Set(['and', 'from', 'email', 'e-mail', 'phone', 'mobile', 'i', 'my', 'live', 'living', 'am', 'is', 'a', 'an', 'the', 'resume', 'cv', 'aged', 'age', 'currently', 'with', 'who', 'here', 'in']);

const titleCase = (s) => (s === s.toLowerCase() ? s.replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s);

// Read up to 4 name-like words from the start of `s`.
function takeName(s) {
  const words = [];
  for (const w of String(s).split(/\s+/)) {
    const bare = w.replace(/[,.;:|()]+$/, '');
    if (!bare || !NAME_WORD.test(bare) || STOP.has(bare.toLowerCase())) break;
    words.push(bare);
    if (words.length === 4 || bare !== w) break; // punctuation ends the name
  }
  return words.join(' ');
}

// Explicit statements: "My name is X", "I am X", "Name: X".
// "I am …" is weak evidence ("I am working at…"), so it only extends a name the AI already gave.
function statedName(text, allowWeak) {
  const re = allowWeak ? /(?:my name is|i am|i'm|name\s*[:\-–])\s*([^\n]{2,80})/i : /(?:my name is|name\s*[:\-–])\s*([^\n]{2,80})/i;
  const m = String(text).match(re);
  return m ? takeName(m[1]) : '';
}

// Resume-style text: a line near the top that starts with the AI's name.
function lineName(text, aiName) {
  const first = aiName.split(/\s+/)[0].toLowerCase();
  for (const line of String(text).split('\n').slice(0, 8)) {
    const t = line.trim();
    if (t.toLowerCase().startsWith(first)) {
      const n = takeName(t);
      if (n) return n;
    }
  }
  return '';
}

const words = (s) => s.toLowerCase().split(/\s+/).filter(Boolean);
// true if every word of `a` appears, in order, at the start of `b` (and b is longer)
const isShorterPrefix = (a, b) => {
  const wa = words(a); const wb = words(b);
  return wb.length > wa.length && wa.every((w, i) => wb[i] === w);
};

export function fixFullName(result, sourceText) {
  if (!result || typeof result !== 'object') return result;
  const p = result.personal || (result.personal = {});
  const ai = String(p.fullName || '').trim();
  const stated = statedName(sourceText, Boolean(ai));
  const candidate = stated || (ai ? lineName(sourceText, ai) : '');
  if (!candidate) return result;
  if (!ai || isShorterPrefix(ai, candidate)) p.fullName = titleCase(candidate);
  return result;
}
