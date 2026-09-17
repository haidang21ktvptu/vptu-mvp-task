// HTML một dòng nhiệm vụ trong danh sách gọn (mockup .hang-nv): mã · nội dung + dòng phụ (chịu trách nhiệm, sản phẩm thiếu / chỉ đạo
// chờ / chưa nhận việc) · hạn (trễ N ngày / còn N ngày / xong); mép trái theo mức. Bấm dòng = mở ngăn chi tiết bên phải. Các vị từ
// "ai được làm gì" chỉ để ẩn/hiện nút trong ngăn (policy + hàm DB là chốt).
import { escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { formatNgay, soNgay } from '../../../lib/kl/ngay.js';
import { lopMep, boSoThuTu } from '../../../lib/kl/nhan.js';
import { duocChiDao } from './chi-dao.js';

// Ai là "bên trong" của việc: người theo dõi hoặc Owner tài khoản.
export const laBenTrong = (r) => r.nguoi_theo_doi === state.user?.id || (r.owner_tai_khoan && r.owner_tai_khoan === state.user?.id);
export const duocCapNhat = (r) => laBenTrong(r) || Boolean(state.user?.quan_tri_kl);
// GĐ16 (MC-4): ai được đóng nhiệm vụ — Owner/người theo dõi, lãnh đạo trong phạm vi (A1/A2), quan_tri_kl; hàm dong_nhiem_vu là chốt.
export const duocDong = (r) => laBenTrong(r) || duocChiDao() || Boolean(state.user?.quan_tri_kl);
export const sanPhamText = (r) => (r.san_pham_ten ? `${r.san_pham_ten}${r.san_pham_mo_ta ? `: ${r.san_pham_mo_ta}` : ''}` : '');
export const ownerText = (r) => r.owner_tai_khoan_ten || boSoThuTu(r.owner_don_vi_ten) || 'chưa xác định';

// Cột hạn: "trễ 12 ngày / hạn 4/9", "còn 2 ngày / hạn 18/9", "xong / sớm 3 ngày", "chưa có hạn / lý do".
function hanHtml(r, homNay) {
  if (r.nhom_dem === 'HOAN_THANH') {
    const phu = r.ket_qua === 'DUNG_HAN' && r.han_xu_ly && r.ngay_hoan_thanh ? `sớm ${soNgay(r.ngay_hoan_thanh, r.han_xu_ly)} ngày`
      : r.ket_qua === 'TRE' ? `trễ ${r.so_ngay_tre} ngày` : r.ngay_hoan_thanh ? `xong ${formatNgay(r.ngay_hoan_thanh)}` : 'không có ngày gốc';
    return `<b>xong</b>${phu}`;
  }
  if (!r.han_xu_ly) return `<b>chưa có hạn</b>${r.nhom_dem === 'CAN_DIEN_HAN' ? 'cần điền hạn' : escapeHtml(boSoThuTu(r.loai_thoi_han_ten))}`;
  const n = soNgay(homNay, r.han_xu_ly);
  const chu = n < 0 ? `trễ ${-n} ngày` : n === 0 ? 'đến hạn hôm nay' : `còn ${n} ngày`;
  return `<b>${chu}</b>hạn ${formatNgay(r.han_xu_ly)}`;
}

// Dòng phụ: chịu trách nhiệm + điều đáng chú ý nhất.
function phuText(r) {
  const chuY = r.bi_tu_choi ? 'bị từ chối, chờ giao lại' : r.tu_choi_cho ? 'đề nghị từ chối, chờ duyệt'
    : r.so_chi_dao_cho_phan_hoi > 0 ? `${r.so_chi_dao_cho_phan_hoi} chỉ đạo chờ phản hồi`
    : r.nhom_dem === 'HOAN_THANH' ? (r.thieu_minh_chung ? 'chưa có minh chứng' : 'minh chứng hợp lệ')
      : laBenTrong(r) && !r.da_xac_nhan_nhan ? 'chưa xác nhận nhận việc'
        : !r.san_pham_loai ? 'chưa định nghĩa sản phẩm' : (r.so_minh_chung_hop_le || 0) === 0 ? `thiếu ${r.san_pham_ten}` : 'đã có minh chứng';
  return `${ownerText(r)}, ${chuY}`;
}

export function dongHtml(r, homNay, dangChon) {
  return `<button type="button" class="hang-nv ${lopMep(r)}${dangChon ? ' dang' : ''}" id="klRow-${r.id}" data-action="chonKlRow" data-id="${r.id}" data-nhom="${r.nhom_dem}" data-muc="${escapeHtml(r.muc_canh_bao || '')}" aria-pressed="${String(Boolean(dangChon))}">
      <span class="ma">${escapeHtml(r.ma)}</span>
      <span class="ten"><b>${escapeHtml(r.noi_dung)}</b><span>${escapeHtml(phuText(r))}</span></span>
      <span class="han">${hanHtml(r, homNay)}</span>
    </button>`;
}
