// Markup màn hình "Nhiệm vụ" (v8 đợt 3, mockup 06): hàng lọc MỘT dòng — pill đếm theo nhóm (bấm để lọc; tổng các ô = tổng dòng) + ô tìm + ô chọn
// Đơn vị (có đếm) + Kết luận, "Thêm bộ lọc" (hội nghị, ngành, lĩnh vực) gập bên dưới; danh sách hàng bên trái, ngăn chi tiết cố định 520px bên phải.
// Dùng chung mọi vai; phạm vi do RLS. Id giữ nguyên (e2e): #klStats .o-so[data-nhom], #klSo-*, #klTimKiem, #klLoc*, #klChipLoc, #klBody, #klChiTiet.
import { THU_TU_NHOM, NHOM } from '../../../lib/kl/nhan.js';

const oSo = (ma) => `<button type="button" class="o-so ${NHOM[ma].stat}" data-action="locKlNhom" data-nhom="${ma}" aria-pressed="false"><b id="klSo-${ma}">0</b> ${NHOM[ma].ten.toLowerCase()}</button>`;

export const klTemplate = `
  <div class="dau"><h1 id="klTieuDe">Nhiệm vụ</h1><span id="klPhuDe">trong phạm vi của đồng chí — bấm một dòng để mở ngăn chi tiết bên phải</span>
    <div class="phai-dau"><span id="klTinhDen" class="chu-phu" aria-live="polite"></span><span id="klKetNoi" class="ket-noi" role="status"></span>
      <button type="button" class="nut nho" data-action="loadKl">Tải lại</button>
      <button type="button" id="klNutThem" class="nut nho chinh hidden" data-action="openGiaoViec">Giao việc</button></div></div>

  <div class="kl-loc">
    <div id="klStats" class="tq" role="group" aria-label="Tổng quan, bấm để lọc">
      <button type="button" class="o-so" data-action="locKlNhom" data-nhom="" aria-pressed="true"><b id="klSo-TONG">0</b> tổng</button>
      ${THU_TU_NHOM.map(oSo).join('')}
    </div>
    <label class="kl-tim"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input type="search" id="klTimKiem" placeholder="Tìm mã, nội dung, số kết luận, người" aria-label="Tìm nhiệm vụ"></label>
    <select id="klLocDonVi" aria-label="Đơn vị chịu trách nhiệm"><option value="">Đơn vị</option></select>
    <select id="klLocKetLuan" aria-label="Kết luận / văn bản"><option value="">Mọi kết luận</option></select>
    <details class="kl-them"><summary>Thêm bộ lọc</summary><div class="them-loc">
      <select id="klLocHoiNghi" aria-label="Lọc theo hội nghị"><option value="">Mọi hội nghị</option></select>
      <select id="klLocNganh" aria-label="Lọc theo ngành"><option value="">Mọi ngành</option></select>
      <select id="klLocLinhVuc" aria-label="Lọc theo lĩnh vực"><option value="">Mọi lĩnh vực</option></select>
    </div></details>
  </div>
  <div id="klChipLoc" class="chip-loc hidden" role="status"></div>

  <div class="md">
    <div class="list">
      <div id="klBody"><p class="trong-nho">Đang tải dữ liệu</p></div>
      <div class="ds-chan"><span id="klSoDong"></span></div>
    </div>
    <aside class="chi-tiet" id="klChiTiet" aria-label="Chi tiết nhiệm vụ đang chọn"><p class="trong-nho">Chọn một dòng để xem chỉ đạo, minh chứng và lịch sử.</p></aside>
  </div>
`;
