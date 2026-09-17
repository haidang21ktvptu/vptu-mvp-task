// Số chưa xử lý trên menu (GĐ22, kl_so_chua_xu_ly 0037): mọi pill có huy hiệu — Nhắn tin = tin chưa đọc (kể cả hệ thống); Điều hành / Phòng tôi
// = việc cần quyết + đề nghị chờ duyệt + việc bị từ chối (+ việc Thường trực giao chờ nhận); Việc của tôi = việc mới chờ xác nhận + Hỏa tốc
// chưa Đã nhận. Đếm ở DB trên dòng RLS trả về; ở đây chỉ cộng theo vai và vẽ. Làm mới khi vào app và theo tín hiệu của HAI kênh realtime
// sẵn có (kl_feed: nhiem_vu/chi_dao/dinh_chinh/tu_choi; realtime_feed: direct_messages) qua baoHuyHieu() — KHÔNG mở kênh riêng: mỗi đăng ký
// thêm trên nhiem_vu làm Realtime chạy RLS kl_pham_vi thêm một lần cho mọi thay đổi (staging quá tải khi nhiều trang mở). Gộp 2 giây.
import { state } from '../lib/state.js';
import { onSessionEnter, onSessionLeave } from '../auth/session.js';
import { loadSoChuaXuLy } from '../lib/kl/dieu-hanh.js';
import { setNavBadge } from '../views/shell/nav.js';

let so = null; let bat = false; let hen = null; const nghe = new Set();

export const soChuaXuLy = () => so;
export function onSoChuaXuLy(fn) { nghe.add(fn); if (so) fn(so); }

// Số trên pill đầu tiên (màn hình chính của vai).
export function tongDieuHanh(s, vai = state.user?.role_group) {
  if (!s) return 0;
  if (vai === 'A3') return Number(s.viec_moi || 0) + Number(s.hoa_toc_chi_dao || 0);
  const chung = Number(s.can_quyet || 0) + Number(s.de_nghi_cho_duyet || 0) + Number(s.bi_tu_choi || 0);
  return vai === 'A0' ? chung : chung + Number(s.tt_cho_nhan || 0);
}

let dangNap = null;
export async function lamMoiHuyHieu() {
  if (!state.user) return null;
  if (dangNap) return dangNap;   // một RPC tại một thời điểm (nhiều sự kiện realtime dồn về không gọi chồng)
  dangNap = (async () => {
    try { so = await loadSoChuaXuLy(); } catch { return so; } finally { dangNap = null; }
    setNavBadge('dhBadge', tongDieuHanh(so));
    setNavBadge('dmBubbleBadge', Number(so.nhan_tin || 0));
    nghe.forEach((fn) => fn(so));
    return so;
  })();
  return dangNap;
}
// Tín hiệu từ kênh realtime sẵn có (kl-realtime.js, realtime.js): gộp 2 giây; tab ẩn thì bỏ qua (làm mới khi hiện lại).
export function baoHuyHieu() {
  if (!bat) return;
  clearTimeout(hen);
  hen = setTimeout(() => { hen = null; if (document.visibilityState !== 'hidden') lamMoiHuyHieu(); }, 2000);
}
function onVisible() { if (document.visibilityState === 'visible' && bat) lamMoiHuyHieu(); }

function tat() {
  clearTimeout(hen); hen = null;
  document.removeEventListener('visibilitychange', onVisible);
  bat = false; so = null;
}

export function initHuyHieu() {
  onSessionEnter(() => { bat = true; document.addEventListener('visibilitychange', onVisible); lamMoiHuyHieu(); });
  onSessionLeave(tat);
}
