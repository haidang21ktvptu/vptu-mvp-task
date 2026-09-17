// Chuông thông báo trên dải (GĐ23, mẫu dhtn): biểu tượng trắng không nền tròn, huy hiệu đỏ số tin hệ thống chưa đọc ("9+" khi > 9) —
// chèn vào dải nhận diện trước cụm tên người dùng. Bảng thả xuống gom theo việc, nút "Đánh dấu đã đọc".
export const thongBaoTemplate = `
<div class="chuong">
  <button type="button" id="chuongBtn" class="nut-dai chuong-nut" data-action="toggleThongBao" aria-haspopup="dialog" aria-expanded="false" aria-controls="thongBaoPanel" aria-label="Thông báo">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>
    <i id="chuongBadge" class="hidden">0</i>
  </button>
  <div id="thongBaoPanel" class="tb-panel hidden" role="dialog" aria-label="Thông báo trên nhiệm vụ">
    <div class="tb-dau"><b>Thông báo trên nhiệm vụ</b>
      <button type="button" id="thongBaoDocHet" class="nut nho hidden" data-action="docHetThongBao">Đánh dấu đã đọc</button></div>
    <ul id="thongBaoList" class="tb-danh-sach"></ul>
  </div>
</div>
`;
