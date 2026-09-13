// Phần hiển thị của luồng ý kiến chỉ đạo gắn theo dòng nhiệm vụ (DIR-1/4): quyền xem,
// nút "Ý kiến" kèm huy hiệu chưa đọc, dòng luồng ẩn dưới mỗi nhiệm vụ, nạp số chưa đọc.
// Logic mở/nạp/gửi ý kiến ở features/directives/index.js (PR c).
import { supabase } from '../../lib/supabase.js';
import { $ } from '../../lib/dom.js';
import { state } from '../../lib/state.js';

// RLS-5: A1 luôn có quyền (trong phạm vi đã đọc được task); người khác phải là bên liên quan.
export function canAccessDirectiveThread(parties) {
  if (!parties) return false;
  if (state.user.role_group === 'A1') return true;
  const myId = state.user.id;
  return parties.assigned_to === myId || parties.leader_in_charge === myId || parties.created_by === myId;
}

export function rememberTaskParties(task) {
  state.taskParties[task.id] = {
    assigned_to: task.assigned_to,
    leader_in_charge: task.leader_in_charge,
    created_by: task.created_by,
  };
  return state.taskParties[task.id];
}

export function directiveToggleBtnHtml(taskId, hasAccess) {
  if (!hasAccess) return '';
  const unreadCount = state.directiveUnread[taskId] || 0;
  // Huy hiệu số chưa đọc: tròn 18px vàng sao (DESIGN mục 5), ẩn khi bằng 0.
  const badgeHtml = `<span id="directiveBadge-${taskId}" class="huy-hieu${unreadCount > 0 ? '' : ' hidden'}">${unreadCount}</span>`;
  return `<button type="button" data-action="toggleDirectiveThread" data-task-id="${taskId}" class="btn btn-phu btn-nho yk">Ý kiến${badgeHtml}</button>`;
}

export function directiveThreadRowHtml(taskId, colspan) {
  return `
    <tr id="directiveRow-${taskId}" class="hidden bg-slate-50 border-b">
      <td colspan="${colspan}" class="p-4">
        <div class="max-w-2xl bg-white border border-slate-200 rounded-lg p-3 space-y-3 shadow-inner">
          <div class="flex justify-between items-center border-b pb-1.5">
            <span class="text-xs font-bold text-red-800 uppercase flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Luồng Chỉ Đạo & Phản Hồi Trực Tuyến
            </span>
            <button data-action="toggleDirectiveThread" data-task-id="${taskId}" class="text-slate-400 hover:text-slate-600 text-xs font-bold">✕ Đóng</button>
          </div>
          <div id="directiveFeed-${taskId}" class="max-h-60 overflow-y-auto space-y-2.5 p-2 bg-slate-50 rounded border text-xs">
            <p class="text-center text-slate-400">Đang tải ý kiến...</p>
          </div>
          <div id="directiveWarn-${taskId}" class="hidden p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium text-center">
            Cán bộ chỉ có thể phản hồi khi nhiệm vụ đã nhận được ý kiến chỉ đạo từ Lãnh đạo.
          </div>
          <form id="directiveForm-${taskId}" data-submit="handleSendDirectiveInline" data-task-id="${taskId}" class="flex gap-2 pt-1 border-t">
            <input type="text" id="directiveInput-${taskId}" required class="flex-1 border rounded p-2 text-xs focus:ring-1 focus:ring-red-600 focus:outline-none" placeholder="Nhập ý kiến chỉ đạo hoặc báo cáo phản hồi...">
            <button type="submit" class="bg-red-800 hover:bg-red-900 text-white px-3 py-2 rounded text-xs font-bold whitespace-nowrap">Gửi</button>
          </form>
        </div>
      </td>
    </tr>
  `;
}

export function updateDirectiveRowBadge(taskId) {
  const badge = $(`directiveBadge-${taskId}`);
  if (!badge) return;
  const count = state.directiveUnread[taskId] || 0;
  badge.innerText = count;
  badge.classList.toggle('hidden', count === 0);
}

// Số ý kiến chưa đọc theo task (người khác gửi, chưa đánh dấu đọc).
export async function loadDirectiveUnreadMap() {
  const { data } = await supabase.from('task_directives')
    .select('task_id')
    .eq('is_read', false)
    .neq('sender_id', state.user.id);

  state.directiveUnread = {};
  (data || []).forEach((d) => {
    state.directiveUnread[d.task_id] = (state.directiveUnread[d.task_id] || 0) + 1;
  });
}
