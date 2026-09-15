// Ánh xạ giá trị tự do kl_nhiem_vu.linh_vuc_chi_tiet (dữ liệu Excel cũ) về danh mục dm_linh_vuc (GĐ9 PR 9B).
// DRY-RUN LÀ MẶC ĐỊNH và CHỈ ĐỌC: xuất bảng duyệt CSV ra NGOÀI repo; người quản trị sheet điền cột "linh_vuc_chot";
// --ghi đọc lại CSV đã duyệt và chỉ điền linh_vuc_ma cho dòng có chốt (dòng để trống giữ NULL).
//
//   node anh-xa-linh-vuc.mjs --local                                              # dry-run local → CSV mặc định
//   node anh-xa-linh-vuc.mjs --project-ref frwyxcmbonjaimziiuqr --production      # dry-run production (chỉ đọc)
//   node anh-xa-linh-vuc.mjs --project-ref frwyxcmbonjaimziiuqr --production --ghi --file "<csv hoặc xlsx đã duyệt>"
//
// - Đề xuất chỉ trong phạm vi lĩnh vực THUỘC ĐÚNG ngành của dòng, khớp không phân biệt hoa/thường/dấu; không chắc → trống.
// - CSV mặc định: D:/TU 2026/Project/vptu-backup/nguon-kl-btvtu/anh-xa-linh-vuc.csv (đã có thì ghi thêm hậu tố ngày);
//   --out <file>.xlsx xuất Excel cùng bố cục. --ghi --file nhận .csv hoặc .xlsx (sheet "Đối chiếu lĩnh vực", tiêu đề dòng 5,
//   cột E = lĩnh vực chốt, cột B tên ngành hiển thị → mã ngành) — người duyệt dùng Excel theo vùng dấu phẩy mở CSV bị gộp cột.
// - --ghi: chốt sai ngành / không có trong danh mục → dừng, không ghi gì. Ghi bằng một khối SQL (scripts/kl/anh-xa-linh-vuc.mjs
//   sqlCapNhat): không đổi cap_nhat_luc của dòng, kl_lich_su vẫn có vết từng dòng. Production: --production bắt buộc,
//   cần backup-db.sh trước và xác nhận của chủ dự án trong phiên (CLAUDE.md rule 12).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb, dbQuery, parseArgs, PRODUCTION_REF, resolveTarget } from './kl/ket-noi.mjs';
import { docChot, docCsv, ghiCsv, gomNhom, sqlCapNhat, taoBangDuyet } from './kl/anh-xa-linh-vuc.mjs';
import { docXlsxDuyet, ghiXlsxDuyet } from './kl/doc-xlsx-linh-vuc.mjs';

const laXlsx = (p) => (p || '').toLowerCase().endsWith('.xlsx');

const ALLOWED = ['--file', '--out', '--local', '--project-ref', '--ghi', '--dry-run', '--production'];
const CSV_MAC_DINH = 'D:/TU 2026/Project/vptu-backup/nguon-kl-btvtu/anh-xa-linh-vuc.csv';

// Đích chưa có 0018 (production trước v2.2.0): dry-run vẫn lập được bảng duyệt bằng danh mục đọc từ Supabase LOCAL
// (cùng migration 0018, danh mục ban đầu là hằng); --ghi thì bắt buộc đích phải có dm_linh_vuc.
async function docDuLieu(db, choPhepDanhMucLocal) {
  const nganh = await db.from('dm_nganh').select('ma, ten, thu_tu').order('thu_tu');
  if (nganh.error) throw new Error(`Đọc dữ liệu thất bại: ${nganh.error.message}`);
  let nv = await db.from('kl_nhiem_vu').select('id, ma, nganh_ma, linh_vuc_chi_tiet, linh_vuc_ma').order('ma');
  let linhVuc = await db.from('dm_linh_vuc').select('ma, nganh_ma, ten, thu_tu').order('thu_tu');
  let nguonDanhMuc = 'đích';
  if (nv.error || linhVuc.error) {
    if (!choPhepDanhMucLocal) throw new Error(`Đích chưa có migration 0018 (dm_linh_vuc / linh_vuc_ma): ${(nv.error || linhVuc.error).message}`);
    nv = await db.from('kl_nhiem_vu').select('id, ma, nganh_ma, linh_vuc_chi_tiet').order('ma');
    if (nv.error) throw new Error(`Đọc dữ liệu thất bại: ${nv.error.message}`);
    nv.data.forEach((n) => { n.linh_vuc_ma = null; });
    linhVuc = await createDb(resolveTarget({ local: true })).from('dm_linh_vuc').select('ma, nganh_ma, ten, thu_tu').order('thu_tu');
    if (linhVuc.error) throw new Error(`Đích chưa có dm_linh_vuc và không đọc được từ local: ${linhVuc.error.message}`);
    nguonDanhMuc = 'LOCAL (đích chưa có 0018 — kiểm lại sau khi phát hành)';
  }
  return { nganh: nganh.data, linhVuc: linhVuc.data, nhiemVu: nv.data, nguonDanhMuc };
}

function duongDanCsv(out) {
  let path = resolve(out || CSV_MAC_DINH);
  const duoi = laXlsx(path) ? '.xlsx' : '.csv';
  if (existsSync(path)) {
    const ngay = new Date().toISOString().slice(0, 10);
    path = path.slice(0, -duoi.length) + `.${ngay}${duoi}`;
    let k = 2;
    while (existsSync(path)) path = path.replace(/(\.\d{4}-\d{2}-\d{2})(?:-\d+)?\.(csv|xlsx)$/i, `$1-${k++}.$2`);
    console.log(`Đã có file duyệt cũ — không ghi đè, ghi sang: ${path}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  return path;
}

function inBaoCaoDryRun(du, bang) {
  const coGiaTri = du.nhiemVu.filter((n) => String(n.linh_vuc_chi_tiet ?? '').trim()).length;
  const deXuat = bang.filter((b) => b.linh_vuc_de_xuat).length;
  const khongNganh = bang.filter((b) => !b.nganh).length;
  console.log(`\n== TỔNG QUAN ==\n  Nhiệm vụ: ${du.nhiemVu.length} · có linh_vuc_chi_tiet: ${coGiaTri} · đã có linh_vuc_ma: ${du.nhiemVu.filter((n) => n.linh_vuc_ma).length}`);
  console.log(`  Cặp (ngành, giá trị) distinct: ${bang.length} · đề xuất được: ${deXuat} · để trống: ${bang.length - deXuat} (trong đó không có ngành: ${khongNganh})`);
  console.log('\n== THEO NGÀNH (cặp / dòng / đề xuất) ==');
  for (const n of du.nganh) {
    const cua = bang.filter((b) => b.nganh === n.ma);
    if (cua.length > 0) console.log(`  ngành ${String(n.thu_tu).padStart(2)}  ${String(cua.length).padStart(3)} cặp  ${String(cua.reduce((s, b) => s + b.so_dong, 0)).padStart(3)} dòng  ${String(cua.filter((b) => b.linh_vuc_de_xuat).length).padStart(3)} đề xuất`);
  }
}

async function demHienTrang(db, capNhat) {
  const { data, error } = await db.from('kl_nhiem_vu').select('id, ma, nganh_ma, linh_vuc_chi_tiet, linh_vuc_ma');
  if (error) throw new Error(error.message);
  return capNhat.map((c) => {
    const dong = data.filter((n) => n.nganh_ma === c.nganh_ma && String(n.linh_vuc_chi_tiet ?? '').trim() === c.gia_tri_goc);
    return { ...c, ids: dong.filter((n) => !n.linh_vuc_ma).map((n) => n.id), se_dien: dong.filter((n) => !n.linh_vuc_ma).length, bo_qua_da_co: dong.filter((n) => n.linh_vuc_ma && n.linh_vuc_ma !== c.linh_vuc_ma).map((n) => n.ma) };
  });
}

async function demSau(db) {
  const { data, error } = await db.from('kl_nhiem_vu').select('linh_vuc_ma, linh_vuc_chi_tiet');
  if (error) throw new Error(error.message);
  const theoLv = {};
  for (const n of data) if (n.linh_vuc_ma) theoLv[n.linh_vuc_ma] = (theoLv[n.linh_vuc_ma] || 0) + 1;
  const { count } = await db.from('kl_lich_su').select('id', { count: 'exact', head: true }).eq('cot', 'linh_vuc_ma').eq('nguoi_sua_ghi_chu', 'script anh-xa-linh-vuc (CSV đã duyệt)');
  return { co_linh_vuc: data.filter((n) => n.linh_vuc_ma).length, con_null_co_chi_tiet: data.filter((n) => !n.linh_vuc_ma && String(n.linh_vuc_chi_tiet ?? '').trim()).length, theo_linh_vuc: theoLv, lich_su_script: count };
}

function bienBan(target, keHoach, sau) {
  const thuMuc = fileURLToPath(new URL('./out/', import.meta.url));
  mkdirSync(thuMuc, { recursive: true });
  const path = `${thuMuc}bien-ban-anh-xa-linh-vuc-${target.ten}-${new Date().toISOString().slice(0, 10)}.md`;
  writeFileSync(path, [
    `# Biên bản ánh xạ lĩnh vực — đích: ${target.ten} — ${new Date().toISOString()}`, '',
    `- Cặp đã chốt: ${keHoach.length}; dòng điền mới: ${keHoach.reduce((s, c) => s + c.se_dien, 0)}; dòng bỏ qua vì đã có lĩnh vực khác: ${keHoach.reduce((s, c) => s + c.bo_qua_da_co.length, 0)}`,
    ...keHoach.map((c) => `  - "${c.gia_tri_goc}" (${c.nganh_ma}) → ${c.linh_vuc_ma}: ${c.se_dien} dòng`),
    `- Sau khi ghi: ${JSON.stringify(sau)}`, '',
    'Không đổi cap_nhat_luc/cap_nhat_boi (trigger b_ tắt tạm trong khối SQL); kl_lich_su ghi từng dòng với nguoi_sua_ghi_chu của script.', '',
  ].join('\n'), 'utf8');
  return path;
}

async function main() {
  const args = parseArgs(process.argv.slice(2), ALLOWED);
  if (args.projectRef === PRODUCTION_REF && !args.production) throw new Error('Đích là PRODUCTION: phải ghi rõ --production (kể cả khi chỉ đọc).');
  const target = resolveTarget(args);
  if (target.production && !args.production) throw new Error(`Đích là PRODUCTION (${PRODUCTION_REF}): phải ghi rõ --production.`);
  const db = createDb(target);
  const du = await docDuLieu(db, !args.ghi);
  console.log(`Đích: ${target.ten} · danh mục lĩnh vực từ: ${du.nguonDanhMuc} · ${args.ghi ? 'GHI THẬT từ CSV đã duyệt' : 'DRY-RUN (chỉ đọc, xuất bảng duyệt)'}`);

  if (!args.ghi) {
    const bang = taoBangDuyet(gomNhom(du.nhiemVu), du.nganh, du.linhVuc);
    inBaoCaoDryRun(du, bang);
    const path = duongDanCsv(args.out);
    if (laXlsx(path)) await ghiXlsxDuyet(path, bang, du.nganh);
    else writeFileSync(path, ghiCsv(bang), 'utf8');
    console.log(`\nĐã xuất bảng duyệt (${bang.length} dòng): ${path}\nĐiền cột "linh_vuc_chot" (tên hoặc mã lĩnh vực, để trống = giữ NULL) rồi chạy lại với --ghi --file "<csv hoặc xlsx>" (Excel: sheet "Đối chiếu lĩnh vực", tiêu đề dòng 5, cột E).`);
    return;
  }

  if (!args.file) throw new Error('--ghi cần --file <csv hoặc xlsx đã duyệt>.');
  // .xlsx: sheet "Đối chiếu lĩnh vực", cột B tên ngành hiển thị → mã ngành (không nhận diện được → vi phạm, dừng).
  const { rows, loi: loiDoc } = laXlsx(args.file) ? await docXlsxDuyet(args.file, du.nganh) : { rows: docCsv(readFileSync(args.file, 'utf8')), loi: [] };
  const chot = docChot(rows, du.linhVuc);
  const { cap_nhat: capNhat, bo_qua: boQua } = chot;
  const loi = [...loiDoc, ...chot.loi];
  if (loi.length > 0) { console.log(`\n== VI PHẠM (${loi.length}) — dừng, không ghi gì ==`); loi.forEach((l) => console.log(`  - ${l}`)); process.exitCode = 2; return; }
  const keHoach = await demHienTrang(db, capNhat);
  console.log(`\n== TRƯỚC KHI GHI == ${rows.length} dòng CSV · ${capNhat.length} cặp chốt · ${boQua} cặp để trống (giữ NULL)`);
  for (const c of keHoach) console.log(`  "${c.gia_tri_goc}" (${c.nganh_ma}) → ${c.ten} [${c.linh_vuc_ma}]: điền ${c.se_dien} dòng${c.bo_qua_da_co.length ? `; bỏ qua đã có khác: ${c.bo_qua_da_co.join(', ')}` : ''}`);
  const tong = keHoach.reduce((s, c) => s + c.se_dien, 0);
  if (tong === 0) { console.log('\nKhông có dòng nào cần điền.'); return; }
  if (target.production) console.log('\nPRODUCTION: cần đã chạy backup-db.sh và có xác nhận của chủ dự án trong phiên.');
  const truoc = await demSau(db);
  dbQuery(target, sqlCapNhat(keHoach.flatMap((c) => c.ids.map((id) => ({ id, linh_vuc_ma: c.linh_vuc_ma })))));
  const sau = await demSau(db);
  if (sau.lich_su_script - truoc.lich_su_script !== tong || sau.co_linh_vuc - truoc.co_linh_vuc !== tong) {
    throw new Error(`Đếm lại sau khi ghi KHÔNG khớp dự kiến ${tong} (lịch sử +${sau.lich_su_script - truoc.lich_su_script}, có lĩnh vực +${sau.co_linh_vuc - truoc.co_linh_vuc}) — kiểm tra tay.`);
  }
  console.log(`\nĐÃ GHI ${tong} dòng (đếm lại khớp).\nSau khi ghi: ${JSON.stringify(sau)}`);
  console.log(`Biên bản: ${bienBan(target, keHoach, sau)}`);
}

main().catch((err) => { console.error(`Lỗi: ${err.message}`); process.exit(1); });
