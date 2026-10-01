// Hộp "Sửa tài khoản" (PR-4, hàm SQL admin_sua_tai_khoan 0068): vai trò / phòng / chức danh + lý do bắt buộc (ghi nhật ký cấp quyền cũ → mới).
// Quy tắc thật ở hàm SQL (một Trưởng phòng mỗi phòng, không tự đổi vai, không đổi vai Chánh VP, rời A1 còn phân công, sang A0 còn cờ);
// ở đây chỉ ẩn/khoá ô cho dễ dùng và hiện nguyên văn lỗi của DB trong hộp.
import { supabase } from '../../../lib/supabase.js';
import { $, show, showInlineError, escapeHtml } from '../../../lib/dom.js';
import { DEPT_NAMES, ROLE_LABELS } from '../../../lib/constants.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess } from '../../../components/toast.js';
import { danhSachPhong } from './phu-trach.js';

const PHONG_LANH_DAO = 'LANH_DAO_VAN_PHONG';
const THU_TU_VAI = ['A3', 'A2', 'A1', 'A0'];
let onDone = async () => {};
let dangSua = null;

const template = `
<div id="qtSuaTkModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="qtSuaTkTitle">
  <form id="qtSuaTkForm" class="modal" data-submit="luuSuaTaiKhoan" novalidate>
    <h2 id="qtSuaTkTitle" class="modal-tieu-de">Sửa tài khoản</h2>
    <p id="qtSuaTkMoTa" class="chu-phu" style="margin-top:6px"></p>
    <label class="nhan" for="qtSuaTkVai">Vai trò</label>
    <select id="qtSuaTkVai" class="o-nhap">${THU_TU_VAI.map((v) => `<option value="${v}">${escapeHtml(ROLE_LABELS[v])}</option>`).join('')}</select>
    <p id="qtSuaTkVaiGhiChu" class="chu-phu hidden"></p>
    <div id="qtSuaTkPhongWrap"><label class="nhan" for="qtSuaTkPhong">Phòng</label><select id="qtSuaTkPhong" class="o-nhap"></select></div>
    <label class="nhan" for="qtSuaTkChucDanh">Chức danh</label>
    <input type="text" id="qtSuaTkChucDanh" class="o-nhap" placeholder="Chuyên viên / Phó Trưởng phòng / Phó Chánh Văn phòng…">
    <label class="nhan" for="qtSuaTkLyDo">Lý do (bắt buộc, ghi vào nhật ký)</label>
    <input type="text" id="qtSuaTkLyDo" class="o-nhap" placeholder="Ví dụ: Quyết định số .../QĐ-VPTU ngày ...">
    <div id="qtSuaTkError" class="loi-inline hidden" role="alert"></div>
    <div class="modal-chan"><button type="button" class="nut" data-action="dongSuaTaiKhoan">Huỷ</button><button type="submit" id="qtSuaTkLuu" class="nut chinh">Lưu thay đổi</button></div>
  </form>
</div>`;

// Phòng theo vai: A0 ẩn (không phòng); A1 cố định "Lãnh đạo Văn phòng"; A2/A3 chọn trong danh sách phòng chuyên môn (như bảng Phân công).
function veOPhong(phongDangChon) {
  const vai = $('qtSuaTkVai').value;
  const sel = $('qtSuaTkPhong');
  show('qtSuaTkPhongWrap', vai !== 'A0');
  const ds = vai === 'A1' ? [PHONG_LANH_DAO] : danhSachPhong();
  sel.innerHTML = ds.map((k) => `<option value="${escapeHtml(k)}">${escapeHtml(DEPT_NAMES[k] || k)}</option>`).join('');
  if (ds.includes(phongDangChon)) sel.value = phongDangChon;
  sel.disabled = vai === 'A1';
}

const phongTheoVai = (vai, phong) => (vai === 'A0' ? null : vai === 'A1' ? PHONG_LANH_DAO : phong || null);

function moSuaTaiKhoan({ username }) {
  const acc = state.accounts.find((a) => a.username === username);
  if (!acc) return;
  dangSua = acc;
  const me = acc.id === state.user.id;
  const khoaVai = me ? 'Không tự đổi vai trò của chính mình.' : acc.is_chief ? 'Tài khoản Chánh Văn phòng: chỉ sửa chức danh.' : '';
  $('qtSuaTkMoTa').innerText = `${acc.full_name} (${acc.username}). Đổi vai trò hoặc phòng có hiệu lực ngay với phạm vi xem và giao việc; `
    + 'việc đang theo dõi không tự chuyển sang người khác.';
  $('qtSuaTkVai').value = acc.role_group;
  $('qtSuaTkVai').disabled = Boolean(khoaVai);
  $('qtSuaTkVaiGhiChu').innerText = khoaVai;
  show('qtSuaTkVaiGhiChu', Boolean(khoaVai));
  veOPhong(acc.department);
  $('qtSuaTkChucDanh').value = acc.position_title || '';
  $('qtSuaTkLyDo').value = '';
  showInlineError('qtSuaTkError', '');
  show('qtSuaTkModal', true);
  $('qtSuaTkChucDanh').focus();
}

async function luuSuaTaiKhoan() {
  const acc = dangSua;
  if (!acc) return;
  const vai = $('qtSuaTkVai').value;
  const phong = phongTheoVai(vai, $('qtSuaTkPhong').value);
  const chucDanh = $('qtSuaTkChucDanh').value.trim();
  const lyDo = $('qtSuaTkLyDo').value.trim();
  if (vai === acc.role_group && phong === (acc.department || null) && chucDanh === (acc.position_title || '')) {
    showInlineError('qtSuaTkError', 'Không có thay đổi nào để lưu.');
    return;
  }
  if (!lyDo) { showInlineError('qtSuaTkError', 'Phải ghi lý do — lý do được lưu vào nhật ký cấp quyền.'); $('qtSuaTkLyDo').focus(); return; }
  const btn = $('qtSuaTkLuu'); btn.disabled = true;
  try {
    const { error } = await supabase.rpc('admin_sua_tai_khoan', { p_username: acc.username, p_role_group: vai, p_department: phong, p_position_title: chucDanh, p_ly_do: lyDo });
    if (error) { showInlineError('qtSuaTkError', error.message); return; }
    if (acc.id === state.user.id) state.user = { ...state.user, department: phong, position_title: chucDanh };
    show('qtSuaTkModal', false);
    dangSua = null;
    notifySuccess(`Đã sửa tài khoản ${acc.full_name}.`);
    await onDone();
  } finally { btn.disabled = false; }
}

export function mountSuaTaiKhoan(reload) {
  onDone = reload;
  $('modalRoot').insertAdjacentHTML('beforeend', template);
  $('qtSuaTkVai').addEventListener('change', () => veOPhong($('qtSuaTkPhong').value || dangSua?.department));
  registerActions({ moSuaTaiKhoan, luuSuaTaiKhoan, dongSuaTaiKhoan: () => { show('qtSuaTkModal', false); dangSua = null; } });
}
