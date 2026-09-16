// Chuông thông báo ở thanh trên, mọi vai trò (GĐ15, CĐ-3/CB-6): đếm tin hệ thống chưa đọc (direct_messages loai = he_thong,
// do hàm chi_dao_* của 0026 tạo cho người liên quan), bấm mở danh sách, bấm một tin → đánh dấu đã đọc theo nhiệm vụ rồi mở
// đúng nhiệm vụ (màn hình Nhiệm vụ lọc theo mã, ngăn chi tiết bung). Realtime: features/realtime.js gọi onTinHeThongMoi.
import { $, show, setText, escapeHtml, formatDateTime } from '../../lib/dom.js';
import { state, findAccount } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifyError } from '../../components/toast.js';
import { loadTinHeThong, tinHeThongDaDoc } from '../../lib/kl/dieu-hanh.js';
import { openKl } from '../../views/shared/kl/index.js';
import { toggleKlChiTiet } from '../../views/shared/kl/chi-tiet.js';

import { showDMToast, closeToast } from '../messages/chat.js';
import { thongBaoTemplate } from './template.js';

let tin = [];

function dongHtml(t) {
  const [dau, ...con] = t.content.split(': ');
  return `<li class="tb-dong ${t.is_read ? '' : 'tb-chua-doc'}">
    <button type="button" data-action="moThongBao" data-id="${t.id}" data-nv="${t.nhiem_vu_id || ''}">
      <b>${escapeHtml(dau)}</b><span>${escapeHtml(con.join(': '))}</span>
      <small>${escapeHtml(findAccount(t.sender_id)?.full_name || 'Hệ thống')} · ${formatDateTime(t.created_at)}</small>
    </button></li>`;
}

function render() {
  const chuaDoc = tin.filter((t) => !t.is_read).length;
  setText('chuongBadge', chuaDoc);
  show('chuongBadge', chuaDoc > 0);
  $('chuongBtn').setAttribute('aria-label', chuaDoc ? `Thông báo, ${chuaDoc} chưa đọc` : 'Thông báo');
  $('thongBaoList').innerHTML = tin.length ? tin.map(dongHtml).join('') : '<li class="tb-trong chu-phu">Chưa có thông báo nào.</li>';
  show('thongBaoDocHet', chuaDoc > 0);
}

export async function loadThongBao() {
  if (!state.user) return;
  try {
    tin = await loadTinHeThong();
    render();
  } catch (e) {
    notifyError(e.message);
  }
}

function toggleThongBao() {
  const mo = $('thongBaoPanel').classList.contains('hidden');
  show('thongBaoPanel', mo);
  $('chuongBtn').setAttribute('aria-expanded', String(mo));
  if (mo) loadThongBao();
}

// Mở đúng nhiệm vụ của một tin: đã đọc mọi tin về nhiệm vụ đó → màn hình Nhiệm vụ lọc mã → bung chi tiết (có khối chỉ đạo).
async function moNhiemVuCuaTin(nvId, content) {
  show('thongBaoPanel', false);
  $('chuongBtn').setAttribute('aria-expanded', 'false');
  closeToast();
  if (!nvId) return;
  try { await tinHeThongDaDoc(nvId); } catch { /* không chặn việc mở nhiệm vụ */ }
  loadThongBao();
  const ma = (content.match(/· (NV-[\w-]+):/) || [])[1] || '';
  await openKl({ tuKhoa: ma });
  await toggleKlChiTiet({ id: nvId, cheDo: 'chi-dao' }); // bảng gập, con trỏ vào ô chỉ đạo/phản hồi
}

const moThongBao = ({ id, nv }) => moNhiemVuCuaTin(nv, tin.find((t) => t.id === id)?.content || '');

async function docHetThongBao() {
  try { await tinHeThongDaDoc(null); loadThongBao(); } catch (e) { notifyError(e.message); }
}

// Tin hệ thống mới tới qua realtime (đã qua RLS: chỉ tin của tôi): cập nhật chuông, toast có nút mở nhiệm vụ.
export function onTinHeThongMoi(dm) {
  tin = [dm, ...tin.filter((t) => t.id !== dm.id)];
  render();
  showDMToast('Thông báo trên nhiệm vụ', dm.content, dm.sender_id, () => moNhiemVuCuaTin(dm.nhiem_vu_id, dm.content), 'Mở nhiệm vụ');
}

function onClickNgoai(e) {
  if ($('thongBaoPanel').classList.contains('hidden') || e.target.closest('.chuong')) return;
  show('thongBaoPanel', false);
  $('chuongBtn').setAttribute('aria-expanded', 'false');
}

export function mountThongBao() {
  $('headerDate').insertAdjacentHTML('beforebegin', thongBaoTemplate);
  document.addEventListener('click', onClickNgoai);
  registerActions({ toggleThongBao, moThongBao, docHetThongBao });
}
