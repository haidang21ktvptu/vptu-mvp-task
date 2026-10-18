// Màn hình "Theo văn bản" (v8 đợt 4; mọi vai từ v3.22.1 — phạm vi RLS của người xem). v3.25 (bảng theo cột, mẫu TheoVanBan 16/10/2026): đầu trang
// + ô số đếm văn bản (#tvbSo) + thanh lọc (phạm vi, tìm, loại văn bản, sắp xếp, mở / thu gọn tất cả, tóm tắt) + chú giải + bảng văn bản #tvbCay
// (data-nap đặt khi nạp xong — e2e chờ). Dòng và bảng con do dong.js vẽ. Lớp viết nguyên văn (Tailwind giữ lớp).
import { LOAI_VAN_BAN } from '../kl/them-owner.js';
import { dauBangHtml } from '../bang/khung.js';

// v3.22.1: chú thích phạm vi trên dòng tóm tắt (Trưởng phòng / chuyên viên chỉ thấy việc trong phạm vi; Thường trực, lãnh đạo VP: không ghi thêm).
export function nhanPhamViTvb(user, xemPhong = false) {
  if (user?.role_group === 'A2') return 'việc của phòng đồng chí';
  if (user?.role_group !== 'A3') return '';
  const pv = xemPhong ? 'việc của phòng đồng chí (việc người khác chỉ xem)' : 'việc đồng chí chủ trì, theo dõi hoặc đã giao';
  return user.thu_ky_thuong_truc ? `${pv}; việc có chỉ đạo Thường trực` : pv;   // thư ký Thường trực (0047) thấy thêm
}

const COT = [['STT', 'bnv-c-stt'], ['Văn bản'], ['Ngày nhận'], ['Người giao'], ['Nhiệm vụ'], ['Tiến độ'], ['Cảnh báo']];
const CHU_GIAI = '<span><i class="dac-biet"></i>Có việc Đỏ đặc biệt</span><span><i class="do"></i>Có việc quá hạn</span><span><i class="vang"></i>Có việc sắp đến hạn</span>'
  + '<span><i class="lam"></i>Đang thực hiện, trong hạn</span><span><i class="luc"></i>Hoàn thành toàn bộ</span>';

export const theoVanBanTemplate = `
  <div class="dau"><h1>Theo văn bản</h1><span>mỗi văn bản một dòng — bấm tên văn bản để xem nhiệm vụ giao từ văn bản và việc giao tiếp xuống; bấm một việc để mở ngăn chi tiết</span></div>
  <div id="tvbSo" class="bnv-so" role="group" aria-label="Lọc văn bản theo tình hình"></div>
  <div class="kl-loc tvb-loc">
    <div id="tvbToanBo" class="pham-vi hidden" role="group" aria-label="Phạm vi bảng văn bản">
      <button type="button" data-action="tvbToanBo" data-tb="1" aria-pressed="true">Toàn Văn phòng</button>
      <button type="button" data-action="tvbToanBo" data-tb="0" aria-pressed="false">Phạm vi của tôi</button></div>
    <label class="kl-tim"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input type="search" id="tvbTim" placeholder="Tìm số hiệu, trích yếu, mã hoặc nội dung việc" aria-label="Tìm văn bản" autocomplete="off"></label>
    <select id="tvbLoai" aria-label="Loại văn bản"><option value="">Mọi loại văn bản</option>${LOAI_VAN_BAN.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
    <select id="tvbSapXep" aria-label="Sắp xếp"><option value="moi">Sắp xếp: mới nhập trước</option><option value="nhan">Sắp xếp: ngày nhận văn bản</option></select>
    <button type="button" class="nut nho" data-action="tvbGapTatCa" data-mo="1">Mở rộng tất cả</button>
    <button type="button" class="nut nho" data-action="tvbGapTatCa" data-mo="0">Thu gọn tất cả</button>
    <span class="chu-phu" id="tvbTomTat"></span>
  </div>
  <p class="chu-phu tvb-ket-noi"><span id="tvbKetNoi" class="ket-noi" role="status"></span></p>
  <div class="bnv-chu-giai">${CHU_GIAI}</div>
  <div class="bnv cot-vb" role="region" aria-label="Danh sách văn bản giao việc">
    <div class="bnv-dau" aria-hidden="true">${dauBangHtml(COT)}</div>
    <div id="tvbCay" class="bnv-than" aria-live="polite"><p class="bnv-trong">Đang nạp văn bản…</p></div>
  </div>
`;
