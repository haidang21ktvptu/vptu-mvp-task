// Màn "Rà soát mục tiêu then chốt" (v3.25 — "thêm nhanh, lãnh đạo không phải bấm"): cán bộ gắn được mục tiêu (người giao / nhập việc, lãnh đạo phụ
// trách — gan_muc_tieu là chốt) xem các việc đã giao, hệ thống tự nhận diện (goi_y_muc_tieu_viec — 0110, 200 việc mỗi lượt, trang đang xem trước),
// mục tích sẵn đã tích, mục gợi ý bấm để thêm; Chấp nhận từng việc hoặc hàng loạt (xác nhận tại chỗ). Lọc: chưa gắn / có gợi ý chưa xử lý / tất cả,
// phòng, văn bản, nhóm mục tiêu gợi ý, tìm. 50 việc mỗi trang. Mở bằng hành động moRaSoatMucTieu (data-vb = lọc sẵn một văn bản) từ Nhiệm vụ, Tổng quan.
import { $, show, setText, escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { setActiveNav, showSection, sectionDangHien } from '../../shell/index.js';
import { loadDanhMucKl, loadKlRows, danhMucKl } from '../../../lib/kl/du-lieu.js';
import { goiYMucTieuViec, ganVaoDong } from '../../../lib/kl/muc-tieu-db.js';
import { dsNhom, mucTieuCua } from '../../../lib/kl/muc-tieu.js';
import { apGoiY, sauKhiLuu } from '../../../lib/kl/goi-y-muc-tieu.js';
import { chiXem } from '../../../lib/kl/pham-vi.js';
import { laTangGiao } from '../../../lib/kl/sua-tang.js';
import { boSoThuTu } from '../../../lib/kl/nhan.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { boDau } from '../../../lib/tim-chon.js';
import { dangKyO, boO, veO, lyDoChu } from '../kl/chon-muc-tieu.js';
import { moNhiemVu } from '../kl/index.js';
import { timKlRow } from '../kl/danh-sach.js';
import { raSoatTemplate } from './template.js';
import { dongHtml, capNhatDong, khoaO } from './dong.js';
import { taoTrangThai, choXuLy, nhomGoiY, coThayDoi } from './ke-hoach.js';
import { luuViec, chuKetQua } from './luu.js';

const MOI_TRANG = 50; const PHAN = 200; const PHONG_KHAC = '__khac__';
const rs = { rows: [], tt: new Map(), kq: new Map(), thaoTac: new Set(), daLuu: new Set(), loc: { che: 'chua', phong: '', vb: '', nhom: '', tim: '' },
  trang: 0, luot: 0, dangVe: [], dangLuu: false, luc: null, chayGoiY: false, uuTien: [], lanDoc: new Map() };   // lanDoc: dòng được đọc lại (lamMoiDong)
const vai = () => state.user?.role_group;
const dm = () => danhMucKl().mucTieu || [];
// Nút / lối vào chỉ ẩn hiện cho đẹp: không phải Thường trực, tài khoản đang hoạt động, có danh mục mục tiêu. DB (gan_muc_tieu) là chốt.
export const coRaSoat = (u = state.user) => Boolean(u) && u.role_group !== 'A0' && !u.bi_khoa && !u.is_system && dm().length > 0;
const duocRaSoat = (r) => !chiXem(r) && (laTangGiao(r) || ['A1', 'A2'].includes(vai()));
const timDong = (id) => rs.rows.find((r) => r.id === id);
const phongCua = (r) => r.owner_phong || PHONG_KHAC;
const xDong = (r) => ({ dm: dm(), kq: rs.kq.get(r.id), daLuu: rs.daLuu.has(r.id), coKe: coThayDoi(r, rs.tt.get(r.id)), thaoTac: rs.thaoTac.has(r.id) });
const coGoiY = (id) => rs.kq.has(id) && rs.kq.get(id) !== 'loi';

function khopPhu(r) {
  const l = rs.loc;
  if (l.phong && phongCua(r) !== l.phong) return false;
  if (l.vb && r.van_ban_id !== l.vb) return false;
  if (l.nhom && !(coGoiY(r.id) && nhomGoiY(rs.tt.get(r.id), dm()).has(l.nhom))) return false;
  if (l.tim) { const q = boDau(l.tim.trim()); if (q && ![r.ma, r.noi_dung, r.so_ket_luan].some((s) => boDau(s || '').includes(q))) return false; }
  return true;
}
const theoChe = (che, r) => (che === 'chua' ? mucTieuCua(r).length === 0 : che === 'cho' ? coGoiY(r.id) && choXuLy(r, rs.tt.get(r.id)) : true);
const dsLoc = () => rs.rows.filter((r) => khopPhu(r) && theoChe(rs.loc.che, r));
const dsHangLoat = () => dsLoc().filter((r) => coGoiY(r.id) && coThayDoi(r, rs.tt.get(r.id)));

const opt = (v, t, chon) => `<option value="${escapeHtml(v)}"${chon ? ' selected' : ''}>${escapeHtml(t)}</option>`;
function veLoc() {
  const l = rs.loc; const dem = (f) => { const m = new Map(); rs.rows.forEach((r) => { const k = f(r); if (k) m.set(k, (m.get(k) || 0) + 1); }); return m; };
  const p = dem(phongCua);
  $('rsPhong').innerHTML = opt('', 'Mọi phòng', !l.phong) + [...p].map(([k, n]) => [k, n, k === PHONG_KHAC ? 'Đơn vị khác' : DEPT_NAMES[k] || boSoThuTu(k)])
    .sort((a, b) => a[2].localeCompare(b[2], 'vi')).map(([k, n, ten]) => opt(k, `${ten} (${n})`, l.phong === k)).join('');
  const vb = new Map(); rs.rows.forEach((r) => { if (r.van_ban_id && !vb.has(r.van_ban_id)) vb.set(r.van_ban_id, r); });
  const nVb = dem((r) => r.van_ban_id);
  $('rsVanBan').innerHTML = opt('', 'Mọi văn bản', !l.vb) + [...vb.values()].sort((a, b) => (b.ngay_ban_hanh || '').localeCompare(a.ngay_ban_hanh || ''))
    .map((r) => opt(r.van_ban_id, `${r.so_ket_luan || 'Không số'} (${nVb.get(r.van_ban_id)})`, l.vb === r.van_ban_id)).join('');
  $('rsNhom').innerHTML = opt('', 'Mọi nhóm mục tiêu gợi ý', !l.nhom) + dsNhom(danhMucKl().nhomMucTieu, dm()).map((n) => opt(n.ma, n.ten, l.nhom === n.ma)).join('');
  $('rsTim').value = l.tim;
}
function veDem() {
  const ds = rs.rows.filter(khopPhu);
  setText('rsDem-chua', ds.filter((r) => theoChe('chua', r)).length); setText('rsDem-tat', ds.length);
  const xong = rs.rows.filter((r) => rs.kq.has(r.id)).length;
  setText('rsDem-cho', xong < rs.rows.length && !ds.filter((r) => theoChe('cho', r)).length ? '…' : ds.filter((r) => theoChe('cho', r)).length);
  document.querySelectorAll('#rsChe button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.che === rs.loc.che)));
}
function veTrangThai() {
  const xong = rs.rows.filter((r) => rs.kq.has(r.id)).length;
  setText('rsTrangThai', !rs.luc ? '' : xong < rs.rows.length ? `Đang nhận diện gợi ý: ${xong}/${rs.rows.length} việc…`
    : `Đã nhận diện gợi ý cho ${rs.rows.length} việc · ${rs.rows.filter((r) => coGoiY(r.id) && choXuLy(r, rs.tt.get(r.id))).length} việc còn mục cần xử lý.`);
}
function veHangLoat() {
  const n = dsHangLoat().length;
  $('rsNutHangLoat').textContent = n ? `Chấp nhận các mục đã tích sẵn cho ${n} việc` : 'Chấp nhận các mục đã tích sẵn';
  $('rsNutHangLoat').disabled = !n || rs.dangLuu;
}
const chuTrong = () => (!rs.rows.length ? 'Không có nhiệm vụ nào đồng chí gắn được mục tiêu then chốt.'
  : rs.loc.che === 'chua' && !rs.loc.phong && !rs.loc.vb && !rs.loc.nhom && !rs.loc.tim ? 'Mọi việc trong phạm vi đã có mục tiêu then chốt.'
    : rs.loc.che === 'cho' && rs.rows.some((r) => !rs.kq.has(r.id)) ? 'Đang nhận diện gợi ý — danh sách sẽ hiện dần.' : 'Không có việc nào phù hợp điều kiện lọc.');

function ve() {
  const ds = dsLoc(); const soTrang = Math.max(1, Math.ceil(ds.length / MOI_TRANG));
  rs.trang = Math.min(rs.trang, soTrang - 1);
  const trang = ds.slice(rs.trang * MOI_TRANG, (rs.trang + 1) * MOI_TRANG);
  rs.dangVe.forEach(boO); rs.dangVe = trang.map((r) => khoaO(r.id));
  trang.forEach((r) => dangKyO(khoaO(r.id), rs.tt.get(r.id), { khiDoi: () => khiDoi(r.id) }));
  $('rsDs').innerHTML = trang.length ? trang.map((r) => dongHtml(r, xDong(r))).join('') : `<p class="trong-nho">${chuTrong()}</p>`;
  trang.forEach((r) => veO(khoaO(r.id)));
  $('rsTrang').innerHTML = soTrang > 1 ? `<button type="button" class="nut nho" data-action="rsTrang" data-trang="${rs.trang - 1}"${rs.trang ? '' : ' disabled'}>‹ Trang trước</button>
    <span class="chu-phu">Trang ${rs.trang + 1}/${soTrang} · ${ds.length} việc</span>
    <button type="button" class="nut nho" data-action="rsTrang" data-trang="${rs.trang + 1}"${rs.trang + 1 < soTrang ? '' : ' disabled'}>Trang sau ›</button>` : ds.length ? `<span class="chu-phu">${ds.length} việc</span>` : '';
  veDem(); veHangLoat(); veTrangThai();
  if (rs.luc) $('rsDs').dataset.nap = rs.luc.toISOString(); else $('rsDs').removeAttribute('data-nap');
  napGoiY(trang.map((r) => r.id));
}

// Gợi ý: một vòng chạy duy nhất; mỗi lượt lấy trang đang xem trước rồi các việc còn lại. Lượt nạp lại danh sách (rs.luot đổi) dừng vòng cũ.
async function napGoiY(uuTien) {
  rs.uuTien = uuTien;
  if (rs.chayGoiY) return;
  rs.chayGoiY = true; const lan = rs.luot;
  try {
    for (;;) {
      if (lan !== rs.luot || !sectionDangHien('viewRaSoatMucTieu')) break;
      const thieu = (ids) => ids.filter((id) => !rs.kq.has(id));
      const phan = [...new Set([...thieu(rs.uuTien), ...thieu(rs.rows.map((r) => r.id))])].slice(0, PHAN);
      if (!phan.length) break;
      const lanCu = new Map(phan.map((id) => [id, rs.lanDoc.get(id) || 0]));
      let kq = null;
      try { kq = await goiYMucTieuViec(phan); } catch { kq = null; }
      if (lan !== rs.luot) break;
      phan.forEach((id) => {
        if ((rs.lanDoc.get(id) || 0) !== lanCu.get(id)) return;   // dòng vừa đọc lại trong lúc chờ (ghi trong ngăn): kết quả cũ bỏ, lượt sau nhận diện lại
        const x = kq?.[id]; rs.kq.set(id, x || 'loi'); if (x) apGoiY(rs.tt.get(id), x, { moTa: lyDoChu });
      });
      sauGoiY(phan);
    }
  } finally { rs.chayGoiY = false; }
}
function sauGoiY(ids) {
  const dangVe = new Set(rs.dangVe);
  ids.forEach((id) => { if (dangVe.has(khoaO(id))) { veO(khoaO(id)); capNhatDong(timDong(id), xDong(timDong(id))); } });
  const xong = rs.rows.every((r) => rs.kq.has(r.id));
  // Lọc theo gợi ý (có gợi ý chưa xử lý / nhóm): trang đang thiếu dòng thì vẽ lại cho dòng mới hiện dần; còn lại chỉ cập nhật số.
  if ((rs.loc.che === 'cho' || rs.loc.nhom) && (rs.dangVe.length < MOI_TRANG || xong) && !rs.thaoTac.size) { ve(); return; }
  veDem(); veHangLoat(); veTrangThai();
}
function khiDoi(id) {
  rs.thaoTac.add(id);
  const r = timDong(id); if (r) capNhatDong(r, xDong(r));
  veHangLoat();
}
// Ghi trong ngăn chi tiết mở từ một dòng (gắn / bỏ mục tiêu, "Lưu cho cả văn bản", sửa nội dung…): dòng của việc đó (napLaiViec đã thay dòng mới vào
// danh sách Nhiệm vụ trước khi phát 'viec-da-ghi') và các dòng cùng văn bản có phần gắn đổi (theo bộ nhớ gắn mục tiêu vừa cập nhật) đọc lại, nhận diện
// lại — mục vừa bỏ trong ngăn không còn tích sẵn trên dòng (kiểm tay 18/10). Dòng đồng chí đang chọn dở mà phần gắn không đổi: giữ lựa chọn.
const giongGan = (a, b) => ['muc_tieu_rieng', 'muc_tieu_vb'].every((k) => (a?.[k] || []).join('|') === (b?.[k] || []).join('|'));
function lamMoiDong(id) {
  const moi = timKlRow(id); if (!moi) return;
  let doi = false;
  rs.rows.forEach((r, i) => {
    const day = r.id === id; if (!day && (!moi.van_ban_id || r.van_ban_id !== moi.van_ban_id)) return;
    const dong = day ? moi : ganVaoDong({ ...r }); const giu = giongGan(r, dong);
    if (!day && giu) return;
    rs.rows[i] = dong; rs.kq.delete(r.id); rs.daLuu.delete(r.id); rs.lanDoc.set(r.id, (rs.lanDoc.get(r.id) || 0) + 1); doi = true;
    if (giu && rs.thaoTac.has(r.id)) return;   // gợi ý nhận diện lại áp vào lựa chọn đang có
    const tt = taoTrangThai(dong); tt.bo = new Set(rs.tt.get(r.id)?.bo || []);   // mục đồng chí đã bỏ trên dòng: không tích lại
    rs.tt.set(r.id, tt); rs.thaoTac.delete(r.id);
  });
  if (doi) ve();
}

async function nap() {
  const lan = ++rs.luot;
  rs.luc = null; $('rsDs').innerHTML = '<p class="trong-nho">Đang tải dữ liệu…</p>'; $('rsDs').removeAttribute('data-nap');
  try {
    await loadDanhMucKl();
    const { rows } = await loadKlRows();
    if (lan !== rs.luot) return;
    rs.rows = rows.filter(duocRaSoat).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '') || (b.ma || '').localeCompare(a.ma || ''));
    rs.tt = new Map(rs.rows.map((r) => [r.id, taoTrangThai(r)])); rs.kq = new Map(); rs.thaoTac = new Set(); rs.daLuu = new Set(); rs.lanDoc = new Map(); rs.luc = new Date();
    veLoc(); ve();
  } catch (e) { if (lan === rs.luot) { notifyError(`Không đọc được danh sách nhiệm vụ: ${e.message}`); $('rsDs').innerHTML = '<p class="trong-nho">Chưa đọc được dữ liệu — bấm Tải lại.</p>'; } }
}

export function moRaSoatMucTieu(ds = {}) {
  showSection('viewRaSoatMucTieu'); setActiveNav('navKl');
  rs.loc = { che: ds.vb ? 'tat' : 'chua', phong: '', vb: ds.vb || '', nhom: '', tim: '' }; rs.trang = 0; an();
  return nap();
}
const an = () => show('rsXacNhan', false);

async function luu(ds) {
  if (rs.dangLuu || !ds.length) return;
  rs.dangLuu = true; veHangLoat(); an();
  document.querySelectorAll('#rsDs [data-action="rsLuu"]').forEach((b) => { b.disabled = true; });
  try {
    const kq = await luuViec(ds.map((r) => ({ r, tt: rs.tt.get(r.id), daThaoTac: rs.thaoTac.has(r.id) })), { tienDo: (a, b) => setText('rsTrangThai', `Đang lưu ${a}/${b} việc…`) });
    kq.ok.forEach((r) => {
      const cu = rs.tt.get(r.id); const tt = taoTrangThai(r); tt.bo = new Set(cu?.bo || []);   // mục người dùng đã bỏ: không tích lại
      if (coGoiY(r.id)) { const x = sauKhiLuu(rs.kq.get(r.id), mucTieuCua(r), kq.maMoi); rs.kq.set(r.id, x); apGoiY(tt, x, { moTa: lyDoChu }); }   // như máy chủ trả sau "bỏ" (0115)
      rs.tt.set(r.id, tt); rs.daLuu.add(r.id); rs.thaoTac.delete(r.id);
      if (rs.dangVe.includes(khoaO(r.id))) { dangKyO(khoaO(r.id), tt, { khiDoi: () => khiDoi(r.id) }); veO(khoaO(r.id)); }
    });
    (kq.loi.length || kq.loiSoHieu.length ? notifyError : notifySuccess)(chuKetQua(kq));
  } catch (e) { notifyError(`Không lưu được: ${e.message}`); }
  rs.dangLuu = false;
  rs.dangVe.forEach((k) => { const r = timDong(k.slice(3)); if (r) capNhatDong(r, xDong(r)); });
  veDem(); veHangLoat(); veTrangThai();
}
function moXacNhan() {
  const n = dsHangLoat().length; if (!n) return;
  setText('rsXacNhanChu', `Gắn mục tiêu then chốt cho ${n} việc theo lựa chọn đang hiện ở từng việc (mục tích sẵn có căn cứ chắc: số hiệu văn bản, cụm từ đặc trưng, lĩnh vực; mục đồng chí đã chọn, đã bỏ giữ nguyên). Có thể sửa lại từng việc ở ngăn chi tiết.`);
  show('rsXacNhan', true); $('rsXacNhanNut').focus();
}

let henTim = null;
export function registerRaSoatMucTieu() {
  $('viewRaSoatMucTieu').innerHTML = raSoatTemplate;
  [['rsPhong', 'phong'], ['rsVanBan', 'vb'], ['rsNhom', 'nhom']].forEach(([id, k]) => $(id).addEventListener('change', (e) => { rs.loc[k] = e.target.value; rs.trang = 0; an(); ve(); }));
  $('rsTim').addEventListener('input', (e) => { clearTimeout(henTim); henTim = setTimeout(() => { rs.loc.tim = e.target.value; rs.trang = 0; ve(); }, 250); });
  document.addEventListener('viec-da-ghi', (e) => { if (sectionDangHien('viewRaSoatMucTieu')) lamMoiDong(e.detail); });
  registerActions({
    moRaSoatMucTieu: (ds) => moRaSoatMucTieu(ds), rsNapLai: () => nap(),
    rsChe: ({ che }) => { rs.loc.che = che; rs.trang = 0; an(); ve(); },
    rsTrang: ({ trang }) => { rs.trang = Math.max(0, Number(trang) || 0); ve(); $('rsDs').scrollIntoView({ block: 'start' }); },
    rsMoViec: ({ id, ma }) => moNhiemVu(id, ma),
    rsLuu: ({ id }) => { const r = timDong(id); if (r) luu([r]); },
    rsHangLoat: moXacNhan, rsHangLoatHuy: an, rsHangLoatXacNhan: () => luu(dsHangLoat()),
  });
}
