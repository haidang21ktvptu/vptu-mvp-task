// Realtime (DIR-4, MSG-2): nghe INSERT trên task_directives và direct_messages; chỉ những dòng
// RLS cho đọc mới tới được client. Đăng ký khi vào app, huỷ khi đăng xuất.
import { supabase } from '../lib/supabase.js';
import { $ } from '../lib/dom.js';
import { state, findAccount } from '../lib/state.js';
import { onSessionEnter, onSessionLeave } from '../auth/session.js';
import { updateDirectiveRowBadge } from './directives/render.js';
import { loadDirectiveThread, isDirectiveThreadOpen } from './directives/index.js';
import { loadDMUnreadMap } from './messages/index.js';
import { loadDirectMessages, isChatOpenWith, showDMToast } from './messages/chat.js';

let channel = null;

async function onDirectiveInsert(newMsg) {
  if (isDirectiveThreadOpen(newMsg.task_id)) {
    await loadDirectiveThread(newMsg.task_id, true);
    return;
  }
  if (newMsg.sender_id === state.user.id) return;
  state.directiveUnread[newMsg.task_id] = (state.directiveUnread[newMsg.task_id] || 0) + 1;
  updateDirectiveRowBadge(newMsg.task_id);
  // Tô nền vàng nhạt dòng nhiệm vụ có ý kiến mới (lớp dong-moi, features.css).
  $(`taskRow-${newMsg.task_id}`)?.classList.add('dong-moi');
}

async function onMessageInsert(dm) {
  if (dm.receiver_id !== state.user.id) return;
  if (isChatOpenWith(dm.sender_id)) {
    await loadDirectMessages(dm.sender_id, true);
    return;
  }
  state.dmUnread[dm.sender_id] = (state.dmUnread[dm.sender_id] || 0) + 1;
  loadDMUnreadMap();
  const sender = findAccount(dm.sender_id);
  showDMToast(sender ? sender.full_name : 'Cán bộ', dm.content, dm.sender_id);
}

export function setupRealtimeSubscriptions() {
  teardownRealtime();
  channel = supabase.channel('realtime_feed')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_directives' }, (payload) => onDirectiveInsert(payload.new))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => onMessageInsert(payload.new))
    .subscribe();
}

export function teardownRealtime() {
  if (channel) channel.unsubscribe();
  channel = null;
}

export function initRealtime() {
  onSessionEnter(setupRealtimeSubscriptions);
  onSessionLeave(teardownRealtime);
}
