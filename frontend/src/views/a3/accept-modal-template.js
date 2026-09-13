// Modal bắt buộc tiếp nhận nhiệm vụ (TASK-3, DESIGN mục 5): viền trên đỏ, tiêu đề serif, không có nút đóng.
export const acceptModalTemplate = `
<div id="mandatoryAcceptModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="mandatoryTitle">
  <div class="modal modal-bat-buoc max-w-lg">
    <h2 id="mandatoryTitle" class="modal-tieu-de">Nhiệm vụ mới cần tiếp nhận</h2>
    <p class="chu-phu mt-1 mb-4">Đồng chí kiểm tra nội dung rồi tiếp nhận, hoặc từ chối kèm lý do.</p>

    <input type="hidden" id="mandatoryTaskId">
    <dl class="the p-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px]">
      <dt class="chu-phu">Nội dung</dt><dd id="mandatoryTaskTitle" class="font-medium">--</dd>
      <dt class="chu-phu">Văn bản</dt><dd id="mandatoryTaskRes">--</dd>
      <dt class="chu-phu">Sản phẩm</dt><dd id="mandatoryTaskProduct">--</dd>
      <dt class="chu-phu">Hạn</dt><dd id="mandatoryTaskDeadline" class="font-medium">--</dd>
    </dl>
    <div id="warningNoticeDiv" class="loi-inline hidden mt-4" role="alert"></div>

    <div id="rejectReasonBox" class="hidden mt-4">
      <label for="rejectReasonInput" class="nhan">Lý do từ chối nhận việc</label>
      <textarea id="rejectReasonInput" rows="2" class="input"></textarea>
    </div>

    <div class="modal-chan">
      <button type="button" id="btnRejectToggle" data-action="toggleRejectReason" class="btn btn-nguy-hiem">Từ chối nhận việc</button>
      <button type="button" id="btnConfirmReject" data-action="submitRejectTask" class="btn btn-nguy-hiem hidden">Xác nhận từ chối</button>
      <button type="button" id="btnAcceptTask" data-action="acceptTask" class="btn btn-chinh">Tiếp nhận nhiệm vụ</button>
    </div>
  </div>
</div>
`;
