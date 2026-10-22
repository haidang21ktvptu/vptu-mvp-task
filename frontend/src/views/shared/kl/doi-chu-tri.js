// Hộp "Đổi chủ trì theo dõi" (v3.29, 0124 — chủ dự án quyết 22/10/2026, CAU-HOI O-5/O-6): thư ký Thường trực (việc chưa hoàn thành), tài khoản quản
// trị (mọi việc). Chọn cán bộ chủ trì mới và / hoặc người theo dõi mới (cán bộ Văn phòng đang hoạt động; gõ tên để tìm), lý do bắt buộc. Phòng chủ trì
// theo phòng của cán bộ mới (lãnh đạo Văn phòng → Văn phòng Tỉnh ủy), cấp nhận sản phẩm đặt lại theo chủ trì mới. Hàm doi_chu_tri là chốt; nhật ký +
// tin báo chủ trì, người theo dõi cũ và mới, người giao việc. Lãnh đạo Văn phòng vẫn "Giao lại" ở mục Chỉ đạo như trước.
import { $, show, setText, escapeHtml } from '../../../lib/dom.js';
import { state, findAccount } from '../../../lib/state.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { danhMucKl } from '../../../lib/kl/du-lieu.js';
import { boSoThuTu } from '../../../lib/kl/nhan.js';
import { ganTimChon } from '../../../lib/tim-chon.js';
import { doiChuTri } from '../../../lib/kl/quyen-them-db.js';
import { ownerText } from './dong.js';
import { timKlRow } from './danh-sach.js';
import { dh } from '../dieu-hanh/du-lieu.js';

let sauHanhDong = async () => {};
let tim = [];
const dongViec = (id) => timKlRow(id) || dh.rows.find((x) => x.id === id);
const opt = (v, t) => `<option value="${escapeHtml(v)}">${escapeHtml(t)}</option>`;
const THU_TU_PHONG = Object.keys(DEPT_NAMES);

// Cán bộ Văn phòng đang hoạt động (không Thường trực, tài khoản hệ thống, tài khoản khoá): lãnh đạo Văn phòng, rồi từng phòng theo danh bạ
// (Trưởng phòng trước, tên A → Z). nhanTrong = dòng đầu (giữ nguyên).
export function canBoOptionsHtml(accounts, nhanTrong) {
  const ds = accounts.filter((a) => !a.is_system && !a.bi_khoa && a.role_group !== 'A0');
  const sap = (a, b) => Number(b.role_group === 'A2') - Number(a.role_group === 'A2') || (a.full_name || '').localeCompare(b.full_name || '', 'vi');
  const nhom = (nhan, xs) => (xs.length ? `<optgroup label="${escapeHtml(nhan)}">${xs.sort(sap).map((a) => opt(a.id, `${a.full_name}${a.position_title ? ` — ${a.position_title}` : ''}`)).join('')}</optgroup>` : '');
  const vt = (p) => { const i = THU_TU_PHONG.indexOf(p); return i < 0 ? THU_TU_PHONG.length : i; };
  const phong = [...new Set(ds.filter((a) => a.role_group !== 'A1').map((a) => a.department || ''))].sort((a, b) => vt(a) - vt(b) || a.localeCompare(b));
  return opt('', nhanTrong) + nhom('Lãnh đạo Văn phòng', ds.filter((a) => a.role_group === 'A1'))
    + phong.map((p) => nhom(DEPT_NAMES[p] || p || 'Chưa có phòng', ds.filter((a) => a.role_group !== 'A1' && (a.department || '') === p))).join('');
}
// Phòng / đơn vị chủ trì sau khi đổi (như doi_chu_tri: đơn vị trong Văn phòng của phòng cán bộ; lãnh đạo Văn phòng không có → Văn phòng Tỉnh ủy).
function donViMoi(a) {
  const dv = danhMucKl().donVi || [];
  const d = dv.find((x) => x.trong_van_phong && (x.phong || null) === (a.department || null)) || (a.role_group === 'A1' ? dv.find((x) => x.ma === 'VAN_PHONG_TINH_UY') : null);
  return d ? boSoThuTu(d.ten) : '';
}

const template = `
<div id="dctModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="dctTieuDe">
  <form class="modal modal-rong" data-submit="luuDoiChuTri" novalidate>
    <h2 id="dctTieuDe" class="modal-tieu-de">Đổi chủ trì theo dõi</h2>
    <p id="dctMoTa" class="chu-phu mt-1 mb-4"></p>
    <input type="hidden" id="dctId">
    <p class="nhan">Đang ghi</p><p id="dctCu" class="st-cu"></p>
    <div class="cot-2 mt-3">
      <div><label for="dctChuTri" class="nhan">Chủ trì theo dõi mới</label><div class="gv-tim-chon"><input type="search" id="dctChuTriTim" class="o-nhap" placeholder="Gõ tên để tìm…" autocomplete="off" aria-controls="dctChuTri" aria-label="Tìm nhanh chủ trì theo dõi mới (gõ tên, không cần dấu)"><select id="dctChuTri" class="o-nhap"></select></div></div>
      <div><label for="dctTheoDoi" class="nhan">Người theo dõi mới</label><div class="gv-tim-chon"><input type="search" id="dctTheoDoiTim" class="o-nhap" placeholder="Gõ tên để tìm…" autocomplete="off" aria-controls="dctTheoDoi" aria-label="Tìm nhanh người theo dõi mới (gõ tên, không cần dấu)"><select id="dctTheoDoi" class="o-nhap"></select></div></div>
    </div>
    <p id="dctGhiChu" class="chu-phu mt-2" aria-live="polite"></p>
    <div class="mt-3"><label for="dctLyDo" class="nhan">Lý do <span class="chu-phu">bắt buộc, tối đa 500 ký tự</span></label>
      <input type="text" id="dctLyDo" class="o-nhap" maxlength="500" placeholder="Ví dụ: cán bộ chủ trì cũ chuyển công tác"></div>
    <p class="chu-phu mt-3">Phòng chủ trì lấy theo phòng của cán bộ mới; cấp nhận sản phẩm đặt lại theo chủ trì mới. Lịch sử ghi người cũ → người mới và lý do; chủ trì, người theo dõi cũ và mới, người giao việc được báo.</p>
    <div class="modal-chan"><button type="button" class="nut" data-action="dongDoiChuTri">Huỷ</button><button type="submit" id="dctLuu" class="nut chinh">Lưu thay đổi</button></div>
  </form>
</div>`;

function capNhatGhiChu() {
  const a = findAccount($('dctChuTri').value); const r = dongViec($('dctId').value);
  const dv = a && a.id !== r?.owner_tai_khoan ? donViMoi(a) : '';
  setText('dctGhiChu', dv ? `Phòng, đơn vị chủ trì sau khi đổi: ${dv}.` : '');
}

function moDoiChuTri({ id }) {
  const r = dongViec(id);
  if (!r) return;
  $('dctId').value = id;
  setText('dctTieuDe', `Đổi chủ trì theo dõi · ${r.ma}`);
  setText('dctMoTa', r.noi_dung || '');
  setText('dctCu', `Chủ trì theo dõi: ${ownerText(r)}${r.owner_tai_khoan_ten ? ` (${boSoThuTu(r.owner_don_vi_ten)})` : ''} · Người theo dõi: ${r.nguoi_theo_doi_ten || '(chưa có)'}`);
  $('dctChuTri').innerHTML = canBoOptionsHtml(state.accounts, '— Giữ nguyên chủ trì —');
  $('dctTheoDoi').innerHTML = canBoOptionsHtml(state.accounts, '— Giữ nguyên người theo dõi —');
  ['dctChuTriTim', 'dctTheoDoiTim'].forEach((x) => { $(x).value = ''; });
  tim.forEach((t) => t.apLai());
  $('dctLyDo').value = ''; $('dctLuu').disabled = false;
  capNhatGhiChu();
  show('dctModal', true);
  $('dctChuTriTim').focus();
}
const dongDoiChuTri = () => show('dctModal', false);

async function luuDoiChuTri() {
  const id = $('dctId').value; const r = dongViec(id); const lyDo = $('dctLyDo').value.trim();
  const p = {}; const ct = $('dctChuTri').value; const td = $('dctTheoDoi').value;
  if (ct && ct !== r?.owner_tai_khoan) p.chu_tri = ct;
  if (td && td !== r?.nguoi_theo_doi) p.nguoi_theo_doi = td;
  if (!Object.keys(p).length) { notifyError('Chọn chủ trì hoặc người theo dõi mới (khác người đang ghi).'); return; }
  if (!lyDo) { notifyError('Ghi lý do (bắt buộc).'); $('dctLyDo').focus(); return; }
  $('dctLuu').disabled = true;
  try {
    await doiChuTri(id, p, lyDo);
    const ten = [p.chu_tri ? `chủ trì: ${findAccount(p.chu_tri)?.full_name || ''}` : '', p.nguoi_theo_doi ? `người theo dõi: ${findAccount(p.nguoi_theo_doi)?.full_name || ''}` : ''].filter(Boolean).join(', ');
    notifySuccess(`Đã đổi ${ten} cho ${r?.ma || 'nhiệm vụ'}. Người cũ, người mới và người giao việc được báo.`);
    dongDoiChuTri();
    await sauHanhDong(id);
  } catch (e) { notifyError(loiDeHieu(e)); $('dctLuu').disabled = false; }
}

export function mountDoiChuTri(registerActions, napLai) {
  sauHanhDong = napLai;
  $('modalRoot').insertAdjacentHTML('beforeend', template);
  tim = [ganTimChon($('dctChuTriTim'), $('dctChuTri')), ganTimChon($('dctTheoDoiTim'), $('dctTheoDoi'))];
  $('dctChuTri').addEventListener('change', capNhatGhiChu);
  registerActions({ moDoiChuTri, dongDoiChuTri, luuDoiChuTri });
}
