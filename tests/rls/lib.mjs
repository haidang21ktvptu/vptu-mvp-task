// Tiện ích chung cho test RLS: client theo từng tài khoản seed (token thật), client
// service_role để dựng dữ liệu mẫu, và các hàm khẳng định "bị chặn".
//
// Key lấy theo thứ tự: biến môi trường SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
// (CI: GitHub Secrets của staging) → RLS_LOCAL=1 (Supabase cục bộ) → Supabase CLI đã `supabase login`
// (RLS_PROJECT_REF mặc định staging). Không có .env chứa service_role; luôn từ chối production.
// Chạy với --test-isolation=none để phiên đăng nhập dùng chung giữa các file
// (tránh vượt giới hạn 30 lượt đăng nhập/5 phút/IP của Supabase).

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

export const STAGING_REF = 'vojmrjezspdftovzinek';
export const PRODUCTION_REF = 'frwyxcmbonjaimziiuqr';
export const SEED_PASSWORD = '123456';
export const EMAIL_DOMAIN = 'vptu.caobang.local';

// id cố định trong supabase/seed.sql
export const IDS = {
  cvp: '00000000-0000-4000-8000-000000000001',
  pcvp: '00000000-0000-4000-8000-000000000002',
  truongphong: '00000000-0000-4000-8000-000000000003',
  cv1: '00000000-0000-4000-8000-000000000004',
  cv2: '00000000-0000-4000-8000-000000000005',
  pcvp2: '00000000-0000-4000-8000-000000000006',
  qtht: '00000000-0000-4000-8000-000000000008',
};

function runCli(args) {
  const r = spawnSync('supabase', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`supabase ${args.join(' ')} thất bại: ${r.stderr || r.stdout}`);
  const starts = [r.stdout.indexOf('{'), r.stdout.indexOf('[')].filter((i) => i >= 0);
  return JSON.parse(r.stdout.slice(Math.min(...starts)));
}

let keys = null;
export function getKeys() {
  if (keys) return keys;
  const env = process.env;
  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY) {
    keys = { url: env.SUPABASE_URL, anon: env.SUPABASE_ANON_KEY, service: env.SUPABASE_SERVICE_ROLE_KEY };
  } else if (env.RLS_LOCAL === '1') {
    const s = runCli(['status', '-o', 'json']);
    keys = { url: s.API_URL, anon: s.ANON_KEY || s.PUBLISHABLE_KEY, service: s.SERVICE_ROLE_KEY || s.SECRET_KEY };
  } else {
    const ref = env.RLS_PROJECT_REF || STAGING_REF;
    const data = runCli(['projects', 'api-keys', '--project-ref', ref, '-o', 'json']);
    const list = Array.isArray(data) ? data : data.keys;
    const pick = (id) => list.find((k) => k.id === id || k.name === id)?.api_key;
    keys = { url: `https://${ref}.supabase.co`, anon: pick('anon'), service: pick('service_role') };
  }
  if (!keys.anon || !keys.service) throw new Error('Không lấy được anon/service_role key.');
  // Test tạo/xoá dữ liệu bằng service_role nên tuyệt đối không được trỏ vào production.
  if (keys.url.includes(PRODUCTION_REF)) throw new Error('Từ chối chạy test trên project production.');
  return keys;
}

const opts = { auth: { autoRefreshToken: false, persistSession: false } };

export function anonClient() {
  const k = getKeys();
  return createClient(k.url, k.anon, opts);
}

export function adminClient() {
  const k = getKeys();
  return createClient(k.url, k.service, opts);
}

const users = new Map();
// Client đã đăng nhập bằng tài khoản seed (username: demo_cvp, demo_cv1, ...).
export async function userClient(username) {
  if (users.has(username)) return users.get(username);
  const k = getKeys();
  const c = createClient(k.url, k.anon, opts);
  const { error } = await c.auth.signInWithPassword({ email: `${username}@${EMAIL_DOMAIN}`, password: SEED_PASSWORD });
  if (error) throw new Error(`Đăng nhập ${username} thất bại: ${error.message}`);
  users.set(username, c);
  return c;
}

// Khẳng định: ghi bị RLS/quyền chặn (PostgREST trả 42501 hoặc lỗi quyền).
export function assertDenied(result, label) {
  assert.ok(result.error, `${label}: phải bị chặn nhưng không có lỗi`);
  assert.ok(
    ['42501', 'PGRST301', '42P01'].includes(result.error.code) || /permission|row-level|policy|not allowed/i.test(result.error.message),
    `${label}: lỗi không phải lỗi quyền: ${result.error.code} ${result.error.message}`,
  );
}

// Khẳng định: UPDATE bị RLS lọc hết (không lỗi, 0 dòng).
export function assertNoRows(result, label) {
  assert.equal(result.error, null, `${label}: lỗi bất ngờ ${result.error?.message}`);
  assert.equal((result.data || []).length, 0, `${label}: phải 0 dòng`);
}

export function assertOk(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message}`);
}

export function ids(rows) {
  return (rows || []).map((r) => r.id ?? r.task_id);
}
