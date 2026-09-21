// Tìm nhanh trên thanh đầu trang (GĐ23; v8: ≥ 601px ô luôn hiện trong hộp 280px, kính lúp chỉ đưa tiêu điểm; điện thoại bấm kính lúp → ô nổi).
// Enter → mở màn hình Nhiệm vụ với bộ lọc từ khoá (mã NV-… hoặc nội dung), giữ phạm vi
// của vai (A3 = việc của tôi). Chỉ là lối vào nhanh của ô tìm sẵn có trên màn hình Nhiệm vụ (kl/danh-sach.js).
import { $, show } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { openKl } from '../shared/kl/index.js';

const luonMo = () => globalThis.matchMedia('(min-width: 601px)').matches;

function toggleTimNhanh() {
  if (luonMo()) { $('timNhanhO').focus(); return; }
  const mo = $('timNhanhForm').classList.contains('hidden');
  show('timNhanhForm', mo);
  $('timNhanhBtn').setAttribute('aria-expanded', String(mo));
  if (mo) $('timNhanhO').focus();
}

function dongTimNhanh() {
  if (luonMo()) return;
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
  const theoKhung = () => { show('timNhanhForm', luonMo()); $('timNhanhBtn').setAttribute('aria-expanded', String(luonMo())); };
  theoKhung();
  globalThis.matchMedia('(min-width: 601px)').addEventListener('change', theoKhung);
  document.addEventListener('click', (e) => { if (!e.target.closest('.tim-nhanh')) dongTimNhanh(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dongTimNhanh(); });
  registerActions({ toggleTimNhanh });
}
