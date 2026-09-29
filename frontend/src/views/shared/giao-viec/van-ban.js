// Ô chọn văn bản của Giao việc (PR-2a B6): tìm theo số hiệu / trích yếu ở DB, 50 văn bản mỗi lần, "Xem thêm văn bản" lấy trang kế —
// không tải toàn bộ văn bản trong phạm vi mỗi lần mở biểu mẫu. Văn bản của việc cha (giao tiếp xuống) luôn có trong ô dù ngoài trang đầu.
import { $, show, setText, escapeHtml } from '../../../lib/dom.js';
import { timVanBan, vanBanTheoId } from '../../../lib/kl/du-lieu.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { tenLoaiVanBan } from '../kl/them-owner.js';

export const MOI = '__moi__';
export const vb = { ds: [], moi: [] };   // ds: trang đã tải; moi: văn bản vừa tạo trong phiên biểu mẫu
let tuKhoa = ''; let trang = 0; let luot = 0; let henTim = null;
const opt = (v, t) => `<option value="${escapeHtml(v)}">${escapeHtml(t)}</option>`;
export const nhanVanBan = (h) => `${tenLoaiVanBan(h.loai)} · ${h.so_hoi_nghi ? `HN ${h.so_hoi_nghi} · ` : ''}${h.so_ket_luan} · BH ${formatNgay(h.ngay_ban_hanh)}${h.trich_yeu ? ` · ${h.trich_yeu.slice(0, 60)}` : ''}`;
export const timTrongDs = (id) => vb.moi.find((h) => h.id === id) || vb.ds.find((h) => h.id === id);

function ve(nhanMoi, giu) {
  const sel = $('klThVanBan');
  const ds = [...vb.moi, ...vb.ds.filter((h) => !vb.moi.some((m) => m.id === h.id))];
  sel.innerHTML = opt(MOI, nhanMoi) + ds.map((h) => opt(h.id, nhanVanBan(h))).join('');
  if (giu && [...sel.options].some((o) => o.value === giu)) sel.value = giu;
}

// Nạp trang đầu (hoặc trang kế khi them = true). Trả true nếu có ít nhất một văn bản. kem: id văn bản phải có trong ô (việc cha).
export async function napVanBan({ them = false, nhanMoi, giu, kem } = {}) {
  const lan = ++luot;
  if (!them) trang = 0; else trang += 1;
  const { ds, conNua } = await timVanBan(tuKhoa, trang);
  if (lan !== luot) return vb.ds.length > 0;
  vb.ds = them ? [...vb.ds, ...ds.filter((h) => !vb.ds.some((x) => x.id === h.id))] : ds;
  if (kem && !timTrongDs(kem)) { const h = await vanBanTheoId(kem); if (h) vb.ds.unshift(h); }
  ve(nhanMoi, giu ?? $('klThVanBan').value);
  show('gvVbXemThem', conNua);
  setText('gvVbDem', tuKhoa ? `${vb.ds.length} văn bản khớp "${tuKhoa}"${conNua ? ' (còn nữa)' : ''}` : '');
  return vb.ds.length > 0;
}
export function datLaiVanBan() { tuKhoa = ''; vb.moi = []; $('klThVanBanTim').value = ''; }
export const themVanBanMoi = (h, nhanMoi) => { vb.moi.unshift(h); ve(nhanMoi, h.id); };

// Gõ tìm: chờ 300 ms rồi tìm ở DB, tự chọn kết quả đầu (giữ hành vi cũ của ô lọc).
export function timKhiGo(nhanMoi, sauKhiChon) {
  clearTimeout(henTim);
  henTim = setTimeout(async () => {
    tuKhoa = $('klThVanBanTim').value.trim();
    try {
      await napVanBan({ nhanMoi, giu: '' });
      if (tuKhoa && vb.ds.length) $('klThVanBan').value = vb.ds[0].id;
      sauKhiChon();
    } catch { /* lỗi mạng: giữ danh sách cũ */ }
  }, 300);
}
