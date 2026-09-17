// Ngăn bên phải dùng chung cho Cán bộ (thuộc quyền / trong phòng / toàn Văn phòng) và Báo cáo — mở ngay trong trang, KHÔNG chuyển sang mục
// Nhiệm vụ: một người (thanh tải + việc mở của người đó) hoặc một việc (điều then chốt). Hành động tại chỗ cho A1/A2: Giao lại (GIAO_LAI,
// người theo dõi mới + lý do) và Nhắc (DON_DOC) — hàm chi_dao_gui là chốt; A0/A3 chỉ đọc. Mỗi màn hình gọi datNapLai để nạp lại sau hành động.
import { $, escapeHtml, show } from '../../lib/dom.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { state } from '../../lib/state.js';
import { formatNgay, soNgay, homNayVN } from '../../lib/kl/ngay.js';
import { nhanTrangThai, lopMep, boSoThuTu } from '../../lib/kl/nhan.js';
import { nguoiTheoDoiMoiOptions } from './dieu-hanh/the-viec.js';

const mo = (r) => r.tien_do_ma !== 'HOAN_THANH';
const duocChiDao = () => ['A1', 'A2'].includes(state.user?.role_group);
const ownerText = (r) => r.owner_tai_khoan_ten || boSoThuTu(r.owner_don_vi_ten) || 'chưa xác định';

// Hạn ngắn gọn cho dòng việc: "trễ 12 ngày · hạn 4/9", "còn 2 ngày · hạn 18/9", "xong 15/9", "chưa có hạn".
export function hanNgan(r, homNay = homNayVN()) {
  if (r.nhom_dem === 'HOAN_THANH') return r.ngay_hoan_thanh ? `xong ${formatNgay(r.ngay_hoan_thanh)}` : 'xong';
  if (!r.han_xu_ly) return 'chưa có hạn';
  const n = soNgay(homNay, r.han_xu_ly);
  return `${n < 0 ? `trễ ${-n} ngày` : n === 0 ? 'đến hạn hôm nay' : `còn ${n} ngày`} · hạn ${formatNgay(r.han_xu_ly)}`;
}
const nhanPhu = (r) => (r.bi_tu_choi ? '<span class="nhan-tu-choi">Bị từ chối, chờ giao lại</span>' : r.tu_choi_cho ? '<span class="nhan-xam">Đề nghị từ chối, chờ duyệt</span>'
  : r.so_chi_dao_cho_phan_hoi > 0 ? `<span class="nhan-xam">${r.so_chi_dao_cho_phan_hoi} chỉ đạo chờ phản hồi</span>` : '');

// Hai ô hành động một dòng dưới một việc (A1/A2): Giao lại, Nhắc.
function hanhDongViecHtml(r, tienTo) {
  if (!duocChiDao() || !mo(r)) return '';
  const ma = escapeHtml(r.ma);
  return `<div class="hanh-dong"><button type="button" class="nut lam" data-action="moO" data-o="${tienTo}GL-${r.id}">Giao lại</button>
      <button type="button" class="nut" data-action="moO" data-o="${tienTo}Nhac-${r.id}">Nhắc</button></div>
    <form class="o" id="${tienTo}GL-${r.id}" data-submit="giaoLaiThe" data-id="${r.id}" data-ma="${ma}">
      <select name="nguoi_theo_doi_moi" required aria-label="Người theo dõi mới"><option value="">Chọn người theo dõi mới</option>${nguoiTheoDoiMoiOptions(r)}</select>
      <input name="noi_dung" required placeholder="Lý do giao lại" aria-label="Lý do giao lại">
      <button type="submit" class="nut chinh">Giao lại</button><button type="button" class="nut" data-action="dongO" data-o="${tienTo}GL-${r.id}">Huỷ</button></form>
    <form class="o" id="${tienTo}Nhac-${r.id}" data-submit="guiDonDocThe" data-id="${r.id}" data-ma="${ma}">
      <input name="noi_dung" required placeholder="Nội dung nhắc" aria-label="Nội dung nhắc">
      <button type="submit" class="nut chinh">Gửi nhắc</button><button type="button" class="nut" data-action="dongO" data-o="${tienTo}Nhac-${r.id}">Huỷ</button></form>`;
}

// Một dòng việc trong ngăn / trong hàng mở rộng của Báo cáo (nút Xem chi tiết mở ngăn việc).
export function dongViecHtml(r, homNay, nutXem = true) {
  return `<div class="nv-dong ${lopMep(r)}" id="ngv-${r.id}"><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(r.noi_dung)}<small>${escapeHtml(ownerText(r))} · ${hanNgan(r, homNay)} ${nhanPhu(r)}</small></p>
      ${nutXem ? `<button type="button" class="nut nho" data-action="moNganViec" data-id="${r.id}">Xem chi tiết</button>` : ''}</div>`;
}

// Ngăn của một người: thanh tải Đỏ/Vàng/đang làm trên việc mở người đó là Owner tài khoản; việc theo dõi liệt kê riêng.
export function nganNguoiHtml(a, rows, dongAction = 'dongNganCanBo') {
  const homNay = homNayVN();
  const owner = rows.filter((r) => r.owner_tai_khoan === a.id && mo(r)).sort((x, y) => (x.so_ngay_qua || 0) < (y.so_ngay_qua || 0) ? 1 : -1);
  const theoDoi = rows.filter((r) => r.nguoi_theo_doi === a.id && r.owner_tai_khoan !== a.id && mo(r));
  const dem = { do: owner.filter((r) => r.muc_canh_bao === 'DO' || r.muc_canh_bao === 'DO_DAC_BIET').length, vang: owner.filter((r) => r.muc_canh_bao === 'VANG').length };
  const lam = owner.length - dem.do - dem.vang; const pct = (n) => (owner.length ? (n / owner.length) * 100 : 0);
  return `<div class="ngan-noi" id="nganNguoi-${a.id}">
      <div class="ngan-dau"><div><b>${escapeHtml(a.full_name)}</b><small>${escapeHtml(a.position_title || '')} · ${escapeHtml(DEPT_NAMES[a.department] || a.department || '')}</small></div>
        <button type="button" class="nut nho" data-action="${dongAction}">Đóng</button></div>
      <div class="tai"><span class="t-do" style="width:${pct(dem.do)}%"></span><span class="t-vang" style="width:${pct(dem.vang)}%"></span><span class="t-lam" style="width:${pct(lam)}%"></span></div>
      <p class="chu-phu">${owner.length} việc mở là Owner: <b>${dem.do}</b> Đỏ, ${dem.vang} Vàng, ${lam} đang làm${theoDoi.length ? ` · ${theoDoi.length} việc theo dõi` : ''}</p>
      <h4>Việc đang mở (${owner.length})</h4>
      ${owner.length ? owner.map((r) => `${dongViecHtml(r, homNay, false)}${hanhDongViecHtml(r, 'oNg')}`).join('') : '<p class="trong-nho">Không có việc mở nào cán bộ này là Owner.</p>'}
      ${theoDoi.length ? `<h4>Việc theo dõi (${theoDoi.length})</h4>${theoDoi.map((r) => dongViecHtml(r, homNay, false)).join('')}` : ''}
    </div>`;
}

// Ngăn của một việc (Báo cáo → Xem chi tiết): điều then chốt + Giao lại / Nhắc; không rời mục.
export function nganViecHtml(r, dongAction = 'dongNganBaoCao') {
  const dd = (t, v) => `<dt>${t}</dt><dd>${v}</dd>`;
  return `<div class="ngan-noi" id="nganViec-${r.id}" data-nhom="${r.nhom_dem}">
      <div class="ngan-dau"><div><b>${escapeHtml(r.ma)}</b><small>${r.so_ket_luan ? `${escapeHtml(r.so_ket_luan)} · ` : ''}${escapeHtml(nhanTrangThai(r))} ${nhanPhu(r)}</small></div>
        <button type="button" class="nut nho" data-action="${dongAction}">Đóng</button></div>
      <h3>${escapeHtml(r.noi_dung)}</h3>
      <dl>${dd('Chủ trì', escapeHtml(ownerText(r)))}${dd('Theo dõi', escapeHtml(r.nguoi_theo_doi_ten || '(trống)'))}
        ${dd('Sản phẩm', escapeHtml(r.san_pham_ten ? `${r.san_pham_ten}${r.san_pham_mo_ta ? `: ${r.san_pham_mo_ta}` : ''}` : 'chưa định nghĩa'))}
        ${dd('Hạn', `<b>${hanNgan(r)}</b>`)}${dd('Cấp quyết', escapeHtml(r.cap_quyet_dinh_ten || 'chưa xác định'))}
        ${dd('Minh chứng', `${r.so_minh_chung_hop_le || 0} hợp lệ`)}</dl>
      ${hanhDongViecHtml(r, 'oNv')}
    </div>`;
}

// Khung hai ngăn: gắn/mở/đóng ngăn ở một màn hình (id aside do màn hình cấp).
export function moNgan(idAside, html) {
  const o = $(idAside); if (!o) return;
  o.innerHTML = html; show(o, true); o.closest('.hai-ngan')?.classList.add('mo');
  if (window.matchMedia('(max-width: 860px)').matches) o.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
export function dongNgan(idAside) {
  const o = $(idAside); if (!o) return;
  o.innerHTML = ''; show(o, false); o.closest('.hai-ngan')?.classList.remove('mo');
}
