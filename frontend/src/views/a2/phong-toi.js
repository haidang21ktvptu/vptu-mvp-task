// Ba nhóm mục của "Phòng tôi hôm nay" (A2): chỉ đạo từ Văn phòng chờ phòng phản hồi, việc Đỏ của phòng, sắp đến hạn trong phòng.
// Mỗi mục là một .muc có mép trái theo mức; hành động một dòng ngay dưới (Nhắc chuyên viên = DON_DOC, Phản hồi thay = chi_dao_phan_hoi).
import { escapeHtml, formatDateTime } from '../../lib/dom.js';
import { state, findAccount } from '../../lib/state.js';
import { formatNgay, ghiChuHan, homNayVN } from '../../lib/kl/ngay.js';
import { TEN_LOAI_CHI_DAO } from '../../lib/kl/dieu-hanh.js';
import { tenKhau } from '../../lib/kl/nhan.js';
import { dh, timRow, viecDo } from '../shared/dieu-hanh/du-lieu.js';
import { sanPhamThieu } from '../shared/dieu-hanh/the-viec.js';

const oHtml = (id, submit, data, placeholder, nhan) => `<form class="o" id="${id}" data-submit="${submit}" ${data}><input name="noi_dung" required placeholder="${placeholder}" aria-label="${placeholder}">
    <button type="submit" class="nut chinh">${nhan}</button><button type="button" class="nut" data-action="dongO" data-o="${id}">Huỷ</button></form>`;

// Chỉ đạo đang chờ phản hồi trên việc của phòng mà KHÔNG do chính mình gửi (từ Văn phòng / Thường trực).
export function mucChiDaoChoHtml() {
  const ds = dh.chiDaoCho.filter((c) => c.nguoi_gui !== state.user?.id && timRow(c.nhiem_vu_id));
  if (ds.length === 0) return '';
  return `<div class="muc do" id="ptMucChiDao"><b>Chỉ đạo từ Văn phòng chờ phòng phản hồi (${ds.length})</b>${ds.map((c) => {
    const r = timRow(c.nhiem_vu_id);
    return `<div class="the-con" id="cdCho-${c.id}"><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(findAccount(c.nguoi_gui)?.full_name || 'Lãnh đạo')} ${TEN_LOAI_CHI_DAO[c.loai]?.toLowerCase() || ''} ${formatDateTime(c.created_at)}: "${escapeHtml(c.noi_dung)}"${c.han_phan_hoi ? ` · hạn phản hồi ${formatNgay(c.han_phan_hoi)}` : ''} · theo dõi: ${escapeHtml(r.nguoi_theo_doi_ten || '—')}</p>
      <div class="hanh-dong"><button type="button" class="nut chinh" data-action="moO" data-o="oNhac-${c.id}">Nhắc chuyên viên</button><button type="button" class="nut" data-action="moO" data-o="oThay-${c.id}">Phản hồi thay</button>
        <button type="button" class="nut" data-action="xemDienBien" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">Xem</button></div>
      ${oHtml(`oNhac-${c.id}`, 'guiDonDocThe', `data-id="${r.id}" data-ma="${escapeHtml(r.ma)}"`, 'Nội dung nhắc chuyên viên', 'Gửi nhắc')}
      ${oHtml(`oThay-${c.id}`, 'phanHoiThe', `data-chi-dao="${c.id}"`, 'Nội dung phản hồi thay phòng', 'Gửi phản hồi')}</div>`;
  }).join('')}</div>`;
}

export function mucViecDoHtml() {
  const ds = viecDo();
  if (ds.length === 0) return '<div class="muc luc"><b>Việc Đỏ của phòng</b><p>Hôm nay phòng không có việc quá hạn.</p></div>';
  return `<div class="muc do" id="ptMucDo"><b>Việc Đỏ của phòng (${ds.length})</b>${ds.map((r) => `
    <div class="the-con" id="ptDo-${r.id}" data-khau="${r.khau}"><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(r.noi_dung)}, trễ <b>${r.so_ngay_qua}</b> ngày, ${tenKhau(r.khau).toLowerCase()}: ${escapeHtml(sanPhamThieu(r))}${r.so_chi_dao_cho_phan_hoi ? `; ${r.so_chi_dao_cho_phan_hoi} chỉ đạo chờ phản hồi` : ''}${r.cap_quyet_dinh ? `; cấp cần quyết: ${escapeHtml(r.cap_quyet_dinh_ten)}` : ''}</p>
      <div class="hanh-dong"><button type="button" class="nut chinh" data-action="moO" data-o="oDo-${r.id}">Đôn đốc</button>
        <button type="button" class="nut" data-action="moChiDaoViec" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">Giao lại / Gia hạn</button>
        <button type="button" class="nut" data-action="xemDienBien" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">Xem</button></div>
      ${oHtml(`oDo-${r.id}`, 'guiDonDocThe', `data-id="${r.id}" data-ma="${escapeHtml(r.ma)}"`, 'Nội dung đôn đốc', 'Gửi đôn đốc')}</div>`).join('')}</div>`;
}

export function mucSapHanHtml() {
  const homNay = homNayVN();
  const ds = dh.rows.filter((r) => r.nhom_dem === 'SAP_DEN_HAN').sort((a, b) => (a.han_xu_ly < b.han_xu_ly ? -1 : 1));
  if (ds.length === 0) return '';
  return `<div class="muc vang" id="ptMucVang"><b>Sắp đến hạn trong phòng (${ds.length})</b>${ds.map((r) => `
    <div class="the-con" id="ptVang-${r.id}"><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(r.noi_dung)}, hạn ${formatNgay(r.han_xu_ly)} (${ghiChuHan(r.han_xu_ly, homNay).toLowerCase()})${(r.so_minh_chung_hop_le || 0) === 0 ? ', chưa có minh chứng' : ''} · ${escapeHtml(r.owner_tai_khoan_ten || r.nguoi_theo_doi_ten || '')}</p>
      <div class="hanh-dong"><button type="button" class="nut" data-action="moO" data-o="oVang-${r.id}">Nhắc</button><button type="button" class="nut" data-action="xemDienBien" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">Xem</button></div>
      ${oHtml(`oVang-${r.id}`, 'guiDonDocThe', `data-id="${r.id}" data-ma="${escapeHtml(r.ma)}"`, 'Nội dung nhắc', 'Gửi nhắc')}</div>`).join('')}</div>`;
}
