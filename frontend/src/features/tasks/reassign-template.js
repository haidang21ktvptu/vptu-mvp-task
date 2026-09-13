// Modal phân công / đổi cán bộ thực hiện (A1 & A2), lấy nguyên từ index.html cũ.
export const reassignModalTemplate = `
<!-- MODAL CAN THIỆP / ĐỔI NGƯỜI LÀM (A1 & A2) -->
<div id="reassignModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center hidden p-4">
  <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-3">
    <h3 class="text-xs font-bold text-slate-900 uppercase border-b pb-2">Phân Công / Đổi Cán Bộ Thực Hiện</h3>
    <input type="hidden" id="reassignTaskId">
    <div>
      <label class="text-xs font-semibold text-slate-700">Chọn Cán bộ nhận việc *</label>
      <select id="reassignStaffSelect" class="w-full border rounded p-2 text-xs mt-1 bg-white"></select>
    </div>
    <div class="flex justify-end gap-2 pt-2 border-t">
      <button data-action="closeReassignModal" class="px-3 py-1.5 rounded bg-slate-200 text-xs">Hủy</button>
      <button data-action="submitReassign" class="px-3 py-1.5 rounded bg-red-800 text-white text-xs font-semibold">Lưu Phân Việc</button>
    </div>
  </div>
</div>

`;
