// Chuông thông báo ở dải nhận diện, mọi vai (mockup "Chuông gom theo việc"): tin hệ thống (direct_messages loai = he_thong, do hàm chi_dao_* /
// minh chứng / cảnh báo tạo cho người liên quan) gom theo nhiệm vụ — "NV-118 có 3 diễn biến mới" thay vì 3 dòng rời; bấm mở đúng luồng
// của việc (ngăn chi tiết, con trỏ vào ô chỉ đạo/phản hồi) và đánh dấu đã đọc theo nhiệm vụ. Realtime: features/realtime.js gọi onTinHeThongMoi.
import { $, show, setText, escapeHtml, formatDateTime } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifyError } from '../../components/toast.js';
import { loadTinHeThong, tinHeThongDaDoc } from '../../lib/kl/dieu-hanh.js';
import { moNhiemVu } from '../../views/shared/kl/index.js';
import { showDMToast, closeToast } from '../messages/chat.js';
import { thongBaoTemplate } from './template.js';
import { lamMoiHuyHieu } from '../huy-hieu.js';

let tin = [];
const maCua = (content) => (content.match(/· (NV-[\w-]+):/) || [])[1] || '';

// Gom theo nhiệm vụ: mới nhất trước; số chưa đọc; dòng đầu = tin mới nhất.
export function gomTheoViec(ds) {
  const m = new Map();
  ds.forEach((t) => {
    const k = t.nhiem_vu_id || `tin-${t.id}`;
    if (!m.has(k)) m.set(k, { nv: t.nhiem_vu_id, ma: maCua(t.content), moiNhat: t, so: 0, chuaDoc: 0 });
    const g = m.get(k); g.so++; if (!t.is_read) g.chuaDoc++;
  });
  return [...m.values()].sort((a, b) => (b.chuaDoc > 0) - (a.chuaDoc > 0) || (a.moiNhat.created_at < b.moiNhat.created_at ? 1 : -1));
}

function nhomHtml(g) {
  const [dau, ...con] = g.moiNhat.content.split(': ');
  return `<li class="tb-dong ${g.chuaDoc ? 'tb-chua-doc' : ''}" data-nv="${g.nv || ''}">
    <button type="button" data-action="moThongBao" data-nhiem-vu="${g.nv || ''}" data-ma="${escapeHtml(g.ma)}">
      <b>${escapeHtml(g.ma || dau)}${g.so > 1 ? ` có ${g.so} diễn biến${g.chuaDoc ? `, ${g.chuaDoc} mới` : ''}` : g.chuaDoc ? ' · mới' : ''}</b>
      <span>${escapeHtml(g.so > 1 ? `${dau}: ${con.join(': ')}` : con.join(': ') || dau)}</span>
      <small>${formatDateTime(g.moiNhat.created_at)}</small></button></li>`;
}

function render() {
  const chuaDoc = tin.filter((t) => !t.is_read).length;
  setText('chuongBadge', chuaDoc);
  show('chuongBadge', chuaDoc > 0);
  $('chuongBtn').setAttribute('aria-label', chuaDoc ? `Thông báo, ${chuaDoc} chưa đọc` : 'Thông báo');
  const nhom = gomTheoViec(tin);
  $('thongBaoList').innerHTML = nhom.length ? nhom.map(nhomHtml).join('') : '<li class="tb-trong chu-phu">Chưa có thông báo nào.</li>';
  show('thongBaoDocHet', chuaDoc > 0);
}

export async function loadThongBao() {
  if (!state.user) return;
  try { tin = await loadTinHeThong(); render(); } catch (e) { notifyError(e.message); }
}

function toggleThongBao() {
  const mo = $('thongBaoPanel').classList.contains('hidden');
  show('thongBaoPanel', mo);
  $('chuongBtn').setAttribute('aria-expanded', String(mo));
  if (mo) loadThongBao();
}

// Mở đúng nhiệm vụ của một nhóm tin: đã đọc mọi tin về nhiệm vụ đó → màn hình Nhiệm vụ lọc mã → ngăn chi tiết, con trỏ vào ô chỉ đạo/phản hồi.
async function moNhiemVuCuaTin(nvId, ma) {
  show('thongBaoPanel', false);
  $('chuongBtn').setAttribute('aria-expanded', 'false');
  closeToast();
  if (!nvId) return;
  try { await tinHeThongDaDoc(nvId); lamMoiHuyHieu(); } catch { /* không chặn việc mở nhiệm vụ */ }
  loadThongBao();
  await moNhiemVu(nvId, ma, 'chi-dao');
}
const moThongBao = ({ nhiemVu, ma }) => moNhiemVuCuaTin(nhiemVu, ma);

async function docHetThongBao() {
  try { await tinHeThongDaDoc(null); loadThongBao(); lamMoiHuyHieu(); } catch (e) { notifyError(e.message); }
}

// Tin hệ thống mới tới qua realtime (đã qua RLS: chỉ tin của tôi): cập nhật chuông, toast có nút mở nhiệm vụ.
export function onTinHeThongMoi(dm) {
  tin = [dm, ...tin.filter((t) => t.id !== dm.id)];
  render();
  showDMToast('Thông báo trên nhiệm vụ', dm.content, dm.sender_id, () => moNhiemVuCuaTin(dm.nhiem_vu_id, maCua(dm.content)), 'Mở nhiệm vụ');
}

function onClickNgoai(e) {
  if ($('thongBaoPanel').classList.contains('hidden') || e.target.closest('.chuong')) return;
  show('thongBaoPanel', false);
  $('chuongBtn').setAttribute('aria-expanded', 'false');
}

export function mountThongBao() {
  $('currentUserDisplay').closest('.nguoi').insertAdjacentHTML('beforebegin', thongBaoTemplate);
  document.addEventListener('click', onClickNgoai);
  registerActions({ toggleThongBao, moThongBao, docHetThongBao });
}
