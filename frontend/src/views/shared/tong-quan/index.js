// Màn hình Tổng quan (giao diện v9) — trang mở đầu của Thường trực (A0), lãnh đạo Văn phòng (A1), Trưởng phòng (A2): nhìn tổng thể việc theo dõi
// thực hiện nhiệm vụ trong phạm vi của mình. Phạm vi do RLS quyết định (v_nhiem_vu, chi_dao); frontend chỉ đếm (lib/kl/tong-quan.js). Kỳ Tháng /
// Quý / Năm đổi tại chỗ (không đọc lại); việc đang mở và cảnh báo luôn tính đến hôm nay. v9 đợt 2: bấm bất kỳ số, cột, đoạn, dòng nào →
// danh sách đúng các việc làm nên con số đó (lib/kl/tong-quan-loc.js) mở NGAY TẠI CHỖ trong ngăn chi tiết dùng chung → bấm một việc xem chi
// tiết, có nút quay lại; không chuyển sang mục khác. Realtime: đang xem thì nạp lại nền, gộp sự kiện 2 giây. e2e chờ #viewTongQuan[data-nap].
// Đợt E v3.18: A0 / A1 có thêm khối "KPI theo cán bộ" (kpi-can-bo.js — từng phòng rồi từng cán bộ chủ trì; A2 đã có bảng Theo cán bộ).
import { $, escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { registerActions } from '../../../lib/actions.js';
import { notifyError } from '../../../components/toast.js';
import { loadDanhMucKl, loadKlRows } from '../../../lib/kl/du-lieu.js';
import { loadChiDaoTu } from '../../../lib/kl/dieu-hanh.js';
import { homNayVN } from '../../../lib/kl/ngay.js';
import { khoangKy, soLieuChinh, theoThang, khoaNhom, theoNhom, theoVanBan, theoLinhVuc, chatLuongKy, chiDaoKy, canhBaoDo, theoCanBo, khoaCanBo, khoaPhongCanBo } from '../../../lib/kl/tong-quan.js';
import { locChiTieu } from '../../../lib/kl/tong-quan-loc.js';
import { batKlRealtime } from '../../../features/kl-realtime.js';
import { setActiveNav, showSection, sectionDangHien } from '../../shell/index.js';
import { moNganDanhSach } from '../ngan-chi-tiet.js';
import { dauTrangHtml, canhBaoHtml, theThangHtml, coCauHtml, bangNhomHtml, vanBanHtml, linhVucHtml, chatLuongHtml, chiDaoHtml } from './template.js';
import { kpiCanBoHtml } from './kpi-can-bo.js';

const tq = { rows: [], cds: [], luc: null, ky: 'nam', loi: null };
export const dongTongQuan = () => tq.rows;   // dòng đã nạp (Giao việc v9 liệt kê việc vừa nhập theo văn bản)
const vai = () => state.user?.role_group;
const KY = ['thang', 'quy', 'nam'];
const laLanhDaoVP = (id) => state.accounts.find((a) => a.id === id)?.role_group === 'A1';
const ctxCd = () => ({ vai: vai(), me: state.user?.id, laLanhDaoVP });

function tieuDe() {
  const u = state.user || {};
  if (u.role_group === 'A0') return ['Tổng quan thực hiện nhiệm vụ', 'Toàn bộ nhiệm vụ Thường trực theo dõi trên hệ thống'];
  if (u.role_group === 'A2') return [`Tổng quan ${DEPT_NAMES[u.department] || 'phòng'}`, 'Nhiệm vụ của phòng'];
  return ['Tổng quan thực hiện nhiệm vụ', u.is_chief ? 'Văn phòng Tỉnh ủy' : 'Các phòng, lĩnh vực đồng chí phụ trách'];
}
const coGiaoViec = () => ['A0', 'A1', 'A2'].includes(vai()) || Boolean(state.user?.quan_tri_kl);
const phongCua = () => Object.fromEntries(state.accounts.map((a) => [a.id, a.department]));   // KPI theo cán bộ: phòng của cán bộ theo danh bạ
const khoaCua = (kh) => (kh === 'cb' ? khoaCanBo(phongCua()) : kh === 'phong' ? khoaPhongCanBo(phongCua(), DEPT_NAMES) : khoaNhom(vai(), DEPT_NAMES, state.user?.department));

// Khung chờ (lần mở đầu chưa có số): dải đầu + 7 khối nhấp nháy, không hiện số 0 gây hiểu nhầm.
function khungChoHtml() {
  const [td, pv] = tieuDe();
  const khoi = ['n7', 'n5', 'n7', 'n5', 'n4', 'n4', 'n4'].map((n) => `<article class="the-bd ${n}" aria-hidden="true"><span class="xuong" style="width:46%;height:16px"></span><span class="xuong" style="width:30%;margin-top:10px"></span><span class="xuong" style="width:100%;height:150px;margin-top:20px"></span></article>`).join('');
  return `<section class="anh-hung" aria-busy="true"><div class="hung-dau"><div><h1>${escapeHtml(td)}</h1><p>${escapeHtml(pv)}. <span class="ngay-hung">Đang nạp số liệu…</span></p></div></div>
    <div class="hung-so cho">${'<div><span class="xuong" style="width:70px;height:30px"></span></div>'.repeat(5)}</div></section><div class="luoi-tq">${khoi}</div>`;
}

function ve() {
  const v = vai(); const homNay = homNayVN(); const k = khoangKy(tq.ky, homNay); const rows = tq.rows;
  const [td, pv] = tieuDe(); const s = soLieuChinh(rows, k); const thang = theoThang(rows, homNay);
  const ten = Object.fromEntries(KY.map((x) => [x, khoangKy(x, homNay).ten]));
  $('viewTongQuan').innerHTML = dauTrangHtml({ tieuDe: td, phamVi: pv, k, ten, kyChon: tq.ky, luc: tq.luc, s, thang, coGiaoViec: coGiaoViec() })
    + canhBaoHtml(canhBaoDo(rows), v)
    + `<div class="luoi-tq">${v === 'A2' ? '' : kpiCanBoHtml(theoCanBo(rows, k, phongCua(), DEPT_NAMES), k)}`
    + `${theThangHtml(thang, homNay.slice(0, 4))}${coCauHtml(s, k)}${bangNhomHtml(theoNhom(rows, k, khoaNhom(v, DEPT_NAMES, state.user?.department)), v, k)}`
    + `${vanBanHtml(theoVanBan(rows))}${linhVucHtml(theoLinhVuc(rows), s.dangMo)}${chatLuongHtml(chatLuongKy(rows, k), k)}`
    + `${chiDaoHtml(chiDaoKy(tq.cds, k, ctxCd()), v, k)}</div><div id="tqGoi" class="goi-tq" role="tooltip" hidden></div>`;
  $('viewTongQuan').dataset.nap = tq.luc.toISOString();
}

// Một lượt nạp tại một thời điểm; lượt tới trong lúc đang nạp chạy một lần sau khi xong (realtime + mở lại màn). Lỗi (DB bận) thử lại một
// lần sau 800 ms như "Cần xử lý"; vẫn lỗi thì chỉ báo khi đang xem Tổng quan (đã rời màn thì không đè thông báo lên màn khác).
let dangNap = null; let canNapLai = false;
const docSoLieu = () => Promise.all([loadDanhMucKl(), loadKlRows(), loadChiDaoTu(`${homNayVN().slice(0, 4)}-01-01`)]);
async function napMotLan(lan = 0) {
  try {
    const [, r, cds] = await docSoLieu();
    Object.assign(tq, { rows: r.rows, cds, luc: r.luc, loi: null });
    if (sectionDangHien('viewTongQuan')) ve();
  } catch (e) {
    if (lan < 1) { await new Promise((ok) => { setTimeout(ok, 800); }); return napMotLan(lan + 1); }
    tq.loi = e.message;
    if (!sectionDangHien('viewTongQuan')) return;
    if (!tq.luc) $('viewTongQuan').innerHTML = `<p class="trong">Không đọc được số liệu tổng quan: ${escapeHtml(e.message)} <button type="button" class="nut nho" data-action="openTongQuan">Thử lại</button></p>`;
    else notifyError('Không đọc được số liệu tổng quan: ' + e.message);
  }
}
export function napTongQuan() {
  if (dangNap) { canNapLai = true; return dangNap; }
  dangNap = (async () => {
    try { await napMotLan(); } finally { dangNap = null; }
    if (canNapLai) { canNapLai = false; await napTongQuan(); }
  })();
  return dangNap;
}

let henRealtime = null;
export function openTongQuan() {
  showSection('viewTongQuan');
  setActiveNav('navTongQuan');
  if (tq.luc) ve(); else { $('viewTongQuan').innerHTML = khungChoHtml(); $('viewTongQuan').removeAttribute('data-nap'); }
  batKlRealtime(() => {
    if (!sectionDangHien('viewTongQuan')) return;
    clearTimeout(henRealtime); henRealtime = setTimeout(() => { if (sectionDangHien('viewTongQuan')) napTongQuan(); }, 2000);
  });
  return napTongQuan();
}

// Gợi ý khi rê chuột / đưa tiêu điểm vào phần tử có data-goi (cột, đoạn thanh xếp chồng, thanh lĩnh vực).
function hienGoi(e) {
  const el = e.target.closest?.('#viewTongQuan [data-goi]'); const goi = $('tqGoi');
  if (!goi) return;
  if (!el) { goi.hidden = true; return; }
  goi.textContent = el.dataset.goi; goi.hidden = false;
  const r = el.getBoundingClientRect(); const w = goi.offsetWidth;
  goi.style.left = `${Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2))}px`;
  goi.style.top = `${Math.max(8, r.top - goi.offsetHeight - 8)}px`;
}

// Bấm một chỉ tiêu: lọc đúng tập việc trên CÙNG dữ liệu và kỳ đang hiện (tổng danh sách = con số đã bấm), mở trong ngăn chi tiết.
function tqMo({ ct }) {
  let c; try { c = JSON.parse(ct || '{}'); } catch { return; }
  const homNay = homNayVN(); const k = khoangKy(tq.ky, homNay);
  const kq = locChiTieu(tq.rows, c, k, { khoa: khoaCua(c.kh), cds: tq.cds, ctxCd: ctxCd(), homNay });
  const goi = document.getElementById('tqGoi'); if (goi) goi.hidden = true;
  moNganDanhSach(kq);
}

export function registerTongQuan() {
  registerActions({ openTongQuan, tqKy: ({ ky }) => { if (KY.includes(ky)) { tq.ky = ky; if (tq.luc) ve(); } }, tqMo });
  document.addEventListener('mouseover', hienGoi);
  document.addEventListener('focusin', hienGoi);
  window.addEventListener('scroll', () => { const g = $('tqGoi'); if (g) g.hidden = true; }, { passive: true });
}
