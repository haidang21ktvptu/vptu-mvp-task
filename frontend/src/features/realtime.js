// Realtime (MSG-2): nghe INSERT trên direct_messages; chỉ những dòng RLS cho đọc mới tới được client. Đăng ký khi vào app,
// huỷ khi đăng xuất. Kênh luồng ý kiến theo tasks (task_directives) đã bỏ ở GĐ14 — chỉ đạo theo nhiệm vụ là GĐ18.
import { supabase } from '../lib/supabase.js';
import { state, findAccount } from '../lib/state.js';
import { onSessionEnter, onSessionLeave } from '../auth/session.js';
import { loadDMUnreadMap } from './messages/index.js';
import { loadDirectMessages, isChatOpenWith, showDMToast } from './messages/chat.js';
import { onTinHeThongMoi } from './thong-bao/index.js';

let channel = null;

async function onMessageInsert(dm) {
  if (dm.receiver_id !== state.user.id) return;
  if (dm.loai === 'he_thong') { onTinHeThongMoi(dm); return; } // GĐ15: chuông + toast mở nhiệm vụ
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
