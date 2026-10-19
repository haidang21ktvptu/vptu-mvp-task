// Ô chọn mục tiêu then chốt có gợi ý (v3.25) — dùng chung: thẻ nhiệm vụ ở Giao việc, mục tiêu văn bản ở khối 1, ngăn chi tiết, rà soát. Trạng thái
// thuần ở lib/kl/goi-y-muc-tieu.js; ở đây vẽ và nhận thao tác (uỷ quyền sự kiện — data-action mtg*, data-mtg = khoá ô). Cách dùng: dangKyO(khoa, tt,
// { khiDoi, coThem }) → chèn khungHtml(khoa) vào trang → veO(khoa) mỗi khi trạng thái đổi (gợi ý về, văn bản đổi). Mục đang tích: chip tên ngắn + nguồn
// (theo văn bản, tích sẵn, gợi ý, AI…; rê chuột xem căn cứ) + nút ×; gợi ý: nút "+ tên" một bấm; "Chọn thêm từ danh mục" (tìm không dấu, theo nhóm);
// "Thêm mục tiêu mới" (cán bộ nhập liệu — them_muc_tieu 0108, dùng được ngay, chặn trùng ở DB). Phím Enter trong ô của khối không gửi biểu mẫu chứa nó.
// v3.26 (0116): ô "Không thuộc mục tiêu then chốt nào" — tích thì bỏ mọi mục đang chọn; chọn một mục thì ô tự bỏ (lib/kl/goi-y-muc-tieu.js).
import { escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifyError, notifySuccess } from '../../../components/toast.js';
import { danhMucKl, loadDanhMucKl, damBaoMucTieu } from '../../../lib/kl/du-lieu.js';
import { dsNhom, timMucTieu, mucTieuTheoNhom, KHONG_THUOC } from '../../../lib/kl/muc-tieu.js';
import { bat, tat, batMoi, dsHien, hieuLuc, laKhongThuoc, moTaLyDo, NHAN_NGUON, TOI_DA } from '../../../lib/kl/goi-y-muc-tieu.js';
import { themMucTieu } from '../../../lib/kl/muc-tieu-db.js';
import { laNguoiNhap } from '../../../lib/kl/nhap/du-lieu.js';
import { boDau } from '../../../lib/tim-chon.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';

const o = new Map();   // khoá → { tt, khiDoi, coThem, trangThai }
const esc = escapeHtml;
const dm = () => danhMucKl().mucTieu || [];
const tenNgan = (ma) => timMucTieu(dm(), ma)?.ten_ngan || ma;
const tenDai = (ma) => timMucTieu(dm(), ma)?.ten || ma;
const goc = (k) => document.querySelector(`.mtg[data-mtg="${CSS.escape(k)}"]`);
const phan = (el, p) => el?.querySelector(`[data-mtg-phan="${p}"]`);
export const coQuyenThemMucTieu = () => laNguoiNhap(state.user) || Boolean(state.user?.quan_tri_he_thong);
// Lý do máy chủ (mảng) → chữ, có tên lĩnh vực / ngành theo danh mục đang nhớ.
export const lyDoChu = (ds) => (typeof ds === 'string' ? ds : moTaLyDo(ds, {
  tenLv: (m) => danhMucKl().linhVuc?.find((l) => l.ma === m)?.ten || m, tenNganh: (m) => danhMucKl().nganh?.find((n) => n.ma === m)?.ten || m }));

let daGan = false;
export function dangKyO(khoa, tt, { khiDoi = () => {}, coThem = coQuyenThemMucTieu() } = {}) {
  if (!daGan) ganMot();
  o.set(khoa, { tt, khiDoi, coThem, trangThai: '' });
  return o.get(khoa);
}
export const layO = (khoa) => o.get(khoa) || null;
export const boO = (khoa) => { o.delete(khoa); };
export function datTrangThai(khoa, chu) { const x = o.get(khoa); if (!x) return; x.trangThai = chu || ''; const el = phan(goc(khoa), 'tt'); if (el) el.textContent = x.trangThai; }

// Khung tĩnh (chèn một lần); phần đổi vẽ bằng veO. batBuoc (v3.26): thẻ Giao việc bắt buộc phân loại → dấu * như các ô bắt buộc khác.
export function khungHtml(k, { nhan = 'Mục tiêu then chốt', chuThich = '', batBuoc = false } = {}) {
  const x = o.get(k); const nhomDung = dsNhom(danhMucKl().nhomMucTieu, dm()).filter((n) => n.dang_dung !== false);
  return `<div class="mtg" data-mtg="${esc(k)}" role="group" aria-label="${esc(nhan)}${batBuoc ? ' (bắt buộc)' : ''}">
    <div class="mtg-dau"><span class="nhan">${esc(nhan)}${batBuoc ? '<b class="gv-bb" aria-hidden="true">*</b>' : ''}</span>${chuThich ? `<small class="gv-chu-thich">${chuThich}</small>` : ''}</div>
    <div class="mtg-hang" data-mtg-phan="chon"></div>
    <div class="mtg-hang mtg-gy-hang" data-mtg-phan="goi-y"></div>
    <div class="mtg-nut"><label class="mt-o mtg-khong"><input type="checkbox" data-mtg-khong="${esc(k)}"><span>Không thuộc mục tiêu then chốt nào</span></label>
      <button type="button" class="nut nho" data-action="mtgMoDm" data-mtg="${esc(k)}" aria-expanded="false">Chọn thêm từ danh mục</button>
      ${x?.coThem ? `<button type="button" class="nut nho" data-action="mtgMoThem" data-mtg="${esc(k)}" aria-expanded="false">+ Thêm mục tiêu mới</button>` : ''}
      <span class="mtg-tt chu-phu" data-mtg-phan="tt" aria-live="polite"></span></div>
    <div class="mtg-dm" data-mtg-phan="dm" hidden><input type="search" class="o-nhap mtg-tim" data-mtg-tim="${esc(k)}" placeholder="Tìm theo tên, số hiệu (không cần dấu)…" autocomplete="off" aria-label="Tìm mục tiêu trong danh mục">
      <div class="mtg-dm-ds" data-mtg-phan="dm-ds"></div></div>
    ${x?.coThem ? `<div class="mtg-them" data-mtg-phan="them" hidden>
      <div class="cot-3"><label class="gv-truong"><span class="nhan">Nhóm</span><select class="o-nhap" data-mtg-f="nhom">${nhomDung.map((n) => `<option value="${esc(n.ma)}">${esc(n.ten)}</option>`).join('')}</select></label>
        <label class="gv-truong"><span class="nhan">Số hiệu (nếu có)</span><input type="text" class="o-nhap" data-mtg-f="so_hieu" maxlength="20" placeholder="Ví dụ 81-NQ/TW" autocomplete="off"></label>
        <label class="gv-truong"><span class="nhan">Tên ngắn</span><input type="text" class="o-nhap" data-mtg-f="ten_ngan" maxlength="120" placeholder="Để trống = theo tên" autocomplete="off"></label></div>
      <label class="gv-truong"><span class="nhan">Tên mục tiêu<b class="gv-bb" aria-hidden="true">*</b></span><input type="text" class="o-nhap" data-mtg-f="ten" maxlength="300" placeholder="Ghi đúng tên trong nghị quyết, chương trình" autocomplete="off"></label>
      <div class="mtg-them-chan"><button type="button" class="nut nho chinh" data-action="mtgLuuThem" data-mtg="${esc(k)}">Thêm và chọn</button><button type="button" class="nut nho" data-action="mtgHuyThem" data-mtg="${esc(k)}">Huỷ</button>
        <small class="chu-phu">Mục mới dùng được ngay cho mọi cán bộ; trùng số hiệu hoặc trùng tên trong nhóm sẽ bị chặn; quản trị hệ thống đối chiếu văn bản gốc sau.</small></div></div>` : ''}
  </div>`;
}

const NHAN_NGAN = { VAN_BAN: 'theo văn bản', QUY_TAC: 'tích sẵn', GOI_Y: 'gợi ý', AI: 'AI gợi ý', EXCEL: 'Excel', RA_SOAT: 'rà soát', GOP: 'gộp' };
function chip(k, it) {
  const goi = [tenDai(it.ma), NHAN_NGUON[it.nguon], it.ly_do ? `căn cứ: ${it.ly_do}` : ''].filter(Boolean).join(' — ');
  const nn = it.nguon === 'QUY_TAC' && it.tu !== 'tich' ? 'theo quy tắc' : NHAN_NGAN[it.nguon] || '';
  return `<span class="mtg-chip" data-nguon="${esc(it.nguon)}" title="${esc(goi)}"><span class="mtg-ten">${esc(tenNgan(it.ma))}</span>${nn ? `<small class="mtg-nguon">${esc(nn)}</small>` : ''}
    <button type="button" class="mtg-bo" data-action="mtgTat" data-mtg="${esc(k)}" data-ma="${esc(it.ma)}" aria-label="Bỏ mục tiêu ${esc(tenNgan(it.ma))}" title="Bỏ">×</button></span>`;
}
const tenMoi = (x) => `${/-CTr\//.test(x.so_hieu) ? 'Chương trình' : 'Nghị quyết'} ${x.so_hieu}`;
function chipMoi(k, x) {
  return `<span class="mtg-chip moi" data-nguon="MOI" title="${esc(`${tenMoi(x)}${x.ve ? ` ${x.ve}` : ''} — chưa có trong danh mục; khi lưu, hệ thống tự thêm vào danh mục rồi gắn`)}"><span class="mtg-ten">${esc(tenMoi(x))}</span><small class="mtg-nguon">mới — thêm vào danh mục khi lưu</small>
    <button type="button" class="mtg-bo" data-action="mtgMoi" data-mtg="${esc(k)}" data-sh="${esc(x.so_hieu)}" data-chon="0" aria-label="Bỏ ${esc(tenMoi(x))}" title="Bỏ">×</button></span>`;
}
function nutGoiY(k, g) {
  const ly = g.nguon === 'AI' ? [g.ly_do, g.trich ? `trích: “${g.trich}”` : ''].filter(Boolean).join(' — ') : lyDoChu(g.ly_do);
  return `<button type="button" class="mtg-gy" data-action="mtgBat" data-mtg="${esc(k)}" data-ma="${esc(g.ma)}" data-nguon="${g.nguon}" title="${esc(`${tenDai(g.ma)}${ly ? ` — ${ly}` : ''}`)}">
    <span aria-hidden="true">+</span> ${esc(tenNgan(g.ma))}${g.nguon === 'AI' ? '<small class="mtg-ai">AI</small>' : ''}</button>`;
}
const nutMoiGoiY = (k, x) => `<button type="button" class="mtg-gy" data-action="mtgMoi" data-mtg="${esc(k)}" data-sh="${esc(x.so_hieu)}" data-chon="1" title="${esc(`${tenMoi(x)}${x.ve ? ` ${x.ve}` : ''} — văn bản nhắc tới, chưa có trong danh mục; chọn thì khi lưu hệ thống thêm vào danh mục`)}"><span aria-hidden="true">+</span> ${esc(tenMoi(x))}<small class="mtg-ai">mới</small></button>`;

function dsDmHtml(k) {
  const x = o.get(k); const el = goc(k); const q = boDau(el?.querySelector('[data-mtg-tim]')?.value || '').trim();
  const co = new Set(hieuLuc(x.tt));
  const khop = (m) => !q || boDau(`${m.ten_ngan} ${m.ten} ${m.so_hieu || ''} ${m.mo_ta || ''}`).includes(q);
  const nhom = dsNhom(danhMucKl().nhomMucTieu, dm()).map((n) => {
    const ds = mucTieuTheoNhom(dm(), n.ma).filter((m) => (m.dang_dung !== false || co.has(m.ma)) && !m.gop_vao && khop(m));
    return ds.length ? `<fieldset class="mt-nhom"><legend>${esc(n.tab || n.ten)}</legend>${ds.map((m) => `<label class="mt-o" title="${esc(m.ten)}">
      <input type="checkbox" data-mtg-chon="${esc(k)}" value="${esc(m.ma)}"${co.has(m.ma) ? ' checked' : ''}><span>${esc(m.ten_ngan)}</span></label>`).join('')}</fieldset>` : '';
  }).join('');
  return nhom ? `<div class="mt-chon">${nhom}</div>` : `<p class="chu-phu">Không có mục tiêu khớp "${esc(q)}".${x.coThem ? ' Có thể thêm mục tiêu mới vào danh mục.' : ''}</p>`;
}

export function veO(k) {
  const x = o.get(k); const el = goc(k);
  if (!x || !el) return;
  const h = dsHien(x.tt);
  const moiChon = h.moi.filter((m) => m.chon); const moiGoiY = h.moi.filter((m) => !m.chon);
  const ghiChu = x.tt.vb.length && !hieuLuc(x.tt).length && !moiChon.length ? '<small class="chu-phu">Không chọn mục nào: việc tính theo mục tiêu của văn bản.</small>' : '';
  const khong = laKhongThuoc(x.tt); const chon = h.daChon.filter((it) => it.ma !== KHONG_THUOC);
  const kt = h.daChon.find((it) => it.ma === KHONG_THUOC);
  const nguonKt = kt?.theoVb ? ' — theo văn bản' : kt?.nguon === 'AI' ? ' — trợ lý AI đề xuất, đồng chí kiểm tra' : '';
  phan(el, 'chon').innerHTML = khong ? `<span class="mtg-chip" data-nguon="KHONG" title="${esc(kt?.ly_do || '')}"><span class="mtg-ten">Không thuộc mục tiêu then chốt nào</span><small class="mtg-nguon">${esc(nguonKt.replace(' — ', ''))}</small></span>`
    : chon.length || moiChon.length ? `${chon.map((it) => chip(k, it)).join('')}${moiChon.map((m) => chipMoi(k, m)).join('')}${ghiChu}`
      : `<span class="chu-phu mtg-trong">Chưa phân loại — bấm gợi ý, chọn từ danh mục hoặc tích "Không thuộc mục tiêu then chốt nào".</span>${ghiChu}`;
  const oKt = el.querySelector('[data-mtg-khong]'); if (oKt) oKt.checked = khong;
  const gy = [...h.goiY.map((g) => nutGoiY(k, g)), ...moiGoiY.map((m) => nutMoiGoiY(k, m))];
  phan(el, 'goi-y').innerHTML = gy.length ? `<span class="mtg-gy-nhan">Gợi ý:</span>${gy.join('')}` : '';
  phan(el, 'goi-y').hidden = !gy.length;
  phan(el, 'tt').textContent = x.trangThai;
  if (!phan(el, 'dm').hidden) phan(el, 'dm-ds').innerHTML = dsDmHtml(k);
  const la = [...hieuLuc(x.tt), ...h.goiY.map((g) => g.ma)].filter((ma) => !timMucTieu(dm(), ma));
  if (la.length) damBaoMucTieu(la).then((doc) => { if (doc) veO(k); });   // mã mới thêm ở máy khác: đọc lại danh mục một lần
}

const doi = (k) => { const x = o.get(k); if (!x) return; veO(k); x.khiDoi(x.tt); };
const qua = () => notifyError(`Mỗi việc gắn tối đa ${TOI_DA} mục tiêu then chốt.`);
// Sau khi bấm (vẽ lại cả hàng): tiêu điểm sang gợi ý kế tiếp cùng vị trí, hết gợi ý thì nút "Chọn thêm" — bàn phím không bị rơi về đầu trang.
const tieuDiemSau = (k, i) => { const ds = goc(k)?.querySelectorAll('.mtg-gy'); (ds?.[Math.min(i, ds.length - 1)] || goc(k)?.querySelector('[data-action="mtgMoDm"]'))?.focus({ preventScroll: true }); };
function mtgBat({ mtg: k, ma, nguon }, el) {
  const x = o.get(k); if (!x) return;
  const i = [...(goc(k)?.querySelectorAll('.mtg-gy') || [])].indexOf(el);
  const g = (nguon === 'AI' ? x.tt.ai : x.tt.goiY).find((y) => y.ma === ma);
  if (!bat(x.tt, ma, { nguon: nguon === 'AI' ? 'AI' : 'GOI_Y', ly_do: nguon === 'AI' ? g?.ly_do || null : lyDoChu(g?.ly_do) || null })) { qua(); return; }
  doi(k); tieuDiemSau(k, Math.max(0, i));
}
function mtgTat({ mtg: k, ma }) { const x = o.get(k); if (!x) return; tat(x.tt, ma); doi(k); goc(k)?.querySelector('[data-action="mtgMoDm"]')?.focus({ preventScroll: true }); }
function mtgMoi({ mtg: k, sh, chon }) { const x = o.get(k); if (!x) return; if (!batMoi(x.tt, sh, chon === '1')) { qua(); return; } doi(k); tieuDiemSau(k, 0); }
function moPhan(k, p, nut) {
  const el = goc(k); const vung = phan(el, p); if (!vung) return;
  vung.hidden = !vung.hidden; nut?.setAttribute('aria-expanded', String(!vung.hidden));
  if (!vung.hidden) { if (p === 'dm') { phan(el, 'dm-ds').innerHTML = dsDmHtml(k); vung.querySelector('[data-mtg-tim]').focus(); } else vung.querySelector('[data-mtg-f="ten"]').focus(); }
}
async function mtgLuuThem({ mtg: k }, nut) {
  const x = o.get(k); const vung = phan(goc(k), 'them'); if (!x || !vung) return;
  const v = (f) => vung.querySelector(`[data-mtg-f="${f}"]`).value.trim();
  if (!v('ten')) { notifyError('Nhập tên mục tiêu.'); vung.querySelector('[data-mtg-f="ten"]').focus(); return; }
  nut.disabled = true;
  try {
    const ma = await themMucTieu({ nhom: v('nhom'), ten: v('ten'), tenNgan: v('ten_ngan') || null, soHieu: v('so_hieu') || null, lyDo: 'Bổ sung khi gắn mục tiêu cho nhiệm vụ' });
    await loadDanhMucKl(true);
    if (!bat(x.tt, ma, { nguon: 'CHON' })) qua();
    vung.querySelectorAll('input').forEach((i) => { i.value = ''; }); vung.hidden = true;
    notifySuccess(`Đã thêm "${tenNgan(ma)}" vào danh mục và chọn cho việc này.`);
    doi(k);
  } catch (e) { notifyError(`Chưa thêm được mục tiêu: ${loiDeHieu(e)}`); }
  nut.disabled = false;
}

function ganMot() {
  daGan = true;
  registerActions({ mtgBat, mtgTat, mtgMoi, mtgLuuThem, mtgMoDm: ({ mtg: k }, nut) => moPhan(k, 'dm', nut), mtgMoThem: ({ mtg: k }, nut) => moPhan(k, 'them', nut),
    mtgHuyThem: ({ mtg: k }) => { const v = phan(goc(k), 'them'); if (v) v.hidden = true; } });
  // Sự kiện trong khối không nổi lên biểu mẫu chứa nó (Giao việc vẽ lại tóm tắt, gọi lại bộ nhận diện theo từng ô nhập — khiDoi lo phần cần thiết).
  document.addEventListener('change', (e) => {
    if (!e.target?.closest?.('.mtg')) return;
    e.stopPropagation();
    const kk = e.target.dataset?.mtgKhong;   // ô "Không thuộc mục tiêu then chốt nào"
    if (kk && o.get(kk)) { if (e.target.checked) bat(o.get(kk).tt, KHONG_THUOC, { nguon: 'CHON' }); else tat(o.get(kk).tt, KHONG_THUOC); doi(kk); goc(kk)?.querySelector('[data-mtg-khong]')?.focus({ preventScroll: true }); return; }
    const k = e.target.dataset?.mtgChon; const x = k && o.get(k); if (!x) return;
    if (e.target.checked) { if (!bat(x.tt, e.target.value, { nguon: 'CHON' })) { e.target.checked = false; qua(); return; } } else tat(x.tt, e.target.value);
    const giu = e.target.value; doi(k); goc(k)?.querySelector(`[data-mtg-chon][value="${CSS.escape(giu)}"]`)?.focus({ preventScroll: true });
  }, true);
  document.addEventListener('input', (e) => {
    if (!e.target?.closest?.('.mtg')) return;
    e.stopPropagation();
    const k = e.target.dataset?.mtgTim; if (k && o.get(k)) phan(goc(k), 'dm-ds').innerHTML = dsDmHtml(k);
  }, true);
  document.addEventListener('keydown', (e) => {   // Enter trong ô tìm / ô thêm mới: không gửi biểu mẫu chứa khối (Giao việc, ngăn chi tiết)
    if (e.key !== 'Enter' || !e.target?.closest?.('.mtg') || !e.target.matches('input')) return;
    e.preventDefault();
    if (e.target.dataset.mtgF) goc(e.target.closest('.mtg').dataset.mtg)?.querySelector('[data-action="mtgLuuThem"]')?.click();
  }, true);
}
