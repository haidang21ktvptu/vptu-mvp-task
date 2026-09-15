// Ngăn chi tiết "vì sao đỏ" (thiết kế 6.3): bung dưới dòng, mỗi trường then chốt hiện giá trị · ai nhập · lúc nào · nguồn
// từ kl_lich_su (RLS theo phạm vi thấy nhiệm vụ); nguồn dòng; đính chính đang chờ; chỉ đạo chờ; lịch sử đầy đủ.
// Không có nút chỉ đạo/đính chính ở GĐ10 (GĐ11).
import { $, show, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { findAccount } from '../../../lib/state.js';
import { notifyError } from '../../../components/toast.js';
import { loadLichSu, loadDinhChinhCho, tenTrongDanhMuc } from '../../../lib/kl/du-lieu.js';
import { formatNgay, ngayTruoc } from '../../../lib/kl/ngay.js';
import { nhanTrangThai, TEN_NGUON, tenCot, boSoThuTu } from '../../../lib/kl/nhan.js';
import { timKlRow } from './danh-sach.js';

const DANH_MUC_COT = { tien_do_ma: 'tienDo', loai_thoi_han_ma: 'loaiThoiHan', nganh_ma: 'nganh', linh_vuc_ma: 'linhVuc', co_quan_trinh_ma: 'coQuanTrinh' };
const COT_NGAY = ['han_xu_ly', 'ngay_hoan_thanh'];

// Giá trị lịch sử/dòng hiện tại → chữ đọc được (mã danh mục → tên, ngày → d/m/yyyy, trống → "(trống)").
export function hienGiaTri(cot, v) {
  if (v === null || v === undefined || v === '') return '(trống)';
  if (DANH_MUC_COT[cot]) return tenTrongDanhMuc(DANH_MUC_COT[cot], v);
  if (COT_NGAY.includes(cot)) return formatNgay(v);
  if (cot === 'chu_tri_id') return findAccount(v)?.full_name || v;
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
    l.cot === '*' ? `tạo dòng ${escapeHtml(l.gia_tri_moi || '')}` : `${escapeHtml(hienGiaTri(l.cot, l.gia_tri_cu))} → ${escapeHtml(hienGiaTri(l.cot, l.gia_tri_moi))}`
  } <span class="chu-phu">(${TEN_NGUON[l.nguon] || l.nguon})</span></li>`).join('')}</ul>`;
}

export function chiTietHtml(r, ls, dc) {
  const capNhat = ngayTruoc(r.cap_nhat_luc);
  const nguonDong = r.nguon === 'excel' ? 'Nhập từ Excel (biên bản nhập 15/9/2026)' : 'Nhập trên hệ thống';
  const excelGhiChu = r.nguon === 'excel' && r.tien_do_ma === 'HOAN_THANH' && !r.ngay_hoan_thanh ? ' — không có ngày hoàn thành gốc, không đánh giá đúng/trễ hạn' : '';
  const dinhChinh = dc.length === 0 ? 'chưa có' : dc.map((d) => `${tenCot(d.cot)}: ${hienGiaTri(d.cot, d.gia_tri_cu)} → ${hienGiaTri(d.cot, d.gia_tri_moi)} (${d.ly_do})`).join('; ');
  return `
    <div class="chi-tiet">
      <div class="chi-tiet-dau">
        <b>${escapeHtml(r.ma)} · ${escapeHtml(boSoThuTu(r.co_quan_trinh_ten)) || 'chưa có cơ quan trình'} · ${escapeHtml(nhanTrangThai(r))}</b>
        <span class="chu-phu">${nguonDong}${excelGhiChu}</span>
      </div>
      <p class="chi-tiet-noi-dung">${escapeHtml(r.noi_dung)}</p>
      <table class="can-cu">
        <thead><tr><th>Trường</th><th>Giá trị</th><th>Căn cứ</th></tr></thead>
        <tbody>
          ${hangHtml('Hạn xử lý', hienGiaTri('han_xu_ly', r.han_xu_ly), r.loai_thoi_han_ma === 'KY_BAN_HANH' ? '<span class="chu-phu">tự tính = ngày ban hành + 10</span>' : canCu('han_xu_ly', ls))}
          ${r.ly_do_chua_co_han ? hangHtml('Lý do chưa có hạn', r.ly_do_chua_co_han, canCu('ly_do_chua_co_han', ls)) : ''}
          ${hangHtml('Loại thời hạn', r.loai_thoi_han_ten, canCu('loai_thoi_han_ma', ls))}
          ${hangHtml('Tiến độ', tenTrongDanhMuc('tienDo', r.tien_do_ma), `${canCu('tien_do_ma', ls)}<br><span class="chu-phu">cập nhật lần cuối ${formatDateTime(r.cap_nhat_luc)}${capNhat !== null ? ` (${capNhat} ngày trước)` : ''}</span>`)}
          ${hangHtml('Ngày hoàn thành', hienGiaTri('ngay_hoan_thanh', r.ngay_hoan_thanh), canCu('ngay_hoan_thanh', ls))}
          ${hangHtml('Minh chứng', hienGiaTri('minh_chung', r.minh_chung), canCu('minh_chung', ls))}
          ${hangHtml('Ngành · Lĩnh vực', `${boSoThuTu(r.nganh_ten) || '(chưa có ngành)'} · ${r.linh_vuc_ten || 'Chưa phân loại'}`, canCu('linh_vuc_ma', ls))}
          ${hangHtml('Chỉ đạo', r.so_chi_dao_cho_phan_hoi > 0 ? `${r.so_chi_dao_cho_phan_hoi} chờ phản hồi` : 'chưa có', '')}
          ${hangHtml('Đính chính', dinhChinh, '')}
        </tbody>
      </table>
      <details class="lich-su-hop"><summary>Lịch sử: ${ls.filter((l) => l.cot !== '*').length} thay đổi — xem đầy đủ</summary>${lichSuHtml(ls)}</details>
    </div>`;
}

export async function toggleKlChiTiet({ id }) {
  const tr = $(`klChiTiet-${id}`);
  const r = timKlRow(id);
  if (!tr || !r) return;
  if (!tr.classList.contains('hidden')) { show(tr, false); return; }
  tr.firstElementChild.innerHTML = '<p class="chu-phu">Đang tải căn cứ…</p>';
  show(tr, true);
  try {
    const [ls, dc] = await Promise.all([loadLichSu(id), loadDinhChinhCho(id)]);
    tr.firstElementChild.innerHTML = chiTietHtml(r, ls, dc);
  } catch (e) {
    notifyError('Không đọc được lịch sử: ' + e.message);
    show(tr, false);
  }
}
