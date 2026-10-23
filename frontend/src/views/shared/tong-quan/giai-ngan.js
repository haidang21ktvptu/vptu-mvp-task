// Khối "Giải ngân vốn đầu tư công năm N" của Tổng quan (v3.28, 0119 — chủ dự án 21/10/2026: lãnh đạo nhìn bức tranh toàn tỉnh trước, rồi từng nhiệm
// vụ). Rộng hết hàng, ngay sau "Điểm nghẽn cần chỉ đạo": vòng % kỳ mới nhất + số tiền + mức so với tiến độ đều (mục tiêu của việc "Số liệu toàn tỉnh"),
// biểu đồ % qua các kỳ, căn cứ (văn bản, ngày số liệu, ước tính), cảnh báo chất lượng số liệu, bảng theo nguồn vốn và theo chủ đầu tư (tỷ lệ thấp
// trước, đơn vị dưới mức chung của tỉnh tô nền), nhiệm vụ gắn theo dõi giải ngân theo mục tiêu riêng (thanh lọc của Tổng quan chỉ áp vào phần này;
// bấm mở việc trong ngăn chi tiết). Chưa có kỳ nào: lãnh đạo Văn phòng / người nhập được thấy hướng dẫn, người khác không thấy khối. Chỉ dựng HTML.
import { escapeHtml } from '../../../lib/dom.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { TEN_LOAI, LOP_MUC, soVN, ptVN, tyLe, mucGiaiNgan, nhanMuc, moTaMuc, tongHopNam, viecTheoDoi, duoiMucChung, duocNhapKy, lechTong } from '../../../lib/kl/giai-ngan.js';
import { vongHtml } from './bieu-do.js';
import { dauKhoi } from './template.js';
import { xuHuongHtml } from './giai-ngan-bieu-do.js';

const SO_DONG_CDT = 10;   // chủ đầu tư: hiện 10 đơn vị chậm nhất, "Xem đủ" mở hết
const THUOC = { DAT: 'tot', DUNG: 'tot', CHAM: 'canh', CHAM_NHIEU: 'nguy', CHUA_CO: '' };
export const chipMucHtml = (m) => `<span class="muc-gn ${LOP_MUC[m.muc]}">${escapeHtml(nhanMuc(m))}</span>`;
export const thanhGnHtml = (m) => `<span class="dong-han gn-thanh"><span class="thuoc-tq ${THUOC[m.muc]}"><i style="width:${Math.min(100, Math.max(0, m.pt || 0))}%"></i></span><b>${ptVN(m.pt)}</b></span>`;
export const doiTuongChu = (g) => (g.loai === 'TOAN_TINH' ? TEN_LOAI.TOAN_TINH : `${TEN_LOAI[g.loai]}: ${g.ten}`);

function bangHtml(ds, { th, homNay, ptTinh = null, an = 0 }) {
  const k = th.moi;
  const dong = (x) => {
    const m = mucGiaiNgan({ da: x.da_giai_ngan, kh: x.ke_hoach, ngaySoLieu: k.ngay_so_lieu, ...th.mucTieu, homNay }); const duoi = duoiMucChung(x, ptTinh);
    return `<tr${duoi ? ' class="gn-duoi"' : ''}><td class="c-ten"><b>${escapeHtml(x.ten)}</b><small><span class="gn-hep">${soVN(x.da_giai_ngan)} / ${soVN(x.ke_hoach)} tỷ đồng</span>${duoi ? '<span class="gn-duoi-chu">dưới mức chung của tỉnh</span>' : ''}</small></td>
      <td class="so" data-n="Kế hoạch">${soVN(x.ke_hoach)}</td><td class="so" data-n="Đã giải ngân">${soVN(x.da_giai_ngan)}</td><td data-n="Tỷ lệ">${thanhGnHtml(m)}</td></tr>`;
  };
  const l = lechTong(k, ds, ds[0].loai);
  return `<div class="cuon-ngang"><table class="bang-tq bang-gn"><thead><tr><th>${ds[0].loai === 'NGUON' ? 'Nguồn vốn' : 'Chủ đầu tư, đơn vị'}</th><th class="so">Kế hoạch</th><th class="so">Đã giải ngân</th><th>Tỷ lệ</th></tr></thead>
    <tbody>${(an ? ds.slice(0, an) : ds).map(dong).join('')}</tbody>
    <tfoot><tr><th scope="row">Cộng ${ds.length} dòng</th><td class="so" data-n="Kế hoạch">${soVN(l.tongKh)}</td><td class="so" data-n="Đã giải ngân">${soVN(l.tongDa)}</td><td data-n="Tỷ lệ"><b>${ptVN(tyLe(l.tongDa, l.tongKh))}</b></td></tr></tfoot></table></div>`;
}

function viecHtml(ds, { daLoc, soNgayMoi }) {
  const dong = ({ r, g, s, m }) => `<tr><td class="c-ten"><button type="button" class="ten-bam" data-action="tqMoViec" data-id="${r.id}"><span class="ma-ng">${escapeHtml(r.ma)}</span><b>${escapeHtml(r.noi_dung)}</b>
      <small>${escapeHtml(doiTuongChu(g))}${s && s.ngay !== soNgayMoi ? ` · số liệu đến ${formatNgay(s.ngay)}` : ''}</small></button></td>
    <td data-n="Mục tiêu">${ptVN(g.muc_tieu_pt)} trước ${formatNgay(g.muc_tieu_ngay)}</td><td data-n="Đạt">${s ? thanhGnHtml(m) : '<span class="chu-phu">chưa có số của đối tượng này</span>'}</td><td data-n="Mức">${chipMucHtml(m)}</td></tr>`;
  const than = ds.length ? `<div class="cuon-ngang"><table class="bang-tq bang-gn bang-gn-viec"><thead><tr><th>Nhiệm vụ</th><th>Mục tiêu</th><th>Đạt</th><th>Mức so với tiến độ đều</th></tr></thead>
      <tbody>${ds.map(dong).join('')}</tbody></table></div>`
    : `<p class="chu-phu">${daLoc ? 'Không có nhiệm vụ theo dõi giải ngân trong các việc đang lọc.' : 'Chưa có nhiệm vụ nào gắn theo dõi giải ngân trong phạm vi đang xem — mở nhiệm vụ, mục "Giải ngân vốn" → "Theo dõi giải ngân".'}</p>`;
  return `<section class="gn-phan gn-viec" aria-labelledby="tqGnViec"><h3 id="tqGnViec">Nhiệm vụ theo dõi giải ngân <span class="chu-phu">${ds.length} nhiệm vụ${daLoc ? ' — theo thanh lọc' : ''}, chậm nhiều trước</span></h3>${than}</section>`;
}

// d: docNam (lib/kl/giai-ngan-db.js) hoặc null (chưa đọc được); rows: việc đã qua thanh lọc; tatCa: mọi việc thấy được; ui.gnDu: bảng chủ đầu tư mở đủ.
export function giaiNganHtml(d, { rows = [], tatCa = [], homNay, user, ui = {}, daLoc = false }) {
  if (!d) return '';
  const th = tongHopNam(d, homNay);
  const rowTt = th.tt ? tatCa.find((r) => r.id === th.tt.nhiem_vu_id) || null : null;
  const nhap = Boolean(th.tt) && duocNhapKy(user, rowTt); const tieu = `Giải ngân vốn đầu tư công năm ${th.nam}`;   // chưa có việc toàn tỉnh: DB không nhận kỳ
  const nut = (nhap ? `<button type="button" class="nut nho" data-action="gnMoNhap" data-nam="${th.nam}">Nhập kỳ số liệu</button>` : '')
    + (rowTt ? `<button type="button" class="nut nho" data-action="tqMoViec" data-id="${rowTt.id}">Mở nhiệm vụ ${escapeHtml(rowTt.ma)}</button>` : '');
  const phai = nut ? `<div class="gn-nut">${nut}</div>` : '';
  if (!th.moi) {
    if (user?.role_group !== 'A1' && !nhap) return '';
    const buoc = th.tt ? `Đã có nhiệm vụ "Số liệu toàn tỉnh"${rowTt ? ` ${escapeHtml(rowTt.ma)}` : ''}. Chủ trì theo dõi hoặc người theo dõi nhiệm vụ đó bấm "Nhập kỳ số liệu", chọn tệp Excel hoặc dán bảng của báo cáo UBND tỉnh / Sở Tài chính; nhập bù các kỳ trước để có đường tiến độ.`
      : 'Bước 1: lãnh đạo Văn phòng mở nhiệm vụ theo dõi, tổng hợp tiến độ giải ngân (hoặc giao việc mới), mục "Giải ngân vốn" (hoặc bảng "Xem chi tiết") → "Theo dõi giải ngân" → chọn "Số liệu toàn tỉnh". Bước 2: chủ trì theo dõi nhiệm vụ đó nhập kỳ số liệu từ báo cáo chính thức.';
    return `<article class="the-bd n12 gn-tq gn-trong" id="tqGiaiNgan">${dauKhoi(0, tieu, 'Chưa có số liệu năm này. Chỉ lãnh đạo Văn phòng và người nhập số liệu thấy hướng dẫn này.', phai)}<p class="gn-huong-dan">${buoc}</p></article>`;
  }
  const k = th.moi; const m = th.muc; const con = Math.max(0, k.ke_hoach - k.da_giai_ngan);
  const tong = `<div class="gn-tong"><span class="gn-vong ${LOP_MUC[m.muc]}">${vongHtml(Math.min(100, m.pt), 'đã giải ngân', ptVN(m.pt))}</span>
    <div class="gn-so"><b class="gn-tien">${soVN(k.da_giai_ngan)} <small>/ ${soVN(k.ke_hoach)} tỷ đồng</small></b><span class="chu-phu">Đã giải ngân / kế hoạch vốn năm · còn phải giải ngân ${soVN(con)} tỷ đồng</span>
      ${chipMucHtml(m)}<small class="chu-phu">${escapeHtml(moTaMuc(m))}</small></div></div>`;
  const canCu = `<p class="gn-can-cu">Số liệu đến <b>${formatNgay(k.ngay_so_lieu)}</b>${k.uoc_tinh ? ' (ước tính)' : ''} · căn cứ: ${escapeHtml(k.can_cu)}${k.ghi_chu ? ` · ${escapeHtml(k.ghi_chu)}` : ''}${th.ky.length > 1 ? ` · ${th.ky.length} kỳ số liệu` : ''}${m.cu ? ` <span class="gn-cu">Số liệu đã cũ ${m.soNgayCu} ngày — cần nhập kỳ mới</span>` : ''}</p>`;
  const canhBao = th.canhBao.length ? `<ul class="gn-canh-bao" role="note" aria-label="Lưu ý về số liệu kỳ này">${th.canhBao.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : '';
  const du = Boolean(ui.gnDu); const nCdt = th.chuDauTu.length;
  const nutDu = nCdt > SO_DONG_CDT ? `<button type="button" class="nut nho" data-action="tqGnDu" aria-expanded="${String(du)}">${du ? 'Thu gọn' : `Xem đủ ${nCdt} đơn vị`}</button>` : '';
  const bang = `<div class="gn-hai-bang"><section class="gn-phan" aria-labelledby="tqGnNguon"><h3 id="tqGnNguon">Theo nguồn vốn <span class="chu-phu">tỷ đồng</span></h3>
      ${th.nguon.length ? bangHtml(th.nguon, { th, homNay }) : '<p class="chu-phu">Kỳ này chưa nhập bảng theo nguồn vốn.</p>'}</section>
    <section class="gn-phan" aria-labelledby="tqGnCdt"><h3 id="tqGnCdt">Theo chủ đầu tư, đơn vị <span class="chu-phu">tỷ lệ thấp trước; tô nền: dưới mức chung của tỉnh (${ptVN(m.pt)})</span></h3>
      ${nCdt ? `${bangHtml(th.chuDauTu, { th, homNay, ptTinh: m.pt, an: du ? 0 : SO_DONG_CDT })}${nutDu}` : '<p class="chu-phu">Kỳ này chưa nhập bảng theo chủ đầu tư.</p>'}</section></div>`;
  return `<article class="the-bd n12 gn-tq" id="tqGiaiNgan">${dauKhoi(0, tieu, 'Lũy kế đã giải ngân so với kế hoạch vốn năm và tiến độ đều tới mục tiêu — bức tranh toàn tỉnh, rồi từng nhiệm vụ.', phai)}
    <div class="gn-tren">${tong}<div class="gn-xu-huong">${xuHuongHtml(th)}</div></div>${canCu}${canhBao}${bang}
    ${viecHtml(viecTheoDoi(rows, d.gan, th, homNay), { daLoc, soNgayMoi: k.ngay_so_lieu })}</article>`;   // v3.30: bỏ dòng "Cách tính" (chủ dự án 23/10/2026)
}

// Hành động tại chỗ (đăng ký ở index.js): mở đủ / thu gọn bảng chủ đầu tư.
export const hanhDongGn = (tq, ve) => ({ tqGnDu: () => { tq.ui.gnDu = !tq.ui.gnDu; ve(); } });
