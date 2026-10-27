// Báo cáo (A1; v3.33 thêm Trưởng phòng, chuyên viên — menu.js): dải số đầu trang; "Việc cần lãnh đạo quyết định"; theo phòng chuyên môn; theo chuyên viên thực hiện của mỗi phòng (v3.29); theo nguồn
// nhiệm vụ; theo kết luận, văn bản giao việc; nút In/PDF (window.print — in.css giữ dải và bảng, bỏ nút) và Xuất Excel (nạp động lib/kl/xuat.js). Số
// liệu đếm client trên dòng RLS trả về (DB-5). v3.29 (chủ dự án 22/10/2026): mọi bảng cùng sáu cột (lib/kl/bao-cao.js) — Tổng số nhiệm vụ, Quá hạn,
// Sắp đến hạn (còn ≤ 3 ngày), Đang thực hiện, Hoàn thành, Trước hạn; cách xếp mức như Tổng quan; bỏ 4 cột chất lượng. Bấm một số / một dòng → danh
// sách việc mở rộng ngay dưới dòng; "Xem chi tiết" → ngăn chi tiết dùng chung (đủ chỉ đạo, Giao lại, Nhắc, minh chứng, diễn biến) mở ngay trên
// trang, KHÔNG chuyển sang mục Nhiệm vụ. Ghi xong trong ngăn → bảng tự nạp lại (giữ hàng đang mở rộng).
// v3.30 (chủ dự án 23/10/2026): xem theo kỳ — Tháng / Quý / Năm (mặc định) / Nhiệm kỳ hoặc từ ngày đến ngày, tính như Tổng quan (locTheoKy): việc chưa
// hoàn thành tính tới hôm nay + việc hoàn thành trong kỳ; dải số, bốn bảng, danh sách khi bấm, In, Xuất Excel theo kỳ; "Việc cần lãnh đạo quyết định"
// luôn là việc đang mở. Kỳ đang chọn giữ trong phiên. Bỏ dòng "Cách tính" (cách tính ghi ở Hướng dẫn sử dụng).
// v3.33 (chủ dự án 27/10/2026 — CAU-HOI S-1, S-4): cấu hình xem toàn bộ (0103) bật → mặc định TOÀN VĂN PHÒNG (tatCa của loadKlRows, như Tổng quan),
// nút "Phạm vi của tôi" (giữ trong phiên); chỉ hiện khi người xem có việc ngoài phạm vi. Dải số, bảng, danh sách khi bấm, "Việc cần lãnh đạo quyết
// định", In, Xuất Excel theo phạm vi đang chọn; việc ngoài phạm vi mở ngăn chi tiết chỉ xem (chiXemVoi). Trưởng phòng, chuyên viên cũng có mục này (menu.js).
import { $, escapeHtml, show } from '../../lib/dom.js';
import { registerActions } from '../../lib/actions.js';
import { state } from '../../lib/state.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { notifyError, notifySuccess } from '../../components/toast.js';
import { loadDanhMucKl, loadCauHinhKl, loadKlRows, danhMucKl, xemToanBo } from '../../lib/kl/du-lieu.js';
import { sapXep } from '../../lib/kl/tong-hop.js';
import { boSoThuTu, nguongCanhBao } from '../../lib/kl/nhan.js';
import { formatNgay, homNayVN } from '../../lib/kl/ngay.js';
import { cotBaoCao, demCot, locBaoCao, locTheoKy, theoPhongChuyenMon, theoChuyenVien, theoNguon, theoVanBanBc } from '../../lib/kl/bao-cao.js';
import { khoangKy, khoangTuyChon } from '../../lib/kl/tong-quan.js';
import { setActiveNav, showSection } from '../shell/index.js';
import { ngayDaiVN } from '../shared/dieu-hanh/man-hinh.js';
import { datNapLai } from '../shared/dieu-hanh/hanh-dong.js';
import { dongViecHtml } from '../shared/ngan-viec.js';
import { datNguonDong, khiGhiTrongNgan } from '../shared/ngan-chi-tiet.js';

let rowsHienTai = []; let rowsKy = []; let hangMo = null; let hangMoLoc = '{}'; // mọi việc của phạm vi đang xem; việc của kỳ đang xem; hàng đang mở rộng
let trong = []; let tatCa = []; let bcToanBo = true;   // v3.33: việc trong phạm vi xử lý / mọi việc đọc được; đang chọn Toàn Văn phòng (giữ trong phiên)
const coNutToanBo = () => xemToanBo() && tatCa.length > trong.length;   // như Tổng quan: chỉ khi có việc ngoài phạm vi (Chánh VP vốn thấy hết)
const toanVP = () => coNutToanBo() && bcToanBo;
const PHAM_VI = () => (toanVP() ? 'toàn Văn phòng Tỉnh ủy — việc ngoài phạm vi xử lý của đồng chí chỉ xem' : 'phạm vi phụ trách của đồng chí');
let kyBc = { ky: 'nam', tu: '', den: '' };   // kỳ đang xem (giữ trong phiên): nút nhanh, hoặc từ ngày / đến ngày (điền thì thay nút nhanh)
const KY_NUT = ['thang', 'quy', 'nam', 'nhiem-ky'];
const kyHienTai = () => (kyBc.tu || kyBc.den ? khoangTuyChon(kyBc.tu, kyBc.den, homNayVN()) : khoangKy(kyBc.ky, homNayVN()));
const moTaKy = (k) => (k.ky === 'tuy-chon' ? k.trong.charAt(0).toUpperCase() + k.trong.slice(1) : `${k.ten} (${formatNgay(k.tu)} – ${formatNgay(k.den)})`);

const ctx = () => ({ phongCua: Object.fromEntries((state.accounts || []).map((a) => [a.id, a.department])), tenPhong: DEPT_NAMES });
const COT = () => cotBaoCao(nguongCanhBao().vang);
const SO_COT = 7;   // cột tên + sáu cột số
const LOP = { qua: 'chinh', xong: 'lam', truoc: 'lam' };
const locAttr = (loc) => `data-loc='${escapeHtml(JSON.stringify(loc))}'`;
const nut = (n, loc, lop = '') => (n > 0 ? `<button type="button" class="nut nho ${lop}" data-action="bcMoRong" ${locAttr(loc)}>${n}</button>` : '<span class="chu-phu">·</span>');
const DAU_BANG = (ten) => `<thead><tr><th>${ten}</th>${COT().map(([, t]) => `<th class="so">${t}</th>`).join('')}</tr></thead>`;
// Khoá hàng: bảng (b) + nhóm — cùng một phòng ở hai bảng là hai hàng khác nhau (mỗi lúc chỉ một hàng mở rộng, một #bcMoRong).
const khoaHangCua = (loc) => JSON.stringify(['b', 'phong', 'canBo', 'nguon', 'ketLuan'].filter((k) => k in loc).map((k) => [k, loc[k]]));

// Hàng mở rộng ngay dưới dòng đang chọn: danh sách việc theo bộ lọc của ô số vừa bấm (hoặc cả dòng).
function hangMoRongHtml(loc) {
  const ds = sapXep(locBaoCao(rowsKy, loc, ctx())); const homNay = homNayVN();
  return `<tr class="mo-rong" id="bcMoRong"><td colspan="${SO_COT}"><div class="nv-ds">${ds.length ? ds.map((r) => dongViecHtml(r, homNay)).join('') : '<p class="trong-nho">Không có việc nào.</p>'}</div></td></tr>`;
}
function dong(ten, phu, loc, rows, lop = '') {
  const d = demCot(rows); const dangMo = hangMo === khoaHangCua(loc);
  return `<tr class="bc-hang${lop ? ` ${lop}` : ''}${dangMo ? ' dang' : ''}" data-action="bcMoRong" ${locAttr(loc)} aria-expanded="${String(dangMo)}"><td class="tieude">${escapeHtml(ten)}${phu ? `<small>${phu}</small>` : ''}</td>
    ${COT().map(([k]) => `<td class="so">${nut(d[k], { ...loc, cot: k }, LOP[k] || '')}</td>`).join('')}</tr>${dangMo ? hangMoRongHtml(JSON.parse(hangMoLoc)) : ''}`;
}
const bang = (tieuDe, than) => `<table>${DAU_BANG(tieuDe)}<tbody>${than}</tbody></table>`;
const bangPhong = (rows) => bang('Phòng chuyên môn', theoPhongChuyenMon(rows, ctx()).map((p) => dong(p.ten, '', { b: 'p', phong: p.ma }, p.rows)).join(''));
const bangChuyenVien = (rows) => bang('Phòng chuyên môn / chuyên viên thực hiện', theoChuyenVien(rows, ctx()).map((p) => dong(p.ten, `${p.canBo.filter((c) => c.ma).length} cán bộ`, { b: 'cv', phong: p.ma }, p.rows, 'bc-phong')
  + p.canBo.map((c) => dong(c.ten, '', { b: 'cv', phong: p.ma, canBo: c.ma }, c.rows, 'bc-con')).join('')).join(''));
const bangNguon = (rows) => bang('Nguồn nhiệm vụ', theoNguon(rows, danhMucKl().nguonNhiemVu || []).map((n) => dong(n.ten, '', { b: 'n', nguon: n.ma }, n.rows)).join(''));
const bangVanBan = (rows) => bang('Kết luận / văn bản', theoVanBanBc(rows).map((v) => dong(v.ten, `ban hành ${formatNgay(v.ngay)}`, { b: 'vb', ketLuan: v.ma }, v.rows)).join(''));
// PR-3: việc ĐANG MỞ có vướng mắc hoặc đã xác định cấp cần quyết định.
function bangCanQuyet(rows) {
  const ds = sapXep(rows.filter((r) => r.tien_do_ma !== 'HOAN_THANH' && (r.vuong_mac || r.cap_quyet_dinh)));
  if (!ds.length) return '<p class="trong-nho">Không có việc nào cần lãnh đạo quyết định.</p>';
  return `<table><thead><tr><th>Mã nhiệm vụ</th><th>Nội dung kết luận / Văn bản trình</th><th>Chủ trì theo dõi</th><th>Cấp cần quyết</th><th>Vướng mắc / đề nghị</th><th>Hạn xử lý</th><th></th></tr></thead><tbody>${ds.map((r) => `<tr data-id="${r.id}">
    <td><b>${escapeHtml(r.ma)}</b></td><td>${escapeHtml(r.noi_dung)}</td><td>${escapeHtml(r.owner_tai_khoan_ten || boSoThuTu(r.owner_don_vi_ten) || '')}</td>
    <td>${escapeHtml(r.cap_quyet_dinh_ten || '—')}</td><td data-truong="vuong-mac">${escapeHtml(r.vuong_mac || '—')}</td><td>${r.han_xu_ly ? formatNgay(r.han_xu_ly) : 'chưa có'}</td>
    <td><button type="button" class="nut nho" data-action="nganMoViec" data-id="${r.id}">Xem</button></td></tr>`).join('')}</tbody></table>`;
}

// Tỉ lệ đúng hạn (Q9; 0077: tính theo hạn xử lý) kèm mẫu số: việc đã đóng CÓ đánh giá trên tổng việc đã đóng.
function tyLe(rows) {
  const dongs = rows.filter((r) => r.tien_do_ma === 'HOAN_THANH'); const dg = dongs.filter((r) => ['DUNG_HAN', 'TRE'].includes(r.nop_dung_han));
  const dung = dg.filter((r) => r.nop_dung_han === 'DUNG_HAN').length;
  return `<span class="o-so s-luc" title="Nộp minh chứng trước hạn xử lý: ${dung} trên ${dg.length} nhiệm vụ được đánh giá (${dongs.length} nhiệm vụ đã hoàn thành)"><b>${dg.length ? Math.round((dung / dg.length) * 100) : 0}%</b> nộp minh chứng đúng hạn (${dung}/${dg.length})</span>`;
}
const khoi = (id, tieuDe, phu, than) => `<div class="bang" id="${id}"><div class="bang-dau"><h2>${tieuDe}</h2>${phu ? `<span class="chu-phu">${phu}</span>` : ''}</div><div class="bang-cuon">${than}</div></div>`;

// Thanh chọn kỳ: nút nhanh (sáng khi không điền ngày) + từ ngày / đến ngày (như màn Thống kê sử dụng).
function kyHtml() {
  const h = homNayVN(); const tuy = Boolean(kyBc.tu || kyBc.den);
  const nutKy = KY_NUT.map((ky) => `<button type="button" data-action="bcKy" data-ky="${ky}" aria-pressed="${String(!tuy && kyBc.ky === ky)}">${escapeHtml(khoangKy(ky, h).ten)}</button>`).join('');
  const oNgay = (k, nhan) => `<label>${nhan} <input type="date" id="bc${k === 'tu' ? 'Tu' : 'Den'}" class="o-nhap nho" data-bc-ngay="${k}" min="2000-01-01" max="2100-12-31" value="${escapeHtml(kyBc[k])}"></label>`;
  const phamVi = '<div class="pham-vi hidden" id="bcToanBo" role="group" aria-label="Phạm vi số liệu"><button type="button" data-action="bcToanBo" data-tb="1">Toàn Văn phòng</button>'
    + '<button type="button" data-action="bcToanBo" data-tb="0">Phạm vi của tôi</button></div>';   // v3.33: ẩn khi không có việc ngoài phạm vi
  return `<div class="bc-ky" id="bcKy">${phamVi}<div class="pham-vi" role="group" aria-label="Kỳ báo cáo">${nutKy}</div>${oNgay('tu', 'Từ ngày')}${oNgay('den', 'Đến ngày')}</div>`;
}

// Khung (tiêu đề, nút, thanh kỳ) dựng một lần, không bao giờ dựng lại; đổi kỳ, nạp lại (Tải lại, mở lại màn, ghi trong ngăn, realtime) chỉ thay dòng
// phụ đề, nhãn và nút đang chọn, phần số liệu — ô ngày đang gõ không bị thay (Chromium báo "change" ngay sau mỗi phím cho ra ngày hợp lệ: thay ô
// giữa chừng thì mất tiêu điểm, phím sau rơi sai chỗ).
function veKhung() {
  $('viewBaoCao').innerHTML = `
    <div class="dau"><h1>Báo cáo</h1><span id="bcKyMoTa"></span>
      <div class="phai-dau"><button type="button" class="nut nho" data-action="openBaoCao">Tải lại</button><button type="button" class="nut nho" id="bcXuatExcel" data-action="bcXuatExcel">Xuất Excel</button><button type="button" class="nut nho lam" data-action="inBaoCao">In / PDF</button></div></div>
    ${kyHtml()}<div id="bcThan"></div>`;
}
function dongBoKy() {
  const tuy = Boolean(kyBc.tu || kyBc.den); const h = homNayVN();
  $('bcKy').querySelectorAll('[data-action="bcKy"]').forEach((b) => { b.textContent = khoangKy(b.dataset.ky, h).ten; b.setAttribute('aria-pressed', String(!tuy && kyBc.ky === b.dataset.ky)); });
  $('bcKy').querySelectorAll('[data-bc-ngay]').forEach((o) => { const v = kyBc[o.dataset.bcNgay]; if (o !== document.activeElement && o.value !== v) o.value = v; });
  show('bcToanBo', coNutToanBo());
  $('bcToanBo').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.tb === '1') === toanVP())));
}
function ve() {
  if (!$('bcKy')) veKhung();
  rowsHienTai = toanVP() ? tatCa : trong;
  const k = kyHienTai(); rowsKy = locTheoKy(rowsHienTai, k);
  const d = demCot(rowsKy); const n = nguongCanhBao();
  const o = (so, nhan, lop) => `<span class="o-so ${lop}"><b>${so}</b> ${nhan}</span>`;
  $('bcKyMoTa').textContent = `${ngayDaiVN()} · ${moTaKy(k)} · ${PHAM_VI()} · ${d.tong} nhiệm vụ của kỳ`;
  $('viewBaoCao').dataset.phamVi = toanVP() ? 'toan' : 'toi';   // e2e: phạm vi đang vẽ
  dongBoKy();
  $('bcThan').innerHTML = `
    <div class="tq" role="group" aria-label="Tổng quan">${o(d.tong, 'nhiệm vụ của kỳ', '')}${o(d.qua, 'quá hạn', 's-do')}${o(d.sap, `sắp đến hạn (còn ≤ ${n.vang} ngày)`, 's-vang')}
      ${o(d.dang, 'đang thực hiện', 's-lam')}${o(d.xong, `hoàn thành · ${d.tong ? Math.round((d.xong / d.tong) * 100) : 0}%`, 's-luc')}${o(d.truoc, 'trước hạn', 's-luc')}${tyLe(rowsKy)}</div>
    <div>
      ${khoi('bcCanQuyet', 'Việc cần lãnh đạo quyết định', 'việc đang mở có vướng mắc hoặc đã xác định cấp cần quyết định', bangCanQuyet(rowsHienTai))}
      ${khoi('bcTheoPhong', 'Theo phòng chuyên môn', 'phòng của cán bộ chủ trì theo dõi · bấm một số hoặc một dòng để xem việc ngay dưới', bangPhong(rowsKy))}
      ${khoi('bcTheoChuyenVien', 'Theo chuyên viên thực hiện', 'mỗi phòng chuyên môn, từng cán bộ chủ trì theo dõi', bangChuyenVien(rowsKy))}
      ${khoi('bcTheoNguon', 'Theo nguồn nhiệm vụ', '', bangNguon(rowsKy))}
      ${khoi('bcTheoVanBan', 'Theo kết luận, văn bản giao việc', '', bangVanBan(rowsKy))}</div>`;
}
// Đổi kỳ: nút nhanh xoá hai ô ngày; điền một ô ngày thì tính theo khoảng (trống một đầu: từ đầu dữ liệu / đến hôm nay). Gập hàng đang mở rộng.
const bcKy = ({ ky }) => { if (!KY_NUT.includes(ky)) return; kyBc = { ky, tu: '', den: '' }; hangMo = null; ve(); };
const doiBcToanBo = ({ tb }) => { bcToanBo = tb === '1'; hangMo = null; ve(); };   // v3.33: Toàn Văn phòng / Phạm vi của tôi
const oNgayCua = (e) => e.target.closest?.('#viewBaoCao [data-bc-ngay]');
function khiDoiNgay(e) {
  const o = oNgayCua(e);
  if (!o) return;
  if (o.value && !/^2\d{3}-\d{2}-\d{2}$/.test(o.value)) return;   // đang gõ năm (0002, 0020…): chờ gõ đủ năm; dữ liệu không có trước năm 2000 (ô min)
  kyBc = { ...kyBc, [o.dataset.bcNgay]: o.value || '' }; hangMo = null; ve();
}
// Rời ô ngày còn năm gõ dở (không được tính) → trả ô về ngày đang tính, khỏi hiểu nhầm báo cáo theo ngày trên ô.
function khiRoiNgay(e) { const o = oNgayCua(e); if (o && o.value !== kyBc[o.dataset.bcNgay]) o.value = kyBc[o.dataset.bcNgay]; }

async function napBaoCao() {
  try { await Promise.all([loadDanhMucKl(), loadCauHinhKl()]); ({ rows: trong, tatCa } = await loadKlRows()); } catch (e) { notifyError(e.message); return; }
  ve();
}
async function openBaoCao() {
  showSection('viewBaoCao');
  setActiveNav('navBaoCao');
  hangMo = null;
  datNapLai(napBaoCao);
  await napBaoCao();
}
// Bấm số / dòng: mở rộng hàng của dòng đó với bộ lọc của ô (khoá hàng = phòng / cán bộ / nguồn / kết luận); bấm lại cùng ô → gập.
function bcMoRong({ loc }) {
  let bo; try { bo = JSON.parse(loc || '{}'); } catch { bo = {}; }
  const khoaHang = khoaHangCua(bo);
  if (hangMo === khoaHang && hangMoLoc === JSON.stringify(bo)) { hangMo = null; } else { hangMo = khoaHang; hangMoLoc = JSON.stringify(bo); }
  ve();
  $('bcMoRong')?.scrollIntoView({ block: 'nearest' });
}
// Xuất Excel: theo phòng chuyên môn, theo chuyên viên, theo nguồn (cùng cột số với màn) + danh sách quá hạn (cột tường minh của màn Nhiệm vụ).
async function bcXuatExcel() {
  try {
    const { xuatBaoCao } = await import('../../lib/kl/xuat.js');
    const tenCot = COT().map(([, t]) => t); const so = (rows) => { const d = demCot(rows); return COT().map(([k]) => d[k]); };
    const bangX = (ten, ds) => ({ cot: [ten, ...tenCot], dong: ds.map((x) => [x.ten, ...so(x.rows)]) });
    const cv = theoChuyenVien(rowsKy, ctx()).flatMap((p) => [[p.ten, 'Cả phòng', ...so(p.rows)], ...p.canBo.map((c) => [p.ten, c.ten, ...so(c.rows)])]);
    const rowsQua = sapXep(locBaoCao(rowsKy, { cot: 'qua' })); const k = kyHienTai(); const tuTrong = Boolean(kyBc.den) && !kyBc.tu;   // chỉ điền "Đến ngày"
    const ten = xuatBaoCao({ ky: { ten: moTaKy(k), tu: tuTrong ? '' : k.tu, den: k.den }, phamVi: toanVP() ? 'Toàn Văn phòng Tỉnh ủy' : 'Phạm vi phụ trách của người xuất', nguoi: `${state.user?.full_name || ''} (${state.user?.username || ''})`,
      theoPhong: bangX('Phòng chuyên môn', theoPhongChuyenMon(rowsKy, ctx())), theoChuyenVien: { cot: ['Phòng chuyên môn', 'Chuyên viên thực hiện', ...tenCot], dong: cv },
      theoNguon: bangX('Nguồn nhiệm vụ', theoNguon(rowsKy, danhMucKl().nguonNhiemVu || [])), rowsQuaHan: rowsQua });
    notifySuccess(`Đã xuất báo cáo ra tệp ${ten}.`);
  } catch (e) { notifyError('Không xuất được Excel: ' + e.message); }
}

export function registerBaoCao() {
  registerActions({ openBaoCao, inBaoCao: () => window.print(), bcMoRong, bcXuatExcel, bcKy, bcToanBo: doiBcToanBo });
  document.addEventListener('change', khiDoiNgay); document.addEventListener('focusout', khiRoiNgay);
  datNguonDong((id) => tatCa.find((r) => r.id === id));   // mọi việc đọc được — việc ngoài phạm vi mở ngăn chỉ xem
  khiGhiTrongNgan('viewBaoCao', napBaoCao);
}
