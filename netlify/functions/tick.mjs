// POST /api/tick  JSON body: { seconds }.  Headers: x-booth-code, x-booth-device
// While the live engine is on, the phone checks in every 30 seconds. Each check-in adds that time
// to today's usage. When the daily limit is reached the reply is 429 and the phone ends the session.
import { settings, whoIs, usage, blocked, addUsage, json, usageBody } from '../../lib/access.mjs';
import { usageStore } from '../../lib/store.mjs';

export async function handle(req, { env = process.env, store } = {}) {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const cfg = settings(env);
  const code = req.headers.get('x-booth-code');
  const role = whoIs(code, cfg);
  if (!role) return json({ error: 'code' }, 401);
  let body = {};
  try { body = await req.json(); } catch {}
  const seconds = Math.min(45, Math.max(0, Number(body.seconds) || 0));
  const u = await usage(store, code, req.headers.get('x-booth-device'), cfg, role);
  if (seconds > 0) { await addUsage(store, u, seconds); u.used += seconds; u.all += seconds; }
  const why = blocked(u, cfg, role);
  if (why) return json({ error: 'limit', scope: why, ...usageBody(u) }, 429);
  return json({ ok: true, ...usageBody(u) });
}

export default async (req) => handle(req, { store: usageStore() });
export const config = { path: '/api/tick' };
