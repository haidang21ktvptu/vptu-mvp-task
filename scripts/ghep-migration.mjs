// Ghép nháp supabase/nhap-0053/*.sql thành các migration PR-2b (mỗi file ≤ 300 dòng, tên gạch dưới, theo thứ tự phụ thuộc — cách của PR-2a,
// thiết kế §0.4 A). Bảng ánh xạ 0048–0052 của PR-2a đã bỏ: các file đó đã commit và áp lên staging/production (--xoa không được chạm tới).
// Trong lúc còn nháp (lượt 6–7), file sinh ra KHÔNG được commit: mỗi đường dẫn được ghi ngay vào .git/info/exclude.
// Lượt ghép cuối (lượt 8): chạy với --commit để bỏ các dòng exclude rồi commit một lần, xoá nháp.
// Dùng: node scripts/ghep-migration.mjs            (sinh / cập nhật 0053–0060)
//       node scripts/ghep-migration.mjs --xoa      (xoá các file đã sinh — quay DB cục bộ về 0052 bằng supabase db reset)
//       node scripts/ghep-migration.mjs --commit   (sinh + bỏ khỏi .git/info/exclude để commit)
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

// PR-2b đã ghép và commit 0053–0060 (nháp supabase/nhap-0053 đã xoá) ⇒ bảng để trống: --xoa không được chạm file đã commit / đã áp.
// PR sau: thêm cặp ['NN-ten.sql', 'NNNN_ten.sql'] và đổi NHAP khi bắt đầu nháp mới.
export const BAN_DO = [];
const NHAP = 'supabase/nhap-0053';
const MIG = 'supabase/migrations';
const goc = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
process.chdir(goc);
const EXCLUDE = execSync('git rev-parse --git-path info/exclude', { encoding: 'utf8' }).trim();

const docExclude = () => (existsSync(EXCLUDE) ? readFileSync(EXCLUDE, 'utf8') : '');
function ghiExclude(duongDan, them) {
  const dong = docExclude().split(/\r?\n/).filter((d) => d !== '' && d !== duongDan);
  writeFileSync(EXCLUDE, [...dong, ...(them ? [duongDan] : [])].join('\n') + '\n');
}

const che = process.argv.includes('--xoa') ? 'xoa' : process.argv.includes('--commit') ? 'commit' : 'sinh';
let loi = 0;
for (const [nhap, mig] of BAN_DO) {
  const dich = `${MIG}/${mig}`;
  if (che === 'xoa') { rmSync(dich, { force: true }); ghiExclude(dich, false); console.log(`xoá ${dich}`); continue; }
  const noiDung = readFileSync(`${NHAP}/${nhap}`, 'utf8');
  const soDong = noiDung.split('\n').length - (noiDung.endsWith('\n') ? 1 : 0);
  if (soDong > 300) { console.error(`LỖI ${nhap}: ${soDong} dòng > 300`); loi++; continue; }
  ghiExclude(dich, che === 'sinh');   // ghi exclude TRƯỚC khi tạo file ⇒ không lúc nào lọt vào git add -A
  writeFileSync(dich, noiDung);
  console.log(`${nhap} → ${dich} (${soDong} dòng)${che === 'sinh' ? ' [exclude]' : ' [sẵn sàng commit]'}`);
}
process.exitCode = loi ? 1 : 0;
