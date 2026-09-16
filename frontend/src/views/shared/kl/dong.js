// HTML một dòng nhiệm vụ trong bảng danh sách + dòng ngăn chi tiết (bung dưới, như luồng ý kiến). GĐ14: cột Chịu trách nhiệm
// (Owner), Sản phẩm, chấm màu 4 mức từ v_nhiem_vu.muc_canh_bao; nút "Xác nhận đã nhận việc" cho Owner/người theo dõi.
import { escapeHtml } from '../../../lib/dom.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { state } from '../../../lib/state.js';
import { formatNgay, ghiChuHan, ngayTruoc } from '../../../lib/kl/ngay.js';
import { nhomCua, nhanTrangThai, boSoThuTu, chamMuc } from '../../../lib/kl/nhan.js';
import { duocChiDao } from './chi-dao.js';

export const SO_COT = 7;
const rutGon = (s, n = 140) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');

// Ai là "bên trong" của việc: người theo dõi hoặc Owner tài khoản (ẩn/hiện cho đẹp; policy + guard 0025 là chốt).
export const laBenTrong = (r) => r.nguoi_theo_doi === state.user?.id || (r.owner_tai_khoan && r.owner_tai_khoan === state.user?.id);
export const duocCapNhat = (r) => laBenTrong(r) || Boolean(state.user?.quan_tri_kl);

// Owner hiển thị: cán bộ (tên, phòng) hoặc đơn vị/phòng.
export function ownerHtml(r) {
  if (r.owner_tai_khoan_ten) return `${escapeHtml(r.owner_tai_khoan_ten)}<small>${escapeHtml(boSoThuTu(r.owner_don_vi_ten))}</small>`;
  if (r.owner_don_vi_ten) return `${escapeHtml(boSoThuTu(r.owner_don_vi_ten))}<small>${r.owner_trong_van_phong ? 'Trong Văn phòng' : 'Đơn vị ngoài Văn phòng'}</small>`;
  return '—<small>chưa xác định</small>';
}
export const sanPhamText = (r) => (r.san_pham_ten ? `${r.san_pham_ten}${r.san_pham_mo_ta ? `: ${r.san_pham_mo_ta}` : ''}` : '');

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
  const cham = chamMuc(r.muc_canh_bao);
  const thieuMC = r.nhom_dem === 'HOAN_THANH' && r.thieu_minh_chung ? '<small>Chưa có minh chứng</small>' : '';
  const chiDao = r.so_chi_dao_cho_phan_hoi > 0 ? `<small class="chu-canh-bao">Chỉ đạo chờ phản hồi: ${r.so_chi_dao_cho_phan_hoi}</small>` : '';
  const sanPham = sanPhamText(r);
  const nut = (action, label, cls = 'btn-phu') => `<button type="button" data-action="${action}" data-id="${r.id}" class="btn ${cls} btn-nho">${label}</button>`;
  const nutNhan = laBenTrong(r) && nhom.mo && !r.da_xac_nhan_nhan ? nut('xacNhanNhanViec', 'Xác nhận đã nhận việc') : '';
  // 15E: nút chính riêng — A1/A2 "Chỉ đạo", Owner/người theo dõi "Phản hồi" (mở ngăn, con trỏ vào ô nhập); vai khác chỉ có Chi tiết.
  const nutChiDao = duocChiDao() ? nut('moKlChiDao', 'Chỉ đạo', 'btn-chinh') : laBenTrong(r) ? nut('moKlChiDao', 'Phản hồi', 'btn-chinh') : '';
  const vanBan = r.so_hoi_nghi ? `HN ${r.so_hoi_nghi} · ${escapeHtml(r.so_ket_luan)}` : escapeHtml(r.so_ket_luan);
  return `
    <tr id="klRow-${r.id}" class="${nhom.row}" data-nhom="${r.nhom_dem}" data-muc="${escapeHtml(r.muc_canh_bao || '')}">
      <td class="tieude">${escapeHtml(r.ma)}<small>${vanBan} · BH ${formatNgay(r.ngay_ban_hanh)}</small></td>
      <td data-nhan="Nội dung" class="noi-dung" title="${escapeHtml(r.noi_dung)}">${escapeHtml(rutGon(r.noi_dung))}<small>${sanPham ? `Sản phẩm: ${escapeHtml(sanPham)}` : '<span class="chu-canh-bao">Chưa định nghĩa sản phẩm</span>'}</small>${chiDao}</td>
      <td data-nhan="Chịu trách nhiệm" class="nguoi">${ownerHtml(r)}</td>
      <td data-nhan="Người theo dõi" class="nguoi">${escapeHtml(r.nguoi_theo_doi_ten) || '—'}<small>${escapeHtml(DEPT_NAMES[r.nguoi_theo_doi_phong] || r.nguoi_theo_doi_phong || '')}${r.da_xac_nhan_nhan ? ' · đã nhận việc' : laBenTrong(r) && nhom.mo ? ' · <span class="chu-canh-bao">chưa xác nhận nhận việc</span>' : ''}</small></td>
      <td data-nhan="Hạn" class="han">${oHan(r, homNay)}</td>
      <td data-nhan="Trạng thái"><span class="${cham.lop}" title="${escapeHtml(cham.ten)}"></span><span class="muc ${nhom.muc}">${escapeHtml(nhanTrangThai(r))}</span>${thieuMC}${ghiChuCapNhat(r)}</td>
      <td><div class="thao-tac">${nut('moKlChiTiet', 'Chi tiết')}${nutChiDao}${nutNhan}${duocCapNhat(r) ? nut('openKlCapNhat', 'Cập nhật', 'btn-cham') : ''}</div></td>
    </tr>
    <tr id="klChiTiet-${r.id}" class="hidden dong-chi-tiet"><td colspan="${SO_COT}" class="o-chi-tiet"></td></tr>
  `;
}
