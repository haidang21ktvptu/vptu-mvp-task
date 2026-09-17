// Khu "Tài khoản và cờ đặc quyền" (thiết kế KL BTVTU 5.2, GĐ23): danh sách, cấp/thu quan_tri_kl qua hàm SQL admin_dat_co (quyen_lich_su cùng
// transaction); tạo tài khoản, đặt lại mật khẩu tạm, khoá/mở và cờ quan_tri_he_thong qua Edge Function quan-tri-tai-khoan (nhat_ky_he_thong).
import { supabase } from '../../../lib/supabase.js';
import { $, escapeHtml, formatDateTime, filterRowsByKeyword } from '../../../lib/dom.js';
import { DEPT_NAMES, ROLE_LABELS } from '../../../lib/constants.js';
import { state, findAccount } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { goiQuanTriTaiKhoan } from '../../../lib/quan-tri-api.js';
import { askLyDo } from './ly-do-modal.js';
import { nhanNganhLinhVuc } from './danh-muc.js';
import { hienMatKhauTam } from './tai-khoan-form.js';

export const SO_NGUOI_QUAN_TRI_KL = 2; // quy định: đúng hai người (một Tổng hợp, một CĐS-CY)
const nut = (label, action, a, extra = '') => `<button type="button" class="nut nho" data-action="${action}" data-id="${a.id}" data-username="${escapeHtml(a.username)}" ${extra}>${label}</button>`;

function taiKhoanRowHtml(a) {
  const me = a.id === state.user.id;
  const search = `${a.full_name} ${a.username}`.toLowerCase();
  const kl = a.quan_tri_kl ? `<span class="trang-thai tt-xong">Có quyền${a.quan_tri_kl_het_han ? ` đến ${a.quan_tri_kl_het_han.split('-').reverse().join('/')}` : ''}</span>` : '<span class="trang-thai tt-xam">Không</span>';
  const ht = a.quan_tri_he_thong ? '<span class="trang-thai tt-cho">Quản trị hệ thống</span>' : '';
  const khoa = a.bi_khoa ? '<span class="trang-thai tt-qua">Đã khoá</span>' : '';
  const btnKl = `<button type="button" class="nut nho ${a.quan_tri_kl ? 'chinh' : ''}" data-action="toggleQuanTriKl" data-username="${escapeHtml(a.username)}" data-bat="${a.quan_tri_kl ? '0' : '1'}"
      aria-label="${a.quan_tri_kl ? 'Thu' : 'Cấp'} quyền quản trị KL của ${escapeHtml(a.full_name)}">${a.quan_tri_kl ? 'Thu quyền' : 'Cấp quyền'}</button>`;
  const btnHt = me ? '' : nut(a.quan_tri_he_thong ? 'Thu QTHT' : 'Cấp QTHT', 'toggleQuanTriHeThong', a, `data-bat="${a.quan_tri_he_thong ? '0' : '1'}"`);
  const btnKhoa = me || a.quan_tri_he_thong ? '' : nut(a.bi_khoa ? 'Mở khoá' : 'Khoá', 'khoaTaiKhoan', a, `data-bat="${a.bi_khoa ? '0' : '1'}"`);
  return `
    <tr data-search="${escapeHtml(search)}">
      <td class="tieude">${escapeHtml(a.full_name)}${me ? ' (tôi)' : ''}<small>${escapeHtml(a.username)}${a.dien_thoai ? ` · ${escapeHtml(a.dien_thoai)}` : ''}</small></td>
      <td data-nhan="Phòng">${escapeHtml(DEPT_NAMES[a.department] || a.department || '')}</td>
      <td data-nhan="Vai trò">${escapeHtml(ROLE_LABELS[a.role_group] || a.role_group)}</td>
      <td data-nhan="Quản trị KL BTVTU">${kl}</td>
      <td data-nhan="Hệ thống">${ht}${khoa}</td>
      <td><div class="thao-tac">${btnKl}${btnHt}${nut('Đặt lại mật khẩu', 'resetMatKhau', a)}${btnKhoa}</div></td>
    </tr>`;
}

// Dòng vàng theo 5.2: số người giữ quan_tri_kl ≠ 2; chủ dự án đang tự giữ quan_tri_kl.
function renderCanhBao(accounts) {
  const soKl = accounts.filter((a) => a.quan_tri_kl).length;
  const msgs = [];
  if (soKl !== SO_NGUOI_QUAN_TRI_KL) msgs.push(`Đang có ${soKl} người giữ quyền quản trị KL BTVTU (quy định: ${SO_NGUOI_QUAN_TRI_KL}).`);
  if (state.user.quan_tri_kl) msgs.push('Đồng chí đang tự giữ quyền quản trị KL — thu lại khi xong việc.');
  const box = $('qtCanhBao');
  box.innerText = msgs.join(' ');
  box.classList.toggle('hidden', msgs.length === 0);
  $('qtSoNguoiKl').innerText = `${soKl}/${SO_NGUOI_QUAN_TRI_KL} người giữ quyền quản trị KL`;
}

export function renderTaiKhoan() {
  const accounts = [...state.accounts].sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
  renderCanhBao(accounts);
  $('qtTaiKhoanBody').innerHTML = accounts.length === 0 ? '<tr><td colspan="6" class="trong">Không có tài khoản.</td></tr>' : accounts.map(taiKhoanRowHtml).join('');
  filterRowsByKeyword('qtTaiKhoanBody', $('qtTimTaiKhoan').value);
}

// Nhãn cột "Quyền": quan_tri_kl | quan_tri_he_thong | phu_trach:<phòng> | kiem_nhiem:<phòng>:<ngành>:<lĩnh vực> (0013, 0018).
function nhanQuyen(co) {
  const [loai, phong, nganh, linhVuc] = co.split(':');
  if (loai === 'phu_trach') return `Phụ trách cả ${DEPT_NAMES[phong] || phong}`;
  if (loai === 'kiem_nhiem') return `Kiêm nhiệm ${nhanNganhLinhVuc(nganh, linhVuc)} — ${DEPT_NAMES[phong] || phong}`;
  return { quan_tri_kl: 'Quản trị KL BTVTU', quan_tri_he_thong: 'Quản trị hệ thống' }[co] || co;
}

function nhatKyRowHtml(r) {
  const nguoi = r.cap_boi ? findAccount(r.cap_boi)?.full_name || r.cap_boi : (r.cap_boi_ghi_chu || 'Hệ thống');
  const tk = findAccount(r.tai_khoan)?.full_name || r.tai_khoan;
  return `<tr><td class="whitespace-nowrap">${formatDateTime(r.luc)}</td><td data-nhan="Người thực hiện">${escapeHtml(nguoi)}</td><td data-nhan="Tài khoản">${escapeHtml(tk)}</td>
      <td data-nhan="Quyền">${escapeHtml(nhanQuyen(r.co))}</td><td data-nhan="Bật/Tắt"><span class="trang-thai ${r.bat ? 'tt-xong' : 'tt-qua'}">${r.bat ? 'Bật' : 'Tắt'}</span></td><td data-nhan="Lý do">${escapeHtml(r.ly_do)}</td></tr>`;
}

export async function renderNhatKy() {
  const { data, error } = await supabase.from('quyen_lich_su').select('luc, cap_boi, cap_boi_ghi_chu, tai_khoan, co, bat, ly_do').order('id', { ascending: false }).limit(50);
  if (error) { notifyError('Không đọc được nhật ký: ' + error.message); return; }
  $('qtNhatKyBody').innerHTML = data.length === 0 ? '<tr><td colspan="6" class="trong">Chưa có lần cấp quyền nào.</td></tr>' : data.map(nhatKyRowHtml).join('');
}

// Bấm "Cấp quyền"/"Thu quyền" → hộp lý do → admin_dat_co → nạp lại (onDone do index.js truyền vào).
export async function toggleQuanTriKl({ username, bat }, onDone) {
  const acc = state.accounts.find((a) => a.username === username);
  if (!acc) return;
  const turnOn = bat === '1';
  const answer = await askLyDo({
    title: turnOn ? 'Cấp quyền quản trị KL BTVTU' : 'Thu quyền quản trị KL BTVTU',
    moTa: `${turnOn ? 'Cấp cho' : 'Thu của'} ${acc.full_name} (${username}). Người này ${turnOn ? 'sẽ' : 'sẽ không còn'} nhập hội nghị, sửa mọi nhiệm vụ KL, duyệt đính chính và xuất báo cáo.`,
    nhanXacNhan: turnOn ? 'Cấp quyền' : 'Thu quyền',
  });
  if (!answer) return;
  const { error } = await supabase.rpc('admin_dat_co', { p_username: username, p_co: 'quan_tri_kl', p_bat: turnOn, p_ly_do: answer.lyDo });
  if (error) { notifyError('Không thực hiện được: ' + error.message); return; }
  notifySuccess(`${turnOn ? 'Đã cấp' : 'Đã thu'} quyền quản trị KL BTVTU ${turnOn ? 'cho' : 'của'} ${acc.full_name}.`);
  await onDone();
}

// Ba thao tác qua Edge Function: cờ quan_tri_he_thong (lý do bắt buộc), khoá/mở (lý do), đặt lại mật khẩu tạm (hiện một lần).
export async function toggleQuanTriHeThong({ id, username, bat }, onDone) {
  const turnOn = bat === '1';
  const answer = await askLyDo({ title: turnOn ? 'Cấp quyền quản trị hệ thống' : 'Thu quyền quản trị hệ thống', moTa: `Tài khoản ${username}. Quản trị hệ thống tạo/khoá tài khoản, dọn dữ liệu, sửa cấu hình.`, nhanXacNhan: turnOn ? 'Cấp' : 'Thu' });
  if (!answer) return;
  try { await goiQuanTriTaiKhoan({ hanh_dong: 'cap_co', id, co: 'quan_tri_he_thong', bat: turnOn, ly_do: answer.lyDo }); notifySuccess('Đã cập nhật cờ quản trị hệ thống.'); await onDone(); } catch (e) { notifyError(e.message); }
}

export async function khoaTaiKhoan({ id, username, bat }, onDone) {
  const khoa = bat === '1';
  const answer = await askLyDo({ title: khoa ? 'Khoá tài khoản' : 'Mở khoá tài khoản', moTa: `Tài khoản ${username}. ${khoa ? 'Người này sẽ không đăng nhập được cho tới khi mở khoá.' : 'Người này đăng nhập lại được với mật khẩu hiện có.'}`, nhanXacNhan: khoa ? 'Khoá' : 'Mở khoá' });
  if (!answer) return;
  try { await goiQuanTriTaiKhoan({ hanh_dong: khoa ? 'khoa' : 'mo', id, ly_do: answer.lyDo }); notifySuccess(khoa ? 'Đã khoá tài khoản.' : 'Đã mở khoá.'); await onDone(); } catch (e) { notifyError(e.message); }
}

export async function resetMatKhau({ id, username }, onDone) {
  const answer = await askLyDo({ title: 'Đặt lại mật khẩu tạm', moTa: `Tài khoản ${username} nhận mật khẩu tạm mới và phải đổi khi đăng nhập.`, nhanXacNhan: 'Đặt lại' });
  if (!answer) return;
  try { const kq = await goiQuanTriTaiKhoan({ hanh_dong: 'reset_mat_khau', id, ly_do: answer.lyDo }); hienMatKhauTam(username, kq.mat_khau_tam); await onDone(); } catch (e) { notifyError(e.message); }
}
