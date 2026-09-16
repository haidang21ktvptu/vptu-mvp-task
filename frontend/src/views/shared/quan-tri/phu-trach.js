// Phần "Phó Chánh Văn phòng phụ trách phòng" (thiết kế KL BTVTU 5.4): bảng hai chiều lãnh đạo × phòng.
// Ô = nút "Cả phòng" (tối đa 2 phòng mỗi PCVP) + các chip "Kiêm nhiệm: lĩnh vực (ngành)" của phòng đó.
// Đổi = hộp lý do + ngày hiệu lực → admin_phan_cong_phong (đóng den_ngay, không xoá dòng cũ).
// Chánh Văn phòng là dòng cố định (phụ trách mọi phòng); trưởng phòng tự phụ trách phòng mình, không hiện ở đây.
import { supabase } from '../../../lib/supabase.js';
import { $, escapeHtml } from '../../../lib/dom.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { state } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { askLyDo } from './ly-do-modal.js';
import { nhanNganhLinhVuc } from './danh-muc.js';
import { loadActive, cellHtml, tenPhong } from './phu-trach-o.js';

// Danh sách phòng: theo hằng DEPT_NAMES (trừ khối lãnh đạo) + phòng chỉ có trong danh bạ.
export function danhSachPhong() {
  const list = Object.keys(DEPT_NAMES).filter((k) => k !== 'LANH_DAO_VAN_PHONG');
  state.accounts.forEach((a) => {
    if (a.department && a.department !== 'LANH_DAO_VAN_PHONG' && !list.includes(a.department)) list.push(a.department);
  });
  return list;
}

export async function renderPhuTrach() {
  try {
    await loadActive();
  } catch (e) {
    notifyError('Không đọc được bảng phân công: ' + e.message);
    return;
  }
  const phong = danhSachPhong();
  const leaders = state.accounts.filter((a) => a.role_group === 'A1').sort((a, b) => (b.is_chief - a.is_chief) || a.full_name.localeCompare(b.full_name, 'vi'));

  $('qtPhuTrachHead').innerHTML = '<th>Lãnh đạo</th>' + phong.map((p) => `<th class="so">${escapeHtml(tenPhong(p))}</th>`).join('') + '<th class="phai">Kiêm nhiệm</th>';
  $('qtPhuTrachBody').innerHTML = leaders.length === 0
    ? `<tr><td colspan="${phong.length + 2}" class="trong">Chưa có tài khoản Lãnh đạo Văn phòng.</td></tr>`
    : leaders.map((ld) => `
      <tr>
        <td class="tieude">${escapeHtml(ld.full_name)}<small>${escapeHtml(ld.position_title)}</small></td>
        ${ld.is_chief
          ? `<td colspan="${phong.length + 1}" class="so"><span class="trang-thai tt-xong">Chánh Văn phòng — phụ trách mọi phòng</span></td>`
          : phong.map((p) => cellHtml(ld, p)).join('') + `
        <td><div class="thao-tac"><button type="button" class="nut nho" data-action="moKiemNhiem" data-username="${escapeHtml(ld.username)}"
          aria-label="Kiêm nhiệm lĩnh vực cho ${escapeHtml(ld.full_name)}">Kiêm nhiệm lĩnh vực</button></div></td>`}
      </tr>`).join('');
}

export async function togglePhuTrach({ username, phong, bat }, onDone) {
  const acc = state.accounts.find((a) => a.username === username);
  if (!acc) return;
  const turnOn = bat === '1';
  const answer = await askLyDo({
    title: turnOn ? 'Phân công phụ trách cả phòng' : 'Kết thúc phụ trách phòng',
    moTa: `${acc.full_name} ${turnOn ? 'phụ trách cả' : 'thôi phụ trách'} ${DEPT_NAMES[phong] || phong} kể từ ngày hiệu lực. Lịch sử phân công cũ được giữ nguyên.`,
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

// Nút "Kết thúc" trên một chip kiêm nhiệm: đóng đúng dòng (phòng, ngành, lĩnh vực) từ ngày chọn.
export async function ketThucKiemNhiem({ username, phong, nganh, linhVuc }, onDone) {
  const acc = state.accounts.find((a) => a.username === username);
  if (!acc) return;
  const nhan = nhanNganhLinhVuc(nganh, linhVuc);
  const answer = await askLyDo({
    title: 'Kết thúc kiêm nhiệm lĩnh vực',
    moTa: `${acc.full_name} thôi kiêm nhiệm ${nhan} của ${DEPT_NAMES[phong] || phong} kể từ ngày hiệu lực. Việc thuộc lĩnh vực này trở về Phó Chánh Văn phòng phụ trách phòng.`,
    canNgay: true,
    nhanXacNhan: 'Kết thúc',
  });
  if (!answer) return;
  const { error } = await supabase.rpc('admin_phan_cong_phong', {
    p_username: username, p_phong: phong, p_bat: false, p_ly_do: answer.lyDo, p_tu_ngay: answer.ngay, p_nganh_ma: nganh, p_linh_vuc_ma: linhVuc,
  });
  if (error) {
    notifyError('Không thực hiện được: ' + error.message);
    return;
  }
  notifySuccess(`Đã kết thúc kiêm nhiệm ${nhan} của ${acc.full_name}.`);
  await onDone();
}
