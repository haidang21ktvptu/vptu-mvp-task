// Modal bắt buộc tiếp nhận (TASK-3): A3 có việc CHO_TIEP_NHAN phải chọn tiếp nhận hoặc từ chối
// kèm lý do. Chỉ cập nhật status/reject_reason — trigger tasks_guard_a3 chặn mọi cột khác (RLS-4).
import { supabase } from '../../lib/supabase.js';
import { $, show, setText, formatDateTime } from '../../lib/dom.js';
import { registerActions } from '../../lib/actions.js';
import { notifySuccess, notifyError } from '../../components/toast.js';
import { acceptModalTemplate } from './accept-modal-template.js';

let afterChange = () => {};

export function showMandatoryModal(task) {
  if (!task) return;
  $('mandatoryTaskId').value = task.id;
  setText('mandatoryTaskTitle', task.title);
  setText('mandatoryTaskRes', task.resolution_code);
  setText('mandatoryTaskProduct', task.expected_product);
  setText('mandatoryTaskDeadline', formatDateTime(task.deadline));

  const isPast = new Date(task.deadline) <= new Date();
  let msg = '';
  if (task.warning_count > 0) msg += `Đã đôn đốc ${task.warning_count} lần. Đề nghị đồng chí khẩn trương tiếp nhận. `;
  if (isPast) msg += 'Hạn hoàn thành của nhiệm vụ này đã qua.';
  setText('warningNoticeDiv', msg);
  show('warningNoticeDiv', Boolean(msg));

  show('rejectReasonBox', false);
  show('btnConfirmReject', false);
  show('btnAcceptTask', true);
  show('btnRejectToggle', true);
  show('mandatoryAcceptModal', true);
}

async function acceptTask() {
  const taskId = $('mandatoryTaskId').value;
  const { error } = await supabase.from('tasks').update({ status: 'DANG_THUC_HIEN' }).eq('id', taskId);
  if (error) {
    notifyError('Lỗi: ' + error.message);
    return;
  }
  notifySuccess('Đã tiếp nhận nhiệm vụ.');
  show('mandatoryAcceptModal', false);
  afterChange();
}

function toggleRejectReason() {
  show('rejectReasonBox', true);
  show('btnConfirmReject', true);
  show('btnAcceptTask', false);
  show('btnRejectToggle', false);
}

async function submitRejectTask() {
  const taskId = $('mandatoryTaskId').value;
  const reason = $('rejectReasonInput').value.trim();
  if (!reason) {
    notifyError('Nhập lý do từ chối trước khi gửi.');
    return;
  }
  const { error } = await supabase.from('tasks')
    .update({ status: 'TU_CHOI_TIEP_NHAN', reject_reason: reason }).eq('id', taskId);
  if (error) {
    notifyError('Lỗi: ' + error.message);
    return;
  }
  notifySuccess('Đã gửi lý do từ chối nhận việc.');
  show('mandatoryAcceptModal', false);
  afterChange();
}

// onChange: nạp lại danh sách việc sau khi tiếp nhận/từ chối.
export function mountAcceptModal(onChange) {
  afterChange = onChange;
  $('modalRoot').insertAdjacentHTML('beforeend', acceptModalTemplate);
  registerActions({ acceptTask, toggleRejectReason, submitRejectTask });
}
