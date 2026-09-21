// Màn hình cây "Theo văn bản" (v8 đợt 4; menu nhóm Theo dõi của A0 và A1). Dữ liệu: v_nhiem_vu (đã có văn bản, nhiem_vu_cha, nhom_dem — DB tính)
// + v_minh_chung (0046); phạm vi do RLS (A0 toàn bộ, A1 theo kl_pham_vi). Gốc = văn bản + thanh tiến độ "x/n hoàn thành · y quá hạn · z sắp đến
// hạn"; nhánh cấp 1 = việc giao từ văn bản, cấp 2+ = việc giao tiếp xuống (nhiem_vu_cha), lá = minh chứng + người xác nhận. Thu gọn/mở rộng
// từng nhánh (nhớ theo khoá trong phiên), lọc trạng thái (giữ nhánh có con khớp), bấm nhánh → moNhiemVu() mở #klChiTiet sẵn có ở màn Nhiệm vụ.
import { $, escapeHtml } from '../../../lib/dom.js';
import { registerActions } from '../../../lib/actions.js';
import { notifyError } from '../../../components/toast.js';
import { loadKlRows, loadVanBan } from '../../../lib/kl/du-lieu.js';
import { loadMinhChungTatCa } from '../../../lib/kl/minh-chung.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { lopMep, nhanTrangThai } from '../../../lib/kl/nhan.js';
import { batKlRealtime, hienKetNoi } from '../../../features/kl-realtime.js';
import { setActiveNav, showSection, sectionDangHien } from '../../shell/index.js';
import { moNhiemVu } from '../kl/index.js';
import { ownerText } from '../kl/dong.js';
import { tenLoaiVanBan } from '../kl/them-owner.js';
import { theoVanBanTemplate } from './template.js';

const DO_SAU_TOI_DA = 10;
// Bộ lọc → tập nhom_dem (QUA_HAN gồm đang đính chính; ĐANG THỰC HIỆN gồm cần điền hạn, chờ điều kiện, thường xuyên).
const NHOM_LOC = { QUA_HAN: ['QUA_HAN', 'DANG_DINH_CHINH'], SAP_DEN_HAN: ['SAP_DEN_HAN'], DANG_THUC_HIEN: ['DANG_THUC_HIEN', 'CAN_DIEN_HAN', 'CHO_DIEU_KIEN', 'THUONG_XUYEN'], HOAN_THANH: ['HOAN_THANH'] };
const gap = new Set(); // khoá nhánh đang thu gọn ('vb-<id>' | 'nv-<id>'); mặc định mở
let rows = []; let mc = []; let vanBan = new Map(); // văn bản theo id (loadVanBan: có trích yếu 0046)

const khop = (r) => !$('tvbLoc').value || NHOM_LOC[$('tvbLoc').value].includes(r.nhom_dem);
const chuaTuKhoa = (s, kw) => (s || '').toLowerCase().includes(kw);

// Cây theo văn bản: con theo nhiem_vu_cha; việc có cha ngoài phạm vi (không đọc được) coi như cấp 1 của văn bản của nó.
function dungCay() {
  const co = new Set(rows.map((r) => r.id));
  const con = new Map(); const goc = new Map();
  rows.forEach((r) => {
    if (r.nhiem_vu_cha && co.has(r.nhiem_vu_cha)) { if (!con.has(r.nhiem_vu_cha)) con.set(r.nhiem_vu_cha, []); con.get(r.nhiem_vu_cha).push(r); return; }
    if (!goc.has(r.van_ban_id)) goc.set(r.van_ban_id, { vb: r, viec: [] });
    goc.get(r.van_ban_id).viec.push(r);
  });
  return { goc: [...goc.values()].sort((a, b) => (b.vb.ngay_ban_hanh || '').localeCompare(a.vb.ngay_ban_hanh || '') || (a.vb.so_ket_luan || '').localeCompare(b.vb.so_ket_luan || '')), con };
}
const laHtml = (m) => {
  const xn = m.hop_le === null ? '<span class="tt-cho">chưa xác nhận</span>' : m.hop_le ? `<span class="tt-xong">hợp lệ — ${escapeHtml(m.xac_nhan_boi_ten || '')}</span>` : `<span class="tt-qua">không hợp lệ — ${escapeHtml(m.xac_nhan_boi_ten || '')}</span>`;
  return `<div class="tvb-la" data-id="${m.id}"><i class="tvb-cham mc"></i><span class="mc-loai${m.loai === 'chu_cu' ? ' mc-loai-cu' : ''}">${m.loai === 'chu_cu' ? 'Minh chứng cũ' : 'Minh chứng'}</span>
    <b>${escapeHtml(m.so_hieu || 'không có số')}</b>${m.ngay_van_ban ? ` · ${formatNgay(m.ngay_van_ban)}` : ''}${m.trich_yeu ? ` · ${escapeHtml(m.trich_yeu)}` : ''} · ${xn}</div>`;
};
// Nhánh nhiệm vụ (đệ quy); trả '' khi cả nhánh không khớp bộ lọc / từ khoá.
function nhanhHtml(r, con, kw, cap) {
  const cacCon = cap < DO_SAU_TOI_DA ? (con.get(r.id) || []).map((c) => nhanhHtml(c, con, kw, cap + 1)).filter(Boolean) : [];
  const toiKhop = khop(r) && (!kw || chuaTuKhoa(r.ma, kw) || chuaTuKhoa(r.noi_dung, kw) || chuaTuKhoa(ownerText(r), kw));
  if (!toiKhop && cacCon.length === 0) return '';
  const la = mc.filter((m) => m.nhiem_vu_id === r.id).map(laHtml).join('');
  const khoa = `nv-${r.id}`; const coCon = cacCon.length > 0 || la; const mo = !gap.has(khoa);
  return `<div class="tvb-nhanh" id="tvbNv-${r.id}" data-id="${r.id}" data-cap="${cap}" data-nhom="${escapeHtml(r.nhom_dem || '')}" data-mo="${mo ? '1' : '0'}">
    <div class="tvb-hang">
      ${coCon ? `<button type="button" class="tvb-gap" data-action="tvbGap" data-khoa="${khoa}" aria-expanded="${mo}" aria-label="${mo ? 'Thu gọn' : 'Mở rộng'} ${escapeHtml(r.ma)}"></button>` : '<i class="tvb-gap trong"></i>'}
      <button type="button" class="tvb-nut" data-action="tvbMoViec" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}" title="${escapeHtml(nhanTrangThai(r))}">
        <i class="tvb-cham ${lopMep(r) || 'xam'}"></i><span class="ma">${escapeHtml(r.ma)}</span><span class="nd">${escapeHtml(r.noi_dung)}</span>
        <span class="chu-tri">${escapeHtml(ownerText(r))}</span><span class="han">${r.han_xu_ly ? formatNgay(r.han_xu_ly) : 'chưa có hạn'}</span></button>
    </div>
    <div class="tvb-con">${cacCon.join('')}${la}</div></div>`;
}
function gocHtml({ vb, viec }, con, kw, tatCa) {
  const trichYeu = vanBan.get(vb.van_ban_id)?.trich_yeu || '';
  const vbKhop = Boolean(kw) && (chuaTuKhoa(vb.so_ket_luan, kw) || chuaTuKhoa(trichYeu, kw));
  const nhanh = viec.map((r) => nhanhHtml(r, con, vbKhop ? '' : kw, 1)).filter(Boolean); // từ khoá khớp văn bản → hiện mọi nhánh (vẫn lọc trạng thái)
  if (nhanh.length === 0) return '';
  const n = tatCa.length; const x = tatCa.filter((r) => r.nhom_dem === 'HOAN_THANH').length;
  const y = tatCa.filter((r) => ['QUA_HAN', 'DANG_DINH_CHINH'].includes(r.nhom_dem)).length; const z = tatCa.filter((r) => r.nhom_dem === 'SAP_DEN_HAN').length;
  const pc = (k) => (n ? Math.round((k / n) * 100) : 0);
  const khoa = `vb-${vb.van_ban_id}`; const mo = !gap.has(khoa);
  return `<section class="tam tvb-goc" id="tvbVb-${vb.van_ban_id}" data-mo="${mo ? '1' : '0'}" data-so="${n}" data-xong="${x}" data-qua="${y}" data-sap="${z}">
    <div class="tvb-goc-dau">
      <button type="button" class="tvb-gap" data-action="tvbGap" data-khoa="${khoa}" aria-expanded="${mo}" aria-label="${mo ? 'Thu gọn' : 'Mở rộng'} văn bản ${escapeHtml(vb.so_ket_luan || '')}"></button>
      <div class="tvb-vb"><b>${escapeHtml(tenLoaiVanBan(vb.van_ban_loai))} · ${escapeHtml(vb.so_ket_luan || '(không số)')}</b><span class="chu-phu"> · ban hành ${formatNgay(vb.ngay_ban_hanh)}</span>
        ${trichYeu ? `<p class="tvb-trich-yeu">${escapeHtml(trichYeu)}</p>` : ''}</div>
      <div class="tvb-tien"><div class="tvb-thanh" role="img" aria-label="${x} trên ${n} hoàn thành"><i class="luc" style="width:${pc(x)}%"></i><i class="do" style="width:${pc(y)}%"></i><i class="vang" style="width:${pc(z)}%"></i></div>
        <span class="tvb-tien-chu">${x}/${n} hoàn thành · ${y} quá hạn · ${z} sắp đến hạn</span></div>
    </div>
    <div class="tvb-con">${nhanh.join('')}</div></section>`;
}

function render() {
  const o = $('tvbCay'); if (!o) return;
  const kw = $('tvbTim').value.trim().toLowerCase();
  const { goc, con } = dungCay();
  const tatCaCua = (vbId) => rows.filter((r) => r.van_ban_id === vbId);
  const html = goc.map((g) => gocHtml(g, con, kw, tatCaCua(g.vb.van_ban_id))).filter(Boolean);
  o.innerHTML = html.length ? html.join('') : '<p class="trong">Không có văn bản nào khớp bộ lọc.</p>';
  $('tvbTomTat').textContent = `${html.length}/${goc.length} văn bản · ${rows.length} nhiệm vụ trong phạm vi`;
  o.dataset.nap = String(Date.now());
}

export async function loadTheoVanBan() {
  const o = $('tvbCay'); if (o) delete o.dataset.nap;
  try {
    const [r, m, vb] = await Promise.all([loadKlRows(), loadMinhChungTatCa(), loadVanBan()]);
    rows = r.rows; mc = m; vanBan = new Map(vb.map((h) => [h.id, h]));
    render();
  } catch (e) { notifyError('Không nạp được cây văn bản: ' + e.message); }
}
export function openTheoVanBan() {
  showSection('viewTheoVanBan');
  setActiveNav('navTheoVanBan');
  batKlRealtime(() => { if (sectionDangHien('viewTheoVanBan')) loadTheoVanBan(); }, (m) => hienKetNoi('tvbKetNoi', m));
  return loadTheoVanBan();
}
function tvbGap({ khoa }) {
  if (gap.has(khoa)) gap.delete(khoa); else gap.add(khoa);
  const el = $(khoa.startsWith('vb-') ? `tvbVb-${khoa.slice(3)}` : `tvbNv-${khoa.slice(3)}`);
  if (el) { const mo = !gap.has(khoa); el.dataset.mo = mo ? '1' : '0'; el.querySelector('.tvb-gap[data-khoa]')?.setAttribute('aria-expanded', String(mo)); }
}
function tvbGapTatCa({ mo }) {
  gap.clear();
  if (mo === '0') { rows.forEach((r) => { gap.add(`nv-${r.id}`); gap.add(`vb-${r.van_ban_id}`); }); }
  render();
}

export function registerTheoVanBan() {
  $('viewTheoVanBan').innerHTML = theoVanBanTemplate;
  $('tvbTim').addEventListener('input', render);
  $('tvbLoc').addEventListener('change', render);
  registerActions({ openTheoVanBan: () => openTheoVanBan(), tvbGap, tvbGapTatCa, tvbMoViec: ({ id, ma }) => moNhiemVu(id, ma) });
}
