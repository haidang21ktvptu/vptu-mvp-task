// Thời gian thực cho module KL (GĐ10 PR 10D, thiết kế 3.5, quyết định 8; PR-2a B6): Supabase Realtime postgres_changes, chỉ INSERT/UPDATE
// trên nhiem_vu, chi_dao, minh_chung (publication từ 0051), tu_choi (0037), dinh_chinh (0016: đề nghị / duyệt đính chính chỉ ghi dinh_chinh
// nhưng đổi dang_dinh_chinh, nhóm "Đang tra soát" của việc) — RLS SELECT của người nghe lọc sự kiện (test kl-realtime-su-kien); bỏ DELETE
// (chỉ quản trị dọn dữ liệu — dự phòng 60 giây / chuyển màn nạp lại). Sự kiện chỉ là TÍN HIỆU kèm {bang, id việc}: gộp 1,5 giây (tối đa 5 giây kể từ sự kiện
// đầu) rồi giao cho hàm của màn hình đang mở — màn hình tự quyết nạp lại một việc (đã có trong danh sách) hay cả màn; trạng thái vẫn do SQL
// tính, không vá dòng ở client. Dự phòng: kênh rời SUBSCRIBED (CHANNEL_ERROR / TIMED_OUT / CLOSED) → làm mới
// mỗi 60 giây và báo trên màn hình; kênh nối lại → tắt polling. Thêm: làm mới khi tab quay lại foreground; sự kiện window
// 'offline' → dự phòng NGAY (không chờ heartbeat socket ~30 giây), 'online' → mở kênh mới và làm mới (GĐ15).
import { supabase } from '../lib/supabase.js';
import { onSessionLeave } from '../auth/session.js';
import { baoHuyHieu } from './huy-hieu.js';

const GOP_MS = 1500;
const GOP_TOI_DA_MS = 5000;
const CHU_KY_DU_PHONG_MS = 60_000;
const CHO_KET_NOI_MS = 4_000;   // chưa SUBSCRIBED sau chừng này mới coi là mất kết nối (tránh nháy vàng lúc mở màn hình)
const BANG = ['nhiem_vu', 'chi_dao', 'minh_chung', 'tu_choi', 'dinh_chinh'];   // tên bảng thật (0023); view bí danh kl_* không phát sự kiện

let channel = null;
let onChange = null;        // hàm đọc lại do màn hình đang mở cung cấp
let nghePhu = null;         // v9 đợt 2: ngăn chi tiết dùng chung (nạp lại việc đang mở trong ngăn), chạy song song với màn hình bên dưới
export const datNghePhu = (fn) => { nghePhu = fn; };
let onTrangThai = null;     // hàm hiện chỉ báo kết nối
let henGop = null;
let henToiDa = null;
let suKien = [];            // [{ bang, id }] gộp chờ giao cho màn hình
let henDuPhong = null;
let henChoKetNoi = null;
let cheDo = 'tat';          // 'ket-noi' (đang nối, chưa cảnh báo) | 'truc-tiep' | 'du-phong' | 'tat'

export const cheDoKlRealtime = () => cheDo;
export const NHAN_CHE_DO = { 'ket-noi': 'Đang kết nối…', 'truc-tiep': 'Cập nhật trực tiếp', 'du-phong': 'Mất kết nối trực tiếp — đang làm mới mỗi 60 giây', tat: '' };
// Tên lớp nguyên văn (Tailwind cắt lớp ghép chuỗi khỏi bản build — xem CHANGELOG mục 19, PR 10C).
const LOP_CHE_DO = { 'ket-noi': 'ket-noi ket-noi-dang-noi', 'truc-tiep': 'ket-noi ket-noi-truc-tiep', 'du-phong': 'ket-noi ket-noi-du-phong', tat: 'ket-noi' };

// Giao lượt sự kiện đã gộp cho màn hình; gọi không kèm sự kiện (dự phòng, tab quay lại, có mạng lại) = nạp cả màn.
function docLai() {
  clearTimeout(henGop); clearTimeout(henToiDa);
  henGop = null; henToiDa = null;
  const ds = suKien; suKien = [];
  if (document.visibilityState === 'hidden') return;
  if (onChange) onChange(ds);
  if (nghePhu) nghePhu(ds);
}

function gopDocLai(p) {
  baoHuyHieu();   // số chưa xử lý trên menu dùng chung tín hiệu này (GĐ22), không mở kênh riêng
  suKien.push({ bang: p.table, id: p.table === 'nhiem_vu' ? p.new?.id : p.new?.nhiem_vu_id });
  clearTimeout(henGop);
  henGop = setTimeout(docLai, GOP_MS);
  if (!henToiDa) henToiDa = setTimeout(docLai, GOP_TOI_DA_MS);
}
const docLaiCaMan = () => { suKien = []; docLai(); };

function datCheDo(m) {
  if (cheDo === m) return;
  cheDo = m;
  if (m !== 'ket-noi') { clearTimeout(henChoKetNoi); henChoKetNoi = null; }
  clearInterval(henDuPhong);
  henDuPhong = m === 'du-phong' ? setInterval(docLaiCaMan, CHU_KY_DU_PHONG_MS) : null;
  if (onTrangThai) onTrangThai(m);
}

function moKenh() {
  channel = BANG.flatMap((table) => ['INSERT', 'UPDATE'].map((event) => ({ table, event })))
    .reduce((ch, { table, event }) => ch.on('postgres_changes', { event, schema: 'public', table }, gopDocLai), supabase.channel('kl_feed'))
    .subscribe((status) => {
      // Đang nối mà nhận CLOSED/lỗi thì vẫn chờ hết CHO_KET_NOI_MS (supabase-js tự thử lại), không nháy vàng ngay.
      if (status === 'SUBSCRIBED') datCheDo('truc-tiep');
      else if (cheDo !== 'ket-noi') datCheDo('du-phong');
    });
  // Lúc mở: "Đang kết nối…" (không cảnh báo); sau CHO_KET_NOI_MS chưa SUBSCRIBED mới sang dự phòng có polling.
  datCheDo('ket-noi');
  henChoKetNoi = setTimeout(() => { if (cheDo === 'ket-noi') datCheDo('du-phong'); }, CHO_KET_NOI_MS);
}

function onVisible() { if (document.visibilityState === 'visible' && cheDo !== 'tat') docLaiCaMan(); }
function onOffline() { if (cheDo !== 'tat') datCheDo('du-phong'); }
// Có mạng lại: không chờ socket cũ tự phát hiện — bỏ kênh cũ, mở kênh mới, làm mới ngay (người dùng thấy số liệu mới tức thì).
function onOnline() {
  if (cheDo === 'tat') return;
  const cu = channel; channel = null;
  if (cu) supabase.removeChannel(cu);
  moKenh();
  docLaiCaMan();
}

// Bật khi mở một màn hình KL; gọi lại với hàm đọc lại của màn hình khác thì chỉ đổi hàm (kênh giữ nguyên).
// docLaiCuaManHinh(suKien): suKien = [{ bang, id }] (rỗng = nạp cả màn).
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
  clearTimeout(henToiDa); henToiDa = null; suKien = [];
  clearInterval(henDuPhong); henDuPhong = null;
  clearTimeout(henChoKetNoi); henChoKetNoi = null;
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
  if (channel) supabase.removeChannel(channel);
  channel = null; onChange = null; onTrangThai = null; nghePhu = null; cheDo = 'tat';
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
