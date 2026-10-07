// Chế độ "Nhiều nhiệm vụ từ một văn bản" của biểu mẫu Giao việc (v3.17, yêu cầu 7/10/2026 mục 1; v3.17.1 theo góp ý cùng ngày): mở với MỘT
// thẻ nhiệm vụ, bấm "Thêm nhiệm vụ" khi cần, tối đa 20; mỗi thẻ mang đủ ô của một việc (nhieu-the.js) — nội dung, chịu trách nhiệm, người theo
// dõi, phối hợp, độ khẩn, sản phẩm, mô tả, cấp nhận, loại thời hạn, hạn, ngành, lĩnh vực; phần còn lại của biểu mẫu (văn bản, nguồn, thay mặt,
// ngày giao, cấp quyết định, văn bản triển khai, ghi chú) dùng chung. Một giao dịch (giao_viec_nhieu — lỗi thẻ nào báo "Dòng n: …", không
// việc nào được tạo). Kiểm tra từng thẻ đúng quy tắc của chế độ một việc (doc-form.js kiemTra + pham-vi.js); DB vẫn là chốt.
import { $, show } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { danhMucKl } from '../../../lib/kl/du-lieu.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { parseOwner } from '../kl/them-owner.js';
import { thongBaoPhamVi, theoDoiHopLe } from './pham-vi.js';
import { phongCuaGiaTri, ngayBH, cheDoNhieu, laA0, nhuA0, canNganhHienTai } from './trang-thai.js';
import { o, taoThe, lamMoiThe, anHienThe, suKienThe } from './nhieu-the.js';

export const TOI_DA = 20;
// Ô của "một việc" ẩn khi ở chế độ nhiều (và ngược lại); vùng thẻ + chú thích khối 3 chỉ hiện ở chế độ nhiều.
const AN_KHI_NHIEU = ['gvQuyTac', 'klThNoiDungWrap', 'klThOwnerWrap', 'klThNguoiTheoDoiWrap', 'gvNhanhOwner', 'klThPhoiHopWrap', 'klThDoKhanWrap', 'gvGoiYCanBo',
  'klThSanPhamWrap', 'klThSanPhamMoTaWrap', 'klThCapNhanWrap', 'gvNhanhSanPham', 'klThLoaiWrap', 'klThHanWrap', 'gvNhanhHan', 'klThNganhWrap', 'klThLinhVucWrap', 'klThLuuTiep'];
// A0 (bản rút gọn) không có các ô này ở cả hai chế độ (cùng AN_A0 của index.js, phần giao với AN_KHI_NHIEU); klThLoaiWrap theo loại văn bản (index.js).
// Thay mặt Thường trực (v3.18): không ô người theo dõi (nhuA0), vẫn có "Giao, nhập tiếp".
const AN_A0 = ['klThNguoiTheoDoiWrap', 'gvGoiYCanBo', 'klThLuuTiep'];
const AN_NHU_A0 = ['klThNguoiTheoDoiWrap', 'gvGoiYCanBo'];
const HIEN_KHI_NHIEU = ['gvLuoiWrap', 'gvLuoiChuThich3'];

export const luoiTemplate = `
  <div id="gvLuoiWrap" class="hidden">
    <div id="gvLuoiThan" class="gv-nv-ds"></div>
    <div class="gv-luoi-chan"><button type="button" class="nut nho" id="gvThemDong" data-action="gvThemDong">+ Thêm nhiệm vụ</button>
      <small class="chu-phu" id="gvLuoiDem"></small></div>
    <small class="gv-chu-thich">Việc giao cho đơn vị ngoài Văn phòng (sở, ban, ngành, huyện): ghi rõ đơn vị thực hiện ngay trong nội dung, ví dụ "Sở Tài chính tham mưu…"; người chịu trách nhiệm là phòng / cán bộ Văn phòng theo dõi việc đó.</small>
  </div>`;

const than = () => $('gvLuoiThan');
const dongs = () => [...(than()?.querySelectorAll('.gv-nv') || [])];
const soDong = () => dongs().length;

function danhSoLai() {
  dongs().forEach((the, k) => {
    const i = String(k + 1); the.dataset.dong = i; the.setAttribute('aria-label', `Nhiệm vụ ${i}`); the.querySelector('.gvl-so').textContent = `Nhiệm vụ ${i}`;
    the.querySelectorAll('[aria-label*="nhiệm vụ "]').forEach((el) => el.setAttribute('aria-label', el.getAttribute('aria-label').replace(/nhiệm vụ \d+/, `nhiệm vụ ${i}`)));
    the.querySelector('.gvl-xoa').dataset.dong = i; the.querySelector('.gvl-xoa').disabled = soDong() === 1;
  });
  $('gvThemDong').disabled = soDong() >= TOI_DA;
  $('gvLuoiDem').textContent = `${soDong()} / ${TOI_DA} nhiệm vụ`;
}
export function themDong() {
  if (soDong() >= TOI_DA) return;
  const the = taoThe(than(), soDong() + 1);
  danhSoLai(); o(the, 'noi_dung').focus();
}
export function xoaDong({ dong }) {
  if (soDong() <= 1) return;
  dongs().find((the) => the.dataset.dong === String(dong))?.remove();
  danhSoLai();
  $('giaoViecForm').dispatchEvent(new Event('input', { bubbles: true }));
}
// Mở biểu mẫu: bỏ thẻ cũ; thẻ đầu chỉ tạo khi vào chế độ nhiều (datCheDo) — chế độ một việc không có thẻ ẩn trong DOM (ô độ khẩn, textarea… của biểu mẫu chính là duy nhất).
export function datLaiNhieu() { if (than()) than().innerHTML = ''; }
// Các thẻ vẽ lại theo ô chính / phạm vi (đổi người được thay mặt, danh mục, ngày ban hành) — giữ giá trị còn hợp lệ.
export function lamMoiLuaChonLuoi() { dongs().forEach(lamMoiThe); }
// Gắn một lần (registerGiaoViec): sự kiện của ô trong thẻ xử lý ở vùng chứa trước khi nổi lên form (capNhatTomTat).
export function ganSuKienNhieu() { ['change', 'input'].forEach((loai) => than().addEventListener(loai, suKienThe)); }

// Chuyển chế độ: data-che-do trên form, ẩn/hiện ô; mở vùng thẻ lần đầu thì một thẻ.
export function datCheDo(cheDo) {
  const nhieu = cheDo === 'nhieu';
  $('giaoViecForm').dataset.cheDo = nhieu ? 'nhieu' : 'mot';
  ['gvCheDoMot', 'gvCheDoNhieu'].forEach((id) => $(id).setAttribute('aria-selected', String((id === 'gvCheDoNhieu') === nhieu)));
  if (nhieu && !soDong()) themDong();
  if (!nhieu) { AN_KHI_NHIEU.forEach((id) => show(id, true)); if (laA0()) AN_A0.forEach((id) => show(id, false)); else if (nhuA0()) AN_NHU_A0.forEach((id) => show(id, false)); }
  anHienNhieu();
}
// Gọi sau mỗi lần vẽ lại (capNhatTomTat): các ô "một việc" / thẻ theo chế độ — thắng cả ẩn/hiện theo vai A0.
export function anHienNhieu() {
  const nhieu = cheDoNhieu();
  AN_KHI_NHIEU.forEach((id) => { if (nhieu) show(id, false); });
  HIEN_KHI_NHIEU.forEach((id) => show(id, nhieu));
  if (nhieu) dongs().forEach(anHienThe);
}

// Thiếu gì ở từng thẻ (theo thứ tự) — dòng "Còn thiếu"; hợp lệ khi không thiếu gì. Cùng quy tắc với conThieu() của chế độ một việc.
export function thieuNhieu() {
  const bh = ngayBH(); const dm = danhMucKl(); const a0 = nhuA0(); const cn = canNganhHienTai(); const tm = $('klThThayMat').value;   // a0: không người theo dõi
  return dongs().flatMap((the) => {
    const i = the.dataset.dong; const v = (c) => o(the, c).value;
    const owner = v('owner'); const han = v('han'); const kyBH = v('loai') === 'KY_BAN_HANH'; const nganh = v('nganh'); const lv = v('linh_vuc');
    const pv = owner ? thongBaoPhamVi(phongCuaGiaTri(owner), nganh, lv, dm.linhVuc) : { thieu: null };
    return [[!v('noi_dung').trim(), 'nội dung'], [!owner, 'người chịu trách nhiệm'], [!a0 && !v('theo_doi'), 'người theo dõi'], [!v('san_pham'), 'sản phẩm'],
      [!kyBH && !han, 'hạn hoàn thành'], [Boolean(han && bh) && han < bh, 'hạn sau ngày ban hành'], [cn && !nganh, 'ngành'], [cn && !lv, 'lĩnh vực'],
      [Boolean(pv.thieu), pv.thieu], [!a0 && !theoDoiHopLe(v('theo_doi'), tm, nganh, lv), 'người theo dõi thuộc phòng, lĩnh vực đồng chí phụ trách']]
      .filter(([t]) => t).map(([, n]) => `nhiệm vụ ${i}: ${n}`);
  });
}
export const duNhieu = () => thieuNhieu().length === 0;
export function loiNhieu() {
  const t = thieuNhieu();
  if (!t.length) return null;
  const [d, nd] = t[0].split(': ');
  return nd === 'hạn sau ngày ban hành' ? `${d}: hạn không được trước ngày ban hành (${formatNgay(ngayBH())}).` : `Còn thiếu ở ${d}: ${nd}.`;
}
// Tham số từng thẻ cho giao_viec_nhieu (mỗi thẻ ghi đè phần chung — cùng khoá với docForm của chế độ một việc). A0: DB tự suy người theo dõi;
// ngành / lĩnh vực chỉ gửi khi loại văn bản đòi (như docForm).
export function docDong() {
  const a0 = laA0(); const cn = canNganhHienTai();
  return dongs().map((the) => {
    const v = (c) => o(the, c).value; const ow = parseOwner(v('owner'), danhMucKl(), state.accounts);
    const d = { noi_dung: v('noi_dung').trim(), owner_don_vi_ma: ow.owner_don_vi_ma, owner_tai_khoan: ow.owner_tai_khoan, do_khan: v('do_khan'),
      san_pham_loai: v('san_pham') || null, san_pham_mo_ta: v('san_pham_mo_ta').trim() || null, cap_nhan_san_pham: v('cap_nhan') || null,
      loai_thoi_han_ma: v('loai'), han_xu_ly: v('loai') === 'KY_BAN_HANH' ? null : v('han') || null, don_vi_phoi_hop: v('phoi_hop').trim() || null };
    if (!a0 || cn) Object.assign(d, { nganh_ma: v('nganh') || null, linh_vuc_ma: v('linh_vuc') || null });
    if (!nhuA0()) d.nguoi_theo_doi = v('theo_doi') || null;   // A0 / thay mặt Thường trực: DB tự suy người theo dõi
    return d;
  });
}
// Tóm tắt chân tấm + xem trước thẻ việc (nhiệm vụ 1).
export function tomTatNhieu() {
  const ds = dongs(); const dau = ds[0];
  const nd = dau ? o(dau, 'noi_dung').value.trim() : '';
  const owner = dau && o(dau, 'owner').value ? o(dau, 'owner').selectedOptions[0]?.text : '…';
  return { so: ds.length, chu: `Giao ${ds.length} việc từ văn bản này — nhiệm vụ 1: "${nd ? nd.slice(0, 50) + (nd.length > 50 ? '…' : '') : '…'}" cho ${owner}`,
    noiDung: nd, owner, doKhan: dau ? o(dau, 'do_khan').value : 'THUONG', han: dau && o(dau, 'han').value ? formatNgay(o(dau, 'han').value) : '…', sanPham: dau && o(dau, 'san_pham').value ? o(dau, 'san_pham').selectedOptions[0]?.text : '…' };
}
