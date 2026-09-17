// Tìm nhanh trên dải (GĐ23): bấm kính lúp → ô nhập; Enter → mở màn hình Nhiệm vụ với bộ lọc từ khoá (mã NV-… hoặc nội dung), giữ phạm vi
// của vai (A3 = việc của tôi). Chỉ là lối vào nhanh của ô tìm sẵn có trên màn hình Nhiệm vụ (kl/danh-sach.js).
import { $, show } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { openKl } from '../shared/kl/index.js';

function toggleTimNhanh() {
  const mo = $('timNhanhForm').classList.contains('hidden');
  show('timNhanhForm', mo);
  $('timNhanhBtn').setAttribute('aria-expanded', String(mo));
  if (mo) $('timNhanhO').focus();
}

function dongTimNhanh() {
  show('timNhanhForm', false);
  $('timNhanhBtn').setAttribute('aria-expanded', 'false');
}

function onTim(e) {
  e.preventDefault();
  const tuKhoa = $('timNhanhO').value.trim();
  if (!tuKhoa) return;
  const loc = state.user?.role_group === 'A3' ? { cuaToi: state.user.id, tuKhoa } : { tuKhoa };
  openKl(loc);
  dongTimNhanh();
}

export function mountTimNhanh() {
  $('timNhanhForm').addEventListener('submit', onTim);
  document.addEventListener('click', (e) => { if (!e.target.closest('.tim-nhanh')) dongTimNhanh(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dongTimNhanh(); });
  registerActions({ toggleTimNhanh });
}
