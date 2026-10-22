// Thẻ "Nhiệm vụ n" (n ≥ 2) của biểu mẫu Giao việc (v3.17.1; v3.18 gộp bố cục — thẻ 1 là bộ ô chính ở template.js): mỗi thẻ mang ĐỦ các ô của một
// việc, v3.27 xếp theo cột bảng Phụ lục — nội dung, chủ trì theo dõi, ngành/lĩnh vực, cơ quan trình, lĩnh vực chi tiết, loại thời hạn, hạn,
// sản phẩm, độ khẩn (v3.29: bỏ ô Lĩnh vực — ô ẩn [data-cot=linh_vuc] tự xác định, phan-loai.js); mục gập "Thêm": người theo dõi, đơn vị phối hợp, mô tả sản phẩm, cấp nhận —
// để một văn bản giao đủ mọi nhiệm vụ trong MỘT lượt dù khác phòng, khác lĩnh vực. Danh sách chọn, gợi ý người theo dõi / cấp nhận, lọc phạm vi
// dùng chung hàm với thẻ 1 (them-owner.js, pham-vi.js); ô Chịu trách nhiệm / Sản phẩm / Cấp nhận / Loại thời hạn sao chép lựa chọn của ô chính
// (đã lọc theo vai, thay mặt). Phần chung (văn bản, nguồn, thay mặt, ngày giao, thông tin thêm) ở biểu mẫu chính. Thẻ có data-dong (số thứ tự
// hiện, đánh lại khi xoá) và data-khoa (khoá cố định cho id ô); ô của thẻ nhận biết bằng data-cot.
import { $, show, escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { danhMucKl, cauHinhKl } from '../../../lib/kl/du-lieu.js';
import { congNgay, ghiChuHan } from '../../../lib/kl/ngay.js';
import { nutDoKhanHtml } from '../../../lib/kl/do-khan.js';
import { ganTimChon } from '../../../lib/tim-chon.js';
import { nguoiTheoDoiOptionsHtml, goiYTheoDoi, parseOwner } from '../kl/them-owner.js';
import { locTheoDoi, lanhDaoLoc, nganhDuocChon, linhVucDuocChon, thongBaoPhamVi } from './pham-vi.js';
import { phongCuaGiaTri, ngayBH, laA0, nhuA0, anTheoDoi, canNganhHienTai, getHomNay } from './trang-thai.js';
import { ganTheMucTieu } from './muc-tieu.js';   // v3.25: ô mục tiêu then chốt có gợi ý của thẻ
import { canNganhBatBuoc, nganhChoPhep, chuThichNganh, linhVucTuDong } from './phan-loai.js';   // v3.26: phân loại bắt buộc

const BB = '<b class="gv-bb" aria-hidden="true">*</b>';
const opt = (v, t) => `<option value="${escapeHtml(v)}">${escapeHtml(t)}</option>`;
export const o = (the, cot) => the.querySelector(`[data-cot="${cot}"]`);
const chuThich = (the, cot, chu) => { const el = the.querySelector(`[data-chu-thich="${cot}"]`); if (el) el.textContent = chu; };
// Ô chọn sao chép lựa chọn của ô chính: bỏ dấu ẩn do ô tìm nhanh của ô chính đặt — thẻ luôn đủ danh sách; giữ giá trị cũ nếu còn.
const giu = (s, html, cu) => {
  s.innerHTML = html; s.querySelectorAll('[hidden]').forEach((x) => { x.hidden = false; });
  if (cu && [...s.options].some((x) => x.value === cu)) s.value = cu;
};
const tim = new WeakMap();   // thẻ → { owner, theoDoi } (ô tìm nhanh, apLai sau khi vẽ lại <select>)

export function theHtml(k, i) {
  const id = (cot) => `gvl-${cot}-${k}`;
  const truong = (cot, nhan, oHtml, chu = '') => `<div class="gv-truong" data-wrap="${cot}"><label class="nhan" for="${id(cot)}">${nhan}</label>${oHtml}<small class="gv-chu-thich" data-chu-thich="${cot}">${chu}</small></div>`;
  const sel = (cot, nhan) => `<select id="${id(cot)}" class="o-nhap" data-cot="${cot}" aria-label="${nhan} nhiệm vụ ${i}"></select>`;
  const selTim = (cot, nhan) => `<div class="gv-tim-chon"><input type="search" id="${id(cot)}Tim" class="o-nhap" data-cot="${cot}_tim" placeholder="Gõ tên để tìm…" autocomplete="off" aria-controls="${id(cot)}" aria-label="Tìm nhanh ${nhan.toLowerCase()} nhiệm vụ ${i} (gõ tên hoặc phòng, không cần dấu)">${sel(cot, nhan)}</div>`;
  const inp = (cot, them) => `<input type="text" id="${id(cot)}" class="o-nhap" data-cot="${cot}" autocomplete="off"${them}>`;
  return `<article class="gv-nv" data-dong="${i}" data-khoa="${k}" aria-label="Nhiệm vụ ${i}">
    <header class="gv-nv-dau"><b class="gvl-so">Nhiệm vụ ${i}</b><button type="button" class="nut nho gvl-xoa" data-action="gvXoaDong" data-dong="${i}" title="Bỏ nhiệm vụ này">× Bỏ</button></header>
    ${truong('noi_dung', `Nội dung kết luận / Văn bản trình${BB}`, `<textarea id="${id('noi_dung')}" class="o-nhap" rows="2" data-cot="noi_dung" placeholder="Ghi rõ việc cần làm, phạm vi, yêu cầu…"></textarea>`)}
    <div class="cot-3">
      ${truong('owner', `Chủ trì theo dõi${BB}`, selTim('owner', 'Chủ trì theo dõi'), 'phòng hoặc cán bộ chịu trách nhiệm theo dõi việc')}
      ${truong('nganh', 'Ngành/lĩnh vực<b class="gv-bb gvl-bb-nganh" aria-hidden="true">*</b>', `${sel('nganh', 'Ngành/lĩnh vực')}<input type="hidden" id="${id('linh_vuc')}" data-cot="linh_vuc">`)}
      ${truong('co_quan_trinh', 'Cơ quan/đơn vị trình', sel('co_quan_trinh', 'Cơ quan/đơn vị trình'))}
    </div>
    <div class="cot-3">
      ${truong('lvct', 'Lĩnh vực chi tiết', inp('lvct', ' maxlength="200" placeholder="Ví dụ: Đầu tư công"'), 'không bắt buộc')}
      <div></div><div></div>
    </div>
    <div class="cot-3">
      ${truong('loai', 'Loại thời hạn', sel('loai', 'Loại thời hạn'))}
      ${truong('han', `Hạn xử lý<b class="gv-bb gvl-bb-han" aria-hidden="true">*</b>`, `<input type="date" id="${id('han')}" class="o-nhap" data-cot="han">`)}
      ${truong('san_pham', `Sản phẩm đầu ra${BB}`, sel('san_pham', 'Sản phẩm đầu ra'))}
    </div>
    <div class="gv-truong gv-dk"><span class="nhan">Độ khẩn</span>${nutDoKhanHtml(`do_khan_${k}`, nhuA0() ? 'KHAN' : 'THUONG', id('do_khan'))}</div>
    <details class="gv-nv-them" data-them="${k}"><summary>Thêm: người theo dõi, đơn vị phối hợp, mô tả sản phẩm, cấp nhận</summary>
      <div class="cot-3">
        ${truong('theo_doi', `Người theo dõi${BB}`, selTim('theo_doi', 'Người theo dõi'), 'tự gợi ý theo người chủ trì')}
        ${truong('phoi_hop', 'Đơn vị phối hợp', inp('phoi_hop', ' maxlength="300" placeholder="Sở Tài chính; Sở Nội vụ"'), 'không bắt buộc, cách nhau bằng dấu ;')}
        <div></div>
      </div>
      <div class="cot-3">
        ${truong('san_pham_mo_ta', 'Mô tả sản phẩm', inp('san_pham_mo_ta', ' placeholder="Ví dụ: Tờ trình đề án X"'))}
        ${truong('cap_nhan', 'Cấp nhận sản phẩm', sel('cap_nhan', 'Cấp nhận sản phẩm'), 'mặc định là cấp trên của chủ trì theo dõi')}
        <div></div>
      </div>
    </details>
    <div class="gv-mtg-cho" data-mtg-cho="gv-${k}"></div>
  </article>`;
}

export function dienOwnerThe(the) { giu(o(the, 'owner'), $('klThOwner').innerHTML, o(the, 'owner').value); tim.get(the)?.owner.apLai(); }
// Ngành: chỉ mục trong phạm vi giao ở phòng của chủ trì (như dienNganh / dienLinhVuc của biểu mẫu chính); đổi ngành → lĩnh vực (tự xác định) → người theo dõi.
export function dienNganhThe(the) {
  const cho = nganhDuocChon(phongCuaGiaTri(o(the, 'owner').value)); const s = o(the, 'nganh');
  giu(s, opt('', 'Chọn ngành/lĩnh vực') + danhMucKl().nganh.filter((n) => (!cho || cho.has(n.ma)) && nganhChoPhep(n)).map((n) => opt(n.ma, n.ten)).join(''), s.value);
  dienLinhVucThe(the);
}
export function dienLinhVucThe(the, chiKhiDoi = false) {
  const lv = o(the, 'linh_vuc'); const cu = lv.value;
  lv.value = linhVucTuDong({ nganh: o(the, 'nganh').value, chiTiet: o(the, 'lvct').value, noiDung: o(the, 'noi_dung').value, goiY: lv.dataset.goiY,
    cho: linhVucDuocChon(phongCuaGiaTri(o(the, 'owner').value)) });
  if (!chiKhiDoi || lv.value !== cu) dienTheoDoiThe(the);
}
// Người theo dõi: danh sách theo phạm vi (thay mặt, ngành, lĩnh vực của thẻ); giữ lựa chọn nếu còn hợp lệ, không thì gợi ý theo Owner, rồi lãnh đạo, rồi người giao.
export function dienTheoDoiThe(the) {
  const s = o(the, 'theo_doi'); const cu = s.value || state.user?.id;
  s.innerHTML = nguoiTheoDoiOptionsHtml(state.accounts, state.user);
  locTheoDoi(s, $('klThThayMat').value, o(the, 'nganh').value, o(the, 'linh_vuc').value);
  const goiY = goiYTheoDoi(o(the, 'owner').value, danhMucKl(), state.accounts, state.user);
  s.value = [cu, goiY, lanhDaoLoc($('klThThayMat').value)].find((v) => v && s.querySelector(`option[value="${v}"]`)) || s.options[0]?.value || '';
  tim.get(the)?.theoDoi.apLai();
}
function ownerTheDoi(the) {
  dienNganhThe(the);
  const { capMacDinh } = parseOwner(o(the, 'owner').value, danhMucKl(), state.accounts);
  if (capMacDinh) o(the, 'cap_nhan').value = capMacDinh;
  const goiY = goiYTheoDoi(o(the, 'owner').value, danhMucKl(), state.accounts, state.user);
  if (goiY && o(the, 'theo_doi').querySelector(`option[value="${goiY}"]`)) { o(the, 'theo_doi').value = goiY; tim.get(the)?.theoDoi.apLai(); }
}
// Hạn của thẻ: min = ngày ban hành; loại "Kỳ ban hành" tự tính (ngày ban hành + n) và khoá ô; chú thích còn bao nhiêu ngày.
export function capNhatHanThe(the) {
  const bh = ngayBH(); const kyBH = o(the, 'loai').value === 'KY_BAN_HANH'; const h = o(the, 'han'); const n = cauHinhKl('ky_ban_hanh_ngay', 10);
  h.min = bh || '';
  if (kyBH) h.value = bh ? congNgay(bh, n) : '';
  h.disabled = kyBH;
  show(the.querySelector('.gvl-bb-han'), !kyBH);
  chuThich(the, 'han', `${kyBH ? `tự tính = ngày ban hành + ${n}` : ''}${h.value ? `${kyBH ? ' · ' : ''}${ghiChuHan(h.value, getHomNay())}` : ''}`);
}
// Ẩn / hiện theo vai và loại văn bản (như AN_A0 / THEO_LOAI_A0 của biểu mẫu chính): A0 và thay mặt Thường trực (v3.18) không có người theo dõi;
// ngành, loại hạn của A0 chỉ với kết luận / thông báo; dấu * ngành theo loại văn bản; chú thích phạm vi (kiêm nhiệm) dưới ô Ngành/lĩnh vực.
export function anHienThe(the) {
  const a0 = laA0(); const cn = canNganhHienTai();
  show(the.querySelector('[data-wrap="theo_doi"]'), !anTheoDoi());   // 0085: chuyên viên giao thẳng cũng không có ô (theo dõi = người giao)
  if (!anTheoDoi() && !o(the, 'theo_doi').value) the.querySelector('.gv-nv-them').open = true;   // v3.27: ô bắt buộc trong mục "Thêm" còn trống → mở
  ['nganh', 'loai'].forEach((c) => show(the.querySelector(`[data-wrap="${c}"]`), !a0 || cn));
  the.querySelectorAll('.gvl-bb-nganh').forEach((b) => show(b, canNganhBatBuoc()));
  const pv = thongBaoPhamVi(phongCuaGiaTri(o(the, 'owner').value), o(the, 'nganh').value, o(the, 'linh_vuc').value, danhMucKl().linhVuc);
  chuThich(the, 'nganh', [chuThichNganh(), pv.chuThich].filter(Boolean).join(' · '));
}
// Vẽ lại các ô phụ thuộc ô chính / phạm vi (đổi người được thay mặt, danh mục, ngày ban hành) — giữ giá trị còn hợp lệ.
export function lamMoiThe(the) { dienOwnerThe(the); dienNganhThe(the); capNhatHanThe(the); anHienThe(the); }

let khoa = 0;
export function taoThe(container, i) {
  khoa += 1;
  container.insertAdjacentHTML('beforeend', theHtml(khoa, i));
  const the = container.lastElementChild;
  the.querySelector('.dk-chon input[type="hidden"]').dataset.cot = 'do_khan';
  [['san_pham', 'klThSanPham'], ['cap_nhan', 'klThCapNhan'], ['loai', 'klThLoai'], ['co_quan_trinh', 'klThCoQuanTrinh']].forEach(([cot, goc]) => { o(the, cot).innerHTML = $(goc).innerHTML; });
  o(the, 'loai').value = 'CO_HAN_CU_THE';
  tim.set(the, { owner: ganTimChon(o(the, 'owner_tim'), o(the, 'owner')), theoDoi: ganTimChon(o(the, 'theo_doi_tim'), o(the, 'theo_doi')) });
  lamMoiThe(the); ganTheMucTieu(the);
  return the;
}
// Sự kiện change / input nổi lên từ ô của thẻ (gắn một lần ở vùng chứa, trước khi tới form): chuỗi phụ thuộc Owner → ngành → lĩnh vực → người theo dõi, hạn theo loại.
export function suKienThe(e) {
  const the = e.target.closest('.gv-nv'); if (!the) return;
  const cot = e.target.dataset.cot;
  if (e.type === 'change') {
    if (cot === 'owner') ownerTheDoi(the);
    else if (cot === 'nganh') dienLinhVucThe(the);
    else if (cot === 'linh_vuc') dienLinhVucThe(the);   // ô ẩn: gợi ý AI (goiYLinhVuc)
    else if (cot === 'loai') capNhatHanThe(the);
  } else if (cot === 'han') capNhatHanThe(the);
  else if (cot === 'noi_dung' || cot === 'lvct') dienLinhVucThe(the, true);
  anHienThe(the);
}
