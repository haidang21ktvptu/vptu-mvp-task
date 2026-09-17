// Báo cáo (A1, mockup): cùng dải tổng quan của mục Nhiệm vụ, xếp theo phòng/đơn vị Owner và theo kết luận (văn bản), nút In/PDF
// (window.print — in.css giữ dải và bảng, bỏ nút). Số liệu đếm client trên dòng RLS trả về (DB-5), mỗi số bấm ra danh sách.
import { $, escapeHtml } from '../../lib/dom.js';
import { registerActions } from '../../lib/actions.js';
import { notifyError } from '../../components/toast.js';
import { loadDanhMucKl, loadCauHinhKl, loadKlRows } from '../../lib/kl/du-lieu.js';
import { tongHop, demTheoNhom } from '../../lib/kl/tong-hop.js';
import { boSoThuTu } from '../../lib/kl/nhan.js';
import { formatNgay } from '../../lib/kl/ngay.js';
import { setActiveNav, showSection } from '../shell/index.js';
import { ngayDaiVN } from '../shared/dieu-hanh/man-hinh.js';

const nut = (n, loc, lop = '') => (n > 0 ? `<button type="button" class="nut nho ${lop}" data-action="moKlDanhSach" data-loc='${escapeHtml(JSON.stringify(loc))}'>${n}</button>` : '<span class="chu-phu">·</span>');
const cot = (nhom, loc) => `<td class="so">${nut(nhom.QUA_HAN + nhom.DANG_DINH_CHINH, { ...loc, nhomTrong: ['QUA_HAN', 'DANG_DINH_CHINH'] }, 'chinh')}</td>
  <td class="so">${nut(nhom.SAP_DEN_HAN, { ...loc, nhom: 'SAP_DEN_HAN' })}</td><td class="so">${nut(nhom.DANG_THUC_HIEN, { ...loc, nhom: 'DANG_THUC_HIEN' })}</td>
  <td class="so">${nut(nhom.HOAN_THANH, { ...loc, nhom: 'HOAN_THANH' }, 'lam')}</td>`;
const DAU_BANG = '<thead><tr><th>Đơn vị / văn bản</th><th class="so">Tổng</th><th class="so">Quá hạn</th><th class="so">Sắp đến hạn</th><th class="so">Đang thực hiện</th><th class="so">Hoàn thành</th></tr></thead>';

function bangTheoOwner(rows) {
  const m = new Map();
  rows.forEach((r) => { const k = r.owner_don_vi_ma || ''; if (!m.has(k)) m.set(k, { ma: k, ten: boSoThuTu(r.owner_don_vi_ten) || '(chưa xác định)', rows: [] }); m.get(k).rows.push(r); });
  const ds = [...m.values()].sort((a, b) => b.rows.length - a.rows.length);
  return `<table>${DAU_BANG}<tbody>${ds.map((d) => `<tr><td class="tieude">${escapeHtml(d.ten)}</td><td class="so">${nut(d.rows.length, { donVi: d.ma })}</td>${cot(demTheoNhom(d.rows), { donVi: d.ma })}</tr>`).join('')}</tbody></table>`;
}
function bangTheoVanBan(rows) {
  const m = new Map();
  rows.forEach((r) => { const k = r.so_ket_luan || ''; if (!m.has(k)) m.set(k, { ten: k || '(không có số hiệu)', ngay: r.ngay_ban_hanh, rows: [] }); m.get(k).rows.push(r); });
  const ds = [...m.values()].sort((a, b) => (a.ngay < b.ngay ? 1 : -1));
  return `<table>${DAU_BANG}<tbody>${ds.map((d) => `<tr><td class="tieude">${escapeHtml(d.ten)}<small>ban hành ${formatNgay(d.ngay)}</small></td><td class="so">${nut(d.rows.length, { ketLuan: d.ten })}</td>${cot(demTheoNhom(d.rows), { ketLuan: d.ten })}</tr>`).join('')}</tbody></table>`;
}

async function openBaoCao() {
  showSection('viewBaoCao');
  setActiveNav('navBaoCao');
  let rows;
  try { await Promise.all([loadDanhMucKl(), loadCauHinhKl()]); rows = (await loadKlRows()).rows; } catch (e) { notifyError(e.message); return; }
  const t = tongHop(rows);
  const o = (n, nhan, loc, lop) => `<button type="button" class="${lop}" data-action="moKlDanhSach" data-loc='${escapeHtml(JSON.stringify(loc))}'><b>${n}</b> ${nhan}</button>`;
  $('viewBaoCao').innerHTML = `
    <div class="dau"><h1>Báo cáo</h1><span>${ngayDaiVN()}, phạm vi phụ trách của đồng chí, ${t.tong} nhiệm vụ</span>
      <div class="phai-dau"><button type="button" class="nut nho" data-action="openBaoCao">Tải lại</button><button type="button" class="nut nho lam" data-action="inBaoCao">In / PDF</button></div></div>
    <div class="tq" role="group" aria-label="Tổng quan">${o(t.tong, 'việc trong phạm vi', {}, '')}<span class="sep"></span>
      ${o(t.nhom.QUA_HAN + t.nhom.DANG_DINH_CHINH, 'quá hạn', { nhomTrong: ['QUA_HAN', 'DANG_DINH_CHINH'] }, 's-do')}${o(t.nhom.SAP_DEN_HAN, 'sắp đến hạn', { nhom: 'SAP_DEN_HAN' }, 's-vang')}
      ${o(t.nhom.DANG_THUC_HIEN, 'đang thực hiện', { nhom: 'DANG_THUC_HIEN' }, 's-lam')}${o(t.nhom.HOAN_THANH, `hoàn thành · ${t.tyLeHoanThanh}%`, { nhom: 'HOAN_THANH' }, 's-luc')}</div>
    <div class="bang"><div class="bang-dau"><h2>Theo phòng, đơn vị chịu trách nhiệm</h2></div><div class="bang-cuon">${bangTheoOwner(rows)}</div></div>
    <div class="bang"><div class="bang-dau"><h2>Theo kết luận, văn bản giao việc</h2></div><div class="bang-cuon">${bangTheoVanBan(rows)}</div></div>`;
}

export function registerBaoCao() {
  registerActions({ openBaoCao, inBaoCao: () => window.print() });
}
