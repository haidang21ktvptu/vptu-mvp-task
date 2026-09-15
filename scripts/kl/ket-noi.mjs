// Kết nối dùng chung cho script module KL BTVTU (GĐ8 PR 8B): tham số dòng lệnh, service_role key và
// chạy SQL qua Supabase CLI đúng đích (local / staging / production). Không có .env chứa key;
// key lấy từ biến môi trường hoặc CLI đã `supabase login`, không bao giờ in ra log.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

export const STAGING_REF = 'vojmrjezspdftovzinek';
export const PRODUCTION_REF = 'frwyxcmbonjaimziiuqr';

// Tham số chung cho nhap-kl-btvtu.mjs và an-danh-kl-btvtu.mjs. Cờ có giá trị: --file, --out, --project-ref,
// --anh-xa-nguoi-sua; cờ bật/tắt: --ghi, --dry-run, --local, --production, --xoa-cu.
export function parseArgs(argv, allowed) {
  const args = { file: null, out: null, projectRef: null, anhXaNguoiSua: null, ghi: false, local: false, production: false, xoaCu: false };
  const coGiaTri = { '--file': 'file', '--out': 'out', '--project-ref': 'projectRef', '--anh-xa-nguoi-sua': 'anhXaNguoiSua' };
  const co = { '--ghi': 'ghi', '--local': 'local', '--production': 'production', '--xoa-cu': 'xoaCu' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!allowed.includes(a)) throw new Error(`Tham số không hợp lệ: ${a}`);
    if (a === '--dry-run') continue;
    if (coGiaTri[a]) { args[coGiaTri[a]] = argv[++i]; if (!args[coGiaTri[a]]) throw new Error(`Thiếu giá trị sau ${a}`); }
    else args[co[a]] = true;
  }
  return args;
}

// Không dùng shell (tham số không bị ghép chuỗi); trên Windows nếu chỉ có shim .cmd của npm thì thử lại qua shell.
export function runCli(cliArgs) {
  let r = spawnSync('supabase', cliArgs, { encoding: 'utf8' });
  if (r.error?.code === 'ENOENT' && process.platform === 'win32') {
    // Qua shell thì phải tự bọc dấu nháy cho tham số có khoảng trắng (đường dẫn file tạm).
    r = spawnSync('supabase.cmd', cliArgs.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)), { encoding: 'utf8', shell: true });
  }
  if (r.error) throw new Error(`Không chạy được Supabase CLI: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`Lệnh "supabase ${cliArgs.join(' ')}" thất bại:\n${r.stderr || r.stdout}`);
  return r.stdout;
}

function runCliJson(cliArgs) {
  const out = runCli(cliArgs);
  const starts = [out.indexOf('{'), out.indexOf('[')].filter((i) => i >= 0);
  return JSON.parse(out.slice(Math.min(...starts)));
}

// Đích ghi: { ten, url, key, cliArgs } — cliArgs để `supabase db query` chạy đúng project.
export function resolveTarget(args) {
  if (args.local && args.projectRef) throw new Error('Chọn một trong --local hoặc --project-ref.');
  if (args.local) {
    const s = runCliJson(['status', '-o', 'json']);
    return { ten: 'local', url: s.API_URL, key: s.SERVICE_ROLE_KEY || s.SECRET_KEY, cliArgs: ['--local'], production: false };
  }
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const isProd = process.env.SUPABASE_URL.includes(PRODUCTION_REF);
    const ref = args.projectRef || (isProd ? PRODUCTION_REF : STAGING_REF);
    return { ten: 'env', url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, cliArgs: ['--linked', '--project-ref', ref], production: isProd };
  }
  if (!args.projectRef) throw new Error('Cần --local, --project-ref <ref>, hoặc SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.');
  const data = runCliJson(['projects', 'api-keys', '--project-ref', args.projectRef, '-o', 'json']);
  const keys = Array.isArray(data) ? data : data.keys;
  const svc = keys.find((k) => k.id === 'service_role' || k.name === 'service_role');
  if (!svc) throw new Error('Không tìm thấy service_role key qua CLI (đã `supabase login` chưa?).');
  const production = args.projectRef === PRODUCTION_REF;
  return { ten: production ? 'production' : args.projectRef === STAGING_REF ? 'staging' : args.projectRef,
    url: `https://${args.projectRef}.supabase.co`, key: svc.api_key, cliArgs: ['--linked', '--project-ref', args.projectRef], production };
}

export function createDb(target) {
  return createClient(target.url, target.key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// SQL không đi qua PostgREST (setval sequence): chạy bằng CLI với cùng đích, qua file tạm để không phải thoát dấu nháy.
export function dbQuery(target, sql) {
  const dir = mkdtempSync(join(tmpdir(), 'vptu-kl-'));
  const file = join(dir, 'truy-van.sql');
  try {
    writeFileSync(file, sql, 'utf8');
    return runCli(['db', 'query', ...target.cliArgs, '--file', file]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
