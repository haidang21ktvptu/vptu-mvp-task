// Báo cáo — phần dựng HTML (không chạm DOM, không giữ trạng thái): dải số đầu trang, khối "Việc cần lãnh đạo quyết định", bốn bảng sáu cột và hàng mở
// rộng. Tách từ bao-cao.js ở v3.36 (CAU-HOI V-13, DESIGN mục 17 — số trước, chi tiết bấm mới mở): nhãn của dải số ghi ngắn, phần giải thích ở gợi ý;
// ghi chú của khối ở nút "i" cạnh tên khối; "Việc cần lãnh đạo quyết định" và "Theo kết luận, văn bản giao việc" chỉ hiện các dòng đầu, nút "Xem tất cả"
// ở cuối khối (components/ds-gon.js — bản in vẫn đủ dòng); nội dung, vướng mắc tối đa hai dòng (đủ chữ ở title, ngăn chi tiết và bản in); dòng phụ của
// tên dòng ("6 cán bộ", "ban hành …") đứng cùng dòng với tên. Màn hẹp và bản in khổ dọc (bảng xếp thành khối): mỗi ô mang nhãn ngắn (data-nhan), sáu số
// của một dòng đứng cùng hàng (can-bo-bao-cao.css); bản in ghi lại số trong bảng (in.css — trước v3.36 số là nút nên bị ẩn cùng mọi nút).
// bc = { rows, rowsKy, hangMo, hangMoLoc }: mọi việc của phạm vi đang xem; việc của kỳ đang xem; khoá hàng đang mở rộng và bộ lọc của ô vừa bấm.
import { escapeHtml } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { soLanHtml } from '../../lib/chuyen-dong.js';
import { danhMucKl } from '../../lib/kl/du-lieu.js';
import { sapXep } from '../../lib/kl/tong-hop.js';
import { boSoThuTu, nguongCanhBao } from '../../lib/kl/nhan.js';
import { formatNgay, homNayVN } from '../../lib/kl/ngay.js';
import { cotBaoCao, demCot, locBaoCao, theoPhongChuyenMon, theoChuyenVien, theoNguon, theoVanBanBc } from '../../lib/kl/bao-cao.js';
import { nutGoi, thuocGoi } from '../../components/goi.js';
import { nutHetHtml } from '../../components/ds-gon.js';
import { dongViecHtml } from '../shared/ngan-viec.js';

export const SO_CAN_QUYET_DAU = 5; export const SO_VAN_BAN_DAU = 10;   // số dòng đầu của hai danh sách dài (components/ds-gon.js: 'bcCanQuyet', 'bcVanBan')
export const ctx = () => ({ phongCua: Object.fromEntries((state.accounts || []).map((a) => [a.id, a.department])), tenPhong: DEPT_NAMES });
export const COT = () => cotBaoCao(nguongCanhBao().vang);
const SO_COT = 7;   // cột tên + sáu cột số
const LOP = { qua: 'chinh', xong: 'lam', truoc: 'lam' };
const NHAN_NGAN = { tong: 'Tổng', qua: 'Quá hạn', sap: 'Sắp đến hạn', dang: 'Đang thực hiện', xong: 'Hoàn thành', truoc: 'Trước hạn' };   // nhãn của ô số ở màn hẹp và bản in khổ dọc (bảng xếp thành khối, không có hàng tiêu đề)
const locAttr = (loc) => `data-loc='${escapeHtml(JSON.stringify(loc))}'`;
const nut = (n, loc, lop = '') => (n > 0 ? `<button type="button" class="nut nho ${lop}" data-action="bcMoRong" ${locAttr(loc)}>${n}</button>` : '<span class="chu-phu">·</span>');
const DAU_BANG = (ten) => `<thead><tr><th>${ten}</th>${COT().map(([, t]) => `<th class="so">${t}</th>`).join('')}</tr></thead>`;
// Khoá hàng: bảng (b) + nhóm — cùng một phòng ở hai bảng là hai hàng khác nhau (mỗi lúc chỉ một hàng mở rộng, một #bcMoRong).
export const khoaHangCua = (loc) => JSON.stringify(['b', 'phong', 'canBo', 'nguon', 'ketLuan'].filter((k) => k in loc).map((k) => [k, loc[k]]));

// Hàng mở rộng ngay dưới dòng đang chọn: danh sách việc theo bộ lọc của ô số vừa bấm (hoặc cả dòng).
function hangMoRongHtml(bc, loc) {
  const ds = sapXep(locBaoCao(bc.rowsKy, loc, ctx())); const homNay = homNayVN();
  return `<tr class="mo-rong" id="bcMoRong"><td colspan="${SO_COT}"><div class="nv-ds">${ds.length ? ds.map((r) => dongViecHtml(r, homNay)).join('') : '<p class="trong-nho">Không có việc nào.</p>'}</div></td></tr>`;
}
function dong(bc, ten, phu, loc, rows, lop = '') {
  const d = demCot(rows); const dangMo = bc.hangMo === khoaHangCua(loc);
  return `<tr class="bc-hang${lop ? ` ${lop}` : ''}${dangMo ? ' dang' : ''}" data-action="bcMoRong" ${locAttr(loc)} aria-expanded="${String(dangMo)}"><td class="tieude">${escapeHtml(ten)}${phu ? `<small>${phu}</small>` : ''}</td>
    ${COT().map(([k]) => `<td class="so" data-nhan="${NHAN_NGAN[k]}">${nut(d[k], { ...loc, cot: k }, LOP[k] || '')}</td>`).join('')}</tr>${dangMo ? hangMoRongHtml(bc, JSON.parse(bc.hangMoLoc)) : ''}`;
}
const bang = (tieuDe, than) => `<table>${DAU_BANG(tieuDe)}<tbody>${than}</tbody></table>`;
const bangPhong = (bc) => bang('Phòng chuyên môn', theoPhongChuyenMon(bc.rowsKy, ctx()).map((p) => dong(bc, p.ten, '', { b: 'p', phong: p.ma }, p.rows)).join(''));
const bangChuyenVien = (bc) => bang('Phòng chuyên môn / chuyên viên thực hiện', theoChuyenVien(bc.rowsKy, ctx()).map((p) => dong(bc, p.ten, `${p.canBo.filter((c) => c.ma).length} cán bộ`, { b: 'cv', phong: p.ma }, p.rows, 'bc-phong')
  + p.canBo.map((c) => dong(bc, c.ten, '', { b: 'cv', phong: p.ma, canBo: c.ma }, c.rows, 'bc-con')).join('')).join(''));
const bangNguon = (bc) => bang('Nguồn nhiệm vụ', theoNguon(bc.rowsKy, danhMucKl().nguonNhiemVu || []).map((n) => dong(bc, n.ten, '', { b: 'n', nguon: n.ma }, n.rows)).join(''));
const bangVanBan = (bc, ds) => bang('Kết luận / văn bản', ds.map((v) => dong(bc, v.ten, `ban hành ${formatNgay(v.ngay)}`, { b: 'vb', ketLuan: v.ma }, v.rows)).join(''));

// PR-3: việc ĐANG MỞ có vướng mắc hoặc đã xác định cấp cần quyết định. v3.36 (V-13): nội dung, vướng mắc tối đa hai dòng (.nd-gon — đủ chữ ở title,
// bản in ghi đủ); nút "Xem" mở ngăn chi tiết như trước.
const canQuyet = (rows) => sapXep(rows.filter((r) => r.tien_do_ma !== 'HOAN_THANH' && (r.vuong_mac || r.cap_quyet_dinh)));
const gon = (chu) => `<span class="nd-gon" title="${escapeHtml(chu)}">${escapeHtml(chu)}</span>`;
function bangCanQuyet(ds) {
  if (!ds.length) return '<p class="trong-nho">Không có việc nào cần lãnh đạo quyết định.</p>';
  return `<table><thead><tr><th>Mã nhiệm vụ</th><th>Nội dung kết luận / Văn bản trình</th><th>Chủ trì theo dõi</th><th>Cấp cần quyết</th><th>Vướng mắc / đề nghị</th><th>Hạn xử lý</th><th></th></tr></thead><tbody>${ds.map((r) => `<tr data-id="${r.id}">
    <td><b>${escapeHtml(r.ma)}</b></td><td>${gon(r.noi_dung || '')}</td><td data-nhan="Chủ trì theo dõi">${escapeHtml(r.owner_tai_khoan_ten || boSoThuTu(r.owner_don_vi_ten) || '')}</td>
    <td data-nhan="Cấp cần quyết">${escapeHtml(r.cap_quyet_dinh_ten || '—')}</td><td data-truong="vuong-mac" data-nhan="Vướng mắc, đề nghị">${r.vuong_mac ? gon(r.vuong_mac) : '—'}</td><td data-nhan="Hạn xử lý">${r.han_xu_ly ? formatNgay(r.han_xu_ly) : 'chưa có'}</td>
    <td><button type="button" class="nut nho" data-action="nganMoViec" data-id="${r.id}">Xem</button></td></tr>`).join('')}</tbody></table>`;
}

// Dải số: số và nhãn ngắn; phần giải thích (ngưỡng sắp đến hạn, mẫu số của tỉ lệ đúng hạn) ở gợi ý và ở chữ ẩn cho trình đọc màn hình.
// Tỉ lệ đúng hạn (Q9; 0077: tính theo hạn xử lý) kèm mẫu số: việc đã đóng CÓ đánh giá trên tổng việc đã đóng.
function daiSoHtml(rowsKy) {
  const d = demCot(rowsKy); const n = nguongCanhBao();
  const o = (so, nhan, lop, goi = '') => `<span class="o-so ${lop}"${thuocGoi(goi)}><b>${soLanHtml(so)}</b> ${nhan}${goi ? `<span class="sr">. ${escapeHtml(goi)}</span>` : ''}</span>`;   // v3.36 (V-12): số lăn khi vào mục, khi đổi kỳ
  const dongs = rowsKy.filter((r) => r.tien_do_ma === 'HOAN_THANH'); const dg = dongs.filter((r) => ['DUNG_HAN', 'TRE'].includes(r.nop_dung_han));
  const dung = dg.filter((r) => r.nop_dung_han === 'DUNG_HAN').length;
  return `<div class="tq" role="group" aria-label="Tổng quan">${o(d.tong, 'nhiệm vụ của kỳ', '')}${o(d.qua, 'quá hạn', 's-do')}${o(d.sap, 'sắp đến hạn', 's-vang', `Còn ≤ ${n.vang} ngày (mức Vàng)`)}
    ${o(d.dang, 'đang thực hiện', 's-lam')}${o(d.xong, `hoàn thành · ${d.tong ? Math.round((d.xong / d.tong) * 100) : 0}%`, 's-luc')}${o(d.truoc, 'trước hạn', 's-luc')}
    ${o(`${dg.length ? Math.round((dung / dg.length) * 100) : 0}%`, `nộp đúng hạn (${dung}/${dg.length})`, 's-luc', `Nộp minh chứng trước hạn xử lý: ${dung} trên ${dg.length} nhiệm vụ được đánh giá (${dongs.length} nhiệm vụ đã hoàn thành)`)}</div>`;
}

// Khối: tên khối, số lượng (nếu là danh sách), ghi chú ở nút "i"; sau: nút "Xem tất cả N …" của danh sách hiện các dòng đầu (khối mang lớp co-them:
// một đường kẻ giữa dòng cuối đang hiện và nút).
const khoi = (id, tieuDe, ghiChu, than, { so = '', sau = '' } = {}) => `<div class="bang${sau ? ' co-them' : ''}" id="${id}"><div class="bang-dau"><div class="bang-ten"><h2>${tieuDe}${so ? `<span class="chu-phu">${so}</span>` : ''}</h2>${nutGoi(ghiChu)}</div></div>`
  + `<div class="bang-cuon">${than}</div>${sau}</div>`;

export function thanBaoCaoHtml(bc) {
  const cq = canQuyet(bc.rows); const vb = theoVanBanBc(bc.rowsKy);
  return `${daiSoHtml(bc.rowsKy)}
    <div>
      ${khoi('bcCanQuyet', 'Việc cần lãnh đạo quyết định', 'Việc đang mở có vướng mắc hoặc đã xác định cấp cần quyết định.', bangCanQuyet(cq),
    { so: cq.length ? `${cq.length} việc` : '', sau: nutHetHtml('bcCanQuyet', cq.length, SO_CAN_QUYET_DAU) })}
      ${khoi('bcTheoPhong', 'Theo phòng chuyên môn', 'Tính theo phòng của cán bộ chủ trì theo dõi. Bấm một số hoặc một dòng để xem việc ngay dưới.', bangPhong(bc))}
      ${khoi('bcTheoChuyenVien', 'Theo chuyên viên thực hiện', 'Mỗi phòng chuyên môn, từng cán bộ chủ trì theo dõi.', bangChuyenVien(bc))}
      ${khoi('bcTheoNguon', 'Theo nguồn nhiệm vụ', '', bangNguon(bc))}
      ${khoi('bcTheoVanBan', 'Theo kết luận, văn bản giao việc', '', bangVanBan(bc, vb), { so: vb.length ? `${vb.length} văn bản` : '', sau: nutHetHtml('bcVanBan', vb.length, SO_VAN_BAN_DAU, 'văn bản') })}</div>`;
}
