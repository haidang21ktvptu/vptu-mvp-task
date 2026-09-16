// Chuông thông báo (GĐ15) — chèn vào thanh trên trước ngày, mọi vai trò. Danh sách thả xuống, đóng khi bấm ngoài.
export const thongBaoTemplate = `
<div class="chuong">
  <button type="button" id="chuongBtn" class="btn btn-phu btn-nho chuong-nut" data-action="toggleThongBao" aria-haspopup="dialog" aria-expanded="false" aria-controls="thongBaoPanel" aria-label="Thông báo">
    Thông báo<span id="chuongBadge" class="huy-hieu hidden">0</span>
  </button>
  <div id="thongBaoPanel" class="tb-panel hidden" role="dialog" aria-label="Thông báo trên nhiệm vụ">
    <div class="tb-dau">
      <b>Thông báo trên nhiệm vụ</b>
      <button type="button" id="thongBaoDocHet" class="btn btn-phu btn-nho hidden" data-action="docHetThongBao">Đã đọc tất cả</button>
    </div>
    <ul id="thongBaoList" class="tb-danh-sach"></ul>
  </div>
</div>
`;
