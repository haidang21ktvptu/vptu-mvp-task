// Markup màn hình "Nhiệm vụ" (mockup "Các mục còn lại": tổng quan → danh sách → chi tiết, không rời màn hình): dải số tổng quan bấm để
// lọc (mỗi ô một nhóm trạng thái; tổng các ô = tổng dòng), chip phòng/đơn vị (A1/A0), ô tìm + ba bộ lọc cố định (kết luận, mức đã ở dải,
// thêm bộ lọc: hội nghị, ngành, lĩnh vực), danh sách gọn ở giữa, ngăn chi tiết bên phải. Dùng chung mọi vai; phạm vi do RLS.
import { THU_TU_NHOM, NHOM } from '../../../lib/kl/nhan.js';

const oSo = (ma) => `<button type="button" class="o-so ${NHOM[ma].stat}" data-action="locKlNhom" data-nhom="${ma}" aria-pressed="false"><b id="klSo-${ma}">0</b> ${NHOM[ma].ten.toLowerCase()}</button>`;

export const klTemplate = `
  <div class="dau"><h1 id="klTieuDe">Nhiệm vụ</h1><span id="klPhuDe">trong phạm vi của đồng chí — mỗi việc một đơn vị chịu trách nhiệm, một sản phẩm, một hạn</span>
    <div class="phai-dau"><span id="klTinhDen" class="chu-phu" aria-live="polite"></span><span id="klKetNoi" class="ket-noi" role="status"></span>
      <button type="button" class="nut nho" data-action="loadKl">Tải lại</button>
      <button type="button" id="klNutThem" class="nut nho chinh hidden" data-action="openGiaoViec">Giao việc</button></div></div>

  <div id="klStats" class="tq" role="group" aria-label="Tổng quan, bấm để lọc">
    <button type="button" class="o-so" data-action="locKlNhom" data-nhom="" aria-pressed="true"><b id="klSo-TONG">0</b> việc trong phạm vi</button><span class="sep"></span>
    ${THU_TU_NHOM.map(oSo).join('')}
    <span id="klPhongChips"></span>
  </div>
  <div id="klChipLoc" class="chip-loc hidden" role="status"></div>

  <div class="md">
    <div class="list">
      <div class="tim">
        <input type="search" id="klTimKiem" placeholder="Tìm theo mã, nội dung, số kết luận, người" aria-label="Tìm nhiệm vụ">
        <select id="klLocKetLuan" aria-label="Kết luận / văn bản"><option value="">Mọi kết luận</option></select>
        <details><summary>Thêm bộ lọc</summary><div class="them-loc">
          <select id="klLocHoiNghi" aria-label="Lọc theo hội nghị"><option value="">Mọi hội nghị</option></select>
          <select id="klLocNganh" aria-label="Lọc theo ngành"><option value="">Mọi ngành</option></select>
          <select id="klLocLinhVuc" aria-label="Lọc theo lĩnh vực"><option value="">Mọi lĩnh vực</option></select>
        </div></details>
      </div>
      <div id="klBody"><p class="trong-nho">Đang tải dữ liệu</p></div>
      <div class="ds-chan"><span id="klSoDong"></span></div>
    </div>
    <aside class="chi-tiet" id="klChiTiet" aria-label="Chi tiết nhiệm vụ đang chọn"><p class="trong-nho">Chọn một dòng để xem chỉ đạo, minh chứng và lịch sử.</p></aside>
  </div>
`;
