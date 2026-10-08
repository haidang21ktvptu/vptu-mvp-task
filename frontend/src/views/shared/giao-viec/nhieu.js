// Thẻ nhiệm vụ 2…20 của biểu mẫu Giao việc (v3.17: chế độ "Nhiều nhiệm vụ từ một văn bản"; v3.18 gộp bố cục — quyết định 8/10/2026: khối 2 luôn là
// các thẻ, thẻ "Nhiệm vụ 1" là bộ ô chính của biểu mẫu (template.js, index.js), thẻ thêm dựng ở đây bằng nhieu-the.js, bấm "+ Thêm nhiệm vụ", tối đa
// 20 thẻ kể cả thẻ 1). Mỗi thẻ mang đủ ô của một việc; phần chung (văn bản, nguồn, thay mặt, ngày giao, thông tin thêm) ở biểu mẫu chính. Có thẻ
// thêm → một giao dịch giao_viec_nhieu (dòng 1 = thẻ chính; lỗi thẻ nào báo "Dòng n: …", không việc nào được tạo). Kiểm tra từng thẻ đúng quy tắc
// của thẻ chính (doc-form.js kiemTra + pham-vi.js); DB vẫn là chốt.
import { $, show } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { danhMucKl } from '../../../lib/kl/du-lieu.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { parseOwner } from '../kl/them-owner.js';
import { thongBaoPhamVi, theoDoiHopLe } from './pham-vi.js';
import { phongCuaGiaTri, ngayBH, laA0, nhuA0, anTheoDoi, laA3GiaoThang, canNganhHienTai } from './trang-thai.js';
import { o, taoThe, lamMoiThe, anHienThe, suKienThe } from './nhieu-the.js';

export const TOI_DA = 20;   // kể cả thẻ 1

export const luoiTemplate = `
  <div id="gvLuoiWrap">
    <div id="gvLuoiThan" class="gv-nv-ds"></div>
    <div class="gv-luoi-chan"><button type="button" class="nut nho" id="gvThemDong" data-action="gvThemDong">+ Thêm nhiệm vụ</button>
      <small class="chu-phu" id="gvLuoiDem"></small></div>
  </div>`;

const than = () => $('gvLuoiThan');
const dongs = () => [...(than()?.querySelectorAll('.gv-nv') || [])];
export const soThem = () => dongs().length;          // số thẻ thêm (ngoài thẻ 1)
export const coThem = () => soThem() > 0;
export const soThe = () => soThem() + 1;             // tổng số nhiệm vụ của lượt giao

function danhSoLai() {
  dongs().forEach((the, k) => {
    const i = String(k + 2); the.dataset.dong = i; the.setAttribute('aria-label', `Nhiệm vụ ${i}`); the.querySelector('.gvl-so').textContent = `Nhiệm vụ ${i}`;
    the.querySelectorAll('[aria-label*="nhiệm vụ "]').forEach((el) => el.setAttribute('aria-label', el.getAttribute('aria-label').replace(/nhiệm vụ \d+/, `nhiệm vụ ${i}`)));
    the.querySelector('.gvl-xoa').dataset.dong = i;
  });
  $('gvThemDong').disabled = soThe() >= TOI_DA;
  $('gvLuoiDem').textContent = `${soThe()} / ${TOI_DA} nhiệm vụ`;
}
export function themDong() {
  if (soThe() >= TOI_DA) return;
  const the = taoThe(than(), soThe() + 1);
  danhSoLai(); o(the, 'noi_dung').focus();
}
export function xoaDong({ dong }) {
  dongs().find((the) => the.dataset.dong === String(dong))?.remove();
  danhSoLai();
  $('giaoViecForm').dispatchEvent(new Event('input', { bubbles: true }));
}
// Mở biểu mẫu: bỏ thẻ thêm của lượt trước, về một thẻ.
export function datLaiNhieu() { if (than()) { than().innerHTML = ''; danhSoLai(); } }
// Các thẻ vẽ lại theo ô chính / phạm vi (đổi người được thay mặt, danh mục, ngày ban hành) — giữ giá trị còn hợp lệ.
export function lamMoiLuaChonLuoi() { dongs().forEach(lamMoiThe); }
// Vào / rời thay mặt Thường trực (v3.18): thẻ đang ở mức mặc định cũ chuyển sang mức mặc định mới (thẻ người dùng đã chọn mức khác giữ nguyên).
export function doiDoKhanMacDinhNhieu(tu, den) {
  dongs().forEach((the) => { const h = o(the, 'do_khan'); if (h.value !== tu) return; h.value = den; the.querySelectorAll('.dk-chon button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.giaTri === den))); });
}
// Gắn một lần (registerGiaoViec): sự kiện của ô trong thẻ xử lý ở vùng chứa trước khi nổi lên form (capNhatTomTat).
export function ganSuKienNhieu() { ['change', 'input'].forEach((loai) => than().addEventListener(loai, suKienThe)); }
// Gọi sau mỗi lần vẽ lại (capNhatTomTat): ẩn / hiện trong từng thẻ theo vai, loại văn bản; "Giao, nhập tiếp" chỉ khi một thẻ (và không phải A0).
export function anHienNhieu() {
  dongs().forEach(anHienThe);
  show('klThLuuTiep', !coThem() && !laA0());
}

// Thiếu gì ở từng thẻ thêm (theo thứ tự) — dòng "Còn thiếu"; hợp lệ khi không thiếu gì. Cùng quy tắc với conThieu() của thẻ 1 (index.js).
export function thieuNhieu() {
  const bh = ngayBH(); const dm = danhMucKl(); const a0 = anTheoDoi(); const cn = canNganhHienTai(); const tm = $('klThThayMat').value;   // a0: không ô người theo dõi (Thường trực giao / chuyên viên giao thẳng)
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
// Tham số các thẻ thêm cho giao_viec_nhieu (mỗi thẻ ghi đè phần chung — cùng khoá với dòng 1 tách từ docForm, doc-form.js tachDong). A0 / thay mặt
// Thường trực: DB tự suy người theo dõi; ngành / lĩnh vực của A0 chỉ gửi khi loại văn bản đòi (như docForm).
export function docDong() {
  const a0 = laA0(); const cn = canNganhHienTai();
  return dongs().map((the) => {
    const v = (c) => o(the, c).value; const ow = parseOwner(v('owner'), danhMucKl(), state.accounts);
    const d = { noi_dung: v('noi_dung').trim(), owner_don_vi_ma: ow.owner_don_vi_ma, owner_tai_khoan: ow.owner_tai_khoan, do_khan: v('do_khan'),
      san_pham_loai: v('san_pham') || null, san_pham_mo_ta: v('san_pham_mo_ta').trim() || null, cap_nhan_san_pham: v('cap_nhan') || null,
      loai_thoi_han_ma: v('loai'), han_xu_ly: v('loai') === 'KY_BAN_HANH' ? null : v('han') || null, don_vi_phoi_hop: v('phoi_hop').trim() || null };
    if (!a0 || cn) Object.assign(d, { nganh_ma: v('nganh') || null, linh_vuc_ma: v('linh_vuc') || null });
    if (!nhuA0()) d.nguoi_theo_doi = laA3GiaoThang() ? state.user?.id || null : v('theo_doi') || null;   // 0085: chuyên viên giao thẳng — theo dõi = người giao
    return d;
  });
}
