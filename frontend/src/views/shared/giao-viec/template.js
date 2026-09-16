// Giao việc ba bước trên một trang (mockup, giữ đúng biểu mẫu 1-1-1): Bước 1 Việc gì (văn bản giao việc, nội dung) → Bước 2 Ai làm (Owner,
// người theo dõi) → Bước 3 Khi nào, sản phẩm gì (loại hạn, hạn, ngày nhận, sản phẩm, cấp nhận, cấp quyết định, ngành/lĩnh vực, ghi chú);
// nút Giao luôn thấy ở cuối (sticky); điện thoại cuộn một cột. id ô giữ tiền tố klTh* như form cũ. Quyền và 1-1-1 kiểm trong hàm giao_viec.
export const giaoViecTemplate = `
  <div class="dau"><h1>Giao việc</h1><span>một việc = một đơn vị chịu trách nhiệm, một sản phẩm, một hạn; hệ thống tự điền ngày nhận, cấp nhận, người theo dõi — sửa được</span></div>
  <form id="giaoViecForm" data-submit="luuKlThem" novalidate>
    <section class="buoc" id="gvBuoc1"><h2><i>1</i> Việc gì</h2>
      <label for="klThVanBan" class="nhan">Văn bản giao việc</label>
      <select id="klThVanBan" class="o-nhap"></select>
      <div id="klThVanBanMoi" class="hidden">
        <div class="cot-2">
          <div><label for="klThLoaiVB" class="nhan">Loại văn bản</label><select id="klThLoaiVB" class="o-nhap"></select></div>
          <div id="klThSoHNWrap"><label for="klThSoHN" class="nhan">Số hội nghị</label><input type="number" id="klThSoHN" class="o-nhap" min="1"></div>
        </div>
        <div class="cot-3">
          <div><label for="klThSoKL" class="nhan">Số hiệu</label><input type="text" id="klThSoKL" class="o-nhap" placeholder="123-KL/TU"></div>
          <div><label for="klThNgayBH" class="nhan">Ngày ban hành</label><input type="date" id="klThNgayBH" class="o-nhap"></div>
          <div><label for="klThNgayNhanVB" class="nhan">Ngày nhận (nếu biết)</label><input type="date" id="klThNgayNhanVB" class="o-nhap"></div>
        </div>
      </div>
      <label for="klThNoiDung" class="nhan">Nội dung nhiệm vụ</label>
      <textarea id="klThNoiDung" class="o-nhap" rows="3"></textarea>
    </section>

    <section class="buoc" id="gvBuoc2"><h2><i>2</i> Ai làm</h2>
      <div class="cot-2">
        <div><label for="klThOwner" class="nhan">Chịu trách nhiệm (Owner) — đơn vị / phòng / cán bộ, đúng một</label><select id="klThOwner" class="o-nhap"></select></div>
        <div><label for="klThNguoiTheoDoi" class="nhan">Người theo dõi — cán bộ Văn phòng giúp việc</label><select id="klThNguoiTheoDoi" class="o-nhap"></select></div>
      </div>
      <p class="chu-phu" style="margin-top:10px">Cân tải: xem bức tranh tải việc ở mục Cán bộ trước khi chọn người.</p>
    </section>

    <section class="buoc" id="gvBuoc3"><h2><i>3</i> Khi nào, sản phẩm gì</h2>
      <div class="cot-3">
        <div><label for="klThNgayNhan" class="nhan">Ngày nhận văn bản — mốc bắt đầu đếm</label><input type="date" id="klThNgayNhan" class="o-nhap"></div>
        <div><label for="klThLoai" class="nhan">Loại thời hạn</label><select id="klThLoai" class="o-nhap"></select></div>
        <div><label for="klThHan" class="nhan">Hạn hoàn thành <span id="klThHanLoai" class="chu-phu"></span></label><input type="date" id="klThHan" class="o-nhap"><small id="klThHanGhiChu" class="chu-phu" aria-live="polite"></small></div>
      </div>
      <div class="cot-2">
        <div><label for="klThSanPham" class="nhan">Sản phẩm đầu ra</label><select id="klThSanPham" class="o-nhap"></select></div>
        <div><label for="klThSanPhamMoTa" class="nhan">Mô tả sản phẩm — ví dụ: Tờ trình đề án X</label><input type="text" id="klThSanPhamMoTa" class="o-nhap"></div>
      </div>
      <div class="cot-2">
        <div><label for="klThCapNhan" class="nhan">Cấp nhận sản phẩm — mặc định = cấp trên Owner</label><select id="klThCapNhan" class="o-nhap"></select></div>
        <div><label for="klThCapQD" class="nhan">Cấp cần quyết định — để mở, điền khi việc Đỏ</label><select id="klThCapQD" class="o-nhap"></select></div>
      </div>
      <div class="cot-2">
        <div><label for="klThNganh" class="nhan">Ngành <span id="klThNganhGhiChu" class="chu-phu"></span></label><select id="klThNganh" class="o-nhap"></select></div>
        <div><label for="klThLinhVuc" class="nhan">Lĩnh vực — theo ngành đã chọn</label><select id="klThLinhVuc" class="o-nhap"></select></div>
      </div>
      <div class="cot-2">
        <div><label for="klThVanBanTK" class="nhan">Văn bản triển khai</label><input type="text" id="klThVanBanTK" class="o-nhap"></div>
        <div><label for="klThGhiChu" class="nhan">Ghi chú / lĩnh vực chi tiết</label><input type="text" id="klThGhiChu" class="o-nhap"></div>
      </div>
    </section>

    <div class="buoc-chan">
      <button type="button" data-action="huyKlThem" class="nut">Huỷ</button>
      <button type="button" data-action="luuKlThemTiep" class="nut">Giao, nhập tiếp việc khác</button>
      <button type="submit" id="klThLuu" class="nut chinh">Giao việc</button>
    </div>
  </form>
`;
