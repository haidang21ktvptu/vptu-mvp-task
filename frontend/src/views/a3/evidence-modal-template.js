// Modal nộp minh chứng (TASK-7, DESIGN mục 5).
export const evidenceModalTemplate = `
<div id="evidenceModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="evidenceTitleHeading">
  <div class="modal">
    <h2 id="evidenceTitleHeading" class="modal-tieu-de mb-4">Nộp minh chứng hoàn thành</h2>
    <input type="hidden" id="evidenceTaskId">
    <label for="evidenceTitle" class="nhan">Trích yếu văn bản, tờ trình</label>
    <input type="text" id="evidenceTitle" required class="input mb-4" placeholder="Ví dụ: Báo cáo số 15/BC-VPTU">
    <label for="evidenceLink" class="nhan">Đường dẫn tài liệu (bắt đầu bằng https://)</label>
    <input type="url" id="evidenceLink" required class="input" placeholder="https://">
    <div class="modal-chan">
      <button type="button" data-action="closeEvidenceModal" class="btn btn-phu">Huỷ</button>
      <button type="button" data-action="submitEvidence" class="btn btn-chinh">Gửi duyệt</button>
    </div>
  </div>
</div>
`;
