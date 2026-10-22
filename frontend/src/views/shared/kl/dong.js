// HTML một dòng của bảng "Nhiệm vụ" (v3.25 — bảng theo cột kiểu V-Office, mẫu NhiemVu / ViecTheoDoi 16/10/2026): cả dòng là MỘT nút
// (button.hang-nv#klRow-<id>, data-action=chonKlRow — bấm mở ngăn chi tiết; giữ data-nhom / muc / do-khan / tao / han cho e2e và sắp xếp), ô là
// span có data-nhan (nhãn ô khi bảng thành thẻ). Hai bộ cột: 'nv' — STT | Thời gian nhập | Nhiệm vụ | Văn bản giao | Chủ trì | Hạn xử lý | Trạng
// thái; 'td' (Việc tôi theo dõi) — STT | Nhiệm vụ | Chủ trì | Văn bản giao | Hạn | Trạng thái | Tình hình. .stt là mép màu 4px theo mức. Các vị
// từ "ai được làm gì" chỉ để ẩn/hiện nút trong ngăn (policy + hàm DB là chốt).
import { escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { lopMep, boSoThuTu, nhanChatLuongHtml } from '../../../lib/kl/nhan.js';
import { nhanPhuHtml } from '../../../lib/kl/do-khan.js';
import { hanO, trangThaiO, gioVN, vanBanNgan, cachNhap } from '../../../lib/kl/bang-o.js';
import { tinhHinh, quanHe } from '../../../lib/kl/tinh-hinh.js';
import { duocChiDao } from './chi-dao.js';
import { maNguonHtml, nhanMucHtml } from './thong-tin-nguon.js';   // Đợt C2 (0087)
import { chiXem } from '../../../lib/kl/pham-vi.js';
import { chiXemVoi, thuKyGhi } from '../../../lib/kl/quyen-them.js';
import { laViecMoi, nhanNhap } from '../../../lib/kl/loc-them.js';

// Ai là "bên trong" của việc: người theo dõi hoặc Owner tài khoản.
export const laBenTrong = (r) => r.nguoi_theo_doi === state.user?.id || (r.owner_tai_khoan && r.owner_tai_khoan === state.user?.id);
// 0091 (policy nhiem_vu_update): + người tạo việc và lãnh đạo A0/A1/A2 thấy việc — lãnh đạo làm được việc của chuyên viên, không bắt buộc.
// v3.29 (0124): + thư ký Thường trực với mọi việc chưa hoàn thành (kể cả ngoài phạm vi cũ).
export const duocCapNhat = (r) => !chiXemVoi(r, state.user) && (laBenTrong(r) || r.tao_boi === state.user?.id || ['A0', 'A1', 'A2'].includes(state.user?.role_group)
  || Boolean(state.user?.quan_tri_kl) || thuKyGhi(r, state.user));
// GĐ16 (MC-4): ai được đóng nhiệm vụ — Owner/người theo dõi, lãnh đạo trong phạm vi (A1/A2), quan_tri_kl; hàm dong_nhiem_vu là chốt.
export const duocDong = (r) => !chiXem(r) && (laBenTrong(r) || duocChiDao() || Boolean(state.user?.quan_tri_kl));
// 0103: việc ngoài phạm vi xử lý của người xem (cấu hình xem toàn bộ) — nhãn trung tính, chỉ xem. v3.29: thư ký Thường trực không có nhãn này ở
// việc chưa hoàn thành (ghi được — 0124).
export const NHAN_CHI_XEM = ' <span class="nhan-trung-tinh nhan-chi-xem" title="Việc ngoài phạm vi xử lý của đồng chí — chỉ xem">Chỉ xem</span>';
export const sanPhamText = (r) => (r.san_pham_ten ? `${r.san_pham_ten}${r.san_pham_mo_ta ? `: ${r.san_pham_mo_ta}` : ''}` : '');
export const ownerText = (r) => r.owner_tai_khoan_ten || boSoThuTu(r.owner_don_vi_ten) || 'chưa xác định';
const NHAN_MOI = ' <span class="nhan-trung-tinh nhan-moi" title="Nhập lên hệ thống trong 24 giờ qua">Mới</span>';

// Điều cần để ý của việc (dòng phụ dưới nội dung) — chỉ khi có: bị từ chối, đề nghị từ chối, chỉ đạo chờ phản hồi, chưa nhận, chưa định nghĩa sản
// phẩm, Vàng / Đỏ mà chưa có sản phẩm, hoàn thành thiếu minh chứng. Bình thường không ghi (dòng gọn; đủ thông tin ở ngăn chi tiết).
function chuY(r) {
  if (r.bi_tu_choi) return 'bị từ chối, chờ giao lại';
  if (r.tu_choi_cho) return 'đề nghị từ chối, chờ duyệt';
  if (r.so_chi_dao_cho_phan_hoi > 0) return `${r.so_chi_dao_cho_phan_hoi} chỉ đạo chờ phản hồi`;
  if (r.nhom_dem === 'HOAN_THANH') return r.thieu_minh_chung ? 'chưa có minh chứng' : '';
  if (laBenTrong(r) && !r.da_xac_nhan_nhan) return 'chưa xác nhận nhận việc';
  if (!r.san_pham_loai) return 'chưa định nghĩa sản phẩm';
  return (r.so_minh_chung_hop_le || 0) === 0 && ['VANG', 'DO', 'DO_DAC_BIET'].includes(r.muc_canh_bao) ? `thiếu ${r.san_pham_ten}` : '';
}
const o = (nhan, html, lop = '') => `<span class="bnv-c${lop ? ` ${lop}` : ''}" data-nhan="${nhan}">${html}</span>`;
const phu = (s) => (s ? `<span class="bnv-phu">${escapeHtml(s)}</span>` : '');

// tuyChon: { now, stt (số thứ tự tuyệt đối), cot: 'nv' | 'td' }.
export function dongHtml(r, homNay, dangChon, { now = Date.now(), stt = '', cot = 'nv' } = {}) {
  const me = state.user?.id; const lop = lopMep(r, me);
  const nguoiNhap = r.tao_boi ? state.accounts.find((a) => a.id === r.tao_boi)?.full_name || '' : '';
  const g = gioVN(r.created_at); const vb = vanBanNgan(r); const han = hanO(r, homNay); const tt = trangThaiO(r, me); const cach = cachNhap(r);
  const nhap = nhanNhap(r.created_at, homNay);
  const qh = cot === 'td' ? (quanHe(r, me) === 'giao' ? '<span class="bnv-nhan vai">Tôi đã giao</span>' : '<span class="bnv-nhan xam">Tôi theo dõi</span>') : '';
  const cy = cot === 'td' ? '' : chuY(r);   // Việc tôi theo dõi: cột Tình hình đã nói điều cần để ý
  const goi = `${nhap ? `${nhap.replace(/^n/, 'N')}${nguoiNhap ? ` bởi ${nguoiNhap}` : ''} — ` : ''}${ownerText(r)}${cy ? `, ${cy}` : ''}`;
  const gon = cot === 'nv' && nhap ? `<span class="nhap-luc">${escapeHtml(nhap)}${nguoiNhap ? ` · ${escapeHtml(nguoiNhap)}` : ''}</span>` : '';   // dòng phụ khi gộp cột thời gian
  const oNv = `<span class="bnv-c bnv-c-nv" title="${escapeHtml(goi)}"><span class="bnv-dong1"><span class="ma">${escapeHtml(r.ma)}</span>${maNguonHtml(r)}${qh}${laViecMoi(r, now) ? NHAN_MOI : ''}${nhanMucHtml(r)}${nhanPhuHtml(r)}${chiXemVoi(r, state.user) ? NHAN_CHI_XEM : ''}</span>
      <span class="bnv-nd">${escapeHtml(r.noi_dung)}</span>${gon ? `<span class="bnv-phu bnv-chi-gon">${gon}</span>` : ''}${cy ? `<span class="bnv-phu bnv-chu-y">${escapeHtml(cy)}</span>` : ''}</span>`;
  const oVb = o('Văn bản giao', `<span class="bnv-vb">${escapeHtml(vb.ten)}</span>${phu(vb.phu)}`);
  const oChuTri = o('Chủ trì theo dõi', `<span>${escapeHtml(ownerText(r))}</span>${r.owner_tai_khoan_ten ? phu(boSoThuTu(r.owner_don_vi_ten)) : ''}`);
  const oHan = o('Hạn xử lý', `<b>${escapeHtml(han.ngay)}</b><span>${escapeHtml(han.chu)}</span>`, 'han');
  const oTt = o('Trạng thái', `<span class="trang-thai ${tt.lop}">${escapeHtml(tt.chu)}</span>${nhanChatLuongHtml(r.chat_luong)}`, 'bnv-c-tt');
  let cells;
  if (cot === 'td') {
    const th = tinhHinh(r);
    cells = [oNv, oChuTri, oVb, oHan, oTt, o('Tình hình', `<b>${escapeHtml(th.tieu)}</b>${phu(th.chu)}`, `bnv-th ${th.lop}`)];
  } else {
    cells = [o('Thời gian nhập', `<b class="bnv-gio">${g.gio}</b><span>${g.ngay}</span>${phu([nguoiNhap, cach].filter(Boolean).join(' · '))}`, 'bnv-c-tg'), oNv, oVb, oChuTri, oHan, oTt];
  }
  return `<button type="button" class="hang-nv bnv-hang ${lop}${dangChon ? ' dang' : ''}" id="klRow-${r.id}" data-action="chonKlRow" data-id="${r.id}" data-nhom="${r.nhom_dem}" data-muc="${escapeHtml(r.muc_canh_bao || '')}" data-do-khan="${escapeHtml(r.do_khan || 'THUONG')}" data-tao="${escapeHtml(r.created_at || '')}" data-han="${escapeHtml(r.han_xu_ly || '')}" aria-pressed="${String(Boolean(dangChon))}">
      <span class="stt ${lop}" aria-hidden="true"></span><span class="bnv-c bnv-c-stt">${stt}</span>${cells.join('')}</button>`;
}
