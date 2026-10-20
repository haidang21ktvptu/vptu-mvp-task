// Màn hình Tổng quan (giao diện v9) — trang mở đầu của Thường trực (A0), lãnh đạo Văn phòng (A1), Trưởng phòng (A2): nhìn tổng thể việc theo dõi
// thực hiện nhiệm vụ trong phạm vi của mình. Phạm vi do RLS quyết định (v_nhiem_vu, chi_dao); frontend chỉ đếm. Kỳ đổi tại chỗ (không đọc lại); việc
// đang mở và cảnh báo luôn tính đến hôm nay. Bấm bất kỳ số, cột, đoạn, dòng nào → danh sách đúng các việc làm nên con số đó (lib/kl/tong-quan-loc.js)
// mở NGAY TẠI CHỖ trong ngăn chi tiết dùng chung. Realtime: đang xem thì nạp lại nền, gộp sự kiện 2 giây. e2e chờ #viewTongQuan[data-nap].
// v3.24 (bố cục 9 khối cho lãnh đạo, duyệt 16/10/2026): dải đầu (+ kỳ Nhiệm kỳ 2025–2030) → thanh lọc bám đầu (lọc nhanh, 12 ô, chip — loc-template.js)
// → 1 điểm nghẽn, 2 mục tiêu then chốt, 3 lĩnh vực trọng tâm (khoi-lanh-dao.js) → 4 xếp hạng (khoi-them.js), 5 theo tháng + quý → 6 văn bản, 7 chỉ
// đạo + vướng mắc, 8 chất lượng → 9 quản lý nội bộ (KPI theo cán bộ, lãnh đạo VP phụ trách, theo phòng — gập) → ghi chú chất lượng dữ liệu.
// Đợt E / C1 / 0103 giữ nguyên: KPI theo cán bộ, theo lãnh đạo VP phụ trách, chuyên viên xem cả phòng, "Toàn Văn phòng / Phạm vi của tôi".
import { $, escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { registerActions } from '../../../lib/actions.js';
import { notifyError } from '../../../components/toast.js';
import { loadDanhMucKl, loadKlRows, loadPhanCongHieuLuc, cauHinhKl, xemToanBo, chuyenVienXemPhong, danhMucKl, coMucTieu } from '../../../lib/kl/du-lieu.js';
import { loadKetQuaChiTieu } from '../../../lib/kl/muc-tieu-db.js';
import { locTheoViec, chiXem } from '../../../lib/kl/pham-vi.js';
import { LOC_TRONG, coLoc, locTongQuan, tuyChonLoc, theoLoaiVanBan, theoLanhDaoVP, lanhDaoPhuTrach, CHUA_LDVP } from '../../../lib/kl/tong-quan-them.js';
import { tuyChonLocMoi, chipLoc } from '../../../lib/kl/tq-bo-loc.js';
import { loadChiDaoTu } from '../../../lib/kl/dieu-hanh.js';
import { homNayVN } from '../../../lib/kl/ngay.js';
import { tenDoKhan } from '../../../lib/kl/do-khan.js';
import { khoangKy, khoangTuyChon, soLieuChinh, theoThang, khoaNhom, theoNhom, theoVanBan, chatLuongKy, chiDaoKy, theoCanBo, khoaCanBo, khoaPhongCanBo } from '../../../lib/kl/tong-quan.js';
import { theoKhoi, diemNghen, capNghen, theoMucTieu, coGanMucTieu, phanLoaiMucTieu, ketQuaMoiNhat, xepHang, dungHanQuy, vuongMacCho, chatLuongDuLieu, thieuNganh, theoChuTri, khoaChuTri } from '../../../lib/kl/tong-quan-lanh-dao.js';
import { dsNhom, mucTieuCua, timMucTieu, laTuDong, KHONG_THUOC } from '../../../lib/kl/muc-tieu.js';
import { coRaSoat } from '../ra-soat-muc-tieu/index.js';   // v3.25: lối vào Rà soát mục tiêu then chốt
import { locChiTieu } from '../../../lib/kl/tong-quan-loc.js';
import { batKlRealtime } from '../../../features/kl-realtime.js';
import { setActiveNav, showSection, sectionDangHien } from '../../shell/index.js';
import { moNganDanhSach, moNganViec, khiGhiTrongNgan } from '../ngan-chi-tiet.js';
import { dauTrangHtml, theThangHtml, bangNhomHtml, vanBanHtml, chatLuongHtml, chiDaoHtml, KY } from './template.js';
import { kpiCanBoHtml } from './kpi-can-bo.js';
import { thanhLocHtml, loaiVanBanHtml, lanhDaoVpHtml, tenLoai } from './loc-template.js';
import { nghenHtml, mucTieuHtml, linhVucHtml } from './khoi-lanh-dao.js';
import { chuTriHtml } from './chu-tri.js';   // v3.27: khối 2 "Theo chủ trì theo dõi" (mục tiêu then chốt tạm ẩn)
import { xepHangHtml, noiBoHtml, duLieuHtml } from './khoi-them.js';
import { taoHanhDong, docUi, viTriFocus } from './hanh-dong.js';

const tq = { rows: [], tatCa: [], cds: [], phanCong: [], ketQua: [], luc: null, ky: 'nam', loi: null, loc: { ...LOC_TRONG }, toanBo: true,
  ui: { locMo: false, cap: '', tabMt: 'DOT_PHA', lvSap: 'qh', lvMo: new Set(), xh: 'dv', vbXem: 'vb', noiBo: null, ...docUi() } };
export const dongTongQuan = () => tq.rows;   // dòng đã nạp (Giao việc v9 liệt kê việc vừa nhập theo văn bản)
const vai = () => state.user?.role_group;
// 0103: đang xem toàn Văn phòng (cấu hình bật, người xem có việc ngoài phạm vi, chưa chọn "Phạm vi của tôi").
const coNutToanBo = () => xemToanBo() && tq.tatCa.length > tq.rows.length;
const toanVP = () => coNutToanBo() && tq.toanBo;
const coSo = () => (toanVP() ? tq.tatCa : tq.rows);
const vaiNhom = () => (toanVP() ? 'A1' : vai() === 'A3' ? 'A2' : vai());   // chuyên viên xem cả phòng: gom, tiêu đề bảng như Trưởng phòng
const laLanhDaoVP = (id) => state.accounts.find((a) => a.id === id)?.role_group === 'A1';
const laTruongPhong = (id) => { const a = state.accounts.find((x) => x.id === id); return a?.role_group === 'A2' && a.department === state.user?.department; };
const ctxCd = () => ({ vai: toanVP() ? 'A1' : vai(), me: state.user?.id, laLanhDaoVP, laTruongPhong });
const laCapVanPhongThat = () => vai() === 'A0' || (vai() === 'A1' && Boolean(state.user?.is_chief));
const laCapVanPhong = () => laCapVanPhongThat() || toanVP();   // khối / ô lọc "Lãnh đạo VP phụ trách"
const lanhDaoVP = () => state.accounts.filter((a) => a.role_group === 'A1' && !a.is_chief && !a.is_system);
const noiBoMo = () => (tq.ui.noiBo === null ? vaiNhom() === 'A2' : tq.ui.noiBo);   // khối 9: Trưởng phòng / chuyên viên xem phòng mở sẵn

function tieuDe() {
  const u = state.user || {};
  if (toanVP()) return ['Tổng quan thực hiện nhiệm vụ', 'Toàn Văn phòng Tỉnh ủy — việc ngoài phạm vi xử lý của đồng chí chỉ xem'];
  if (u.role_group === 'A0') return ['Tổng quan thực hiện nhiệm vụ', 'Toàn bộ nhiệm vụ Thường trực theo dõi trên hệ thống'];
  if (u.role_group === 'A2') return [`Tổng quan ${DEPT_NAMES[u.department] || 'phòng'}`, 'Nhiệm vụ của phòng'];
  if (u.role_group === 'A3' && !chuyenVienXemPhong()) return ['Tổng quan việc của tôi', 'Việc đồng chí chủ trì, theo dõi hoặc đã giao'];   // 0103: Phạm vi của tôi
  if (u.role_group === 'A3') return [`Tổng quan ${DEPT_NAMES[u.department] || 'phòng'}`, 'Nhiệm vụ của phòng — chỉ xem'];
  return ['Tổng quan thực hiện nhiệm vụ', u.is_chief ? 'Văn phòng Tỉnh ủy' : 'Các phòng, lĩnh vực đồng chí phụ trách'];
}
const coGiaoViec = () => Boolean(state.user?.role_group);   // 0085: mọi vai giao việc được (chuyên viên giao thẳng)
const phongCua = () => Object.fromEntries(state.accounts.map((a) => [a.id, a.department]));   // KPI theo cán bộ: phòng của cán bộ theo danh bạ
// Hàm gom của bảng bấm vào (kh): cán bộ / phòng (KPI), lãnh đạo VP phụ trách (một việc có thể thuộc nhiều lãnh đạo → so với ma đang bấm).
const khoaCua = (c) => (c.kh === 'cb' ? khoaCanBo(phongCua()) : c.kh === 'phong' ? khoaPhongCanBo(phongCua(), DEPT_NAMES)
  : c.kh === 'ldvp' ? (r) => { const ids = lanhDaoPhuTrach(r, tq.phanCong); return [ids.includes(c.ma) ? c.ma : ids.length ? 'KHAC' : CHUA_LDVP, c.ten, null]; }
    : c.kh === 'ct' ? (r) => [...khoaChuTri(r), null]   // v3.27: khối 2 theo chủ trì theo dõi
      : khoaNhom(vaiNhom(), DEPT_NAMES, state.user?.department));
const ctxLoc = () => ({ me: state.user?.id, phanCong: tq.phanCong, mucTieuDm: coMucTieu() ? danhMucKl().mucTieu || [] : [], nganhDm: danhMucKl().nganh || [], linhVucDm: danhMucKl().linhVuc || [] });
const dongDaLoc = () => locTongQuan(coSo(), tq.loc, ctxLoc());
const cdsCoSo = () => (toanVP() ? tq.cds : locTheoViec(tq.cds, tq.rows));   // chỉ đạo đọc theo RLS (0103: mọi việc) → đúng tập việc đang xem
const cdsLoc = () => locTheoViec(cdsCoSo(), dongDaLoc());   // khối 7 theo thanh lọc như mọi khối (rà soát 18/10: số đếm trước đây bỏ qua bộ lọc)
const kyHienTai = (homNay) => (tq.loc.tu || tq.loc.den ? khoangTuyChon(tq.loc.tu, tq.loc.den, homNay) : khoangKy(tq.ky, homNay));
const quyTac = () => `Quy tắc: Vàng = còn ≤ ${cauHinhKl('nguong_vang_ngay', 3)} ngày tới hạn mà chưa có minh chứng (Khẩn trở lên ≤ ${cauHinhKl('do_khan_KHAN_vang', 5)} ngày); Đỏ = quá hạn; Đỏ đặc biệt = quá hạn ≥ ${cauHinhKl('nguong_do_dac_biet_ngay', 3)} ngày; đúng hạn tính trên việc hoàn thành có hạn và ngày hoàn thành; việc hoàn thành chưa rõ ngày tính theo ngày giao.`;
// Nút "Chỉ đạo" ở khối 1: Thường trực, lãnh đạo Văn phòng, Trưởng phòng với việc trong phạm vi xử lý (còn lại "Xem"); quyền thật ở hàm chỉ đạo.
const duocChiDaoViec = (r) => ['A0', 'A1', 'A2'].includes(vai()) && !chiXem(r);

// Khung chờ (lần mở đầu chưa có số): dải đầu + khối nhấp nháy, không hiện số 0 gây hiểu nhầm.
function khungChoHtml() {
  const [td, pv] = tieuDe();
  const khoi = ['n12', 'n12', 'n7', 'n5', 'n4', 'n4', 'n4'].map((n) => `<article class="the-bd ${n}" aria-hidden="true"><span class="xuong" style="width:46%;height:16px"></span><span class="xuong" style="width:30%;margin-top:10px"></span><span class="xuong" style="width:100%;height:150px;margin-top:20px"></span></article>`).join('');
  return `<section class="anh-hung" aria-busy="true"><div class="hung-dau"><div><h1>${escapeHtml(td)}</h1><p>${escapeHtml(pv)}. <span class="ngay-hung">Đang nạp số liệu…</span></p></div></div>
    <div class="hung-so cho">${'<div><span class="xuong" style="width:70px;height:30px"></span></div>'.repeat(5)}</div></section><div class="luoi-tq">${khoi}</div>`;
}

function ve() {
  const v = vai(); const vn = vaiNhom(); const homNay = homNayVN(); const k = kyHienTai(homNay); const rows = dongDaLoc(); const dm = danhMucKl();
  const [td, pv] = tieuDe(); const s = soLieuChinh(rows, k); const thang = theoThang(rows, homNay); const kyTuy = Boolean(tq.loc.tu || tq.loc.den);
  const ten = Object.fromEntries(KY.map((x) => [x, khoangKy(x, homNay).ten]));
  const tc = { ...tuyChonLoc(coSo(), { tenPhong: DEPT_NAMES, tenCanBo: (id) => state.accounts.find((a) => a.id === id)?.full_name, lanhDaoVP: lanhDaoVP(), tenLoai }),
    ...tuyChonLocMoi(coSo(), { mucTieuDm: coMucTieu() ? dm.mucTieu : [], nhomDm: coMucTieu() ? dm.nhomMucTieu : [], khoiDm: (dm.khoi || []).filter((x) => x.dang_dung !== false), nganhDm: dm.nganh, linhVucDm: dm.linhVuc, nguonDm: dm.nguonNhiemVu }) };
  const hienLoc = { phong: v === 'A0' || v === 'A1' || toanVP(), ldvp: laCapVanPhong(), phamViNhan: v === 'A3' ? 'Việc của tôi (chủ trì, theo dõi, đã giao)' : 'Việc tôi theo dõi hoặc giao',
    toanBo: coNutToanBo() ? toanVP() : null };
  const chip = [...chipLoc(tq.loc, tc, { mucTieuDm: dm.mucTieu, nhomDm: dm.nhomMucTieu, phamViNhan: hienLoc.phamViNhan, tenLoai, tenDoKhan }), ...(kyTuy ? [{ k: 'ky', ten: `Kỳ: ${k.ten}` }] : [])];
  const nghen = diemNghen(rows); const cl = chatLuongKy(rows, k); const coCl = Boolean(cl.coDanhGia || cl.traLai);
  const nhomMt = dsNhom(dm.nhomMucTieu, dm.mucTieu); const theo = Object.fromEntries(nhomMt.map((n) => [n.ma, theoMucTieu(rows, dm.mucTieu, n.ma)]));
  const hienCt = tq.ketQua.length > 0 || coSo().some((r) => mucTieuCua(r).some((ma) => timMucTieu(dm.mucTieu, ma)?.nhom === 'CHI_TIEU'));
  const noiBo = `${vn === 'A2' ? '' : kpiCanBoHtml(theoCanBo(rows, k, phongCua(), DEPT_NAMES), k)}${laCapVanPhong() ? lanhDaoVpHtml(theoLanhDaoVP(rows, k, tq.phanCong, lanhDaoVP(), DEPT_NAMES), k) : ''}`
    + bangNhomHtml(theoNhom(rows, k, khoaNhom(vn, DEPT_NAMES, state.user?.department)), vn, k);
  const focus = viTriFocus($('viewTongQuan'));
  $('viewTongQuan').innerHTML = dauTrangHtml({ tieuDe: td, phamVi: pv, k, ten, kyChon: kyTuy ? null : tq.ky, luc: tq.luc, s, thang, coGiaoViec: coGiaoViec(), tong: rows.length, quyTac: quyTac() })
    + thanhLocHtml({ loc: tq.loc, tc, hien: hienLoc, soHien: rows.length, soTong: coSo().length, chip, mo: tq.ui.locMo, coLoc: coLoc(tq.loc) })
    + `<div class="luoi-tq">${nghenHtml(nghen, capNghen(nghen, dm.cap), tq.ui.cap, { duocChiDao: duocChiDaoViec })}`
    + (coMucTieu() ? mucTieuHtml(theo, tq.ui.tabMt, { hienCt, coGan: coGanMucTieu(coSo()), kq: ketQuaMoiNhat(tq.ketQua), nhom: nhomMt, tuDong: rows.filter(laTuDong).length,
      raSoat: coRaSoat(), pl: phanLoaiMucTieu(rows) }) : chuTriHtml(theoChuTri(rows, k), k))
    + linhVucHtml(theoKhoi(rows, k, { khoi: (dm.khoi || []).filter((x) => x.dang_dung !== false), nganh: dm.nganh, linhVuc: dm.linhVuc }, tq.ui.lvSap), tq.ui.lvMo, tq.ui.lvSap, k,
      { raSoat: coRaSoat(), soNganh: (dm.nganh || []).filter((n) => n.ma !== KHONG_THUOC).length, soKhoi: (dm.khoi || []).filter((x) => x.dang_dung !== false && x.ma !== KHONG_THUOC).length,
        thieu: thieuNganh(rows) })
    + xepHangHtml(xepHang(rows, k, tq.ui.xh), tq.ui.xh, k) + theThangHtml(thang, homNay.slice(0, 4), dungHanQuy(rows, homNay))
    + vanBanHtml(theoVanBan(rows), tq.ui.vbXem, loaiVanBanHtml(theoLoaiVanBan(rows), tq.loc.loai))
    + chiDaoHtml(chiDaoKy(cdsLoc(), k, ctxCd()), toanVP() ? 'A1' : v, k, vuongMacCho(rows).length) + (coCl ? chatLuongHtml(cl, k) : '')   // v3.27: khối 8 ẩn khi chưa có số
    + `${noiBoHtml(noiBo, noiBoMo(), vn === 'A2', coCl ? 9 : 8)}${duLieuHtml(chatLuongDuLieu(rows), coMucTieu())}</div><div id="tqGoi" class="goi-tq" role="tooltip" hidden></div>`;
  $('viewTongQuan').dataset.nap = tq.luc.toISOString();
  if (focus) $('viewTongQuan').querySelector(focus)?.focus({ preventScroll: true });   // vẽ lại sau khi đổi ô lọc / bấm nút: giữ tiêu điểm đúng chỗ (bàn phím)
  if (tq.cdTu && tuChiDao() < tq.cdTu) napTongQuan();   // kỳ sớm hơn phần chỉ đạo đã đọc → đọc lại
}
// Thanh lọc: ô chọn / ô ngày (data-loc) đổi → vẽ lại tại chỗ; chip, nút ở hanh-dong.js. Ngăn chi tiết đang mở không đụng.
function onDoiLoc(e) {
  const el = e.target;
  if (!(el instanceof HTMLSelectElement || el instanceof HTMLInputElement) || !el.dataset.loc || !el.closest('#tqLoc')) return;
  if (el.type === 'date' && el.value && !/^(19[9]\d|2\d{3})-\d{2}-\d{2}$/.test(el.value)) return;   // đang gõ năm (0002, 0020…): chờ gõ đủ năm
  tq.loc = { ...tq.loc, [el.dataset.loc]: el.value }; if (tq.luc) ve();
}

// Một lượt nạp tại một thời điểm; lượt tới trong lúc đang nạp chạy một lần sau khi xong (realtime + mở lại màn). Lỗi (DB bận) thử lại một
// lần sau 800 ms như "Cần xử lý"; vẫn lỗi thì chỉ báo khi đang xem Tổng quan (đã rời màn thì không đè thông báo lên màn khác).
let dangNap = null; let canNapLai = false;
// Chỉ đạo đọc từ đầu năm, hoặc từ đầu kỳ đang xem nếu sớm hơn (Nhiệm kỳ, khoảng ngày) — ve() nạp lại khi chọn kỳ sớm hơn phần đã đọc.
const tuChiDao = () => { const dau = `${homNayVN().slice(0, 4)}-01-01`; const tu = kyHienTai(homNayVN()).tu; return tu && tu < dau ? tu : dau; };
const docSoLieu = (cdTu) => Promise.all([loadDanhMucKl(), loadKlRows(), loadChiDaoTu(cdTu), laCapVanPhong() || xemToanBo() ? loadPhanCongHieuLuc() : [],
  coMucTieu() ? loadKetQuaChiTieu() : []]);   // v3.27: mục tiêu tạm ẩn → không đọc kết quả chỉ tiêu
async function napMotLan(lan = 0) {
  try {
    const cdTu = tuChiDao();
    const [, r, cds, phanCong, ketQua] = await docSoLieu(cdTu);
    Object.assign(tq, { rows: r.rows, tatCa: r.tatCa, cds, phanCong, ketQua, cdTu, luc: r.luc, loi: null });
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

// Gợi ý khi rê chuột / đưa tiêu điểm vào phần tử có data-goi (cột, đoạn thanh xếp chồng).
function hienGoi(e) {
  const el = e.target.closest?.('#viewTongQuan [data-goi]'); const goi = $('tqGoi');
  if (!goi) return;
  if (!el) { goi.hidden = true; return; }
  goi.textContent = el.dataset.goi; goi.hidden = false;
  const r = el.getBoundingClientRect(); const w = goi.offsetWidth;
  goi.style.left = `${Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2))}px`;
  goi.style.top = `${Math.max(8, r.top - goi.offsetHeight - 8)}px`;
}

// Bấm một chỉ tiêu: lọc đúng tập việc trên CÙNG dữ liệu (đã qua thanh lọc) và kỳ đang hiện (tổng danh sách = con số đã bấm), mở trong ngăn chi tiết.
function tqMo({ ct }) {
  let c; try { c = JSON.parse(ct || '{}'); } catch { return; }
  const homNay = homNayVN(); const k = kyHienTai(homNay);
  const kq = locChiTieu(dongDaLoc(), c, k, { khoa: khoaCua(c), cds: cdsLoc(), ctxCd: ctxCd(), homNay, nganhDm: danhMucKl().nganh || [], linhVucDm: danhMucKl().linhVuc || [] });
  if (coLoc(tq.loc) && c.t !== 'loc') kq.tieuDe = `${kq.tieuDe} (đã lọc)`;
  const goi = document.getElementById('tqGoi'); if (goi) goi.hidden = true;
  moNganDanhSach(kq);
}
// Khối 1: bấm việc → chi tiết trong ngăn; "Chỉ đạo" → ngăn mở sẵn ô chỉ đạo (cheDo 'chi-dao').
const dongTq = (id) => coSo().find((r) => r.id === id) || tq.tatCa.find((r) => r.id === id) || null;

export function registerTongQuan() {
  registerActions({ openTongQuan, tqMo, ...taoHanhDong(tq, ve, noiBoMo),
    tqMoViec: ({ id }) => moNganViec(id, { row: dongTq(id) }), tqChiDao: ({ id }) => moNganViec(id, { cheDo: 'chi-dao', row: dongTq(id) }) });
  $('viewTongQuan').addEventListener('change', onDoiLoc);
  khiGhiTrongNgan('viewTongQuan', napTongQuan);   // v3.24: ghi trong ngăn (gắn mục tiêu không qua realtime) → số liệu mới ngay
  document.addEventListener('mouseover', hienGoi);
  document.addEventListener('focusin', hienGoi);
  window.addEventListener('scroll', () => { const g = $('tqGoi'); if (g) g.hidden = true; }, { passive: true });
}
