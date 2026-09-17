// Khu "Ngưỡng cảnh báo": bảng kl_cau_hinh (mọi khoá đều là số ngày/giờ). Chánh Văn phòng / quan_tri_he_thong sửa qua qt_dat_cau_hinh
// (số nguyên ngày, lý do bắt buộc, ghi nhat_ky_he_thong); Phó Chánh Văn phòng chỉ xem.
import { supabase } from '../../../lib/supabase.js';
import { $, escapeHtml } from '../../../lib/dom.js';
import { state, isChief } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';

export const duocSuaCauHinh = () => Boolean(state.user?.quan_tri_he_thong) || (state.user?.role_group === 'A1' && isChief());

function rowHtml(r, sua) {
  const o = sua
    ? `<td><input type="number" min="1" max="9999" class="o-nhap nho" id="qtCh-${escapeHtml(r.khoa)}" value="${escapeHtml(r.gia_tri)}" aria-label="Giá trị ${escapeHtml(r.khoa)}"></td>
       <td><input type="text" class="o-nhap nho" id="qtChLd-${escapeHtml(r.khoa)}" placeholder="Lý do (bắt buộc)" aria-label="Lý do đổi ${escapeHtml(r.khoa)}"></td>
       <td><div class="thao-tac"><button type="button" class="nut nho chinh" data-action="luuCauHinh" data-khoa="${escapeHtml(r.khoa)}">Lưu</button></div></td>`
    : `<td>${escapeHtml(r.gia_tri)}</td><td class="chu-phu">—</td><td></td>`;
  return `<tr><td class="tieude">${escapeHtml(r.khoa)}</td><td>${escapeHtml(r.mo_ta || '')}</td>${o}</tr>`;
}

export async function renderCauHinh() {
  const { data, error } = await supabase.from('kl_cau_hinh').select('khoa, gia_tri, mo_ta').order('khoa');
  if (error) { notifyError('Không đọc được cấu hình: ' + error.message); return; }
  $('qtCauHinhBody').innerHTML = data.length ? data.map((r) => rowHtml(r, duocSuaCauHinh())).join('') : '<tr><td colspan="5" class="trong">Chưa có khoá cấu hình.</td></tr>';
}

export async function luuCauHinh({ khoa }, onDone) {
  const giaTri = $(`qtCh-${khoa}`).value.trim();
  const lyDo = $(`qtChLd-${khoa}`).value.trim();
  if (!lyDo) { notifyError('Phải ghi lý do thay đổi — lý do được lưu vào nhật ký hệ thống.'); $(`qtChLd-${khoa}`).focus(); return; }
  const { error } = await supabase.rpc('qt_dat_cau_hinh', { p_khoa: khoa, p_gia_tri: giaTri, p_ly_do: lyDo });
  if (error) { notifyError('Không lưu được: ' + error.message); return; }
  notifySuccess(`Đã đổi ${khoa} = ${giaTri}.`);
  await onDone();
}
