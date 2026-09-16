// Hai hộp của GĐ16 (MC-3, MC-4): "Nộp minh chứng" có cấu trúc (ba ô bắt buộc, thay ô chữ tự do) và "Đóng nhiệm vụ"
// (ngày hoàn thành gợi ý = ngày văn bản của minh chứng hợp lệ mới nhất, sửa được). Không có ô tệp (CH-6 = B, chờ kinh phí).
export const klMinhChungTemplate = `
<div id="klMcModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="klMcTieuDe">
  <form class="modal" data-submit="luuMinhChung" novalidate>
    <h2 id="klMcTieuDe" class="modal-tieu-de">Nộp minh chứng</h2>
    <p id="klMcMoTa" class="chu-phu mt-1 mb-4"></p>
    <input type="hidden" id="klMcId">
    <div>
      <label for="klMcSoHieu" class="nhan">Số hiệu văn bản</label>
      <input type="text" id="klMcSoHieu" class="input" placeholder="Ví dụ: 15/BC-VPTU" autocomplete="off">
    </div>
    <div class="cot-2 mt-3">
      <div>
        <label for="klMcNgay" class="nhan">Ngày văn bản</label>
        <input type="date" id="klMcNgay" class="input">
      </div>
      <div>
        <label for="klMcCap" class="nhan">Cấp nhận</label>
        <select id="klMcCap" class="input"></select>
      </div>
    </div>
    <p class="chu-phu mt-3">Ba ô đều bắt buộc; văn bản tra được trên V-Office theo số hiệu. Tệp đính kèm chưa nhận (chờ điều kiện kinh phí).</p>
    <div class="modal-chan">
      <button type="button" data-action="closeMinhChung" class="btn btn-phu">Huỷ</button>
      <button type="submit" id="klMcLuu" class="btn btn-chinh">Nộp minh chứng</button>
    </div>
  </form>
</div>
<div id="klDongModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="klDongTieuDe">
  <form class="modal" data-submit="luuDongNhiemVu" novalidate>
    <h2 id="klDongTieuDe" class="modal-tieu-de">Đóng nhiệm vụ</h2>
    <p id="klDongMoTa" class="chu-phu mt-1 mb-4"></p>
    <input type="hidden" id="klDongId">
    <label for="klDongNgay" class="nhan">Ngày hoàn thành <span class="chu-phu">gợi ý = ngày văn bản của minh chứng hợp lệ mới nhất, sửa được</span></label>
    <input type="date" id="klDongNgay" class="input">
    <p id="klDongGhiChu" class="chu-phu mt-2"></p>
    <div class="modal-chan">
      <button type="button" data-action="closeDongNhiemVu" class="btn btn-phu">Huỷ</button>
      <button type="submit" id="klDongLuu" class="btn btn-chinh">Đóng nhiệm vụ</button>
    </div>
  </form>
</div>
`;
