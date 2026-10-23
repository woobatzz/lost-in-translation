// POST /api/session  JSON body: { target: "en" | "ru" | ... }.  Headers: x-booth-code, x-booth-device
// Mints a short-lived OpenAI client secret for one live translation stream (GPT-Realtime-Translate).
// The phone opens two of these, one per direction, on the same microphone.
import { settings, whoIs, usage, blocked, json, usageBody } from '../../lib/access.mjs';
import { usageStore } from '../../lib/store.mjs';

// Output languages GPT-Realtime-Translate supports, per OpenAI's translation guide.
const OUTPUT = ['es', 'pt', 'fr', 'ja', 'ru', 'zh', 'de', 'ko', 'hi', 'id', 'vi', 'it', 'en'];

export async function handle(req, { env = process.env, store, fetchImpl = fetch } = {}) {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const cfg = settings(env);
  const code = req.headers.get('x-booth-code');
  const role = whoIs(code, cfg);
  if (!role) return json({ error: 'code' }, 401);
  if (!env.OPENAI_API_KEY) return json({ error: 'server_key' }, 500);

  let body = {};
  try { body = await req.json(); } catch {}
  const target = String(body.target || '').toLowerCase();
  if (!OUTPUT.includes(target)) return json({ error: 'language', supported: OUTPUT }, 400);

  const u = await usage(store, code, req.headers.get('x-booth-device'), cfg, role);
  const why = blocked(u, cfg, role);
  if (why) return json({ error: 'limit', scope: why, ...usageBody(u) }, 429);

  const res = await fetchImpl('https://api.openai.com/v1/realtime/translations/client_secrets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      // Lets OpenAI tell users apart for abuse handling without receiving personal data.
      'OpenAI-Safety-Identifier': `booth-${role}-${String(req.headers.get('x-booth-device') || 'unknown').slice(0, 40)}`,
    },
    body: JSON.stringify({
      session: {
        model: 'gpt-realtime-translate',
        audio: {
          input: { transcription: { model: 'gpt-realtime-whisper' }, noise_reduction: { type: 'near_field' } },
          output: { language: target },
        },
      },
    }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch {}
    return json({ error: 'upstream', who: 'OpenAI', status: res.status, detail: detail.slice(0, 200) }, 502);
  }
  const data = await res.json();
  const value = data.value || data.client_secret?.value || data.client_secret;
  if (!value) return json({ error: 'upstream', who: 'OpenAI', status: 200, detail: 'No client secret in reply' }, 502);
  return json({ value, expires_at: data.expires_at || data.client_secret?.expires_at || null, target, usage: usageBody(u) });
}

export default async (req) => handle(req, { store: usageStore() });
export const config = { path: '/api/session' };
