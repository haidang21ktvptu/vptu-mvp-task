// Markup màn hình cá nhân (bánh răng → Hồ sơ cá nhân / Thông báo) và trang Trợ giúp. Hồ sơ chỉ sửa được ảnh và điện thoại (cap_nhat_ho_so);
// tên, chức danh, phòng do quản trị hệ thống quản. Tuỳ chọn thông báo lưu ở accounts.tuy_chon (dat_tuy_chon).
export const caNhanTemplate = `
  <div class="dau"><h1>Cá nhân</h1><span>hồ sơ, tuỳ chọn thông báo</span></div>
  <div class="tab-hang" id="cnTabs" role="tablist">
    <button type="button" id="cnTabHoSo" role="tab" data-action="chonTabCaNhan" data-tab="hoSo" aria-selected="true">Hồ sơ cá nhân</button>
    <button type="button" id="cnTabThongBao" role="tab" data-action="chonTabCaNhan" data-tab="thongBao" aria-selected="false">Thông báo</button>
  </div>

  <div id="cnKhuHoSo" class="bang">
    <div class="bang-dau"><h2>Hồ sơ cá nhân<span class="chu-phu">tên, chức danh, phòng do quản trị hệ thống cập nhật</span></h2></div>
    <form id="cnHoSoForm" class="cn-ho-so" novalidate>
      <div class="cn-anh"><span id="cnAvatar" class="avatar avatar-lon" aria-hidden="true">?</span>
        <label class="nut nho" for="cnAnhFile">Đổi ảnh<input type="file" id="cnAnhFile" accept="image/jpeg,image/png,image/webp" class="hidden"></label>
        <small class="chu-phu">JPG/PNG/WebP, tối đa 2 MB</small></div>
      <dl class="cn-thong-tin">
        <dt>Họ và tên</dt><dd id="cnTen">--</dd>
        <dt>Chức danh</dt><dd id="cnChucDanh">--</dd>
        <dt>Phòng / đơn vị</dt><dd id="cnPhong">--</dd>
        <dt>Tên đăng nhập</dt><dd id="cnUsername">--</dd>
        <dt><label for="cnDienThoai">Điện thoại</label></dt><dd><input type="tel" id="cnDienThoai" class="o-nhap" placeholder="Ví dụ: 0912 345 678" maxlength="20"></dd>
      </dl>
      <div class="modal-chan"><button type="submit" id="cnLuuHoSo" class="nut chinh">Lưu thay đổi</button></div>
    </form>
  </div>

  <div id="cnKhuThongBao" class="bang hidden">
    <div class="bang-dau"><h2>Thông báo<span class="chu-phu">áp dụng cho tài khoản này trên mọi thiết bị</span></h2></div>
    <div class="cn-tuy-chon">
      <label class="cn-o"><input type="checkbox" id="cnAmChuong" data-khoa="am_chuong"><span><b>Âm chuông</b><small>Kêu một tiếng ngắn khi có thông báo mới trên nhiệm vụ.</small></span></label>
      <label class="cn-o"><input type="checkbox" id="cnGomTin" data-khoa="gom_tin"><span><b>Gom tin hệ thống thành bản tin 7h30</b><small>Không hiện từng thông báo rời; mỗi sáng 7h30 nhận một bản tóm tắt số thông báo chưa đọc. Chuông vẫn cập nhật số.</small></span></label>
    </div>
  </div>
`;

export const troGiupTemplate = `
  <div class="dau"><h1>Trợ giúp</h1><span>hướng dẫn ngắn theo vai trò của đồng chí</span></div>
  <div class="bang"><div id="tgNoiDung" class="tg-noi-dung"></div></div>
`;
