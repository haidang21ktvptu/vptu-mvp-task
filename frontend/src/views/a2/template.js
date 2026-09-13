// Markup tầng A2 (Trưởng phòng) theo DESIGN mục 4; chuyển mục bằng thanh bên (views/a2/index.js).
export const a2Template = `
  <!-- GIAO VIỆC TRONG PHÒNG (TASK-1/2) -->
  <div id="tabContentGiaoViec" class="hidden">
    <div class="dau-trang">
      <h1>Giao việc<small>Giao nhiệm vụ cho cán bộ trong phòng, mỗi việc một sản phẩm đầu ra</small></h1>
    </div>
    <section class="the p-5 max-w-2xl">
      <form id="formGiaoViec" data-submit="handleA2GiaoViec" class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        <div class="sm:col-span-2">
          <label for="taskTitle" class="nhan">Nội dung nhiệm vụ</label>
          <textarea id="taskTitle" required rows="2" class="input"></textarea>
        </div>
        <div>
          <label for="taskResCode" class="nhan">Số, ký hiệu văn bản</label>
          <input type="text" id="taskResCode" required class="input" placeholder="Ví dụ: 57-NQ/TW">
        </div>
        <div>
          <label for="taskAssignSelect" class="nhan">Cán bộ thực hiện</label>
          <select id="taskAssignSelect" required class="input"></select>
        </div>
        <div class="sm:col-span-2">
          <label for="taskProduct" class="nhan">Sản phẩm đầu ra bắt buộc</label>
          <input type="text" id="taskProduct" required class="input" placeholder="Ví dụ: Dự thảo Tờ trình, Báo cáo">
        </div>
        <div>
          <label for="taskVOfficeDate" class="nhan">Mốc nhận văn bản trên V-Office</label>
          <input type="datetime-local" id="taskVOfficeDate" required class="input">
        </div>
        <div>
          <label for="taskDeadline" class="nhan">Hạn hoàn thành</label>
          <input type="datetime-local" id="taskDeadline" required class="input">
        </div>
        <div>
          <label for="taskCriticalDays" class="nhan">Số ngày trễ kích hoạt đỏ đặc biệt</label>
          <input type="number" id="taskCriticalDays" min="1" max="30" required value="3" class="input">
        </div>
        <div>
          <label for="taskAuthority" class="nhan">Cấp có thẩm quyền tháo gỡ</label>
          <input type="text" id="taskAuthority" required class="input" value="Lãnh đạo Văn phòng">
        </div>
        <div class="sm:col-span-2 modal-chan">
          <button type="submit" class="btn btn-chinh">Phát hành giao việc</button>
        </div>
      </form>
    </section>
  </div>

  <!-- THEO DÕI TIẾP NHẬN VÀ DUYỆT MINH CHỨNG (TASK-6/7, DASH-3) -->
  <div id="tabContentTheoDoi" class="hidden space-y-5">
    <div class="dau-trang">
      <h1>Theo dõi và duyệt<small>Tình trạng nhận việc của cán bộ trong phòng và hồ sơ chờ duyệt</small></h1>
    </div>
    <div class="bang">
      <div class="bang-dau">
        <h2>Tình trạng nhận việc</h2>
        <div class="bo-loc">
          <input type="search" id="ldvpTrackSearch" class="input input-nho" placeholder="Tìm theo tên việc, số văn bản, cán bộ" aria-label="Tìm nhiệm vụ">
        </div>
      </div>
      <div class="bang-cuon">
        <table>
          <thead>
            <tr>
              <th>Nhiệm vụ</th>
              <th>Cán bộ nhận việc</th>
              <th>Trạng thái</th>
              <th class="phai">Thao tác</th>
            </tr>
          </thead>
          <tbody id="trackingTableBody">
            <tr><td colspan="4" class="trong">Đang tải dữ liệu</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="bang">
      <div class="bang-dau"><h2>Hồ sơ chờ duyệt hoàn thành</h2></div>
      <div class="bang-cuon">
        <table>
          <thead>
            <tr>
              <th>Nhiệm vụ</th>
              <th>Cán bộ nộp</th>
              <th>Minh chứng</th>
              <th class="phai">Thao tác</th>
            </tr>
          </thead>
          <tbody id="approvalTableBody">
            <tr><td colspan="4" class="trong">Không có hồ sơ nào chờ duyệt.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- CÁN BỘ TRONG PHÒNG: KPI TỪNG NGƯỜI, MỞ CHI TIẾT INLINE (DASH-3) -->
  <div id="tabContentKPI" class="hidden">
    <div class="dau-trang">
      <h1>Cán bộ trong phòng<small>Tiến độ từng người; bấm "Chi tiết việc" để mở nhiệm vụ ngay dưới</small></h1>
      <button type="button" data-action="renderKPITab" class="btn btn-phu shrink-0">Làm mới</button>
    </div>
    <div class="bang">
      <div class="bang-cuon">
        <table>
          <thead>
            <tr>
              <th>Cán bộ</th>
              <th class="so">Tổng nhận</th>
              <th class="so">Trong hạn</th>
              <th class="so">Gần hạn (3 ngày)</th>
              <th class="so">Quá hạn</th>
              <th class="so">Đang làm</th>
              <th class="so">Đã hoàn thành</th>
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
