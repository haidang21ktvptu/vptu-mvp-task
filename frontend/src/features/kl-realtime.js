// Thời gian thực cho module KL (GĐ10 PR 10D, thiết kế 3.5, quyết định 8): Supabase Realtime postgres_changes trên
// kl_nhiem_vu / kl_chi_dao / kl_dinh_chinh (đã trong publication từ 0016; RLS lọc sự kiện theo người nghe).
// Sự kiện chỉ là TÍN HIỆU: gộp 500 ms rồi ĐỌC LẠI v_kl_dashboard (trạng thái do SQL tính, phạm vi có thể phụ thuộc
// dòng khác) — không vá từng dòng ở client. Dự phòng: kênh rời SUBSCRIBED (CHANNEL_ERROR / TIMED_OUT / CLOSED) → làm mới
// mỗi 60 giây và báo trên màn hình; kênh nối lại → tắt polling. Thêm: làm mới khi tab quay lại foreground và khi có mạng.
import { supabase } from '../lib/supabase.js';
import { onSessionLeave } from '../auth/session.js';

const GOP_MS = 500;
const CHU_KY_DU_PHONG_MS = 60_000;
const BANG = ['kl_nhiem_vu', 'kl_chi_dao', 'kl_dinh_chinh'];

let channel = null;
let onChange = null;        // hàm đọc lại do màn hình đang mở cung cấp
let onTrangThai = null;     // hàm hiện chỉ báo kết nối
let henGop = null;
let henDuPhong = null;
let cheDo = 'tat';          // 'truc-tiep' | 'du-phong' | 'tat'

export const cheDoKlRealtime = () => cheDo;
export const NHAN_CHE_DO = { 'truc-tiep': 'Cập nhật trực tiếp', 'du-phong': 'Mất kết nối trực tiếp — đang làm mới mỗi 60 giây', tat: '' };

function docLai() {
  clearTimeout(henGop);
  henGop = null;
  if (onChange && document.visibilityState !== 'hidden') onChange();
}

function gopDocLai() {
  if (henGop) return;
  henGop = setTimeout(docLai, GOP_MS);
}

function datCheDo(m) {
  if (cheDo === m) return;
  cheDo = m;
  clearInterval(henDuPhong);
  henDuPhong = m === 'du-phong' ? setInterval(docLai, CHU_KY_DU_PHONG_MS) : null;
  if (onTrangThai) onTrangThai(m);
}

function onVisible() { if (document.visibilityState === 'visible' && cheDo !== 'tat') docLai(); }
function onOnline() { if (cheDo !== 'tat') docLai(); }

// Bật khi mở một màn hình KL; gọi lại với hàm đọc lại của màn hình khác thì chỉ đổi hàm (kênh giữ nguyên).
export function batKlRealtime(docLaiCuaManHinh, hienTrangThai) {
  onChange = docLaiCuaManHinh;
  onTrangThai = hienTrangThai || null;
  if (onTrangThai) onTrangThai(cheDo === 'tat' ? 'du-phong' : cheDo);
  if (channel) return;
  channel = BANG.reduce((ch, table) => ch.on('postgres_changes', { event: '*', schema: 'public', table }, gopDocLai), supabase.channel('kl_feed'))
    .subscribe((status) => {
      // Trước khi SUBSCRIBED lần đầu vẫn ở dự phòng — màn hình không bao giờ "đứng" chờ realtime.
      datCheDo(status === 'SUBSCRIBED' ? 'truc-tiep' : 'du-phong');
    });
  datCheDo('du-phong');
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
}

export function tatKlRealtime() {
  clearTimeout(henGop); henGop = null;
  clearInterval(henDuPhong); henDuPhong = null;
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('online', onOnline);
  if (channel) supabase.removeChannel(channel);
  channel = null; onChange = null; onTrangThai = null; cheDo = 'tat';
}

// Chỉ báo kết nối trên màn hình: chấm xanh "Cập nhật trực tiếp" / chữ vàng "đang làm mới mỗi 60 giây".
export function hienKetNoi(id, m) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = NHAN_CHE_DO[m] || '';
  el.className = `ket-noi ket-noi-${m}`;
}

export function initKlRealtime() {
  onSessionLeave(tatKlRealtime);
}
