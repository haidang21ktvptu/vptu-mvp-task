// HTML một dòng nhiệm vụ (v8: chấm trạng thái · mã · nội dung + dòng phụ một dòng (chịu trách nhiệm, sản phẩm thiếu / chỉ đạo
// chờ / chưa nhận việc) · hạn (trễ N ngày / còn N ngày / xong); mép trái theo mức. Bấm dòng = mở ngăn chi tiết bên phải. Các vị từ
// "ai được làm gì" chỉ để ẩn/hiện nút trong ngăn (policy + hàm DB là chốt). v3.24: nhãn "Mới" (nhập trong 24 giờ qua); khi sắp xếp mới nhập
// trước, dòng phụ mở đầu bằng thời điểm nhập (người nhập ở chú thích khi rê chuột); data-tao / data-han để e2e kiểm thứ tự.
import { escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { formatNgay, soNgay } from '../../../lib/kl/ngay.js';
import { lopMep, boSoThuTu, tenTienDoHoanThanh, nhanChatLuongHtml, MOC_RA_SOAT } from '../../../lib/kl/nhan.js';
import { nhanPhuHtml } from '../../../lib/kl/do-khan.js';
import { duocChiDao } from './chi-dao.js';
import { maNguonHtml, nhanMucHtml } from './thong-tin-nguon.js';   // Đợt C2 (0087)
import { chiXem } from '../../../lib/kl/pham-vi.js';
import { laViecMoi, nhanNhap } from '../../../lib/kl/loc-them.js';

// Ai là "bên trong" của việc: người theo dõi hoặc Owner tài khoản.
export const laBenTrong = (r) => r.nguoi_theo_doi === state.user?.id || (r.owner_tai_khoan && r.owner_tai_khoan === state.user?.id);
// 0091 (policy nhiem_vu_update): + người tạo việc và lãnh đạo A0/A1/A2 thấy việc — lãnh đạo làm được việc của chuyên viên, không bắt buộc.
export const duocCapNhat = (r) => !chiXem(r) && (laBenTrong(r) || r.tao_boi === state.user?.id || ['A0', 'A1', 'A2'].includes(state.user?.role_group) || Boolean(state.user?.quan_tri_kl));
// GĐ16 (MC-4): ai được đóng nhiệm vụ — Owner/người theo dõi, lãnh đạo trong phạm vi (A1/A2), quan_tri_kl; hàm dong_nhiem_vu là chốt.
export const duocDong = (r) => !chiXem(r) && (laBenTrong(r) || duocChiDao() || Boolean(state.user?.quan_tri_kl));
// 0103: việc ngoài phạm vi xử lý của người xem (cấu hình xem toàn bộ) — nhãn trung tính, chỉ xem.
export const NHAN_CHI_XEM = ' <span class="nhan-trung-tinh nhan-chi-xem" title="Việc ngoài phạm vi xử lý của đồng chí — chỉ xem">Chỉ xem</span>';
export const sanPhamText = (r) => (r.san_pham_ten ? `${r.san_pham_ten}${r.san_pham_mo_ta ? `: ${r.san_pham_mo_ta}` : ''}` : '');
export const ownerText = (r) => r.owner_tai_khoan_ten || boSoThuTu(r.owner_don_vi_ten) || 'chưa xác định';
const NHAN_MOI = ' <span class="nhan-trung-tinh nhan-moi" title="Nhập lên hệ thống trong 24 giờ qua">Mới</span>';

// Cột hạn: "trễ 12 ngày / hạn 4/9", "còn 2 ngày / hạn 18/9", "xong / Trước hạn 3 ngày | Đúng hạn | Trễ 2 ngày" (PR-3, tien_do_hoan_thanh), "chưa có hạn / lý do".
function hanHtml(r, homNay) {
  if (r.nhom_dem === 'HOAN_THANH') {
    const phu = tenTienDoHoanThanh(r) || (r.ngay_hoan_thanh ? `xong ${formatNgay(r.ngay_hoan_thanh)}` : 'không có ngày gốc');
    return `<b>xong</b>${phu}`;
  }
  if (!r.han_xu_ly) return `<b>chưa có hạn</b>${r.nhom_dem === 'CAN_DIEN_HAN' ? 'cần điền hạn' : escapeHtml(boSoThuTu(r.loai_thoi_han_ten))}`;
  // Thường xuyên / chờ điều kiện: hạn là mốc rà soát, DB không tính quá hạn → không ghi "trễ" (rà soát 18/10: danh sách ghi "trễ 64 ngày").
  if (MOC_RA_SOAT[r.nhom_dem]) return `<b>${MOC_RA_SOAT[r.nhom_dem]}</b>mốc rà soát ${formatNgay(r.han_xu_ly)}`;
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

export function dongHtml(r, homNay, dangChon, { hienNhap = false, now = Date.now() } = {}) {
  const nhap = hienNhap ? nhanNhap(r.created_at, homNay) : '';
  const nguoiNhap = nhap && r.tao_boi ? state.accounts.find((a) => a.id === r.tao_boi)?.full_name : '';
  const goi = `${nhap ? `${nhap.replace(/^n/, 'N')}${nguoiNhap ? ` bởi ${nguoiNhap}` : ''} — ` : ''}${phuText(r)}`;
  return `<button type="button" class="hang-nv ${lopMep(r, state.user?.id)}${dangChon ? ' dang' : ''}" id="klRow-${r.id}" data-action="chonKlRow" data-id="${r.id}" data-nhom="${r.nhom_dem}" data-muc="${escapeHtml(r.muc_canh_bao || '')}" data-do-khan="${escapeHtml(r.do_khan || 'THUONG')}" data-tao="${escapeHtml(r.created_at || '')}" data-han="${escapeHtml(r.han_xu_ly || '')}" aria-pressed="${String(Boolean(dangChon))}">
      <span class="stt ${lopMep(r, state.user?.id)}"></span><span class="ma">${escapeHtml(r.ma)}</span>
      <span class="ten"><b>${escapeHtml(r.noi_dung)} ${laViecMoi(r, now) ? NHAN_MOI : ''}${nhanMucHtml(r)}${nhanPhuHtml(r)}${nhanChatLuongHtml(r.chat_luong)}${chiXem(r) ? NHAN_CHI_XEM : ''}</b><span title="${escapeHtml(goi)}">${nhap ? `<span class="nhap-luc">${escapeHtml(nhap)}</span> · ` : ''}${maNguonHtml(r)}${escapeHtml(phuText(r))}</span></span>
      <span class="han">${hanHtml(r, homNay)}</span>
    </button>`;
}
