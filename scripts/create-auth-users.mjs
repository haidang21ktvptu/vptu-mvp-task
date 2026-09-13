// Tạo tài khoản Supabase Auth cho mọi dòng trong public.accounts (GĐ2, SPEC AUTH-1…4).
//
//   node create-auth-users.mjs --project-ref <ref> [--dry-run] [--out <file.xlsx>]
//   node create-auth-users.mjs --local
//   node create-auth-users.mjs --project-ref <ref> --rollback   # xoá auth.users vừa tạo
//
// - auth.users.id được tạo TRÙNG accounts.id (Admin API nhận `id`), email quy ước
//   <username>@vptu.caobang.local, mật khẩu tạm ngẫu nhiên, must_change_password = true.
// - Chạy lại an toàn: tài khoản đã có auth.users thì bỏ qua.
// - service_role key lấy qua Supabase CLI đã `supabase login` (hoặc biến môi trường
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). Không bao giờ ghi key ra file/log.
// - Mật khẩu tạm chỉ ghi vào file Excel ở scripts/out/ (đã gitignore), không in ra console.

import { spawnSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

const EMAIL_DOMAIN = 'vptu.caobang.local';
// Bỏ các ký tự dễ nhầm khi đọc trên giấy: 0/O, 1/l/I.
const PW_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const PW_DIGITS = '23456789';
const PW_LENGTH = 12;

function parseArgs(argv) {
  const args = { dryRun: false, rollback: false, local: false, projectRef: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--rollback') args.rollback = true;
    else if (a === '--local') args.local = true;
    else if (a === '--project-ref') args.projectRef = argv[++i];
    else if (a === '--out') args.out = argv[++i];
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

function generateTempPassword() {
  const all = PW_LETTERS + PW_DIGITS;
  for (;;) {
    let pw = '';
    for (let i = 0; i < PW_LENGTH; i++) pw += all[randomInt(all.length)];
    if (/[A-Za-z]/.test(pw) && /[0-9]/.test(pw)) return pw;
  }
}

async function fetchAccounts(db) {
  const { data, error } = await db
    .from('accounts')
    .select('id, username, full_name, position_title, department, role_group')
    .order('role_group')
    .order('full_name');
  if (error) throw new Error(`Không đọc được accounts: ${error.message}`);
  return data;
}

async function authUserExists(db, id) {
  const { data, error } = await db.auth.admin.getUserById(id);
  if (error && error.status !== 404) throw new Error(`getUserById(${id}): ${error.message}`);
  return Boolean(data?.user);
}

async function createUsers(db, accounts, dryRun) {
  const created = [];
  let skipped = 0;
  for (const acc of accounts) {
    if (await authUserExists(db, acc.id)) { skipped++; continue; }
    const password = generateTempPassword();
    if (!dryRun) {
      const { error } = await db.auth.admin.createUser({
        id: acc.id,
        email: `${acc.username}@${EMAIL_DOMAIN}`,
        password,
        email_confirm: true,
        user_metadata: { username: acc.username, full_name: acc.full_name },
      });
      if (error) throw new Error(`Tạo auth user cho ${acc.username} thất bại: ${error.message}`);
      const { error: e2 } = await db.from('accounts').update({ must_change_password: true }).eq('id', acc.id);
      if (e2) throw new Error(`Đặt cờ must_change_password cho ${acc.username} thất bại: ${e2.message}`);
    }
    created.push({ ...acc, password });
  }
  return { created, skipped };
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

async function writeExcel(rows, outPath) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Mật khẩu tạm');
  ws.columns = [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Họ và tên', key: 'full_name', width: 28 },
    { header: 'Chức danh', key: 'position_title', width: 34 },
    { header: 'Phòng', key: 'department', width: 20 },
    { header: 'Tên đăng nhập', key: 'username', width: 22 },
    { header: 'Mật khẩu tạm', key: 'password', width: 18 },
    { header: 'Ghi chú', key: 'note', width: 44 },
  ];
  ws.getRow(1).font = { bold: true };
  rows.forEach((r, i) => ws.addRow({
    stt: i + 1,
    full_name: r.full_name,
    position_title: r.position_title,
    department: r.department,
    username: r.username,
    password: r.password,
    note: 'Bắt buộc đổi mật khẩu ngay lần đăng nhập đầu tiên.',
  }));
  mkdirSync(dirname(outPath), { recursive: true });
  await wb.xlsx.writeFile(outPath);
}

function defaultOutPath(env) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  return resolve(import.meta.dirname, 'out', `mat-khau-tam-${env}-${stamp}.xlsx`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cred = resolveCredentials(args);
  const db = createClient(cred.url, cred.key, { auth: { autoRefreshToken: false, persistSession: false } });
  const accounts = await fetchAccounts(db);
  console.log(`Môi trường: ${cred.env} — ${accounts.length} tài khoản trong accounts${args.dryRun ? ' (dry-run, không ghi gì)' : ''}.`);

  if (args.rollback) {
    const n = await rollbackUsers(db, accounts, args.dryRun);
    console.log(`Đã xoá ${n} auth user (accounts giữ nguyên).`);
    return;
  }

  const { created, skipped } = await createUsers(db, accounts, args.dryRun);
  console.log(`Tạo mới: ${created.length}; bỏ qua (đã có auth user): ${skipped}.`);
  if (created.length > 0 && !args.dryRun) {
    const outPath = args.out ? resolve(args.out) : defaultOutPath(cred.env);
    await writeExcel(created, outPath);
    console.log(`Mật khẩu tạm đã ghi vào: ${outPath} (KHÔNG commit file này).`);
  }
}

main().catch((err) => {
  console.error(`Lỗi: ${err.message}`);
  process.exit(1);
});
