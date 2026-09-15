// Markup màn hình "Kết luận BTVTU" (GĐ10 PR 10B, thiết kế 3.4): thanh số liệu theo nhóm trạng thái (mỗi ô là nút lọc),
// bộ lọc, bảng nhiệm vụ trong phạm vi RLS, dấu "Số liệu tính đến". Dùng chung A3 (việc mình), A2 (phòng), A1 (danh sách
// truy vết từ dashboard). Không có nút chỉ đạo (GĐ11).
import { THU_TU_NHOM, NHOM } from '../../../lib/kl/nhan.js';

const oSo = (ma) => `<button type="button" class="o-so ${NHOM[ma].stat}" data-action="locKlNhom" data-nhom="${ma}" aria-pressed="false">
  <b id="klSo-${ma}">0</b><span>${NHOM[ma].ten}</span></button>`;

export const klTemplate = `
  <div class="dau-trang">
    <h1>Kết luận BTVTU<small id="klPhuDe">Nhiệm vụ theo dõi Kết luận Ban Thường vụ Tỉnh ủy trong phạm vi của đồng chí</small></h1>
    <div class="kl-dau-phai">
      <span id="klTinhDen" class="chu-phu text-sm" aria-live="polite"></span>
      <span id="klKetNoi" class="ket-noi" role="status"></span>
      <button type="button" data-action="loadKl" class="btn btn-phu">Tải lại</button>
    </div>
  </div>

  <div id="klChipLoc" class="chip-loc hidden" role="status"></div>

  <div id="klStats" class="stats stats-kl">
    <button type="button" class="o-so" data-action="locKlNhom" data-nhom="" aria-pressed="true"><b id="klSo-TONG">0</b><span>Tổng</span></button>
    ${THU_TU_NHOM.map(oSo).join('')}
  </div>

  <div class="bang">
    <div class="bang-dau">
      <h2>Danh sách nhiệm vụ<span class="chu-phu" id="klSoDong"></span></h2>
      <div class="bo-loc">
        <select id="klLocHoiNghi" class="input input-nho" aria-label="Lọc theo hội nghị"><option value="">Mọi hội nghị</option></select>
        <select id="klLocNganh" class="input input-nho" aria-label="Lọc theo ngành"><option value="">Mọi ngành</option></select>
        <select id="klLocLinhVuc" class="input input-nho" aria-label="Lọc theo lĩnh vực"><option value="">Mọi lĩnh vực</option></select>
        <input type="search" id="klTimKiem" class="input input-nho" placeholder="Tìm theo mã NV, nội dung, chủ trì" aria-label="Tìm nhiệm vụ">
      </div>
    </div>
    <div class="bang-cuon">
      <table>
        <thead>
          <tr>
            <th>Mã · Hội nghị</th>
            <th>Nội dung · Cơ quan trình</th>
            <th>Chủ trì</th>
            <th>Hạn</th>
            <th>Trạng thái · Cập nhật</th>
            <th class="phai">Thao tác</th>
          </tr>
        </thead>
        <tbody id="klBody"><tr><td colspan="6" class="trong">Đang tải dữ liệu</td></tr></tbody>
      </table>
    </div>
  </div>
`;
