// Ngăn chi tiết bên phải (v8 đợt 3: cố định 520px — đầu mã + nhãn + nội dung + văn bản, lưới 2 cột, hàng nút, chỉ đạo, minh chứng, diễn biến nền màu; thứ tự của mọi vai: thông tin then chốt → hành động → khối chỉ đạo → minh chứng → chi tiết và lịch sử
// gập). Căn cứ từng trường từ lich_su (RLS theo phạm vi thấy nhiệm vụ); đính chính đang chờ; nguồn dòng. Một ngăn cho cả danh sách:
// #klChiTiet chứa <div id="klChiTiet-<id>"> của việc đang chọn; toggleKlChiTiet({id, cheDo}) mở việc (cheDo 'chi-dao' → con trỏ vào ô nhập).
import { $, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { state, findAccount } from '../../../lib/state.js';
import { notifyError } from '../../../components/toast.js';
import { loadLichSu, loadDinhChinhCho, tenTrongDanhMuc, danhMucKl } from '../../../lib/kl/du-lieu.js';
import { formatNgay, ngayTruoc, homNayVN } from '../../../lib/kl/ngay.js';
import { nhanTrangThai, TEN_NGUON, tenCot, boSoThuTu, nhomCua, laBenNop } from '../../../lib/kl/nhan.js';
import { soNgayLamViec } from '../../../lib/kl/han-nop.js';
import { nhanPhuHtml } from '../../../lib/kl/do-khan.js';
import { napDienBien } from '../dien-bien.js';
import { timKlRow } from './danh-sach.js';
import { sanPhamText, laBenTrong, duocCapNhat, duocDong, ownerText } from './dong.js';
import { napChiDao, focusChiDao, duocChiDao } from './chi-dao.js';
import { napMinhChung } from './minh-chung.js';

const DANH_MUC_COT = { tien_do_ma: 'tienDo', loai_thoi_han_ma: 'loaiThoiHan', nganh_ma: 'nganh', linh_vuc_ma: 'linhVuc', owner_don_vi_ma: 'donVi',
  san_pham_loai: 'sanPham', cap_nhan_san_pham: 'cap', cap_quyet_dinh: 'cap' };
const COT_NGAY = ['han_xu_ly', 'ngay_hoan_thanh', 'ngay_nhan_van_ban', 'han_nop_minh_chung'];
const COT_TAI_KHOAN = ['nguoi_theo_doi', 'owner_tai_khoan'];

export function hienGiaTri(cot, v) {
  if (v === null || v === undefined || v === '') return '(trống)';
  if (DANH_MUC_COT[cot]) return tenTrongDanhMuc(DANH_MUC_COT[cot], v);
  if (COT_NGAY.includes(cot)) return formatNgay(v);
  if (COT_TAI_KHOAN.includes(cot)) return findAccount(v)?.full_name || v;
  if (cot === 'ngay_nhan_uoc_tinh' || cot === 'theo_1400' || cot === 'bi_tu_choi') return v === 'true' || v === true ? 'có' : 'không';
  return String(v);
}
const tenNguoi = (l) => findAccount(l.nguoi_sua)?.full_name || l.nguoi_sua_ghi_chu || (l.nguon === 'excel' ? 'không xác định (nhật ký Excel)' : 'hệ thống');

function canCu(cot, ls) {
  const l = ls.find((x) => x.cot === cot) || ls.find((x) => x.cot === '*');
  if (!l) return '<span class="chu-phu">không có nhật ký</span>';
  if (l.cot === '*') return `<span class="chu-phu">giữ nguyên từ lúc tạo dòng ${formatDateTime(l.luc)} · ${TEN_NGUON[l.nguon] || l.nguon}${l.nguoi_sua ? `, bởi ${escapeHtml(tenNguoi(l))}` : ''}</span>`;
  return `<span class="chu-phu">nhập bởi ${escapeHtml(tenNguoi(l))}, ${formatDateTime(l.luc)} · ${TEN_NGUON[l.nguon] || l.nguon}</span>`;
}
const hang = (nhan, giaTri, canCuHtml) => `<tr><th scope="row">${nhan}</th><td>${escapeHtml(giaTri)}</td><td>${canCuHtml}</td></tr>`;

// Cấp cần quyết định: A1/A2 chọn tại chỗ (dat_cap_quyet_dinh 0026, CN-5.2(4)); vai khác chỉ đọc.
function capQuyetHtml(r) {
  if (!duocChiDao() || !nhomCua(r.nhom_dem).mo) return escapeHtml(r.cap_quyet_dinh_ten || 'chưa xác định');
  const opt = (v, t, chon) => `<option value="${escapeHtml(v)}"${chon ? ' selected' : ''}>${escapeHtml(t)}</option>`;
  return `<select class="o-nhap nho nl-cap" data-id="${r.id}" aria-label="Cấp cần quyết định của ${escapeHtml(r.ma)}">${opt('', 'chưa xác định', !r.cap_quyet_dinh)}${danhMucKl().cap.map((c) => opt(c.ma, c.ten, r.cap_quyet_dinh === c.ma)).join('')}</select>`;
}

// Nút hành động trong ngăn (ẩn/hiện cho đẹp; hàm DB / policy là chốt).
function hanhDongHtml(r) {
  const mo = nhomCua(r.nhom_dem).mo;
  const nut = (action, nhan, lop = '', them = '') => `<button type="button" class="nut ${lop}" data-action="${action}" data-id="${r.id}" ${them}>${nhan}</button>`;
  const coMC = (r.so_minh_chung_hop_le || 0) > 0;
  // Từ chối (0034): cạnh "Xác nhận đã nhận việc", chỉ khi chưa xác nhận và chưa có đề nghị chờ duyệt; lý do bắt buộc, chỉ cấp duyệt và cấp trên đọc.
  const tuChoi = laBenTrong(r) && mo && !r.toi_da_xac_nhan && !r.tu_choi_cho; // chính tôi chưa nhận
  // Giao tiếp xuống (v8 đợt 4): chủ trì hoặc người theo dõi của việc chưa hoàn thành, và vai được giao việc (A1/A2/quan_tri_kl — giao_viec là chốt).
  const giaoTiep = mo && (r.owner_tai_khoan === state.user?.id || r.nguoi_theo_doi === state.user?.id) && (['A1', 'A2'].includes(state.user?.role_group) || Boolean(state.user?.quan_tri_kl));
  // PR-2b: đặt / sửa hạn nộp — người giao còn hoạt động và còn vai A0/A1/A2; không thì quan_tri_kl (Q4, mở rộng 0061). dat_han_nop_minh_chung là chốt.
  const giao = findAccount(r.giao_thay_mat_cho || r.tao_boi);
  const conNguoiGiao = Boolean(giao) && !giao.bi_khoa && !giao.is_system && ['A0', 'A1', 'A2'].includes(giao.role_group);
  const suaHan = mo && r.han_xu_ly && (conNguoiGiao ? giao.id === state.user?.id : Boolean(state.user?.quan_tri_kl));
  return `<div class="hanh-dong">
    ${laBenTrong(r) && mo && !r.toi_da_xac_nhan ? nut('xacNhanNhanViec', 'Xác nhận đã nhận việc', 'lam') : ''}
    ${tuChoi ? nut('moO', 'Từ chối', '', `data-o="oTcNgan-${r.id}"`) : ''}
    ${duocCapNhat(r) && mo ? nut('openKlCapNhat', 'Cập nhật') : ''}
    ${duocDong(r) && mo && !r.han_nop_minh_chung ? nut('openDongNhiemVu', 'Đóng nhiệm vụ', 'chinh', coMC ? '' : 'disabled title="Cần ít nhất một minh chứng hợp lệ (số hiệu, ngày văn bản, cấp nhận)"') : ''}
    ${suaHan ? nut('moO', r.han_nop_minh_chung ? 'Sửa hạn nộp minh chứng' : 'Đặt hạn nộp minh chứng', '', `data-o="oHnNgan-${r.id}"`) : ''}
    ${giaoTiep ? nut('giaoTiepXuong', 'Giao tiếp xuống', '', `id="klGiaoTiep-${r.id}"`) : ''}
    <button type="button" class="nut" data-action="dongKlChiTiet">Đóng ngăn</button></div>
    ${tuChoi ? `<form class="o" id="oTcNgan-${r.id}" data-submit="tuChoiNhanViec" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">
      <small>Lý do chỉ lãnh đạo trực tiếp và cấp trên đọc được; hạn và trạng thái việc không đổi cho tới khi được duyệt.</small>
      <input name="noi_dung" required placeholder="Lý do từ chối (bắt buộc)" aria-label="Lý do từ chối">
      <button type="submit" class="nut chinh">Gửi đề nghị</button><button type="button" class="nut" data-action="dongO" data-o="oTcNgan-${r.id}">Huỷ</button></form>` : ''}
    ${suaHan ? `<form class="o" id="oHnNgan-${r.id}" data-submit="suaHanNop" data-id="${r.id}">
      <small>Chỉ người giao sửa; lý do bắt buộc và ghi vào lịch sử, chủ trì và người theo dõi nhận thông báo. Hạn nộp phải trước hạn hoàn thành ít nhất một ngày làm việc (sát hơn: lý do là lý do việc gấp).</small>
      <input type="date" name="han" required min="${homNayVN()}"${r.han_xu_ly >= homNayVN() ? ` max="${r.han_xu_ly}"` : ''} aria-label="Hạn nộp minh chứng mới" value="${r.han_nop_minh_chung || ''}">
      <input name="ly_do" required maxlength="500" placeholder="Lý do sửa (bắt buộc)" aria-label="Lý do sửa hạn nộp">
      <button type="submit" class="nut chinh">Lưu hạn nộp</button><button type="button" class="nut" data-action="dongO" data-o="oHnNgan-${r.id}">Huỷ</button></form>` : ''}`;
}

export function chiTietHtml(r, ls, dc) {
  const capNhat = ngayTruoc(r.cap_nhat_luc);
  const nguonDong = r.nguon === 'excel' ? 'Nhập từ Excel' : 'Nhập trên hệ thống';
  const dinhChinh = dc.length === 0 ? 'chưa có' : dc.map((d) => `${tenCot(d.cot)}: ${hienGiaTri(d.cot, d.gia_tri_cu)} → ${hienGiaTri(d.cot, d.gia_tri_moi)} (${d.ly_do})`).join('; ');
  const nhanViec = ls.filter((l) => l.cot === 'xac_nhan_nhan_viec');
  const hanLop = r.nhom_dem === 'QUA_HAN' || r.nhom_dem === 'DANG_DINH_CHINH' ? ' style="color:var(--do)"' : '';
  const me = state.user?.id;
  const lopTT = r.nhom_dem === 'HOAN_THANH' ? 'tt-xong' : r.nhom_dem === 'CHAM_NOP_MINH_CHUNG' ? 'tt-cam' : laBenNop(r, me) ? 'tt-cho'
    : ['QUA_HAN', 'QUA_HAN_NGHIEM_THU'].includes(r.nhom_dem) ? 'tt-qua' : 'tt-cho';
  const nhanTT = `<span class="trang-thai ${lopTT}">${nhanTrangThai(r, me)}</span>`; // nhãn đã kèm số ngày trễ; người nộp: nhãn trung tính (Mới 2)
  const nSao = r.han_nop_hieu_luc || r.han_nop_minh_chung;
  const hanNop = nSao ? `${formatNgay(nSao)}${r.han_nop_hieu_luc && r.han_nop_hieu_luc !== r.han_nop_minh_chung ? ' (hạn nộp lại)' : ''} <span class="chu-phu" id="klHanNopCon-${r.id}"></span>${r.ly_do_han_nop_sat ? ` — việc gấp: ${escapeHtml(r.ly_do_han_nop_sat)}` : ''}` : '';
  const o = (nhan, gt) => `<div><dt>${nhan}</dt><dd>${gt}</dd></div>`;
  return `<div id="klChiTiet-${r.id}" class="chi-tiet-noi" data-nhom="${r.nhom_dem}">
      <div class="ct-dau"><div class="ct-nhan"><span class="ma">${escapeHtml(r.ma)}</span>${nhanPhuHtml(r)}${nhanTT}</div>
        <h3>${escapeHtml(r.noi_dung)}</h3>
        <p class="ma">${r.so_ket_luan ? `${escapeHtml(r.so_ket_luan)} · ` : ''}ban hành ${formatNgay(r.ngay_ban_hanh)}${r.ngay_nhan_van_ban ? ` · nhận ${formatNgay(r.ngay_nhan_van_ban)}` : ''} · ${nguonDong.toLowerCase()}</p></div>
      <dl class="ct-luoi">${o('Chủ trì', `${escapeHtml(ownerText(r))}${r.owner_tai_khoan_ten ? ` (${escapeHtml(boSoThuTu(r.owner_don_vi_ten))})` : ''}`)}
        ${o('Theo dõi', `${escapeHtml(r.nguoi_theo_doi_ten || '(trống)')}${nhanViec.length ? ' · đã nhận việc' : laBenTrong(r) && nhomCua(r.nhom_dem).mo ? ' · <span class="chu-canh-bao">chưa xác nhận nhận việc</span>' : ''}`)}
        ${o('Sản phẩm', escapeHtml(sanPhamText(r) || 'chưa định nghĩa'))}
        ${nSao ? o('Hạn nộp MC', hanNop) : ''}
        ${o('Hạn hoàn thành', `<span${hanLop}>${r.han_xu_ly ? formatNgay(r.han_xu_ly) : 'chưa có'}${r.nhom_dem === 'QUA_HAN' ? `, trễ ${r.so_ngay_qua} ngày` : ''}</span>${r.ly_do_chua_co_han ? ` — ${escapeHtml(r.ly_do_chua_co_han)}` : ''}`)}
        ${o('Cấp quyết', capQuyetHtml(r))}
        ${o('Cấp nhận', escapeHtml(r.cap_nhan_san_pham_ten || '(trống)'))}</dl>
      ${hanhDongHtml(r)}
      <div class="khoi-nho luong-cd" id="klChiDao-${r.id}"><p class="chu-phu">Đang tải chỉ đạo…</p></div>
      <div class="khoi-nho khoi-mc" id="klMinhChung-${r.id}"><p class="chu-phu">Đang tải minh chứng…</p></div>
      <div class="khoi-nho db-khoi" id="klDienBien-${r.id}"><h4>Diễn biến <span class="chu-phu">mới nhất trên đầu</span></h4><div><p class="chu-phu">Đang tải diễn biến…</p></div></div>
      <details class="chi-tiet-them"><summary>Xem chi tiết <span class="chu-phu">căn cứ từng trường</span></summary>
      <table class="can-cu"><thead><tr><th>Trường</th><th>Giá trị</th><th>Căn cứ</th></tr></thead><tbody>
          ${hang('Chịu trách nhiệm', ownerText(r), canCu(r.owner_tai_khoan ? 'owner_tai_khoan' : 'owner_don_vi_ma', ls))}
          ${hang('Sản phẩm đầu ra', sanPhamText(r) || '(chưa định nghĩa sản phẩm — dữ liệu chuyển đổi)', canCu('san_pham_loai', ls))}
          ${hang('Ngày nhận văn bản', `${hienGiaTri('ngay_nhan_van_ban', r.ngay_nhan_van_ban)}${r.ngay_nhan_uoc_tinh ? ' (ước tính = ngày ban hành)' : ''}`, canCu('ngay_nhan_van_ban', ls))}
          ${nSao ? hang('Hạn nộp minh chứng', hienGiaTri('han_nop_minh_chung', r.han_nop_minh_chung), canCu('han_nop_minh_chung', ls)) : ''}
          ${hang('Hạn xử lý', hienGiaTri('han_xu_ly', r.han_xu_ly), r.loai_thoi_han_ma === 'KY_BAN_HANH' ? '<span class="chu-phu">tự tính = ngày ban hành + 10</span>' : canCu('han_xu_ly', ls))}
          ${hang('Loại thời hạn', r.loai_thoi_han_ten, canCu('loai_thoi_han_ma', ls))}
          ${hang('Tiến độ', tenTrongDanhMuc('tienDo', r.tien_do_ma), `${canCu('tien_do_ma', ls)}<br><span class="chu-phu">cập nhật lần cuối ${formatDateTime(r.cap_nhat_luc)}${capNhat !== null ? ` (${capNhat} ngày trước)` : ''}</span>`)}
          ${hang('Ngày hoàn thành', `${hienGiaTri('ngay_hoan_thanh', r.ngay_hoan_thanh)}${r.lead_time_ngay !== null && r.lead_time_ngay !== undefined ? ` · lead time ${r.lead_time_ngay} ngày (từ ngày nhận văn bản)` : ''}`, canCu('ngay_hoan_thanh', ls))}
          ${r.minh_chung ? hang('Minh chứng dạng chữ (dữ liệu cũ)', hienGiaTri('minh_chung', r.minh_chung), canCu('minh_chung', ls)) : ''}
          ${hang('Xác nhận đã nhận việc', nhanViec.length ? nhanViec.map((l) => `${tenNguoi(l)} ${l.gia_tri_moi}`).join('; ') : 'chưa', '')}
          ${hang('Ngành · Lĩnh vực', `${boSoThuTu(r.nganh_ten) || '(chưa có ngành)'} · ${r.linh_vuc_ten || 'Chưa phân loại'}`, canCu('linh_vuc_ma', ls))}
          ${hang('Nguồn dòng · Đính chính', `${nguonDong}${r.theo_1400 ? ' · theo quy tắc 1400' : ' · dữ liệu chuyển đổi'} · ${dinhChinh}`, '')}
        </tbody></table>
      </details>
    </div>`;
}

// "còn n ngày làm việc" tới hạn nộp hiệu lực (DB tính theo danh mục ngày nghỉ); lỗi thì bỏ trống, không chặn ngăn.
async function napConNgay(r) {
  const n = r.han_nop_hieu_luc || r.han_nop_minh_chung; const hom = homNayVN();
  if (!n || n < hom || !nhomCua(r.nhom_dem).mo || !$(`klHanNopCon-${r.id}`)) return;
  try { const so = await soNgayLamViec(hom, n); if ($(`klHanNopCon-${r.id}`)) $(`klHanNopCon-${r.id}`).textContent = `(còn ${so} ngày làm việc)`; } catch { /* bỏ trống */ }
}

let dangMo = null; let dangNap = null;
export const idDangMo = () => dangMo;

// Đọc lỗi tạm → thử lại một lần; vẫn lỗi → ghi ngay trong ngăn (toast tự đóng sau 4 giây, người dùng vẫn thấy lý do).
async function docCanCu(id, lanThu = 0) {
  try { return await Promise.all([loadLichSu(id), loadDinhChinhCho(id)]); } catch (e) {
    if (lanThu < 1) { await new Promise((r) => setTimeout(r, 800)); return docCanCu(id, lanThu + 1); }
    throw e;
  }
}

async function nap(id, cheDo, giuBang) {
  const r = timKlRow(id); const o = $('klChiTiet');
  if (!r || !o) return;
  const p = (async () => {
    const [ls, dc] = await docCanCu(id);
    if (dangMo !== id) return;
    o.innerHTML = chiTietHtml(r, ls, dc);
    if (cheDo === 'chi-tiet' || giuBang) o.querySelector('.chi-tiet-them').open = true;
    await Promise.all([napChiDao(r), napMinhChung(r), napDienBien(o.querySelector(`#klDienBien-${id} > div`), id), napConNgay(r)]);
    if (cheDo === 'chi-dao') focusChiDao(id);
  })();
  dangNap = p.catch((e) => { notifyError('Không đọc được lịch sử: ' + e.message); if (dangMo === id) o.innerHTML = `<p class="loi-inline">Không đọc được lịch sử: ${escapeHtml(e.message)}. Bấm lại dòng để thử lại.</p>`; });
  await dangNap;
}

// Mở việc trong ngăn; ngăn đã mở đúng việc: 'chi-dao' chỉ đặt con trỏ, không nạp lại.
export async function toggleKlChiTiet({ id, cheDo }) {
  if (!timKlRow(id)) return;
  if (dangMo === id && $(`klChiTiet-${id}`)) {
    if (cheDo === 'chi-dao') { await dangNap; focusChiDao(id); }
    return;
  }
  dangMo = id;
  document.querySelectorAll('#klBody .hang-nv').forEach((el) => { const on = el.dataset.id === id; el.classList.toggle('dang', on); el.setAttribute('aria-pressed', String(on)); });
  $('klChiTiet').innerHTML = '<p class="trong-nho">Đang tải căn cứ…</p>';
  if (window.matchMedia('(max-width: 860px)').matches) $('klChiTiet').scrollIntoView({ block: 'start', behavior: 'smooth' });
  await nap(id, cheDo, false);
}
// Vẽ lại ngăn đang mở sau khi danh sách nạp lại (realtime, sau hành động) — giữ bảng chi tiết đang mở/gập.
export function veLaiChiTiet(id) {
  if (dangMo !== id) return;
  const giuBang = Boolean($('klChiTiet')?.querySelector('.chi-tiet-them')?.open);
  nap(id, undefined, giuBang);
}
export function dongKlChiTiet() {
  dangMo = null;
  $('klChiTiet').innerHTML = '<p class="trong-nho">Chọn một dòng để xem chỉ đạo, minh chứng và lịch sử.</p>';
  document.querySelectorAll('#klBody .hang-nv.dang').forEach((el) => { el.classList.remove('dang'); el.setAttribute('aria-pressed', 'false'); });
}
export const chonKlRow = ({ id }) => toggleKlChiTiet({ id });
