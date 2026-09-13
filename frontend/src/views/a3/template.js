// Markup tầng A3 (Chuyên viên) theo DESIGN mục 4: thanh số liệu một hàng, bảng việc của tôi.
export const a3Template = `
  <div class="dau-trang">
    <h1>Nhiệm vụ của tôi<small>Việc quá hạn và gần đến hạn xếp lên đầu</small></h1>
    <button type="button" data-action="loadChuyenVienData" class="btn btn-phu shrink-0">Tải lại</button>
  </div>

  <div id="cvStatsBar" class="stats">
    <div><b id="cvStatTotal">0</b><span>Tổng nhiệm vụ</span></div>
    <div class="s-do"><b id="cvStatOverdue">0</b><span>Quá hạn</span></div>
    <div class="s-vang"><b id="cvStatWarning">0</b><span>Gần đến hạn (3 ngày)</span></div>
    <div class="s-xanh"><b id="cvStatCompleted">0</b><span>Đã hoàn thành</span></div>
  </div>

  <div class="bang">
    <div class="bang-dau">
      <h2>Danh sách nhiệm vụ</h2>
      <div class="bo-loc">
        <input type="search" id="cvTaskSearch" class="input input-nho" placeholder="Tìm theo tên việc, số văn bản" aria-label="Tìm nhiệm vụ">
      </div>
    </div>
    <div class="bang-cuon">
      <table>
        <thead>
          <tr>
            <th>Nhiệm vụ</th>
            <th>Lãnh đạo phụ trách</th>
            <th>Sản phẩm</th>
            <th>Hạn</th>
            <th>Trạng thái</th>
            <th class="phai">Thao tác</th>
          </tr>
        </thead>
        <tbody id="chuyenVienTableBody">
          <tr><td colspan="6" class="trong">Đang tải dữ liệu</td></tr>
        </tbody>
      </table>
    </div>
  </div>
`;
