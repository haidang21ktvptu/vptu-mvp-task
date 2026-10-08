// Modal cập nhật nhanh của người theo dõi / Owner (thiết kế 3.4, 6.8): đúng 7 cột guard 0015 cho phép. Nhãn trên ô nhập, một nút chính.
// Đợt C1 v3.19 (0086): việc theo 1400 có thêm mục "Nộp minh chứng nhanh" ngay trong hộp — số hiệu + ngày văn bản là đủ (cấp nhận lấy theo việc
// nếu để trống; trích yếu, mô tả kết quả không bắt buộc) — một nút Lưu ghi cả cập nhật lẫn minh chứng (nop_minh_chung là chốt).
export const klCapNhatTemplate = `
<div id="klCapNhatModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="klCnTieuDe">
  <form class="modal modal-rong" data-submit="luuKlCapNhat" novalidate>
    <h2 id="klCnTieuDe" class="modal-tieu-de">Cập nhật nhiệm vụ</h2>
    <p id="klCnMoTa" class="chu-phu mt-1 mb-4"></p>
    <input type="hidden" id="klCnId">

    <div class="cot-2">
      <div>
        <label for="klCnTienDo" class="nhan">Tiến độ</label>
        <select id="klCnTienDo" class="o-nhap"></select>
      </div>
      <div id="klCnHanWrap">
        <label for="klCnHan" class="nhan">Hạn xử lý <span id="klCnHanLoai" class="chu-phu"></span></label>
        <input type="date" id="klCnHan" class="o-nhap">
        <small id="klCnHanGhiChu" class="chu-phu" aria-live="polite"></small>
      </div>
      <p id="klCnHanKhoa" class="chu-phu hidden"></p>
    </div>

    <div id="klCnChuaCoHanWrap" class="mt-3">
      <label class="nhan-checkbox"><input type="checkbox" id="klCnChuaCoHan"> Chưa xác định được hạn (phụ thuộc yếu tố bên ngoài)</label>
      <div id="klCnLyDoWrap" class="hidden">
        <label for="klCnLyDo" class="nhan">Lý do chưa có hạn (bắt buộc)</label>
        <textarea id="klCnLyDo" class="o-nhap" rows="2"></textarea>
      </div>
    </div>

    <div id="klCnHoanThanhWrap" class="hidden">
      <div class="cot-2 mt-3">
        <div>
          <label for="klCnNgayHT" class="nhan">Ngày hoàn thành thật (theo văn bản minh chứng)</label>
          <input type="date" id="klCnNgayHT" class="o-nhap">
        </div>
      </div>
    </div>

    <div class="mt-3" id="klCnMinhChungWrap">
      <label for="klCnMinhChung" class="nhan">Minh chứng dạng chữ <span class="chu-phu">dữ liệu cũ: số hiệu, ngày văn bản hoặc đường dẫn — bắt buộc khi Hoàn thành</span></label>
      <input type="text" id="klCnMinhChung" class="o-nhap" placeholder="Ví dụ: Báo cáo số 15/BC-VPTU ngày 5/9/2026">
    </div>
    <p id="klCnGhiChu1400" class="chu-phu mt-3 hidden">Nhiệm vụ theo quy tắc 1400: hoàn thành khi lãnh đạo nghiệm thu minh chứng — không chuyển Hoàn thành ở đây.</p>
    <fieldset id="klCnMcWrap" class="khung-mc mt-3 hidden">
      <legend class="nhan">Nộp minh chứng nhanh <span class="chu-phu">— số hiệu + ngày văn bản là đủ; để trống cả hai = không nộp</span></legend>
      <div class="cot-3">
        <div><label for="klCnMcSoHieu" class="nhan">Số hiệu văn bản</label><input type="text" id="klCnMcSoHieu" class="o-nhap" placeholder="Ví dụ: 15/BC-VPTU" autocomplete="off"></div>
        <div><label for="klCnMcNgay" class="nhan">Ngày văn bản</label><input type="date" id="klCnMcNgay" class="o-nhap"></div>
        <div><label for="klCnMcCap" class="nhan">Cấp nhận <span class="chu-phu">mặc định theo việc</span></label><select id="klCnMcCap" class="o-nhap"></select></div>
      </div>
      <div class="cot-2 mt-2">
        <div><label for="klCnMcTrichYeu" class="nhan">Trích yếu <span class="chu-phu">không bắt buộc</span></label><input type="text" id="klCnMcTrichYeu" class="o-nhap" maxlength="300" autocomplete="off"></div>
        <div><label for="klCnMcMoTa" class="nhan">Mô tả kết quả <span class="chu-phu">không bắt buộc, ≤ 600 ký tự</span></label><input type="text" id="klCnMcMoTa" class="o-nhap" maxlength="600"></div>
      </div>
    </fieldset>
    <div class="cot-2 mt-3">
      <div>
        <label for="klCnVanBan" class="nhan">Văn bản triển khai</label>
        <input type="text" id="klCnVanBan" class="o-nhap">
      </div>
      <div>
        <label for="klCnGhiChu" class="nhan">Ghi chú</label>
        <input type="text" id="klCnGhiChu" class="o-nhap">
      </div>
    </div>
    <div class="mt-3">
      <label for="klCnVuongMac" class="nhan">Vướng mắc / đề nghị lãnh đạo quyết định <span class="chu-phu">không bắt buộc, tối đa 500 ký tự — để trống = đã giải quyết</span></label>
      <textarea id="klCnVuongMac" class="o-nhap" rows="2" maxlength="500" placeholder="Nêu vướng mắc, đề nghị cấp nào quyết định việc gì"></textarea>
    </div>
    <div class="cot-2 mt-3 hidden" id="klCnGiaoWrap">
      <div><label for="klCnNguon" class="nhan">Nguồn nhiệm vụ</label><select id="klCnNguon" class="o-nhap"></select></div>
      <div><label for="klCnPhoiHop" class="nhan">Đơn vị phối hợp <span class="chu-phu">cách nhau bằng dấu ;</span></label><input type="text" id="klCnPhoiHop" class="o-nhap" maxlength="300"></div>
    </div>

    <div class="modal-chan">
      <button type="button" data-action="closeKlCapNhat" class="nut">Huỷ</button>
      <button type="submit" id="klCnLuu" class="nut chinh">Lưu cập nhật</button>
    </div>
  </form>
</div>
`;
