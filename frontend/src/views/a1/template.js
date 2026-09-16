// Markup tầng A1 (Lãnh đạo Văn phòng) theo DESIGN mục 4 — GĐ14 chỉ còn cây phân cấp (DASH-2) đọc v_nhiem_vu;
// Tổng quan và danh sách nhiệm vụ là section dùng chung (viewKlDashboard, viewKl).
export const a1Template = `
  <div id="tabContentA1Staffs">
    <div class="dau-trang">
      <h1><span id="a1TreeHeaderTitle">Cán bộ thuộc quyền</span><small id="a1TreeHeaderDesc">Số đánh giá tính theo việc cán bộ là Owner (chịu trách nhiệm); việc chỉ theo dõi ghi riêng, không cộng vào</small></h1>
      <button type="button" data-action="switchA1Tab" class="btn btn-phu shrink-0">Tải lại</button>
    </div>
    <div id="a1TreeContainer" class="space-y-3">
      <p class="chu-phu text-center py-6">Đang dựng cây phân cấp</p>
    </div>
  </div>
`;
