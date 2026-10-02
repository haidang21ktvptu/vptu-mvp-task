// Tìm nhanh trên thanh đầu trang (GĐ23; v8: ≥ 601px ô luôn hiện trong hộp 280px, kính lúp chỉ đưa tiêu điểm; điện thoại bấm kính lúp → ô nổi).
// Enter → kết quả theo từ khoá (mã NV-… hoặc nội dung), giữ phạm vi của vai (A3 = việc của tôi). v9 đợt 2: đang ở màn hình Nhiệm vụ thì lọc
// ngay trong trang như cũ; ở màn hình khác thì danh sách kết quả mở trong ngăn chi tiết dùng chung, không rời trang (gõ đúng một mã → mở
// thẳng việc đó). Cùng bộ lọc với ô tìm của màn hình Nhiệm vụ (locRows, lib/kl/tong-hop.js).
import { $, show } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifyError } from '../../components/toast.js';
import { loadKlRows } from '../../lib/kl/du-lieu.js';
import { locRows } from '../../lib/kl/tong-hop.js';
import { openKl, chiViecCuaToi } from '../shared/kl/index.js';
import { moNganDanhSach, moNganViec } from '../shared/ngan-chi-tiet.js';
import { sectionDangHien } from './index.js';

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

async function onTim(e) {
  e.preventDefault();
  const tuKhoa = $('timNhanhO').value.trim();
  if (!tuKhoa) return;
  const loc = chiViecCuaToi() ? { cuaToi: state.user.id, tuKhoa } : { tuKhoa };
  dongTimNhanh();
  if (sectionDangHien('viewKl')) { openKl(loc); return; }
  try {
    const ds = locRows((await loadKlRows()).rows, loc);
    const dungMa = ds.filter((r) => r.ma.toLowerCase() === tuKhoa.toLowerCase());
    if (dungMa.length === 1) { await moNganViec(dungMa[0].id, { row: dungMa[0] }); return; }
    moNganDanhSach({ tieuDe: `Kết quả tìm “${tuKhoa}”`, rows: ds });
  } catch (err) { notifyError('Không tìm được: ' + err.message); }
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
