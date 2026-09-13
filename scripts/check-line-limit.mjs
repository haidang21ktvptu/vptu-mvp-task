// Kiểm tra quy ước "không file nào trên 300 dòng" (CLAUDE.md, SPEC NF-7) trên các file
// đã theo dõi trong git. Chạy trong CI: node scripts/check-line-limit.mjs
//
// Ngoại lệ (không phải mã nguồn): tài liệu *.md, lockfile, supabase/config.toml (CLI sinh), mockup/.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const LIMIT = 300;
const EXCLUDED = [/\.md$/, /package-lock\.json$/, /^supabase\/config\.toml$/, /^mockup\//];

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !EXCLUDED.some((re) => re.test(f)));

// Không tính dấu xuống dòng cuối file là một dòng.
function countLines(content) {
  return content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
}

const offenders = files
  .map((file) => ({ file, lines: countLines(readFileSync(file, 'utf8')) }))
  .filter(({ lines }) => lines > LIMIT);

if (offenders.length > 0) {
  console.error(`Các file vượt ${LIMIT} dòng:`);
  offenders.forEach(({ file, lines }) => console.error(`  ${lines}\t${file}`));
  process.exit(1);
}
console.log(`Đạt: ${files.length} file, không file nào vượt ${LIMIT} dòng.`);
