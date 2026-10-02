// Ngăn chi tiết dùng chung (giao diện v9 đợt 2): mọi chỗ "bấm để xem" — số, biểu đồ, bảng ở Tổng quan; ô số ở Cần xử lý; dòng ở Theo văn bản,
// Báo cáo, Cán bộ, Cần nghiệm thu, Chỉ đạo đã gửi; chuông, nhắn tin, tìm nhanh, việc vừa giao — mở NGAY TRÊN màn hình đang xem, không đổi mục.
// Hai tầng: Danh sách (các việc đã lọc, đã sắp xếp) → Chi tiết việc. Chi tiết là đúng ngăn chi tiết của màn hình Nhiệm vụ: chuyển nút #klChiTiet
// vào ngăn (không dựng bản thứ hai nên id không trùng, mọi nút thao tác giữ nguyên); đóng / quay lại / đổi mục → trả #klChiTiet về chỗ cũ.
// Dữ liệu: mở ngay bằng dòng màn hình gọi đang có, rồi đọc lại đúng việc đó (2 truy vấn) — khác thì vẽ lại. Realtime: việc đang mở có sự kiện
// → nạp lại việc đó (kl-realtime datNghePhu). Ghi xong trong ngăn (kl/index.js phát 'viec-da-ghi') → màn hình không có realtime tự nạp lại
// (khiGhiTrongNgan), quay lại danh sách thấy trạng thái mới của việc vừa xử lý.
import { $, escapeHtml, show, setText } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifyError } from '../../components/toast.js';
import { sapXep } from '../../lib/kl/tong-hop.js';
import { homNayVN } from '../../lib/kl/ngay.js';
import { lopMep, boSoThuTu } from '../../lib/kl/nhan.js';
import { nhanPhuHtml } from '../../lib/kl/do-khan.js';
import { datNghePhu } from '../../features/kl-realtime.js';
import { sectionDangHien } from '../shell/index.js';
import { getKlRows, timKlRow } from './kl/danh-sach.js';
import { toggleKlChiTiet, dongKlChiTiet, idDangMo } from './kl/chi-tiet.js';
import { napLaiViec } from './kl/nap-lai-viec.js';
import { dh } from './dieu-hanh/du-lieu.js';
import { hanNgan } from './ngan-viec.js';

const ngan = { ds: null, rows: new Map(), daMo: new Set(), tuDs: false, onDong: null, cha: null, sau: null, truoc: null, cuon: 0, viecVua: null };
const nguon = new Set();   // hàm (id) → dòng của các màn hình tự đọc v_nhiem_vu (Báo cáo, Cán bộ): mở việc ngay, không chờ đọc
const laMo = () => !$('nganCT')?.classList.contains('hidden');
export const nganDangMoViec = () => laMo() && Boolean($('klChiTiet')?.closest('#nganCT'));
export const datNguonDong = (fn) => { nguon.add(fn); };
const ownerText = (r) => r.owner_tai_khoan_ten || boSoThuTu(r.owner_don_vi_ten) || 'chưa xác định chủ trì';
const dongCua = (id) => ngan.rows.get(id) || dh.rows.find((r) => r.id === id) || [...nguon].map((f) => f(id)).find(Boolean) || null;

// Màn hình không có realtime: ghi thành công trong ngăn khi đang xem màn hình đó → nạp lại màn hình (giữ hàng / người đang mở của màn).
export function khiGhiTrongNgan(section, napLai) {
  document.addEventListener('viec-da-ghi', () => { if (laMo() && sectionDangHien(section)) napLai(); });
}

// Chuyển / trả nút ngăn chi tiết của màn hình Nhiệm vụ (nhớ cha và nút kế tiếp để trả đúng chỗ).
function dieuHost() {
  const h = $('klChiTiet'); const slot = $('nganCTViec');
  if (!h || !slot || h.parentElement === slot) return;
  ngan.cha = h.parentElement; ngan.sau = h.nextSibling;
  slot.appendChild(h);
}
function traHost() {
  const h = $('klChiTiet');
  if (!h || !ngan.cha || h.parentElement === ngan.cha) return;
  ngan.cha.insertBefore(h, ngan.sau && ngan.sau.parentElement === ngan.cha ? ngan.sau : null);
}
function boViecDangMo() {
  if (nganDangMoViec()) dongKlChiTiet();
  traHost();
  datNghePhu(null);
}

function moKhung(tieuDe, phu) {
  setText('nganCTTieuDe', tieuDe); setText('nganCTPhu', phu);
  if (!laMo()) { ngan.truoc = document.activeElement; show('nganCT', true); document.body.classList.add('co-ngan'); }
  $('nganCTThan').scrollTop = 0;
  $('nganCTDong').focus({ preventScroll: true });
}

function dongViecHtml(r, homNay) {
  return `<li><button type="button" class="nct-viec ${lopMep(r, state.user?.id)}" data-action="nganMoViec" data-id="${r.id}" data-tu-ds="1">
      <span class="nct-ma">${escapeHtml(r.ma)}</span><span class="nct-nd">${escapeHtml(r.noi_dung)}</span>
      <span class="nct-phu">${escapeHtml(ownerText(r))} · ${hanNgan(r, homNay)} ${nhanPhuHtml(r)}</span></button></li>`;
}

// Vẽ tầng danh sách; việc đã mở trong ngăn lấy dòng mới nhất (đã đọc lại sau khi mở / sau khi ghi).
function veDanhSach() {
  const { phan, dauHtml, tong } = ngan.ds; const homNay = homNayVN();
  const moi = (r) => (ngan.daMo.has(r.id) && timKlRow(r.id)) || r;
  $('nganCTDs').innerHTML = dauHtml + (tong === 0 ? '<p class="trong-nho">Không có nhiệm vụ nào.</p>'
    : phan.filter((p) => p.rows.length || !p.ten).map((p) => `${p.ten ? `<h3 class="nct-nhom">${escapeHtml(p.ten)} (${p.rows.length})</h3>` : ''}
      <ul class="nct-ds">${p.rows.map((r) => dongViecHtml(moi(r), homNay)).join('')}</ul>`).join(''));
}

// Tầng danh sách. nhom = [{ ten, rows }] (tuỳ chọn, ví dụ "Giao mới" / "Hoàn thành" của một tháng); dauHtml = khối đầu (tuỳ chọn).
// onDong: màn hình bên dưới bỏ chọn khi ngăn đóng.
export function moNganDanhSach({ tieuDe, phu = '', rows = [], nhom = null, dauHtml = '', onDong = null }) {
  boViecDangMo();
  const phan = (nhom || [{ ten: '', rows }]).map((n) => ({ ten: n.ten, rows: sapXep(n.rows || []) }));
  const tong = new Set(phan.flatMap((p) => p.rows.map((r) => r.id))).size;
  ngan.rows = new Map(phan.flatMap((p) => p.rows.map((r) => [r.id, r])));
  ngan.daMo = new Set(); ngan.cuon = 0;
  ngan.ds = { tieuDe, phu: phu || `${tong} nhiệm vụ · bấm một việc để xem chi tiết`, phan, dauHtml, tong };
  ngan.onDong = onDong;
  veDanhSach();
  show('nganCTDs', true); show('nganCTViec', false); show('nganCTLui', false);
  moKhung(tieuDe, ngan.ds.phu);
}

// Tầng chi tiết một việc. row (tuỳ chọn) = dòng màn hình gọi đã có. Mở ngay bằng dòng đang có rồi đọc lại nền; chưa có dòng nào → đọc trước.
export async function moNganViec(id, { cheDo = 'chi-tiet', tuDs = false, row = null } = {}) {
  if (!id) return;
  const goc = row || dongCua(id);
  if (!timKlRow(id) && goc) getKlRows().push(goc);
  let daDoc = false;
  if (!timKlRow(id)) {
    try { await napLaiViec(id, { nemLoi: true, veLai: false }); daDoc = true; } catch (e) { notifyError('Không mở được việc: ' + e.message); return; }
  }
  const r = timKlRow(id);
  if (!r) { notifyError('Không mở được việc: việc không còn trong phạm vi của đồng chí.'); return; }
  if (!tuDs) { ngan.ds = null; ngan.rows = new Map([[id, r]]); ngan.daMo = new Set(); }
  ngan.tuDs = tuDs && Boolean(ngan.ds);
  if (ngan.tuDs && !$('nganCTDs').classList.contains('hidden')) ngan.cuon = $('nganCTThan').scrollTop;   // quay lại: về đúng chỗ trong danh sách
  ngan.daMo.add(id); ngan.viecVua = id;
  dieuHost();
  show('nganCTDs', false); show('nganCTViec', true); show('nganCTLui', ngan.tuDs);
  moKhung(r.ma, `${ownerText(r)} · ${hanNgan(r, homNayVN())}`);
  await toggleKlChiTiet({ id, cheDo });
  if (!daDoc) napLaiViec(id, { chiKhiDoi: true });   // dòng của màn hình gọi có thể cũ vài phút: đọc lại đúng việc này, khác thì vẽ lại
  datNghePhu((su) => {
    const mo = idDangMo();
    if (mo && nganDangMoViec() && (!su.length || su.some((e) => e.id === mo))) napLaiViec(mo);
  });
}

function nganLui() {
  if (!ngan.ds) { dongNganCT(); return; }
  boViecDangMo();
  veDanhSach();
  show('nganCTDs', true); show('nganCTViec', false); show('nganCTLui', false);
  moKhung(ngan.ds.tieuDe, ngan.ds.phu);
  $('nganCTThan').scrollTop = ngan.cuon;
  $('nganCTDs').querySelector(`[data-id="${ngan.viecVua}"]`)?.focus({ preventScroll: true });
}

export function dongNganCT() {
  if (!laMo()) return;
  boViecDangMo();
  show('nganCT', false); document.body.classList.remove('co-ngan');
  const fn = ngan.onDong; Object.assign(ngan, { ds: null, rows: new Map(), daMo: new Set(), tuDs: false, onDong: null });
  if (fn) fn();
  if (ngan.truoc?.isConnected) ngan.truoc.focus({ preventScroll: true });
}

export function mountNganChiTiet() {
  registerActions({
    nganMoViec: ({ id, tuDs }) => moNganViec(id, { tuDs: tuDs === '1' }),
    nganLui, nganDong: dongNganCT,
  });
  document.addEventListener('doi-man', dongNganCT);   // chọn mục khác ở menu (shell/index.js showSection)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !laMo() || document.querySelector('.modal-nen:not(.hidden)') || e.target.closest?.('input, textarea, select')) return;   // đang gõ: không mất chữ
    dongNganCT();
  });
}
