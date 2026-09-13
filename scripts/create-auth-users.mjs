// Chuyển mọi dòng public.accounts sang Supabase Auth (GĐ2, SPEC AUTH-1…4), GIỮ NGUYÊN mật khẩu.
//
//   node create-auth-users.mjs --project-ref <ref> [--dry-run]
//   node create-auth-users.mjs --local --default-password 123456   # tài khoản giả (không còn cột password)
//   node create-auth-users.mjs --project-ref <ref> --rollback   # xoá auth.users vừa tạo
//
// - auth.users.id được tạo TRÙNG accounts.id (Admin API nhận `id`), email quy ước
//   <username>@vptu.caobang.local.
// - Mật khẩu hiện có trong accounts.password được băm bcrypt tại máy chạy script và
//   gửi lên dưới dạng `password_hash` (không gửi plaintext qua API, không bị chặn bởi
//   chính sách độ dài mật khẩu mới). Người dùng đăng nhập như cũ.
// - must_change_password = false cho tất cả; quản trị bật sau bằng
//   public.admin_set_must_change_password() (migration 0005).
// - Chạy lại an toàn: tài khoản đã có auth.users thì bỏ qua.
// - service_role key lấy qua Supabase CLI đã `supabase login` (hoặc biến môi trường
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). Không ghi key hay mật khẩu ra log.

import { spawnSync } from 'node:child_process';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const EMAIL_DOMAIN = 'vptu.caobang.local';
const BCRYPT_COST = 10; // bằng bcrypt.DefaultCost của GoTrue

function parseArgs(argv) {
  const args = { dryRun: false, rollback: false, local: false, projectRef: null, defaultPassword: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--rollback') args.rollback = true;
    else if (a === '--local') args.local = true;
    else if (a === '--project-ref') args.projectRef = argv[++i];
    else if (a === '--default-password') args.defaultPassword = argv[++i];
    else throw new Error(`Tham số không hợp lệ: ${a}`);
  }
  if (!args.local && !args.projectRef && !process.env.SUPABASE_URL) {
    throw new Error('Cần --project-ref <ref>, --local, hoặc biến môi trường SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.');
  }
  return args;
}

function runCli(cliArgs) {
  const r = spawnSync('supabase', cliArgs, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`Lệnh "supabase ${cliArgs.join(' ')}" thất bại:\n${r.stderr || r.stdout}`);
  // Output có thể là object hoặc mảng JSON, đôi khi kèm dòng chữ phía trước.
  const starts = [r.stdout.indexOf('{'), r.stdout.indexOf('[')].filter((i) => i >= 0);
  return JSON.parse(r.stdout.slice(Math.min(...starts)));
}

function resolveCredentials(args) {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, env: 'env' };
  }
  if (args.local) {
    const s = runCli(['status', '-o', 'json']);
    return { url: s.API_URL, key: s.SERVICE_ROLE_KEY || s.SECRET_KEY, env: 'local' };
  }
  const data = runCli(['projects', 'api-keys', '--project-ref', args.projectRef, '-o', 'json']);
  const keys = Array.isArray(data) ? data : data.keys;
  const svc = keys.find((k) => k.id === 'service_role' || k.name === 'service_role');
  if (!svc) throw new Error('Không tìm thấy service_role key qua CLI (đã `supabase login` chưa?).');
  return { url: `https://${args.projectRef}.supabase.co`, key: svc.api_key, env: args.projectRef };
}

// Sau migration 0006 không còn cột password: dùng --default-password (chỉ cho tài khoản giả).
async function fetchAccounts(db, defaultPassword, needPassword) {
  const { data, error } = await db
    .from('accounts')
    .select(needPassword ? 'id, username, full_name, password' : 'id, username, full_name')
    .order('username');
  if (error) throw new Error(`Không đọc được accounts: ${error.message}`);
  return defaultPassword ? data.map((a) => ({ ...a, password: defaultPassword })) : data;
}

async function authUserExists(db, id) {
  const { data, error } = await db.auth.admin.getUserById(id);
  if (error && error.status !== 404) throw new Error(`getUserById(${id}): ${error.message}`);
  return Boolean(data?.user);
}

async function migrateUsers(db, accounts, dryRun) {
  let created = 0;
  let skipped = 0;
  const missingPassword = [];
  for (const acc of accounts) {
    if (await authUserExists(db, acc.id)) { skipped++; continue; }
    if (!acc.password) { missingPassword.push(acc.username); continue; }
    if (!dryRun) {
      const { error } = await db.auth.admin.createUser({
        id: acc.id,
        email: `${acc.username}@${EMAIL_DOMAIN}`,
        password_hash: bcrypt.hashSync(acc.password, BCRYPT_COST),
        email_confirm: true,
        user_metadata: { username: acc.username, full_name: acc.full_name },
      });
      if (error) throw new Error(`Tạo auth user cho ${acc.username} thất bại: ${error.message}`);
      const { error: e2 } = await db.from('accounts').update({ must_change_password: false }).eq('id', acc.id);
      if (e2) throw new Error(`Đặt cờ must_change_password cho ${acc.username} thất bại: ${e2.message}`);
    }
    created++;
  }
  return { created, skipped, missingPassword };
}

async function rollbackUsers(db, accounts, dryRun) {
  let deleted = 0;
  for (const acc of accounts) {
    if (!(await authUserExists(db, acc.id))) continue;
    if (!dryRun) {
      const { error } = await db.auth.admin.deleteUser(acc.id);
      if (error) throw new Error(`Xoá auth user ${acc.username} thất bại: ${error.message}`);
    }
    deleted++;
  }
  return deleted;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cred = resolveCredentials(args);
  const db = createClient(cred.url, cred.key, { auth: { autoRefreshToken: false, persistSession: false } });
  const accounts = await fetchAccounts(db, args.defaultPassword, !args.rollback && !args.defaultPassword);
  console.log(`Môi trường: ${cred.env} — ${accounts.length} tài khoản trong accounts${args.dryRun ? ' (dry-run, không ghi gì)' : ''}.`);

  if (args.rollback) {
    const n = await rollbackUsers(db, accounts, args.dryRun);
    console.log(`Đã xoá ${n} auth user (accounts giữ nguyên).`);
    return;
  }

  const { created, skipped, missingPassword } = await migrateUsers(db, accounts, args.dryRun);
  console.log(`Tạo mới: ${created}; bỏ qua (đã có auth user): ${skipped}.`);
  if (missingPassword.length > 0) {
    console.log(`Không có mật khẩu, chưa tạo: ${missingPassword.join(', ')}`);
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(`Lỗi: ${err.message}`);
  process.exit(1);
});
