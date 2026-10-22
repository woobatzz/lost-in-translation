import { getStore } from '@netlify/blobs';

// Small wrapper so the functions only see get/set with numbers.
export function usageStore() {
  const s = getStore('booth-usage');
  return {
    async get(key) {
      const v = await s.get(key);
      return v == null ? null : Number(v);
    },
    async set(key, n) {
      await s.set(key, String(n));
    },
  };
}
