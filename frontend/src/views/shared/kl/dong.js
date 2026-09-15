// HTML một dòng nhiệm vụ KL trong bảng danh sách + dòng ngăn chi tiết (bung dưới, như luồng ý kiến).
import { escapeHtml } from '../../../lib/dom.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { state } from '../../../lib/state.js';
import { formatNgay, ghiChuHan, ngayTruoc } from '../../../lib/kl/ngay.js';
import { nhomCua, nhanTrangThai, boSoThuTu } from '../../../lib/kl/nhan.js';

export const SO_COT = 6;
const rutGon = (s, n = 140) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');

// Ai được bấm "Cập nhật": chủ trì dòng đó hoặc người có quan_tri_kl (ẩn/hiện cho đẹp; policy + guard 0015/0016 là chốt).
export const duocCapNhat = (r) => r.chu_tri_id === state.user?.id || Boolean(state.user?.quan_tri_kl);

function oHan(r, homNay) {
  if (r.han_xu_ly) {
    const chuThich = r.nhom_dem === 'HOAN_THANH' ? '' : ghiChuHan(r.han_xu_ly, homNay);
    const tuTinh = r.loai_thoi_han_ma === 'KY_BAN_HANH' ? 'Tự tính: ngày BH + 10' : '';
    return `<span class="whitespace-nowrap">${formatNgay(r.han_xu_ly)}</span>${chuThich || tuTinh ? `<small>${escapeHtml([chuThich, tuTinh].filter(Boolean).join(' · '))}</small>` : ''}`;
  }
  const ghiChu = r.nhom_dem === 'CAN_DIEN_HAN' ? `Chưa xác định: ${r.ly_do_chua_co_han || ''}` : boSoThuTu(r.loai_thoi_han_ten);
  return `—<small>${escapeHtml(ghiChu)}</small>`;
}

function ghiChuCapNhat(r) {
  const n = ngayTruoc(r.cap_nhat_luc);
  if (n === null) return '';
  return `<small>Cập nhật ${n === 0 ? 'hôm nay' : `${n} ngày trước`}${r.nguon === 'excel' && n !== 0 ? ' · Excel' : ''}</small>`;
}

export function dongHtml(r, homNay) {
  const nhom = nhomCua(r.nhom_dem);
  const thieuMC = r.nhom_dem === 'HOAN_THANH' && r.thieu_minh_chung ? '<small>Chưa có minh chứng</small>' : '';
  const chiDao = r.so_chi_dao_cho_phan_hoi > 0 ? `<small class="chu-canh-bao">Chỉ đạo chờ phản hồi: ${r.so_chi_dao_cho_phan_hoi}</small>` : '';
  const nut = (action, label, cls = 'btn-phu') => `<button type="button" data-action="${action}" data-id="${r.id}" class="btn ${cls} btn-nho">${label}</button>`;
  return `
    <tr id="klRow-${r.id}" class="${nhom.row}" data-nhom="${r.nhom_dem}">
      <td class="tieude">${escapeHtml(r.ma)}<small>HN ${r.so_hoi_nghi} · ${escapeHtml(r.so_ket_luan)} · BH ${formatNgay(r.ngay_ban_hanh)}</small></td>
      <td data-nhan="Nội dung" class="noi-dung" title="${escapeHtml(r.noi_dung)}">${escapeHtml(rutGon(r.noi_dung))}<small>Cơ quan trình: ${escapeHtml(boSoThuTu(r.co_quan_trinh_ten)) || '—'}</small>${chiDao}</td>
      <td data-nhan="Chủ trì" class="nguoi">${escapeHtml(r.chu_tri_ten) || '—'}<small>${escapeHtml(DEPT_NAMES[r.chu_tri_phong] || r.chu_tri_phong || '')}</small></td>
      <td data-nhan="Hạn" class="han">${oHan(r, homNay)}</td>
      <td data-nhan="Trạng thái"><span class="muc ${nhom.muc}">${escapeHtml(nhanTrangThai(r))}</span>${thieuMC}${ghiChuCapNhat(r)}</td>
      <td><div class="thao-tac">${nut('toggleKlChiTiet', 'Chi tiết')}${duocCapNhat(r) ? nut('openKlCapNhat', 'Cập nhật', 'btn-cham') : ''}</div></td>
    </tr>
    <tr id="klChiTiet-${r.id}" class="hidden dong-chi-tiet"><td colspan="${SO_COT}" class="o-chi-tiet"></td></tr>
  `;
}
