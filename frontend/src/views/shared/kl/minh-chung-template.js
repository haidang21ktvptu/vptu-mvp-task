// Hai hộp của GĐ16 (MC-3, MC-4): "Nộp minh chứng" có cấu trúc (v8 đợt 4: số hiệu, ngày, cấp nhận + trích yếu + mô tả kết quả ≤ 600 ký tự) và "Đóng nhiệm vụ"
// (ngày hoàn thành gợi ý = ngày văn bản của minh chứng hợp lệ mới nhất, sửa được). Không có ô tệp (CH-6 = B, chờ kinh phí).
export const klMinhChungTemplate = `
<div id="klMcModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="klMcTieuDe">
  <form class="modal" data-submit="luuMinhChung" novalidate>
    <h2 id="klMcTieuDe" class="modal-tieu-de">Nộp minh chứng</h2>
    <p id="klMcMoTa" class="chu-phu mt-1 mb-4"></p>
    <input type="hidden" id="klMcId">
    <div>
      <label for="klMcSoHieu" class="nhan">Số hiệu văn bản</label>
      <input type="text" id="klMcSoHieu" class="o-nhap" placeholder="Ví dụ: 15/BC-VPTU" autocomplete="off">
    </div>
    <div class="cot-2 mt-3">
      <div>
        <label for="klMcNgay" class="nhan">Ngày văn bản</label>
        <input type="date" id="klMcNgay" class="o-nhap">
      </div>
      <div>
        <label for="klMcCap" class="nhan">Cấp nhận</label>
        <select id="klMcCap" class="o-nhap"></select>
      </div>
    </div>
    <div class="mt-3">
      <label for="klMcTrichYeu" class="nhan">Trích yếu văn bản</label>
      <input type="text" id="klMcTrichYeu" class="o-nhap" placeholder="Ví dụ: Báo cáo kết quả rà soát quy hoạch cán bộ năm 2026" autocomplete="off" maxlength="300">
    </div>
    <div class="mt-3">
      <label for="klMcMoTaKq" class="nhan">Mô tả kết quả <span class="chu-phu">khoảng 100 chữ: đã làm gì, kết quả, gửi ai</span></label>
      <textarea id="klMcMoTaKq" class="o-nhap" rows="4" maxlength="600" placeholder="Đã làm gì, kết quả ra sao, đã gửi tới ai…"></textarea>
      <p class="chu-phu mt-1"><span id="klMcDem">0</span>/600 ký tự</p>
    </div>
    <p class="chu-phu mt-3">Cả năm ô đều bắt buộc; văn bản tra được trên V-Office theo số hiệu. Tệp đính kèm chưa nhận (chờ điều kiện kinh phí).</p>
    <div class="modal-chan">
      <button type="button" data-action="closeMinhChung" class="nut">Huỷ</button>
      <button type="submit" id="klMcLuu" class="nut chinh">Nộp minh chứng</button>
    </div>
  </form>
</div>
<div id="klDongModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="klDongTieuDe">
  <form class="modal" data-submit="luuDongNhiemVu" novalidate>
    <h2 id="klDongTieuDe" class="modal-tieu-de">Đóng nhiệm vụ</h2>
    <p id="klDongMoTa" class="chu-phu mt-1 mb-4"></p>
    <input type="hidden" id="klDongId">
    <label for="klDongNgay" class="nhan">Ngày hoàn thành <span class="chu-phu">gợi ý = ngày văn bản của minh chứng hợp lệ mới nhất, sửa được</span></label>
    <input type="date" id="klDongNgay" class="o-nhap">
    <p id="klDongGhiChu" class="chu-phu mt-2"></p>
    <div class="modal-chan">
      <button type="button" data-action="closeDongNhiemVu" class="nut">Huỷ</button>
      <button type="submit" id="klDongLuu" class="nut chinh">Đóng nhiệm vụ</button>
    </div>
  </form>
</div>
`;
