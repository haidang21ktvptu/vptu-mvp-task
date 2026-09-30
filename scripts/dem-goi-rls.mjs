// PR-2a (D3) — Đếm số lời gọi HTTP của từng file tests/rls trên Supabase CỤC BỘ (RLS_LOCAL=1), để ước tính thời gian trên staging
// (staging chậm vì độ trễ mạng của từng lời gọi). Mỗi file chạy một tiến trình riêng ⇒ lời gọi đăng nhập (auth/token) được đếm riêng
// theo file; khi chạy cả bộ (--test-isolation=none) phiên dùng chung nên số đăng nhập thực tế nhỏ hơn — dòng "cả bộ" cuối bảng là số thật.
//   node scripts/dem-goi-rls.mjs [--ra <file.json>] [--chi <mẫu tên file>]
// In bảng Markdown: file · tổng · đăng nhập · khác · lượt khứ hồi tuần tự · 3 đích nhiều nhất · thời gian cục bộ.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const argv = process.argv.slice(2);
const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const DIR = resolve('tests/rls');
const OUT = join(tmpdir(), `dem-goi-${process.pid}.jsonl`);
const env = { ...process.env, RLS_LOCAL: '1', DEM_GOI: OUT };
const files = readdirSync(DIR).filter((f) => f.endsWith('.test.mjs') && (!arg('--chi') || f.includes(arg('--chi')))).sort();

function chay(nhan, args) {
  const t = Date.now();
  const r = spawnSync(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=dot', ...args], { cwd: DIR, env: { ...env, DEM_NHAN: nhan }, encoding: 'utf8' });
  return { ms: Date.now() - t, ok: r.status === 0 };
}
rmSync(OUT, { force: true });
const tg = {};
for (const f of files) { tg[f] = chay(f, [f]); process.stderr.write(`${tg[f].ok ? '.' : 'x'}`); }
if (!arg('--chi')) tg['ca-bo'] = chay('ca-bo', ['--test-isolation=none', ...files]);
process.stderr.write('\n');
const dong = readFileSync(OUT, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
rmSync(OUT, { force: true });
const kq = dong.map((d) => {
  const dn = Object.entries(d.loai).filter(([k]) => k.startsWith('auth/')).reduce((a, [, v]) => a + v, 0);
  return { ...d, dang_nhap: dn, khac: d.tong - dn, ms: tg[d.nhan]?.ms, ok: tg[d.nhan]?.ok };
}).sort((a, b) => (a.nhan === 'ca-bo') - (b.nhan === 'ca-bo') || b.khac - a.khac);
if (arg('--ra')) writeFileSync(arg('--ra'), JSON.stringify(kq, null, 1));
console.log('| File | Tổng | Đăng nhập | Khác | Lượt | Đích nhiều nhất | Cục bộ (s) |\n|---|---:|---:|---:|---:|---|---:|');
for (const d of kq) {
  const top = Object.entries(d.loai).filter(([k]) => !k.startsWith('auth/')).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ');
  console.log(`| ${d.nhan}${d.ok ? '' : ' ✗'} | ${d.tong} | ${d.dang_nhap} | ${d.khac} | ${d.luot} | ${top} | ${((d.ms || 0) / 1000).toFixed(1)} |`);
}
const tong = kq.filter((d) => d.nhan !== 'ca-bo').reduce((a, d) => a + d.khac, 0);
const luot = kq.filter((d) => d.nhan !== 'ca-bo').reduce((a, d) => a + d.luot, 0);
console.log(`\nCộng theo file: khác ${tong}, lượt ${luot}`);
