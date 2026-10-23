// v3.31 (0128, chủ dự án quyết 23/10/2026 — "Bỏ đi → chỉ còn Chủ trì theo dõi"): mọi màn hình chỉ còn MỘT vai "Chủ trì theo dõi". Cột
// nhiem_vu.nguoi_theo_doi giữ làm trường nội bộ = người đại diện của chủ trì (cán bộ chủ trì; phòng → Trưởng phòng; Văn phòng → Chánh Văn phòng —
// trigger 0128), không hiện. Phần THUẦN (unit test frontend/tests/chu-tri.test.mjs): ghi chủ trì một kiểu ở mọi nơi; Diễn biến ẩn / làm gọn câu
// lịch sử cũ còn nhắc người theo dõi.
import { boSoThuTu } from './nhan.js';

// Cán bộ chủ trì: "Họ tên (Phòng …)" — lãnh đạo Văn phòng: "Họ tên (Văn phòng Tỉnh ủy)"; phòng / Văn phòng: tên đơn vị (bỏ số thứ tự đầu tên).
export function chuTriText(r, trong = 'chưa xác định') {
  const dv = boSoThuTu(r?.owner_don_vi_ten);
  if (r?.owner_tai_khoan_ten) return dv ? `${r.owner_tai_khoan_ten} (${dv})` : r.owner_tai_khoan_ten;
  return dv || trong;
}

// Dòng Diễn biến không hiện: đổi người theo dõi (máy tự ghi theo chủ trì; căn dữ liệu 0128); "Đổi chủ trì theo dõi" trước v3.31 chỉ đổi người
// theo dõi (câu bắt đầu "người theo dõi:").
export const anDongDienBien = (d) => d?.nguon === 'lich_su'
  && (d.loai === 'nguoi_theo_doi' || (d.loai === 'doi_chu_tri' && /^người theo dõi:/.test(d.noi_dung || '')));

// Câu lịch sử ghi trước v3.31: bỏ phần người theo dõi — chuyên viên giao thẳng (0085 "…giao, người theo dõi là người giao"), giao lại (0045 "… ·
// người theo dõi: X"), đổi chủ trì (0124 "chủ trì: A → B · người theo dõi: C → D — lý do: …"), bổ sung dữ liệu (0118 "…, người theo dõi");
// "Chuyển người theo dõi" (hộp chuyển việc 0092) → "Chuyển theo dõi".
export function lamGonCauCu(s) {
  if (typeof s !== 'string' || !s.includes('người theo dõi')) return s;
  return s.replace(/, người theo dõi là người giao/g, '')
    .replace(/ · người theo dõi: .*?(?= — lý do: |$)/g, '')
    .replace(/người theo dõi, /g, '').replace(/, người theo dõi(?= — lý do: |$)/g, '')
    .replace(/^Chuyển người theo dõi/, 'Chuyển theo dõi');
}
