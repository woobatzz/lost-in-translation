// POST /api/translate  JSON body: { model, system, content }.  Header: x-booth-code
// Forwards one translation request to Claude with the site's key. Only booth-sized requests are allowed.
import { settings, whoIs, json } from '../../lib/access.mjs';

const MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5'];

export async function handle(req, { env = process.env, fetchImpl = fetch } = {}) {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const role = whoIs(req.headers.get('x-booth-code'), settings(env));
  if (!role) return json({ error: 'code' }, 401);
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'server_key' }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const model = MODELS.includes(body.model) ? body.model : MODELS[0];
  const system = String(body.system || '').slice(0, 6000);
  const content = String(body.content || '').slice(0, 6000);
  if (!content) return json({ error: 'empty' }, 400);

  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 900, system, messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch {}
    return json({ error: 'upstream', who: 'Claude', status: res.status, detail: detail.slice(0, 160) }, 502);
  }
  const data = await res.json();
  return json({ content: data.content || [], model });
}

export default async (req) => handle(req);
export const config = { path: '/api/translate' };
