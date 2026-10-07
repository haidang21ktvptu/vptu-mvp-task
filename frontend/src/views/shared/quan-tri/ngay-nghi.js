// Khu "Ngày nghỉ" (PR-2b, thiết kế A1–A2, Q10): danh mục nghỉ lễ / nghỉ bù / làm bù — DB dùng để tính ngày làm việc (nhắc nghiệm thu, hạn phản
// hồi chỉ đạo Thường trực, nhắc duyệt từ chối, việc Thường trực chưa nhận, Hỏa tốc). Chánh Văn phòng / quan_tri_he_thong thêm, sửa, bỏ qua
// qt_dat_ngay_nghi (lý do bắt buộc, nhật ký hệ thống ghi giá trị cũ/mới); hàm là chốt. Migration để trống: quản trị nhập lịch nghỉ sau phát hành.
import { $, escapeHtml } from '../../../lib/dom.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { dsNgayNghi, datNgayNghi, TEN_LOAI_NGAY } from '../../../lib/kl/han-nop.js';
import { formatNgay } from '../../../lib/kl/ngay.js';

const THU = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const thuCua = (d) => THU[new Date(`${d}T00:00:00Z`).getUTCDay()];

function dongHtml(n) {
  return `<tr id="qtNn-${n.ngay}"><td>${formatNgay(n.ngay)}</td><td>${thuCua(n.ngay)}</td><td>${escapeHtml(TEN_LOAI_NGAY[n.loai] || n.loai)}</td><td>${escapeHtml(n.ten)}</td>
    <td><div class="thao-tac"><input type="text" class="o-nhap nho" id="qtNnLd-${n.ngay}" placeholder="Lý do bỏ (bắt buộc)" aria-label="Lý do bỏ ngày ${formatNgay(n.ngay)}">
      <button type="button" class="nut nho" data-action="qtBoNgayNghi" data-ngay="${n.ngay}">Bỏ ngày</button></div></td></tr>`;
}

export async function renderNgayNghi() {
  let ds = [];
  try { ds = await dsNgayNghi(); } catch (e) { notifyError(e.message); }
  $('qtKhuNgayNghi').innerHTML = `
    <p class="chu-phu">Ngày nghỉ lễ, nghỉ bù và ngày làm bù (Thứ Bảy/Chủ nhật đi làm). Hệ thống dùng danh mục này để tính ngày làm việc: nhắc nghiệm thu,
      hạn phản hồi chỉ đạo, nhắc việc. Mỗi thay đổi phải ghi lý do và được lưu vào nhật ký hệ thống.</p>
    <form id="qtNgayNghiForm" class="cot-3" data-submit="qtThemNgayNghi">
      <input type="date" name="ngay" required class="o-nhap" aria-label="Ngày">
      <select name="loai" class="o-nhap" aria-label="Loại ngày">${Object.entries(TEN_LOAI_NGAY).map(([ma, ten]) => `<option value="${ma}">${escapeHtml(ten)}</option>`).join('')}</select>
      <input name="ten" required maxlength="200" class="o-nhap" placeholder="Tên (ví dụ: Tết Nguyên đán)" aria-label="Tên ngày nghỉ">
      <input name="ly_do" required class="o-nhap" placeholder="Lý do (bắt buộc)" aria-label="Lý do thêm hoặc sửa">
      <button type="submit" class="nut chinh">Thêm / sửa ngày</button>
    </form>
    <table class="bang-qt"><thead><tr><th>Ngày</th><th>Thứ</th><th>Loại</th><th>Tên</th><th>Thao tác</th></tr></thead>
      <tbody id="qtNgayNghiBody">${ds.length ? ds.map(dongHtml).join('') : '<tr><td colspan="5" class="trong">Chưa có ngày nghỉ nào — nhập lịch nghỉ năm để hệ thống tính đúng ngày làm việc.</td></tr>'}</tbody></table>`;
}

export async function themNgayNghi(form) {
  const f = new FormData(form); const lyDo = (f.get('ly_do') || '').trim();
  if (!f.get('ngay') || !(f.get('ten') || '').trim() || !lyDo) { notifyError('Nhập ngày, tên và lý do.'); return; }
  try {
    await datNgayNghi(f.get('ngay'), f.get('loai'), f.get('ten').trim(), true, lyDo);
    notifySuccess(`Đã lưu ngày ${formatNgay(f.get('ngay'))} vào danh mục ngày nghỉ.`);
    await renderNgayNghi();
  } catch (e) { notifyError(e.message); }
}

export async function boNgayNghi({ ngay }) {
  const lyDo = $(`qtNnLd-${ngay}`)?.value.trim();
  if (!lyDo) { notifyError('Phải ghi lý do bỏ ngày — lý do được lưu vào nhật ký hệ thống.'); $(`qtNnLd-${ngay}`)?.focus(); return; }
  try {
    await datNgayNghi(ngay, null, null, false, lyDo);
    notifySuccess(`Đã bỏ ngày ${formatNgay(ngay)} khỏi danh mục ngày nghỉ.`);
    await renderNgayNghi();
  } catch (e) { notifyError(e.message); }
}
