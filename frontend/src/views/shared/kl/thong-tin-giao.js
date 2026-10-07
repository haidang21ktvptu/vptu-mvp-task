// Ngăn chi tiết — PR-3 (0062–0067): nguồn nhiệm vụ, đơn vị phối hợp, kết quả hoàn thành (chất lượng + Trước hạn / Đúng hạn / Trễ) và khối
// "Vướng mắc / đề nghị lãnh đạo quyết định" sửa tại chỗ. Ai sửa (chỉ ẩn/hiện — hàm DB là chốt):
//   - vướng mắc (dat_vuong_mac): Owner / người theo dõi, lãnh đạo A1/A2 thấy việc, quan_tri_kl; không A0. Để trống rồi Lưu = đã giải quyết.
//   - nguồn + đơn vị phối hợp: người giao / quan_tri_kl (không A0) — ở hộp Cập nhật nhanh (dat_thong_tin_giao) và "Sửa thông tin giao" (0070).
import { escapeHtml } from '../../../lib/dom.js';
import { state, findAccount } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { danhMucKl, datVuongMac } from '../../../lib/kl/du-lieu.js';
import { nhanChatLuongHtml, tenTienDoHoanThanh, nhomCua } from '../../../lib/kl/nhan.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { homNayVN } from '../../../lib/kl/ngay.js';
import { toiTrongNhom } from '../../../lib/kl/thay-mat.js';
import { laBenTrong } from './dong.js';
import { duocChiDao } from './chi-dao.js';

let sauHanhDong = async () => {};
const laA0 = () => state.user?.role_group === 'A0';
// Quản trị KL CÒN HẠN (như me_quan_tri_kl() ở DB: cờ + quan_tri_kl_het_han chưa qua), không phải A0.
export const laQtklConHan = () => Boolean(state.user?.quan_tri_kl) && (!state.user.quan_tri_kl_het_han || state.user.quan_tri_kl_het_han >= homNayVN()) && !laA0();
const qtkl = laQtklConHan;
export const duocSuaVuongMac = (r) => !laA0() && (laBenTrong(r) || duocChiDao() || qtkl());
export function duocSuaThongTinGiao(r) {
  const giao = findAccount(r.giao_thay_mat_cho || r.tao_boi);
  return ((Boolean(giao) && giao.id === state.user?.id || toiTrongNhom(r.giao_thay_mat_nhom)) && ['A0', 'A1', 'A2'].includes(state.user?.role_group) && !state.user?.bi_khoa) || qtkl();
}

// Ô lưới (dt/dd) của ngăn: Nguồn, Phối hợp (khi có), Kết quả (việc đã hoàn thành). o(nhãn, giá trị, cột) — cột: ô tầng giao có bút / khoá (0070).
export function oLuoiPr3Html(r, o) {
  const ketQua = r.tien_do_ma === 'HOAN_THANH' ? `${escapeHtml(tenTienDoHoanThanh(r) || 'không đánh giá tiến độ')} ${nhanChatLuongHtml(r.chat_luong) || '<span class="chu-phu">chưa đánh giá chất lượng</span>'}` : '';
  return `${o('Nguồn', `<span data-truong="nguon">${escapeHtml(r.nguon_nhiem_vu_ten || 'chưa xác định')}</span>`, 'nguon_nhiem_vu_ma')}
    ${r.don_vi_phoi_hop ? o('Phối hợp', `<span data-truong="phoi-hop">${escapeHtml(r.don_vi_phoi_hop)}</span>`, 'don_vi_phoi_hop') : ''}
    ${ketQua ? o('Kết quả', ketQua) : ''}`;
}

// Ô chọn nguồn dùng chung (Giao việc, ngăn chi tiết, Cập nhật nhanh): mục đang dùng + mục đang chọn; nhanTrong = dòng trống đầu (nếu có).
export const nguonOptionsHtml = (chon, nhanTrong = null) => (nhanTrong ? `<option value="">${escapeHtml(nhanTrong)}</option>` : '')
  + (danhMucKl().nguonNhiemVu || []).filter((d) => d.dang_dung || d.ma === chon)
    .map((d) => `<option value="${escapeHtml(d.ma)}"${d.ma === chon ? ' selected' : ''}>${escapeHtml(d.ten)}</option>`).join('');

// Khối dưới hàng nút: vướng mắc (việc đang mở hoặc còn nội dung). Nguồn / đơn vị phối hợp: v9 đợt 2 sửa qua "Sửa thông tin giao" (sua-tang.js,
// bút cạnh ô Nguồn / Phối hợp) — cùng người được sửa với dat_thong_tin_giao; hộp Cập nhật nhanh vẫn giữ hai ô này cho người giao.
export function khoiPr3Html(r) {
  const mo = nhomCua(r.nhom_dem).mo; const suaVm = duocSuaVuongMac(r);
  if (!mo && !r.vuong_mac) return '';
  const nut = (o, nhan) => `<button type="button" class="nut nho" data-action="moO" data-o="${o}-${r.id}">${nhan}</button>`;
  const vm = mo || r.vuong_mac ? `<div class="ct-vuong-mac" id="klVm-${r.id}"><h4>Vướng mắc / đề nghị lãnh đạo quyết định</h4>
      <p data-truong="vuong-mac">${r.vuong_mac ? escapeHtml(r.vuong_mac) : '<span class="chu-phu">không có</span>'}</p>
      ${suaVm ? `${nut('oVm', r.vuong_mac ? 'Sửa vướng mắc' : 'Ghi vướng mắc')}
      <form class="o" id="oVm-${r.id}" data-submit="luuVuongMac" data-id="${r.id}">
        <textarea name="vuong_mac" class="o-nhap" rows="3" maxlength="500" style="flex-basis:100%" aria-label="Vướng mắc / đề nghị lãnh đạo quyết định" placeholder="Nêu vướng mắc, đề nghị cấp nào quyết định việc gì">${escapeHtml(r.vuong_mac || '')}</textarea>
        <small>Tối đa 500 ký tự. Lần đầu ghi: người giao và lãnh đạo phụ trách nhận thông báo. Để trống rồi Lưu = đã giải quyết.</small>
        <button type="submit" class="nut chinh">Lưu</button><button type="button" class="nut" data-action="dongO" data-o="oVm-${r.id}">Huỷ</button></form>` : ''}</div>` : '';
  return `<div class="khoi-nho ct-pr3">${vm}</div>`;
}

async function luuVuongMac({ id }, form) {
  const nd = String(new FormData(form).get('vuong_mac') || '').trim();
  try {
    await datVuongMac(id, nd);
    form.classList.remove('mo');
    notifySuccess(nd ? 'Đã ghi vướng mắc.' : 'Đã xoá vướng mắc — coi như đã giải quyết.');
    await sauHanhDong(id);
  } catch (e) { notifyError('Không lưu được vướng mắc: ' + loiDeHieu(e)); }
}

export function mountThongTinGiao(registerActions, napLai) {
  sauHanhDong = napLai;
  registerActions({ luuVuongMac });
}
