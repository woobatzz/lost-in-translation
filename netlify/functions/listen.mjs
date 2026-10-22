// POST /api/listen  body: 16 kHz mono WAV of one phrase.  Headers: x-booth-code, x-booth-device
// Sends the audio to OpenAI for transcription with the site's key and counts the seconds against the daily limit.
import { settings, whoIs, usage, blocked, addUsage, json, usageBody, wavSeconds } from '../../lib/access.mjs';
import { usageStore } from '../../lib/store.mjs';

const MAX_BYTES = 32000 * 16 + 44; // 16 seconds of audio
let sttModel = 'whisper-1';

export async function handle(req, { env = process.env, store, fetchImpl = fetch } = {}) {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const cfg = settings(env);
  const code = req.headers.get('x-booth-code');
  const role = whoIs(code, cfg);
  if (!role) return json({ error: 'code' }, 401);
  if (!env.OPENAI_API_KEY) return json({ error: 'server_key' }, 500);

  const audio = await req.arrayBuffer();
  if (audio.byteLength < 1000) return json({ error: 'empty' }, 400);
  if (audio.byteLength > MAX_BYTES) return json({ error: 'too_long' }, 413);

  const u = await usage(store, code, req.headers.get('x-booth-device'), cfg, role);
  const why = blocked(u, cfg, role);
  if (why) return json({ error: 'limit', scope: why, ...usageBody(u) }, 429);

  let res;
  for (let attempt = 0; attempt < 2; attempt++) {
    const fd = new FormData();
    fd.append('file', new Blob([audio], { type: 'audio/wav' }), 'phrase.wav');
    fd.append('model', sttModel);
    fd.append('response_format', sttModel === 'whisper-1' ? 'verbose_json' : 'json');
    res = await fetchImpl('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: fd,
    });
    if (res.ok) break;
    if ([400, 403, 404].includes(res.status) && sttModel === 'whisper-1') { sttModel = 'gpt-4o-mini-transcribe'; continue; }
    break;
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch {}
    return json({ error: 'upstream', who: 'OpenAI', status: res.status, detail: detail.slice(0, 160) }, 502);
  }
  const out = await res.json();
  const sec = wavSeconds(audio.byteLength);
  await addUsage(store, u, sec);
  u.used += sec;
  return json({ ...out, model: sttModel, usage: usageBody(u) });
}

export default async (req) => handle(req, { store: usageStore() });
export const config = { path: '/api/listen' };
