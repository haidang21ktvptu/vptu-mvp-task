// Chuông thông báo (mockup: nút tròn trên dải, huy hiệu vàng) — chèn vào dải nhận diện trước tên người dùng. Bảng thả xuống gom theo việc.
export const thongBaoTemplate = `
<div class="chuong">
  <button type="button" id="chuongBtn" class="chuong-nut" data-action="toggleThongBao" aria-haspopup="dialog" aria-expanded="false" aria-controls="thongBaoPanel" aria-label="Thông báo">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>
    <i id="chuongBadge" class="hidden">0</i>
  </button>
  <div id="thongBaoPanel" class="tb-panel hidden" role="dialog" aria-label="Thông báo trên nhiệm vụ">
    <div class="tb-dau"><b>Thông báo trên nhiệm vụ</b>
      <button type="button" id="thongBaoDocHet" class="nut nho hidden" data-action="docHetThongBao">Đã đọc tất cả</button></div>
    <ul id="thongBaoList" class="tb-danh-sach"></ul>
  </div>
</div>
`;
