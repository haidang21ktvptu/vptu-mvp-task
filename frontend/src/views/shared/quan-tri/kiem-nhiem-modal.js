// Hộp "Kiêm nhiệm lĩnh vực" (thiết kế KL BTVTU 5.4): PCVP kiêm nhiệm (ngành, lĩnh vực) ở một phòng.
// Dropdown lĩnh vực khoá theo ngành, chọn nhiều; cảnh báo khi chồng lên phạm vi PCVP khác; Lưu gọi
// admin_kiem_nhiem_linh_vuc (một transaction cho mọi lĩnh vực đã chọn).
import { supabase } from '../../../lib/supabase.js';
import { $, show, escapeHtml } from '../../../lib/dom.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { danhSachNganh, linhVucCuaNganh } from './danh-muc.js';
import { nguoiKiemNhiem, nguoiPhuTrachCaPhong, tenNguoi, tenPhong } from './phu-trach-o.js';
import { quanTriKiemNhiemModalTemplate } from './template-linh-vuc.js';
import { todayLocal } from './ly-do-modal.js';
import { danhSachPhong } from './phu-trach.js';

let onDone = null;
let lanhDao = null;

// Vẽ danh sách checkbox lĩnh vực của ngành đang chọn; đánh dấu ô đã có người kiêm nhiệm.
function renderLinhVuc() {
  const phong = $('qtKnPhong').value;
  const nganh = $('qtKnNganh').value;
  const list = linhVucCuaNganh(nganh);
  $('qtKnLinhVuc').innerHTML = list.length === 0
    ? '<span class="chu-phu">Ngành này chưa có lĩnh vực nào trong danh mục.</span>'
    : list.map((lv) => {
      const kn = nguoiKiemNhiem(phong, nganh, lv.ma);
      const cuaToi = kn && kn.lanh_dao_id === lanhDao.id;
      const ghiChu = kn ? (cuaToi ? ' — đang kiêm nhiệm' : ` — đang do ${tenNguoi(kn.lanh_dao_id)} kiêm nhiệm`) : '';
      return `<label class="flex items-center gap-2 ${kn ? 'chu-phu' : ''}">
        <input type="checkbox" name="linhVuc" value="${escapeHtml(lv.ma)}" ${kn ? 'disabled' : ''} ${cuaToi ? 'checked' : ''}>
        <span>${escapeHtml(lv.ten)}${escapeHtml(ghiChu)}</span></label>`;
    }).join('');
  renderCanhBao();
}

// Cảnh báo chồng phạm vi: phòng đã có PCVP khác phụ trách cả phòng (người ấy sẽ mất việc thuộc lĩnh vực này);
// chính PCVP này đang phụ trách cả phòng (kiêm nhiệm thêm là không cần thiết).
function renderCanhBao() {
  const phong = $('qtKnPhong').value;
  const caPhong = nguoiPhuTrachCaPhong(phong);
  const msgs = [];
  if (caPhong.some((r) => r.lanh_dao_id === lanhDao.id)) {
    msgs.push(`${lanhDao.full_name} đang phụ trách cả ${tenPhong(phong)} — kiêm nhiệm thêm là không cần thiết.`);
  }
  caPhong.filter((r) => r.lanh_dao_id !== lanhDao.id).forEach((r) => {
    msgs.push(`${tenNguoi(r.lanh_dao_id)} đang phụ trách cả ${tenPhong(phong)} và sẽ không còn thấy việc thuộc các lĩnh vực được chọn.`);
  });
  const box = $('qtKnCanhBao');
  box.innerText = msgs.join(' ');
  show(box, msgs.length > 0);
}

export function moKiemNhiem({ username }) {
  lanhDao = state.accounts.find((a) => a.username === username);
  if (!lanhDao) return;
  $('qtKnUsername').value = username;
  $('qtKnMoTa').innerText = `${lanhDao.full_name} chỉ thấy việc của phòng đã chọn thuộc đúng (ngành, lĩnh vực) được giao; Phó Chánh Văn phòng phụ trách phòng đó không còn thấy các việc này.`;
  $('qtKnPhong').innerHTML = danhSachPhong().map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(DEPT_NAMES[p])}</option>`).join('');
  $('qtKnNganh').innerHTML = danhSachNganh().map((n) => `<option value="${escapeHtml(n.ma)}">${escapeHtml(n.ten)}</option>`).join('');
  $('qtKnNgay').value = todayLocal();
  $('qtKnLyDo').value = '';
  renderLinhVuc();
  show('qtKiemNhiemModal', true);
  $('qtKnPhong').focus();
}

const dongKiemNhiem = () => show('qtKiemNhiemModal', false);

async function luuKiemNhiem() {
  const chon = [...document.querySelectorAll('#qtKnLinhVuc input[name="linhVuc"]:checked:not(:disabled)')].map((i) => i.value);
  const lyDo = $('qtKnLyDo').value.trim();
  const ngay = $('qtKnNgay').value;
  if (chon.length === 0) { notifyError('Chọn ít nhất một lĩnh vực chưa có người kiêm nhiệm.'); return; }
  if (!ngay) { notifyError('Chọn ngày hiệu lực.'); return; }
  if (!lyDo) { notifyError('Phải ghi lý do — lý do được lưu vào nhật ký cấp quyền.'); $('qtKnLyDo').focus(); return; }
  const { error } = await supabase.rpc('admin_kiem_nhiem_linh_vuc', {
    p_username: $('qtKnUsername').value, p_phong: $('qtKnPhong').value, p_nganh_ma: $('qtKnNganh').value,
    p_linh_vuc_ma: chon, p_bat: true, p_ly_do: lyDo, p_tu_ngay: ngay,
  });
  if (error) {
    notifyError('Không thực hiện được: ' + error.message);
    return;
  }
  dongKiemNhiem();
  notifySuccess(`Đã phân công ${lanhDao.full_name} kiêm nhiệm ${chon.length} lĩnh vực của ${tenPhong($('qtKnPhong').value)}.`);
  if (onDone) await onDone();
}

export function mountKiemNhiemModal(reload) {
  onDone = reload;
  $('modalRoot').insertAdjacentHTML('beforeend', quanTriKiemNhiemModalTemplate);
  $('qtKnPhong').addEventListener('change', renderLinhVuc);
  $('qtKnNganh').addEventListener('change', renderLinhVuc);
  registerActions({ moKiemNhiem, dongKiemNhiem, luuKiemNhiem });
}
