// Chạy psql tới Supabase CỤC BỘ cho script đo hiệu năng / ảnh chụp phạm vi / sinh dữ liệu tổng hợp (PR-2a).
// Chỉ chấp nhận host 127.0.0.1 — gặp host khác thì dừng ngay, không bao giờ chạm staging hay production.
import { spawnSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const DB_URL = process.env.PERF_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

export function kiemHost(url = DB_URL) {
  let h;
  try { h = new URL(url); } catch { h = null; }
  if (!h || h.hostname !== '127.0.0.1') {
    console.error(`DỪNG: chỉ chạy trên Supabase cục bộ (host 127.0.0.1). Nhận được: ${h ? h.hostname : url}`);
    process.exit(2);
  }
}

// Chạy một đoạn SQL, trả stdout (-At: không tiêu đề, không căn cột). Lỗi SQL → ném lỗi kèm stderr.
export function psql(sql, { url = DB_URL } = {}) {
  kiemHost(url);
  // Ghi SQL ra tệp tạm (stdin lớn bị psql cắt khi gặp lỗi sớm → EOF khó đọc).
  const tep = join(tmpdir(), `vptu-psql-${process.pid}-${Date.now()}.sql`);
  writeFileSync(tep, sql);
  const r = spawnSync('psql', [url, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-f', tep], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  rmSync(tep, { force: true });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`psql lỗi (exit ${r.status}): ${r.stderr.slice(0, 2000)}`);
  return r.stdout;
}

// Tách stdout theo dấu mốc "@@<tên>" do SQL \echo ra; trả { tên: văn bản }.
export function tachMoc(out) {
  const kq = {}; let ten = null; let buf = [];
  for (const dong of out.split(/\r?\n/)) {
    const m = /^@@(\S+)$/.exec(dong);
    if (m) { if (ten) kq[ten] = buf.join('\n'); ten = m[1]; buf = []; } else if (ten) buf.push(dong);
  }
  if (ten) kq[ten] = buf.join('\n');
  return kq;
}

// Mở giao dịch chỉ đọc dưới vai thật (authenticated + JWT claims), giống PostgREST.
export const moVai = (uid, { thongKeHam = false } = {}) => [
  'BEGIN READ ONLY;',
  thongKeHam ? "SET LOCAL track_functions = 'all';" : '',
  "SET LOCAL statement_timeout = '120s';",
  'SET LOCAL ROLE authenticated;',
  `SET LOCAL request.jwt.claims = '{"sub":"${uid}","role":"authenticated"}';`,
].filter(Boolean).join('\n');

export const q = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
