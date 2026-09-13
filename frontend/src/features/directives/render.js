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

// Dòng luồng ý kiến ẩn dưới mỗi nhiệm vụ; mở ra trượt dọc 160ms (DESIGN mục 7).
export function directiveThreadRowHtml(taskId, colspan) {
  return `
    <tr id="directiveRow-${taskId}" class="hidden dong-y-kien">
      <td colspan="${colspan}" class="o-y-kien">
        <div class="luong">
          <div class="luong-dau">
            <h3>Ý kiến chỉ đạo và phản hồi</h3>
            <button type="button" data-action="toggleDirectiveThread" data-task-id="${taskId}" class="btn btn-phu btn-nho">Đóng</button>
          </div>
          <div id="directiveFeed-${taskId}" class="luong-feed" aria-live="polite">
            <p class="chu-phu text-center">Đang tải ý kiến</p>
          </div>
          <p id="directiveWarn-${taskId}" class="hidden luong-canh-bao">Đồng chí có thể phản hồi sau khi nhận được ý kiến chỉ đạo của Lãnh đạo hoặc Trưởng phòng.</p>
          <form id="directiveForm-${taskId}" data-submit="handleSendDirectiveInline" data-task-id="${taskId}" class="luong-gui">
            <input type="text" id="directiveInput-${taskId}" required class="input input-nho" placeholder="Nhập ý kiến chỉ đạo hoặc báo cáo phản hồi" aria-label="Nội dung ý kiến">
            <button type="submit" class="btn btn-cham btn-nho">Gửi</button>
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
