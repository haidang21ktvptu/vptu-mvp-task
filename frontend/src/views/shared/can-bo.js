// Cán bộ thuộc quyền (A1) / Cán bộ trong phòng (A2) — mockup: bức tranh tải việc theo phòng rồi theo người, mỗi người một thanh
// Đỏ/Vàng/Đang làm (việc đang mở người đó là Owner tài khoản; việc theo dõi ghi riêng, CH-2); bấm tên mở đúng việc của người đó.
// Phòng nào xuất hiện = phòng có việc trong phạm vi RLS hoặc có cán bộ dưới quyền (A2: phòng mình).
import { $, escapeHtml } from '../../lib/dom.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifyError } from '../../components/toast.js';
import { loadDanhMucKl, loadCauHinhKl, loadKlRows } from '../../lib/kl/du-lieu.js';
import { calculateGroupKPI, laOwnerPhong } from './kpi.js';
import { setActiveNav, showSection } from '../shell/index.js';

const DO = (r) => r.muc_canh_bao === 'DO' || r.muc_canh_bao === 'DO_DAC_BIET';
const VANG = (r) => r.muc_canh_bao === 'VANG';
const mo = (r) => r.tien_do_ma !== 'HOAN_THANH';

function nguoiHtml(a, rows) {
  const owner = rows.filter((r) => r.owner_tai_khoan === a.id && mo(r));
  const theoDoi = rows.filter((r) => r.nguoi_theo_doi === a.id && r.owner_tai_khoan !== a.id && mo(r)).length;
  const dem = { do: owner.filter(DO).length, vang: owner.filter(VANG).length };
  const lam = owner.length - dem.do - dem.vang;
  const pct = (n) => (owner.length ? (n / owner.length) * 100 : 0);
  const soChu = owner.length === 0 ? (theoDoi ? `${theoDoi} đang theo dõi` : 'rảnh, có thể nhận thêm')
    : [dem.do ? `<b>${dem.do}</b> Đỏ` : '', dem.vang ? `${dem.vang} Vàng` : '', lam ? `${lam} đang làm` : ''].filter(Boolean).join(', ');
  return `<button type="button" class="nguoi-hang" data-action="moKlDanhSach" data-loc='${escapeHtml(JSON.stringify({ canBo: a.id, chiMo: true }))}'>
      <div><b>${escapeHtml(a.full_name)}</b><small>${escapeHtml(a.position_title || '')}${theoDoi ? ` · ${theoDoi} việc theo dõi` : ''}</small></div>
      <div class="tai"><span class="t-do" style="width:${pct(dem.do)}%"></span><span class="t-vang" style="width:${pct(dem.vang)}%"></span><span class="t-lam" style="width:${pct(lam)}%"></span></div>
      <span class="tai-so">${soChu}</span></button>`;
}

function phongHtml(ma, rows) {
  const canBo = state.accounts.filter((a) => a.department === ma && !a.is_system).sort((a, b) => (a.role_group > b.role_group ? 1 : -1) || a.full_name.localeCompare(b.full_name, 'vi'));
  const cuaPhong = rows.filter((r) => laOwnerPhong(r, ma) || canBo.some((a) => a.id === r.owner_tai_khoan));
  const k = calculateGroupKPI(canBo.map((a) => a.id), rows, ma);
  const phongOwner = rows.filter((r) => laOwnerPhong(r, ma) && mo(r)).length;
  return `<section id="cb-${escapeHtml(ma)}"><div class="tieu"><b>${escapeHtml(DEPT_NAMES[ma] || ma)}</b><span>${canBo.length} cán bộ, ${k.dangMo} việc mở, ${k.quaHan} Đỏ${phongOwner ? `, ${phongOwner} việc phòng là Owner` : ''}</span></div>
    ${canBo.map((a) => nguoiHtml(a, cuaPhong)).join('') || '<p class="trong-nho">Phòng chưa có cán bộ trong danh bạ.</p>'}</section>`;
}

async function openCanBo() {
  showSection('viewCanBo');
  setActiveNav('navCanBo');
  let rows;
  try { await Promise.all([loadDanhMucKl(), loadCauHinhKl()]); rows = (await loadKlRows()).rows; } catch (e) { notifyError('Không đọc được nhiệm vụ: ' + e.message); return; }
  const me = state.user;
  const phong = me.role_group === 'A2' ? [me.department]
    : [...new Set([...rows.map((r) => r.owner_phong).filter(Boolean), ...state.accounts.filter((a) => a.manager_id === me.id || me.is_chief).map((a) => a.department)])]
      .filter((p) => p && p !== 'LANH_DAO_VAN_PHONG');
  $('viewCanBo').innerHTML = `
    <div class="dau"><h1>${me.role_group === 'A2' ? 'Cán bộ trong phòng' : 'Cán bộ thuộc quyền'}</h1><span>tải việc theo người: Đỏ / Vàng / đang làm — chỉ việc đang mở cán bộ là Owner; việc theo dõi ghi riêng</span>
      <div class="phai-dau"><button type="button" class="nut nho" data-action="openCanBo">Tải lại</button></div></div>
    <div class="cb">${phong.length ? phong.map((p) => phongHtml(p, rows)).join('') : '<p class="trong">Không có phòng nào trong phạm vi của đồng chí.</p>'}</div>`;
}

export function registerCanBo() {
  registerActions({ openCanBo });
}
