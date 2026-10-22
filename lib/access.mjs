// Shared access rules for the booth's server functions.
// Env vars (set in Netlify > Site configuration > Environment variables):
//   OPENAI_API_KEY, ANTHROPIC_API_KEY   provider keys, never sent to the browser
//   INVITE_CODES                        comma separated codes for family and friends, e.g. "FAMILIA,SUEGROS"
//   ADMIN_CODES                         comma separated codes with no daily limit (yours)
//   DAILY_MINUTES                       minutes of speech per person per day for invite codes (default 10)
//   GLOBAL_DAILY_MINUTES                safety cap for everyone together per day (default 120)

const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

export function settings(env = process.env) {
  return {
    invite: list(env.INVITE_CODES),
    admin: list(env.ADMIN_CODES),
    dailySec: Math.max(1, Number(env.DAILY_MINUTES || 10)) * 60,
    globalSec: Math.max(1, Number(env.GLOBAL_DAILY_MINUTES || 120)) * 60,
  };
}

export function whoIs(code, cfg) {
  const c = String(code || '').trim();
  if (!c) return null;
  if (cfg.admin.includes(c)) return 'admin';
  if (cfg.invite.includes(c)) return 'guest';
  return null;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

// The device id only separates people who share one code. Keep it short and safe for a key.
export function cleanDevice(d) {
  return String(d || 'unknown').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'unknown';
}

// 16 kHz, 16-bit mono WAV from the booth: 32,000 bytes per second after the 44 byte header.
export function wavSeconds(bytes) {
  return Math.max(0, (bytes - 44) / 32000);
}

// store: { get(key) -> number|null, set(key, number) }. Netlify Blobs in production, a Map in tests.
export async function usage(store, code, device, cfg, role) {
  const day = today();
  const personKey = `${day}/${code}/${cleanDevice(device)}`;
  const globalKey = `${day}/_all`;
  const used = Number((await store.get(personKey)) || 0);
  const all = Number((await store.get(globalKey)) || 0);
  const limit = role === 'admin' ? null : cfg.dailySec;
  return { day, personKey, globalKey, used, all, limit };
}

export function blocked(u, cfg, role) {
  if (role === 'admin') return null;
  if (u.used >= u.limit) return 'person';
  if (u.all >= cfg.globalSec) return 'global';
  return null;
}

export async function addUsage(store, u, seconds) {
  await store.set(u.personKey, Math.round((u.used + seconds) * 10) / 10);
  await store.set(u.globalKey, Math.round((u.all + seconds) * 10) / 10);
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export function usageBody(u) {
  return { usedSec: Math.round(u.used), limitSec: u.limit, day: u.day };
}
