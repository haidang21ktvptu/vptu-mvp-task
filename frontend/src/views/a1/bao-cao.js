// Báo cáo (A1, mockup): cùng dải tổng quan của mục Nhiệm vụ, xếp theo phòng/đơn vị Owner và theo kết luận (văn bản), nút In/PDF
// (window.print — in.css giữ dải và bảng, bỏ nút). Số liệu đếm client trên dòng RLS trả về (DB-5). Bấm một số / một dòng → danh sách việc
// mở rộng ngay dưới dòng; "Xem chi tiết" → ngăn bên phải (Giao lại / Nhắc tại chỗ). KHÔNG chuyển sang mục Nhiệm vụ.
import { $, escapeHtml } from '../../lib/dom.js';
import { registerActions } from '../../lib/actions.js';
import { notifyError } from '../../components/toast.js';
import { loadDanhMucKl, loadCauHinhKl, loadKlRows } from '../../lib/kl/du-lieu.js';
import { tongHop, demTheoNhom, locRows, sapXep } from '../../lib/kl/tong-hop.js';
import { boSoThuTu } from '../../lib/kl/nhan.js';
import { formatNgay, homNayVN } from '../../lib/kl/ngay.js';
import { setActiveNav, showSection } from '../shell/index.js';
import { ngayDaiVN } from '../shared/dieu-hanh/man-hinh.js';
import { datNapLai } from '../shared/dieu-hanh/hanh-dong.js';
import { dongViecHtml, nganViecHtml, moNgan, dongNgan } from '../shared/ngan-viec.js';

let rowsHienTai = []; let hangMo = null; let hangMoLoc = '{}'; let viecMo = null; // hàng đang mở rộng (khoá + bộ lọc của ô đã bấm), việc đang mở ngăn

const locAttr = (loc) => `data-loc='${escapeHtml(JSON.stringify(loc))}'`;
const nut = (n, loc, lop = '') => (n > 0 ? `<button type="button" class="nut nho ${lop}" data-action="bcMoRong" ${locAttr(loc)}>${n}</button>` : '<span class="chu-phu">·</span>');
const cot = (nhom, loc) => `<td class="so">${nut(nhom.QUA_HAN + nhom.DANG_DINH_CHINH, { ...loc, nhomTrong: ['QUA_HAN', 'DANG_DINH_CHINH'] }, 'chinh')}</td>
  <td class="so">${nut(nhom.SAP_DEN_HAN, { ...loc, nhom: 'SAP_DEN_HAN' })}</td><td class="so">${nut(nhom.DANG_THUC_HIEN, { ...loc, nhom: 'DANG_THUC_HIEN' })}</td>
  <td class="so">${nut(nhom.HOAN_THANH, { ...loc, nhom: 'HOAN_THANH' }, 'lam')}</td>`;
const DAU_BANG = '<thead><tr><th>Đơn vị / văn bản</th><th class="so">Tổng</th><th class="so">Quá hạn</th><th class="so">Sắp đến hạn</th><th class="so">Đang thực hiện</th><th class="so">Hoàn thành</th></tr></thead>';
const khoaCua = (loc) => JSON.stringify(loc);

// Hàng mở rộng ngay dưới dòng đang chọn: danh sách việc theo bộ lọc của ô số vừa bấm (hoặc cả dòng).
function hangMoRongHtml(loc) {
  // Khoá rỗng ('' = "(chưa xác định)" / "(không có số hiệu)") locRows coi là không lọc → lọc tay đúng nhóm không có giá trị.
  const ds = sapXep(locRows(rowsHienTai, loc).filter((r) => (loc.donVi !== '' || !r.owner_don_vi_ma) && (loc.ketLuan !== '' || !r.so_ket_luan))); const homNay = homNayVN();
  return `<tr class="mo-rong" id="bcMoRong"><td colspan="6"><div class="nv-ds">${ds.length ? ds.map((r) => dongViecHtml(r, homNay)).join('') : '<p class="trong-nho">Không có việc nào.</p>'}</div></td></tr>`;
}
function dong(ten, phu, loc, rows) {
  const dangMo = hangMo === khoaCua(loc);
  return `<tr class="bc-hang${dangMo ? ' dang' : ''}" data-action="bcMoRong" ${locAttr(loc)} aria-expanded="${String(dangMo)}"><td class="tieude">${escapeHtml(ten)}${phu ? `<small>${phu}</small>` : ''}</td>
    <td class="so">${nut(rows.length, loc)}</td>${cot(demTheoNhom(rows), loc)}</tr>${dangMo ? hangMoRongHtml(JSON.parse(hangMoLoc)) : ''}`;
}
function bangTheoOwner(rows) {
  const m = new Map();
  rows.forEach((r) => { const k = r.owner_don_vi_ma || ''; if (!m.has(k)) m.set(k, { ma: k, ten: boSoThuTu(r.owner_don_vi_ten) || '(chưa xác định)', rows: [] }); m.get(k).rows.push(r); });
  const ds = [...m.values()].sort((a, b) => b.rows.length - a.rows.length);
  return `<table>${DAU_BANG}<tbody>${ds.map((d) => dong(d.ten, '', { donVi: d.ma }, d.rows)).join('')}</tbody></table>`;
}
function bangTheoVanBan(rows) {
  const m = new Map();
  rows.forEach((r) => { const k = r.so_ket_luan || ''; if (!m.has(k)) m.set(k, { ten: k || '(không có số hiệu)', ngay: r.ngay_ban_hanh, rows: [] }); m.get(k).rows.push(r); });
  const ds = [...m.values()].sort((a, b) => (a.ngay < b.ngay ? 1 : -1));
  return `<table>${DAU_BANG}<tbody>${ds.map((d) => dong(d.ten, `ban hành ${formatNgay(d.ngay)}`, { ketLuan: d.ten }, d.rows)).join('')}</tbody></table>`;
}

function ve() {
  const t = tongHop(rowsHienTai);
  const o = (n, nhan, lop) => `<span class="o-so ${lop}"><b>${n}</b> ${nhan}</span>`;
  $('viewBaoCao').innerHTML = `
    <div class="dau"><h1>Báo cáo</h1><span>${ngayDaiVN()}, phạm vi phụ trách của đồng chí, ${t.tong} nhiệm vụ</span>
      <div class="phai-dau"><button type="button" class="nut nho" data-action="openBaoCao">Tải lại</button><button type="button" class="nut nho lam" data-action="inBaoCao">In / PDF</button></div></div>
    <div class="tq" role="group" aria-label="Tổng quan">${o(t.tong, 'việc trong phạm vi', '')}
      ${o(t.nhom.QUA_HAN + t.nhom.DANG_DINH_CHINH, 'quá hạn', 's-do')}${o(t.nhom.SAP_DEN_HAN, 'sắp đến hạn', 's-vang')}
      ${o(t.nhom.DANG_THUC_HIEN, 'đang thực hiện', 's-lam')}${o(t.nhom.HOAN_THANH, `hoàn thành · ${t.tyLeHoanThanh}%`, 's-luc')}</div>
    <div class="hai-ngan${viecMo ? ' mo' : ''}"><div>
      <div class="bang"><div class="bang-dau"><h2>Theo phòng, đơn vị chịu trách nhiệm</h2><span class="chu-phu">bấm một số hoặc một dòng để xem việc ngay dưới</span></div><div class="bang-cuon">${bangTheoOwner(rowsHienTai)}</div></div>
      <div class="bang"><div class="bang-dau"><h2>Theo kết luận, văn bản giao việc</h2></div><div class="bang-cuon">${bangTheoVanBan(rowsHienTai)}</div></div></div>
      <aside class="ngan-ben${viecMo ? '' : ' hidden'}" id="bcNgan" aria-label="Chi tiết việc đang chọn"></aside></div>`;
  if (viecMo) moNganViec({ id: viecMo });
}

async function napBaoCao() {
  try { await Promise.all([loadDanhMucKl(), loadCauHinhKl()]); rowsHienTai = (await loadKlRows()).rows; } catch (e) { notifyError(e.message); return; }
  ve();
}
async function openBaoCao() {
  showSection('viewBaoCao');
  setActiveNav('navBaoCao');
  hangMo = null; viecMo = null;
  datNapLai(napBaoCao);
  await napBaoCao();
}
// Bấm số / dòng: mở rộng hàng của dòng đó với bộ lọc của ô (khoá hàng = đơn vị hoặc kết luận); bấm lại cùng ô → gập.
function bcMoRong({ loc }) {
  let bo; try { bo = JSON.parse(loc || '{}'); } catch { bo = {}; }
  const khoaHang = khoaCua({ donVi: bo.donVi, ketLuan: bo.ketLuan });
  if (hangMo === khoaHang && hangMoLoc === JSON.stringify(bo)) { hangMo = null; } else { hangMo = khoaHang; hangMoLoc = JSON.stringify(bo); }
  ve();
  $('bcMoRong')?.scrollIntoView({ block: 'nearest' });
}
function moNganViec({ id }) {
  const r = rowsHienTai.find((x) => x.id === id); if (!r) return;
  viecMo = id;
  moNgan('bcNgan', nganViecHtml(r));
}
function dongNganBaoCao() { viecMo = null; dongNgan('bcNgan'); }

export function registerBaoCao() {
  registerActions({ openBaoCao, inBaoCao: () => window.print(), bcMoRong, moNganViec, dongNganBaoCao });
}
