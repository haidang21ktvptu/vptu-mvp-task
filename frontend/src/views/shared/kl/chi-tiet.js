// Ngăn chi tiết bên phải (mockup, giữ thứ tự của mọi vai: thông tin then chốt → hành động → khối chỉ đạo → minh chứng → chi tiết và lịch sử
// gập). Căn cứ từng trường từ lich_su (RLS theo phạm vi thấy nhiệm vụ); đính chính đang chờ; nguồn dòng. Một ngăn cho cả danh sách:
// #klChiTiet chứa <div id="klChiTiet-<id>"> của việc đang chọn; toggleKlChiTiet({id, cheDo}) mở việc (cheDo 'chi-dao' → con trỏ vào ô nhập).
import { $, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { findAccount } from '../../../lib/state.js';
import { notifyError } from '../../../components/toast.js';
import { loadLichSu, loadDinhChinhCho, tenTrongDanhMuc, danhMucKl } from '../../../lib/kl/du-lieu.js';
import { formatNgay, ngayTruoc } from '../../../lib/kl/ngay.js';
import { nhanTrangThai, TEN_NGUON, tenCot, boSoThuTu, nhomCua } from '../../../lib/kl/nhan.js';
import { timKlRow } from './danh-sach.js';
import { sanPhamText, laBenTrong, duocCapNhat, duocDong, ownerText } from './dong.js';
import { napChiDao, focusChiDao, duocChiDao } from './chi-dao.js';
import { napMinhChung } from './minh-chung.js';

const COT_VET = ['xac_nhan_nhan_viec', 'chi_dao', 'minh_chung_nop', 'minh_chung_xac_nhan', 'dong_nhiem_vu'];
const DANH_MUC_COT = { tien_do_ma: 'tienDo', loai_thoi_han_ma: 'loaiThoiHan', nganh_ma: 'nganh', linh_vuc_ma: 'linhVuc', owner_don_vi_ma: 'donVi',
  san_pham_loai: 'sanPham', cap_nhan_san_pham: 'cap', cap_quyet_dinh: 'cap' };
const COT_NGAY = ['han_xu_ly', 'ngay_hoan_thanh', 'ngay_nhan_van_ban'];
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

function lichSuHtml(ls) {
  if (ls.length === 0) return '<p class="chu-phu">Chưa có thay đổi nào được ghi nhận.</p>';
  return `<ul class="lich-su">${ls.map((l) => `<li><span class="chu-phu">${formatDateTime(l.luc)}</span> · ${escapeHtml(tenNguoi(l))} · <b>${tenCot(l.cot)}</b>: ${
    l.cot === '*' ? `tạo dòng ${escapeHtml(l.gia_tri_moi || '')}` : COT_VET.includes(l.cot) ? escapeHtml(l.gia_tri_moi || '')
      : `${escapeHtml(hienGiaTri(l.cot, l.gia_tri_cu))} → ${escapeHtml(hienGiaTri(l.cot, l.gia_tri_moi))}`} <span class="chu-phu">(${TEN_NGUON[l.nguon] || l.nguon})</span></li>`).join('')}</ul>`;
}

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
  const tuChoi = laBenTrong(r) && mo && !r.da_xac_nhan_nhan && !r.tu_choi_cho;
  return `<div class="hanh-dong">
    ${laBenTrong(r) && mo && !r.da_xac_nhan_nhan ? nut('xacNhanNhanViec', 'Xác nhận đã nhận việc', 'lam') : ''}
    ${tuChoi ? nut('moO', 'Từ chối', '', `data-o="oTcNgan-${r.id}"`) : ''}
    ${duocCapNhat(r) && mo ? nut('openKlCapNhat', 'Cập nhật') : ''}
    ${duocDong(r) && mo ? nut('openDongNhiemVu', 'Đóng nhiệm vụ', 'chinh', coMC ? '' : 'disabled title="Cần ít nhất một minh chứng hợp lệ (số hiệu, ngày văn bản, cấp nhận)"') : ''}
    <button type="button" class="nut" data-action="dongKlChiTiet">Đóng ngăn</button></div>
    ${tuChoi ? `<form class="o" id="oTcNgan-${r.id}" data-submit="tuChoiNhanViec" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">
      <small>Lý do chỉ lãnh đạo trực tiếp và cấp trên đọc được; hạn và trạng thái việc không đổi cho tới khi được duyệt.</small>
      <input name="noi_dung" required placeholder="Lý do từ chối (bắt buộc)" aria-label="Lý do từ chối">
      <button type="submit" class="nut chinh">Gửi đề nghị</button><button type="button" class="nut" data-action="dongO" data-o="oTcNgan-${r.id}">Huỷ</button></form>` : ''}`;
}

export function chiTietHtml(r, ls, dc) {
  const capNhat = ngayTruoc(r.cap_nhat_luc);
  const nguonDong = r.nguon === 'excel' ? 'Nhập từ Excel' : 'Nhập trên hệ thống';
  const dinhChinh = dc.length === 0 ? 'chưa có' : dc.map((d) => `${tenCot(d.cot)}: ${hienGiaTri(d.cot, d.gia_tri_cu)} → ${hienGiaTri(d.cot, d.gia_tri_moi)} (${d.ly_do})`).join('; ');
  const nhanViec = ls.filter((l) => l.cot === 'xac_nhan_nhan_viec');
  const hanLop = r.nhom_dem === 'QUA_HAN' || r.nhom_dem === 'DANG_DINH_CHINH' ? ' style="color:var(--do)"' : '';
  return `<div id="klChiTiet-${r.id}" class="chi-tiet-noi" data-nhom="${r.nhom_dem}">
      <p class="ma">${escapeHtml(r.ma)}${r.so_ket_luan ? `, ${escapeHtml(r.so_ket_luan)}` : ''}, ban hành ${formatNgay(r.ngay_ban_hanh)} · <span class="trang-thai ${r.nhom_dem === 'HOAN_THANH' ? 'tt-xong' : r.nhom_dem === 'QUA_HAN' ? 'tt-qua' : 'tt-xam'}">${escapeHtml(nhanTrangThai(r))}</span>${r.bi_tu_choi ? ' <span class="trang-thai tt-qua">Bị từ chối, chờ giao lại</span>' : r.tu_choi_cho ? ' <span class="trang-thai tt-xam">Đề nghị từ chối, chờ duyệt</span>' : ''}</p>
      <h3>${escapeHtml(r.noi_dung)}</h3>
      <dl><dt>Chủ trì</dt><dd>${escapeHtml(ownerText(r))}${r.owner_tai_khoan_ten ? ` (${escapeHtml(boSoThuTu(r.owner_don_vi_ten))})` : ''}</dd>
        <dt>Theo dõi</dt><dd>${escapeHtml(r.nguoi_theo_doi_ten || '(trống)')}${nhanViec.length ? ' · đã nhận việc' : laBenTrong(r) && nhomCua(r.nhom_dem).mo ? ' · <span class="chu-canh-bao">chưa xác nhận nhận việc</span>' : ''}</dd>
        <dt>Sản phẩm</dt><dd>${escapeHtml(sanPhamText(r) || 'chưa định nghĩa')}</dd>
        <dt>Hạn</dt><dd><b${hanLop}>${r.han_xu_ly ? formatNgay(r.han_xu_ly) : 'chưa có'}${r.nhom_dem === 'QUA_HAN' ? `, trễ ${r.so_ngay_qua} ngày` : ''}</b>${r.ly_do_chua_co_han ? ` — ${escapeHtml(r.ly_do_chua_co_han)}` : ''}</dd>
        <dt>Cấp quyết</dt><dd>${capQuyetHtml(r)}${r.cap_nhan_san_pham_ten ? ` · cấp nhận: ${escapeHtml(r.cap_nhan_san_pham_ten)}` : ''}</dd></dl>
      ${hanhDongHtml(r)}
      <div class="khoi-nho luong-cd" id="klChiDao-${r.id}"><p class="chu-phu">Đang tải chỉ đạo…</p></div>
      <div class="khoi-nho khoi-mc" id="klMinhChung-${r.id}"><p class="chu-phu">Đang tải minh chứng…</p></div>
      <details class="chi-tiet-them"><summary>Xem chi tiết <span class="chu-phu">căn cứ từng trường, lịch sử</span></summary>
      <table class="can-cu"><thead><tr><th>Trường</th><th>Giá trị</th><th>Căn cứ</th></tr></thead><tbody>
          ${hang('Chịu trách nhiệm', ownerText(r), canCu(r.owner_tai_khoan ? 'owner_tai_khoan' : 'owner_don_vi_ma', ls))}
          ${hang('Sản phẩm đầu ra', sanPhamText(r) || '(chưa định nghĩa sản phẩm — dữ liệu chuyển đổi)', canCu('san_pham_loai', ls))}
          ${hang('Ngày nhận văn bản', `${hienGiaTri('ngay_nhan_van_ban', r.ngay_nhan_van_ban)}${r.ngay_nhan_uoc_tinh ? ' (ước tính = ngày ban hành)' : ''}`, canCu('ngay_nhan_van_ban', ls))}
          ${hang('Hạn xử lý', hienGiaTri('han_xu_ly', r.han_xu_ly), r.loai_thoi_han_ma === 'KY_BAN_HANH' ? '<span class="chu-phu">tự tính = ngày ban hành + 10</span>' : canCu('han_xu_ly', ls))}
          ${hang('Loại thời hạn', r.loai_thoi_han_ten, canCu('loai_thoi_han_ma', ls))}
          ${hang('Tiến độ', tenTrongDanhMuc('tienDo', r.tien_do_ma), `${canCu('tien_do_ma', ls)}<br><span class="chu-phu">cập nhật lần cuối ${formatDateTime(r.cap_nhat_luc)}${capNhat !== null ? ` (${capNhat} ngày trước)` : ''}</span>`)}
          ${hang('Ngày hoàn thành', `${hienGiaTri('ngay_hoan_thanh', r.ngay_hoan_thanh)}${r.lead_time_ngay !== null && r.lead_time_ngay !== undefined ? ` · lead time ${r.lead_time_ngay} ngày (từ ngày nhận văn bản)` : ''}`, canCu('ngay_hoan_thanh', ls))}
          ${r.minh_chung ? hang('Minh chứng dạng chữ (dữ liệu cũ)', hienGiaTri('minh_chung', r.minh_chung), canCu('minh_chung', ls)) : ''}
          ${hang('Xác nhận đã nhận việc', nhanViec.length ? nhanViec.map((l) => `${tenNguoi(l)} ${l.gia_tri_moi}`).join('; ') : 'chưa', '')}
          ${hang('Ngành · Lĩnh vực', `${boSoThuTu(r.nganh_ten) || '(chưa có ngành)'} · ${r.linh_vuc_ten || 'Chưa phân loại'}`, canCu('linh_vuc_ma', ls))}
          ${hang('Nguồn dòng · Đính chính', `${nguonDong}${r.theo_1400 ? ' · theo quy tắc 1400' : ' · dữ liệu chuyển đổi'} · ${dinhChinh}`, '')}
        </tbody></table>
      <details class="lich-su-hop"><summary>Lịch sử: ${ls.filter((l) => l.cot !== '*').length} thay đổi — xem đầy đủ</summary>${lichSuHtml(ls)}</details>
      </details>
    </div>`;
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
    await Promise.all([napChiDao(r), napMinhChung(r)]);
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
