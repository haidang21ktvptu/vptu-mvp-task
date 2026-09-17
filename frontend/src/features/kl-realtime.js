// Thời gian thực cho module KL (GĐ10 PR 10D, thiết kế 3.5, quyết định 8): Supabase Realtime postgres_changes trên
// nhiem_vu / chi_dao / dinh_chinh (tên từ 0023, trước đó kl_*; đã trong publication từ 0016; RLS lọc sự kiện theo người nghe).
// Sự kiện chỉ là TÍN HIỆU: gộp 500 ms rồi ĐỌC LẠI v_kl_dashboard (trạng thái do SQL tính, phạm vi có thể phụ thuộc
// dòng khác) — không vá từng dòng ở client. Dự phòng: kênh rời SUBSCRIBED (CHANNEL_ERROR / TIMED_OUT / CLOSED) → làm mới
// mỗi 60 giây và báo trên màn hình; kênh nối lại → tắt polling. Thêm: làm mới khi tab quay lại foreground; sự kiện window
// 'offline' → dự phòng NGAY (không chờ heartbeat socket ~30 giây), 'online' → mở kênh mới và làm mới (GĐ15).
import { supabase } from '../lib/supabase.js';
import { onSessionLeave } from '../auth/session.js';
import { baoHuyHieu } from './huy-hieu.js';

const GOP_MS = 500;
const CHU_KY_DU_PHONG_MS = 60_000;
const CHO_KET_NOI_MS = 4_000;   // chưa SUBSCRIBED sau chừng này mới coi là mất kết nối (tránh nháy vàng lúc mở màn hình)
const BANG = ['nhiem_vu', 'chi_dao', 'dinh_chinh', 'tu_choi'];   // tên bảng thật (0023); view bí danh kl_* không phát sự kiện; tu_choi (0037, GĐ22)

let channel = null;
let onChange = null;        // hàm đọc lại do màn hình đang mở cung cấp
let onTrangThai = null;     // hàm hiện chỉ báo kết nối
let henGop = null;
let henDuPhong = null;
let henChoKetNoi = null;
let cheDo = 'tat';          // 'ket-noi' (đang nối, chưa cảnh báo) | 'truc-tiep' | 'du-phong' | 'tat'

export const cheDoKlRealtime = () => cheDo;
export const NHAN_CHE_DO = { 'ket-noi': 'Đang kết nối…', 'truc-tiep': 'Cập nhật trực tiếp', 'du-phong': 'Mất kết nối trực tiếp — đang làm mới mỗi 60 giây', tat: '' };
// Tên lớp nguyên văn (Tailwind cắt lớp ghép chuỗi khỏi bản build — xem CHANGELOG mục 19, PR 10C).
const LOP_CHE_DO = { 'ket-noi': 'ket-noi ket-noi-dang-noi', 'truc-tiep': 'ket-noi ket-noi-truc-tiep', 'du-phong': 'ket-noi ket-noi-du-phong', tat: 'ket-noi' };

function docLai() {
  clearTimeout(henGop);
  henGop = null;
  if (onChange && document.visibilityState !== 'hidden') onChange();
}

function gopDocLai() {
  baoHuyHieu();   // số chưa xử lý trên menu dùng chung tín hiệu này (GĐ22), không mở kênh riêng
  if (henGop) return;
  henGop = setTimeout(docLai, GOP_MS);
}

function datCheDo(m) {
  if (cheDo === m) return;
  cheDo = m;
  if (m !== 'ket-noi') { clearTimeout(henChoKetNoi); henChoKetNoi = null; }
  clearInterval(henDuPhong);
  henDuPhong = m === 'du-phong' ? setInterval(docLai, CHU_KY_DU_PHONG_MS) : null;
  if (onTrangThai) onTrangThai(m);
}

function moKenh() {
  channel = BANG.reduce((ch, table) => ch.on('postgres_changes', { event: '*', schema: 'public', table }, gopDocLai), supabase.channel('kl_feed'))
    .subscribe((status) => {
      // Đang nối mà nhận CLOSED/lỗi thì vẫn chờ hết CHO_KET_NOI_MS (supabase-js tự thử lại), không nháy vàng ngay.
      if (status === 'SUBSCRIBED') datCheDo('truc-tiep');
      else if (cheDo !== 'ket-noi') datCheDo('du-phong');
    });
  // Lúc mở: "Đang kết nối…" (không cảnh báo); sau CHO_KET_NOI_MS chưa SUBSCRIBED mới sang dự phòng có polling.
  datCheDo('ket-noi');
  henChoKetNoi = setTimeout(() => { if (cheDo === 'ket-noi') datCheDo('du-phong'); }, CHO_KET_NOI_MS);
}

function onVisible() { if (document.visibilityState === 'visible' && cheDo !== 'tat') docLai(); }
function onOffline() { if (cheDo !== 'tat') datCheDo('du-phong'); }
// Có mạng lại: không chờ socket cũ tự phát hiện — bỏ kênh cũ, mở kênh mới, làm mới ngay (người dùng thấy số liệu mới tức thì).
function onOnline() {
  if (cheDo === 'tat') return;
  const cu = channel; channel = null;
  if (cu) supabase.removeChannel(cu);
  moKenh();
  docLai();
}

// Bật khi mở một màn hình KL; gọi lại với hàm đọc lại của màn hình khác thì chỉ đổi hàm (kênh giữ nguyên).
export function batKlRealtime(docLaiCuaManHinh, hienTrangThai) {
  onChange = docLaiCuaManHinh;
  onTrangThai = hienTrangThai || null;
  if (onTrangThai) onTrangThai(cheDo === 'tat' ? 'ket-noi' : cheDo);
  if (channel) return;
  moKenh();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
}

export function tatKlRealtime() {
  clearTimeout(henGop); henGop = null;
  clearInterval(henDuPhong); henDuPhong = null;
  clearTimeout(henChoKetNoi); henChoKetNoi = null;
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
  if (channel) supabase.removeChannel(channel);
  channel = null; onChange = null; onTrangThai = null; cheDo = 'tat';
}

// Chỉ báo kết nối trên màn hình: chấm xanh "Cập nhật trực tiếp" / chữ vàng "đang làm mới mỗi 60 giây".
export function hienKetNoi(id, m) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = NHAN_CHE_DO[m] || '';
  el.className = LOP_CHE_DO[m] || 'ket-noi';
}

export function initKlRealtime() {
  onSessionLeave(tatKlRealtime);
}
