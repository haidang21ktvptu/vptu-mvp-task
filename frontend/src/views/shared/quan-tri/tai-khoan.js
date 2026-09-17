// Phần "Tài khoản và cờ đặc quyền" + cảnh báo + nhật ký (thiết kế KL BTVTU 5.2).
// Cấp/thu quan_tri_kl chỉ qua hàm SQL admin_dat_co (ghi quyen_lich_su cùng transaction).
import { supabase } from '../../../lib/supabase.js';
import { $, escapeHtml, formatDateTime, filterRowsByKeyword } from '../../../lib/dom.js';
import { DEPT_NAMES, ROLE_LABELS } from '../../../lib/constants.js';
import { state, findAccount } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { askLyDo } from './ly-do-modal.js';
import { nhanNganhLinhVuc } from './danh-muc.js';

export const SO_NGUOI_QUAN_TRI_KL = 2; // quy định: đúng hai người (một Tổng hợp, một CĐS-CY)

function taiKhoanRowHtml(a) {
  const me = a.id === state.user.id;
  const search = `${a.full_name} ${a.username}`.toLowerCase();
  const kl = a.quan_tri_kl
    ? '<span class="trang-thai tt-xong">Có quyền</span>'
    : '<span class="trang-thai tt-xam">Không</span>';
  const ht = a.quan_tri_he_thong ? '<span class="trang-thai tt-cho">Chủ dự án</span>' : '';
  const btn = `<button type="button" class="nut nho ${a.quan_tri_kl ? 'chinh' : ''}"
      data-action="toggleQuanTriKl" data-username="${escapeHtml(a.username)}" data-bat="${a.quan_tri_kl ? '0' : '1'}"
      aria-label="${a.quan_tri_kl ? 'Thu' : 'Cấp'} quyền quản trị KL của ${escapeHtml(a.full_name)}">${a.quan_tri_kl ? 'Thu quyền' : 'Cấp quyền'}</button>`;
  return `
    <tr data-search="${escapeHtml(search)}">
      <td class="tieude">${escapeHtml(a.full_name)}${me ? ' (tôi)' : ''}<small>${escapeHtml(a.username)}</small></td>
      <td data-nhan="Phòng">${escapeHtml(DEPT_NAMES[a.department] || a.department || '')}</td>
      <td data-nhan="Vai trò">${escapeHtml(ROLE_LABELS[a.role_group] || a.role_group)}</td>
      <td data-nhan="Quản trị KL BTVTU">${kl}</td>
      <td data-nhan="Quản trị hệ thống">${ht}</td>
      <td><div class="thao-tac">${btn}</div></td>
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
  $('qtTaiKhoanBody').innerHTML = accounts.length === 0
    ? '<tr><td colspan="6" class="trong">Không có tài khoản.</td></tr>'
    : accounts.map(taiKhoanRowHtml).join('');
  filterRowsByKeyword('qtTaiKhoanBody', $('qtTimTaiKhoan').value);
}

// Nhãn cột "Quyền": quan_tri_kl | phu_trach:<phòng> | kiem_nhiem:<phòng>:<ngành>:<lĩnh vực> (0013, 0018).
function nhanQuyen(co) {
  const [loai, phong, nganh, linhVuc] = co.split(':');
  if (loai === 'phu_trach') return `Phụ trách cả ${DEPT_NAMES[phong] || phong}`;
  if (loai === 'kiem_nhiem') return `Kiêm nhiệm ${nhanNganhLinhVuc(nganh, linhVuc)} — ${DEPT_NAMES[phong] || phong}`;
  return co === 'quan_tri_kl' ? 'Quản trị KL BTVTU' : co;
}

function nhatKyRowHtml(r) {
  const nguoi = r.cap_boi ? findAccount(r.cap_boi)?.full_name || r.cap_boi : (r.cap_boi_ghi_chu || 'Hệ thống');
  const tk = findAccount(r.tai_khoan)?.full_name || r.tai_khoan;
  const quyen = nhanQuyen(r.co);
  return `
    <tr>
      <td class="whitespace-nowrap">${formatDateTime(r.luc)}</td>
      <td data-nhan="Người thực hiện">${escapeHtml(nguoi)}</td>
      <td data-nhan="Tài khoản">${escapeHtml(tk)}</td>
      <td data-nhan="Quyền">${escapeHtml(quyen)}</td>
      <td data-nhan="Bật/Tắt"><span class="trang-thai ${r.bat ? 'tt-xong' : 'tt-qua'}">${r.bat ? 'Bật' : 'Tắt'}</span></td>
      <td data-nhan="Lý do">${escapeHtml(r.ly_do)}</td>
    </tr>`;
}

export async function renderNhatKy() {
  const { data, error } = await supabase.from('quyen_lich_su')
    .select('luc, cap_boi, cap_boi_ghi_chu, tai_khoan, co, bat, ly_do')
    .order('id', { ascending: false }).limit(50);
  if (error) {
    notifyError('Không đọc được nhật ký: ' + error.message);
    return;
  }
  $('qtNhatKyBody').innerHTML = data.length === 0
    ? '<tr><td colspan="6" class="trong">Chưa có lần cấp quyền nào.</td></tr>'
    : data.map(nhatKyRowHtml).join('');
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
  if (error) {
    notifyError('Không thực hiện được: ' + error.message);
    return;
  }
  notifySuccess(`${turnOn ? 'Đã cấp' : 'Đã thu'} quyền quản trị KL BTVTU ${turnOn ? 'cho' : 'của'} ${acc.full_name}.`);
  await onDone();
}
