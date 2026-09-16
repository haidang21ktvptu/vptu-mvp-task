// Modal cập nhật nhanh của người theo dõi / Owner (thiết kế 3.4, 6.8): đúng 7 cột guard 0015 cho phép. Nhãn trên ô nhập, một nút chính.
export const klCapNhatTemplate = `
<div id="klCapNhatModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="klCnTieuDe">
  <form class="modal modal-rong" data-submit="luuKlCapNhat" novalidate>
    <h2 id="klCnTieuDe" class="modal-tieu-de">Cập nhật nhiệm vụ</h2>
    <p id="klCnMoTa" class="chu-phu mt-1 mb-4"></p>
    <input type="hidden" id="klCnId">

    <div class="cot-2">
      <div>
        <label for="klCnTienDo" class="nhan">Tiến độ</label>
        <select id="klCnTienDo" class="input"></select>
      </div>
      <div>
        <label for="klCnHan" class="nhan">Hạn xử lý <span id="klCnHanLoai" class="chu-phu"></span></label>
        <input type="date" id="klCnHan" class="input">
        <small id="klCnHanGhiChu" class="chu-phu" aria-live="polite"></small>
      </div>
    </div>

    <div id="klCnChuaCoHanWrap" class="mt-3">
      <label class="nhan-checkbox"><input type="checkbox" id="klCnChuaCoHan"> Chưa xác định được hạn (phụ thuộc yếu tố bên ngoài)</label>
      <div id="klCnLyDoWrap" class="hidden">
        <label for="klCnLyDo" class="nhan">Lý do chưa có hạn (bắt buộc)</label>
        <textarea id="klCnLyDo" class="input" rows="2"></textarea>
      </div>
    </div>

    <div id="klCnHoanThanhWrap" class="hidden">
      <div class="cot-2 mt-3">
        <div>
          <label for="klCnNgayHT" class="nhan">Ngày hoàn thành thật (theo văn bản minh chứng)</label>
          <input type="date" id="klCnNgayHT" class="input">
        </div>
      </div>
    </div>

    <div class="mt-3" id="klCnMinhChungWrap">
      <label for="klCnMinhChung" class="nhan">Minh chứng dạng chữ <span class="chu-phu">dữ liệu cũ: số hiệu, ngày văn bản hoặc đường dẫn — bắt buộc khi Hoàn thành</span></label>
      <input type="text" id="klCnMinhChung" class="input" placeholder="Ví dụ: Báo cáo số 15/BC-VPTU ngày 5/9/2026">
    </div>
    <p id="klCnGhiChu1400" class="chu-phu mt-3 hidden">Nhiệm vụ theo quy tắc 1400: nộp minh chứng (số hiệu, ngày văn bản, cấp nhận) ở ngăn Chi tiết rồi bấm "Đóng nhiệm vụ" — không chuyển Hoàn thành ở đây.</p>
    <div class="cot-2 mt-3">
      <div>
        <label for="klCnVanBan" class="nhan">Văn bản triển khai</label>
        <input type="text" id="klCnVanBan" class="input">
      </div>
      <div>
        <label for="klCnGhiChu" class="nhan">Ghi chú</label>
        <input type="text" id="klCnGhiChu" class="input">
      </div>
    </div>

    <div class="modal-chan">
      <button type="button" data-action="closeKlCapNhat" class="btn btn-phu">Huỷ</button>
      <button type="submit" id="klCnLuu" class="btn btn-chinh">Lưu cập nhật</button>
    </div>
  </form>
</div>
`;
