// Lấy URL + anon/service_role key của project staging. Thứ tự ưu tiên:
//   1. Biến môi trường SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (CI: GitHub Secrets của staging).
//   2. E2E_LOCAL=1: Supabase cục bộ (`supabase status`).
//   3. Supabase CLI đã `supabase login` (máy dev): `supabase projects api-keys`, E2E_PROJECT_REF mặc định staging.
// Không có file .env chứa key; không in key ra log. Luôn từ chối project production (dữ liệu thật).

import { spawnSync } from 'node:child_process';

export const STAGING_REF = 'vojmrjezspdftovzinek';
export const PRODUCTION_REF = 'frwyxcmbonjaimziiuqr';
export const SEED_PASSWORD = '123456';
export const EMAIL_DOMAIN = 'vptu.caobang.local';

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
  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY) {
    cached = { url: env.SUPABASE_URL, anon: env.SUPABASE_ANON_KEY, service: env.SUPABASE_SERVICE_ROLE_KEY };
  } else if (env.E2E_LOCAL === '1') {
    const s = runCli(['status', '-o', 'json']);
    cached = { url: s.API_URL, anon: s.ANON_KEY || s.PUBLISHABLE_KEY, service: s.SERVICE_ROLE_KEY || s.SECRET_KEY };
  } else {
    const ref = env.E2E_PROJECT_REF || STAGING_REF;
    const data = runCli(['projects', 'api-keys', '--project-ref', ref, '-o', 'json']);
    const list = Array.isArray(data) ? data : data.keys;
    const pick = (id) => list.find((k) => k.id === id || k.name === id)?.api_key;
    cached = { url: `https://${ref}.supabase.co`, anon: pick('anon'), service: pick('service_role') };
  }
  if (!cached.anon || !cached.service) throw new Error('Không lấy được anon/service_role key.');
  assertNotProduction(cached.url);
  return cached;
}
