// Chuông thông báo trên dải (GĐ23, mẫu dhtn): biểu tượng trắng không nền tròn, huy hiệu số tin CẦN ĐỒNG CHÍ XỬ LÝ chưa đọc ("9+" khi > 9) —
// chèn vào dải nhận diện trước cụm tên người dùng. Bảng thả xuống: hai thẻ theo mức tin (v3.36, 0142) "Cần đồng chí xử lý" / "Để biết", mỗi thẻ
// gom theo việc; nút "Đánh dấu đã đọc" áp cho thẻ đang mở. Thẻ theo mẫu tab của WAI-ARIA: phím mũi tên / Home / End chuyển thẻ; số chưa đọc đọc qua
// aria-label của thẻ (huy hiệu số aria-hidden); danh sách nằm trong khung tabpanel để giữ vai trò danh sách.
export const thongBaoTemplate = `
<div class="chuong">
  <button type="button" id="chuongBtn" class="nut-dai chuong-nut" data-action="toggleThongBao" aria-haspopup="dialog" aria-expanded="false" aria-controls="thongBaoPanel" aria-label="Thông báo">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>
    <i id="chuongBadge" class="hidden">0</i>
  </button>
  <div id="thongBaoPanel" class="tb-panel hidden" role="dialog" aria-label="Thông báo trên nhiệm vụ">
    <div class="tb-dau"><b>Thông báo trên nhiệm vụ</b>
      <button type="button" id="thongBaoDocHet" class="nut nho hidden" data-action="docHetThongBao">Đánh dấu đã đọc</button></div>
    <div class="tb-the" role="tablist" aria-label="Mức thông báo">
      <button type="button" id="tbTheXuLy" role="tab" data-action="chonTheThongBao" data-muc="XU_LY" aria-selected="true" aria-controls="thongBaoBang" tabindex="0">Cần đồng chí xử lý<b id="tbSoXuLy" class="hidden" aria-hidden="true"></b></button>
      <button type="button" id="tbTheBiet" role="tab" data-action="chonTheThongBao" data-muc="BIET" aria-selected="false" aria-controls="thongBaoBang" tabindex="-1">Để biết<b id="tbSoBiet" class="hidden" aria-hidden="true"></b></button>
    </div>
    <div id="thongBaoBang" role="tabpanel" aria-labelledby="tbTheXuLy"><ul id="thongBaoList" class="tb-danh-sach"></ul></div>
  </div>
</div>
`;
