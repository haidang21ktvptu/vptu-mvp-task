// Danh sách dài chỉ hiện các dòng đầu (v3.36, CAU-HOI V-13, DESIGN mục 17 quy tắc 6). Mỗi danh sách một tên, đăng ký một lần (vùng chứa, bộ chọn
// dòng, số dòng đầu); danh sách vẫn dựng ĐỦ dòng, dòng thứ `so` trở đi mang data-sau và chỉ bị ẩn trên màn hình (CSS trong @media screen — bản in
// đủ dòng). Nút cuối danh sách "Xem tất cả N …" / "Chỉ hiện N … đầu" đổi tại chỗ, không vẽ lại danh sách; lựa chọn nhớ theo máy (localStorage
// vptu.ds.het = mảng tên danh sách đang mở hết; trình duyệt chặn lưu trữ thì nhớ trong phiên). Dòng đang mở ô nhập, đang mở diễn biến hoặc đang
// giữ tiêu điểm không bị ẩn: danh sách vẽ lại theo realtime (thứ tự đổi) không làm mất ô đang gõ.
import { registerActions } from '../lib/actions.js';

const KHOA = 'vptu.ds.het';
const het = (() => {
  try { const x = JSON.parse(localStorage.getItem(KHOA) || '[]'); return new Set(Array.isArray(x) ? x.filter((i) => typeof i === 'string') : []); } catch { return new Set(); }
})();
const danhSach = new Map();   // tên → { vung: () => phần tử chứa, chon: bộ chọn dòng, so: số dòng đầu, donVi: 'việc' }

export const dangKyDanhSach = (ten, cauHinh) => danhSach.set(ten, { donVi: 'việc', ...cauHinh });
const dong = (c) => [...(c.vung()?.querySelectorAll(c.chon) || [])];
const chuNut = (mo, tong, so, donVi) => (mo ? `Chỉ hiện ${so} ${donVi} đầu` : `Xem tất cả ${tong} ${donVi}`);

// Gọi sau mỗi lần vẽ danh sách, khi các ô đang mở đã được trả lại (giuONhap): đánh dấu các dòng ngoài `so` dòng đầu.
export function apDanhSach(ten) {
  const c = danhSach.get(ten); if (!c) return;
  const mo = het.has(ten);
  dong(c).forEach((d, i) => d.toggleAttribute('data-sau', !mo && i >= c.so && !d.querySelector('form.o.mo, [id^="db-"]') && !d.contains(document.activeElement)));
}

export const nutHetHtml = (ten, tong, so, donVi = 'việc') => (tong > so
  ? `<div class="ds-them"><button type="button" class="nut nho" data-action="dsHet" data-ds="${ten}" aria-expanded="${String(het.has(ten))}">${chuNut(het.has(ten), tong, so, donVi)}</button></div>` : '');

// Bấm nút: mở hết thì tiêu điểm chuyển tới dòng đầu tiên vừa hiện (đứng đúng chỗ nút vừa bấm); thu gọn thì nút vẫn trong tầm nhìn.
function dsHet({ ds }, el) {
  const c = danhSach.get(ds); if (!c) return;
  const mo = !het.has(ds);
  if (mo) het.add(ds); else het.delete(ds);
  try { localStorage.setItem(KHOA, JSON.stringify([...het])); } catch { /* trình duyệt chặn lưu trữ: chỉ nhớ trong phiên */ }
  apDanhSach(ds);
  const ds2 = dong(c);
  if (el) { el.textContent = chuNut(mo, ds2.length, c.so, c.donVi); el.setAttribute('aria-expanded', String(mo)); }
  if (mo) ds2[c.so]?.querySelector('button, a[href], [tabindex]')?.focus({ preventScroll: true });
  else el?.scrollIntoView({ block: 'nearest' });
}

export function mountDsGon() { registerActions({ dsHet }); }
