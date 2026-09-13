// Nhắn tin riêng 1-1 (MSG-1/2): bong bóng + huy hiệu chưa đọc, danh bạ theo phạm vi vai trò
// (A1 tất cả; A2 A1 + phòng mình; A3 phòng mình). Khung chat ở ./chat.js.
import { supabase } from '../../lib/supabase.js';
import { $, show, escapeHtml } from '../../lib/dom.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { messagesTemplate } from './template.js';
import { openDMChat, closeDMModal, handleSendDM, closeToast } from './chat.js';

export async function loadDMUnreadMap() {
  const { data } = await supabase.from('direct_messages')
    .select('sender_id')
    .eq('receiver_id', state.user.id)
    .eq('is_read', false);

  state.dmUnread = {};
  let total = 0;
  (data || []).forEach((m) => {
    state.dmUnread[m.sender_id] = (state.dmUnread[m.sender_id] || 0) + 1;
    total++;
  });

  const badge = $('dmBubbleBadge');
  badge.innerText = total;
  show(badge, total > 0);
}

function canChatWith(a) {
  const me = state.user;
  if (a.id === me.id) return false;
  if (me.role_group === 'A1') return true;
  if (me.role_group === 'A2') return a.role_group === 'A1' || a.department === me.department;
  return a.department === me.department;
}

function contactHtml(a) {
  const unread = state.dmUnread[a.id] || 0;
  return `
    <div data-action="openDMChat" data-peer-id="${a.id}" class="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition">
      <div>
        <div class="font-bold text-slate-800">${escapeHtml(a.full_name)}</div>
        <div class="text-[10px] text-slate-500">${escapeHtml(a.position_title)} — ${DEPT_NAMES[a.department] || ''}</div>
      </div>
      ${unread > 0 ? `<span class="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">${unread} mới</span>` : ''}
    </div>
  `;
}

function renderDMPickerList(filterKw = '') {
  const listDiv = $('dmContactList');
  const filtered = state.accounts.filter((a) => {
    if (!canChatWith(a)) return false;
    if (!filterKw) return true;
    const text = `${a.full_name} ${DEPT_NAMES[a.department] || ''} ${a.position_title}`.toLowerCase();
    return text.includes(filterKw);
  });

  listDiv.innerHTML = filtered.length === 0
    ? `<p class="text-center text-slate-400 py-6">Không có cán bộ phù hợp trong phạm vi liên lạc cho phép.</p>`
    : filtered.map(contactHtml).join('');
}

function openDMPicker() {
  show('dmPickerModal', true);
  renderDMPickerList();
}

export function closeDMPicker() {
  show('dmPickerModal', false);
}

export function mountMessages() {
  document.body.insertAdjacentHTML('beforeend', messagesTemplate);
  $('dmSearchContact').addEventListener('input', (e) => renderDMPickerList(e.target.value.trim().toLowerCase()));
  registerActions({ openDMPicker, closeDMPicker, openDMChat, closeDMModal, handleSendDM, closeToast });
}
