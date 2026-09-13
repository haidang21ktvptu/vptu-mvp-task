// Modal nộp minh chứng (TASK-7), lấy nguyên từ index.html cũ.
export const evidenceModalTemplate = `
<!-- MODAL NỘP MINH CHỨNG -->
<div id="evidenceModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center hidden p-4">
  <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-3">
    <h3 class="text-xs font-bold text-slate-900 uppercase border-b pb-2">Nộp Minh Chứng Hoàn Thành</h3>
    <input type="hidden" id="evidenceTaskId">
    <div>
      <label class="text-xs font-semibold text-slate-700">Trích yếu văn bản / Tờ trình *</label>
      <input type="text" id="evidenceTitle" required class="w-full border rounded p-2 text-xs mt-1" placeholder="VD: Báo cáo số 15/BC-VPTU...">
    </div>
    <div>
      <label class="text-xs font-semibold text-slate-700">Đường dẫn tài liệu đính kèm (URL hợp lệ) *</label>
      <input type="text" id="evidenceLink" required class="w-full border rounded p-2 text-xs mt-1" placeholder="https://...">
    </div>
    <div class="flex justify-end gap-2 pt-2 border-t">
      <button data-action="closeEvidenceModal" class="px-3 py-1.5 rounded bg-slate-200 text-xs">Hủy</button>
      <button data-action="submitEvidence" class="px-3 py-1.5 rounded bg-green-700 hover:bg-green-800 text-white text-xs font-bold">Gửi Duyệt</button>
    </div>
  </div>
</div>
`;
