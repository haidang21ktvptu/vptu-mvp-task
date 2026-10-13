// Realtime (MSG-2): nghe INSERT trên direct_messages; chỉ những dòng RLS cho đọc mới tới được client. Đăng ký khi vào app,
// huỷ khi đăng xuất. Kênh luồng ý kiến theo tasks (task_directives) đã bỏ ở GĐ14 — chỉ đạo theo nhiệm vụ là GĐ18.
import { supabase } from '../lib/supabase.js';
import { state } from '../lib/state.js';
import { onSessionEnter, onSessionLeave } from '../auth/session.js';
import { onTinHeThongMoi } from './thong-bao/index.js';
import { baoHuyHieu } from './huy-hieu.js';

let channel = null;

// v3.23 (chủ dự án 13/10/2026): bỏ nhắn tin 1-1 — chỉ tin hệ thống (chuông + toast mở nhiệm vụ); tin người cũ giữ trong cơ sở dữ liệu.
function onMessageInsert(dm) {
  if (dm.receiver_id !== state.user.id) return;
  baoHuyHieu(); // số chưa xử lý (dải Cần xử lý ngay, chuông), GĐ22
  if (dm.loai === 'he_thong') onTinHeThongMoi(dm); // GĐ15: chuông + toast mở nhiệm vụ
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
