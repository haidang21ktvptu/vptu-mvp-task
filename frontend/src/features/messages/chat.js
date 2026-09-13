// Khung chat 1-1 (MSG-1/2): nạp hội thoại, gửi tin, đánh dấu đã đọc qua mark_messages_read (RLS-8),
// toast báo tin nhắn mới (dùng bởi realtime).
import { supabase } from '../../lib/supabase.js';
import { $, show, setText, escapeHtml, formatTime } from '../../lib/dom.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { state, findAccount } from '../../lib/state.js';
import { closeDMPicker, loadDMUnreadMap } from './index.js';

const TOAST_MS = 8000;

function messageHtml(m) {
  const isMe = m.sender_id === state.user.id;
  return `
    <div class="tin ${isMe ? 'tin-cua-toi' : ''}">${escapeHtml(m.content)}</div>
    <span class="tin-gio">${formatTime(m.created_at)}</span>
  `;
}

export async function loadDirectMessages(peerId, markAsRead = false) {
  const me = state.user.id;
  const chatBox = $('dmChatBox');
  const { data } = await supabase.from('direct_messages')
    .select('*')
    .or(`and(sender_id.eq.${me},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${me})`)
    .order('created_at', { ascending: true });

  if (!data || data.length === 0) {
    chatBox.innerHTML = `<p class="chu-phu text-center py-4">Chưa có tin nhắn nào giữa hai đồng chí.</p>`;
  } else {
    chatBox.innerHTML = data.map(messageHtml).join('');
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  if (markAsRead) {
    await supabase.rpc('mark_messages_read', { p_peer_id: peerId });
    state.dmUnread[peerId] = 0;
    loadDMUnreadMap();
  }
}

export async function openChatWith(peerId) {
  state.currentDMPeerId = peerId;
  const peer = findAccount(peerId);
  closeDMPicker();
  setText('dmChatHeaderName', peer ? peer.full_name : 'Đồng chí');
  setText('dmChatHeaderRole', peer ? `${peer.position_title} · ${DEPT_NAMES[peer.department]}` : '');
  show('dmModal', true);
  await loadDirectMessages(peerId, true);
}

export const openDMChat = ({ peerId }) => openChatWith(peerId);

export function closeDMModal() {
  show('dmModal', false);
  state.currentDMPeerId = null;
}

export function isChatOpenWith(peerId) {
  return state.currentDMPeerId === peerId && !$('dmModal').classList.contains('hidden');
}

export async function handleSendDM() {
  if (!state.currentDMPeerId) return;
  const input = $('dmInput');
  const text = input.value.trim();
  if (!text) return;

  const { error } = await supabase.from('direct_messages').insert([{
    sender_id: state.user.id,
    receiver_id: state.currentDMPeerId,
    content: text,
    is_read: false,
  }]);
  if (!error) {
    input.value = '';
    await loadDirectMessages(state.currentDMPeerId, false);
  }
}

let toastTimer = null;

export function showDMToast(senderName, content, senderId) {
  setText('toastSender', `Tin nhắn từ ${senderName}`);
  setText('toastContent', content);
  $('toastActionBtn').onclick = () => {
    closeToast();
    openChatWith(senderId);
  };
  show('realtimeToast', true);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(closeToast, TOAST_MS);
}

export function closeToast() {
  show('realtimeToast', false);
}
