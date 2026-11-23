// Provider factory. To switch AI providers later, add a module exposing
// `generate({ system, prompt, json, temperature })` and register it here.
import { createGeminiProvider } from './gemini.js';

const registry = {
  gemini: () => createGeminiProvider({
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
    fallbackModels: (process.env.GEMINI_FALLBACK_MODELS || 'gemini-flash-latest')
      .split(',').map((s) => s.trim()).filter(Boolean),
  }),
};

let instance;
export function getProvider() {
  if (!instance) {
    const name = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
    const make = registry[name];
    if (!make) throw new Error(`Unknown AI_PROVIDER "${name}"`);
    instance = make();
  }
  return instance;
}
