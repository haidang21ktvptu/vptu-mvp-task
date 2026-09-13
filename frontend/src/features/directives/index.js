// Luồng ý kiến chỉ đạo theo nhiệm vụ (DIR-1…4): mở/đóng, nạp, gửi, đánh dấu đã đọc.
// A3 chỉ trả lời khi đã có ý kiến từ A1/A2 (DIR-2). Đánh dấu đã đọc qua hàm mark_directives_read (RLS-8).
import { supabase } from '../../lib/supabase.js';
import { $, show, escapeHtml, formatTime } from '../../lib/dom.js';
import { senderRoleTag } from '../../lib/constants.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { updateDirectiveRowBadge } from './render.js';

function directiveItemHtml(d) {
  const name = d.sender?.full_name || 'Cán bộ';
  return `
    <div class="flex gap-2.5 items-start">
      <div class="w-6 h-6 rounded-full bg-slate-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">${escapeHtml(name.charAt(0))}</div>
      <div class="flex-1 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
        <div class="flex justify-between items-center mb-1">
          <span class="font-bold text-[11px] text-slate-800">${escapeHtml(name)} <span class="text-slate-400 font-normal">(${senderRoleTag(d.sender?.role_group)})</span></span>
          <span class="text-[9px] text-slate-400">${formatTime(d.created_at)}</span>
        </div>
        <p class="text-slate-700 whitespace-pre-wrap leading-relaxed">${escapeHtml(d.content)}</p>
      </div>
    </div>
  `;
}

export async function loadDirectiveThread(taskId, markAsRead = false) {
  const feed = $(`directiveFeed-${taskId}`);
  if (!feed) return;

  const { data } = await supabase.from('task_directives')
    .select('*, sender:sender_id(full_name, role_group)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  const items = data || [];

  // DIR-2: cán bộ chỉ phản hồi được khi đã có ý kiến của Lãnh đạo/Trưởng phòng.
  let canReply = true;
  if (state.user.role_group === 'A3') {
    canReply = items.some((d) => d.sender?.role_group === 'A1' || d.sender?.role_group === 'A2');
  }
  show(`directiveWarn-${taskId}`, !canReply);
  show(`directiveForm-${taskId}`, canReply);

  if (items.length === 0) {
    feed.innerHTML = `<p class="text-center text-slate-400 py-2">Chưa có ý kiến nào cho nhiệm vụ này.</p>`;
  } else {
    feed.innerHTML = items.map(directiveItemHtml).join('');
    feed.scrollTop = feed.scrollHeight;
  }

  if (markAsRead) {
    await supabase.rpc('mark_directives_read', { p_task_id: taskId });
    state.directiveUnread[taskId] = 0;
    updateDirectiveRowBadge(taskId);
  }
}

export function isDirectiveThreadOpen(taskId) {
  const row = $(`directiveRow-${taskId}`);
  return Boolean(row) && !row.classList.contains('hidden');
}

async function toggleDirectiveThread({ taskId }) {
  const row = $(`directiveRow-${taskId}`);
  if (!row) return;
  const isOpening = row.classList.contains('hidden');
  row.classList.toggle('hidden');
  if (isOpening) await loadDirectiveThread(taskId, true);
}

async function handleSendDirectiveInline({ taskId }) {
  const input = $(`directiveInput-${taskId}`);
  const content = input.value.trim();
  if (!content) return;

  const { error } = await supabase.from('task_directives').insert([{
    task_id: taskId,
    sender_id: state.user.id,
    content,
    is_read: false,
  }]);
  if (!error) {
    input.value = '';
    await loadDirectiveThread(taskId, false);
  }
}

export function initDirectives() {
  registerActions({ toggleDirectiveThread, handleSendDirectiveInline });
}
