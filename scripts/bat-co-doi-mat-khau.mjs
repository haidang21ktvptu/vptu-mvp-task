// Bật cờ "phải đổi mật khẩu lần đầu" (accounts.must_change_password) cho MỌI tài khoản thật trước go-live — KHÔNG chạm tài khoản demo
// (demo_*, demo_e2e_*), smoke_test hay tài khoản hệ thống (is_system). Người dùng đăng nhập sẽ bị chặn ở trang "Đặt mật khẩu mới" (AUTH-2).
//
//   node scripts/bat-co-doi-mat-khau.mjs --project-ref <ref>            # chỉ IN danh sách sẽ bật (mặc định, không ghi)
//   node scripts/bat-co-doi-mat-khau.mjs --project-ref <ref> --thuc-hien # ghi thật, rồi đếm lại số dòng đã đổi
//   Key: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (env) hoặc Supabase CLI đã `supabase login` với --project-ref. Không in key/mật khẩu.
//   Ghi qua RPC admin_set_must_change_password(p_usernames, true) (0005, chỉ service_role) — không UPDATE thẳng bảng.
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

function parseArgs(argv) {
  const a = { ref: null, thucHien: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project-ref') a.ref = argv[++i];
    else if (argv[i] === '--thuc-hien') a.thucHien = true;
    else throw new Error(`Tham số lạ: ${argv[i]}`);
  }
  return a;
}

function runCli(args) {
  const r = spawnSync('supabase', args, { encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`supabase ${args.join(' ')} thất bại: ${r.stderr || r.stdout}`);
  const starts = [r.stdout.indexOf('{'), r.stdout.indexOf('[')].filter((i) => i >= 0);
  return JSON.parse(r.stdout.slice(Math.min(...starts)));
}

function keys(ref) {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  if (!ref) throw new Error('Cần --project-ref <ref> hoặc SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.');
  const data = runCli(['projects', 'api-keys', '--project-ref', ref, '-o', 'json']);
  const list = Array.isArray(data) ? data : data.keys;
  const key = list.find((k) => k.id === 'service_role' || k.name === 'service_role')?.api_key;
  if (!key) throw new Error('Không lấy được service_role key.');
  return { url: `https://${ref}.supabase.co`, key };
}

async function main() {
  const { ref, thucHien } = parseArgs(process.argv.slice(2));
  const k = keys(ref);
  const db = createClient(k.url, k.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from('accounts').select('username, full_name, role_group, department, is_system, must_change_password').order('username');
  if (error) throw new Error(`Không đọc được accounts: ${error.message}`);
  const that = data.filter((a) => !a.is_system && !/^demo_/.test(a.username) && a.username !== 'smoke_test');
  const chuaBat = that.filter((a) => !a.must_change_password);
  const boQua = data.length - that.length;
  console.log(`Project: ${k.url}`);
  console.log(`Tổng ${data.length} tài khoản; bỏ qua ${boQua} (demo_*, smoke_test, is_system); tài khoản thật: ${that.length}, trong đó chưa bật cờ: ${chuaBat.length}.`);
  console.log('Sẽ bật cờ cho (username · vai · phòng):');
  chuaBat.forEach((a) => console.log(`  ${a.username} · ${a.role_group} · ${a.department || '—'}`));
  if (!thucHien) { console.log('\nChế độ xem trước — chưa ghi gì. Kiểm tra danh sách rồi chạy lại với --thuc-hien.'); return; }
  if (chuaBat.length === 0) { console.log('Không có gì để bật.'); return; }
  const { data: n, error: e2 } = await db.rpc('admin_set_must_change_password', { p_usernames: chuaBat.map((a) => a.username), p_value: true });
  if (e2) throw new Error(`Bật cờ thất bại: ${e2.message}`);
  const { count } = await db.from('accounts').select('username', { count: 'exact', head: true }).eq('must_change_password', true).not('username', 'like', 'demo\\_%').eq('is_system', false);
  console.log(`Đã bật cờ cho ${n} tài khoản; kiểm tra lại: ${count} tài khoản thật đang có cờ (kỳ vọng ${that.length}).`);
  if (count !== that.length) process.exitCode = 2;
}

main().catch((e) => { console.error(e.message); process.exit(1); });
