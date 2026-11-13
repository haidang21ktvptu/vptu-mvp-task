// Phân hệ Nhiệm vụ quý BTV — thời gian thực: chủ trì theo dõi cập nhật → màn của lãnh đạo đang mở biết ngay (publication 0139: nvq_nhiem_vu, nvq_san_pham,
// nvq_cap_nhat, nvq_y_kien — RLS SELECT của người nghe lọc sự kiện). Sự kiện chỉ là tín hiệu, gộp 2 giây rồi gọi hàm của phân hệ (index.js quyết định nạp
// lại ngay — màn chỉ xem — hay hiện dải "Có cập nhật mới" để không mất chữ đang gõ). Kênh mở khi vào phân hệ, đóng khi đăng xuất; tab quay lại → gọi.
import { supabase } from '../supabase.js';

const BANG = ['nvq_nhiem_vu', 'nvq_san_pham', 'nvq_cap_nhat', 'nvq_y_kien'];
let kenh = null; let khiDoi = null; let hen = null; let ids = new Set();

function giao() {
  clearTimeout(hen); hen = null;
  const ds = [...ids]; ids = new Set();
  if (document.visibilityState !== 'hidden' && khiDoi) khiDoi(ds);
}
function nhan(p) {
  const id = p.table === 'nvq_nhiem_vu' ? p.new?.id : p.new?.nhiem_vu_id;
  if (id) ids.add(id);
  clearTimeout(hen); hen = setTimeout(giao, 2000);
}
const khiHien = () => { if (document.visibilityState === 'visible' && kenh && khiDoi) khiDoi([]); };

export function batNvqRealtime(fn) {
  khiDoi = fn;
  if (kenh) return;
  kenh = BANG.flatMap((table) => ['INSERT', 'UPDATE'].map((event) => ({ table, event })))
    .reduce((ch, { table, event }) => ch.on('postgres_changes', { event, schema: 'public', table }, nhan), supabase.channel('nvq_feed'))
    .subscribe();
  document.addEventListener('visibilitychange', khiHien);
}
export function tatNvqRealtime() {
  clearTimeout(hen); hen = null; ids = new Set();
  document.removeEventListener('visibilitychange', khiHien);
  if (kenh) supabase.removeChannel(kenh);
  kenh = null; khiDoi = null;
}
