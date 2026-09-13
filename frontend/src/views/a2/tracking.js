// A2 Tab 2: theo dõi tiếp nhận (đôn đốc TASK-6, đổi người, đồng ý từ chối) và duyệt minh chứng
// (TASK-7) — DASH-3. Các thao tác nhiều bước đi qua hàm security definer (RLS-8).
import { supabase } from '../../lib/supabase.js';
import { $, escapeHtml } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifySuccess, notifyError } from '../../components/toast.js';
import { canAccessDirectiveThread, rememberTaskParties, directiveToggleBtnHtml, directiveThreadRowHtml, loadDirectiveUnreadMap } from '../../features/directives/render.js';

const STATUS_BADGE = {
  CHO_TIEP_NHAN: `<span class="px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-semibold">Chờ nhận việc</span>`,
  DANG_THUC_HIEN: `<span class="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 font-semibold">Đang thực hiện</span>`,
  CHUA_GIAO: `<span class="px-2 py-0.5 rounded text-[10px] bg-gray-200 text-gray-800 font-bold">Chưa phân công</span>`,
  CHO_DUYET: `<span class="px-2 py-0.5 rounded text-[10px] bg-purple-100 text-purple-800 font-bold">Chờ duyệt minh chứng</span>`,
  HOAN_THANH: `<span class="px-2 py-0.5 rounded text-[10px] bg-green-100 text-green-800 font-semibold">✓ Đã Hoàn Thành</span>`,
};

function statusBadgeHtml(t) {
  if (t.status === 'TU_CHOI_TIEP_NHAN') {
    return `<span class="px-2 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 font-bold">Từ chối: ${escapeHtml(t.reject_reason || '')}</span>`;
  }
  return STATUS_BADGE[t.status] || '';
}

function actionButtonsHtml(t, hasDirective) {
  const btns = [];
  if (t.status === 'CHO_TIEP_NHAN') {
    btns.push(`<button data-action="sendTargetedWarning" data-task-id="${t.id}" class="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-[11px] font-semibold">Đôn đốc (${t.warning_count || 0})</button>`);
    btns.push(`<button data-action="openReassignModal" data-task-id="${t.id}" class="bg-slate-700 hover:bg-slate-800 text-white px-2 py-1 rounded text-[11px]">Đổi người</button>`);
  } else if (t.status === 'TU_CHOI_TIEP_NHAN') {
    btns.push(`<button data-action="approveReject" data-task-id="${t.id}" class="bg-slate-800 hover:bg-black text-white px-2 py-1 rounded text-[11px]">Đồng ý từ chối</button>`);
  } else if (t.status === 'CHUA_GIAO') {
    btns.push(`<button data-action="openReassignModal" data-task-id="${t.id}" class="bg-red-700 hover:bg-red-800 text-white px-2 py-1 rounded text-[11px] font-bold">Phân việc ngay</button>`);
  }
  if (hasDirective) btns.push(directiveToggleBtnHtml(t.id, true));
  return btns.join(' ');
}

function trackingRowHtml(t) {
  const hasDirective = canAccessDirectiveThread(rememberTaskParties(t));
  const searchData = `${t.title} ${t.resolution_code} ${t.assigned?.full_name || ''}`.toLowerCase();
  const assignedHtml = t.assigned?.full_name
    ? `${escapeHtml(t.assigned.full_name)} <br><span class="text-[10px] text-slate-500">${escapeHtml(t.assigned.position_title)}</span>`
    : '<span class="text-red-600 font-bold">Chưa có người nhận</span>';
  return `
    <tr id="taskRow-${t.id}" data-search="${escapeHtml(searchData)}" class="border-b hover:bg-slate-50">
      <td class="p-2 font-medium">${escapeHtml(t.title)} <br><span class="text-[10px] text-slate-500">${escapeHtml(t.resolution_code)}</span></td>
      <td class="p-2">${assignedHtml}</td>
      <td class="p-2 text-center">${statusBadgeHtml(t)}</td>
      <td class="p-2 text-center space-x-1">${actionButtonsHtml(t, hasDirective)}</td>
    </tr>
    ${directiveThreadRowHtml(t.id, 4)}
  `;
}

function approvalRowHtml(t) {
  const ev = t.task_evidences?.[0];
  return `
    <tr class="border-b">
      <td class="p-2 font-medium">${escapeHtml(t.title)}</td>
      <td class="p-2">${escapeHtml(t.assigned?.full_name) || 'N/A'}</td>
      <td class="p-2"><a href="${escapeHtml(ev?.file_url) || '#'}" target="_blank" rel="noopener" class="text-blue-600 underline font-semibold">${escapeHtml(ev?.document_title) || 'Xem tài liệu'}</a></td>
      <td class="p-2 text-center">
        <button data-action="approveComplete" data-task-id="${t.id}" class="bg-green-700 hover:bg-green-800 text-white px-2 py-1 rounded text-xs font-semibold">Duyệt Đóng Việc</button>
      </td>
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
    ? `<tr><td colspan="4" class="p-3 text-center text-slate-400">Chưa có nhiệm vụ nào trong phòng.</td></tr>`
    : deptTasks.map(trackingRowHtml).join('');

  const { data: pendingApprovals } = await supabase.from('tasks')
    .select('id, title, expected_product, assigned:assigned_to(full_name, department), task_evidences(id, document_title, file_url)')
    .eq('status', 'CHO_DUYET');
  const myPending = (pendingApprovals || []).filter((t) => t.assigned?.department === me.department);

  const tbodyApproval = $('approvalTableBody');
  tbodyApproval.innerHTML = myPending.length === 0
    ? `<tr><td colspan="4" class="p-3 text-center text-slate-400">Không có hồ sơ nào chờ duyệt.</td></tr>`
    : myPending.map(approvalRowHtml).join('');
}

async function sendTargetedWarning({ taskId }) {
  // RLS-8: tăng warning_count nguyên tử trong DB, hàm tự kiểm tra phạm vi.
  const { data: newCount, error } = await supabase.rpc('warn_task', { p_task_id: taskId });
  if (error) {
    notifyError('Lỗi: ' + error.message);
    return;
  }
  notifySuccess(`Đã gửi đôn đốc lần ${newCount} tới cán bộ!`);
  loadA2Data();
}

async function approveReject({ taskId }) {
  const { error } = await supabase.from('tasks').update({ status: 'CHUA_GIAO', assigned_to: null }).eq('id', taskId);
  if (error) {
    notifyError('Lỗi: ' + error.message);
    return;
  }
  notifySuccess('Đã chấp thuận từ chối. Nhiệm vụ chuyển về trạng thái CHƯA PHÂN CÔNG!');
  loadA2Data();
}

async function approveComplete({ taskId }) {
  // RLS-8: duyệt hoàn thành + đánh dấu minh chứng đã duyệt trong một giao dịch.
  const { error } = await supabase.rpc('approve_task', { p_task_id: taskId });
  if (error) {
    notifyError('Lỗi: ' + error.message);
    return;
  }
  notifySuccess('Đã duyệt minh chứng hợp lệ. Nhiệm vụ đã HOÀN THÀNH!');
  loadA2Data();
}

registerActions({ sendTargetedWarning, approveReject, approveComplete });
