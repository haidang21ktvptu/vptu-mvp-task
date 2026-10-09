// Khu "Tài khoản và cờ đặc quyền" (thiết kế KL BTVTU 5.2, GĐ23): danh sách, cấp/thu thư ký Thường trực qua hàm SQL admin_dat_co (quyen_lich_su cùng
// transaction; Đợt F v3.21 / 0096: bỏ quyền quản trị nhiệm vụ — nhập Excel, thay mặt, danh mục là quyền chung); tạo tài khoản, đặt lại mật khẩu tạm, khoá/mở và cờ quan_tri_he_thong qua Edge Function quan-tri-tai-khoan (nhat_ky_he_thong).
import { supabase } from '../../../lib/supabase.js';
import { $, escapeHtml, formatDateTime, filterRowsByKeyword } from '../../../lib/dom.js';
import { DEPT_NAMES, ROLE_LABELS } from '../../../lib/constants.js';
import { state, findAccount } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { goiQuanTriTaiKhoan } from '../../../lib/quan-tri-api.js';
import { askLyDo } from './ly-do-modal.js';
import { nhanNganhLinhVuc } from './danh-muc.js';
import { hienMatKhauTam } from './tai-khoan-form.js';
import { duocChuyenTheoDoi } from './chuyen-theo-doi.js';

const nut = (label, action, a, extra = '') => `<button type="button" class="nut nho" data-action="${action}" data-id="${a.id}" data-username="${escapeHtml(a.username)}" ${extra}>${label}</button>`;

function taiKhoanRowHtml(a) {
  const me = a.id === state.user.id;
  const search = `${a.full_name} ${a.username}`.toLowerCase();
  const ht = a.quan_tri_he_thong ? '<span class="trang-thai tt-cho">Quản trị hệ thống</span>' : '';
  const tk = a.thu_ky_thuong_truc ? '<span class="trang-thai tt-xong nhan-thu-ky-tt">Thư ký Thường trực</span>' : ''; // 0047: đóng chỉ đạo TT thay mặt
  const khoa = a.bi_khoa ? '<span class="trang-thai tt-qua">Đã khoá</span>' : '';
  const btnHt = me ? '' : nut(a.quan_tri_he_thong ? 'Thu QTHT' : 'Cấp QTHT', 'toggleQuanTriHeThong', a, `data-bat="${a.quan_tri_he_thong ? '0' : '1'}"`);
  const btnTk = a.role_group === 'A0' ? '' : nut(a.thu_ky_thuong_truc ? 'Thu thư ký TT' : 'Cấp thư ký TT', 'toggleThuKyTT', a, `data-bat="${a.thu_ky_thuong_truc ? '0' : '1'}"`);
  const btnKhoa = me || a.quan_tri_he_thong ? '' : nut(a.bi_khoa ? 'Mở khoá' : 'Khoá', 'khoaTaiKhoan', a, `data-bat="${a.bi_khoa ? '0' : '1'}"`);
  const btnSua = state.user.quan_tri_he_thong && !a.is_system ? nut('Sửa', 'moSuaTaiKhoan', a, `aria-label="Sửa vai trò, phòng, chức danh của ${escapeHtml(a.full_name)}"`) : ''; // PR-4, 0068
  const btnCtd = duocChuyenTheoDoi() && !a.is_system && a.role_group !== 'A0' ? nut('Chuyển việc theo dõi', 'moChuyenTheoDoi', a, `aria-label="Chuyển việc đang theo dõi của ${escapeHtml(a.full_name)}"`) : '';   // J-6, 0092
  return `
    <tr data-search="${escapeHtml(search)}">
      <td class="tieude">${escapeHtml(a.full_name)}${me ? ' (tôi)' : ''}<small>${escapeHtml(a.username)}${a.position_title ? ` · ${escapeHtml(a.position_title)}` : ''}${a.dien_thoai ? ` · ${escapeHtml(a.dien_thoai)}` : ''}</small></td>
      <td data-nhan="Phòng">${escapeHtml(DEPT_NAMES[a.department] || a.department || '')}</td>
      <td data-nhan="Vai trò">${escapeHtml(ROLE_LABELS[a.role_group] || a.role_group)}</td>
      <td data-nhan="Quyền">${ht}${tk}${khoa}</td>
      <td><div class="thao-tac">${btnSua}${btnCtd}${btnHt}${btnTk}${nut('Đặt lại mật khẩu', 'resetMatKhau', a)}${btnKhoa}</div></td>
    </tr>`;
}

export function renderTaiKhoan() {
  const accounts = [...state.accounts].sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
  $('qtTaiKhoanBody').innerHTML = accounts.length === 0 ? '<tr><td colspan="5" class="trong">Không có tài khoản.</td></tr>' : accounts.map(taiKhoanRowHtml).join('');
  filterRowsByKeyword('qtTaiKhoanBody', $('qtTimTaiKhoan').value);
}

// Nhãn cột "Quyền": quan_tri_kl (đã bỏ từ 0096) | quan_tri_he_thong | thu_ky_thuong_truc | phu_trach:<phòng> | kiem_nhiem:<phòng>:<ngành>:<lĩnh vực> (0013, 0018, 0047).
function nhanQuyen(co) {
  const [loai, phong, nganh, linhVuc] = co.split(':');
  if (loai === 'phu_trach') return `Phụ trách cả ${DEPT_NAMES[phong] || phong}`;
  if (loai === 'kiem_nhiem') return `Kiêm nhiệm ${nhanNganhLinhVuc(nganh, linhVuc)} — ${DEPT_NAMES[phong] || phong}`;
  return { quan_tri_kl: 'Quản trị nhiệm vụ (đã bỏ từ v3.21)', quan_tri_he_thong: 'Quản trị hệ thống', thu_ky_thuong_truc: 'Thư ký Thường trực' }[co] || co;
}

// Dòng sửa tài khoản (0068): co = sua:<cột>, gia_tri_cu → gia_tri_moi.
const TEN_COT_SUA = { role_group: 'vai trò', department: 'phòng', position_title: 'chức danh' };
const giaTriSua = (cot, v) => (v == null || v === '' ? '(trống)' : cot === 'role_group' ? ROLE_LABELS[v] || v : cot === 'department' ? DEPT_NAMES[v] || v : v);

function nhatKyRowHtml(r) {
  const cotSua = r.co.startsWith('sua:') ? r.co.slice(4) : null;
  const quyen = cotSua ? `Sửa ${TEN_COT_SUA[cotSua] || cotSua}: ${giaTriSua(cotSua, r.gia_tri_cu)} → ${giaTriSua(cotSua, r.gia_tri_moi)}` : nhanQuyen(r.co);
  const batTat = cotSua ? '<span class="trang-thai tt-cho">Sửa</span>' : `<span class="trang-thai ${r.bat ? 'tt-xong' : 'tt-qua'}">${r.bat ? 'Bật' : 'Tắt'}</span>`;
  const nguoi = r.cap_boi ? findAccount(r.cap_boi)?.full_name || r.cap_boi : (r.cap_boi_ghi_chu || 'Hệ thống');
  const tk = findAccount(r.tai_khoan)?.full_name || r.tai_khoan;
  return `<tr><td class="whitespace-nowrap">${formatDateTime(r.luc)}</td><td data-nhan="Người thực hiện">${escapeHtml(nguoi)}</td><td data-nhan="Tài khoản">${escapeHtml(tk)}</td>
      <td data-nhan="Quyền">${escapeHtml(quyen)}</td><td data-nhan="Bật/Tắt">${batTat}</td><td data-nhan="Lý do">${escapeHtml(r.ly_do)}</td></tr>`;
}

export async function renderNhatKy() {
  const { data, error } = await supabase.from('quyen_lich_su').select('luc, cap_boi, cap_boi_ghi_chu, tai_khoan, co, bat, ly_do, gia_tri_cu, gia_tri_moi').order('id', { ascending: false }).limit(50);
  if (error) { notifyError('Không đọc được nhật ký: ' + error.message); return; }
  $('qtNhatKyBody').innerHTML = data.length === 0 ? '<tr><td colspan="6" class="trong">Chưa có lần cấp quyền nào.</td></tr>' : data.map(nhatKyRowHtml).join('');
}

export async function toggleThuKyTT({ username, bat }, onDone) {
  const acc = state.accounts.find((a) => a.username === username);
  if (!acc) return;
  const turnOn = bat === '1';
  const answer = await askLyDo({
    title: turnOn ? 'Cấp quyền thư ký Thường trực' : 'Thu quyền thư ký Thường trực',
    moTa: `${turnOn ? 'Cấp cho' : 'Thu của'} ${acc.full_name} (${username}). Thư ký ${turnOn ? 'sẽ' : 'sẽ không còn'} xem việc có chỉ đạo Thường trực và đóng chỉ đạo Thường trực thay mặt; không gửi chỉ đạo, không ghi gì khác.`,
    nhanXacNhan: turnOn ? 'Cấp quyền' : 'Thu quyền',
  });
  if (!answer) return;
  const { error } = await supabase.rpc('admin_dat_co', { p_username: username, p_co: 'thu_ky_thuong_truc', p_bat: turnOn, p_ly_do: answer.lyDo });
  if (error) { notifyError('Không thực hiện được: ' + error.message); return; }
  notifySuccess(`${turnOn ? 'Đã cấp' : 'Đã thu'} quyền thư ký Thường trực ${turnOn ? 'cho' : 'của'} ${acc.full_name}.`);
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
