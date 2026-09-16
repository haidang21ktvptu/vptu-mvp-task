// Markup tầng A2 (Trưởng phòng) — GĐ14 chỉ còn "Cán bộ trong phòng" (KPI từng người từ v_nhiem_vu, DASH-3);
// danh sách và giao việc dùng section chung viewKl.
export const a2Template = `
  <div id="tabContentKPI">
    <div class="dau-trang">
      <h1>Cán bộ trong phòng<small>Số đánh giá tính theo việc cán bộ là Owner; việc chỉ theo dõi ghi riêng. Bấm "Chi tiết việc" để mở nhiệm vụ ngay dưới</small></h1>
      <button type="button" data-action="renderKPITab" class="btn btn-phu shrink-0">Làm mới</button>
    </div>
    <div class="bang">
      <div class="bang-cuon">
        <table>
          <thead>
            <tr>
              <th>Cán bộ</th>
              <th class="so">Owner</th>
              <th class="so">Đang mở</th>
              <th class="so">Quá hạn</th>
              <th class="so">Đỏ đặc biệt</th>
              <th class="so">Hoàn thành</th>
              <th class="so">Đang theo dõi</th>
              <th class="phai">Thao tác</th>
            </tr>
          </thead>
          <tbody id="a2KpiTableBody">
            <tr><td colspan="8" class="trong">Đang tổng hợp dữ liệu</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
`;
