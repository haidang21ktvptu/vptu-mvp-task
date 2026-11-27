// Chuyển động giao diện (v3.36, chủ dự án chọn 26/11/2026 — CAU-HOI V-12; DESIGN mục 7). CSS + JavaScript thuần, không thư viện.
// - coChuyenDong(): có chạy hiệu ứng không. Tắt khi người dùng bỏ chọn "Hiệu ứng chuyển động" ở menu bánh răng (<html data-chuyen-dong="giam">,
//   shell/kieu-giao-dien.js) hoặc hệ điều hành đặt giảm chuyển động (prefers-reduced-motion — bộ e2e chạy ở chế độ này).
// - "Cửa vào" của một vùng (moCuaVao / dongCuaVao / dangVao / truocKhiVe / sauKhiVao): trong lúc cửa mở, vùng mang lớp dang-vao (vào trang) hoặc dang-doi (số
//   liệu đổi theo thao tác của người dùng); phần tử nào được vẽ vào vùng lúc đó thì chạy hiệu ứng của nó bằng CSS (styles/chuyen-dong.css). Cửa
//   đóng rồi thì mọi lần vẽ lại (realtime, nạp lại nền) hiện ngay, không chạy lại hiệu ứng. Lần vẽ lại của nền đến trong lúc cửa đang mở thì chờ
//   cửa đóng (sauKhiVao) để không cắt ngang hiệu ứng đang chạy. Hai chốt chung của cửa: (1) hết hẹn mà hiệu ứng còn chạy (máy chậm, khung hình đầu
//   đến muộn) thì cửa chờ thêm, không cắt ngang; (2) nội dung vẽ lại trong lúc cửa mở, thay cho nội dung thật đã hiện, thì đứng yên (lớp cd-tinh) —
//   hiệu ứng không chạy lần hai, khối không chớp; nội dung lần đầu đổ vào chỗ còn trống sau khi cửa đã mở (số liệu vừa về) thì chạy ngay, không
//   chờ mốc trễ gốc của cửa (lớp cd-sau).
// - soLanHtml / tieuDeHtml: chuỗi HTML cho số lăn từng chữ số và tiêu đề hiện từng chữ có cụm nhấn in nghiêng. Chữ trong DOM giữ nguyên văn (kiểm
//   thử đọc như cũ; lúc nghỉ các ô chữ số là phần tử nội dòng nên trình đọc màn hình đọc liền thành một số); phần chuyển động là phần tử giả và
//   thuộc tính do CSS vẽ.
import { escapeHtml } from './dom.js';

export const MS_VAO = 1500;   // cửa vào mặc định (các khối cấp một của một mục hiện lần lượt)

export function coChuyenDong() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  if (document.documentElement.getAttribute('data-chuyen-dong') === 'giam') return false;
  return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// Gọi một lần lúc khởi động: máy yếu (≤ 2 luồng xử lý hoặc ≤ 2 GB bộ nhớ theo trình duyệt báo) thì bỏ phần nhòe của hiệu ứng (lớp may-yeu trên <html>).
export function khoiDongChuyenDong() {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return;
  const yeu = (navigator.hardwareConcurrency || 4) <= 2 || (navigator.deviceMemory || 4) <= 2;
  document.documentElement.classList.toggle('may-yeu', yeu);
}

const CUA = new WeakMap();   // vùng → { lop, hen, cho: việc chờ cửa đóng (theo khoá, việc sau thay việc trước), canh, tinh }
const MS_CHO_THEM = 150;     // hết hẹn mà hiệu ứng còn chạy: xem lại sau từng nhịp
const MS_CHO_TOI_DA = 1800;  // trần chờ thêm
// Dòng "đang tải…" / "không có…", khung chờ: không tính là nội dung thật. Màn mới có dòng chờ kiểu khác thì gắn data-cd-cho cho dòng đó.
const TAM = '.trong, .trong-nho, .bnv-trong, .nq-dang-tai, .xuong, [data-cd-cho]';

// Hiệu ứng hữu hạn trong vùng (hiệu ứng lặp vô hạn không tính): 'chay' — có hiệu ứng đã bắt đầu, chưa xong; 'cho' — chỉ có hiệu ứng chưa bắt đầu
// (từ lúc tạo trình duyệt chưa vẽ khung hình nào: cửa sổ đang bị che, thu nhỏ, hoặc nội dung vừa đổ vào ngay trước hẹn); '' — không còn.
function hieuUng(el) {
  try {
    const ds = el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().endTime));
    if (!ds.length) return '';
    return ds.some((a) => !a.pending) ? 'chay' : 'cho';
  } catch { return ''; }
}
// Hết hẹn: còn hiệu ứng đang chạy thì chờ thêm từng nhịp (không cắt ngang). Chỉ còn hiệu ứng chưa bắt đầu thì chờ đúng một nhịp; vẫn chưa bắt đầu
// nghĩa là trang không được vẽ — đóng cửa để nội dung hiện, không giữ nội dung ở trạng thái ẩn của khung hình đầu.
function henDong(el, ms, daCho = 0, daChoVe = false) {
  return setTimeout(() => {
    const tt = CUA.has(el) ? hieuUng(el) : '';
    if (daCho < MS_CHO_TOI_DA && (tt === 'chay' || (tt === 'cho' && !daChoVe))) CUA.get(el).hen = henDong(el, MS_CHO_THEM, daCho + MS_CHO_THEM, tt === 'cho');
    else dongCuaVao(el);
  }, ms);
}

// Canh vẽ lại trong lúc cửa mở. Nội dung vẽ cùng lượt lệnh với lúc mở cửa (bản vẽ từ số liệu đang có) chạy hiệu ứng theo kịch bản của cửa. Sau đó:
// lần đầu đổ nội dung vào chỗ còn trống hoặc đang là dòng "đang tải" (số liệu vừa về) nhận lớp cd-sau — chạy hiệu ứng ngay, không chờ mốc trễ gốc;
// nội dung thay cho nội dung thật (số liệu mới về sau khi mở, người dùng bấm lọc…) nhận lớp cd-tinh — đứng yên ở trạng thái cuối. Trình quan sát
// chạy ngay sau lệnh vẽ, trước khi trình duyệt vẽ khung hình — không có khung hình nào kịp chớp.
const laTam = (n) => n.matches(TAM) || (n.childElementCount === 1 && n.firstElementChild.matches(TAM));   // cả hàng bảng chỉ chứa một ô "đang tải"
const laThat = (n) => n.nodeType === 1 && !laTam(n);
function canhVeLai(el, c) {
  if (typeof MutationObserver === 'undefined') return;
  c.dau = true; setTimeout(() => { c.dau = false; }, 0);
  const day = new WeakSet(); c.tinh = [];
  c.canh = new MutationObserver((ds) => ds.forEach((m) => {
    const them = [...m.addedNodes].filter((n) => n.nodeType === 1);
    if (!them.length) return;
    const thay = day.has(m.target) || [...m.removedNodes].some(laThat);
    if (them.some(laThat)) day.add(m.target);
    if (c.dau) return;
    them.forEach((n) => { n.classList.add(thay ? 'cd-tinh' : 'cd-sau'); c.tinh.push(n); });
  }));
  c.canh.observe(el, { childList: true, subtree: true });
}

export function dongCuaVao(el) {
  const c = el ? CUA.get(el) : null;
  if (!c) return;
  clearTimeout(c.hen);
  CUA.delete(el);
  c.canh?.disconnect();
  (c.tinh || []).forEach((n) => n.classList.remove('cd-tinh', 'cd-sau'));
  el.classList.remove(...c.lop);
  [...c.cho.values()].forEach((fn) => { try { fn(); } catch (e) { setTimeout(() => { throw e; }); } });   // việc chờ lỗi: báo ra ngoài, không cắt ngang nơi đóng cửa
}

// lop: 'dang-vao' (vào trang) | 'dang-doi' (số liệu đổi tại chỗ); lai: đã vào mục này trong lần mở ứng dụng → nhịp nhanh hơn (lớp vao-lai); them: lớp
// kèm theo của riêng màn (ví dụ 'sau-cho': nội dung thật thay khung chờ — phần khung đã hiện không chạy lại). Mở cửa SAU khi đã vẽ nội dung cần chạy
// hiệu ứng (hoặc vẽ ngay trong cùng lượt lệnh): nội dung đang có trên vùng lúc mở cửa là nội dung được chạy.
// Trả về true khi cửa mở (false: đang giảm chuyển động — không gắn lớp nào).
export function moCuaVao(el, { lop = 'dang-vao', ms = MS_VAO, lai = false, them = [] } = {}) {
  if (!el) return false;
  dongCuaVao(el);
  if (!coChuyenDong()) return false;
  const ds = [lop, ...(lai ? ['vao-lai'] : []), ...them];
  el.classList.add(...ds);
  const c = { lop: ds, cho: new Map(), hen: henDong(el, ms) };
  CUA.set(el, c);
  canhVeLai(el, c);
  return true;
}

export const dangVao = (el) => Boolean(el && CUA.has(el));

// Gọi ngay trước mỗi lần vẽ lại nội dung của vùng: lần vẽ đầu trong cửa đang mở thì giữ cửa (hiệu ứng chạy trên nội dung vừa vẽ); từ lần vẽ thứ hai
// (người dùng bấm tiếp trong lúc hiệu ứng còn chạy) thì đóng cửa trước, nội dung mới hiện ngay.
export function truocKhiVe(el) {
  const c = el ? CUA.get(el) : null;
  if (!c) return;
  if (c.daVe) dongCuaVao(el); else c.daVe = true;
}

// Chạy fn ngay khi vùng không có hiệu ứng đang chạy; có thì chờ cửa đóng. Cùng một khoá: chỉ giữ việc đến sau.
export function sauKhiVao(el, fn, khoa = fn) {
  const c = el ? CUA.get(el) : null;
  if (c) c.cho.set(khoa, fn); else fn();
}

// Vẽ sau một lượt nạp nền. daCo: vùng đang hiện nội dung của lượt nạp trước (vừa vào lại mục) — đang chạy hiệu ứng vào mục thì chờ hiệu ứng xong mới vẽ
// lại, không cắt ngang (lỗi của lần vẽ chờ báo qua khiLoi); lúc cửa đóng mà vùng đã ẩn (người dùng rời mục) thì bỏ lần vẽ đó — lần mở sau tự nạp
// và vẽ lại. Chưa có nội dung (lần nạp đầu): vẽ ngay, nội dung mới chạy hiệu ứng của nó.
export function veSauNap(el, daCo, ve, khiLoi) {
  if (!daCo || !dangVao(el)) { ve(); return; }
  sauKhiVao(el, () => {
    if (el.classList.contains('hidden')) return;
    try { ve(); } catch (e) { if (khiLoi) khiLoi(e); else throw e; }
  }, 'nap');
}

// Số lăn: mỗi chữ số một ô .cs mang --d (chữ số đích) và --i (thứ tự cột, lệch pha); ký tự khác (dấu chấm, %) giữ nguyên. Dùng thẻ <data> / <bdi>
// (không phải <span>) để quy tắc CSS viết theo thẻ của nơi đặt số (".nq-o span"…) không đổi cỡ, màu của số.
export function soLanHtml(giaTri) {
  let i = 0;
  const than = [...String(giaTri ?? '')].map((ky) => (ky >= '0' && ky <= '9' ? `<bdi class="cs" style="--d:${ky};--i:${i++}">${ky}</bdi>` : escapeHtml(ky))).join('');
  return `<data class="so-lan" value="${escapeHtml(giaTri ?? '')}">${than}</data>`;
}

// Đặt số vào một phần tử: chỉ vẽ lại khi số đổi — số đang lăn không bị lần nạp lại nền (cùng giá trị) cắt ngang; chữ trong DOM vẫn là con số.
export function datSo(el, giaTri) {
  const s = String(giaTri ?? '');
  if (el && el.textContent !== s) el.innerHTML = soLanHtml(s);
}

// Tách một từ thành các chữ cái (cả dấu tiếng Việt dạng tổ hợp đi cùng chữ gốc).
function chuCai(tu) {
  try { return [...new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(tu)].map((x) => x.segment); } catch { return [...tu.normalize('NFC')]; }
}

// Tiêu đề hiện từng chữ: soTuDau từ đầu chữ thẳng, phần còn lại là cụm nhấn in nghiêng có chân (.nhan-td — DESIGN mục 3). Mỗi từ một khối không ngắt
// dòng (.tu), mỗi chữ cái một ô (.chu) mang --i. Bọc aria-hidden: thẻ tiêu đề chứa nó cần aria-label nguyên văn.
export function tieuDeHtml(text, soTuDau = 2) {
  const tu = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  let i = 0;
  const khoi = (ds) => ds.map((t) => `<span class="tu">${chuCai(t).map((c) => `<span class="chu" style="--i:${i++}">${escapeHtml(c)}</span>`).join('')}</span>`).join(' ');
  const dau = khoi(tu.slice(0, soTuDau)); const sau = tu.slice(soTuDau);
  return `<span class="tach-chu" aria-hidden="true">${dau}${sau.length ? ` <em class="nhan-td">${khoi(sau)}</em>` : ''}</span>`;
}

// Đường xu hướng nhỏ (sparkline) từ một dãy số không âm: khung 100×28, nét có pathLength="1" để CSS vẽ dần từ trái sang phải; vùng tô nhạt bên dưới.
// Dãy dưới hai điểm hoặc toàn số 0 → chuỗi rỗng (không vẽ đường phẳng gây hiểu nhầm).
export function duongNhoSvg(ds, lop = '') {
  const so = (ds || []).map((v) => Number(v) || 0);
  const lon = Math.max(0, ...so);
  if (so.length < 2 || !lon) return '';
  const R = 100; const C = 28; const le = 3;
  const diem = so.map((v, i) => [(i / (so.length - 1)) * R, C - le - (v / lon) * (C - 2 * le)]);
  const net = diem.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [cx, cy] = diem[diem.length - 1];
  return `<svg class="${lop ? `duong-nho ${lop}` : 'duong-nho'}" viewBox="0 0 ${R} ${C}" aria-hidden="true"><path class="dn-vung" d="${net} L${R} ${C} L0 ${C} Z"/>
    <path class="dn-net" pathLength="1" d="${net}"/><circle class="dn-diem" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.2"/></svg>`;
}
