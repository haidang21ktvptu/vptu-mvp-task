// Chế độ "Nhiều nhiệm vụ từ một văn bản" của biểu mẫu Giao việc (v3.17, yêu cầu 7/10/2026 mục 1): lưới tối giản — mở với MỘT dòng, bấm
// "Thêm dòng" khi cần, tối đa 20 dòng; mỗi dòng = Nội dung · Người chịu trách nhiệm · Sản phẩm · Hạn hoàn thành; phần còn lại của biểu mẫu
// (văn bản, nguồn, người theo dõi, thay mặt, độ khẩn, ngày giao, ngành / lĩnh vực, cấp quyết định, ghi chú) dùng chung. Một giao dịch
// (giao_viec_nhieu — lỗi dòng nào báo "Dòng n: …", không việc nào được tạo). Cấp nhận sản phẩm mỗi dòng = cấp trên của người chịu trách nhiệm.
import { $, show } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { danhMucKl } from '../../../lib/kl/du-lieu.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { parseOwner } from '../kl/them-owner.js';
import { thongBaoPhamVi } from './pham-vi.js';
import { phongCuaGiaTri, ngayBH, cheDoNhieu, laA0 } from './trang-thai.js';

export const TOI_DA = 20;
// Ô của "một việc" ẩn khi ở chế độ nhiều (và ngược lại); lưới + chú thích khối 3 chỉ hiện ở chế độ nhiều.
const AN_KHI_NHIEU = ['gvQuyTac', 'klThNoiDungWrap', 'klThOwnerWrap', 'gvNhanhOwner', 'klThPhoiHopWrap', 'klThSanPhamWrap', 'klThSanPhamMoTaWrap', 'klThCapNhanWrap',
  'gvNhanhSanPham', 'klThLoaiWrap', 'klThHanWrap', 'gvNhanhHan', 'klThLuuTiep'];
const AN_A0 = ['klThLuuTiep'];   // A0 (bản rút gọn) không có "Giao, nhập tiếp" ở cả hai chế độ; klThLoaiWrap theo loại văn bản (index.js)
const HIEN_KHI_NHIEU = ['gvLuoiWrap', 'gvLuoiChuThich3'];

export const luoiTemplate = `
  <div id="gvLuoiWrap" class="hidden">
    <div class="gv-luoi-cuon"><table class="gv-luoi" aria-label="Các nhiệm vụ giao từ văn bản này">
      <thead><tr><th>#</th><th>Nội dung nhiệm vụ<b class="gv-bb" aria-hidden="true">*</b></th><th>Chịu trách nhiệm<b class="gv-bb" aria-hidden="true">*</b></th><th>Sản phẩm<b class="gv-bb" aria-hidden="true">*</b></th><th>Hạn hoàn thành<b class="gv-bb" aria-hidden="true">*</b></th><th></th></tr></thead>
      <tbody id="gvLuoiThan"></tbody></table></div>
    <div class="gv-luoi-chan"><button type="button" class="nut nho" id="gvThemDong" data-action="gvThemDong">+ Thêm dòng</button>
      <small class="chu-phu" id="gvLuoiDem"></small></div>
    <small class="gv-chu-thich">Việc giao cho đơn vị ngoài Văn phòng (sở, ban, ngành, huyện): ghi rõ đơn vị thực hiện ngay trong nội dung, ví dụ "Sở Tài chính tham mưu…"; người chịu trách nhiệm là phòng / cán bộ Văn phòng theo dõi việc đó.</small>
  </div>`;

const than = () => $('gvLuoiThan');
// Ô chọn của dòng sao chép lựa chọn của ô chính; bỏ dấu ẩn do ô tìm nhanh (lib/tim-chon.js) đặt — lưới luôn đủ danh sách.
const boAn = (el) => el.querySelectorAll('[hidden]').forEach((x) => { x.hidden = false; });
const dongs = () => [...(than()?.querySelectorAll('tr') || [])];
const o = (tr, cot) => tr.querySelector(`[data-cot="${cot}"]`);
const soDong = () => dongs().length;

function dongHtml(i) {
  return `<tr data-dong="${i}"><td class="gvl-so">${i}</td>
    <td><textarea class="o-nhap" rows="2" data-cot="noi_dung" aria-label="Nội dung nhiệm vụ dòng ${i}" placeholder="Ghi rõ việc cần làm, phạm vi, yêu cầu…"></textarea></td>
    <td><select class="o-nhap" data-cot="owner" aria-label="Người chịu trách nhiệm dòng ${i}">${$('klThOwner').innerHTML}</select></td>
    <td><select class="o-nhap" data-cot="san_pham" aria-label="Sản phẩm dòng ${i}">${$('klThSanPham').innerHTML}</select></td>
    <td><input type="date" class="o-nhap" data-cot="han" aria-label="Hạn hoàn thành dòng ${i}"></td>
    <td><button type="button" class="nut nho gvl-xoa" data-action="gvXoaDong" data-dong="${i}" aria-label="Xoá dòng ${i}" title="Xoá dòng">×</button></td></tr>`;
}
function danhSoLai() {
  dongs().forEach((tr, k) => {
    const i = k + 1; tr.dataset.dong = String(i); tr.querySelector('.gvl-so').textContent = String(i);
    tr.querySelector('.gvl-xoa').dataset.dong = String(i); tr.querySelector('.gvl-xoa').disabled = soDong() === 1;
  });
  $('gvThemDong').disabled = soDong() >= TOI_DA;
  $('gvLuoiDem').textContent = `${soDong()} / ${TOI_DA} dòng`;
}
export function themDong() {
  if (soDong() >= TOI_DA) return;
  than().insertAdjacentHTML('beforeend', dongHtml(soDong() + 1));
  const tr = dongs().at(-1); boAn(tr); o(tr, 'han').min = ngayBH() || '';
  danhSoLai(); o(tr, 'noi_dung').focus();
}
export function xoaDong({ dong }) {
  if (soDong() <= 1) return;
  dongs().find((tr) => tr.dataset.dong === String(dong))?.remove();
  danhSoLai();
  $('giaoViecForm').dispatchEvent(new Event('input', { bubbles: true }));
}
export function datLaiNhieu() { if (than()) { than().innerHTML = ''; themDong(); } }
// Ô chọn của các dòng vẽ lại theo ô Chịu trách nhiệm / Sản phẩm chính (đổi người được thay mặt, danh mục) — giữ giá trị còn hợp lệ.
export function lamMoiLuaChonLuoi() {
  dongs().forEach((tr) => {
    [['owner', 'klThOwner'], ['san_pham', 'klThSanPham']].forEach(([cot, goc]) => {
      const s = o(tr, cot); const cu = s.value; s.innerHTML = $(goc).innerHTML; boAn(s);
      if ([...s.options].some((x) => x.value === cu)) s.value = cu;
    });
    o(tr, 'han').min = ngayBH() || '';
  });
}

// Chuyển chế độ: data-che-do trên form, ẩn/hiện ô; mở lưới lần đầu thì một dòng.
export function datCheDo(cheDo) {
  const nhieu = cheDo === 'nhieu';
  $('giaoViecForm').dataset.cheDo = nhieu ? 'nhieu' : 'mot';
  ['gvCheDoMot', 'gvCheDoNhieu'].forEach((id) => $(id).setAttribute('aria-selected', String((id === 'gvCheDoNhieu') === nhieu)));
  if (nhieu && !soDong()) themDong();
  if (!nhieu) { AN_KHI_NHIEU.forEach((id) => show(id, true)); if (laA0()) AN_A0.forEach((id) => show(id, false)); }
  anHienNhieu();
}
// Gọi sau mỗi lần vẽ lại (capNhatTomTat): các ô "một việc" / lưới theo chế độ — thắng cả ẩn/hiện theo vai A0.
export function anHienNhieu() {
  const nhieu = cheDoNhieu();
  AN_KHI_NHIEU.forEach((id) => { if (nhieu) show(id, false); });
  HIEN_KHI_NHIEU.forEach((id) => show(id, nhieu));
}

// Thiếu gì ở từng dòng (theo thứ tự dòng) — dòng "Còn thiếu"; hợp lệ khi không thiếu gì.
export function thieuNhieu() {
  const bh = ngayBH(); const dm = danhMucKl();
  return dongs().flatMap((tr) => {
    const i = tr.dataset.dong; const owner = o(tr, 'owner').value; const han = o(tr, 'han').value;
    const pv = owner ? thongBaoPhamVi(phongCuaGiaTri(owner), $('klThNganh').value, $('klThLinhVuc').value, dm.linhVuc) : { thieu: null };
    return [[!o(tr, 'noi_dung').value.trim(), 'nội dung'], [!owner, 'người chịu trách nhiệm'], [!o(tr, 'san_pham').value, 'sản phẩm'], [!han, 'hạn hoàn thành'],
      [Boolean(han && bh) && han < bh, 'hạn sau ngày ban hành'], [Boolean(pv.thieu), pv.thieu]].filter(([t]) => t).map(([, n]) => `dòng ${i}: ${n}`);
  });
}
export const duNhieu = () => thieuNhieu().length === 0;
export function loiNhieu() {
  const t = thieuNhieu();
  if (!t.length) return null;
  const [d, nd] = t[0].split(': ');
  return nd === 'hạn sau ngày ban hành' ? `${d}: hạn không được trước ngày ban hành (${formatNgay(ngayBH())}).` : `Còn thiếu ở ${d}: ${nd}.`;
}
// Tham số từng dòng cho giao_viec_nhieu (cấp nhận = cấp trên của người chịu trách nhiệm, như ô Cấp nhận ở chế độ một việc).
export function docDong() {
  return dongs().map((tr) => {
    const ow = parseOwner(o(tr, 'owner').value, danhMucKl(), state.accounts);
    return { noi_dung: o(tr, 'noi_dung').value.trim(), owner_don_vi_ma: ow.owner_don_vi_ma, owner_tai_khoan: ow.owner_tai_khoan,
      san_pham_loai: o(tr, 'san_pham').value || null, han_xu_ly: o(tr, 'han').value || null, cap_nhan_san_pham: ow.capMacDinh || null };
  });
}
// Tóm tắt chân tấm + xem trước thẻ (dòng đầu).
export function tomTatNhieu() {
  const ds = dongs(); const dau = ds[0];
  const nd = dau ? o(dau, 'noi_dung').value.trim() : '';
  const owner = dau && o(dau, 'owner').value ? o(dau, 'owner').selectedOptions[0]?.text : '…';
  return { so: ds.length, chu: `Giao ${ds.length} việc từ văn bản này — dòng 1: "${nd ? nd.slice(0, 50) + (nd.length > 50 ? '…' : '') : '…'}" cho ${owner}`,
    noiDung: nd, owner, han: dau && o(dau, 'han').value ? formatNgay(o(dau, 'han').value) : '…', sanPham: dau && o(dau, 'san_pham').value ? o(dau, 'san_pham').selectedOptions[0]?.text : '…' };
}
