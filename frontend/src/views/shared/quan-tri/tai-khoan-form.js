// Hộp "Tạo tài khoản" và hộp "Mật khẩu tạm" (một lần) — gọi Edge Function quan-tri-tai-khoan hành động tao. Không lưu mật khẩu tạm ở đâu ngoài hộp.
import { $, show, setText, showInlineError, escapeHtml } from '../../../lib/dom.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { goiQuanTriTaiKhoan } from '../../../lib/quan-tri-api.js';
import { quanTriTaiKhoanModalTemplate } from './template-he-thong.js';

let onDone = async () => {};

export function hienMatKhauTam(username, matKhau) {
  setText('qtMkMoTa', `Tài khoản ${username}`);
  setText('qtMkGiaTri', matKhau);
  show('qtMkModal', true);
}

async function saoChepMatKhauTam() {
  try { await navigator.clipboard.writeText($('qtMkGiaTri').innerText); notifySuccess('Đã sao chép mật khẩu tạm.'); } catch { notifyError('Không sao chép được — đồng chí ghi lại bằng tay.'); }
}

function moTaoTaiKhoan() {
  $('qtTkPhong').innerHTML = Object.entries(DEPT_NAMES).map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`).join('');
  const quanLy = state.accounts.filter((a) => ['A1', 'A2'].includes(a.role_group)).sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
  $('qtTkQuanLy').innerHTML = '<option value="">— không —</option>' + quanLy.map((a) => `<option value="${a.id}">${escapeHtml(a.full_name)} (${escapeHtml(a.username)})</option>`).join('');
  ['qtTkUsername', 'qtTkHoTen', 'qtTkChucDanh'].forEach((id) => { $(id).value = ''; });
  $('qtTkVai').value = 'A3'; $('qtTkChief').checked = false;
  showInlineError('qtTkError', '');
  show('qtTkModal', true);
  $('qtTkUsername').focus();
}

async function taoTaiKhoan() {
  const body = {
    hanh_dong: 'tao', username: $('qtTkUsername').value.trim().toLowerCase(), full_name: $('qtTkHoTen').value.trim(), position_title: $('qtTkChucDanh').value.trim(),
    role_group: $('qtTkVai').value, department: $('qtTkPhong').value, manager_id: $('qtTkQuanLy').value || null, is_chief: $('qtTkChief').checked,
  };
  if (!/^[a-z0-9_.]{3,40}$/.test(body.username)) { showInlineError('qtTkError', 'Tên đăng nhập: 3–40 ký tự chữ thường, số, gạch dưới hoặc dấu chấm.'); return; }
  if (!body.full_name || !body.position_title) { showInlineError('qtTkError', 'Nhập họ tên và chức danh.'); return; }
  const btn = $('qtTkTao'); btn.disabled = true;
  try {
    const kq = await goiQuanTriTaiKhoan(body);
    show('qtTkModal', false);
    hienMatKhauTam(body.username, kq.mat_khau_tam);
    await onDone();
  } catch (e) { showInlineError('qtTkError', e.message); } finally { btn.disabled = false; }
}

export function mountTaiKhoanForm(reload) {
  onDone = reload;
  $('modalRoot').insertAdjacentHTML('beforeend', quanTriTaiKhoanModalTemplate);
  registerActions({ moTaoTaiKhoan, taoTaiKhoan, dongTaoTaiKhoan: () => show('qtTkModal', false), dongMatKhauTam: () => show('qtMkModal', false), saoChepMatKhauTam });
}
