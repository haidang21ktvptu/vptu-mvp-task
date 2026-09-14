// Tạo tài khoản HỆ THỐNG `smoke_test` (accounts.is_system = true, A3, phòng CDS_CY) trên một project
// hosted — dùng cho smoke test sau phát hành production (deploy-prod.yml, secret SMOKE_*). GĐ6.
//
//   node create-system-account.mjs --project-ref <ref>                 # sinh mật khẩu ngẫu nhiên, in ra MỘT lần
//   node create-system-account.mjs --project-ref <ref> --password <pw> # dùng mật khẩu cho sẵn (≥ 8 ký tự, có chữ và số)
//   node create-system-account.mjs --project-ref <ref> --rollback      # xoá accounts rồi auth.users
//
// - Cần migration 0012 (cột is_system) đã áp. Thứ tự tạo: auth user trước (Admin API, email
//   smoke_test@vptu.caobang.local, must_change_password = false) rồi INSERT accounts cùng id (FK 0011).
// - Chạy lại an toàn: đã có auth user thì chỉ ĐẶT LẠI mật khẩu; đã có dòng accounts thì bỏ qua.
// - service_role key lấy qua Supabase CLI đã `supabase login` (hoặc SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
//   Mật khẩu chỉ in ra console đúng một lần, không ghi vào file nào.

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ACCOUNT = {
  username: 'smoke_test',
  full_name: 'Tài khoản kiểm thử hệ thống',
  role_group: 'A3',
  position_title: 'Kiểm thử hệ thống',
  department: 'CDS_CY',
};
const EMAIL = `${ACCOUNT.username}@vptu.caobang.local`;

function parseArgs(argv) {
  const args = { projectRef: null, password: null, rollback: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project-ref') args.projectRef = argv[++i];
    else if (a === '--password') args.password = argv[++i];
    else if (a === '--rollback') args.rollback = true;
    else throw new Error(`Tham số không hợp lệ: ${a}`);
  }
  if (!args.projectRef && !process.env.SUPABASE_URL) throw new Error('Cần --project-ref <ref> hoặc SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.');
  return args;
}

function runCli(cliArgs) {
  const r = spawnSync('supabase', cliArgs, { encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`Lệnh "supabase ${cliArgs.join(' ')}" thất bại:\n${r.stderr || r.stdout}`);
  const starts = [r.stdout.indexOf('{'), r.stdout.indexOf('[')].filter((i) => i >= 0);
  return JSON.parse(r.stdout.slice(Math.min(...starts)));
}

function resolveCredentials(args) {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  }
  const data = runCli(['projects', 'api-keys', '--project-ref', args.projectRef, '-o', 'json']);
  const keys = Array.isArray(data) ? data : data.keys;
  const svc = keys.find((k) => k.id === 'service_role' || k.name === 'service_role');
  if (!svc) throw new Error('Không tìm thấy service_role key qua CLI (đã `supabase login` chưa?).');
  return { url: `https://${args.projectRef}.supabase.co`, key: svc.api_key };
}

// 24 ký tự chữ + số (đủ chính sách ≥ 8 ký tự có chữ và số trong config.toml), không ký tự đặc biệt để dán vào secret không lỗi.
function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(24);
  let pw = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) pw = `${pw.slice(0, 22)}a1`;
  return pw;
}

async function findAuthUser(db) {
  // Admin API không lọc theo email; danh sách 48 tài khoản thì 1 trang là đủ.
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  return data.users.find((u) => u.email === EMAIL) || null;
}

async function create(db, password) {
  let user = await findAuthUser(db);
  if (user) {
    const { error } = await db.auth.admin.updateUserById(user.id, { password });
    if (error) throw new Error(`updateUserById: ${error.message}`);
    console.log(`Auth user ${EMAIL} đã có (${user.id}) — đã đặt lại mật khẩu.`);
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: EMAIL, password, email_confirm: true, user_metadata: { username: ACCOUNT.username },
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    user = data.user;
    console.log(`Đã tạo auth user ${EMAIL} (${user.id}).`);
  }

  const { data: existing, error: e1 } = await db.from('accounts').select('id, is_system').eq('id', user.id).maybeSingle();
  if (e1) throw new Error(`Đọc accounts: ${e1.message}`);
  if (existing) {
    console.log(`Dòng accounts đã có (is_system=${existing.is_system}) — bỏ qua.`);
  } else {
    const { error: e2 } = await db.from('accounts').insert({
      id: user.id, ...ACCOUNT, manager_id: null, is_chief: false, must_change_password: false, is_system: true,
    });
    if (e2) throw new Error(`INSERT accounts: ${e2.message} (đã áp migration 0012 chưa?)`);
    console.log(`Đã tạo accounts.${ACCOUNT.username} (is_system = true, ${ACCOUNT.role_group}, ${ACCOUNT.department}).`);
  }
}

async function rollback(db) {
  const user = await findAuthUser(db);
  if (!user) { console.log(`Không có auth user ${EMAIL}.`); return; }
  const { error: e1 } = await db.from('accounts').delete().eq('id', user.id);
  if (e1) throw new Error(`DELETE accounts: ${e1.message}`);
  const { error: e2 } = await db.auth.admin.deleteUser(user.id);
  if (e2) throw new Error(`deleteUser: ${e2.message}`);
  console.log(`Đã xoá accounts + auth user ${ACCOUNT.username}.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cred = resolveCredentials(args);
  const db = createClient(cred.url, cred.key, { auth: { persistSession: false, autoRefreshToken: false } });
  console.log(`Project: ${cred.url}`);
  if (args.rollback) { await rollback(db); return; }
  const password = args.password || generatePassword();
  await create(db, password);
  if (!args.password) {
    console.log('\nMật khẩu (chỉ hiện một lần, dán vào secret SMOKE_PASSWORD rồi xoá khỏi màn hình):');
    console.log(password);
  }
}

main().catch((e) => { console.error(`Lỗi: ${e.message}`); process.exit(1); });
