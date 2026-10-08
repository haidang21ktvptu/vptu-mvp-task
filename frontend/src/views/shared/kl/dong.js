// HTML một dòng nhiệm vụ (v8: chấm trạng thái · mã · nội dung + dòng phụ một dòng (chịu trách nhiệm, sản phẩm thiếu / chỉ đạo
// chờ / chưa nhận việc) · hạn (trễ N ngày / còn N ngày / xong); mép trái theo mức. Bấm dòng = mở ngăn chi tiết bên phải. Các vị từ
// "ai được làm gì" chỉ để ẩn/hiện nút trong ngăn (policy + hàm DB là chốt).
import { escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { formatNgay, soNgay } from '../../../lib/kl/ngay.js';
import { lopMep, boSoThuTu, tenTienDoHoanThanh, nhanChatLuongHtml } from '../../../lib/kl/nhan.js';
import { nhanPhuHtml } from '../../../lib/kl/do-khan.js';
import { duocChiDao } from './chi-dao.js';
import { maNguonHtml, nhanMucHtml } from './thong-tin-nguon.js';   // Đợt C2 (0087)

// Ai là "bên trong" của việc: người theo dõi hoặc Owner tài khoản.
export const laBenTrong = (r) => r.nguoi_theo_doi === state.user?.id || (r.owner_tai_khoan && r.owner_tai_khoan === state.user?.id);
// 0091 (policy nhiem_vu_update): + người tạo việc và lãnh đạo A0/A1/A2 thấy việc — lãnh đạo làm được việc của chuyên viên, không bắt buộc.
export const duocCapNhat = (r) => laBenTrong(r) || r.tao_boi === state.user?.id || ['A0', 'A1', 'A2'].includes(state.user?.role_group) || Boolean(state.user?.quan_tri_kl);
// GĐ16 (MC-4): ai được đóng nhiệm vụ — Owner/người theo dõi, lãnh đạo trong phạm vi (A1/A2), quan_tri_kl; hàm dong_nhiem_vu là chốt.
export const duocDong = (r) => laBenTrong(r) || duocChiDao() || Boolean(state.user?.quan_tri_kl);
export const sanPhamText = (r) => (r.san_pham_ten ? `${r.san_pham_ten}${r.san_pham_mo_ta ? `: ${r.san_pham_mo_ta}` : ''}` : '');
export const ownerText = (r) => r.owner_tai_khoan_ten || boSoThuTu(r.owner_don_vi_ten) || 'chưa xác định';

// Cột hạn: "trễ 12 ngày / hạn 4/9", "còn 2 ngày / hạn 18/9", "xong / Trước hạn 3 ngày | Đúng hạn | Trễ 2 ngày" (PR-3, tien_do_hoan_thanh), "chưa có hạn / lý do".
function hanHtml(r, homNay) {
  if (r.nhom_dem === 'HOAN_THANH') {
    const phu = tenTienDoHoanThanh(r) || (r.ngay_hoan_thanh ? `xong ${formatNgay(r.ngay_hoan_thanh)}` : 'không có ngày gốc');
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
  return `<button type="button" class="hang-nv ${lopMep(r, state.user?.id)}${dangChon ? ' dang' : ''}" id="klRow-${r.id}" data-action="chonKlRow" data-id="${r.id}" data-nhom="${r.nhom_dem}" data-muc="${escapeHtml(r.muc_canh_bao || '')}" data-do-khan="${escapeHtml(r.do_khan || 'THUONG')}" aria-pressed="${String(Boolean(dangChon))}">
      <span class="stt ${lopMep(r, state.user?.id)}"></span><span class="ma">${escapeHtml(r.ma)}</span>
      <span class="ten"><b>${escapeHtml(r.noi_dung)} ${nhanMucHtml(r)}${nhanPhuHtml(r)}${nhanChatLuongHtml(r.chat_luong)}</b><span title="${escapeHtml(phuText(r))}">${maNguonHtml(r)}${escapeHtml(phuText(r))}</span></span>
      <span class="han">${hanHtml(r, homNay)}</span>
    </button>`;
}
