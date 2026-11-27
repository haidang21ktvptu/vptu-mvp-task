// Cán bộ thuộc quyền (A1) / Cán bộ trong phòng (A2) / Cán bộ (A0, toàn Văn phòng: nhóm Lãnh đạo Văn phòng đứng đầu rồi từng phòng) —
// mockup: bức tranh tải việc theo phòng rồi theo người, mỗi người một thanh Đỏ/Vàng/Đang làm (việc đang mở người đó là Owner tài khoản;
// việc theo dõi ghi riêng, CH-2). Bấm một người → ngăn bên phải ngay trong trang (tải việc, việc mở, Giao lại / Nhắc), không rời mục; "Xem chi
// tiết" một việc → ngăn chi tiết dùng chung (v9 đợt 2) mở chồng lên trang; ghi xong trong ngăn → trang tự nạp lại, giữ người đang mở.
// v3.33 (chủ dự án 27/10/2026 — CAU-HOI S-3): cấu hình xem toàn bộ (0103) bật, người xem có việc ngoài phạm vi → mặc định TOÀN VĂN PHÒNG (Lãnh đạo
// Văn phòng rồi mọi phòng, như màn của Thường trực; tải việc trên tatCa), nút "Phạm vi của tôi"; Giao lại / Nhắc chỉ ở việc trong phạm vi (ngan-viec.js).
import { $, escapeHtml } from '../../lib/dom.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifyError } from '../../components/toast.js';
import { nutGoi, thuocGoi } from '../../components/goi.js';
import { veSauNap } from '../../lib/chuyen-dong.js';
import { loadDanhMucKl, loadCauHinhKl, loadKlRows, xemToanBo } from '../../lib/kl/du-lieu.js';
import { calculateGroupKPI, laOwnerPhong } from './kpi.js';
import { CHAT_LUONG, tenMuc } from '../../lib/kl/nhan.js';
import { setActiveNav, showSection } from '../shell/index.js';
import { datNapLai } from './dieu-hanh/hanh-dong.js';
import { nganNguoiHtml, moNgan, dongNgan } from './ngan-viec.js';
import { datNguonDong, khiGhiTrongNgan } from './ngan-chi-tiet.js';

const DO = (r) => r.muc_canh_bao === 'DO' || r.muc_canh_bao === 'DO_DAC_BIET';
const VANG = (r) => r.muc_canh_bao === 'VANG';
const mo = (r) => r.tien_do_ma !== 'HOAN_THANH';
const TIEU_DE = { A0: 'Cán bộ', A2: 'Cán bộ trong phòng' };
let rowsHienTai = []; let nguoiDangMo = null;
let trong = []; let tatCa = []; let cbToanBo = true;   // v3.33: việc trong phạm vi / mọi việc đọc được; đang chọn Toàn Văn phòng (giữ trong phiên)
const coNutToanBo = () => xemToanBo() && tatCa.length > trong.length;
const toanVP = () => coNutToanBo() && cbToanBo;

// PR-2b (Mới 2): Đỏ = việc người này CHỊU CHẬM (nguoi_chiu_cham, DB tính — kể cả việc của phòng khác chờ họ nghiệm thu); việc họ chủ trì đã nộp,
// quá hạn ở bước nghiệm thu tính "đang làm" (trung tính). moiDong: mọi dòng đang xem (không chỉ của phòng) để thấy việc chờ nghiệm thu.
function nguoiHtml(a, rows, moiDong = rows) {
  const owner = rows.filter((r) => r.owner_tai_khoan === a.id && mo(r));
  // v3.31 (0128): việc giao cho phòng / Văn phòng mà người này là người đại diện chủ trì (Trưởng phòng / Chánh VP — nguoi_theo_doi nội bộ).
  const theoDoi = rows.filter((r) => r.nguoi_theo_doi === a.id && !r.owner_tai_khoan && mo(r)).length; const donVi = a.role_group === 'A1' ? 'Văn phòng' : 'phòng';
  const doRows = moiDong.filter((r) => r.nguoi_chiu_cham === a.id && DO(r) && mo(r));
  const dem = { do: doRows.length, vang: owner.filter((r) => VANG(r) && !doRows.includes(r)).length };
  const lam = owner.filter((r) => !doRows.includes(r) && !VANG(r)).length;
  const tong = dem.do + dem.vang + lam;
  const pct = (n) => (tong ? (n / tong) * 100 : 0);
  const xong = rows.filter((r) => r.owner_tai_khoan === a.id && !mo(r));   // PR-3: việc đã hoàn thành theo chất lượng nghiệm thu
  const clChu = CHAT_LUONG.map(([m, ten]) => [xong.filter((r) => r.chat_luong === m).length, ten]).filter(([n]) => n).map(([n, ten]) => `${n} ${ten}`).join(', ');
  const soChu = tong === 0 ? (theoDoi ? `${theoDoi} việc giao cho ${donVi}` : 'rảnh, có thể nhận thêm')
    : [dem.do ? `<b>${dem.do}</b> quá hạn` : '', dem.vang ? `${dem.vang} sắp đến hạn` : '', lam ? `${lam} đang làm` : ''].filter(Boolean).join(', ');
  const phu = `${a.position_title || ''}${theoDoi ? ` · ${theoDoi} việc giao cho ${donVi}` : ''}${clChu ? ` · hoàn thành: ${clChu}` : ''}`;
  return `<button type="button" class="nguoi-hang${nguoiDangMo === a.id ? ' dang' : ''}" data-action="moNganNguoi" data-id="${a.id}" aria-pressed="${String(nguoiDangMo === a.id)}" title="${escapeHtml(`${a.full_name}${phu ? ` — ${phu}` : ''}`)}">
      <div class="nguoi-ten"><b>${escapeHtml(a.full_name)}</b><small>${escapeHtml(a.position_title || '')}${theoDoi ? ` · ${theoDoi} việc giao cho ${donVi}` : ''}${clChu ? ` · <span data-truong="kpi-chat-luong">hoàn thành: ${clChu}</span>` : ''}</small></div>
      <div class="tai"><span class="t-do" style="width:${pct(dem.do)}%"></span><span class="t-vang" style="width:${pct(dem.vang)}%"></span><span class="t-lam" style="width:${pct(lam)}%"></span></div>
      <span class="tai-so">${soChu}</span></button>`;
}

// v3.36 (CAU-HOI V-13 — số trước, chi tiết bấm mới mở): dòng số của phòng ghi ngắn, cách tính ở gợi ý (và chữ ẩn cho trình đọc màn hình); ghi chú
// của màn ở nút "i" cạnh tên màn. Dòng của từng người: tên và chức danh bên trái, thanh tải và dòng số bên phải (can-bo-bao-cao.css); dòng số ghi
// "n sắp đến hạn" — số ngày của mức ở ghi chú của màn; chức danh dài cắt sau hai dòng, đủ chữ ở title của dòng.
const GOI_PHONG = 'Việc đang mở: việc cán bộ trong phòng hoặc chính phòng chủ trì theo dõi. Quá hạn: việc quá hạn mà phòng chịu chậm, gồm cả việc quá hạn ở bước nghiệm thu chờ lãnh đạo phòng, '
  + 'không gồm việc phòng đã nộp chờ cấp trên nghiệm thu; vì vậy có thể khác số việc đang mở.';
const ghiChuMan = () => `Tải việc theo người: quá hạn, ${tenMuc('vang')}, đang làm; chỉ tính việc đang mở mà cán bộ là chủ trì theo dõi. Bấm một người để xem việc ngay trong trang.`;   // số ngày theo cấu hình: đọc lúc vẽ
export function phongHtml(ma, rows) {   // dựng HTML thuần (đọc state.accounts), không chạm DOM
  const canBo = state.accounts.filter((a) => a.department === ma && !a.is_system)
    .sort((a, b) => a.role_group.localeCompare(b.role_group) || (b.is_chief ? 1 : 0) - (a.is_chief ? 1 : 0) || a.full_name.localeCompare(b.full_name, 'vi'));
  const cuaPhong = rows.filter((r) => laOwnerPhong(r, ma) || canBo.some((a) => a.id === r.owner_tai_khoan));
  const k = calculateGroupKPI(canBo.map((a) => a.id), rows, ma);
  const phongOwner = rows.filter((r) => laOwnerPhong(r, ma) && mo(r)).length;
  return `<section id="cb-${escapeHtml(ma)}"><div class="tieu"><b>${escapeHtml(DEPT_NAMES[ma] || ma)}</b><span${thuocGoi(GOI_PHONG)}>${canBo.length} cán bộ, ${k.dangMo} việc đang mở, ${k.quaHan} quá hạn${phongOwner ? `, ${phongOwner} việc giao cho phòng` : ''}<span class="sr">. ${GOI_PHONG}</span></span></div>
    ${canBo.map((a) => nguoiHtml(a, cuaPhong, rows)).join('') || '<p class="trong-nho">Phòng chưa có cán bộ trong danh bạ.</p>'}</section>`;
}

// Phòng hiện: A2 phòng mình; A0 / Toàn Văn phòng (v3.33) mọi phòng (Lãnh đạo Văn phòng đứng đầu); A1 phòng có việc trong phạm vi hoặc có cán bộ dưới quyền.
function danhSachPhong(me, rows, toan = false) {
  const tatCaPhong = me.role_group === 'A0' || toan;
  if (me.role_group === 'A2' && !toan) return [me.department];
  const cuaTaiKhoan = state.accounts.filter((a) => !a.is_system && a.department && (tatCaPhong || a.manager_id === me.id || me.is_chief)).map((a) => a.department);
  const ds = [...new Set([...rows.map((r) => r.owner_phong).filter(Boolean), ...cuaTaiKhoan])].filter((p) => p !== 'LANH_DAO_VAN_PHONG');
  return tatCaPhong ? ['LANH_DAO_VAN_PHONG', ...ds] : ds;
}
const nutPhamVi = () => (coNutToanBo() ? `<div class="pham-vi" id="cbToanBo" role="group" aria-label="Phạm vi số liệu">${[['1', 'Toàn Văn phòng'], ['0', 'Phạm vi của tôi']]
  .map(([tb, ten]) => `<button type="button" data-action="cbToanBo" data-tb="${tb}" aria-pressed="${String((tb === '1') === toanVP())}">${ten}</button>`).join('')}</div>` : '');

function ve() {
  const me = state.user; const toan = toanVP(); rowsHienTai = toan ? tatCa : trong;
  const ca = toan || (xemToanBo() && !coNutToanBo());   // xem toàn bộ, không có việc ngoài phạm vi (Chánh VP): vẫn mọi phòng, tên "Cán bộ" như menu
  const phong = danhSachPhong(me, rowsHienTai, ca);
  $('viewCanBo').dataset.phamVi = toan ? 'toan' : 'toi';   // e2e: phạm vi đang vẽ
  $('viewCanBo').innerHTML = `
    <div class="dau"><h1>${ca ? 'Cán bộ' : TIEU_DE[me.role_group] || 'Cán bộ thuộc quyền'}</h1><span>${toan ? 'toàn Văn phòng Tỉnh ủy' : ''}</span><span>${nutGoi(`${toan ? 'Việc ngoài phạm vi xử lý của đồng chí chỉ xem. ' : ''}${ghiChuMan()}`)}</span>
      <div class="phai-dau">${nutPhamVi()}<button type="button" class="nut nho" data-action="openCanBo">Tải lại</button></div></div>
    <div class="hai-ngan${nguoiDangMo ? ' mo' : ''}"><div class="cb">${phong.length ? phong.map((p) => phongHtml(p, rowsHienTai)).join('') : '<p class="trong">Không có phòng nào trong phạm vi của đồng chí.</p>'}</div>
      <aside class="ngan-ben${nguoiDangMo ? '' : ' hidden'}" id="cbNgan" aria-label="Chi tiết cán bộ đang chọn"></aside></div>`;
  if (nguoiDangMo) moNganNguoi({ id: nguoiDangMo });
}

async function napCanBo() {
  const daCo = Boolean($('viewCanBo').childElementCount);   // v3.36 (V-12): vào lại mục — vẽ lại sau khi hiệu ứng vào mục chạy xong
  try { await Promise.all([loadDanhMucKl(), loadCauHinhKl()]); ({ rows: trong, tatCa } = await loadKlRows()); } catch (e) { notifyError('Không đọc được nhiệm vụ: ' + e.message); return; }
  veSauNap($('viewCanBo'), daCo, ve, (e) => notifyError('Không hiển thị được danh sách cán bộ: ' + e.message));
}
async function openCanBo() {
  showSection('viewCanBo');
  setActiveNav('navCanBo');
  nguoiDangMo = null;
  datNapLai(napCanBo);
  await napCanBo();
}
function moNganNguoi({ id }) {
  const a = state.accounts.find((x) => x.id === id); if (!a) return;
  nguoiDangMo = id;
  document.querySelectorAll('#viewCanBo .nguoi-hang').forEach((el) => { const on = el.dataset.id === id; el.classList.toggle('dang', on); el.setAttribute('aria-pressed', String(on)); });
  moNgan('cbNgan', nganNguoiHtml(a, rowsHienTai));
}
function dongNganCanBo() {
  nguoiDangMo = null;
  document.querySelectorAll('#viewCanBo .nguoi-hang.dang').forEach((el) => { el.classList.remove('dang'); el.setAttribute('aria-pressed', 'false'); });
  dongNgan('cbNgan');
}

export function registerCanBo() {
  registerActions({ openCanBo, moNganNguoi, dongNganCanBo, cbToanBo: ({ tb }) => { cbToanBo = tb === '1'; nguoiDangMo = null; ve(); } });
  datNguonDong((id) => tatCa.find((r) => r.id === id));   // mọi việc đọc được — việc ngoài phạm vi mở ngăn chỉ xem
  khiGhiTrongNgan('viewCanBo', napCanBo);
}
