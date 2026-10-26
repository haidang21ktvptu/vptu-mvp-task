// v3.29 (0123–0126, chủ dự án quyết 22/10/2026 — CAU-HOI O-4…O-6): quyền mới trên nhiệm vụ — chỉ để ẩn / hiện nút cho đúng; hàm DB là chốt.
// - Chủ trì theo dõi (tài khoản chủ trì; việc giao cho phòng / đơn vị: người theo dõi) điều chỉnh hạn khi việc chưa quá hạn (dieu_chinh_han).
// - Thư ký Thường trực: mọi việc chưa hoàn thành, kể cả ngoài phạm vi cũ (v_nhiem_vu.trong_pham_vi = false) — cập nhật, nộp minh chứng, ghi
//   vướng mắc, sửa thông tin giao, điều chỉnh hạn, đổi chủ trì. Không: chỉ đạo, trả lại / đánh giá minh chứng, đóng nhiệm vụ.
// - Tài khoản toàn quyền (0100): sửa toàn bộ thông tin, mở lại việc đã hoàn thành, sửa văn bản giao, sửa / gỡ minh chứng, đổi chủ trì, điều chỉnh hạn.
// - v3.32 (0130): chủ trì theo dõi sửa minh chứng đã nộp của việc mình (chưa bị trả lại), kể cả thay tệp; không gỡ.
// Thuần: không DOM, không Supabase (unit test frontend/tests/quyen-them.test.mjs).
import { laToanQuyen } from '../toan-quyen.js';
import { chiXem } from './pham-vi.js';

export const laThuKyTT = (u) => Boolean(u?.thu_ky_thuong_truc) && u.role_group !== 'A0' && !u.bi_khoa && !u.is_system;
export const daXong = (r) => r?.tien_do_ma === 'HOAN_THANH';
export const chuTriTheoDoi = (r) => r?.owner_tai_khoan || r?.nguoi_theo_doi || null;   // người chịu trách nhiệm của việc
export const thuKyGhi = (r, u) => Boolean(r) && laThuKyTT(u) && !daXong(r);
// Việc "chỉ xem" với người này (thay chiXem ở các vị từ ẩn / hiện nút ghi): ngoài phạm vi xử lý (0103) mà không phải thư ký ghi được (0124).
export const chiXemVoi = (r, u) => chiXem(r) && !thuKyGhi(r, u);

// Điều chỉnh hạn → 'duoc' | 'qua-han' (chủ trì, việc đã quá hạn: đề nghị lãnh đạo giao việc gia hạn) | '' (không có). homNay: 'YYYY-MM-DD'.
export function cheDoDieuChinhHan(r, u, homNay) {
  if (!r?.han_xu_ly || !u) return '';
  if (laToanQuyen(u)) return 'duoc';
  if (daXong(r)) return '';
  if (laThuKyTT(u)) return 'duoc';
  if (chuTriTheoDoi(r) !== u.id) return '';
  return r.han_xu_ly < homNay ? 'qua-han' : 'duoc';
}
export const duocDoiChuTri = (r, u) => Boolean(r) && (laToanQuyen(u) || thuKyGhi(r, u));
export const duocSuaToanBo = (r, u) => Boolean(r) && laToanQuyen(u);
export const duocMoLai = (r, u) => laToanQuyen(u) && daXong(r);
export const duocSuaVanBan = (r, u) => Boolean(r?.van_ban_id) && laToanQuyen(u);
// Minh chứng đã nộp (v3.32 — 0130, CAU-HOI R-1…R-3): sửa (mọi ô, thay tệp) — tài khoản quản trị, hoặc chủ trì theo dõi khi minh chứng chưa bị trả
// lại (mọi lúc, kể cả việc đã hoàn thành / đã đánh giá); gỡ — chỉ tài khoản quản trị. m: dòng minh chứng (hop_le false = bị trả lại).
export const duocSuaMinhChung = (u, r, m) => Boolean(u) && (laToanQuyen(u) || (Boolean(r) && chuTriTheoDoi(r) === u.id && m?.hop_le !== false));
export const duocGoMinhChung = (u) => laToanQuyen(u);
// Lần gia hạn tiếp theo nếu lùi hạn (đúng như hàm DB: lùi = so_lan_gia_han + 1, rút ngắn không cộng). → chữ ghi chú dưới ô hạn mới. homNay: hạn mới
// không trước hôm nay (trừ tài khoản toàn quyền — choQuaKhu, đính chính).
export function ghiChuHanMoi(r, hanMoi, { homNay = '', choQuaKhu = false } = {}) {
  if (!hanMoi) return '';
  if (hanMoi === r?.han_xu_ly) return 'Hạn mới trùng hạn hiện tại.';
  if (r?.ngay_ban_hanh && hanMoi < r.ngay_ban_hanh) return 'Hạn mới không được trước ngày ban hành văn bản.';
  if (!choQuaKhu && homNay && hanMoi < homNay) return 'Hạn mới không được trước hôm nay.';
  if (!r?.han_xu_ly) return '';
  return hanMoi > r.han_xu_ly ? `Lùi hạn: tính là gia hạn lần ${(r.so_lan_gia_han || 0) + 1}.` : 'Rút ngắn hạn: không tính lần gia hạn.';
}
