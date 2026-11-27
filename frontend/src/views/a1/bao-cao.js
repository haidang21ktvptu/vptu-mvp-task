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
// v3.36 (CAU-HOI V-13 — số trước, chi tiết bấm mới mở): phần dựng HTML tách sang bao-cao-khoi.js; phụ đề chỉ ghi kỳ và phạm vi (ngày lập chỉ ở bản in,
// ghi chú "chỉ xem" ở nút "i"); "Việc cần lãnh đạo quyết định" hiện 5 dòng đầu, "Theo kết luận, văn bản giao việc" hiện 10 dòng đầu, "Xem tất cả" nhớ theo máy.
import { $, escapeHtml, show } from '../../lib/dom.js';
import { registerActions } from '../../lib/actions.js';
import { state } from '../../lib/state.js';
import { notifyError, notifySuccess } from '../../components/toast.js';
import { nutGoi } from '../../components/goi.js';
import { apDanhSach, dangKyDanhSach } from '../../components/ds-gon.js';
import { moCuaVao, veSauNap } from '../../lib/chuyen-dong.js';
import { loadDanhMucKl, loadCauHinhKl, loadKlRows, danhMucKl, xemToanBo } from '../../lib/kl/du-lieu.js';
import { sapXep } from '../../lib/kl/tong-hop.js';
import { formatNgay, homNayVN } from '../../lib/kl/ngay.js';
import { demCot, locBaoCao, locTheoKy, theoPhongChuyenMon, theoChuyenVien, theoNguon } from '../../lib/kl/bao-cao.js';
import { khoangKy, khoangTuyChon } from '../../lib/kl/tong-quan.js';
import { setActiveNav, showSection } from '../shell/index.js';
import { ngayDaiVN } from '../shared/dieu-hanh/man-hinh.js';
import { datNapLai } from '../shared/dieu-hanh/hanh-dong.js';
import { datNguonDong, khiGhiTrongNgan } from '../shared/ngan-chi-tiet.js';
import { COT, ctx, khoaHangCua, thanBaoCaoHtml, SO_CAN_QUYET_DAU, SO_VAN_BAN_DAU } from './bao-cao-khoi.js';

let rowsHienTai = []; let rowsKy = []; let hangMo = null; let hangMoLoc = '{}'; // mọi việc của phạm vi đang xem; việc của kỳ đang xem; hàng đang mở rộng
let trong = []; let tatCa = []; let bcToanBo = true;   // v3.33: việc trong phạm vi xử lý / mọi việc đọc được; đang chọn Toàn Văn phòng (giữ trong phiên)
const coNutToanBo = () => xemToanBo() && tatCa.length > trong.length;   // như Tổng quan: chỉ khi có việc ngoài phạm vi (Chánh VP vốn thấy hết)
const toanVP = () => coNutToanBo() && bcToanBo;
const PHAM_VI = () => (toanVP() ? 'toàn Văn phòng Tỉnh ủy' : 'phạm vi phụ trách của đồng chí');
const GHI_CHU_TOAN = 'Việc ngoài phạm vi xử lý của đồng chí chỉ xem.';   // v3.36 (V-13): ở nút "i" cạnh phụ đề, chỉ khi đang xem Toàn Văn phòng
let kyBc = { ky: 'nam', tu: '', den: '' };   // kỳ đang xem (giữ trong phiên): nút nhanh, hoặc từ ngày / đến ngày (điền thì thay nút nhanh)
const KY_NUT = ['thang', 'quy', 'nam', 'nhiem-ky'];
const kyHienTai = () => (kyBc.tu || kyBc.den ? khoangTuyChon(kyBc.tu, kyBc.den, homNayVN()) : khoangKy(kyBc.ky, homNayVN()));
const moTaKy = (k) => (k.ky === 'tuy-chon' ? k.trong.charAt(0).toUpperCase() + k.trong.slice(1) : `${k.ten} (${formatNgay(k.tu)} – ${formatNgay(k.den)})`);

// Thanh chọn kỳ: nút nhanh (sáng khi không điền ngày) + từ ngày / đến ngày (như màn Thống kê sử dụng).
function kyHtml() {
  const h = homNayVN(); const tuy = Boolean(kyBc.tu || kyBc.den);
  const nutKy = KY_NUT.map((ky) => `<button type="button" data-action="bcKy" data-ky="${ky}" aria-pressed="${String(!tuy && kyBc.ky === ky)}">${escapeHtml(khoangKy(ky, h).ten)}</button>`).join('');
  const oNgay = (k, nhan) => `<label>${nhan} <input type="date" id="bc${k === 'tu' ? 'Tu' : 'Den'}" class="o-nhap nho" data-bc-ngay="${k}" min="2000-01-01" max="2100-12-31" value="${escapeHtml(kyBc[k])}"></label>`;
  const phamVi = '<div class="pham-vi hidden" id="bcToanBo" role="group" aria-label="Phạm vi số liệu"><button type="button" data-action="bcToanBo" data-tb="1">Toàn Văn phòng</button>'
    + '<button type="button" data-action="bcToanBo" data-tb="0">Phạm vi của tôi</button></div>';   // v3.33: ẩn khi không có việc ngoài phạm vi
  // Nhóm phạm vi đứng ngoài #bcKy (khối kỳ — nút kỳ, ô ngày) nhưng cùng một hàng: #bcKy display: contents (can-bo-bao-cao.css).
  return `<div class="bc-ky">${phamVi}<div class="bc-ky-trong" id="bcKy"><div class="pham-vi" role="group" aria-label="Kỳ báo cáo">${nutKy}</div>${oNgay('tu', 'Từ ngày')}${oNgay('den', 'Đến ngày')}</div></div>`;
}

// Khung (tiêu đề, nút, thanh kỳ) dựng một lần, không bao giờ dựng lại; đổi kỳ, nạp lại (Tải lại, mở lại màn, ghi trong ngăn, realtime) chỉ thay dòng
// phụ đề, nhãn và nút đang chọn, phần số liệu — ô ngày đang gõ không bị thay (Chromium báo "change" ngay sau mỗi phím cho ra ngày hợp lệ: thay ô
// giữa chừng thì mất tiêu điểm, phím sau rơi sai chỗ).
function veKhung() {
  $('viewBaoCao').innerHTML = `
    <div class="dau"><h1>Báo cáo</h1><span id="bcKyMoTa"></span><span id="bcGhiChu"></span>
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
  // Phụ đề: kỳ và phạm vi. Ngày lập chỉ ở bản in (thanh chọn kỳ không in — in.css); số nhiệm vụ của kỳ đã ở ô đầu của dải số.
  $('bcKyMoTa').innerHTML = `<span class="chi-in-dong">${escapeHtml(ngayDaiVN())} · </span>${escapeHtml(`${moTaKy(k)} · ${PHAM_VI()}`)}`;
  const ghiChu = toanVP() ? GHI_CHU_TOAN : ''; const oGhiChu = $('bcGhiChu');
  if (oGhiChu.dataset.chu !== ghiChu) { oGhiChu.dataset.chu = ghiChu; oGhiChu.innerHTML = nutGoi(ghiChu); }   // chỉ thay khi đổi: nút đang có tiêu điểm không bị dựng lại
  $('viewBaoCao').dataset.phamVi = toanVP() ? 'toan' : 'toi';   // e2e: phạm vi đang vẽ
  dongBoKy();
  $('bcThan').innerHTML = thanBaoCaoHtml({ rows: rowsHienTai, rowsKy, hangMo, hangMoLoc });
  apDanhSach('bcCanQuyet'); apDanhSach('bcVanBan');   // hai danh sách dài: chỉ các dòng đầu (bản in đủ dòng)
}
// Đổi kỳ: nút nhanh xoá hai ô ngày; điền một ô ngày thì tính theo khoảng (trống một đầu: từ đầu dữ liệu / đến hôm nay). Gập hàng đang mở rộng.
const veDoi = () => { moCuaVao($('viewBaoCao'), { lop: 'dang-doi', ms: 1100 }); ve(); };   // đổi kỳ / phạm vi theo thao tác của người dùng: số lăn lại
const bcKy = ({ ky }) => { if (!KY_NUT.includes(ky)) return; kyBc = { ky, tu: '', den: '' }; hangMo = null; veDoi(); };
const doiBcToanBo = ({ tb }) => { bcToanBo = tb === '1'; hangMo = null; veDoi(); };   // v3.33: Toàn Văn phòng / Phạm vi của tôi
const oNgayCua = (e) => e.target.closest?.('#viewBaoCao [data-bc-ngay]');
function khiDoiNgay(e) {
  const o = oNgayCua(e);
  if (!o) return;
  if (o.value && !/^2\d{3}-\d{2}-\d{2}$/.test(o.value)) return;   // đang gõ năm (0002, 0020…): chờ gõ đủ năm; dữ liệu không có trước năm 2000 (ô min)
  kyBc = { ...kyBc, [o.dataset.bcNgay]: o.value || '' }; hangMo = null; veDoi();
}
// Rời ô ngày còn năm gõ dở (không được tính) → trả ô về ngày đang tính, khỏi hiểu nhầm báo cáo theo ngày trên ô.
function khiRoiNgay(e) { const o = oNgayCua(e); if (o && o.value !== kyBc[o.dataset.bcNgay]) o.value = kyBc[o.dataset.bcNgay]; }

async function napBaoCao() {
  const daCo = Boolean($('bcThan')?.childElementCount);   // v3.36 (V-12): vào lại mục — số liệu lượt trước đang hiện, vẽ lại sau khi hiệu ứng vào mục chạy xong
  try { await Promise.all([loadDanhMucKl(), loadCauHinhKl()]); ({ rows: trong, tatCa } = await loadKlRows()); } catch (e) { notifyError(e.message); return; }
  veSauNap($('viewBaoCao'), daCo, ve, (e) => notifyError('Không hiển thị được báo cáo: ' + e.message));
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
  dangKyDanhSach('bcCanQuyet', { vung: () => $('bcCanQuyet'), chon: 'tbody > tr', so: SO_CAN_QUYET_DAU });
  dangKyDanhSach('bcVanBan', { vung: () => $('bcTheoVanBan'), chon: 'tbody > tr.bc-hang', so: SO_VAN_BAN_DAU, donVi: 'văn bản', giu: '.dang' });   // hàng đang mở rộng không bị ẩn
}
