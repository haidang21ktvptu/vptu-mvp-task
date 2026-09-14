// Phần "Phó Chánh Văn phòng phụ trách phòng" (thiết kế KL BTVTU 5.4): bảng hai chiều lãnh đạo × phòng,
// ô = phân công đang hiệu lực. Đổi = hộp lý do + ngày hiệu lực → admin_phan_cong_phong (không xoá dòng cũ).
// Chánh Văn phòng là dòng cố định (phụ trách mọi phòng); trưởng phòng tự phụ trách phòng mình, không hiện ở đây.
import { supabase } from '../../../lib/supabase.js';
import { $, escapeHtml } from '../../../lib/dom.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { state } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { askLyDo } from './ly-do-modal.js';

let active = []; // dòng phu_trach_phong đang hiệu lực (den_ngay null)

// Danh sách phòng: theo hằng DEPT_NAMES (trừ khối lãnh đạo) + phòng chỉ có trong danh bạ.
function danhSachPhong() {
  const list = Object.keys(DEPT_NAMES).filter((k) => k !== 'LANH_DAO_VAN_PHONG');
  state.accounts.forEach((a) => {
    if (a.department && a.department !== 'LANH_DAO_VAN_PHONG' && !list.includes(a.department)) list.push(a.department);
  });
  return list;
}

function tenPhong(ma) {
  return (DEPT_NAMES[ma] || ma).replace(/^Phòng /, '');
}

function cellHtml(pcvp, phong) {
  const on = active.some((p) => p.lanh_dao_id === pcvp.id && p.phong === phong);
  return `<td data-nhan="${escapeHtml(tenPhong(phong))}" class="so">
    <button type="button" class="btn btn-nho ${on ? 'btn-cham' : 'btn-phu'}" role="switch" aria-checked="${on}"
      data-action="togglePhuTrach" data-username="${escapeHtml(pcvp.username)}" data-phong="${escapeHtml(phong)}" data-bat="${on ? '0' : '1'}"
      aria-label="${escapeHtml(pcvp.full_name)} ${on ? 'đang' : 'không'} phụ trách ${escapeHtml(tenPhong(phong))}">${on ? 'Đang phụ trách' : '—'}</button>
  </td>`;
}

export async function renderPhuTrach() {
  const { data, error } = await supabase.from('phu_trach_phong')
    .select('lanh_dao_id, phong, tu_ngay').is('den_ngay', null);
  if (error) {
    notifyError('Không đọc được bảng phân công: ' + error.message);
    return;
  }
  active = data;
  const phong = danhSachPhong();
  const leaders = state.accounts.filter((a) => a.role_group === 'A1').sort((a, b) => (b.is_chief - a.is_chief) || a.full_name.localeCompare(b.full_name, 'vi'));

  $('qtPhuTrachHead').innerHTML = '<th>Lãnh đạo</th>' + phong.map((p) => `<th class="so">${escapeHtml(tenPhong(p))}</th>`).join('');
  $('qtPhuTrachBody').innerHTML = leaders.length === 0
    ? `<tr><td colspan="${phong.length + 1}" class="trong">Chưa có tài khoản Lãnh đạo Văn phòng.</td></tr>`
    : leaders.map((ld) => `
      <tr>
        <td class="tieude">${escapeHtml(ld.full_name)}<small>${escapeHtml(ld.position_title)}</small></td>
        ${ld.is_chief
          ? `<td colspan="${phong.length}" class="so"><span class="muc muc-xanh">Chánh Văn phòng — phụ trách mọi phòng</span></td>`
          : phong.map((p) => cellHtml(ld, p)).join('')}
      </tr>`).join('');
}

export async function togglePhuTrach({ username, phong, bat }, onDone) {
  const acc = state.accounts.find((a) => a.username === username);
  if (!acc) return;
  const turnOn = bat === '1';
  const answer = await askLyDo({
    title: turnOn ? 'Phân công phụ trách phòng' : 'Kết thúc phụ trách phòng',
    moTa: `${acc.full_name} ${turnOn ? 'phụ trách' : 'thôi phụ trách'} ${DEPT_NAMES[phong] || phong} kể từ ngày hiệu lực. Lịch sử phân công cũ được giữ nguyên.`,
    canNgay: true,
    nhanXacNhan: turnOn ? 'Phân công' : 'Kết thúc',
  });
  if (!answer) return;
  const { error } = await supabase.rpc('admin_phan_cong_phong', {
    p_username: username, p_phong: phong, p_bat: turnOn, p_ly_do: answer.lyDo, p_tu_ngay: answer.ngay,
  });
  if (error) {
    notifyError('Không thực hiện được: ' + error.message);
    return;
  }
  notifySuccess(`${turnOn ? 'Đã phân công' : 'Đã kết thúc phân công'} ${acc.full_name} ↔ ${DEPT_NAMES[phong] || phong}.`);
  await onDone();
}
