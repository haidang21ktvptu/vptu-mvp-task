// Tiện ích xác định cho dữ liệu tổng hợp: PRNG seed cố định, uuid theo (không gian, chỉ số), cộng ngày, mốc giờ Việt Nam.
export const SEED = 20260929;

// mulberry32 — PRNG xác định.
function taoRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const rng = taoRng(SEED);
export const chon = (arr) => arr[Math.floor(rng() * arr.length)];
export const khoang = (a, b) => a + Math.floor(rng() * (b - a + 1));
// uuid xác định: ffff000<không gian>-0000-4000-8000-<chỉ số 12 hex>.
export const uid = (ns, i) => `ffff000${ns}-0000-4000-8000-${i.toString(16).padStart(12, '0')}`;
export const cong = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const luc = (iso, gio = '08:00') => `${iso} ${gio}:00+07`;
