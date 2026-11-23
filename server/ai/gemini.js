// Google Gemini provider. The API key is read from the server environment only
// and is never sent to the browser.
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function createGeminiProvider({ apiKey, model = 'gemini-flash-latest', fallbackModels = [], timeoutMs = 25000, budgetMs = 80000 }) {
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const models = [model, ...fallbackModels.filter((m) => m && m !== model)];

  // Retries transient errors (overload / 5xx / timeout) once, then moves to the
  // next fallback model — all within an overall time budget per request.
  async function generate(opts) {
    const deadline = Date.now() + budgetMs;
    let lastErr;
    // Round 1: each model once (an overloaded model hands off immediately).
    // Round 2: retry the models once more if time remains.
    for (let round = 0; round < 2; round++) {
      for (const m of models) {
        const left = deadline - Date.now();
        if (left < 3000) throw lastErr || providerError('The AI service is busy right now. Please try again in a moment.', 503);
        try {
          const t0 = Date.now();
          const out = await callModel(m, opts, Math.min(timeoutMs, left));
          console.log(`[ai] ${m} ok in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
          return out;
        } catch (err) {
          lastErr = err;
          console.warn(`[ai] ${m} failed: ${err.message}`);
          if (!err.transient && !err.skipModel) throw err;
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw lastErr;
  }

  async function callModel(model, { system, prompt, json = false, temperature = 0.4 }, timeoutMs) {
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(`${BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      throw providerError(err.name === 'AbortError' ? 'The AI service took too long to respond.' : 'Could not reach the AI service.', 503, true);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json())?.error?.message || ''; } catch { /* ignore */ }
      const status = res.status === 429 ? 429 : res.status >= 500 ? 503 : 502;
      if (res.status >= 500) {
        throw providerError('The AI service is busy right now. Please try again in a moment.', 503, true);
      }
      if (res.status === 404) {
        // Model retired or unavailable for this key — try the next one.
        throw Object.assign(providerError(`Model "${model}" is not available.`, 502), { skipModel: true });
      }
      if (res.status === 401 || res.status === 403) {
        console.error('[ai] Gemini rejected the API key — check GEMINI_API_KEY in .env');
        throw providerError('AI features are temporarily unavailable. Please try again later.', 503);
      }
      const msg = res.status === 429
        ? 'HireReady\'s free AI capacity is busy or used up for today. Please try again in a few minutes — the daily limit resets at 1:30 PM IST.'
        : 'The AI service could not complete this request. Please try again.';
      if (detail) console.warn(`[ai] ${model} HTTP ${res.status}: ${detail.slice(0, 300)}`); // server log only
      throw providerError(msg, status, res.status === 429);
    }

    const data = await res.json();
    const cand = data?.candidates?.[0];
    const text = cand?.content?.parts?.map((p) => p.text || '').join('') || '';
    if (!text) {
      const reason = cand?.finishReason || data?.promptFeedback?.blockReason || 'empty response';
      throw providerError(`The AI returned no content (${reason}).`, 502);
    }
    if (!json) return text.trim();
    return parseJson(text);
  }

  return { name: 'gemini', model, generate };
}

function parseJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
    throw providerError('The AI response could not be read. Please try again.', 502);
  }
}

function providerError(message, status, transient = false) {
  const e = new Error(message);
  e.status = status;
  e.transient = transient;
  return e;
}
