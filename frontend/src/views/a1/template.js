// Markup tầng A1 (Lãnh đạo Văn phòng) theo DESIGN mục 4; chuyển mục bằng thanh bên (views/a1/index.js).
export const a1Template = `
  <!-- BẢNG ĐIỀU KHIỂN NGOẠI LỆ (DASH-1) -->
  <div id="tabContentA1Dashboard">
    <div class="dau-trang">
      <h1>Bảng điều khiển ngoại lệ<small>Nhiệm vụ chậm tiến độ hoặc bị từ chối, cần lãnh đạo quan tâm hôm nay</small></h1>
      <div class="flex gap-2 shrink-0">
        <button type="button" data-action="loadA1Dashboard" class="btn btn-phu an-dien-thoai">Làm mới</button>
        <button type="button" data-action="toggleA1GiaoViec" class="btn btn-chinh">Giao việc</button>
      </div>
    </div>

    <!-- FORM LÃNH ĐẠO VĂN PHÒNG GIAO VIỆC (TASK-1/2) -->
    <section id="a1GiaoViecBox" class="the hidden p-5 mb-5" aria-labelledby="a1GiaoViecTitle">
      <h2 id="a1GiaoViecTitle" class="mb-4">Lãnh đạo Văn phòng giao việc</h2>
      <form data-submit="handleA1GiaoViec" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
        <div class="md:col-span-2">
          <label for="a1Title" class="nhan">Nội dung nhiệm vụ</label>
          <input type="text" id="a1Title" required class="input">
        </div>
        <div>
          <label for="a1ResCode" class="nhan">Số, ký hiệu văn bản</label>
          <input type="text" id="a1ResCode" required class="input" placeholder="Ví dụ: 57-NQ/TW">
        </div>
        <div>
          <label for="a1AssignMode" class="nhan">Phương thức phân công</label>
          <select id="a1AssignMode" class="input">
            <option value="TO_LEADER">Giao cho Trưởng phòng</option>
            <option value="TO_STAFF">Giao trực tiếp cho cán bộ</option>
          </select>
        </div>
        <div id="a1LeaderSelectDiv">
          <label for="a1LeaderSelect" class="nhan">Trưởng phòng phụ trách</label>
          <select id="a1LeaderSelect" class="input"></select>
        </div>
        <div id="a1StaffSelectDiv" class="hidden">
          <label for="a1StaffSelect" class="nhan">Cán bộ thực hiện</label>
          <select id="a1StaffSelect" class="input"></select>
        </div>
        <div>
          <label for="a1Product" class="nhan">Sản phẩm đầu ra bắt buộc</label>
          <input type="text" id="a1Product" required class="input" placeholder="Ví dụ: Báo cáo tham mưu, Tờ trình">
        </div>
        <div>
          <label for="a1Deadline" class="nhan">Hạn hoàn thành</label>
          <input type="datetime-local" id="a1Deadline" required class="input">
        </div>
        <div>
          <label for="a1CriticalDays" class="nhan">Số ngày trễ kích hoạt đỏ đặc biệt</label>
          <input type="number" id="a1CriticalDays" min="1" value="3" required class="input">
        </div>
        <div class="md:col-span-2 lg:col-span-3 modal-chan">
          <button type="button" data-action="toggleA1GiaoViec" class="btn btn-phu">Đóng</button>
          <button type="submit" class="btn btn-chinh">Phát hành chỉ đạo</button>
        </div>
      </form>
    </section>

    <!-- THANH SỐ LIỆU: MỘT HÀNG CÓ KẺ DỌC -->
    <div class="stats">
      <div><b id="kpiTotal">0</b><span>Nhiệm vụ đang theo dõi</span></div>
      <div class="s-dodb"><b id="kpiSpecialRed">0</b><span>Đỏ đặc biệt</span></div>
      <div class="s-do"><b id="kpiRed">0</b><span>Quá hạn</span></div>
      <div class="s-vang"><b id="kpiYellow">0</b><span>Gần đến hạn (3 ngày)</span></div>
    </div>

    <!-- BẢNG NGOẠI LỆ -->
    <div class="bang">
      <div class="bang-dau">
        <h2>Nhiệm vụ cần xử lý<span id="a1FilterCount" class="chu-phu"></span></h2>
        <div class="bo-loc">
          <input type="search" id="a1SearchInput" class="input input-nho" placeholder="Tìm theo tên việc, số văn bản, người thực hiện" aria-label="Tìm nhiệm vụ">
          <select id="a1FilterAlert" class="input input-nho" aria-label="Lọc theo mức cảnh báo">
            <option value="ALL">Mọi mức cảnh báo</option>
            <option value="DO_DAC_BIET">Đỏ đặc biệt</option>
            <option value="DO">Quá hạn</option>
            <option value="VANG">Gần đến hạn</option>
            <option value="TU_CHOI">Từ chối tiếp nhận</option>
            <option value="CHUA_GIAO">Chưa phân công</option>
            <option value="XANH">Trong hạn</option>
          </select>
          <select id="a1FilterDept" class="input input-nho" aria-label="Lọc theo phòng">
            <option value="ALL">Mọi phòng</option>
            <option value="TONG_HOP">Phòng Tổng hợp</option>
            <option value="HC_LT">Phòng Hành chính - Lưu trữ</option>
            <option value="CDS_CY">Phòng Chuyển đổi số - Cơ yếu</option>
            <option value="TAI_CHINH_DANG">Phòng Tài chính Đảng</option>
            <option value="QUAN_TRI">Phòng Quản trị</option>
          </select>
        </div>
      </div>
      <div class="bang-cuon">
        <table>
          <thead>
            <tr>
              <th>Nhiệm vụ</th>
              <th>Người thực hiện</th>
              <th>Lãnh đạo phụ trách</th>
              <th>Hạn</th>
              <th>Sản phẩm</th>
              <th>Mức</th>
              <th class="phai">Thao tác</th>
            </tr>
          </thead>
          <tbody id="exceptionTableBody">
            <tr><td colspan="7" class="trong">Đang tải dữ liệu</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- CÂY PHÂN CẤP (DASH-2): CVP → PCVP → Trưởng phòng → Cán bộ, mở chi tiết inline -->
  <div id="tabContentA1Staffs" class="hidden">
    <div class="dau-trang">
      <h1><span id="a1TreeHeaderTitle">Cán bộ thuộc quyền</span><small id="a1TreeHeaderDesc">Bấm vào từng cấp để mở danh sách và nhiệm vụ</small></h1>
      <button type="button" data-action="loadA1StaffsTab" class="btn btn-phu shrink-0">Tải lại</button>
    </div>
    <div id="a1TreeContainer" class="space-y-3">
      <p class="chu-phu text-center py-6">Đang dựng cây phân cấp</p>
    </div>
  </div>
`;
