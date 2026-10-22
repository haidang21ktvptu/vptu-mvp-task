// Nút quyền v3.29 ở hàng nút của ngăn chi tiết (0123–0126; chủ dự án quyết 22/10/2026 — CAU-HOI O-4…O-6). Chỉ ẩn / hiện — hàm DB là chốt:
//   - Điều chỉnh hạn: chủ trì theo dõi khi việc chưa quá hạn (quá hạn → câu nhắc đề nghị lãnh đạo gia hạn), thư ký Thường trực, tài khoản quản trị;
//   - Đổi chủ trì theo dõi: thư ký Thường trực (việc chưa hoàn thành), tài khoản quản trị;
//   - Sửa toàn bộ thông tin, Sửa văn bản giao, Mở lại nhiệm vụ (việc đã hoàn thành — ô lý do ngay dưới hàng nút): tài khoản quản trị.
// mountQuyenThem gắn các hộp (dieu-chinh-han, doi-chu-tri, sua-toan-bo, sua-van-ban, minh-chung-sua) và hành động "Mở lại".
import { escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { homNayVN } from '../../../lib/kl/ngay.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { cheDoDieuChinhHan, duocDoiChuTri, duocSuaToanBo, duocSuaVanBan, duocMoLai } from '../../../lib/kl/quyen-them.js';
import { moLaiNhiemVu } from '../../../lib/kl/quyen-them-db.js';
import { mountDieuChinhHan } from './dieu-chinh-han.js';
import { mountDoiChuTri } from './doi-chu-tri.js';
import { mountSuaToanBo } from './sua-toan-bo.js';
import { mountSuaVanBan } from './sua-van-ban.js';
import { mountMinhChungSua } from './minh-chung-sua.js';

let sauHanhDong = async () => {};
const nut = (r, action, nhan) => `<button type="button" class="nut" data-action="${action}" data-id="${r.id}">${nhan}</button>`;

export function nutQuyenHtml(r) {
  const u = state.user;
  return [cheDoDieuChinhHan(r, u, homNayVN()) === 'duoc' ? nut(r, 'moDieuChinhHan', 'Điều chỉnh hạn') : '',
    duocDoiChuTri(r, u) ? nut(r, 'moDoiChuTri', 'Đổi chủ trì theo dõi') : '',
    duocSuaToanBo(r, u) ? nut(r, 'moSuaToanBo', 'Sửa toàn bộ thông tin') : '',
    duocSuaVanBan(r, u) ? nut(r, 'moSuaVanBan', 'Sửa văn bản giao') : '',
    duocMoLai(r, u) ? `<button type="button" class="nut" data-action="moO" data-o="oMoLai-${r.id}">Mở lại nhiệm vụ</button>` : ''].join('');
}

// Dưới hàng nút: câu nhắc khi chủ trì không tự điều chỉnh hạn được (việc đã quá hạn); ô lý do "Mở lại nhiệm vụ".
export function khoiQuyenHtml(r) {
  const u = state.user;
  const nhac = cheDoDieuChinhHan(r, u, homNayVN()) === 'qua-han'
    ? '<p class="chu-phu ct-nhac-han" data-truong="nhac-gia-han">Việc đã quá hạn nên chủ trì không tự điều chỉnh hạn — đồng chí đề nghị lãnh đạo giao việc gia hạn hoặc báo thư ký Thường trực.</p>' : '';
  const moLai = duocMoLai(r, u) ? `<form class="o" id="oMoLai-${r.id}" data-submit="moLaiNhiemVu" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">
      <small>Nhiệm vụ chuyển về "Đang thực hiện"; ngày hoàn thành, đánh giá chất lượng tự xoá; minh chứng giữ nguyên. Chủ trì, người theo dõi, người giao việc được báo.</small>
      <input name="ly_do" required maxlength="500" placeholder="Lý do mở lại (bắt buộc)" aria-label="Lý do mở lại nhiệm vụ">
      <button type="submit" class="nut chinh">Mở lại</button><button type="button" class="nut" data-action="dongO" data-o="oMoLai-${r.id}">Huỷ</button></form>` : '';
  return nhac + moLai;
}

async function moLaiAction({ id, ma }, form) {
  const lyDo = String(new FormData(form).get('ly_do') || '').trim();
  if (!lyDo) { notifyError('Ghi lý do mở lại (bắt buộc).'); return; }
  try {
    await moLaiNhiemVu(id, lyDo);
    notifySuccess(`Đã mở lại ${ma} — nhiệm vụ chuyển về Đang thực hiện; minh chứng giữ nguyên.`);
    await sauHanhDong(id);
  } catch (e) { notifyError(loiDeHieu(e)); }
}

export function mountQuyenThem(registerActions, napLai) {
  sauHanhDong = napLai;
  [mountDieuChinhHan, mountDoiChuTri, mountSuaToanBo, mountSuaVanBan, mountMinhChungSua].forEach((m) => m(registerActions, napLai));
  registerActions({ moLaiNhiemVu: moLaiAction });
}
