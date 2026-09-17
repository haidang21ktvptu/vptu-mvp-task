// Markup các khu quản trị GĐ23: Ngưỡng cảnh báo (kl_cau_hinh), Ủy quyền giao việc (A2), Dọn dữ liệu (hai bước), Nhật ký hệ thống, hộp tạo tài khoản
// và hộp hiện mật khẩu tạm (một lần). Quyền thật ở hàm SQL / Edge Function; ở đây chỉ ẩn/hiện.
export const quanTriHeThongTemplate = `
  <div id="qtKhuCauHinh" class="qt-khu hidden">
    <div class="bang">
      <div class="bang-dau"><h2>Ngưỡng cảnh báo<span class="chu-phu">Chánh Văn phòng sửa, có lý do; Phó Chánh Văn phòng xem</span></h2></div>
      <div class="bang-cuon"><table>
        <thead><tr><th>Khoá</th><th>Ý nghĩa</th><th>Giá trị (ngày)</th><th>Lý do thay đổi</th><th class="phai">Thao tác</th></tr></thead>
        <tbody id="qtCauHinhBody"><tr><td colspan="5" class="trong">Đang tải dữ liệu</td></tr></tbody></table></div>
    </div>
  </div>

  <div id="qtKhuUyQuyen" class="qt-khu hidden">
    <div class="bang">
      <div class="bang-dau"><h2>Ủy quyền giao việc<span class="chu-phu">cấp quyền nhập/sửa nhiệm vụ có hạn (tối đa 90 ngày) cho một chuyên viên trong phòng</span></h2></div>
      <form id="qtUyQuyenForm" class="qt-form" novalidate>
        <label>Chuyên viên<select id="qtUqNguoi" class="o-nhap"></select></label>
        <label>Đến ngày<input type="date" id="qtUqDenNgay" class="o-nhap" required></label>
        <label class="rong">Lý do<input type="text" id="qtUqLyDo" class="o-nhap" placeholder="Ví dụ: Trưởng phòng đi công tác 20–25/9" required></label>
        <button type="submit" class="nut chinh">Ủy quyền</button>
      </form>
      <div class="bang-cuon"><table>
        <thead><tr><th>Chuyên viên</th><th>Hiệu lực đến</th><th class="phai">Thao tác</th></tr></thead>
        <tbody id="qtUyQuyenBody"><tr><td colspan="3" class="trong">Chưa ủy quyền cho ai.</td></tr></tbody></table></div>
    </div>
  </div>

  <div id="qtKhuDonDuLieu" class="qt-khu hidden">
    <div class="bang">
      <div class="bang-dau"><h2>Dọn dữ liệu<span class="chu-phu">bước 1 xem trước số dòng sẽ mất → bước 2 gõ XOÁ; cần backup trong 24 giờ</span></h2></div>
      <div id="qtDonBackup" class="luong-canh-bao" role="status"></div>
      <form id="qtDonForm" class="qt-form" novalidate>
        <label>Loại dữ liệu<select id="qtDonLoai" class="o-nhap">
          <option value="du_lieu_thu">Bộ sẵn: dữ liệu thử (NV-T*, E2E-*, tài khoản demo_* và mọi thứ liên quan)</option>
          <option value="tin_nhan">Tin nhắn và thông báo</option>
          <option value="chi_dao_canh_bao_lich_su">Chỉ đạo, cảnh báo, lịch sử</option>
          <option value="minh_chung">Minh chứng</option>
          <option value="nhiem_vu">Nhiệm vụ (kéo theo mọi thứ gắn với việc)</option>
          <option value="tat_ca">Tất cả (nhiệm vụ, văn bản, tin, chỉ đạo…)</option></select></label>
        <label>Phạm vi<select id="qtDonPhamVi" class="o-nhap">
          <option value="tai_khoan">Theo tài khoản</option><option value="van_ban_id">Theo văn bản giao việc</option>
          <option value="ngay">Theo khoảng ngày tạo</option><option value="toan_bo">Toàn bộ</option></select></label>
        <label id="qtDonTkWrap">Tài khoản<select id="qtDonTaiKhoan" class="o-nhap"></select></label>
        <label id="qtDonVbWrap" class="hidden">Văn bản<select id="qtDonVanBan" class="o-nhap"></select></label>
        <label id="qtDonTuWrap" class="hidden">Từ ngày<input type="date" id="qtDonTuNgay" class="o-nhap"></label>
        <label id="qtDonDenWrap" class="hidden">Đến ngày<input type="date" id="qtDonDenNgay" class="o-nhap"></label>
        <button type="submit" id="qtDonXemTruoc" class="nut">Xem trước</button>
      </form>
      <div id="qtDonKetQua" class="hidden">
        <div class="bang-cuon"><table><thead><tr><th>Bảng</th><th class="phai">Số dòng sẽ xoá</th></tr></thead><tbody id="qtDonBody"></tbody></table></div>
        <form id="qtDonXoaForm" class="qt-form" novalidate>
          <label class="rong">Gõ chữ <b>XOÁ</b> để xác nhận<input type="text" id="qtDonXacNhan" class="o-nhap" autocomplete="off" placeholder="XOÁ"></label>
          <button type="submit" id="qtDonXoa" class="nut nguy-hiem" disabled>Xoá vĩnh viễn</button>
        </form>
      </div>
    </div>
  </div>

  <div id="qtKhuNhatKyHeThong" class="qt-khu hidden">
    <div class="bang">
      <div class="bang-dau"><h2>Nhật ký hệ thống<span class="chu-phu">100 dòng gần nhất: tài khoản, cấu hình, dọn dữ liệu, backup</span></h2></div>
      <div class="bang-cuon"><table>
        <thead><tr><th>Lúc</th><th>Người</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
        <tbody id="qtNhatKyHeThongBody"><tr><td colspan="5" class="trong">Đang tải dữ liệu</td></tr></tbody></table></div>
    </div>
  </div>
`;

export const quanTriTaiKhoanModalTemplate = `
<div id="qtTkModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="qtTkTitle">
  <form id="qtTkForm" class="modal" data-submit="taoTaiKhoan" novalidate>
    <h2 id="qtTkTitle" class="modal-tieu-de">Tạo tài khoản</h2>
    <p class="chu-phu" style="margin-top:6px">Mật khẩu tạm sinh tự động, hiện MỘT lần sau khi tạo; người dùng phải đổi khi đăng nhập lần đầu.</p>
    <label class="nhan" for="qtTkUsername">Tên đăng nhập (chữ thường, số, gạch dưới)</label><input type="text" id="qtTkUsername" class="o-nhap" autocapitalize="none" spellcheck="false">
    <label class="nhan" for="qtTkHoTen">Họ và tên</label><input type="text" id="qtTkHoTen" class="o-nhap">
    <label class="nhan" for="qtTkChucDanh">Chức danh</label><input type="text" id="qtTkChucDanh" class="o-nhap" placeholder="Chuyên viên / Trưởng phòng / Phó Chánh Văn phòng…">
    <label class="nhan" for="qtTkVai">Vai trò</label><select id="qtTkVai" class="o-nhap"><option value="A3">Chuyên viên (A3)</option><option value="A2">Trưởng phòng (A2)</option><option value="A1">Lãnh đạo Văn phòng (A1)</option><option value="A0">Thường trực Tỉnh ủy (A0)</option></select>
    <label class="nhan" for="qtTkPhong">Phòng</label><select id="qtTkPhong" class="o-nhap"></select>
    <label class="nhan" for="qtTkQuanLy">Quản lý trực tiếp</label><select id="qtTkQuanLy" class="o-nhap"><option value="">— không —</option></select>
    <label class="cn-o" style="margin-top:10px"><input type="checkbox" id="qtTkChief"><span><b>Là Chánh Văn phòng</b><small>chỉ với vai A1</small></span></label>
    <div id="qtTkError" class="loi-inline hidden" role="alert"></div>
    <div class="modal-chan"><button type="button" class="nut" data-action="dongTaoTaiKhoan">Huỷ</button><button type="submit" id="qtTkTao" class="nut chinh">Tạo tài khoản</button></div>
  </form>
</div>
<div id="qtMkModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="qtMkTitle">
  <div class="modal modal-bat-buoc">
    <h2 id="qtMkTitle" class="modal-tieu-de">Mật khẩu tạm</h2>
    <p id="qtMkMoTa" class="chu-phu" style="margin-top:6px"></p>
    <p class="mk-tam"><code id="qtMkGiaTri"></code><button type="button" class="nut nho" data-action="saoChepMatKhauTam">Sao chép</button></p>
    <p class="chu-phu">Chỉ hiện một lần. Gửi cho cán bộ qua kênh an toàn; hệ thống bắt đổi mật khẩu khi đăng nhập lần đầu.</p>
    <div class="modal-chan"><button type="button" class="nut chinh" data-action="dongMatKhauTam">Đã ghi lại, đóng</button></div>
  </div>
</div>
`;
