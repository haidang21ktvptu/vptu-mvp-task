// Phân hệ Nhiệm vụ quý BTV — khối phân tích mở / gập của Tổng quan quý (v3.36, CAU-HOI V-13, DESIGN mục 17 quy tắc 4, như các khối phân tích của Tổng
// quan): mặc định gập, mỗi khối một dòng (tên khối, số chính, mũi tên); bấm tên khối để mở / gập; "Mở tất cả" / "Thu gọn tất cả"; lựa chọn nhớ theo máy
// (localStorage vptu.nq.khoi; trình duyệt chặn lưu trữ thì chỉ nhớ trong phiên). Khối vẫn dựng đủ trong DOM; gập bằng thuộc tính data-gap, CSS chỉ áp
// trên màn hình (nvq.css) nên bản in đủ khối. Trạng thái gập ghi ngay khi dựng HTML (không cần lượt áp sau khi vẽ); bấm thì đổi thuộc tính tại chỗ.
import { escapeHtml } from '../../lib/dom.js';
import { nutGoi } from '../../components/goi.js';

const KHOA = 'vptu.nq.khoi';
const mo = (() => {
  try { const x = JSON.parse(localStorage.getItem(KHOA) || '[]'); return new Set(Array.isArray(x) ? x.filter((i) => typeof i === 'string') : []); } catch { return new Set(); }
})();
const luu = () => { try { localStorage.setItem(KHOA, JSON.stringify([...mo])); } catch { /* trình duyệt chặn lưu trữ: chỉ nhớ trong phiên */ } };
const MUI = '<svg class="khoi-mui" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
export const KHOI_PHAN_TICH = ['nqTheoLanhDao', 'nqTheoDonVi', 'nqTheoChuTri', 'nqDienBien'];
const moHet = () => KHOI_PHAN_TICH.every((id) => mo.has(id));
const chuNut = () => (moHet() ? 'Thu gọn tất cả' : 'Mở tất cả');

// Hàng tên phần "Phân tích" và nút mở / thu gọn mọi khối.
export const dauPhanTichNq = () => `<div class="nq-pt-dau"><h2>Phân tích</h2><button type="button" class="nut nho" id="nqKhoiTatCa" data-action="nqKhoiTatCa">${chuNut()}</button></div>`;
// Khối gập được: id, tên khối, số chính (hiện khi gập), thân, ghi chú mốc tính (nút "i", hiện khi mở).
export const khoiGapNq = (id, tieuDe, so, than, ghiChu = '') => `<section class="nq-khoi rong nq-gap" id="${id}"${mo.has(id) ? '' : ' data-gap'}><div class="nq-khoi-dau"><div class="nq-khoi-ten">`
  + `<h2><button type="button" class="khoi-mo" data-action="nqKhoi" aria-expanded="${String(mo.has(id))}"><span class="khoi-ten">${escapeHtml(tieuDe)}</span>${so ? `<span class="khoi-so">${escapeHtml(so)}</span>` : ''}${MUI}</button></h2>`
  + `${nutGoi(ghiChu)}</div></div>${than}</section>`;

function dat(a, dangMo) {
  a.toggleAttribute('data-gap', !dangMo);
  a.querySelector(':scope > .nq-khoi-dau .khoi-mo')?.setAttribute('aria-expanded', String(dangMo));
}
const capNhatNut = () => { const n = document.getElementById('nqKhoiTatCa'); if (n) n.textContent = chuNut(); };

export const HANH_DONG_KHOI_NQ = {
  nqKhoi: (_, el) => {
    const a = el?.closest('.nq-gap[id]');
    if (!a) return;
    const dangMo = !mo.has(a.id);
    if (dangMo) mo.add(a.id); else mo.delete(a.id);
    luu(); dat(a, dangMo); capNhatNut();
  },
  nqKhoiTatCa: () => {
    const dangMo = !moHet();
    KHOI_PHAN_TICH.forEach((id) => { if (dangMo) mo.add(id); else mo.delete(id); const a = document.getElementById(id); if (a) dat(a, dangMo); });
    luu(); capNhatNut();
  },
};
