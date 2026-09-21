// Màn hình "Chỉ đạo Thường trực" của THƯ KÝ Thường trực (0047, cờ accounts.thu_ky_thuong_truc; menu nhóm Theo dõi): mọi chỉ đạo Thường trực
// đang mở trong phạm vi đọc (v_chi_dao_tt, RLS: thư ký thấy việc có ≥ 1 CHI_DAO_TT) — nhiệm vụ, người nhận, gửi lúc, độ khẩn, trạng thái phản hồi;
// mỗi dòng #cdtk-<id>: "Mở việc" (ngăn #klChiTiet) và "Đóng thay mặt Thường trực" (xác nhận một bước tại dòng → chi_dao_dong, hàm là chốt:
// chỉ CHI_DAO_TT, ghi vết "Đóng thay mặt Thường trực — <họ tên>"). Thư ký không gửi chỉ đạo, không có quyền ghi khác.
import { $, escapeHtml, formatDateTime, show } from '../../../lib/dom.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { loadChiDaoTT, chiDaoDong, TEN_TRANG_THAI_CHI_DAO } from '../../../lib/kl/dieu-hanh.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { nhanDoKhanHtml } from '../../../lib/kl/do-khan.js';
import { setActiveNav, showSection } from '../../shell/index.js';

const LOP_TT = { CHO_PHAN_HOI: 'trang-thai tt-cho', DA_PHAN_HOI: 'trang-thai tt-xong', DA_DONG: 'trang-thai tt-xam' };
let rows = [];

function dongHtml(c) {
  const phanHoi = c.trang_thai === 'CHO_PHAN_HOI' ? '' : `<small>Phản hồi: ${escapeHtml(c.phan_hoi || '')}${c.phan_hoi_luc ? `, ${formatDateTime(c.phan_hoi_luc)}` : ''}</small>`;
  return `<div id="cdtk-${c.id}" data-trang-thai="${c.trang_thai}" data-nv="${c.nhiem_vu_id}"><p><b>${escapeHtml(c.ma)}</b> ${escapeHtml(c.noi_dung)} ${nhanDoKhanHtml(c.do_khan)}
      <small>${escapeHtml(c.nhiem_vu_noi_dung)} · gửi ${formatDateTime(c.created_at)} · hạn phản hồi ${formatNgay(c.han_phan_hoi)} · người nhận: ${(c.nguoi_nhan_ten || []).map(escapeHtml).join(', ')}</small>${phanHoi}</p>
      <span class="${LOP_TT[c.trang_thai] || 'trang-thai'}">${TEN_TRANG_THAI_CHI_DAO[c.trang_thai] || c.trang_thai}${c.qua_han_phan_hoi ? ' · quá hạn' : ''}</span>
      <span class="hanh-dong" style="margin:0"><button type="button" class="nut nho" data-action="moChiDaoViec" data-id="${c.nhiem_vu_id}" data-ma="${escapeHtml(c.ma)}">Mở việc</button>
        <button type="button" class="nut nho chinh" id="tkDong-${c.id}" data-action="hoiDongThayMatTT" data-id="${c.id}">Đóng thay mặt Thường trực</button>
        <span class="tk-xac-nhan hidden" id="tkXn-${c.id}">Đóng chỉ đạo này thay mặt Thường trực?
          <button type="button" class="nut nho chinh" data-action="dongThayMatTT" data-id="${c.id}">Xác nhận đóng</button>
          <button type="button" class="nut nho" data-action="huyDongThayMatTT" data-id="${c.id}">Huỷ</button></span></span></div>`;
}

function ve() {
  $('viewChiDaoTTThuKy').innerHTML = `
    <div class="dau"><h1>Chỉ đạo Thường trực</h1><span>${rows.length} chỉ đạo đang mở · thư ký đóng thay mặt Thường trực khi Văn phòng đã xử lý xong</span>
      <div class="phai-dau"><button type="button" class="nut nho" data-action="openChiDaoTTThuKy">Tải lại</button></div></div>
    ${rows.length ? `<div class="da-gui" id="cdtkDanhSach" data-nap="${Date.now()}">${rows.map(dongHtml).join('')}</div>` : `<p class="trong" id="cdtkDanhSach" data-nap="${Date.now()}" style="margin-top:14px">Không có chỉ đạo Thường trực nào đang mở.</p>`}`;
}

async function openChiDaoTTThuKy() {
  showSection('viewChiDaoTTThuKy');
  setActiveNav('navChiDaoTTThuKy');
  try { rows = (await loadChiDaoTT()).filter((c) => c.trang_thai !== 'DA_DONG'); ve(); } catch (e) { notifyError(e.message); }
}
const hoiDongThayMatTT = ({ id }) => { show(`tkXn-${id}`, true); show(`tkDong-${id}`, false); };
const huyDongThayMatTT = ({ id }) => { show(`tkXn-${id}`, false); show(`tkDong-${id}`, true); };
async function dongThayMatTT({ id }) {
  try { await chiDaoDong(id); notifySuccess('Đã đóng chỉ đạo thay mặt Thường trực. Thường trực và người nhận được báo.'); await openChiDaoTTThuKy(); } catch (e) { notifyError(e.message); }
}

export function registerChiDaoTTThuKy() {
  registerActions({ openChiDaoTTThuKy, hoiDongThayMatTT, huyDongThayMatTT, dongThayMatTT }); // moChiDaoViec: dieu-hanh/hanh-dong.js (dùng chung)
}
