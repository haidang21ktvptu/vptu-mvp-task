// Markup màn hình "Quản trị" (mockup: mục riêng, chỉ hiện khi có cờ; phân công phụ trách lên đầu vì thiếu phân công là lý do một tài khoản
// PCVP thấy 0 nhiệm vụ). Tab: Phân công phụ trách · Tài khoản và cờ · Danh mục lĩnh vực · Nhật ký. Khu hệ thống chỉ với quan_tri_he_thong,
// khu danh mục với quan_tri_kl; mọi thao tác gọi hàm SQL admin_* hoặc đi qua RLS (frontend chỉ ẩn/hiện, không phải nơi chặn).
import { quanTriDanhMucTemplate, quanTriNhatKyDanhMucTemplate } from './template-linh-vuc.js';
import { quanTriHeThongTemplate } from './template-he-thong.js';

export const quanTriTemplate = `
  <div class="dau"><h1>Quản trị</h1><span>phân công lãnh đạo phụ trách phòng và lĩnh vực, cấp quyền quản trị nhiệm vụ, danh mục, nhật ký</span>
    <div class="phai-dau"><button type="button" data-action="loadQuanTri" class="nut nho">Tải lại</button></div></div>
  <div id="qtCanhBao" class="luong-canh-bao hidden" role="status"></div>
  <div class="tab-hang" id="qtTabs" role="tablist">
    <button type="button" id="qtTabPhuTrach" role="tab" data-action="chonTabQuanTri" data-tab="qtKhuPhuTrach" aria-selected="true">Phân công phụ trách</button>
    <button type="button" id="qtTabTaiKhoan" role="tab" data-action="chonTabQuanTri" data-tab="qtKhuTaiKhoan" aria-selected="false">Tài khoản và cờ</button>
    <button type="button" id="qtTabDanhMuc" role="tab" data-action="chonTabQuanTri" data-tab="qtKhuDanhMuc" aria-selected="false">Danh mục lĩnh vực</button>
    <button type="button" id="qtTabCauHinh" role="tab" data-action="chonTabQuanTri" data-tab="qtKhuCauHinh" aria-selected="false">Ngưỡng cảnh báo</button>
    <button type="button" id="qtTabUyQuyen" role="tab" data-action="chonTabQuanTri" data-tab="qtKhuUyQuyen" aria-selected="false">Ủy quyền giao việc</button>
    <button type="button" id="qtTabNhatKy" role="tab" data-action="chonTabQuanTri" data-tab="qtKhuNhatKy" aria-selected="false">Nhật ký cấp quyền</button>
    <button type="button" id="qtTabDonDuLieu" role="tab" data-action="chonTabQuanTri" data-tab="qtKhuDonDuLieu" aria-selected="false">Dọn dữ liệu</button>
    <button type="button" id="qtTabNhatKyHeThong" role="tab" data-action="chonTabQuanTri" data-tab="qtKhuNhatKyHeThong" aria-selected="false">Nhật ký hệ thống</button>
  </div>

  <div id="qtKhuPhuTrach" class="qt-khu">
    <div class="bang">
      <div class="bang-dau"><h2>Phó Chánh Văn phòng phụ trách phòng, kiêm nhiệm lĩnh vực<span class="chu-phu">hiệu lực theo ngày, giữ lịch sử; tối đa 2 phòng "cả phòng" mỗi người</span></h2></div>
      <div class="bang-cuon"><table id="qtPhuTrachTable"><thead><tr id="qtPhuTrachHead"><th>Lãnh đạo</th></tr></thead><tbody id="qtPhuTrachBody"><tr><td class="trong">Đang tải dữ liệu</td></tr></tbody></table></div>
    </div>
  </div>

  <div id="qtKhuTaiKhoan" class="qt-khu hidden">
    <div class="bang">
      <div class="bang-dau"><h2>Tài khoản và cờ đặc quyền<span class="chu-phu" id="qtSoNguoiKl"></span></h2>
        <div class="bo-loc"><input type="search" id="qtTimTaiKhoan" class="o-nhap nho" placeholder="Tìm theo họ tên, tài khoản" aria-label="Tìm tài khoản">
          <button type="button" class="nut nho chinh" data-action="moTaoTaiKhoan">Tạo tài khoản</button></div></div>
      <div class="bang-cuon"><table>
        <thead><tr><th>Cán bộ</th><th>Phòng</th><th>Vai trò</th><th>Quản trị KL BTVTU</th><th>Hệ thống</th><th class="phai">Thao tác</th></tr></thead>
        <tbody id="qtTaiKhoanBody"><tr><td colspan="6" class="trong">Đang tải dữ liệu</td></tr></tbody></table></div>
    </div>
  </div>

  <div id="qtKhuDanhMuc" class="qt-khu hidden">${quanTriDanhMucTemplate}</div>

  <div id="qtKhuNhatKy" class="qt-khu hidden">
    <div class="bang" id="qtKhuNhatKyQuyen">
      <div class="bang-dau"><h2>Nhật ký cấp quyền<span class="chu-phu">50 dòng gần nhất, không xoá được</span></h2></div>
      <div class="bang-cuon"><table>
        <thead><tr><th>Lúc</th><th>Người thực hiện</th><th>Tài khoản</th><th>Quyền</th><th>Bật/Tắt</th><th>Lý do</th></tr></thead>
        <tbody id="qtNhatKyBody"><tr><td colspan="6" class="trong">Đang tải dữ liệu</td></tr></tbody></table></div>
    </div>
    <div id="qtKhuNhatKyDanhMuc">${quanTriNhatKyDanhMucTemplate}</div>
  </div>
  ${quanTriHeThongTemplate}
`;

// Hộp xác nhận bắt gõ lý do (dùng chung cho cấp/thu cờ và phân công phụ trách).
export const quanTriLyDoModalTemplate = `
<div id="qtLyDoModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="qtLyDoTitle">
  <form id="qtLyDoForm" class="modal" data-submit="confirmQtLyDo" novalidate>
    <h2 id="qtLyDoTitle" class="modal-tieu-de">Xác nhận</h2>
    <p id="qtLyDoMoTa" class="chu-phu" style="margin-top:6px"></p>
    <div id="qtNgayWrap" class="hidden">
      <label for="qtNgay" class="nhan">Ngày hiệu lực</label>
      <input type="date" id="qtNgay" class="o-nhap">
    </div>
    <label for="qtLyDo" class="nhan">Lý do (bắt buộc, ghi vào nhật ký)</label>
    <input type="text" id="qtLyDo" class="o-nhap" placeholder="Ví dụ: Quyết định số .../QĐ-VPTU ngày ...">
    <div class="modal-chan">
      <button type="button" data-action="closeQtLyDo" class="nut">Huỷ</button>
      <button type="submit" id="qtLyDoXacNhan" class="nut chinh">Xác nhận</button>
    </div>
  </form>
</div>
`;
