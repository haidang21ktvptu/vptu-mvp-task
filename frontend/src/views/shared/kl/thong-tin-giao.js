// Ngăn chi tiết — PR-3 (0062–0067): nguồn nhiệm vụ, đơn vị phối hợp, kết quả hoàn thành (chất lượng + Trước hạn / Đúng hạn / Trễ) và khối
// "Vướng mắc / đề nghị lãnh đạo quyết định" sửa tại chỗ. Ai sửa (chỉ ẩn/hiện — hàm DB là chốt):
//   - vướng mắc (dat_vuong_mac): Owner / người theo dõi, lãnh đạo A1/A2 thấy việc, quan_tri_kl, thư ký Thường trực (0124, việc chưa hoàn thành);
//     không A0. Để trống rồi Lưu = đã giải quyết.
//   - nguồn + đơn vị phối hợp: tầng giao (0091 — người giao / người tạo việc, lãnh đạo trong phạm vi, quan_tri_kl; v3.34 — 0131: + chủ trì theo dõi, việc chưa hoàn thành) — hộp Cập nhật nhanh và "Sửa thông tin giao".
import { escapeHtml } from '../../../lib/dom.js';
import { state, findAccount } from '../../../lib/state.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { danhMucKl, datVuongMac } from '../../../lib/kl/du-lieu.js';
import { nhanChatLuongHtml, tenTienDoHoanThanh, nhomCua } from '../../../lib/kl/nhan.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { homNayVN } from '../../../lib/kl/ngay.js';
import { laTangGiao, laChuTriSua } from '../../../lib/kl/sua-tang.js';
import { laBenTrong } from './dong.js';
import { duocChiDao } from './chi-dao.js';
import { chiXemVoi, thuKyGhi } from '../../../lib/kl/quyen-them.js';

let sauHanhDong = async () => {};
const laA0 = () => state.user?.role_group === 'A0';
// Quản trị KL CÒN HẠN (như me_quan_tri_kl() ở DB: cờ + quan_tri_kl_het_han chưa qua), không phải A0.
export const laQtklConHan = () => Boolean(state.user?.quan_tri_kl) && (!state.user.quan_tri_kl_het_han || state.user.quan_tri_kl_het_han >= homNayVN()) && !laA0();
const qtkl = laQtklConHan;
// 0103: việc chỉ xem → không; v3.29 (0124): + thư ký Thường trực với mọi việc chưa hoàn thành.
export const duocSuaVuongMac = (r) => !laA0() && !chiXemVoi(r, state.user) && (laBenTrong(r) || duocChiDao() || qtkl() || thuKyGhi(r, state.user));
// 0091: cùng tầng giao với "Sửa thông tin giao" (dat_thong_tin_giao gọi kl_la_tang_giao) — người giao / người tạo việc, lãnh đạo trong phạm vi, quản trị;
// v3.34 (0131): + chủ trì theo dõi khi việc chưa hoàn thành.
export const duocSuaThongTinGiao = (r) => laTangGiao(r) || laChuTriSua(r);

// v3.23 (0103): "Đề nghị xử lý gửi tới" — người giao việc, lãnh đạo Văn phòng, Trưởng phòng (đang hoạt động, khác người ghi); trống = báo tự động
// như cũ (người giao, Phó Chánh VP phụ trách). dat_vuong_mac kiểm người nhận và gửi một tin hệ thống cho đúng người đó.
// Người nhận đang lưu luôn có trong danh sách (kể cả chính người mở hộp) — mở hộp Cập nhật rồi Lưu không tự xoá người nhận.
export function nguoiNhanVuongMacHtml(r, chon = r?.vuong_mac_gui_cho || '') {
  const me = state.user?.id; const giao = r?.giao_thay_mat_cho || r?.tao_boi;
  const hd = (a) => a && !a.is_system && !a.bi_khoa && a.id !== me;
  const opt = (a, phu) => `<option value="${escapeHtml(a.id)}"${a.id === chon ? ' selected' : ''}>${escapeHtml(a.full_name)} — ${escapeHtml(phu)}</option>`;
  const nguoiGiao = hd(findAccount(giao)) && findAccount(giao).role_group !== 'A0' ? [findAccount(giao)] : [];   // 0103: không gửi Thường trực (như 0062)
  const ld = state.accounts.filter((a) => hd(a) && a.role_group === 'A1' && a.id !== giao).sort((a, b) => Number(Boolean(b.is_chief)) - Number(Boolean(a.is_chief)) || a.full_name.localeCompare(b.full_name, 'vi'));
  const tp = state.accounts.filter((a) => hd(a) && a.role_group === 'A2' && a.id !== giao).sort((a, b) => (DEPT_NAMES[a.department] || '').localeCompare(DEPT_NAMES[b.department] || '', 'vi'));
  const daCo = [...nguoiGiao, ...ld, ...tp].some((a) => a.id === chon);
  const hienTai = chon && !daCo ? `<option value="${escapeHtml(chon)}" selected>${escapeHtml(findAccount(chon)?.full_name || 'Người đã chọn')} — đang nhận đề nghị</option>` : '';
  return `<option value="">Tự động: người giao việc và lãnh đạo phụ trách</option>${hienTai}`
    + (nguoiGiao.length ? `<optgroup label="Người giao việc">${nguoiGiao.map((a) => opt(a, 'người giao việc')).join('')}</optgroup>` : '')
    + (ld.length ? `<optgroup label="Lãnh đạo Văn phòng">${ld.map((a) => opt(a, a.position_title || 'Lãnh đạo Văn phòng')).join('')}</optgroup>` : '')
    + (tp.length ? `<optgroup label="Trưởng phòng">${tp.map((a) => opt(a, `Trưởng phòng ${DEPT_NAMES[a.department] || ''}`.trim())).join('')}</optgroup>` : '');
}
export const daGuiVuongMacHtml = (r) => (r?.vuong_mac && r.vuong_mac_gui_cho
  ? `<p class="chu-phu" data-truong="vuong-mac-gui-toi">Đã đề nghị đồng chí ${escapeHtml(findAccount(r.vuong_mac_gui_cho)?.full_name || 'được chọn')} xử lý.</p>` : '');

// Ô lưới (dt/dd) của ngăn: Nguồn, Phối hợp (khi có), Kết quả (việc đã hoàn thành). o(nhãn, giá trị, cột) — cột: ô tầng giao có bút / khoá (0070).
export function oLuoiPr3Html(r, o) {
  const ketQua = r.tien_do_ma === 'HOAN_THANH' ? `${escapeHtml(tenTienDoHoanThanh(r) || 'không đánh giá tiến độ')} ${nhanChatLuongHtml(r.chat_luong) || '<span class="chu-phu">chưa đánh giá chất lượng</span>'}` : '';
  return `${o('Nguồn nhiệm vụ', `<span data-truong="nguon">${escapeHtml(r.nguon_nhiem_vu_ten || 'chưa xác định')}</span>`, 'nguon_nhiem_vu_ma')}
    ${r.don_vi_phoi_hop ? o('Đơn vị phối hợp', `<span data-truong="phoi-hop">${escapeHtml(r.don_vi_phoi_hop)}</span>`, 'don_vi_phoi_hop') : ''}
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
      <p data-truong="vuong-mac">${r.vuong_mac ? escapeHtml(r.vuong_mac) : '<span class="chu-phu">không có</span>'}</p>${daGuiVuongMacHtml(r)}
      ${suaVm ? `${nut('oVm', r.vuong_mac ? 'Sửa vướng mắc' : 'Ghi vướng mắc')}
      <form class="o" id="oVm-${r.id}" data-submit="luuVuongMac" data-id="${r.id}">
        <textarea name="vuong_mac" class="o-nhap" rows="3" maxlength="500" style="flex-basis:100%" aria-label="Vướng mắc / đề nghị lãnh đạo quyết định" placeholder="Nêu vướng mắc, đề nghị cấp nào quyết định việc gì">${escapeHtml(r.vuong_mac || '')}</textarea>
        <label class="nhan vm-gui-toi" style="flex-basis:100%">Đề nghị xử lý gửi tới<select name="gui_cho" class="o-nhap" aria-label="Đề nghị xử lý gửi tới">${nguoiNhanVuongMacHtml(r)}</select></label>
        <small>Tối đa 500 ký tự. Chọn người nhận: đồng chí đó nhận thông báo mỗi lần ghi hoặc sửa; để "Tự động": lần đầu ghi, người giao và lãnh đạo phụ trách nhận thông báo. Để trống nội dung rồi Lưu = đã giải quyết.</small>
        <button type="submit" class="nut chinh">Lưu</button><button type="button" class="nut" data-action="dongO" data-o="oVm-${r.id}">Huỷ</button></form>` : ''}</div>` : '';
  return `<div class="khoi-nho ct-pr3">${vm}</div>`;
}

async function luuVuongMac({ id }, form) {
  const f = new FormData(form);
  const nd = String(f.get('vuong_mac') || '').trim(); const guiCho = String(f.get('gui_cho') || '');
  try {
    await datVuongMac(id, nd, guiCho);
    form.classList.remove('mo');
    const ten = guiCho ? findAccount(guiCho)?.full_name : '';
    notifySuccess(!nd ? 'Đã xoá vướng mắc — coi như đã giải quyết.' : ten ? `Đã ghi vướng mắc và gửi đề nghị xử lý tới đồng chí ${ten}.` : 'Đã ghi vướng mắc.');
    await sauHanhDong(id);
  } catch (e) { notifyError('Không lưu được vướng mắc: ' + loiDeHieu(e)); }
}

export function mountThongTinGiao(registerActions, napLai) {
  sauHanhDong = napLai;
  registerActions({ luuVuongMac });
}
