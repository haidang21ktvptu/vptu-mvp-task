// A0 "Chỉ đạo đã gửi": mọi chỉ đạo Thường trực mình đã gửi (v_chi_dao_tt), chờ phản hồi xếp trước; lọc theo trạng thái; mỗi dòng ghi
// nội dung, gửi lúc, hạn phản hồi, người nhận, phản hồi (ai, lúc nào); "Mở việc" sang ngăn chi tiết; A0 đóng luồng của mình tại đây.
import { $, escapeHtml, formatDateTime } from '../../lib/dom.js';
import { state, findAccount } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifySuccess, notifyError } from '../../components/toast.js';
import { loadChiDaoTT, chiDaoDong, TEN_TRANG_THAI_CHI_DAO } from '../../lib/kl/dieu-hanh.js';
import { formatNgay } from '../../lib/kl/ngay.js';
import { setActiveNav, showSection } from '../shell/index.js';

const LOP_TT = { CHO_PHAN_HOI: 'trang-thai tt-cho', DA_PHAN_HOI: 'trang-thai tt-xong', DA_DONG: 'trang-thai tt-xam' };
let rows = []; let loc = '';

function dongHtml(c) {
  const phanHoi = c.trang_thai === 'CHO_PHAN_HOI' ? '' : `<small>Phản hồi: ${escapeHtml(c.phan_hoi || '')} — ${escapeHtml(findAccount(c.phan_hoi_boi)?.full_name || '')}${c.phan_hoi_luc ? `, ${formatDateTime(c.phan_hoi_luc)}` : ''}</small>`;
  const trangThai = `<span class="${LOP_TT[c.trang_thai] || 'trang-thai'}">${TEN_TRANG_THAI_CHI_DAO[c.trang_thai] || c.trang_thai}${c.qua_han_phan_hoi ? ' · quá hạn' : ''}</span>`;
  const nut = `<span class="hanh-dong" style="margin:0"><button type="button" class="nut nho" data-action="moChiDaoViec" data-id="${c.nhiem_vu_id}" data-ma="${escapeHtml(c.ma)}">Mở việc</button>
    ${c.trang_thai !== 'DA_DONG' ? `<button type="button" class="nut nho" data-action="dongChiDaoDaGui" data-id="${c.id}">Đóng</button>` : ''}</span>`;
  return `<div id="cdg-${c.id}" data-trang-thai="${c.trang_thai}"><p><b>${escapeHtml(c.ma)}</b> ${escapeHtml(c.noi_dung)}
      <small>${escapeHtml(c.nhiem_vu_noi_dung)} · gửi ${formatDateTime(c.created_at)} · hạn phản hồi ${formatNgay(c.han_phan_hoi)} · người nhận: ${(c.nguoi_nhan_ten || []).map(escapeHtml).join(', ')}</small>${phanHoi}</p>
      ${trangThai}${nut}</div>`;
}

function ve() {
  const ds = rows.filter((c) => !loc || c.trang_thai === loc);
  const dem = (tt) => rows.filter((c) => c.trang_thai === tt).length;
  const nutLoc = (v, nhan) => `<button type="button" data-action="locChiDaoDaGui" data-tt="${v}" aria-pressed="${String(loc === v)}">${nhan}</button>`;
  $('viewChiDaoDaGui').innerHTML = `
    <div class="dau"><h1>Chỉ đạo đã gửi</h1><span>${rows.length} chỉ đạo Thường trực; ${dem('CHO_PHAN_HOI')} chờ phản hồi</span>
      <div class="phai-dau"><button type="button" class="nut nho" data-action="openChiDaoDaGui">Tải lại</button></div></div>
    <div class="tq" role="group" aria-label="Lọc theo trạng thái">${nutLoc('', 'Tất cả')}${nutLoc('CHO_PHAN_HOI', `<b>${dem('CHO_PHAN_HOI')}</b> chờ phản hồi`)}${nutLoc('DA_PHAN_HOI', `<b>${dem('DA_PHAN_HOI')}</b> đã phản hồi`)}${nutLoc('DA_DONG', `<b>${dem('DA_DONG')}</b> đã đóng`)}</div>
    ${ds.length ? `<div class="da-gui" id="cdgDanhSach">${ds.map(dongHtml).join('')}</div>` : '<p class="trong" style="margin-top:14px">Chưa có chỉ đạo nào ở bộ lọc này.</p>'}`;
}

async function openChiDaoDaGui() {
  showSection('viewChiDaoDaGui');
  setActiveNav('navChiDaoDaGui');
  try { rows = (await loadChiDaoTT()).filter((c) => c.nguoi_gui === state.user?.id); ve(); } catch (e) { notifyError(e.message); }
}
const locChiDaoDaGui = ({ tt }) => { loc = tt; ve(); };
async function dongChiDaoDaGui({ id }) {
  try { await chiDaoDong(id); notifySuccess('Đã đóng chỉ đạo.'); openChiDaoDaGui(); } catch (e) { notifyError(e.message); }
}

export function registerChiDaoDaGui() {
  registerActions({ openChiDaoDaGui, locChiDaoDaGui, dongChiDaoDaGui });
}
