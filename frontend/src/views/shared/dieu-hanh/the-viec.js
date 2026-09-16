// Thẻ việc Đỏ (mockup bản 5): mã (+ "cần X quyết"), nội dung, số ngày trễ; dòng 4 điều (ai chậm · khâu · sản phẩm thiếu · cấp cần quyết);
// vòng khép kín của chỉ đạo Thường trực (Đã gửi → Văn phòng trả lời (hạn) → Đóng); hành động: Chỉ đạo (A0: một ô + gợi ý, chi_dao_gui
// CHI_DAO_TT) / Đôn đốc (A1/A2: DON_DOC) và Xem diễn biến (mở ngăn chi tiết ở màn hình Nhiệm vụ). Nút chỉ ẩn/hiện; quyền thật ở hàm DB.
import { escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { formatNgay, homNayVN } from '../../../lib/kl/ngay.js';
import { tenKhau, boSoThuTu } from '../../../lib/kl/nhan.js';
import { canToiQuyet, ttCuaViec } from './du-lieu.js';

export const GOI_Y_A0 = ['Báo cáo Thường trực lý do chậm', 'Hoàn thành trước ngày …', 'Chánh Văn phòng trực tiếp xử lý', 'Trình Ban Thường vụ kỳ họp tới'];
export const GOI_Y_VP = ['Khẩn trương hoàn thành trong tuần', 'Báo cáo lý do chậm và mốc hoàn thành', 'Nộp minh chứng ngay khi có văn bản', 'Trình lãnh đạo ký trước ngày …'];
const TEN_VAI_QUYET = { A0: 'Thường trực', A1: 'Văn phòng', A2: 'Trưởng phòng' };
const laA0 = () => state.user?.role_group === 'A0';

// Sản phẩm còn thiếu theo khâu (v_ngoai_le đã cho "chưa định nghĩa" khi thiếu sản phẩm).
export function sanPhamThieu(r) {
  if (r.khau === 'CHUA_NHAN') return 'Chưa ai xác nhận đã nhận việc';
  if (r.khau === 'CHO_MINH_CHUNG') return `${r.san_pham_ten} — đã nộp, chờ xác nhận`;
  return r.san_pham_ten;
}

// Vòng khép kín theo chỉ đạo Thường trực mới nhất trên việc (A0: mình gửi; A1: mình nhận); không có → "Chưa chỉ đạo" + chỉ đạo điều hành chờ.
export function vongHtml(r) {
  const tt = ttCuaViec(r.id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  if (!tt) {
    const cho = r.so_chi_dao_cho_phan_hoi > 0 ? `<i>·</i><span>${r.so_chi_dao_cho_phan_hoi} chỉ đạo điều hành chờ phản hồi</span>` : '';
    return `<div class="vong"><em>${laA0() ? 'Chưa chỉ đạo' : 'Thường trực chưa chỉ đạo'}</em>${cho}</div>`;
  }
  const buoc2 = tt.trang_thai === 'CHO_PHAN_HOI'
    ? `<em class="${tt.qua_han_phan_hoi ? 'qua' : 'dang'}">Văn phòng chưa trả lời, hạn ${formatNgay(tt.han_phan_hoi)}${tt.qua_han_phan_hoi ? ' (quá hạn)' : ''}</em>`
    : '<em class="xong">Đã phản hồi</em>';
  const buoc3 = tt.trang_thai === 'DA_DONG' ? '<em class="xong">Đã đóng</em>' : '<em>Đóng khi xong</em>';
  return `<div class="vong"><em class="xong">Đã gửi ${formatNgay(homNayVN(new Date(tt.created_at)))}</em><i>→</i>${buoc2}<i>→</i>${buoc3}</div>`;
}

// Ô một dòng dưới thẻ: A0 gửi chỉ đạo Thường trực (người nhận, hạn tự tính); A1/A2 đôn đốc (DON_DOC, người liên quan nhận tin).
function oHtml(r) {
  const a0 = laA0();
  const goiY = (a0 ? GOI_Y_A0 : GOI_Y_VP).map((g) => `<button type="button" data-action="dienGoiY" data-goi-y="${escapeHtml(g)}">${escapeHtml(g)}</button>`).join('');
  return `<form class="o" id="oThe-${r.id}" data-submit="${a0 ? 'guiChiDaoTTThe' : 'guiDonDocThe'}" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">
      <small>${a0 ? 'Gửi tới Chánh Văn phòng và PCVP phụ trách; hạn phản hồi 2 ngày làm việc, tự điền.' : 'Đôn đốc gửi Owner, người theo dõi và Trưởng phòng; hạn phản hồi tự điền.'}</small>
      <div class="goi-y">${goiY}</div>
      <input name="noi_dung" required placeholder="Một dòng ${a0 ? 'chỉ đạo' : 'đôn đốc'}, hoặc chọn gợi ý ở trên" aria-label="Nội dung ${a0 ? 'chỉ đạo' : 'đôn đốc'}">
      <button type="submit" class="nut chinh">Gửi</button><button type="button" class="nut" data-action="dongO" data-o="oThe-${r.id}">Huỷ</button>
    </form>`;
}

export function theHtml(r) {
  const quyet = canToiQuyet(r);
  const lop = r.muc_canh_bao === 'DO_DAC_BIET' ? 'dac-biet' : 'do';
  const owner = r.owner_tai_khoan_ten ? `${escapeHtml(r.owner_tai_khoan_ten)}<span>${escapeHtml(boSoThuTu(r.owner_don_vi_ten))}</span>`
    : `${escapeHtml(boSoThuTu(r.owner_don_vi_ten) || '(chưa xác định)')}<span>${r.owner_trong_van_phong ? 'theo dõi: ' + escapeHtml(r.nguoi_theo_doi_ten || '—') : 'đơn vị ngoài Văn phòng'}</span>`;
  const daCo = ttCuaViec(r.id).length > 0;
  const nutChinh = laA0() ? (daCo ? 'Chỉ đạo thêm' : 'Chỉ đạo') : 'Đôn đốc';
  return `<article class="the ${lop}" id="the-${r.id}" data-khau="${r.khau}" data-muc="${escapeHtml(r.muc_canh_bao)}">
      <div class="the-dau"><div class="ten"><b>${escapeHtml(r.ma)}${quyet ? ` — cần ${TEN_VAI_QUYET[state.user?.role_group]} quyết` : ''}</b><span>${escapeHtml(r.noi_dung)}</span></div>
        <div class="tre">${r.so_ngay_qua}<small>ngày trễ</small></div></div>
      <div class="dot"><div>${owner}</div><div><span class="khau">${tenKhau(r.khau)}</span></div>
        <div>${escapeHtml(sanPhamThieu(r))}<span>sản phẩm còn thiếu</span></div><div>${escapeHtml(r.cap_quyet_dinh_ten)}<span>cấp cần quyết</span></div>
        ${r.nguoi_theo_doi_ten && r.owner_tai_khoan_ten ? `<div>${escapeHtml(r.nguoi_theo_doi_ten)}<span>người theo dõi · ${escapeHtml(DEPT_NAMES[r.nguoi_theo_doi_phong] || '')}</span></div>` : ''}</div>
      ${vongHtml(r)}
      <div class="hanh-dong"><button type="button" class="nut chinh" data-action="moO" data-o="oThe-${r.id}">${nutChinh}</button>
        <button type="button" class="nut" data-action="xemDienBien" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">Xem diễn biến</button></div>
      ${oHtml(r)}
    </article>`;
}
