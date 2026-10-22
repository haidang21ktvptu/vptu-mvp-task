// Báo cáo (A1): dải số đầu trang; "Việc cần lãnh đạo quyết định"; theo phòng chuyên môn; theo chuyên viên thực hiện của mỗi phòng (v3.29); theo nguồn
// nhiệm vụ; theo kết luận, văn bản giao việc; nút In/PDF (window.print — in.css giữ dải và bảng, bỏ nút) và Xuất Excel (nạp động lib/kl/xuat.js). Số
// liệu đếm client trên dòng RLS trả về (DB-5). v3.29 (chủ dự án 22/10/2026): mọi bảng cùng sáu cột (lib/kl/bao-cao.js) — Tổng số nhiệm vụ, Quá hạn,
// Sắp đến hạn (còn ≤ 3 ngày), Đang thực hiện, Hoàn thành, Trước hạn; cách xếp mức như Tổng quan; bỏ 4 cột chất lượng. Bấm một số / một dòng → danh
// sách việc mở rộng ngay dưới dòng; "Xem chi tiết" → ngăn chi tiết dùng chung (đủ chỉ đạo, Giao lại, Nhắc, minh chứng, diễn biến) mở ngay trên
// trang, KHÔNG chuyển sang mục Nhiệm vụ. Ghi xong trong ngăn → bảng tự nạp lại (giữ hàng đang mở rộng).
import { $, escapeHtml } from '../../lib/dom.js';
import { registerActions } from '../../lib/actions.js';
import { state } from '../../lib/state.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { notifyError, notifySuccess } from '../../components/toast.js';
import { loadDanhMucKl, loadCauHinhKl, loadKlRows, danhMucKl } from '../../lib/kl/du-lieu.js';
import { sapXep } from '../../lib/kl/tong-hop.js';
import { boSoThuTu, nguongCanhBao } from '../../lib/kl/nhan.js';
import { formatNgay, homNayVN } from '../../lib/kl/ngay.js';
import { cotBaoCao, demCot, locBaoCao, theoPhongChuyenMon, theoChuyenVien, theoNguon, theoVanBanBc } from '../../lib/kl/bao-cao.js';
import { setActiveNav, showSection } from '../shell/index.js';
import { ngayDaiVN } from '../shared/dieu-hanh/man-hinh.js';
import { datNapLai } from '../shared/dieu-hanh/hanh-dong.js';
import { dongViecHtml } from '../shared/ngan-viec.js';
import { datNguonDong, khiGhiTrongNgan } from '../shared/ngan-chi-tiet.js';

let rowsHienTai = []; let hangMo = null; let hangMoLoc = '{}'; // hàng đang mở rộng (khoá hàng + bộ lọc của ô đã bấm)

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
  const ds = sapXep(locBaoCao(rowsHienTai, loc, ctx())); const homNay = homNayVN();
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

function ve() {
  const d = demCot(rowsHienTai); const n = nguongCanhBao();
  const o = (so, nhan, lop) => `<span class="o-so ${lop}"><b>${so}</b> ${nhan}</span>`;
  $('viewBaoCao').innerHTML = `
    <div class="dau"><h1>Báo cáo</h1><span>${ngayDaiVN()}, phạm vi phụ trách của đồng chí, ${d.tong} nhiệm vụ</span>
      <div class="phai-dau"><button type="button" class="nut nho" data-action="openBaoCao">Tải lại</button><button type="button" class="nut nho" id="bcXuatExcel" data-action="bcXuatExcel">Xuất Excel</button><button type="button" class="nut nho lam" data-action="inBaoCao">In / PDF</button></div></div>
    <div class="tq" role="group" aria-label="Tổng quan">${o(d.tong, 'nhiệm vụ trong phạm vi', '')}${o(d.qua, 'quá hạn', 's-do')}${o(d.sap, `sắp đến hạn (còn ≤ ${n.vang} ngày)`, 's-vang')}
      ${o(d.dang, 'đang thực hiện', 's-lam')}${o(d.xong, `hoàn thành · ${d.tong ? Math.round((d.xong / d.tong) * 100) : 0}%`, 's-luc')}${o(d.truoc, 'trước hạn', 's-luc')}${tyLe(rowsHienTai)}</div>
    <p class="chu-phu bc-cach-tinh">Cách tính: Tổng số nhiệm vụ = quá hạn + sắp đến hạn + đang thực hiện + hoàn thành. Quá hạn, sắp đến hạn tính như Tổng quan (sắp đến hạn = còn ≤ ${n.vang} ngày mà chưa có minh chứng; việc khẩn trở lên ≤ ${n.khan} ngày). Đang thực hiện = nhiệm vụ chưa hoàn thành còn lại (còn trong hạn, chưa có hạn, thường xuyên). Trước hạn = nhiệm vụ hoàn thành trước hạn xử lý.</p>
    <div>
      ${khoi('bcCanQuyet', 'Việc cần lãnh đạo quyết định', 'việc đang mở có vướng mắc hoặc đã xác định cấp cần quyết định', bangCanQuyet(rowsHienTai))}
      ${khoi('bcTheoPhong', 'Theo phòng chuyên môn', 'phòng của cán bộ chủ trì theo dõi · bấm một số hoặc một dòng để xem việc ngay dưới', bangPhong(rowsHienTai))}
      ${khoi('bcTheoChuyenVien', 'Theo chuyên viên thực hiện', 'mỗi phòng chuyên môn, từng cán bộ chủ trì theo dõi', bangChuyenVien(rowsHienTai))}
      ${khoi('bcTheoNguon', 'Theo nguồn nhiệm vụ', '', bangNguon(rowsHienTai))}
      ${khoi('bcTheoVanBan', 'Theo kết luận, văn bản giao việc', '', bangVanBan(rowsHienTai))}</div>`;
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
    const cv = theoChuyenVien(rowsHienTai, ctx()).flatMap((p) => [[p.ten, 'Cả phòng', ...so(p.rows)], ...p.canBo.map((c) => [p.ten, c.ten, ...so(c.rows)])]);
    const rowsQua = sapXep(locBaoCao(rowsHienTai, { cot: 'qua' }));
    const ten = xuatBaoCao({ theoPhong: bangX('Phòng chuyên môn', theoPhongChuyenMon(rowsHienTai, ctx())), theoChuyenVien: { cot: ['Phòng chuyên môn', 'Chuyên viên thực hiện', ...tenCot], dong: cv },
      theoNguon: bangX('Nguồn nhiệm vụ', theoNguon(rowsHienTai, danhMucKl().nguonNhiemVu || [])), rowsQuaHan: rowsQua });
    notifySuccess(`Đã xuất báo cáo ra tệp ${ten}.`);
  } catch (e) { notifyError('Không xuất được Excel: ' + e.message); }
}

export function registerBaoCao() {
  registerActions({ openBaoCao, inBaoCao: () => window.print(), bcMoRong, bcXuatExcel });
  datNguonDong((id) => rowsHienTai.find((r) => r.id === id));
  khiGhiTrongNgan('viewBaoCao', napBaoCao);
}
