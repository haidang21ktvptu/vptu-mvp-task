// Báo cáo (A1, mockup): cùng dải tổng quan của mục Nhiệm vụ, xếp theo phòng/đơn vị Owner, theo nguồn nhiệm vụ (PR-3) và theo kết luận (văn bản),
// bảng "Việc cần lãnh đạo quyết định" (PR-3: việc mở có vướng mắc hoặc cấp cần quyết định), nút In/PDF (window.print — in.css giữ dải và bảng, bỏ
// nút) và Xuất Excel (PR-3 G: theo phòng + theo nguồn + danh sách Đỏ, nạp động lib/kl/xuat.js). Số liệu đếm client trên dòng RLS trả về (DB-5).
// Cột PR-3: Trước hạn (tách từ Đúng hạn chỉ ở hiển thị — ket_qua DB không đổi) và đếm theo chất lượng hoàn thành. Bấm một số / một dòng → danh
// sách việc mở rộng ngay dưới dòng; "Xem chi tiết" → ngăn chi tiết dùng chung (v9 đợt 2: đủ chỉ đạo, Giao lại, Nhắc, minh chứng, diễn biến)
// mở ngay trên trang. KHÔNG chuyển sang mục Nhiệm vụ. Ghi xong trong ngăn → bảng tự nạp lại (giữ hàng đang mở rộng).
import { $, escapeHtml } from '../../lib/dom.js';
import { registerActions } from '../../lib/actions.js';
import { notifyError, notifySuccess } from '../../components/toast.js';
import { loadDanhMucKl, loadCauHinhKl, loadKlRows, danhMucKl } from '../../lib/kl/du-lieu.js';
import { tongHop, demTheoNhom, locRows, sapXep, CHUA_CO_NGUON } from '../../lib/kl/tong-hop.js';
import { boSoThuTu, CHAT_LUONG } from '../../lib/kl/nhan.js';
import { formatNgay, homNayVN } from '../../lib/kl/ngay.js';
import { setActiveNav, showSection } from '../shell/index.js';
import { ngayDaiVN } from '../shared/dieu-hanh/man-hinh.js';
import { datNapLai } from '../shared/dieu-hanh/hanh-dong.js';
import { dongViecHtml } from '../shared/ngan-viec.js';
import { datNguonDong, khiGhiTrongNgan } from '../shared/ngan-chi-tiet.js';

let rowsHienTai = []; let hangMo = null; let hangMoLoc = '{}'; // hàng đang mở rộng (khoá + bộ lọc của ô đã bấm)

const locAttr = (loc) => `data-loc='${escapeHtml(JSON.stringify(loc))}'`;
const nut = (n, loc, lop = '') => (n > 0 ? `<button type="button" class="nut nho ${lop}" data-action="bcMoRong" ${locAttr(loc)}>${n}</button>` : '<span class="chu-phu">·</span>');
// PR-2b: cột gồm cả trạng thái mới để Tổng = tổng các cột (quá hạn ở bước nghiệm thu → Quá hạn; chờ nghiệm thu → Đang thực hiện).
const CT = { qua: ['QUA_HAN', 'DANG_DINH_CHINH', 'QUA_HAN_NGHIEM_THU'], sap: ['SAP_DEN_HAN'], dang: ['DANG_THUC_HIEN', 'CHO_NGHIEM_THU'] };
const tongCot = (nhom, ds) => ds.reduce((a, k) => a + (nhom[k] || 0), 0);
const truocHan = (rows) => rows.filter((r) => r.tien_do_hoan_thanh === 'TRUOC_HAN').length;
const theoCl = (rows, c) => rows.filter((r) => r.chat_luong === c).length;
const cot = (nhom, loc, rows) => `<td class="so">${nut(tongCot(nhom, CT.qua), { ...loc, nhomTrong: CT.qua }, 'chinh')}</td>
  <td class="so">${nut(tongCot(nhom, CT.sap), { ...loc, nhomTrong: CT.sap })}</td><td class="so">${nut(tongCot(nhom, CT.dang), { ...loc, nhomTrong: CT.dang })}</td>
  <td class="so">${nut(nhom.HOAN_THANH, { ...loc, nhom: 'HOAN_THANH' }, 'lam')}</td><td class="so">${nut(truocHan(rows), { ...loc, nhom: 'HOAN_THANH', tienDoHT: 'TRUOC_HAN' }, 'lam')}</td>
  ${CHAT_LUONG.map(([c]) => `<td class="so">${nut(theoCl(rows, c), { ...loc, nhom: 'HOAN_THANH', chatLuong: c })}</td>`).join('')}`;
// Cột số dùng chung cho bảng trên màn và tệp Excel (cùng thứ tự).
const TEN_COT_SO = ['Tổng', 'Quá hạn', 'Sắp đến hạn', 'Đang thực hiện', 'Hoàn thành', 'Trước hạn', ...CHAT_LUONG.map(([, ten]) => ten)];
const soCot = (rows) => { const n = demTheoNhom(rows); return [rows.length, tongCot(n, CT.qua), tongCot(n, CT.sap), tongCot(n, CT.dang), n.HOAN_THANH, truocHan(rows), ...CHAT_LUONG.map(([c]) => theoCl(rows, c))]; };
const SO_COT = TEN_COT_SO.length + 1;
const DAU_BANG = (ten) => `<thead><tr><th>${ten}</th>${TEN_COT_SO.map((t) => `<th class="so">${t}</th>`).join('')}</tr></thead>`;
const khoaCua = (loc) => JSON.stringify(loc);

// Hàng mở rộng ngay dưới dòng đang chọn: danh sách việc theo bộ lọc của ô số vừa bấm (hoặc cả dòng).
function hangMoRongHtml(loc) {
  // Khoá rỗng ('' = "(chưa xác định)" / "(không có số hiệu)") locRows coi là không lọc → lọc tay đúng nhóm không có giá trị.
  const ds = sapXep(locRows(rowsHienTai, loc).filter((r) => (loc.donVi !== '' || !r.owner_don_vi_ma) && (loc.ketLuan !== '' || !r.so_ket_luan))); const homNay = homNayVN();
  return `<tr class="mo-rong" id="bcMoRong"><td colspan="${SO_COT}"><div class="nv-ds">${ds.length ? ds.map((r) => dongViecHtml(r, homNay)).join('') : '<p class="trong-nho">Không có việc nào.</p>'}</div></td></tr>`;
}
function dong(ten, phu, loc, rows) {
  const dangMo = hangMo === khoaCua(loc);
  return `<tr class="bc-hang${dangMo ? ' dang' : ''}" data-action="bcMoRong" ${locAttr(loc)} aria-expanded="${String(dangMo)}"><td class="tieude">${escapeHtml(ten)}${phu ? `<small>${phu}</small>` : ''}</td>
    <td class="so">${nut(rows.length, loc)}</td>${cot(demTheoNhom(rows), loc, rows)}</tr>${dangMo ? hangMoRongHtml(JSON.parse(hangMoLoc)) : ''}`;
}
function gom(rows, khoa, ten) {
  const m = new Map();
  rows.forEach((r) => { const k = khoa(r); if (!m.has(k)) m.set(k, { ma: k, ten: ten(r), rows: [] }); m.get(k).rows.push(r); });
  return [...m.values()];
}
const nhomOwner = (rows) => gom(rows, (r) => r.owner_don_vi_ma || '', (r) => boSoThuTu(r.owner_don_vi_ten) || '(chưa xác định)').sort((a, b) => b.rows.length - a.rows.length);
// Theo nguồn: thứ tự danh mục; việc cũ chưa có nguồn xếp cuối.
const thuTuNguon = (ma) => { const i = (danhMucKl().nguonNhiemVu || []).findIndex((d) => d.ma === ma); return i < 0 ? 99 : i; };
const nhomNguon = (rows) => gom(rows, (r) => r.nguon_nhiem_vu_ma || CHUA_CO_NGUON, (r) => r.nguon_nhiem_vu_ten || 'Chưa xác định nguồn').sort((a, b) => thuTuNguon(a.ma) - thuTuNguon(b.ma));
const bangNhom = (tieuDe, ds, loc) => `<table>${DAU_BANG(tieuDe)}<tbody>${ds.map((d) => dong(d.ten, '', loc(d), d.rows)).join('')}</tbody></table>`;
function bangTheoVanBan(rows) {
  const m = new Map();
  rows.forEach((r) => { const k = r.so_ket_luan || ''; if (!m.has(k)) m.set(k, { ten: k || '(không có số hiệu)', ngay: r.ngay_ban_hanh, rows: [] }); m.get(k).rows.push(r); });
  const ds = [...m.values()].sort((a, b) => (a.ngay < b.ngay ? 1 : -1));
  return `<table>${DAU_BANG('Đơn vị / văn bản')}<tbody>${ds.map((d) => dong(d.ten, `ban hành ${formatNgay(d.ngay)}`, { ketLuan: d.ten }, d.rows)).join('')}</tbody></table>`;
}
// PR-3: việc ĐANG MỞ có vướng mắc hoặc đã xác định cấp cần quyết định.
function bangCanQuyet(rows) {
  const ds = sapXep(rows.filter((r) => r.tien_do_ma !== 'HOAN_THANH' && (r.vuong_mac || r.cap_quyet_dinh)));
  if (!ds.length) return '<p class="trong-nho">Không có việc nào cần lãnh đạo quyết định.</p>';
  return `<table><thead><tr><th>Mã</th><th>Nội dung</th><th>Chủ trì</th><th>Cấp cần quyết</th><th>Vướng mắc / đề nghị</th><th>Hạn</th><th></th></tr></thead><tbody>${ds.map((r) => `<tr data-id="${r.id}">
    <td><b>${escapeHtml(r.ma)}</b></td><td>${escapeHtml(r.noi_dung)}</td><td>${escapeHtml(r.owner_tai_khoan_ten || boSoThuTu(r.owner_don_vi_ten) || '')}</td>
    <td>${escapeHtml(r.cap_quyet_dinh_ten || '—')}</td><td data-truong="vuong-mac">${escapeHtml(r.vuong_mac || '—')}</td><td>${r.han_xu_ly ? formatNgay(r.han_xu_ly) : 'chưa có'}</td>
    <td><button type="button" class="nut nho" data-action="nganMoViec" data-id="${r.id}">Xem</button></td></tr>`).join('')}</tbody></table>`;
}

// Hai tỉ lệ đúng hạn (Q9; 0077: cả hai tính theo hạn hoàn thành) kèm mẫu số: việc đã đóng CÓ đánh giá (DB: nop_dung_han / nghiem_thu_dung_han) trên tổng việc đã đóng.
function tyLe(rows, ten, nhan) {
  const dongs = rows.filter((r) => r.tien_do_ma === 'HOAN_THANH'); const dg = dongs.filter((r) => ['DUNG_HAN', 'TRE'].includes(r[ten]));
  const dung = dg.filter((r) => r[ten] === 'DUNG_HAN').length;
  return `<span class="o-so s-luc" title="mẫu số: ${dg.length} việc được đánh giá / ${dongs.length} việc đã đóng"><b>${dg.length ? Math.round((dung / dg.length) * 100) : 0}%</b> ${nhan} (${dung}/${dg.length}, ${dongs.length} việc đã đóng)</span>`;
}
const khoi = (id, tieuDe, phu, than) => `<div class="bang" id="${id}"><div class="bang-dau"><h2>${tieuDe}</h2>${phu ? `<span class="chu-phu">${phu}</span>` : ''}</div><div class="bang-cuon">${than}</div></div>`;

function ve() {
  const t = tongHop(rowsHienTai);
  const o = (n, nhan, lop) => `<span class="o-so ${lop}"><b>${n}</b> ${nhan}</span>`;
  $('viewBaoCao').innerHTML = `
    <div class="dau"><h1>Báo cáo</h1><span>${ngayDaiVN()}, phạm vi phụ trách của đồng chí, ${t.tong} nhiệm vụ</span>
      <div class="phai-dau"><button type="button" class="nut nho" data-action="openBaoCao">Tải lại</button><button type="button" class="nut nho" id="bcXuatExcel" data-action="bcXuatExcel">Xuất Excel</button><button type="button" class="nut nho lam" data-action="inBaoCao">In / PDF</button></div></div>
    <div class="tq" role="group" aria-label="Tổng quan">${o(t.tong, 'việc trong phạm vi', '')}
      ${o(t.nhom.QUA_HAN + t.nhom.DANG_DINH_CHINH, 'quá hạn', 's-do')}${o(t.nhom.SAP_DEN_HAN, 'sắp đến hạn', 's-vang')}
      ${o(t.nhom.DANG_THUC_HIEN, 'đang thực hiện', 's-lam')}${o(t.nhom.HOAN_THANH, `hoàn thành · ${t.tyLeHoanThanh}%`, 's-luc')}
      ${o(t.nhom.CHO_NGHIEM_THU, 'chờ nghiệm thu', 's-lam')}${o(t.nhom.QUA_HAN_NGHIEM_THU, 'quá hạn ở bước nghiệm thu', 's-do')}
      ${tyLe(rowsHienTai, 'nop_dung_han', 'nộp minh chứng trước hạn hoàn thành')}${tyLe(rowsHienTai, 'nghiem_thu_dung_han', 'nghiệm thu trước hạn hoàn thành')}</div>
    <div>
      ${khoi('bcCanQuyet', 'Việc cần lãnh đạo quyết định', 'việc đang mở có vướng mắc hoặc đã xác định cấp cần quyết định', bangCanQuyet(rowsHienTai))}
      ${khoi('bcTheoPhong', 'Theo phòng, đơn vị chịu trách nhiệm', 'bấm một số hoặc một dòng để xem việc ngay dưới', bangNhom('Đơn vị / văn bản', nhomOwner(rowsHienTai), (d) => ({ donVi: d.ma })))}
      ${khoi('bcTheoNguon', 'Theo nguồn nhiệm vụ', '', bangNhom('Nguồn nhiệm vụ', nhomNguon(rowsHienTai), (d) => ({ nguon: d.ma })))}
      ${khoi('bcTheoVanBan', 'Theo kết luận, văn bản giao việc', '', bangTheoVanBan(rowsHienTai))}</div>`;
}

async function napBaoCao() {
  try { await Promise.all([loadDanhMucKl(), loadCauHinhKl()]); rowsHienTai = (await loadKlRows()).rows; } catch (e) { notifyError(e.message); return; }
  ve();
}
async function openBaoCao() {
  showSection('viewBaoCao');
  setActiveNav('navBaoCao');
  hangMo = null;
  datNapLai(napBaoCao);
  await napBaoCao();
}
// Bấm số / dòng: mở rộng hàng của dòng đó với bộ lọc của ô (khoá hàng = đơn vị, nguồn hoặc kết luận); bấm lại cùng ô → gập.
function bcMoRong({ loc }) {
  let bo; try { bo = JSON.parse(loc || '{}'); } catch { bo = {}; }
  const khoaHang = khoaCua({ donVi: bo.donVi, nguon: bo.nguon, ketLuan: bo.ketLuan });
  if (hangMo === khoaHang && hangMoLoc === JSON.stringify(bo)) { hangMo = null; } else { hangMo = khoaHang; hangMoLoc = JSON.stringify(bo); }
  ve();
  $('bcMoRong')?.scrollIntoView({ block: 'nearest' });
}
// Xuất Excel: bảng theo phòng + theo nguồn (cùng cột số với màn) + danh sách Đỏ (cột tường minh của màn Nhiệm vụ).
async function bcXuatExcel() {
  try {
    const { xuatBaoCao } = await import('../../lib/kl/xuat.js');
    const bang = (ten, ds) => ({ cot: [ten, ...TEN_COT_SO], dong: ds.map((d) => [d.ten, ...soCot(d.rows)]) });
    const rowsDo = sapXep(rowsHienTai.filter((r) => ['DO', 'DO_DAC_BIET'].includes(r.muc_canh_bao)));
    notifySuccess(`Đã xuất báo cáo ra tệp ${xuatBaoCao({ theoPhong: bang('Phòng / đơn vị', nhomOwner(rowsHienTai)), theoNguon: bang('Nguồn nhiệm vụ', nhomNguon(rowsHienTai)), rowsDo })}.`);
  } catch (e) { notifyError('Không xuất được Excel: ' + e.message); }
}

export function registerBaoCao() {
  registerActions({ openBaoCao, inBaoCao: () => window.print(), bcMoRong, bcXuatExcel });
  datNguonDong((id) => rowsHienTai.find((r) => r.id === id));
  khiGhiTrongNgan('viewBaoCao', napBaoCao);
}
