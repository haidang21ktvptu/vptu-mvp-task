// Lấy URL + anon/service_role key của đích kiểm thử chọn TƯỜNG MINH (DICH bên dưới — không có mặc định):
//   cục bộ từ `supabase status`; staging/production từ SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (CI: GitHub Secrets)
//   hoặc Supabase CLI đã `supabase login` (máy dev).
// Không có file .env chứa key; không in key ra log. Luôn từ chối project production (dữ liệu thật).

import { spawnSync } from 'node:child_process';

export const STAGING_REF = 'vojmrjezspdftovzinek';
export const PRODUCTION_REF = 'frwyxcmbonjaimziiuqr';
export const SEED_PASSWORD = '123456';
export const EMAIL_DOMAIN = 'vptu.caobang.local';

// Đích kiểm thử phải chọn TƯỜNG MINH, đúng một (PR-2a, sau sự cố 29/9/2026 — chạy nhầm lên staging vì thiếu biến cục bộ):
//   E2E_LOCAL=1 (Supabase cục bộ) | E2E_STAGING=1 (staging) | KIEM_THU_MOI_TRUONG=production (công tắc kiểm thử, docs/KIEM-THU.md).
// Thiếu hoặc thừa ⇒ dừng NGAY khi nạp module, trước mọi lời gọi mạng (kể cả Supabase CLI).
function chonDich() {
  const env = process.env;
  const ds = [env.E2E_LOCAL === '1' && 'local', env.E2E_STAGING === '1' && 'staging', env.KIEM_THU_MOI_TRUONG === 'production' && 'production'].filter(Boolean);
  if (ds.length === 1) return ds[0];
  console.error(`[E2E] ${ds.length ? `Chọn nhiều đích (${ds.join(', ')})` : 'Chưa chọn đích kiểm thử'} — đặt đúng một: E2E_LOCAL=1 (Supabase cục bộ) | `
    + 'E2E_STAGING=1 (staging) | KIEM_THU_MOI_TRUONG=production. Dừng, chưa có lời gọi mạng nào.');
  process.exit(2);
}
export const DICH = chonDich();

function runCli(args) {
  const r = spawnSync('supabase', args, { encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`supabase ${args.join(' ')} thất bại: ${r.stderr || r.stdout}`);
  const starts = [r.stdout.indexOf('{'), r.stdout.indexOf('[')].filter((i) => i >= 0);
  return JSON.parse(r.stdout.slice(Math.min(...starts)));
}

// Test tạo/xoá dữ liệu bằng service_role nên tuyệt đối không được trỏ vào production.
export function assertNotProduction(url) {
  if (url.includes(PRODUCTION_REF) && process.env.KIEM_THU_MOI_TRUONG !== 'production') throw new Error('Từ chối chạy test trên project production (đặt KIEM_THU_MOI_TRUONG=production nếu cố ý — docs/KIEM-THU.md).');
}

let cached = null;
export function getKeys() {
  if (cached) return cached;
  const env = process.env;
  if (DICH === 'local') {
    const s = runCli(['status', '-o', 'json']);
    cached = { url: s.API_URL, anon: s.ANON_KEY || s.PUBLISHABLE_KEY, service: s.SERVICE_ROLE_KEY || s.SECRET_KEY };
  } else if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY) {   // CI: GitHub Secrets của đích đã chọn
    cached = { url: env.SUPABASE_URL, anon: env.SUPABASE_ANON_KEY, service: env.SUPABASE_SERVICE_ROLE_KEY };
  } else {   // máy dev: Supabase CLI đã `supabase login`
    const data = runCli(['projects', 'api-keys', '--project-ref', DICH === 'staging' ? STAGING_REF : PRODUCTION_REF, '-o', 'json']);
    const list = Array.isArray(data) ? data : data.keys;
    const pick = (id) => list.find((k) => k.id === id || k.name === id)?.api_key;
    cached = { url: `https://${DICH === 'staging' ? STAGING_REF : PRODUCTION_REF}.supabase.co`, anon: pick('anon'), service: pick('service_role') };
  }
  const ref = { staging: STAGING_REF, production: PRODUCTION_REF }[DICH];
  if (ref && !cached.url.includes(ref)) throw new Error(`Đích ${DICH} nhưng SUPABASE_URL không phải project ${ref}.`);
  if (!cached.anon || !cached.service) throw new Error('Không lấy được anon/service_role key.');
  assertNotProduction(cached.url);
  return cached;
}
