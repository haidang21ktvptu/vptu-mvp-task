// Bảng đề xuất của trợ lý AI (v3.27 — mục 5 yêu cầu 20/10/2026): mỗi nhiệm vụ một dòng sửa được ngay tại chỗ — nội dung, Chịu trách nhiệm, Sản phẩm
// đầu ra, Hạn hoàn thành (loại thời hạn + ngày), Cơ quan/đơn vị trình — "× Bỏ" riêng từng dòng (bỏ rồi lấy lại được); điền nhanh chịu trách nhiệm /
// hạn cho các dòng còn trống. Chỉ dựng HTML và ghi giá trị người giao sửa vào trạng thái của dòng (doc-ai.js giữ trạng thái, điền thẻ). Danh sách chọn
// chép từ ô của thẻ 1 (đã lọc theo vai, thay mặt) khi vẽ — quyền thật ở DB. Giá trị thuần: lib/kl/bang-de-xuat.js.
import { $, escapeHtml } from '../../../lib/dom.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { nhanXacMinh, laTrung } from '../../../lib/kl/dien-van-ban.js';

const esc = escapeHtml;
const BB = '<b class="gv-bb" aria-hidden="true">*</b>';
const rut = (t, n) => (String(t).length > n ? `${String(t).slice(0, n - 1)}…` : String(t));
const xm = (x) => { const [lop, ten] = nhanXacMinh(x); return `<span class="gv-xm ${lop}">${ten}</span>`; };
const nhan = (chu, title = '') => `<span class="gv-xm kiem"${title ? ` title="${esc(title)}"` : ''}>${chu}</span>`;
const ten = (ds, ma) => (ds || []).find((x) => x.ma === ma)?.ten || ma;
// Ô chọn: lựa chọn chép từ ô nguồn của thẻ 1 sau khi chèn HTML (napLuaChon), giá trị ở data-gt.
const chon = (cot, i, nguon, gt, nhanO) => `<select class="o-nhap" data-sua="${cot}" data-i="${i}" data-nguon="${nguon}" data-gt="${esc(gt || '')}" aria-label="${nhanO} — nhiệm vụ ${i + 1}"></select>`;

function dongSuaHtml(n, d, i, dm) {
  const nd = n.noi_dung || {};
  const nhanNd = [xm(nd.xac_minh), nd.con_tiep ? nhan(nd.cau_dan ? 'chỉ có câu dẫn' : 'chưa trọn câu', `Văn bản còn tiếp: “${nd.con_tiep}”`) : '',
    laTrung(n) ? nhan(`trùng nhiệm vụ ${n.trung_voi + 1}`) : '', n.tu_ra_soat ? nhan('hệ thống rà thấy') : ''].join('');
  const tron = nd.con_tiep && nd.xac_minh && !nd.cau_dan && d.noi_dung === nd.gia_tri
    ? `<small class="chu-phu">Câu trong văn bản còn tiếp “${esc(rut(nd.con_tiep, 160))}” — <button type="button" class="nut nho" data-action="gvDocBangTron" data-i="${i}">Dùng trọn câu</button></small>` : '';
  const hanGy = d.han_goi_y && !d.han && d.loai !== 'KY_BAN_HANH'
    ? `<button type="button" class="nut nho" data-action="gvDocBangHan" data-i="${i}" title="${esc(`Văn bản nêu: “${d.han_trich}” — chưa đối chiếu được ngày`)}">Dùng ${esc(formatNgay(d.han_goi_y))}</button>` : '';
  const phu = [n.trang ? `Trang ${esc(n.trang)}` : '', n.don_vi_chu_tri?.gia_tri ? `Chủ trì theo văn bản: ${esc(n.don_vi_chu_tri.gia_tri)}` : '',
    n.nganh?.gia_tri ? `Ngành: ${esc(ten(dm.nganh, n.nganh.gia_tri))}` : '', n.linh_vuc?.gia_tri ? `Lĩnh vực: ${esc(ten(dm.linhVuc, n.linh_vuc.gia_tri))}` : ''].filter(Boolean).join(' · ');
  return `<li class="gv-doc-nv gv-db" data-i="${i}">
    <div class="gv-db-dau"><b>Nhiệm vụ ${i + 1}</b>${nhanNd}<span class="gv-db-nut"><button type="button" class="nut nho chinh" data-action="gvDocDien" data-i="${i}">Điền vào thẻ</button>
      <button type="button" class="nut nho" data-action="gvDocBoDong" data-i="${i}" aria-label="Bỏ nhiệm vụ ${i + 1}">× Bỏ</button></span></div>
    <textarea class="o-nhap" rows="3" data-sua="noi_dung" data-i="${i}" aria-label="Nội dung — nhiệm vụ ${i + 1}">${esc(d.noi_dung)}</textarea>${tron}
    <div class="gv-db-o">
      <label><span class="nhan">Chịu trách nhiệm${BB}</span>${chon('owner', i, 'klThOwner', d.owner, 'Chịu trách nhiệm')}</label>
      <label><span class="nhan">Sản phẩm đầu ra${BB}</span>${chon('san_pham', i, 'klThSanPham', d.san_pham, 'Sản phẩm đầu ra')}</label>
      <div><span class="nhan">Hạn hoàn thành${BB}</span><span class="gv-db-han">${chon('loai', i, 'klThLoai', d.loai, 'Loại thời hạn')}
        <input type="date" class="o-nhap" data-sua="han" data-i="${i}" value="${esc(d.han)}" aria-label="Hạn hoàn thành — nhiệm vụ ${i + 1}"${d.loai === 'KY_BAN_HANH' ? ' hidden' : ''}></span>${hanGy}</div>
      <label><span class="nhan">Cơ quan/đơn vị trình</span>${chon('co_quan_trinh', i, 'klThCoQuanTrinh', d.co_quan_trinh, 'Cơ quan/đơn vị trình')}</label>
    </div>
    ${phu ? `<small class="chu-phu">${phu}</small>` : ''}</li>`;
}

// s: trạng thái doc-ai.js (kq, sua: [dòng], the: Map i → khoá thẻ, daGiao: Set i, tenThe(khoá)); dm: danh mục.
export function dongHtml(s, n, i, dm) {
  const d = s.sua[i] || { noi_dung: n.noi_dung?.gia_tri || '' };
  if (s.daGiao.has(i) || s.the.has(i)) {
    const tt = s.daGiao.has(i) ? 'đã giao' : `đã điền vào ${esc(s.tenThe(s.the.get(i)))} — sửa tiếp ở thẻ`;
    return `<li class="gv-doc-nv gv-db-gon${s.daGiao.has(i) ? ' xong' : ''}"><div class="gv-doc-nd"><p><b>Nhiệm vụ ${i + 1}.</b> ${esc(rut(d.noi_dung, 220))}</p></div>
      <span class="gv-doc-nv-nut"><small class="gv-doc-da">${tt}</small></span></li>`;
  }
  if (d.bo) {
    return `<li class="gv-doc-nv gv-db-gon bo"><div class="gv-doc-nd"><p><b>Nhiệm vụ ${i + 1} — đã bỏ${laTrung(n) ? ` (trùng nhiệm vụ ${n.trung_voi + 1})` : ''}:</b> ${esc(rut(d.noi_dung, 140))}</p></div>
      <span class="gv-doc-nv-nut"><button type="button" class="nut nho" data-action="gvDocLayLai" data-i="${i}">Lấy lại</button></span></li>`;
  }
  return dongSuaHtml(n, d, i, dm);
}
// Điền nhanh (từ 2 dòng còn điền được): chịu trách nhiệm, hạn chung → các dòng đang trống ô đó.
export const nhanhHtml = (so) => (so < 2 ? '' : `<div class="gv-db-nhanh"><span class="nhan">Điền nhanh các dòng còn trống</span>
  <select class="o-nhap" id="gvDbOwner" data-nguon="klThOwner" data-gt="" aria-label="Chịu trách nhiệm chung"></select>
  <input type="date" class="o-nhap" id="gvDbHan" aria-label="Hạn hoàn thành chung">
  <button type="button" class="nut nho" data-action="gvDocDienNhanh">Áp vào các dòng còn trống</button></div>`);

// Sau khi chèn HTML: chép lựa chọn từ ô nguồn (bỏ dấu ẩn của ô tìm nhanh), đặt giá trị của dòng.
export function napLuaChon(el) {
  el.querySelectorAll('select[data-nguon]').forEach((s) => {
    s.innerHTML = $(s.dataset.nguon)?.innerHTML || '';
    s.querySelectorAll('[hidden]').forEach((x) => { x.hidden = false; });
    s.value = [...s.options].some((x) => x.value === s.dataset.gt) ? s.dataset.gt : (s.options[0]?.value ?? '');
  });
}

// Gắn một lần vào khung kết quả: ô của bảng đổi → ghi vào dòng (không nổi lên biểu mẫu — tóm tắt, mục tiêu, "Còn thiếu" chỉ theo các thẻ);
// Enter trong ô ngày không gửi biểu mẫu Giao việc.
export function ganBang(el, dsDong) {
  const ghi = (e) => {
    const t = e.target; if (!t?.closest?.('.gv-doc-kq')) return;
    if (t.dataset.sua || t.id === 'gvDbOwner' || t.id === 'gvDbHan') e.stopPropagation();
    const cot = t.dataset.sua; const d = dsDong()[Number(t.dataset.i)]; if (!cot || !d) return;
    d[cot] = t.value; d.sua?.add(cot);
    if (cot === 'loai') { const h = t.closest('.gv-db')?.querySelector('[data-sua="han"]'); if (h) h.hidden = t.value === 'KY_BAN_HANH'; }
  };
  el.addEventListener('input', ghi); el.addEventListener('change', ghi);
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target?.tagName === 'INPUT') e.preventDefault(); });
}
