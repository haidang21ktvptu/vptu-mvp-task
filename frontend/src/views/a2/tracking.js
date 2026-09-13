// A2 Tab 2: theo dõi tiếp nhận (đôn đốc TASK-6, đổi người, đồng ý từ chối) và duyệt minh chứng
// (TASK-7) — DASH-3. Các thao tác nhiều bước đi qua hàm security definer (RLS-8).
import { supabase } from '../../lib/supabase.js';
import { $, escapeHtml } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifySuccess, notifyError } from '../../components/toast.js';
import { canAccessDirectiveThread, rememberTaskParties, directiveToggleBtnHtml, directiveThreadRowHtml, loadDirectiveUnreadMap } from '../../features/directives/render.js';

// Trạng thái nhận việc: nhãn màu mức (DESIGN mục 2) + lớp dòng cho dải màu bên trái.
const STATUS = {
  CHO_TIEP_NHAN: { row: 'r-vang', badge: `<span class="muc muc-vang">Chờ nhận việc</span>` },
  DANG_THUC_HIEN: { row: 'r-xanh', badge: `<span class="muc">Đang thực hiện</span>` },
  CHUA_GIAO: { row: '', badge: `<span class="muc">Chưa phân công</span>` },
  CHO_DUYET: { row: 'r-vang', badge: `<span class="muc muc-vang">Chờ duyệt minh chứng</span>` },
  HOAN_THANH: { row: 'r-ht', badge: `<span class="muc muc-xanh">Đã hoàn thành</span>` },
  TU_CHOI_TIEP_NHAN: { row: 'r-do', badge: `<span class="muc muc-do">Từ chối nhận việc</span>` },
};

function statusOf(t) {
  return STATUS[t.status] || { row: '', badge: '' };
}

function actionButtonsHtml(t, hasDirective) {
  const btns = [];
  const btn = (action, label) => `<button type="button" data-action="${action}" data-task-id="${t.id}" class="btn btn-phu btn-nho">${label}</button>`;
  if (t.status === 'CHO_TIEP_NHAN') {
    btns.push(btn('sendTargetedWarning', `Đôn đốc (${t.warning_count || 0})`));
    btns.push(btn('openReassignModal', 'Đổi người'));
  } else if (t.status === 'TU_CHOI_TIEP_NHAN') {
    btns.push(btn('approveReject', 'Đồng ý từ chối'));
  } else if (t.status === 'CHUA_GIAO') {
    btns.push(btn('openReassignModal', 'Phân công'));
  }
  if (hasDirective) btns.push(directiveToggleBtnHtml(t.id, true));
  return `<div class="thao-tac">${btns.join('')}</div>`;
}

function trackingRowHtml(t) {
  const hasDirective = canAccessDirectiveThread(rememberTaskParties(t));
  const searchData = `${t.title} ${t.resolution_code} ${t.assigned?.full_name || ''}`.toLowerCase();
  const assignedHtml = t.assigned?.full_name
    ? `${escapeHtml(t.assigned.full_name)}<small>${escapeHtml(t.assigned.position_title)}</small>`
    : '<span class="chu-phu">Chưa có người nhận</span>';
  const s = statusOf(t);
  const rejectHtml = t.status === 'TU_CHOI_TIEP_NHAN' && t.reject_reason ? `<small>Lý do: ${escapeHtml(t.reject_reason)}</small>` : '';
  return `
    <tr id="taskRow-${t.id}" data-search="${escapeHtml(searchData)}" class="${s.row}">
      <td class="tieude">${escapeHtml(t.title)}<small>Văn bản: ${escapeHtml(t.resolution_code)}</small>${rejectHtml}</td>
      <td class="nguoi" data-nhan="Cán bộ">${assignedHtml}</td>
      <td data-nhan="Trạng thái">${s.badge}</td>
      <td>${actionButtonsHtml(t, hasDirective)}</td>
    </tr>
    ${directiveThreadRowHtml(t.id, 4)}
  `;
}

function approvalRowHtml(t) {
  const ev = t.task_evidences?.[0];
  return `
    <tr class="r-vang">
      <td class="tieude">${escapeHtml(t.title)}</td>
      <td data-nhan="Cán bộ nộp">${escapeHtml(t.assigned?.full_name) || 'Chưa rõ'}</td>
      <td data-nhan="Minh chứng"><a href="${escapeHtml(ev?.file_url) || '#'}" target="_blank" rel="noopener">${escapeHtml(ev?.document_title) || 'Xem tài liệu'}</a></td>
      <td><div class="thao-tac">
        <button type="button" data-action="approveComplete" data-task-id="${t.id}" class="btn btn-cham btn-nho">Duyệt hoàn thành</button>
      </div></td>
    </tr>
  `;
}

export async function loadA2Data() {
  await loadDirectiveUnreadMap();
  const me = state.user;

  const { data: tasks } = await supabase.from('tasks')
    .select('*, assigned:assigned_to(full_name, position_title, department), leader:leader_in_charge(full_name)')
    .order('created_at', { ascending: false });
  const deptTasks = (tasks || []).filter((t) => t.assigned?.department === me.department || t.leader_in_charge === me.id);

  const tbodyTracking = $('trackingTableBody');
  tbodyTracking.innerHTML = deptTasks.length === 0
    ? `<tr><td colspan="4" class="trong">Chưa có nhiệm vụ nào trong phòng.</td></tr>`
    : deptTasks.map(trackingRowHtml).join('');

  const { data: pendingApprovals } = await supabase.from('tasks')
    .select('id, title, expected_product, assigned:assigned_to(full_name, department), task_evidences(id, document_title, file_url)')
    .eq('status', 'CHO_DUYET');
  const myPending = (pendingApprovals || []).filter((t) => t.assigned?.department === me.department);

  const tbodyApproval = $('approvalTableBody');
  tbodyApproval.innerHTML = myPending.length === 0
    ? `<tr><td colspan="4" class="trong">Không có hồ sơ nào chờ duyệt.</td></tr>`
    : myPending.map(approvalRowHtml).join('');
}

async function sendTargetedWarning({ taskId }) {
  // RLS-8: tăng warning_count nguyên tử trong DB, hàm tự kiểm tra phạm vi.
  const { data: newCount, error } = await supabase.rpc('warn_task', { p_task_id: taskId });
  if (error) {
    notifyError('Lỗi: ' + error.message);
    return;
  }
  notifySuccess(`Đã gửi đôn đốc lần ${newCount} tới cán bộ.`);
  loadA2Data();
}

async function approveReject({ taskId }) {
  const { error } = await supabase.from('tasks').update({ status: 'CHUA_GIAO', assigned_to: null }).eq('id', taskId);
  if (error) {
    notifyError('Lỗi: ' + error.message);
    return;
  }
  notifySuccess('Đã chấp thuận từ chối. Nhiệm vụ chuyển về chưa phân công.');
  loadA2Data();
}

async function approveComplete({ taskId }) {
  // RLS-8: duyệt hoàn thành + đánh dấu minh chứng đã duyệt trong một giao dịch.
  const { error } = await supabase.rpc('approve_task', { p_task_id: taskId });
  if (error) {
    notifyError('Lỗi: ' + error.message);
    return;
  }
  notifySuccess('Đã duyệt minh chứng. Nhiệm vụ hoàn thành.');
  loadA2Data();
}

registerActions({ sendTargetedWarning, approveReject, approveComplete });
