// Markup màn hình "Quản trị hệ thống" (GĐ8, thiết kế KL BTVTU Phần 5.2, 5.4) — chỉ hiện với tài khoản
// có quan_tri_he_thong; mọi thao tác gọi hàm SQL admin_* (frontend chỉ ẩn/hiện, không phải nơi chặn).
export const quanTriTemplate = `
  <div class="dau-trang">
    <h1>Quản trị hệ thống<small>Cấp quyền quản trị Kết luận BTVTU và phân công lãnh đạo phụ trách phòng</small></h1>
    <button type="button" data-action="loadQuanTri" class="btn btn-phu shrink-0">Tải lại</button>
  </div>

  <div id="qtCanhBao" class="luong-canh-bao mb-4 hidden" role="status"></div>

  <div class="bang mb-6">
    <div class="bang-dau">
      <h2>Tài khoản và cờ đặc quyền<span class="chu-phu" id="qtSoNguoiKl"></span></h2>
      <div class="bo-loc">
        <input type="search" id="qtTimTaiKhoan" class="input input-nho" placeholder="Tìm theo họ tên, tài khoản" aria-label="Tìm tài khoản">
      </div>
    </div>
    <div class="bang-cuon">
      <table>
        <thead>
          <tr>
            <th>Cán bộ</th>
            <th>Phòng</th>
            <th>Vai trò</th>
            <th>Quản trị KL BTVTU</th>
            <th>Quản trị hệ thống</th>
            <th class="phai">Thao tác</th>
          </tr>
        </thead>
        <tbody id="qtTaiKhoanBody"><tr><td colspan="6" class="trong">Đang tải dữ liệu</td></tr></tbody>
      </table>
    </div>
  </div>

  <div class="bang mb-6">
    <div class="bang-dau">
      <h2>Phó Chánh Văn phòng phụ trách phòng<span class="chu-phu">hiệu lực theo ngày, giữ lịch sử</span></h2>
    </div>
    <div class="bang-cuon">
      <table id="qtPhuTrachTable">
        <thead><tr id="qtPhuTrachHead"><th>Lãnh đạo</th></tr></thead>
        <tbody id="qtPhuTrachBody"><tr><td class="trong">Đang tải dữ liệu</td></tr></tbody>
      </table>
    </div>
  </div>

  <div class="bang">
    <div class="bang-dau">
      <h2>Nhật ký cấp quyền<span class="chu-phu">50 dòng gần nhất, không xoá được</span></h2>
    </div>
    <div class="bang-cuon">
      <table>
        <thead>
          <tr>
            <th>Lúc</th>
            <th>Người thực hiện</th>
            <th>Tài khoản</th>
            <th>Quyền</th>
            <th>Bật/Tắt</th>
            <th>Lý do</th>
          </tr>
        </thead>
        <tbody id="qtNhatKyBody"><tr><td colspan="6" class="trong">Đang tải dữ liệu</td></tr></tbody>
      </table>
    </div>
  </div>
`;

// Hộp xác nhận bắt gõ lý do (dùng chung cho cấp/thu cờ và phân công phụ trách).
export const quanTriLyDoModalTemplate = `
<div id="qtLyDoModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="qtLyDoTitle">
  <form id="qtLyDoForm" class="modal" data-submit="confirmQtLyDo" novalidate>
    <h2 id="qtLyDoTitle" class="modal-tieu-de mb-2">Xác nhận</h2>
    <p id="qtLyDoMoTa" class="mb-4 text-sm"></p>
    <div id="qtNgayWrap" class="hidden">
      <label for="qtNgay" class="nhan">Ngày hiệu lực</label>
      <input type="date" id="qtNgay" class="input mb-4">
    </div>
    <label for="qtLyDo" class="nhan">Lý do (bắt buộc, ghi vào nhật ký)</label>
    <input type="text" id="qtLyDo" class="input" placeholder="Ví dụ: Quyết định số .../QĐ-VPTU ngày ...">
    <div class="modal-chan">
      <button type="button" data-action="closeQtLyDo" class="btn btn-phu">Huỷ</button>
      <button type="submit" id="qtLyDoXacNhan" class="btn btn-chinh">Xác nhận</button>
    </div>
  </form>
</div>
`;
