// Chuông thông báo ở dải nhận diện, mọi vai (mockup "Chuông gom theo việc"): tin hệ thống (direct_messages loai = he_thong, do hàm chi_dao_* /
// minh chứng / cảnh báo tạo cho người liên quan) gom theo nhiệm vụ — "NV-118 có 3 diễn biến mới" thay vì 3 dòng rời; bấm mở đúng luồng
// của việc và đánh dấu đã đọc theo nhiệm vụ. v3.36 (0142, CAU-HOI V-10): cơ sở dữ liệu phân mức mỗi tin lúc tạo (kl_phan_muc_tin) — hai thẻ
// "Cần đồng chí xử lý" (XU_LY; số trên huy hiệu = kl_so_chua_xu_ly.thong_bao) và "Để biết" (BIET; thong_bao_biet); toast và âm chuông chỉ cho
// tin cần xử lý. realtime: features/realtime.js gọi onTinHeThongMoi. Tuỳ chọn (accounts.tuy_chon): am_chuong; gom_tin = không bật toast rời.
import { $, show, setText, escapeHtml, formatDateTime } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifyError } from '../../components/toast.js';
import { loadTinHeThong, tinHeThongDaDoc, tinHeThongDocHet } from '../../lib/kl/dieu-hanh.js';
import { moNhiemVu } from '../../views/shared/kl/index.js';
import { moNhiemVuQuy } from '../../views/nvq/chi-tiet.js';
import { tinDaDoc as tinDaDocNvq } from '../../lib/nvq/du-lieu.js';
import { showDMToast, closeToast } from '../messages/chat.js';
import { thongBaoTemplate } from './template.js';
import { lamMoiHuyHieu, onSoChuaXuLy } from '../huy-hieu.js';
import { MUC_TIN, mucCua, demChuaDoc, canBaoNgay } from './muc.js';

let tin = [];
let theMo = 'XU_LY';   // thẻ đang mở
const maCua = (content) => (content.match(/· (NV-[\w-]+):/) || [])[1] || '';
const THE = { XU_LY: { nut: 'tbTheXuLy', so: 'tbSoXuLy', trong: 'Không có thông báo cần đồng chí xử lý.' },
  BIET: { nut: 'tbTheBiet', so: 'tbSoBiet', trong: 'Chưa có thông báo để biết.' } };

// Gom theo nhiệm vụ: mới nhất trước; số chưa đọc (chỉ tin gửi tới mình — dòng mình gửi người khác "chưa đọc" là của họ); dòng đầu = tin mới nhất.
export function gomTheoViec(ds) {
  const m = new Map();
  ds.forEach((t) => {
    const k = t.nhiem_vu_id || (t.nvq_nhiem_vu_id ? `nq-${t.nvq_nhiem_vu_id}` : `tin-${t.id}`);   // v3.35: nhiệm vụ quý BTV gom riêng
    if (!m.has(k)) m.set(k, { nv: t.nhiem_vu_id, nvq: t.nvq_nhiem_vu_id || null, ma: maCua(t.content), moiNhat: t, so: 0, chuaDoc: 0 });
    const g = m.get(k); g.so++; if (!t.is_read && t.receiver_id === state.user?.id) g.chuaDoc++;
  });
  return [...m.values()].sort((a, b) => (b.chuaDoc > 0) - (a.chuaDoc > 0) || (a.moiNhat.created_at < b.moiNhat.created_at ? 1 : -1));
}

function nhomHtml(g) {
  const [dau, ...con] = g.moiNhat.content.split(': ');
  return `<li class="tb-dong ${g.chuaDoc ? 'tb-chua-doc' : ''}" data-nv="${g.nv || ''}">
    <button type="button" data-action="moThongBao" data-nhiem-vu="${g.nv || ''}" data-nvq="${g.nvq || ''}" data-ma="${escapeHtml(g.ma)}">
      <b>${escapeHtml(g.ma || dau)}${g.so > 1 ? ` có ${g.so} diễn biến${g.chuaDoc ? `, ${g.chuaDoc} mới` : ''}` : g.chuaDoc ? ' · mới' : ''}</b>
      <span>${escapeHtml(g.so > 1 ? `${dau}: ${con.join(': ')}` : con.join(': ') || dau)}</span>
      <small>${formatDateTime(g.moiNhat.created_at)}</small></button></li>`;
}

// Huy hiệu (chỉ tin cần xử lý): "9+" khi hơn 9; ẩn khi 0.
export function veHuyHieuChuong(n) {
  const so = Number(n || 0);
  setText('chuongBadge', so > 9 ? '9+' : String(so));
  show('chuongBadge', so > 0);
  $('chuongBtn')?.setAttribute('aria-label', so ? `Thông báo, ${so} cần đồng chí xử lý chưa đọc` : 'Thông báo');
}

// Số chưa đọc cạnh tên từng thẻ.
function veSoThe(so) {
  Object.entries(THE).forEach(([muc, t]) => {
    const n = Number(so[muc] || 0);
    setText(t.so, n > 99 ? '99+' : String(n));
    show(t.so, n > 0);
  });
}

function render() {
  const so = demChuaDoc(tin);
  veHuyHieuChuong(so.XU_LY);
  veSoThe(so);
  Object.entries(THE).forEach(([muc, t]) => $(t.nut)?.setAttribute('aria-selected', String(muc === theMo)));
  $('thongBaoList').setAttribute('aria-labelledby', THE[theMo].nut);
  const nhom = gomTheoViec(tin.filter((t) => mucCua(t) === theMo));
  $('thongBaoList').innerHTML = nhom.length ? nhom.map(nhomHtml).join('') : `<li class="tb-trong chu-phu">${THE[theMo].trong}</li>`;
  show('thongBaoDocHet', so[theMo] > 0);
}

// Chuông: chỉ tin gửi tới mình; mỗi mức đọc riêng (60 tin mới nhất mỗi thẻ).
export async function loadThongBao() {
  if (!state.user) return;
  try {
    const ds = await Promise.all(MUC_TIN.map((muc) => loadTinHeThong(60, { nguoiNhan: state.user.id, muc })));
    tin = ds.flat(); render();
  } catch (e) { notifyError(e.message); }
}

function toggleThongBao() {
  const mo = $('thongBaoPanel').classList.contains('hidden');
  show('thongBaoPanel', mo);
  $('chuongBtn').setAttribute('aria-expanded', String(mo));
  if (mo) { theMo = 'XU_LY'; render(); loadThongBao(); }   // mở chuông luôn vào thẻ cần xử lý
}

function chonTheThongBao({ muc }) {
  if (!THE[muc]) return;
  theMo = muc;
  render();
}

// Mở đúng nhiệm vụ của một nhóm tin: đã đọc mọi tin về nhiệm vụ đó → màn hình Nhiệm vụ lọc mã → ngăn chi tiết, con trỏ vào ô chỉ đạo/phản hồi.
async function moNhiemVuCuaTin(nvId, ma, nvqId = null) {
  show('thongBaoPanel', false);
  $('chuongBtn').setAttribute('aria-expanded', 'false');
  closeToast();
  if (nvqId) {   // v3.35: nhiệm vụ quý BTV — ngăn chi tiết của phân hệ (mở thì đánh dấu đã đọc mọi tin của nhiệm vụ đó — nvq_tin_da_doc)
    try { await tinDaDocNvq(nvqId); } catch { /* không chặn việc mở nhiệm vụ */ }
    lamMoiHuyHieu(); loadThongBao();
    await moNhiemVuQuy(nvqId, { cuon: 'nqPhanYKien' });
    return;
  }
  if (!nvId) return;
  try { await tinHeThongDaDoc(nvId); lamMoiHuyHieu(); } catch { /* không chặn việc mở nhiệm vụ */ }
  loadThongBao();
  await moNhiemVu(nvId, ma, 'chi-dao');
}
const moThongBao = ({ nhiemVu, ma, nvq }) => moNhiemVuCuaTin(nhiemVu, ma, nvq || null);

// "Đánh dấu đã đọc": chỉ tin của thẻ đang mở.
async function docHetThongBao() {
  try { await tinHeThongDocHet(theMo); loadThongBao(); lamMoiHuyHieu(); } catch (e) { notifyError(e.message); }
}

// Tiếng chuông ngắn (WebAudio, không tệp âm thanh) khi người dùng bật am_chuong.
function keuChuong() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.08;
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.18);
  } catch { /* trình duyệt chặn âm thanh khi chưa tương tác */ }
}

// Tin hệ thống mới tới qua realtime (đã qua RLS: chỉ tin của tôi): cập nhật chuông; tin cần xử lý thì kêu (am_chuong) và toast có nút mở
// nhiệm vụ (trừ khi gom_tin); tin để biết chỉ thêm vào thẻ "Để biết".
export function onTinHeThongMoi(dm) {
  tin = [dm, ...tin.filter((t) => t.id !== dm.id)];
  render();
  if (!canBaoNgay(dm)) return;
  if (state.user?.tuy_chon?.am_chuong) keuChuong();
  if (state.user?.tuy_chon?.gom_tin) return;
  showDMToast('Thông báo trên nhiệm vụ', dm.content, dm.sender_id, () => moNhiemVuCuaTin(dm.nhiem_vu_id, maCua(dm.content), dm.nvq_nhiem_vu_id || null), 'Mở nhiệm vụ');
}

function onClickNgoai(e) {
  if ($('thongBaoPanel').classList.contains('hidden') || e.target.closest('.chuong')) return;
  show('thongBaoPanel', false);
  $('chuongBtn').setAttribute('aria-expanded', 'false');
}

export function mountThongBao() {
  $('currentUserDisplay').closest('.nguoi').insertAdjacentHTML('beforebegin', thongBaoTemplate);
  document.addEventListener('click', onClickNgoai);
  onSoChuaXuLy((so) => {   // số chính xác từ cơ sở dữ liệu (không giới hạn 60 tin mỗi thẻ); schema cũ (chưa 0041) giữ số đếm cục bộ
    if (!so || !('thong_bao' in so)) return;
    veHuyHieuChuong(so.thong_bao);
    if ('thong_bao_biet' in so) veSoThe({ XU_LY: so.thong_bao, BIET: so.thong_bao_biet });
  });
  registerActions({ toggleThongBao, chonTheThongBao, moThongBao, docHetThongBao });
}
