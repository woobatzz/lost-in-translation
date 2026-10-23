// POST /api/log  JSON body: { lines: [string] }.  Headers: x-booth-code, x-booth-device
// Diagnostics from the phone, written to the Netlify function log (kept 24 hours).
// Owner sessions send full lines, including what was said, so problems can be debugged.
// Guest phones send only event names, timings and errors, never what anyone said.
import { settings, whoIs, json } from '../../lib/access.mjs';

const GUEST_OK = /^\s*(event:|latency:|engine:|audio:|• live|✕)/;

export async function handle(req, { env = process.env, out = console } = {}) {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const role = whoIs(req.headers.get('x-booth-code'), settings(env));
  if (!role) return json({ error: 'code' }, 401);
  let body = {};
  try { body = await req.json(); } catch {}
  const device = String(req.headers.get('x-booth-device') || 'unknown').slice(0, 12);
  const lines = (Array.isArray(body.lines) ? body.lines : []).slice(0, 80).map((l) => String(l).slice(0, 400));
  let kept = 0;
  for (const l of lines) {
    if (role !== 'admin' && !GUEST_OK.test(l)) continue;
    const line = role === 'admin' ? l : l.replace(/\(heard:.*$/, '(heard: hidden)');
    out.log(`[booth ${role} ${device}] ${line.replace(/\n\s*/g, ' | ')}`);
    kept++;
  }
  return json({ ok: true, kept });
}

export default async (req) => handle(req);
export const config = { path: '/api/log' };
