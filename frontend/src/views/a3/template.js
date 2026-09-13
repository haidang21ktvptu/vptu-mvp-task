// Markup tầng A3 (Chuyên viên), lấy nguyên từ index.html cũ; onclick inline → data-action.
export const a3Template = `
  <div id="cvStatsBar" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
    <div class="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
      <span class="text-[11px] text-slate-500 font-semibold block">Tổng nhiệm vụ</span>
      <span id="cvStatTotal" class="text-xl font-bold text-slate-800">0</span>
    </div>
    <div class="bg-white p-3 rounded-lg border border-red-200 shadow-sm">
      <span class="text-[11px] text-red-600 font-semibold block">Quá hạn (Đỏ)</span>
      <span id="cvStatOverdue" class="text-xl font-bold text-red-600">0</span>
    </div>
    <div class="bg-white p-3 rounded-lg border border-amber-200 shadow-sm">
      <span class="text-[11px] text-amber-600 font-semibold block">Gần đến hạn (≤ 3 ngày)</span>
      <span id="cvStatWarning" class="text-xl font-bold text-amber-600">0</span>
    </div>
    <div class="bg-white p-3 rounded-lg border border-green-200 shadow-sm">
      <span class="text-[11px] text-green-700 font-semibold block">Đã hoàn thành</span>
      <span id="cvStatCompleted" class="text-xl font-bold text-green-700">0</span>
    </div>
  </div>

  <div class="bg-white p-5 rounded-lg shadow-sm border space-y-4">
    <div class="flex flex-col sm:row justify-between items-start sm:items-center border-b pb-3 gap-2">
      <div>
        <h3 class="text-xs font-bold text-slate-900 uppercase">Danh Sách Nhiệm Vụ Phân Công Cho Tôi</h3>
        <p class="text-[11px] text-slate-500">Sắp xếp ưu tiên: Nhiệm vụ quá hạn và gần đến hạn được hiển thị lên đầu</p>
      </div>
      <div class="flex items-center gap-2">
        <input type="text" id="cvTaskSearch" placeholder="🔍 Tìm kiếm..." class="border rounded px-2.5 py-1 text-xs w-48 focus:outline-none">
        <button data-action="loadChuyenVienData" class="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded font-semibold">Tải lại</button>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="bg-slate-100 text-slate-600 uppercase">
            <th class="p-3 border-b">Ưu tiên</th>
            <th class="p-3 border-b">Nhiệm vụ</th>
            <th class="p-3 border-b">LĐ phụ trách</th>
            <th class="p-3 border-b">Sản phẩm đầu ra</th>
            <th class="p-3 border-b">Hạn chót</th>
            <th class="p-3 border-b text-center">Trạng thái</th>
            <th class="p-3 border-b text-center">Thao tác</th>
          </tr>
        </thead>
        <tbody id="chuyenVienTableBody" class="divide-y divide-slate-200">
          <tr><td colspan="7" class="p-4 text-center text-slate-400">Đang tải dữ liệu...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
`;
