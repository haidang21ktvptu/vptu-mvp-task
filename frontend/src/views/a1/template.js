// Markup tầng A1 (Lãnh đạo Văn phòng), lấy nguyên từ index.html cũ; onclick inline → data-action.
export const a1Template = `
  <div class="flex border-b border-slate-200 gap-2">
    <button id="tabBtnA1Dashboard" data-action="switchA1Tab" data-tab="dashboard" class="py-2.5 px-4 text-xs font-bold border-b-2 border-red-800 text-red-800 focus:outline-none flex items-center gap-1.5">
      <span>📊</span> Tab 1: Dashboard Quản Trị Ngoại Lệ & Điểm Nghẽn
    </button>
    <button id="tabBtnA1Staffs" data-action="switchA1Tab" data-tab="staffs" class="py-2.5 px-4 text-xs font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-700 focus:outline-none flex items-center gap-1.5">
      <span>👥</span> Tab 2: Giám Sát Cây Phân Cấp Trực Thuộc
    </button>
  </div>

  <!-- NỘI DUNG TAB 1: DASHBOARD NGOẠI LỆ -->
  <div id="tabContentA1Dashboard" class="space-y-6">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center pb-1 gap-3">
      <div>
        <h2 class="text-sm md:text-base font-bold text-slate-900 uppercase">Tình Hình Điểm Nghẽn & Chỉ Đạo Tháo Gỡ</h2>
        <p class="text-xs text-slate-500">Tự động nhận diện nhiệm vụ chậm tiến độ hoặc từ chối tiếp nhận</p>
      </div>
      <div class="flex gap-2">
        <button data-action="toggleA1GiaoViec" class="text-xs bg-red-800 hover:bg-red-900 text-white font-semibold px-3 py-1.5 rounded shadow">+ Giao Việc Mới</button>
        <button data-action="loadA1Dashboard" class="text-xs bg-slate-200 hover:bg-slate-300 font-semibold px-3 py-1.5 rounded">Làm mới</button>
      </div>
    </div>

    <!-- FORM LÃNH ĐẠO VP GIAO VIỆC MỚI -->
    <div id="a1GiaoViecBox" class="hidden bg-white p-5 rounded-lg shadow border border-red-200">
      <h3 class="text-xs font-bold text-red-800 uppercase mb-3 border-b pb-2">Lãnh Đạo Văn Phòng Giao Việc Mới</h3>
      <form data-submit="handleA1GiaoViec" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
        <div class="md:col-span-2">
          <label class="font-semibold">Nội dung nhiệm vụ *</label>
          <input type="text" id="a1Title" required class="w-full border rounded p-2 mt-1" placeholder="Nhiệm vụ cần thực hiện...">
        </div>
        <div>
          <label class="font-semibold">Số / Ký hiệu Nghị quyết/Văn bản *</label>
          <input type="text" id="a1ResCode" required class="w-full border rounded p-2 mt-1" placeholder="VD: NQ 57-NQ/TW">
        </div>
        <div>
          <label class="font-semibold">Phương thức phân công *</label>
          <select id="a1AssignMode" class="w-full border rounded p-2 mt-1 bg-white">
            <option value="TO_LEADER">Giao cho Trưởng phòng chuyên môn</option>
            <option value="TO_STAFF">Giao trực tiếp cho Cán bộ / Chuyên viên</option>
          </select>
        </div>
        <div id="a1LeaderSelectDiv">
          <label class="font-semibold">Trưởng phòng phụ trách *</label>
          <select id="a1LeaderSelect" class="w-full border rounded p-2 mt-1 bg-white"></select>
        </div>
        <div id="a1StaffSelectDiv" class="hidden">
          <label class="font-semibold">Cán bộ / Chuyên viên thực hiện *</label>
          <select id="a1StaffSelect" class="w-full border rounded p-2 mt-1 bg-white"></select>
        </div>
        <div>
          <label class="font-semibold">01 Sản phẩm đầu ra bắt buộc *</label>
          <input type="text" id="a1Product" required class="w-full border rounded p-2 mt-1" placeholder="VD: Báo cáo tham mưu, Tờ trình...">
        </div>
        <div>
          <label class="font-semibold">Hạn hoàn thành (Deadline) *</label>
          <input type="datetime-local" id="a1Deadline" required class="w-full border rounded p-2 mt-1">
        </div>
        <div>
          <label class="font-semibold">Kích hoạt Đỏ Đặc Biệt (ngày trễ) *</label>
          <input type="number" id="a1CriticalDays" min="1" value="3" required class="w-full border rounded p-2 mt-1">
        </div>
        <div class="md:col-span-3 flex justify-end gap-2 pt-2 border-t">
          <button type="button" data-action="toggleA1GiaoViec" class="px-3 py-1.5 bg-slate-200 rounded">Đóng</button>
          <button type="submit" class="px-4 py-1.5 bg-red-800 text-white font-bold rounded">Phát Hành Chỉ Đạo</button>
        </div>
      </form>
    </div>

    <!-- 4 THẺ THỐNG KÊ -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-white p-4 rounded-lg shadow-sm border-l-4 border-slate-400">
        <p class="text-xs font-semibold text-slate-500 uppercase">Tổng số việc</p>
        <p id="kpiTotal" class="text-2xl font-bold text-slate-800 mt-1">0</p>
      </div>
      <div class="bg-white p-4 rounded-lg shadow-sm border-l-4 border-yellow-500">
        <p class="text-xs font-semibold text-yellow-600 uppercase">Sắp đến hạn (≤ 3 ngày)</p>
        <p id="kpiYellow" class="text-2xl font-bold text-yellow-600 mt-1">0</p>
      </div>
      <div class="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-500">
        <p class="text-xs font-semibold text-red-600 uppercase">Quá hạn (Đỏ)</p>
        <p id="kpiRed" class="text-2xl font-bold text-red-600 mt-1">0</p>
      </div>
      <div class="bg-white p-4 rounded-lg shadow-sm border-l-4 border-purple-700">
        <p class="text-xs font-semibold text-purple-700 uppercase">Đỏ đặc biệt</p>
        <p id="kpiSpecialRed" class="text-2xl font-bold text-purple-700 mt-1">0</p>
      </div>
    </div>

    <!-- BỘ LỌC ĐIỂM NGHẼN -->
    <div class="bg-white p-4 rounded-lg shadow-sm border flex flex-col md:flex-row gap-3 items-center text-xs">
      <div class="flex-1 w-full">
        <input type="text" id="a1SearchInput" placeholder="🔍 Tìm nhanh theo tên nhiệm vụ, số văn bản, người thực hiện..." class="w-full border rounded-lg p-2 focus:ring-1 focus:ring-red-600 focus:outline-none">
      </div>
      <div class="w-full md:w-56">
        <select id="a1FilterAlert" class="w-full border rounded-lg p-2 bg-white">
          <option value="ALL">-- Tất cả cấp độ cảnh báo --</option>
          <option value="DO_DAC_BIET">🚨 Đỏ đặc biệt</option>
          <option value="DO">Quá hạn (Đỏ)</option>
          <option value="VANG">Sắp đến hạn (≤ 3 ngày)</option>
          <option value="TU_CHOI">Từ chối tiếp nhận</option>
          <option value="CHUA_GIAO">Chưa phân công</option>
          <option value="XANH">Trong hạn bình thường</option>
        </select>
      </div>
      <div class="w-full md:w-56">
        <select id="a1FilterDept" class="w-full border rounded-lg p-2 bg-white">
          <option value="ALL">-- Tất cả Phòng ban --</option>
          <option value="TONG_HOP">Phòng Tổng hợp</option>
          <option value="HC_LT">Phòng HC - LT</option>
          <option value="CDS_CY">Phòng CĐS - Cơ yếu</option>
          <option value="TAI_CHINH_DANG">Phòng Tài chính Đảng</option>
          <option value="QUAN_TRI">Phòng Quản trị</option>
        </select>
      </div>
    </div>

    <!-- BẢNG NGOẠI LỆ -->
    <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div class="p-4 bg-slate-50 border-b flex justify-between items-center">
        <h3 class="text-xs font-bold text-red-700 uppercase">Danh Sách Điểm Nghẽn & Chỉ Đạo Tháo Gỡ</h3>
        <span id="a1FilterCount" class="text-[11px] text-slate-500 font-medium">Hiển thị 0 nhiệm vụ</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-100 text-slate-600 uppercase">
              <th class="p-3 border-b">Nhiệm vụ & Điểm nghẽn</th>
              <th class="p-3 border-b">Cán bộ thực hiện</th>
              <th class="p-3 border-b">Trưởng phòng / LĐ phụ trách</th>
              <th class="p-3 border-b text-center">Trễ hạn</th>
              <th class="p-3 border-b">Sản phẩm thiếu</th>
              <th class="p-3 border-b text-center">Cấp độ cảnh báo</th>
              <th class="p-3 border-b text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody id="exceptionTableBody" class="divide-y divide-slate-200">
            <tr><td colspan="7" class="p-4 text-center text-slate-400">Đang tải dữ liệu...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- NỘI DUNG TAB 2: CÂY PHÂN CẤP 1 CẤP (INLINE ACCORDION) -->
  <div id="tabContentA1Staffs" class="hidden space-y-6">
    <div class="bg-white p-5 rounded-lg shadow-sm border space-y-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-2">
        <div>
          <h3 class="text-xs font-bold text-slate-900 uppercase" id="a1TreeHeaderTitle">Cây Phân Cấp Trực Thuộc Quản Trị</h3>
          <p class="text-[11px] text-slate-500" id="a1TreeHeaderDesc">Bấm vào cán bộ để mở/đóng chi tiết nhiệm vụ trực tiếp ngay tại chỗ</p>
        </div>
        <button data-action="loadA1StaffsTab" class="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded font-semibold">Tải lại cây</button>
      </div>

      <div id="a1TreeContainer" class="space-y-3 text-xs">
        <p class="text-center text-slate-400 py-6">Đang dựng cây phân cấp...</p>
      </div>
    </div>
  </div>
`;
