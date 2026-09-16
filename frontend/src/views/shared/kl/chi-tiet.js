// Ngăn chi tiết "vì sao đỏ" (thiết kế 6.3): bung dưới dòng, mỗi trường then chốt hiện giá trị · ai nhập · lúc nào · nguồn
// từ lich_su (RLS theo phạm vi thấy nhiệm vụ); nguồn dòng; đính chính đang chờ; chỉ đạo chờ; lịch sử đầy đủ.
// GĐ14: thêm Chịu trách nhiệm (Owner), Sản phẩm, Cấp nhận / cấp quyết định, Ngày nhận văn bản, xác nhận nhận việc.
import { $, show, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { findAccount } from '../../../lib/state.js';
import { notifyError } from '../../../components/toast.js';
import { loadLichSu, loadDinhChinhCho, tenTrongDanhMuc } from '../../../lib/kl/du-lieu.js';
import { formatNgay, ngayTruoc } from '../../../lib/kl/ngay.js';
import { nhanTrangThai, TEN_NGUON, tenCot, boSoThuTu, chamMuc } from '../../../lib/kl/nhan.js';
import { timKlRow } from './danh-sach.js';
import { sanPhamText } from './dong.js';
import { napChiDao, focusChiDao } from './chi-dao.js';

const DANH_MUC_COT = { tien_do_ma: 'tienDo', loai_thoi_han_ma: 'loaiThoiHan', nganh_ma: 'nganh', linh_vuc_ma: 'linhVuc', owner_don_vi_ma: 'donVi',
  san_pham_loai: 'sanPham', cap_nhan_san_pham: 'cap', cap_quyet_dinh: 'cap' };
const COT_NGAY = ['han_xu_ly', 'ngay_hoan_thanh', 'ngay_nhan_van_ban'];
const COT_TAI_KHOAN = ['nguoi_theo_doi', 'owner_tai_khoan'];

// Giá trị lịch sử/dòng hiện tại → chữ đọc được (mã danh mục → tên, ngày → d/m/yyyy, trống → "(trống)").
export function hienGiaTri(cot, v) {
  if (v === null || v === undefined || v === '') return '(trống)';
  if (DANH_MUC_COT[cot]) return tenTrongDanhMuc(DANH_MUC_COT[cot], v);
  if (COT_NGAY.includes(cot)) return formatNgay(v);
  if (COT_TAI_KHOAN.includes(cot)) return findAccount(v)?.full_name || v;
  if (cot === 'ngay_nhan_uoc_tinh' || cot === 'theo_1400') return v === 'true' || v === true ? 'có' : 'không';
  return String(v);
}

const tenNguoi = (l) => findAccount(l.nguoi_sua)?.full_name || l.nguoi_sua_ghi_chu || (l.nguon === 'excel' ? 'không xác định (nhật ký Excel)' : 'hệ thống');

// "nhập bởi <tên>, 23/8/2026 09:12 · Nhập từ Excel" — lấy lần đổi gần nhất của cột; không có thì lấy dòng tạo ('*').
function canCu(cot, ls) {
  const l = ls.find((x) => x.cot === cot) || ls.find((x) => x.cot === '*');
  if (!l) return '<span class="chu-phu">không có nhật ký</span>';
  if (l.cot === '*') return `<span class="chu-phu">giữ nguyên từ lúc tạo dòng ${formatDateTime(l.luc)} · ${TEN_NGUON[l.nguon] || l.nguon}${l.nguoi_sua ? `, bởi ${escapeHtml(tenNguoi(l))}` : ''}</span>`;
  return `<span class="chu-phu">nhập bởi ${escapeHtml(tenNguoi(l))}, ${formatDateTime(l.luc)} · ${TEN_NGUON[l.nguon] || l.nguon}</span>`;
}

function hangHtml(nhan, giaTri, canCuHtml) {
  return `<tr><th scope="row">${nhan}</th><td>${escapeHtml(giaTri)}</td><td>${canCuHtml}</td></tr>`;
}

function lichSuHtml(ls) {
  if (ls.length === 0) return '<p class="chu-phu">Chưa có thay đổi nào được ghi nhận.</p>';
  return `<ul class="lich-su">${ls.map((l) => `<li><span class="chu-phu">${formatDateTime(l.luc)}</span> · ${escapeHtml(tenNguoi(l))} · <b>${tenCot(l.cot)}</b>: ${
    l.cot === '*' ? `tạo dòng ${escapeHtml(l.gia_tri_moi || '')}` : ['xac_nhan_nhan_viec', 'chi_dao'].includes(l.cot) ? escapeHtml(l.gia_tri_moi || '')
      : `${escapeHtml(hienGiaTri(l.cot, l.gia_tri_cu))} → ${escapeHtml(hienGiaTri(l.cot, l.gia_tri_moi))}`
  } <span class="chu-phu">(${TEN_NGUON[l.nguon] || l.nguon})</span></li>`).join('')}</ul>`;
}

export function chiTietHtml(r, ls, dc) {
  const capNhat = ngayTruoc(r.cap_nhat_luc);
  const nguonDong = r.nguon === 'excel' ? 'Nhập từ Excel (biên bản nhập 15/9/2026)' : 'Nhập trên hệ thống';
  const excelGhiChu = r.nguon === 'excel' && r.tien_do_ma === 'HOAN_THANH' && !r.ngay_hoan_thanh ? ' — không có ngày hoàn thành gốc, không đánh giá đúng/trễ hạn' : '';
  const dinhChinh = dc.length === 0 ? 'chưa có' : dc.map((d) => `${tenCot(d.cot)}: ${hienGiaTri(d.cot, d.gia_tri_cu)} → ${hienGiaTri(d.cot, d.gia_tri_moi)} (${d.ly_do})`).join('; ');
  const owner = r.owner_tai_khoan_ten ? `${r.owner_tai_khoan_ten} (${boSoThuTu(r.owner_don_vi_ten)})` : boSoThuTu(r.owner_don_vi_ten) || '(chưa xác định)';
  const nhanViec = ls.filter((l) => l.cot === 'xac_nhan_nhan_viec');
  return `
    <div class="chi-tiet">
      <div class="chi-tiet-dau">
        <b>${escapeHtml(r.ma)} · ${escapeHtml(owner)} · <span class="${chamMuc(r.muc_canh_bao).lop}"></span>${escapeHtml(nhanTrangThai(r))}</b>
        <span class="chu-phu">${nguonDong}${excelGhiChu}${r.theo_1400 ? ' · theo quy tắc 1400' : ' · dữ liệu chuyển đổi'}</span>
      </div>
      <div class="luong-cd" id="klChiDao-${r.id}"><p class="chu-phu">Đang tải chỉ đạo…</p></div>
      <details class="chi-tiet-them"><summary>Xem chi tiết <span class="chu-phu">nội dung đầy đủ, căn cứ từng trường, lịch sử</span></summary>
      <p class="chi-tiet-noi-dung">${escapeHtml(r.noi_dung)}</p>
      <table class="can-cu">
        <thead><tr><th>Trường</th><th>Giá trị</th><th>Căn cứ</th></tr></thead>
        <tbody>
          ${hangHtml('Chịu trách nhiệm', owner, canCu(r.owner_tai_khoan ? 'owner_tai_khoan' : 'owner_don_vi_ma', ls))}
          ${hangHtml('Sản phẩm đầu ra', sanPhamText(r) || '(chưa định nghĩa sản phẩm — dữ liệu chuyển đổi)', canCu('san_pham_loai', ls))}
          ${hangHtml('Cấp nhận · Cấp cần quyết định', `${r.cap_nhan_san_pham_ten || '(chưa có)'} · ${r.cap_quyet_dinh_ten || '(chưa xác định)'}`, canCu('cap_nhan_san_pham', ls))}
          ${hangHtml('Ngày nhận văn bản', `${hienGiaTri('ngay_nhan_van_ban', r.ngay_nhan_van_ban)}${r.ngay_nhan_uoc_tinh ? ' (ước tính = ngày ban hành)' : ''}`, canCu('ngay_nhan_van_ban', ls))}
          ${hangHtml('Hạn xử lý', hienGiaTri('han_xu_ly', r.han_xu_ly), r.loai_thoi_han_ma === 'KY_BAN_HANH' ? '<span class="chu-phu">tự tính = ngày ban hành + 10</span>' : canCu('han_xu_ly', ls))}
          ${r.ly_do_chua_co_han ? hangHtml('Lý do chưa có hạn', r.ly_do_chua_co_han, canCu('ly_do_chua_co_han', ls)) : ''}
          ${hangHtml('Loại thời hạn', r.loai_thoi_han_ten, canCu('loai_thoi_han_ma', ls))}
          ${hangHtml('Tiến độ', tenTrongDanhMuc('tienDo', r.tien_do_ma), `${canCu('tien_do_ma', ls)}<br><span class="chu-phu">cập nhật lần cuối ${formatDateTime(r.cap_nhat_luc)}${capNhat !== null ? ` (${capNhat} ngày trước)` : ''}</span>`)}
          ${hangHtml('Ngày hoàn thành', hienGiaTri('ngay_hoan_thanh', r.ngay_hoan_thanh), canCu('ngay_hoan_thanh', ls))}
          ${hangHtml('Minh chứng', hienGiaTri('minh_chung', r.minh_chung), canCu('minh_chung', ls))}
          ${hangHtml('Người theo dõi', r.nguoi_theo_doi_ten || '(trống)', canCu('nguoi_theo_doi', ls))}
          ${hangHtml('Xác nhận đã nhận việc', nhanViec.length ? nhanViec.map((l) => `${tenNguoi(l)} ${l.gia_tri_moi}`).join('; ') : 'chưa', '')}
          ${hangHtml('Ngành · Lĩnh vực', `${boSoThuTu(r.nganh_ten) || '(chưa có ngành)'} · ${r.linh_vuc_ten || 'Chưa phân loại'}`, canCu('linh_vuc_ma', ls))}
          ${hangHtml('Đính chính', dinhChinh, '')}
        </tbody>
      </table>
      <details class="lich-su-hop"><summary>Lịch sử: ${ls.filter((l) => l.cot !== '*').length} thay đổi — xem đầy đủ</summary>${lichSuHtml(ls)}</details>
      </details>
    </div>`;
}

// Mở/đóng ngăn chi tiết. cheDo (15E): 'chi-tiet' = bảng thông tin mở sẵn, không đặt con trỏ; 'chi-dao' = bảng gập, con trỏ
// vào ô chỉ đạo/phản hồi (ngăn đang mở thì chỉ đặt con trỏ, không đóng); không có = toggle giữ bảng gập (vẽ lại realtime).
const dangNap = new Map(); // id → promise nạp ngăn (vẽ lại realtime có thể đang nạp khi người dùng bấm "Chỉ đạo")
const cheDoDangNap = new Map(); // id → chế độ đã chọn khi ngăn còn "Đang tải…" (vẽ lại realtime giữ đúng chế độ, không suy từ DOM chưa có)
export const bangDangMoSan = (id) => cheDoDangNap.get(id) === 'chi-tiet';
export async function toggleKlChiTiet({ id, cheDo }) {
  const tr = $(`klChiTiet-${id}`);
  const r = timKlRow(id);
  if (!tr || !r) return;
  if (!tr.classList.contains('hidden')) {
    if (cheDo === 'chi-dao') { await dangNap.get(id); const b = tr.querySelector('.chi-tiet-them'); if (b) b.open = false; focusChiDao(id); return; }
    show(tr, false); return;
  }
  tr.firstElementChild.innerHTML = '<p class="chu-phu">Đang tải căn cứ…</p>';
  show(tr, true);
  const nap = (async () => {
    const [ls, dc] = await Promise.all([loadLichSu(id), loadDinhChinhCho(id)]);
    tr.firstElementChild.innerHTML = chiTietHtml(r, ls, dc);
    if (cheDo === 'chi-tiet') tr.querySelector('.chi-tiet-them').open = true;
    await napChiDao(r); // khối chỉ đạo (GĐ15) ở đầu ngăn, nạp riêng, ghi "đã đọc" khi hiện
  })();
  dangNap.set(id, nap.catch(() => {}));
  cheDoDangNap.set(id, cheDo);
  try {
    await nap;
    if (cheDo === 'chi-dao') focusChiDao(id);
  } catch (e) {
    notifyError('Không đọc được lịch sử: ' + e.message);
    show(tr, false);
  } finally {
    dangNap.delete(id);
    cheDoDangNap.delete(id);
  }
}
export const moKlChiTiet = ({ id }) => toggleKlChiTiet({ id, cheDo: 'chi-tiet' });
export const moKlChiDao = ({ id }) => toggleKlChiTiet({ id, cheDo: 'chi-dao' });
