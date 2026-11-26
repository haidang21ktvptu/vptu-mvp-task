// Chuyển động giao diện (v3.36, chủ dự án chọn 26/11/2026 — CAU-HOI V-12; DESIGN mục 7). CSS + JavaScript thuần, không thư viện.
// - coChuyenDong(): có chạy hiệu ứng không. Tắt khi người dùng bỏ chọn "Hiệu ứng chuyển động" ở menu bánh răng (<html data-chuyen-dong="giam">,
//   shell/kieu-giao-dien.js) hoặc hệ điều hành đặt giảm chuyển động (prefers-reduced-motion — bộ e2e chạy ở chế độ này).
// - "Cửa vào" của một vùng (moCuaVao / dongCuaVao / dangVao / truocKhiVe / sauKhiVao): trong lúc cửa mở, vùng mang lớp dang-vao (vào trang) hoặc dang-doi (số
//   liệu đổi theo thao tác của người dùng); phần tử nào được vẽ vào vùng lúc đó thì chạy hiệu ứng của nó bằng CSS (styles/chuyen-dong.css). Cửa
//   đóng rồi thì mọi lần vẽ lại (realtime, nạp lại nền) hiện ngay, không chạy lại hiệu ứng. Lần vẽ lại của nền đến trong lúc cửa đang mở thì chờ
//   cửa đóng (sauKhiVao) để không cắt ngang hiệu ứng đang chạy.
// - soLanHtml / tieuDeHtml: chuỗi HTML cho số lăn từng chữ số và tiêu đề hiện từng chữ có cụm nhấn in nghiêng. Chữ trong DOM giữ nguyên văn (kiểm
//   thử và trình đọc màn hình đọc như cũ); phần chuyển động là phần tử giả và thuộc tính do CSS vẽ.
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

const CUA = new WeakMap();   // vùng → { lop, hen, cho: việc chờ cửa đóng (theo khoá, việc sau thay việc trước) }

export function dongCuaVao(el) {
  const c = el ? CUA.get(el) : null;
  if (!c) return;
  clearTimeout(c.hen);
  CUA.delete(el);
  el.classList.remove(...c.lop);
  [...c.cho.values()].forEach((fn) => { try { fn(); } catch (e) { setTimeout(() => { throw e; }); } });   // việc chờ lỗi: báo ra ngoài, không cắt ngang nơi đóng cửa
}

// lop: 'dang-vao' (vào trang) | 'dang-doi' (số liệu đổi tại chỗ); lai: đã vào mục này trong lần mở ứng dụng → nhịp nhanh hơn (lớp vao-lai); them: lớp
// kèm theo của riêng màn (ví dụ 'sau-cho': nội dung thật thay khung chờ — phần khung đã hiện không chạy lại).
// Trả về true khi cửa mở (false: đang giảm chuyển động — không gắn lớp nào).
export function moCuaVao(el, { lop = 'dang-vao', ms = MS_VAO, lai = false, them = [] } = {}) {
  if (!el) return false;
  dongCuaVao(el);
  if (!coChuyenDong()) return false;
  const ds = [lop, ...(lai ? ['vao-lai'] : []), ...them];
  el.classList.add(...ds);
  CUA.set(el, { lop: ds, cho: new Map(), hen: setTimeout(() => dongCuaVao(el), ms) });
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

// Số lăn: mỗi chữ số một ô .cs mang --d (chữ số đích) và --i (thứ tự cột, lệch pha); ký tự khác (dấu chấm, %) giữ nguyên.
export function soLanHtml(giaTri) {
  let i = 0;
  const than = [...String(giaTri ?? '')].map((ky) => (ky >= '0' && ky <= '9' ? `<span class="cs" style="--d:${ky};--i:${i++}">${ky}</span>` : escapeHtml(ky))).join('');
  return `<span class="so-lan">${than}</span>`;
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
