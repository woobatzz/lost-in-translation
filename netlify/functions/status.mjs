// GET /api/status  Headers: x-booth-code, x-booth-device
// Says whether the code works, whether the server keys are set, and how many minutes are left today.
import { settings, whoIs, usage, json, usageBody } from '../../lib/access.mjs';
import { usageStore } from '../../lib/store.mjs';

export async function handle(req, { env = process.env, store } = {}) {
  const cfg = settings(env);
  const code = req.headers.get('x-booth-code');
  const role = whoIs(code, cfg);
  const keys = { listen: !!env.OPENAI_API_KEY, translate: !!env.ANTHROPIC_API_KEY };
  if (!role) return json({ ok: false, error: 'code', keys }, 401);
  const u = await usage(store, code, req.headers.get('x-booth-device'), cfg, role);
  return json({ ok: true, role, keys, ...usageBody(u) });
}

export default async (req) => handle(req, { store: usageStore() });
export const config = { path: '/api/status' };
