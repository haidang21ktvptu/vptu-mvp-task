// Modal thêm nhiệm vụ KL mới (GĐ10 PR 10F; thiết kế 5.4 "form nhập nhiệm vụ mới", 6.8): chỉ người có quan_tri_kl
// (policy INSERT 0016 là chốt). Chọn hội nghị có sẵn hoặc tạo hội nghị mới; ngành → lĩnh vực khoá theo ngành, bắt buộc.
export const klThemTemplate = `
<div id="klThemModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="klThTieuDe">
  <form class="modal modal-rong" data-submit="luuKlThem" novalidate>
    <h2 id="klThTieuDe" class="modal-tieu-de mb-3">Thêm nhiệm vụ Kết luận BTVTU</h2>

    <div class="cot-2">
      <div>
        <label for="klThHoiNghi" class="nhan">Hội nghị / văn bản kết luận</label>
        <select id="klThHoiNghi" class="input"></select>
      </div>
      <div id="klThHoiNghiMoi" class="hidden">
        <div class="cot-3">
          <div><label for="klThSoHN" class="nhan">Số hội nghị</label><input type="number" id="klThSoHN" class="input" min="1"></div>
          <div><label for="klThSoKL" class="nhan">Số kết luận</label><input type="text" id="klThSoKL" class="input" placeholder="123-KL/TU"></div>
          <div><label for="klThNgayBH" class="nhan">Ngày ban hành</label><input type="date" id="klThNgayBH" class="input"></div>
        </div>
      </div>
    </div>

    <div class="mt-3">
      <label for="klThNoiDung" class="nhan">Nội dung nhiệm vụ</label>
      <textarea id="klThNoiDung" class="input" rows="3"></textarea>
    </div>

    <div class="cot-2 mt-3">
      <div>
        <label for="klThChuTri" class="nhan">Chủ trì theo dõi</label>
        <select id="klThChuTri" class="input"></select>
      </div>
      <div>
        <label for="klThCoQuan" class="nhan">Cơ quan trình</label>
        <select id="klThCoQuan" class="input"></select>
      </div>
    </div>

    <div class="cot-2 mt-3">
      <div>
        <label for="klThNganh" class="nhan">Ngành</label>
        <select id="klThNganh" class="input"></select>
      </div>
      <div>
        <label for="klThLinhVuc" class="nhan">Lĩnh vực <span class="chu-phu">theo ngành đã chọn</span></label>
        <select id="klThLinhVuc" class="input"></select>
      </div>
    </div>

    <div class="cot-2 mt-3">
      <div>
        <label for="klThLoai" class="nhan">Loại thời hạn</label>
        <select id="klThLoai" class="input"></select>
      </div>
      <div>
        <label for="klThHan" class="nhan">Hạn xử lý <span id="klThHanLoai" class="chu-phu"></span></label>
        <input type="date" id="klThHan" class="input">
        <small id="klThHanGhiChu" class="chu-phu" aria-live="polite"></small>
      </div>
    </div>
    <div id="klThChuaCoHanWrap" class="mt-3 hidden">
      <label class="nhan-checkbox"><input type="checkbox" id="klThChuaCoHan"> Chưa xác định được hạn (phụ thuộc yếu tố bên ngoài)</label>
      <div id="klThLyDoWrap" class="hidden">
        <label for="klThLyDo" class="nhan">Lý do chưa có hạn (bắt buộc)</label>
        <textarea id="klThLyDo" class="input" rows="2"></textarea>
      </div>
    </div>

    <div class="cot-2 mt-3">
      <div><label for="klThVanBan" class="nhan">Văn bản triển khai</label><input type="text" id="klThVanBan" class="input"></div>
      <div><label for="klThGhiChu" class="nhan">Ghi chú / lĩnh vực chi tiết</label><input type="text" id="klThGhiChu" class="input"></div>
    </div>

    <div class="modal-chan">
      <button type="button" data-action="closeKlThem" class="btn btn-phu">Huỷ</button>
      <button type="button" data-action="luuKlThemTiep" class="btn btn-phu">Lưu, nhập tiếp</button>
      <button type="submit" id="klThLuu" class="btn btn-chinh">Lưu</button>
    </div>
  </form>
</div>
`;
