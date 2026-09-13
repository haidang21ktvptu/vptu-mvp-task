// Modal "Phân công / Đổi cán bộ thực hiện" (A1 & A2): cập nhật assigned_to, về CHO_TIEP_NHAN,
// reset đôn đốc/lý do từ chối; RLS-4 kiểm tra phạm vi ở tầng DB.
import { supabase } from '../../lib/supabase.js';
import { $, show, escapeHtml } from '../../lib/dom.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifySuccess, notifyError } from '../../components/toast.js';
import { reloadCurrentView } from '../../views/shell.js';
import { reassignModalTemplate } from './reassign-template.js';

function openReassignModal({ taskId }) {
  $('reassignTaskId').value = taskId;
  const me = state.user;
  const staffList = me.role_group === 'A1'
    ? state.accounts.filter((a) => a.role_group === 'A3' || a.role_group === 'A2')
    : state.accounts.filter((a) => a.department === me.department && a.id !== me.id);

  $('reassignStaffSelect').innerHTML = staffList
    .map((c) => `<option value="${c.id}">${escapeHtml(c.full_name)} (${escapeHtml(c.position_title)} - ${DEPT_NAMES[c.department]})</option>`)
    .join('');
  show('reassignModal', true);
}

function closeReassignModal() {
  show('reassignModal', false);
}

async function submitReassign() {
  const taskId = $('reassignTaskId').value;
  const staffId = $('reassignStaffSelect').value;
  const { error } = await supabase.from('tasks').update({
    assigned_to: staffId,
    status: 'CHO_TIEP_NHAN',
    warning_count: 0,
    reject_reason: null,
  }).eq('id', taskId);
  if (error) {
    notifyError('Lỗi: ' + error.message);
    return;
  }

  notifySuccess('Đã phân công lại cán bộ thực hiện.');
  closeReassignModal();
  reloadCurrentView();
}

export function mountReassignModal() {
  $('modalRoot').insertAdjacentHTML('beforeend', reassignModalTemplate);
  registerActions({ openReassignModal, closeReassignModal, submitReassign });
}
