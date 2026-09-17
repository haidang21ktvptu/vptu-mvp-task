// Khu "Ủy quyền giao việc" (Trưởng phòng): cấp quan_tri_kl có hạn cho một chuyên viên phòng mình (a2_uy_quyen), thu lại (a2_thu_uy_quyen).
// Danh sách hiện chuyên viên trong phòng đang có hạn ủy quyền (accounts_public.quan_tri_kl_het_han).
import { supabase } from '../../../lib/supabase.js';
import { $, escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { askLyDo } from './ly-do-modal.js';

const ngayVn = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const cvTrongPhong = () => state.accounts.filter((a) => a.role_group === 'A3' && a.department === state.user.department && !a.is_system);

export function renderUyQuyen() {
  const ds = cvTrongPhong().sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
  $('qtUqNguoi').innerHTML = ds.filter((a) => !a.quan_tri_kl_het_han).map((a) => `<option value="${a.id}">${escapeHtml(a.full_name)} (${escapeHtml(a.username)})</option>`).join('')
    || '<option value="">— không còn chuyên viên để ủy quyền —</option>';
  if (!$('qtUqDenNgay').value) {
    const d = new Date(); d.setDate(d.getDate() + 30);
    $('qtUqDenNgay').value = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  }
  const dang = ds.filter((a) => a.quan_tri_kl_het_han);
  $('qtUyQuyenBody').innerHTML = dang.length
    ? dang.map((a) => `<tr><td class="tieude">${escapeHtml(a.full_name)}<small>${escapeHtml(a.username)}</small></td><td>${ngayVn(a.quan_tri_kl_het_han)}</td>
        <td><div class="thao-tac"><button type="button" class="nut nho" data-action="thuUyQuyen" data-id="${a.id}" data-ten="${escapeHtml(a.full_name)}">Thu ủy quyền</button></div></td></tr>`).join('')
    : '<tr><td colspan="3" class="trong">Chưa ủy quyền cho ai.</td></tr>';
}

export async function guiUyQuyen(e, onDone) {
  e.preventDefault();
  const nguoi = $('qtUqNguoi').value; const denNgay = $('qtUqDenNgay').value; const lyDo = $('qtUqLyDo').value.trim();
  if (!nguoi) { notifyError('Chọn chuyên viên.'); return; }
  if (!denNgay) { notifyError('Chọn ngày hết hạn.'); return; }
  if (!lyDo) { notifyError('Phải ghi lý do ủy quyền — lý do được lưu vào nhật ký cấp quyền.'); return; }
  const { error } = await supabase.rpc('a2_uy_quyen', { p_nguoi: nguoi, p_den_ngay: denNgay, p_ly_do: lyDo });
  if (error) { notifyError('Không ủy quyền được: ' + error.message); return; }
  $('qtUqLyDo').value = '';
  notifySuccess(`Đã ủy quyền giao việc đến ${ngayVn(denNgay)}.`);
  await onDone();
}

export async function thuUyQuyen({ id, ten }, onDone) {
  const answer = await askLyDo({ title: 'Thu ủy quyền giao việc', moTa: `${ten} sẽ không còn quyền nhập/sửa nhiệm vụ của phòng.`, nhanXacNhan: 'Thu ủy quyền' });
  if (!answer) return;
  const { error } = await supabase.rpc('a2_thu_uy_quyen', { p_nguoi: id, p_ly_do: answer.lyDo });
  if (error) { notifyError('Không thu được: ' + error.message); return; }
  notifySuccess(`Đã thu ủy quyền của ${ten}.`);
  await onDone();
}
