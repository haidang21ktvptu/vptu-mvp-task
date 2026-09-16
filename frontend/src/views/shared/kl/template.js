// Markup màn hình "Nhiệm vụ" (GĐ10 PR 10B, thiết kế 3.4; GĐ14 đổi nhãn + cột Owner/Sản phẩm): thanh số liệu theo nhóm trạng
// thái (mỗi ô là nút lọc), bộ lọc, bảng nhiệm vụ trong phạm vi RLS, dấu "Số liệu tính đến". Dùng chung A3 (việc mình là Owner
// hoặc theo dõi), A2 (phòng), A1 (danh sách truy vết từ dashboard). Không có nút chỉ đạo (GĐ18).
import { THU_TU_NHOM, NHOM } from '../../../lib/kl/nhan.js';

const oSo = (ma) => `<button type="button" class="o-so ${NHOM[ma].stat}" data-action="locKlNhom" data-nhom="${ma}" aria-pressed="false">
  <b id="klSo-${ma}">0</b><span>${NHOM[ma].ten}</span></button>`;

export const klTemplate = `
  <div class="dau-trang">
    <h1>Nhiệm vụ<small id="klPhuDe">Nhiệm vụ theo văn bản giao việc trong phạm vi của đồng chí — mỗi việc một đơn vị chịu trách nhiệm, một sản phẩm, một hạn</small></h1>
    <div class="kl-dau-phai">
      <span id="klTinhDen" class="chu-phu text-sm" aria-live="polite"></span>
      <span id="klKetNoi" class="ket-noi" role="status"></span>
      <button type="button" data-action="loadKl" class="btn btn-phu">Tải lại</button>
      <button type="button" id="klNutThem" data-action="openKlThem" class="btn btn-chinh hidden">Giao việc</button>
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
        <input type="search" id="klTimKiem" class="input input-nho" placeholder="Tìm theo mã, nội dung, người chịu trách nhiệm, người theo dõi" aria-label="Tìm nhiệm vụ">
      </div>
    </div>
    <div class="bang-cuon">
      <table>
        <thead>
          <tr>
            <th>Mã · Văn bản</th>
            <th>Nội dung · Sản phẩm</th>
            <th>Chịu trách nhiệm</th>
            <th>Người theo dõi</th>
            <th>Hạn</th>
            <th>Cảnh báo · Trạng thái</th>
            <th class="phai">Thao tác</th>
          </tr>
        </thead>
        <tbody id="klBody"><tr><td colspan="7" class="trong">Đang tải dữ liệu</td></tr></tbody>
      </table>
    </div>
  </div>
`;
