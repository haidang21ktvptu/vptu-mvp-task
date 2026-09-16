// Modal giao việc thống nhất (GĐ14 PR 14C, SPEC v3 GV-2): văn bản → chịu trách nhiệm (Owner) → sản phẩm → ngày nhận →
// hạn → cấp nhận → ngành/lĩnh vực → người theo dõi. Nút hiện cho A1/A2/quan_tri_kl; quyền và 1-1-1 kiểm trong hàm giao_viec.
export const klThemTemplate = `
<div id="klThemModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="klThTieuDe">
  <form class="modal modal-rong" data-submit="luuKlThem" novalidate>
    <h2 id="klThTieuDe" class="modal-tieu-de mb-3">Giao việc</h2>

    <div class="cot-2">
      <div>
        <label for="klThVanBan" class="nhan">Văn bản giao việc</label>
        <select id="klThVanBan" class="input"></select>
      </div>
      <div id="klThVanBanMoi" class="hidden">
        <div class="cot-2">
          <div><label for="klThLoaiVB" class="nhan">Loại văn bản</label><select id="klThLoaiVB" class="input"></select></div>
          <div id="klThSoHNWrap"><label for="klThSoHN" class="nhan">Số hội nghị</label><input type="number" id="klThSoHN" class="input" min="1"></div>
        </div>
        <div class="cot-3 mt-2">
          <div><label for="klThSoKL" class="nhan">Số hiệu</label><input type="text" id="klThSoKL" class="input" placeholder="123-KL/TU"></div>
          <div><label for="klThNgayBH" class="nhan">Ngày ban hành</label><input type="date" id="klThNgayBH" class="input"></div>
          <div><label for="klThNgayNhanVB" class="nhan">Ngày nhận <span class="chu-phu">(nếu biết)</span></label><input type="date" id="klThNgayNhanVB" class="input"></div>
        </div>
      </div>
    </div>

    <div class="mt-3">
      <label for="klThNoiDung" class="nhan">Nội dung nhiệm vụ</label>
      <textarea id="klThNoiDung" class="input" rows="3"></textarea>
    </div>

    <div class="cot-2 mt-3">
      <div>
        <label for="klThOwner" class="nhan">Chịu trách nhiệm <span class="chu-phu">đơn vị / phòng / cán bộ — đúng một</span></label>
        <select id="klThOwner" class="input"></select>
      </div>
      <div>
        <label for="klThNguoiTheoDoi" class="nhan">Người theo dõi <span class="chu-phu">cán bộ Văn phòng giúp việc</span></label>
        <select id="klThNguoiTheoDoi" class="input"></select>
      </div>
    </div>

    <div class="cot-2 mt-3">
      <div>
        <label for="klThSanPham" class="nhan">Sản phẩm đầu ra</label>
        <select id="klThSanPham" class="input"></select>
      </div>
      <div>
        <label for="klThSanPhamMoTa" class="nhan">Mô tả sản phẩm <span class="chu-phu">ví dụ: Tờ trình đề án X</span></label>
        <input type="text" id="klThSanPhamMoTa" class="input">
      </div>
    </div>

    <div class="cot-3 mt-3">
      <div>
        <label for="klThNgayNhan" class="nhan">Ngày nhận văn bản <span class="chu-phu">mốc bắt đầu đếm</span></label>
        <input type="date" id="klThNgayNhan" class="input">
      </div>
      <div>
        <label for="klThLoai" class="nhan">Loại thời hạn</label>
        <select id="klThLoai" class="input"></select>
      </div>
      <div>
        <label for="klThHan" class="nhan">Hạn hoàn thành <span id="klThHanLoai" class="chu-phu"></span></label>
        <input type="date" id="klThHan" class="input">
        <small id="klThHanGhiChu" class="chu-phu" aria-live="polite"></small>
      </div>
    </div>

    <div class="cot-2 mt-3">
      <div>
        <label for="klThCapNhan" class="nhan">Cấp nhận sản phẩm <span class="chu-phu">mặc định = cấp trên Owner</span></label>
        <select id="klThCapNhan" class="input"></select>
      </div>
      <div>
        <label for="klThCapQD" class="nhan">Cấp cần quyết định <span class="chu-phu">để mở, điền khi việc Đỏ</span></label>
        <select id="klThCapQD" class="input"></select>
      </div>
    </div>

    <div class="cot-2 mt-3">
      <div>
        <label for="klThNganh" class="nhan">Ngành <span id="klThNganhGhiChu" class="chu-phu"></span></label>
        <select id="klThNganh" class="input"></select>
      </div>
      <div>
        <label for="klThLinhVuc" class="nhan">Lĩnh vực <span class="chu-phu">theo ngành đã chọn</span></label>
        <select id="klThLinhVuc" class="input"></select>
      </div>
    </div>

    <div class="cot-2 mt-3">
      <div><label for="klThVanBanTK" class="nhan">Văn bản triển khai</label><input type="text" id="klThVanBanTK" class="input"></div>
      <div><label for="klThGhiChu" class="nhan">Ghi chú / lĩnh vực chi tiết</label><input type="text" id="klThGhiChu" class="input"></div>
    </div>

    <div class="modal-chan">
      <button type="button" data-action="closeKlThem" class="btn btn-phu">Huỷ</button>
      <button type="button" data-action="luuKlThemTiep" class="btn btn-phu">Lưu, nhập tiếp</button>
      <button type="submit" id="klThLuu" class="btn btn-chinh">Giao việc</button>
    </div>
  </form>
</div>
`;
