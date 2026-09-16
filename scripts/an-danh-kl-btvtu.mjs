// Sinh BỘ DỮ LIỆU VÀNG ẨN DANH cho tests/ từ file Excel gốc (thiết kế KL BTVTU Phần 2.4b): repo public nên
// không chứa họ tên, nội dung kết luận, minh chứng, email. Giữ nguyên những gì quyết định số liệu: mã, hội nghị,
// số KL, ngày ban hành, loại thời hạn, hạn xử lý, tiến độ, ngành, cơ quan trình, ngày cập nhật gần nhất.
//
//   node an-danh-kl-btvtu.mjs --file "<đường dẫn kl-btvtu-goc.xlsx>" --out ../tests/rls/du-lieu-vang/kl-btvtu.json
//
// - Chủ trì: mỗi họ tên thật (sắp xếp theo tên) → một tài khoản demo theo vòng tròn demo_cv1, demo_cv2, demo_truongphong,
//   demo_qtht (ghi full_name của seed.sql để script nhập đối chiếu như file thật). "VPTU" giữ nguyên → script nhập tự
//   gán Trưởng phòng Tổng hợp của project (staging: demo_truongphong), đúng đường đi của dữ liệu thật.
// - Nội dung = "Nhiệm vụ NV-xxx (ẩn)"; minh chứng, văn bản triển khai, lĩnh vực chi tiết = null; không có nhật ký.
// - Bộ số tổng (tongHop) của bản ẩn danh PHẢI bằng của file thật — khác là lỗi, không ghi file. Bộ số trạng thái
//   146/16/8/6/6/3/0 đối chiếu bằng test kl-moc-2026-09-14 sau khi nhập vào local/staging (hàm trang_thai).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from './kl/ket-noi.mjs';
import { docNguon } from './kl/doc-nguon.mjs';
import { TEN_VPTU, tongHop } from './kl/kiem-tra.mjs';

// full_name trong supabase/seed.sql (local và staging).
const DEMO = ['Demo Chuyên viên Một', 'Demo Chuyên viên Hai', 'Demo Trưởng phòng', 'Demo Quản trị hệ thống'];
const GIU = ['ma', 'stt', 'so_hoi_nghi', 'so_ket_luan', 'ngay_ban_hanh', 'nganh_ten', 'co_quan_trinh_ten', 'loai_thoi_han_ten',
  'han_xu_ly', 'tien_do_ten', 'cap_nhat_luc'];

function anDanh(rows) {
  const ten = [...new Set(rows.map((r) => r.chu_tri_ten).filter((t) => t && t !== TEN_VPTU))].sort((a, b) => a.localeCompare(b, 'vi'));
  const thay = new Map(ten.map((t, i) => [t, DEMO[i % DEMO.length]]));
  return rows.map((r) => {
    const o = {};
    for (const k of GIU) o[k] = r[k] ?? null;
    o.chu_tri_ten = r.chu_tri_ten === TEN_VPTU ? TEN_VPTU : thay.get(r.chu_tri_ten);
    o.noi_dung = `Nhiệm vụ ${r.ma} (ẩn)`;
    o.linh_vuc_chi_tiet = null; o.minh_chung = null; o.van_ban_trien_khai = null;
    return o;
  });
}

// JSON một dòng cho mỗi nhiệm vụ để file đọc được bằng mắt và không vượt quy ước 300 dòng.
function jsonMotDongMoiNhiemVu(obj) {
  const rows = obj.nhiem_vu.map((r) => `    ${JSON.stringify(r)}`).join(',\n');
  const phan = Object.entries(obj).filter(([k]) => k !== 'nhiem_vu').map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  return `{\n${phan.join(',\n')},\n  "nhiem_vu": [\n${rows}\n  ]\n}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2), ['--file', '--out']);
  if (!args.file || !args.out) throw new Error('Cần --file <xlsx gốc> và --out <đường dẫn .json trong tests/>.');
  const nguon = await docNguon(args.file);
  if (nguon.loai !== 'xlsx') throw new Error('Nguồn phải là file Excel gốc.');
  const rows = anDanh(nguon.nhiem_vu);
  const thThat = tongHop(nguon.nhiem_vu);
  const thAn = tongHop(rows);
  if (JSON.stringify(thThat) !== JSON.stringify(thAn)) {
    throw new Error(`Bộ số tổng của bản ẩn danh KHÁC file thật:\n${JSON.stringify(thThat)}\n${JSON.stringify(thAn)}`);
  }
  const ra = {
    mo_ta: 'Bộ dữ liệu vàng ẩn danh KL BTVTU (sinh bằng scripts/an-danh-kl-btvtu.mjs từ file gốc ngoài repo). Không sửa tay.',
    nguon_sha256: nguon.nguon_sha256,
    sinh_luc: new Date().toISOString(),
    tong_hop: thAn,
    nhiem_vu: rows,
  };
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, jsonMotDongMoiNhiemVu(ra), 'utf8');
  console.log(`Đã ghi ${rows.length} dòng ẩn danh → ${args.out}`);
  console.log(`Bộ số tổng (bằng file thật): tiến độ ${JSON.stringify(thAn.tien_do)}, loại hạn ${JSON.stringify(thAn.loai_thoi_han)}, hội nghị ${thAn.hoi_nghi}`);
  console.log(`Chủ trì thay bằng: ${DEMO.join(', ')} (xoay vòng theo tên đã sắp xếp); "VPTU" giữ nguyên.`);
}

main().catch((err) => {
  console.error(`Lỗi: ${err.message}`);
  process.exit(1);
});
