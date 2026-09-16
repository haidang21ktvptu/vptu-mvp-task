// Modal bắt buộc tiếp nhận nhiệm vụ (GV-5, DESIGN mục 5): viền trên đỏ, tiêu đề serif. Chỉ việc theo 1400 chưa xác nhận.
export const acceptModalTemplate = `
<div id="mandatoryAcceptModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="mandatoryTitle">
  <div class="modal modal-bat-buoc max-w-lg">
    <h2 id="mandatoryTitle" class="modal-tieu-de">Nhiệm vụ mới cần xác nhận đã nhận</h2>
    <p class="chu-phu mt-1 mb-4">Xác nhận chỉ ghi nhận đồng chí đã nhận việc — hạn và trạng thái không đổi, thời gian đã tính từ ngày nhận văn bản.</p>

    <input type="hidden" id="mandatoryTaskId">
    <dl class="the p-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px]">
      <dt class="chu-phu">Nội dung</dt><dd id="mandatoryTaskTitle" class="font-medium">--</dd>
      <dt class="chu-phu">Văn bản</dt><dd id="mandatoryTaskRes">--</dd>
      <dt class="chu-phu">Chịu trách nhiệm</dt><dd id="mandatoryTaskOwner">--</dd>
      <dt class="chu-phu">Sản phẩm</dt><dd id="mandatoryTaskProduct">--</dd>
      <dt class="chu-phu">Hạn</dt><dd id="mandatoryTaskDeadline" class="font-medium">--</dd>
    </dl>

    <div class="modal-chan">
      <button type="button" id="btnDeSau" data-action="deSauTask" class="btn btn-phu">Để sau</button>
      <button type="button" id="btnAcceptTask" data-action="acceptTask" class="btn btn-chinh">Xác nhận đã nhận việc</button>
    </div>
  </div>
</div>
`;
