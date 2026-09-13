// Modal bắt buộc tiếp nhận nhiệm vụ (TASK-3), lấy nguyên từ index.html cũ.
export const acceptModalTemplate = `
<!-- MODAL BẮT BUỘC TIẾP NHẬN (CÁN BỘ A3) -->
<div id="mandatoryAcceptModal" class="fixed inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-4 hidden">
  <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 border-2 border-red-600">
    <div class="flex items-center gap-3 text-red-700">
      <div class="p-2 bg-red-100 rounded-full font-bold text-lg">⚠</div>
      <div>
        <h3 class="text-sm font-bold uppercase">Nhiệm Vụ Mới Cần Tiếp Nhận</h3>
        <p class="text-[11px] text-slate-500">Đồng chí bắt buộc phải kiểm tra và xác nhận tiếp nhận</p>
      </div>
    </div>

    <div class="bg-slate-50 p-4 rounded-lg border space-y-2 text-xs">
      <input type="hidden" id="mandatoryTaskId">
      <div><span class="font-semibold text-slate-600">Nội dung:</span> <p id="mandatoryTaskTitle" class="font-bold text-slate-800 text-sm mt-0.5">--</p></div>
      <div><span class="font-semibold text-slate-600">Văn bản:</span> <span id="mandatoryTaskRes" class="font-medium text-slate-800">--</span></div>
      <div><span class="font-semibold text-slate-600">Sản phẩm bắt buộc:</span> <span id="mandatoryTaskProduct" class="font-medium text-slate-800">--</span></div>
      <div><span class="font-semibold text-slate-600">Hạn hoàn thành:</span> <span id="mandatoryTaskDeadline" class="font-bold text-red-600">--</span></div>
      <div id="warningNoticeDiv" class="hidden text-red-600 font-bold bg-red-50 p-2 rounded border border-red-200"></div>
    </div>

    <div id="rejectReasonBox" class="hidden space-y-1">
      <label class="text-xs font-semibold text-slate-700">Lý do từ chối nhận việc (Bắt buộc) *</label>
      <textarea id="rejectReasonInput" rows="2" class="w-full border rounded p-2 text-xs focus:ring-1 focus:ring-red-600 focus:outline-none" placeholder="Nêu rõ lý do..."></textarea>
    </div>

    <div class="flex justify-end gap-2 pt-2 border-t">
      <button id="btnRejectToggle" data-action="toggleRejectReason" class="px-3 py-2 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold">Từ Chối Nhận Việc</button>
      <button id="btnConfirmReject" data-action="submitRejectTask" class="hidden px-3 py-2 rounded bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold">Xác Nhận Từ Chối</button>
      <button id="btnAcceptTask" data-action="acceptTask" class="px-4 py-2 rounded bg-green-700 hover:bg-green-800 text-white text-xs font-bold shadow">Tiếp Nhận Nhiệm Vụ</button>
    </div>
  </div>
</div>

`;
