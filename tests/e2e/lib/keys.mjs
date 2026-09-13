// Lấy URL + anon/service_role key của project staging qua Supabase CLI đã `supabase login`
// (cùng cách với tests/rls/lib.mjs). Không có file .env chứa key; không in key ra log.
// Ghi đè bằng biến môi trường: E2E_PROJECT_REF (mặc định staging), hoặc E2E_LOCAL=1.

import { spawnSync } from 'node:child_process';

export const STAGING_REF = 'vojmrjezspdftovzinek';
export const SEED_PASSWORD = '123456';
export const EMAIL_DOMAIN = 'vptu.caobang.local';

function runCli(args) {
  const r = spawnSync('supabase', args, { encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`supabase ${args.join(' ')} thất bại: ${r.stderr || r.stdout}`);
  const starts = [r.stdout.indexOf('{'), r.stdout.indexOf('[')].filter((i) => i >= 0);
  return JSON.parse(r.stdout.slice(Math.min(...starts)));
}

let cached = null;
export function getKeys() {
  if (cached) return cached;
  if (process.env.E2E_LOCAL === '1') {
    const s = runCli(['status', '-o', 'json']);
    cached = { url: s.API_URL, anon: s.ANON_KEY || s.PUBLISHABLE_KEY, service: s.SERVICE_ROLE_KEY || s.SECRET_KEY };
    return cached;
  }
  const ref = process.env.E2E_PROJECT_REF || STAGING_REF;
  const data = runCli(['projects', 'api-keys', '--project-ref', ref, '-o', 'json']);
  const list = Array.isArray(data) ? data : data.keys;
  const pick = (id) => list.find((k) => k.id === id || k.name === id)?.api_key;
  cached = { url: `https://${ref}.supabase.co`, anon: pick('anon'), service: pick('service_role') };
  if (!cached.anon || !cached.service) throw new Error('Không lấy được anon/service_role key qua CLI.');
  return cached;
}
