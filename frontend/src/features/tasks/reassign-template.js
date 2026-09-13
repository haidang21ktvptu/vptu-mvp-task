// Modal phân công / đổi cán bộ thực hiện (A1 & A2, DESIGN mục 5).
export const reassignModalTemplate = `
<div id="reassignModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="reassignTitle">
  <div class="modal">
    <h2 id="reassignTitle" class="modal-tieu-de mb-4">Phân công cán bộ thực hiện</h2>
    <input type="hidden" id="reassignTaskId">
    <label for="reassignStaffSelect" class="nhan">Cán bộ nhận việc</label>
    <select id="reassignStaffSelect" class="input"></select>
    <p class="chu-phu mt-2">Nhiệm vụ chuyển về trạng thái chờ nhận việc; số lần đôn đốc và lý do từ chối được xoá.</p>
    <div class="modal-chan">
      <button type="button" data-action="closeReassignModal" class="btn btn-phu">Huỷ</button>
      <button type="button" data-action="submitReassign" class="btn btn-chinh">Lưu phân công</button>
    </div>
  </div>
</div>
`;
