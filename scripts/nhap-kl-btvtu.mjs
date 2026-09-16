// Nhập dữ liệu Theo dõi Kết luận BTVTU từ file Excel gốc (NGOÀI repo) hoặc bộ dữ liệu vàng .json vào
// van_ban_giao_viec / nhiem_vu / lich_su (GĐ8 PR 8B, thiết kế Phần 2.4). DRY-RUN LÀ MẶC ĐỊNH — chỉ --ghi mới ghi.
//
//   node nhap-kl-btvtu.mjs --file <đường dẫn .xlsx|.json> --local                          # dry-run trên Supabase cục bộ
//   node nhap-kl-btvtu.mjs --file ../tests/rls/du-lieu-vang/kl-btvtu.json --local --ghi     # nhập bộ vàng (local/staging)
//   node nhap-kl-btvtu.mjs --file <xlsx> --project-ref <staging>  [--ghi] [--xoa-cu]
//   node nhap-kl-btvtu.mjs --file <xlsx> --project-ref frwyxcmbonjaimziiuqr --production --ghi --anh-xa-nguoi-sua <json>
//
// - Dry-run in: bảng ánh xạ chủ trì (họ tên Excel → username; "VPTU" → Trưởng phòng Tổng hợp), bảng đối chiếu số thô,
//   vi phạm dữ liệu, vi phạm ánh xạ, nhóm script tự xử lý (3 dòng cần lý do chưa có hạn, dòng VPTU, nhật ký suy mã).
//   Có vi phạm → không ghi. Trạng thái KHÔNG tính ở đây (kl_trang_thai trong DB; test kl-moc-2026-09-14 đối chiếu).
// - --ghi từ chối nếu đã có dòng nguon = 'excel' (trừ --xoa-cu, chỉ local/staging). Production: bắt buộc thêm --production,
//   không bao giờ --xoa-cu, và cần chủ dự án xác nhận trong phiên (CLAUDE.md rule 12) + backup-db.sh trước đó.
// - --anh-xa-nguoi-sua: file JSON {"email": "username"} ngoài repo cho nhật ký cũ; email thiếu → dừng.
// - Sau khi ghi: đếm lại, in bộ số, xuất biên bản scripts/out/bien-ban-nhap-kl-<đích>-<ngày>.md (gitignored, không họ tên).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDb, parseArgs, PRODUCTION_REF, resolveTarget } from './kl/ket-noi.mjs';
import { docNguon } from './kl/doc-nguon.mjs';
import { anhXaChuTri, anhXaEmail, docDanhMuc, docTaiKhoan, kiemTraDuLieu, tongHop, tongHopNhatKy } from './kl/kiem-tra.mjs';
import { demDongExcel, dungDong, ghiDuLieu, kiemLaiSauGhi, xoaDuLieuExcelCu } from './kl/ghi.mjs';

const ALLOWED = ['--file', '--local', '--project-ref', '--ghi', '--dry-run', '--production', '--xoa-cu', '--anh-xa-nguoi-sua'];

const inBang = (tieuDe, obj) => {
  console.log(`\n${tieuDe}`);
  for (const [k, v] of Object.entries(obj)) console.log(`  ${String(k).padEnd(70)} ${v}`);
};

function inDoiChieu(th, thNK) {
  console.log(`\n== BẢNG ĐỐI CHIẾU (số thô từ nguồn) ==`);
  console.log(`  Tổng dòng: ${th.tong} · hội nghị (số HN + số KL): ${th.hoi_nghi} · số hội nghị distinct: ${th.so_hoi_nghi} · dòng có "Ngày cập nhật gần nhất": ${th.co_cap_nhat_luc}`);
  inBang('Theo tiến độ:', th.tien_do);
  inBang('Theo loại thời hạn:', th.loai_thoi_han);
  inBang('Có/không hạn theo tiến độ (hạn trên Excel, chưa tính "Ký ban hành" tự sinh):', th.co_han_theo_tien_do);
  inBang('Theo ngành/lĩnh vực:', th.nganh);
  inBang('Theo cơ quan trình:', th.co_quan_trinh);
  inBang('Theo hội nghị:', th.theo_hoi_nghi);
  if (thNK.tong > 0) { console.log(`\n  Nhật ký cũ: ${thNK.tong} dòng, ${thNK.so_ma} mã`); inBang('Nhật ký theo cột:', thNK.theo_cot); }
}

function inAnhXa(anhXa) {
  console.log('\n== ÁNH XẠ CHỦ TRÌ (họ tên trên Excel → tài khoản) — XÁC NHẬN trước khi --ghi ==');
  for (const b of anhXa.bang) console.log(`  ${b.ten.padEnd(28)} → ${b.username.padEnd(20)} ${String(b.so_dong).padStart(3)} dòng  ${b.ghi_chu}`);
}

function inDanhSach(tieuDe, ds, fmt = (x) => x) {
  console.log(`\n${tieuDe} (${ds.length})`);
  for (const x of ds) console.log(`  - ${fmt(x)}`);
}

function bienBan(target, nguon, th, thNK, kq, kiemLai, anhXa) {
  const ngay = new Date().toISOString().slice(0, 10);
  const dong = [
    `# Biên bản nhập dữ liệu KL BTVTU — đích: ${target.ten} — ${new Date().toISOString()}`, '',
    `- Nguồn: ${nguon.loai}, SHA-256 \`${nguon.nguon_sha256}\``,
    `- Đã ghi: ${kq.hoi_nghi} hội nghị, ${kq.nhiem_vu} nhiệm vụ (nguon = excel), ${kq.lich_su_excel} dòng nhật ký cũ (lich_su nguon = excel, cot ≠ '*'); mã kế tiếp ${kq.ma_ke_tiep}`,
    `- Đếm lại trên DB: ${JSON.stringify(kiemLai)}`,
    `- Số dòng theo tiến độ: ${JSON.stringify(th.tien_do)}; theo loại thời hạn: ${JSON.stringify(th.loai_thoi_han)}`,
    `- Có/không hạn theo tiến độ (Excel): ${JSON.stringify(th.co_han_theo_tien_do)}`,
    `- Chủ trì: ${anhXa.bang.filter((b) => b.ten !== 'VPTU').length} họ tên khớp tài khoản; ${kiemLai.chuyen_tu_vptu} dòng "VPTU" chuyển về Trưởng phòng Tổng hợp (không ghi tên/số việc theo người — repo public).`,
    `- Nhật ký cũ: ${thNK.tong} dòng theo cột ${JSON.stringify(thNK.theo_cot)}`,
    `- Lưu ý: lich_su còn ${kiemLai.lich_su_excel_tao} dòng cot = '*' do trigger ghi lúc INSERT (không phải nhật ký cũ).`,
    '', 'Bộ số trạng thái tại 14/9/2026 đối chiếu bằng test tests/rls/kl-moc-2026-09-14 (hàm kl_trang_thai), không tính ở script.', '',
  ];
  const thuMuc = fileURLToPath(new URL('./out/', import.meta.url));   // scripts/out/ (gitignored), không phụ thuộc cwd
  mkdirSync(thuMuc, { recursive: true });
  const path = `${thuMuc}bien-ban-nhap-kl-${target.ten}-${ngay}.md`;
  writeFileSync(path, dong.join('\n'), 'utf8');
  return path;
}

async function main() {
  const args = parseArgs(process.argv.slice(2), ALLOWED);
  if (!args.file) throw new Error('Cần --file <đường dẫn .xlsx hoặc .json>.');
  if (args.projectRef === PRODUCTION_REF && !args.production) throw new Error('Đích là PRODUCTION: phải ghi rõ --production (và đã có xác nhận của chủ dự án trong phiên).');
  const target = resolveTarget(args);
  if (target.production && !args.production) throw new Error(`Đích là PRODUCTION (${PRODUCTION_REF}): phải ghi rõ --production (và đã có xác nhận của chủ dự án trong phiên).`);
  if (target.production && args.xoaCu) throw new Error('--xoa-cu bị từ chối trên production.');
  const db = createDb(target);
  const nguon = await docNguon(args.file);
  const dm = await docDanhMuc(db);
  const accounts = await docTaiKhoan(db);
  const anhXa = anhXaChuTri(nguon.nhiem_vu, accounts);
  const anhXaNS = anhXaEmail(nguon.nhat_ky, accounts, args.anhXaNguoiSua ? JSON.parse(readFileSync(args.anhXaNguoiSua, 'utf8')) : null);
  const { viPham, canhBao, tuXuLy } = kiemTraDuLieu(nguon, dm);
  const th = tongHop(nguon.nhiem_vu);
  const thNK = tongHopNhatKy(nguon.nhat_ky);

  console.log(`Đích: ${target.ten} · nguồn: ${args.file} (${nguon.loai}, SHA-256 ${nguon.nguon_sha256.slice(0, 16)}…) · ${args.ghi ? 'GHI THẬT' : 'DRY-RUN (không ghi gì)'}`);
  inAnhXa(anhXa);
  inDoiChieu(th, thNK);
  inDanhSach('== VI PHẠM DỮ LIỆU (phải sửa trên file nguồn, script không đoán) ==', viPham, (v) => `${v.ma}${v.dong ? ` (dòng ${v.dong})` : ""}: ${v.mo_ta}`);
  inDanhSach('== VI PHẠM ÁNH XẠ TÀI KHOẢN (dừng, không đoán) ==', [...anhXa.loi, ...anhXaNS.loi]);
  inDanhSach(`== SCRIPT TỰ XỬ LÝ: đang mở, "Có hạn cụ thể", trống hạn → ly_do_chua_co_han = "Phụ thuộc yếu tố bên ngoài (chốt 14/9/2026)" ==`, tuXuLy.canLyDo);
  inDanhSach('== SCRIPT TỰ XỬ LÝ: chủ trì "VPTU" → Trưởng phòng Tổng hợp, ghi_chu "chuyển từ VPTU" ==', tuXuLy.vptu);
  inDanhSach('== SCRIPT TỰ XỬ LÝ: nhật ký không có mã → suy từ số dòng (công thức NV-(dòng − 3) của sheet) ==', tuXuLy.nhatKySuyMa);
  inDanhSach('== SCRIPT TỰ XỬ LÝ: nhật ký không rõ người sửa → nguoi_sua NULL, giữ nguyên văn ở nguoi_sua_ghi_chu ==', anhXaNS.khongRo);
  console.log(`\n== CẢNH BÁO MỀM (nhập nguyên trạng, cờ nguon = excel) ==\n  Hoàn thành thiếu minh chứng: ${canhBao.hoanThanhThieuMinhChung} · Hoàn thành "Có hạn cụ thể" không hạn: ${canhBao.hoanThanhKhongHan}`);
  if (canhBao.kyBanHanhHanKhac.length > 0) console.log(`  "Ký ban hành" có hạn Excel khác ngày BH + 10 (trigger sẽ tính lại): ${canhBao.kyBanHanhHanKhac.join(', ')}`);

  const soLoi = viPham.length + anhXa.loi.length + anhXaNS.loi.length;
  if (soLoi > 0) { console.log(`\nKẾT QUẢ: ${soLoi} vi phạm — chưa nhập được.`); process.exitCode = 2; return; }
  if (!args.ghi) { console.log('\nKẾT QUẢ: 0 vi phạm. Dry-run xong — thêm --ghi để nhập thật (sau khi xác nhận bảng ánh xạ).'); return; }

  const daCo = await demDongExcel(db);
  if (daCo > 0) {
    if (!args.xoaCu) throw new Error(`Đích đã có ${daCo} dòng nhiem_vu nguon = 'excel' — không nhập chồng. Local/staging: thêm --xoa-cu để xoá rồi nhập lại.`);
    const x = await xoaDuLieuExcelCu(db);
    console.log(`\nĐã xoá ${x.nhiem_vu} nhiệm vụ excel cũ và ${x.hoi_nghi} hội nghị trống.`);
  }
  const dong = dungDong(nguon, dm, anhXa, anhXaNS);
  const kq = await ghiDuLieu(db, target, dong);
  const kiemLai = await kiemLaiSauGhi(db);
  console.log(`\nĐÃ GHI: ${JSON.stringify(kq)}\nĐếm lại: ${JSON.stringify(kiemLai)}`);
  if (kiemLai.nhiem_vu_excel !== nguon.nhiem_vu.length || kiemLai.lich_su_excel_nhat_ky !== nguon.nhat_ky.length) {
    throw new Error('Số dòng đếm lại KHÔNG khớp nguồn — kiểm tra tay trước khi dùng dữ liệu.');
  }
  console.log(`Biên bản: ${bienBan(target, nguon, th, thNK, kq, kiemLai, anhXa)}`);
  console.log('Tiếp theo: chạy tests/rls (kl-moc-2026-09-14) trên đích này để đối chiếu bộ số trạng thái.');
}

main().catch((err) => {
  console.error(`Lỗi: ${err.message}`);
  process.exit(1);
});
