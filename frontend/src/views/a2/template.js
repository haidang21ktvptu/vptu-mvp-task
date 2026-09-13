// Markup tầng A2 (Trưởng phòng), lấy nguyên từ index.html cũ; onclick inline → data-action.
export const a2Template = `
  <div class="flex border-b border-slate-200 gap-2">
    <button id="tabBtnGiaoViec" data-action="switchA2Tab" data-tab="giaoViec" class="py-2.5 px-4 text-xs font-bold border-b-2 border-red-800 text-red-800 focus:outline-none flex items-center gap-1.5">
      <span>📝</span> Tab 1: Giao Nhiệm Vụ Trong Phòng
    </button>
    <button id="tabBtnTheoDoi" data-action="switchA2Tab" data-tab="theoDoi" class="py-2.5 px-4 text-xs font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-700 focus:outline-none flex items-center gap-1.5">
      <span>📊</span> Tab 2: Theo Dõi & Duyệt Minh Chứng
    </button>
    <button id="tabBtnKPI" data-action="switchA2Tab" data-tab="kpi" class="py-2.5 px-4 text-xs font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-700 focus:outline-none flex items-center gap-1.5">
      <span>🏆</span> Tab 3: Theo Dõi KPI Cán Bộ Trong Phòng
    </button>
  </div>

  <!-- TAB 1: TRƯỞNG PHÒNG GIAO VIỆC -->
  <div id="tabContentGiaoViec" class="bg-white p-6 rounded-lg shadow-sm border max-w-2xl">
    <h3 class="text-xs font-bold text-slate-900 uppercase border-b pb-2 mb-4" id="a2GiaoViecTitle">Giao Việc Cho Cán Bộ Trong Phòng</h3>
    <form id="formGiaoViec" data-submit="handleA2GiaoViec" class="space-y-3.5 text-xs">
      <div>
        <label class="font-semibold text-slate-700">Nội dung nhiệm vụ *</label>
        <textarea id="taskTitle" required rows="2" class="w-full border rounded p-2.5 mt-1 focus:outline-none focus:ring-1 focus:ring-red-600" placeholder="Nhập tên nhiệm vụ..."></textarea>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="font-semibold text-slate-700">Số / Ký hiệu văn bản *</label>
          <input type="text" id="taskResCode" required class="w-full border rounded p-2 mt-1" placeholder="VD: NQ 57-NQ/TW">
        </div>
        <div>
          <label class="font-semibold text-slate-700">Cán bộ thực hiện trong phòng *</label>
          <select id="taskAssignSelect" required class="w-full border rounded p-2 mt-1 bg-white"></select>
        </div>
      </div>
      <div>
        <label class="font-semibold text-slate-700">01 Sản phẩm đầu ra bắt buộc *</label>
        <input type="text" id="taskProduct" required class="w-full border rounded p-2 mt-1" placeholder="VD: Dự thảo Tờ trình, Báo cáo...">
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="font-semibold text-slate-700">Mốc nhận V-Office (T=0) *</label>
          <input type="datetime-local" id="taskVOfficeDate" required class="w-full border rounded p-2 mt-1">
        </div>
        <div>
          <label class="font-semibold text-slate-700">Hạn hoàn thành (Deadline) *</label>
          <input type="datetime-local" id="taskDeadline" required class="w-full border rounded p-2 mt-1">
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="font-semibold text-slate-700">Kích hoạt ĐỎ ĐẶC BIỆT (ngày trễ) *</label>
          <input type="number" id="taskCriticalDays" min="1" max="30" required value="3" class="w-full border rounded p-2 mt-1">
        </div>
        <div>
          <label class="font-semibold text-slate-700">Cấp có thẩm quyền tháo gỡ *</label>
          <input type="text" id="taskAuthority" required class="w-full border rounded p-2 mt-1" value="Lãnh đạo Văn phòng">
        </div>
      </div>
      <button type="submit" class="w-full bg-red-800 hover:bg-red-900 text-white font-bold py-2.5 rounded shadow mt-2">Phát Hành Giao Việc</button>
    </form>
  </div>

  <!-- TAB 2: THEO DÕI TIẾP NHẬN & DUYỆT -->
  <div id="tabContentTheoDoi" class="hidden space-y-6">
    <div class="bg-white p-5 rounded-lg shadow-sm border space-y-3">
      <div class="flex justify-between items-center border-b pb-2">
        <h3 class="text-xs font-bold text-slate-900 uppercase">Tình Trạng Nhận Việc Của Cán Bộ</h3>
        <input type="text" id="ldvpTrackSearch" placeholder="🔍 Tìm nhanh..." class="border rounded px-2 py-1 text-xs w-48 focus:outline-none">
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 text-slate-600">
              <th class="p-2.5 border-b">Nhiệm vụ</th>
              <th class="p-2.5 border-b">Cán bộ nhận việc</th>
              <th class="p-2.5 border-b text-center">Trạng thái</th>
              <th class="p-2.5 border-b text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody id="trackingTableBody" class="divide-y divide-slate-200">
            <tr><td colspan="4" class="p-3 text-center text-slate-400">Đang tải dữ liệu...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="bg-white p-5 rounded-lg shadow-sm border space-y-3">
      <h3 class="text-xs font-bold text-slate-900 uppercase border-b pb-2">Hồ Sơ Chờ Thẩm Tra Để Đóng Việc</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 text-slate-600">
              <th class="p-2.5 border-b">Nhiệm vụ</th>
              <th class="p-2.5 border-b">Cán bộ nộp</th>
              <th class="p-2.5 border-b">Minh chứng sản phẩm</th>
              <th class="p-2.5 border-b text-center">Xử lý</th>
            </tr>
          </thead>
          <tbody id="approvalTableBody" class="divide-y divide-slate-200">
            <tr><td colspan="4" class="p-3 text-center text-slate-400">Không có hồ sơ nào chờ duyệt.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- TAB 3: THEO DÕI KPI NỘI BỘ PHÒNG (ACCORDION ROW TRỰC TIẾP) -->
  <div id="tabContentKPI" class="hidden space-y-6">
    <div class="bg-white p-5 rounded-lg shadow-sm border space-y-4">
      <div class="flex justify-between items-center border-b pb-3">
        <div>
          <h3 class="text-xs font-bold text-slate-900 uppercase" id="kpiSectionTitle">Bảng Tổng Hợp KPI Tiến Độ Phòng</h3>
          <p class="text-[11px] text-slate-500">Nhấp "Chi tiết việc" để mở xem nhiệm vụ ngay sát bên dưới cán bộ đó</p>
        </div>
        <button data-action="renderKPITab" class="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded font-semibold">Làm mới KPI</button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 text-slate-700 uppercase">
              <th class="p-3 border-b">Cán bộ</th>
              <th class="p-3 border-b text-center">Tổng nhận</th>
              <th class="p-3 border-b text-center text-green-700">Trong hạn</th>
              <th class="p-3 border-b text-center text-amber-600">Gần hạn (≤ 3 ngày)</th>
              <th class="p-3 border-b text-center text-red-600 font-bold">Quá hạn</th>
              <th class="p-3 border-b text-center">Đang làm</th>
              <th class="p-3 border-b text-center text-blue-700 font-bold">Đã hoàn thành</th>
              <th class="p-3 border-b text-center">Hành động</th>
            </tr>
          </thead>
          <tbody id="a2KpiTableBody" class="divide-y divide-slate-200">
            <tr><td colspan="8" class="p-4 text-center text-slate-400">Đang tổng hợp dữ liệu KPI...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
`;
