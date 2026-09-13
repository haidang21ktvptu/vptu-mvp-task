// Modal nộp minh chứng (TASK-7): URL http/https, qua hàm submit_evidence (RLS-8) — thêm minh chứng
// và chuyển CHO_DUYET trong một giao dịch.
import { supabase } from '../../lib/supabase.js';
import { $, show } from '../../lib/dom.js';
import { registerActions } from '../../lib/actions.js';
import { notifySuccess, notifyError } from '../../components/toast.js';
import { evidenceModalTemplate } from './evidence-modal-template.js';

let afterSubmit = () => {};

function openEvidenceModal({ taskId }) {
  $('evidenceTaskId').value = taskId;
  show('evidenceModal', true);
}

function closeEvidenceModal() {
  show('evidenceModal', false);
}

async function submitEvidence() {
  const taskId = $('evidenceTaskId').value;
  const title = $('evidenceTitle').value.trim();
  const link = $('evidenceLink').value.trim();

  if (!title || !link) {
    notifyError('Nhập trích yếu và đường dẫn tài liệu.');
    return;
  }
  if (!/^https?:\/\/.+/i.test(link)) {
    notifyError('Đường dẫn minh chứng phải bắt đầu bằng http:// hoặc https://');
    return;
  }

  const { error } = await supabase.rpc('submit_evidence', { p_task_id: taskId, p_title: title, p_url: link });
  if (error) {
    notifyError('Lỗi: ' + error.message);
    return;
  }
  notifySuccess('Đã nộp minh chứng. Đang chờ Trưởng phòng duyệt.');
  closeEvidenceModal();
  afterSubmit();
}

export function mountEvidenceModal(onSubmit) {
  afterSubmit = onSubmit;
  $('modalRoot').insertAdjacentHTML('beforeend', evidenceModalTemplate);
  registerActions({ openEvidenceModal, closeEvidenceModal, submitEvidence });
}
