// Màn hình "Theo văn bản" (v8 đợt 4; mọi vai từ v3.22.1 — phạm vi RLS của người xem). v3.25 (bảng theo cột, mẫu TheoVanBan 16/10/2026; chủ dự
// án duyệt 18/10): mỗi văn bản một dòng (dong.js), sáu ô số đếm văn bản (lib/kl/van-ban-bang.js), tìm, loại văn bản, phạm vi, sắp xếp mới nhập /
// ngày nhận; bấm tên văn bản mở bảng con nhiệm vụ (việc giao tiếp xuống lồng theo nhiem_vu_cha, minh chứng dưới trạng thái); văn bản mặc định
// gập (tìm thì mở văn bản khớp; Mở rộng / Thu gọn tất cả). Bấm việc → moNhiemVu() (ngăn chi tiết dùng chung). Dữ liệu: v_nhiem_vu + v_minh_chung
// + van_ban_giao_viec + kl_van_ban_so_viec ("đã nhập x / dự kiến y" — tổng thật của văn bản); sửa rà soát tại chỗ (van_ban_dat_ra_soat là chốt).
import { $, giuONhap, show } from '../../../lib/dom.js';
import { registerActions } from '../../../lib/actions.js';
import { state } from '../../../lib/state.js';
import { notifyError, notifySuccess } from '../../../components/toast.js';
import { loadKlRows, loadVanBan, soViecTheoVanBan, datRaSoatVanBan, chuyenVienXemPhong, xemToanBo } from '../../../lib/kl/du-lieu.js';
import { chiXem } from '../../../lib/kl/pham-vi.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { homNayVN } from '../../../lib/kl/ngay.js';
import { tongHopVanBan, lopVanBan, raSoatVanBan, O_SO_VB, locOVb, demOVb, sapXepVanBan } from '../../../lib/kl/van-ban-bang.js';
import { laQtklConHan } from '../kl/thong-tin-giao.js';
import { soNguyenKhongAm } from '../giao-viec/nguon.js';
import { loadMinhChungTatCa } from '../../../lib/kl/minh-chung.js';
import { batKlRealtime, hienKetNoi } from '../../../features/kl-realtime.js';
import { setActiveNav, showSection, sectionDangHien } from '../../shell/index.js';
import { moNhiemVu } from '../kl/index.js';
import { ownerText } from '../kl/dong.js';
import { oSoHtml, giuTieuDiem, veChuGiai } from '../bang/khung.js';
import { theoVanBanTemplate, nhanPhamViTvb } from './template.js';
import { nhanhHtml, vanBanHtml } from './dong.js';

const DO_SAU_TOI_DA = 10;
const tvb = { loc: 'tat', moHet: false, moVb: new Map(), gap: new Set() };   // ô số; văn bản mở / gập (khoá van_ban_id); nhánh việc đang gập ('nv-<id>')
let rows = []; let mc = []; let vanBan = new Map(); let soViec = new Map();
// v3.23 (0103): cấu hình xem toàn bộ → mặc định toàn Văn phòng (việc ngoài phạm vi ghi "Chỉ xem"), nút "Phạm vi của tôi" quay về như cũ.
let trong = []; let tatCa = []; let toanBo = true;
const coNutToanBo = () => xemToanBo() && tatCa.length > trong.length;
const datRows = () => { rows = coNutToanBo() && toanBo ? tatCa : trong; };
const chua = (s, kw) => (s || '').toLowerCase().includes(kw);
const MAU = { qua: 'do', sap: 'vang', thieu: 'canh', xong: 'luc' };

// Cây theo văn bản: con theo nhiem_vu_cha; việc có cha ngoài phạm vi (không đọc được) coi như cấp 1 của văn bản của nó.
function dungCay() {
  const co = new Set(rows.map((r) => r.id));
  const con = new Map(); const goc = new Map();
  rows.forEach((r) => {
    if (r.nhiem_vu_cha && co.has(r.nhiem_vu_cha)) { if (!con.has(r.nhiem_vu_cha)) con.set(r.nhiem_vu_cha, []); con.get(r.nhiem_vu_cha).push(r); return; }
    if (!goc.has(r.van_ban_id)) goc.set(r.van_ban_id, { vb: r, viec: [] });
    goc.get(r.van_ban_id).viec.push(r);
  });
  return { goc: [...goc.values()], con };
}
// Nhánh (đệ quy): '' khi cả nhánh không khớp từ khoá. kw rỗng = mọi nhánh.
function nhanh(r, con, kw, cap, homNay) {
  const cacCon = cap < DO_SAU_TOI_DA ? (con.get(r.id) || []).map((c) => nhanh(c, con, kw, cap + 1, homNay)).filter(Boolean) : [];
  const khop = !kw || chua(r.ma, kw) || chua(r.noi_dung, kw) || chua(ownerText(r), kw);
  if (!khop && cacCon.length === 0) return '';
  return nhanhHtml(r, cap, { con: cacCon.join(''), mc: mc.filter((m) => m.nhiem_vu_id === r.id), mo: !tvb.gap.has(`nv-${r.id}`), homNay });
}
// Quyền hiện nút Sửa rà soát như van_ban_dat_ra_soat: người tạo văn bản, A1, quan_tri_kl; văn bản chỉ có việc ngoài phạm vi — chỉ xem.
const duocSua = (h, tatCaVb) => Boolean(state.user) && !tatCaVb.every(chiXem) && (h.tao_boi === state.user.id || state.user.role_group === 'A1' || laQtklConHan());
const moVb = (id, timThay) => (tvb.moVb.has(id) ? tvb.moVb.get(id) : tvb.moHet || timThay);

function render() {
  const o = $('tvbCay'); if (!o) return;
  const traTd = giuTieuDiem($('viewTheoVanBan'));   // nút đang focus (ô số, văn bản, nhánh) giữ qua lần vẽ lại
  const kw = $('tvbTim').value.trim().toLowerCase(); const loai = $('tvbLoai').value; const homNay = homNayVN();
  const { goc, con } = dungCay();
  const ds = goc.filter((g) => !loai || g.vb.van_ban_loai === loai).map((g) => {
    const tatCaVb = rows.filter((r) => r.van_ban_id === g.vb.van_ban_id); const h = vanBan.get(g.vb.van_ban_id) || {};
    const x = soViec.get(g.vb.van_ban_id) ?? g.viec.length;
    const vbKhop = Boolean(kw) && (chua(g.vb.so_ket_luan, kw) || chua(h.trich_yeu, kw));   // từ khoá khớp văn bản → hiện mọi nhánh
    const html = g.viec.map((r) => nhanh(r, con, vbKhop ? '' : kw, 1, homNay)).filter(Boolean).join('');
    return { ...g, tatCa: tatCaVb, h, x, t: tongHopVanBan(tatCaVb), rs: raSoatVanBan(x, h.so_nhiem_vu_du_kien, h.da_ra_soat_toan_van), html };
  }).filter((d) => d.html);
  $('tvbSo').innerHTML = oSoHtml(O_SO_VB, demOVb(ds), tvb.loc, 'tvbLocVb', MAU); veChuGiai();   // chú giải theo ngưỡng cấu hình
  const hien = sapXepVanBan(locOVb(ds, tvb.loc), $('tvbSapXep').value);
  const traNhap = giuONhap(o);   // ô sửa rà soát đang mở giữ qua lần vẽ lại (realtime)
  o.innerHTML = hien.length ? hien.map((d, i) => vanBanHtml(d, { stt: i + 1, lop: lopVanBan(d.t), mo: moVb(d.vb.van_ban_id, Boolean(kw)), nhanh: d.html, sua: duocSua(d.h, d.tatCa) })).join('')
    : `<p class="bnv-trong">${ds.length ? 'Không có văn bản nào ở ô đang chọn.' : 'Không có văn bản nào khớp bộ lọc.'}</p>`;
  traNhap(); traTd();
  const pv = nhanPhamViTvb(state.user, chuyenVienXemPhong());   // v3.22.1: Trưởng phòng / chuyên viên — ghi rõ phạm vi
  const tb = coNutToanBo() && toanBo;
  $('tvbTomTat').textContent = `${hien.length}/${goc.length} văn bản · ${rows.length} nhiệm vụ ${tb ? 'toàn Văn phòng (việc ngoài phạm vi của đồng chí chỉ xem)' : `trong phạm vi${pv ? ` (${pv})` : ''}`}`;
  show('tvbToanBo', coNutToanBo());
  document.querySelectorAll('#tvbToanBo button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.tb === '1') === tb)));
  o.dataset.nap = String(Date.now());
}

async function tvbRaSoat({ id }, form) {
  const fd = new FormData(form); const so = String(fd.get('so') ?? '').trim();
  try {
    await datRaSoatVanBan(id, soNguyenKhongAm(so), fd.get('ra_soat') === 'on');
    form.classList.remove('mo');
    notifySuccess('Đã lưu số nhiệm vụ dự kiến và rà soát văn bản.'); await loadTheoVanBan();
  } catch (e) { notifyError('Không lưu được: ' + loiDeHieu(e)); }
}

let luotTvb = 0;
export async function loadTheoVanBan() {
  const o = $('tvbCay'); if (o) delete o.dataset.nap;
  const lan = ++luotTvb;
  try {
    const [r, m, vb, sv] = await Promise.all([loadKlRows(), loadMinhChungTatCa(), loadVanBan(), soViecTheoVanBan()]);
    if (lan !== luotTvb) return;   // đã có lượt nạp mới hơn
    trong = r.rows; tatCa = r.tatCa; datRows(); mc = m; vanBan = new Map(vb.map((h) => [h.id, h])); soViec = sv;
    render();
  } catch (e) { notifyError('Không nạp được bảng văn bản: ' + e.message); }
}
export function openTheoVanBan() {
  showSection('viewTheoVanBan');
  setActiveNav('navTheoVanBan');
  batKlRealtime(() => { if (sectionDangHien('viewTheoVanBan')) loadTheoVanBan(); }, (m) => hienKetNoi('tvbKetNoi', m));
  return loadTheoVanBan();
}
// Gập / mở một văn bản ('vb-<id>') hoặc một nhánh việc ('nv-<id>') tại chỗ (không vẽ lại).
function tvbGap({ khoa }) {
  const laVb = khoa.startsWith('vb-'); const id = khoa.slice(3);
  const el = $(laVb ? `tvbVb-${id}` : `tvbNv-${id}`); if (!el) return;
  const mo = el.dataset.mo !== '1';
  if (laVb) tvb.moVb.set(id, mo); else if (mo) tvb.gap.delete(khoa); else tvb.gap.add(khoa);
  el.dataset.mo = mo ? '1' : '0';
  el.querySelector(`[data-action="tvbGap"][data-khoa="${CSS.escape(khoa)}"]`)?.setAttribute('aria-expanded', String(mo));
}
function tvbGapTatCa({ mo }) {
  tvb.moVb.clear(); tvb.gap.clear(); tvb.moHet = mo === '1';
  if (!tvb.moHet) {   // thu gọn cả văn bản đang mở vì khớp ô tìm
    rows.forEach((r) => tvb.gap.add(`nv-${r.id}`));
    document.querySelectorAll('#tvbCay .tvb-goc').forEach((el) => tvb.moVb.set(el.id.slice(6), false));
  }
  render();
}

export function registerTheoVanBan() {
  $('viewTheoVanBan').innerHTML = theoVanBanTemplate;
  $('tvbTim').addEventListener('input', render);
  ['tvbLoai', 'tvbSapXep'].forEach((id) => $(id).addEventListener('change', render));
  const tvbToanBo = ({ tb }) => { toanBo = tb === '1'; datRows(); render(); };
  const tvbLocVb = ({ loc }) => { tvb.loc = O_SO_VB.some(([k]) => k === loc) ? loc : 'tat'; render(); };
  registerActions({ openTheoVanBan: () => openTheoVanBan(), tvbGap, tvbGapTatCa, tvbRaSoat, tvbToanBo, tvbLocVb, tvbMoViec: ({ id, ma }) => moNhiemVu(id, ma) });
}
