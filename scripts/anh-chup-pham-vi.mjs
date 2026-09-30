// Ảnh chụp PHẠM VI ĐỌC theo vai: với MỌI tài khoản, tập dòng thấy được ở 10 bảng/view (dưới vai thật: authenticated +
// request.jwt.claims, giao dịch chỉ đọc). Dùng so trước/sau migration tối ưu (PR-2a, thiết kế B7): diff phải rỗng.
// Khoá dòng là khoá nghiệp vụ ổn định qua các lần nạp lại (mã việc thay uuid — bộ vàng sinh uuid ngẫu nhiên), giữ trùng lặp.
// CHỈ Supabase cục bộ (127.0.0.1).
// Dùng: node scripts/anh-chup-pham-vi.mjs --ra "D:\TU 2026\kiem-thu\pr-2\anh-chup-0047"
//       node scripts/anh-chup-pham-vi.mjs --so "<thư mục A>" "<thư mục B>"   (so hai ảnh chụp, in khác biệt)
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { psql, tachMoc, moVai } from './lib-cuc-bo.mjs';

// bảng → biểu thức khoá (nv = nhiem_vu_id, đổi sang mã việc ở JS)
export const BANG = {
  nhiem_vu: "ma",
  v_nhiem_vu: "ma",
  v_ngoai_le: "ma",
  van_ban_giao_viec: "loai || '|' || coalesce(so_hoi_nghi::text, '') || '|' || so_ket_luan",
  lich_su: "'@' || nhiem_vu_id || '|' || cot || '|' || nguon",
  minh_chung: "'@' || nhiem_vu_id || '|' || loai || '|' || coalesce(so_hieu, '') || '|' || coalesce(hop_le::text, 'null')",
  chi_dao: "'@' || nhiem_vu_id || '|' || loai || '|' || trang_thai || '|' || md5(noi_dung)",
  canh_bao: "'@' || nhiem_vu_id || '|' || muc || '|' || ngay",
  dinh_chinh: "'@' || nhiem_vu_id || '|' || cot || '|' || trang_thai",
  tu_choi: "'@' || nhiem_vu_id || '|' || trang_thai",
};

const md5 = (s) => createHash('md5').update(s).digest('hex');

function chup(thuMuc) {
  const taiKhoan = psql('SELECT id, username FROM public.accounts ORDER BY username;').trim().split(/\r?\n/).map((d) => d.split('|'));
  const maViec = new Map(psql('SELECT id, ma FROM public.nhiem_vu;').trim().split(/\r?\n/).map((d) => d.split('|')));
  const doiMa = (k) => (k.startsWith('@') ? (maViec.get(k.slice(1, 37)) ?? k.slice(1, 37)) + k.slice(37) : k);
  const kq = Object.fromEntries(Object.keys(BANG).map((b) => [b, {}]));
  const t0 = Date.now();
  for (const [id, username] of taiKhoan) {
    const sql = [moVai(id), ...Object.entries(BANG).map(([b, k]) => `\\echo @@${b}\nSELECT ${k} FROM public.${b};`), 'ROLLBACK;'].join('\n');
    const moc = tachMoc(psql(sql));
    for (const b of Object.keys(BANG)) {
      const dong = (moc[b] || '').split(/\r?\n/).filter(Boolean).map(doiMa).sort();
      kq[b][username] = { n: dong.length, md5: md5(dong.join('\n')), dong };
    }
  }
  mkdirSync(thuMuc, { recursive: true });
  for (const b of Object.keys(BANG)) writeFileSync(join(thuMuc, `${b}.json`), JSON.stringify({ bang: b, khoa: BANG[b], theo_vai: kq[b] }));
  const tong = Object.fromEntries(Object.keys(BANG).map((b) => [b, Object.values(kq[b]).reduce((s, x) => s + x.n, 0)]));
  writeFileSync(join(thuMuc, '_tom-tat.json'), JSON.stringify({ so_tai_khoan: taiKhoan.length, tong_dong: tong, giay: (Date.now() - t0) / 1000 }, null, 2));
  console.log(`Đã chụp ${taiKhoan.length} tài khoản × ${Object.keys(BANG).length} bảng → ${thuMuc} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

function so(a, b) {
  let khac = 0;
  for (const tep of readdirSync(a).filter((f) => f.endsWith('.json') && !f.startsWith('_'))) {
    const x = JSON.parse(readFileSync(join(a, tep), 'utf8')).theo_vai; const y = JSON.parse(readFileSync(join(b, tep), 'utf8')).theo_vai;
    for (const u of new Set([...Object.keys(x), ...Object.keys(y)])) {
      if (x[u]?.md5 === y[u]?.md5) continue;
      khac++;
      const sx = new Set(x[u]?.dong || []); const sy = new Set(y[u]?.dong || []);
      const chiA = [...sx].filter((k) => !sy.has(k)); const chiB = [...sy].filter((k) => !sx.has(k));
      console.log(`${tep} ${u}: A=${x[u]?.n ?? '-'} B=${y[u]?.n ?? '-'} chỉ A: ${chiA.slice(0, 5).join(', ')} chỉ B: ${chiB.slice(0, 5).join(', ')}`);
    }
  }
  console.log(khac ? `KHÁC: ${khac} cặp (bảng, tài khoản).` : 'TRÙNG KHỚP: mọi bảng × mọi tài khoản.');
  process.exitCode = khac ? 1 : 0;
}

const i = process.argv.indexOf('--so');
if (i > 0) so(process.argv[i + 1], process.argv[i + 2]);
else {
  const j = process.argv.indexOf('--ra');
  if (j < 0) { console.error('Thiếu --ra <thư mục> hoặc --so <A> <B>.'); process.exit(1); }
  chup(process.argv[j + 1]);
}
