// Màn "Cần nghiệm thu" (PR-2b, thiết kế A8) — A1, A2, quan_tri_kl, thư ký Thường trực (việc Thường trực giao cho Chánh VP, Q8): minh chứng đang
// chờ ở việc đang mở mà đồng chí được nghiệm thu (kl_can_nghiem_thu — CÙNG hàm chặn kl_duoc_nghiem_thu với xac_nhan_minh_chung, không suy quyền ở
// client). Hai tab: "Của tôi" (đồng chí là người nhận nhắc chính — bằng số trên menu) và "Trong phạm vi". Mỗi dòng #nt-<id minh chứng>: Mở việc,
// Nghiệm thu (đóng việc cùng giao dịch — Q2), Trả lại (lý do + hạn nộp lại — Q3; khung ngày DB chốt, việc đã qua hạn: tối đa 2 ngày làm việc).
import { $, escapeHtml, formatDateTime, giuONhap } from '../../lib/dom.js';
import { state, findAccount } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifySuccess, notifyError } from '../../components/toast.js';
import { supabase } from '../../lib/supabase.js';
import { COT_VIEC } from '../../lib/kl/cot.js';
import { canNghiemThu } from '../../lib/kl/han-nop.js';
import { xacNhanMinhChung } from '../../lib/kl/minh-chung.js';
import { tenTrongDanhMuc, loadDanhMucKl } from '../../lib/kl/du-lieu.js';
import { formatNgay, homNayVN } from '../../lib/kl/ngay.js';
import { nhanTrangThai, lopMep } from '../../lib/kl/nhan.js';
import { lamMoiHuyHieu } from '../../features/huy-hieu.js';
import { setActiveNav, showSection } from '../shell/index.js';
import { moNhiemVu } from './kl/index.js';
import { khiGhiTrongNgan } from './ngan-chi-tiet.js';
import { nghiemThuDongViec, oNghiemThuHtml, chatLuongCuaForm, dongBoNutNghiemThu } from './chat-luong.js';

let ds = []; let viec = new Map(); let mcs = new Map(); let tab = 'cua-toi';

async function docTheoId(bang, cot, ids) {
  if (!ids.length) return [];
  const r = await supabase.from(bang).select(cot).in('id', ids);
  if (r.error) throw new Error(`Không đọc được ${bang}: ${r.error.message}`);
  return r.data;
}

function dongHtml(x) {
  const r = viec.get(x.nhiem_vu_id); const m = mcs.get(x.minh_chung_id);
  if (!r || !m) return '';
  const nguoi = findAccount(m.nop_boi); const hom = homNayVN(); const toiDa = r.han_xu_ly && r.han_xu_ly >= hom ? r.han_xu_ly : '';
  return `<div id="nt-${m.id}" class="nv-dong ${lopMep(r, state.user?.id)}" data-nv="${r.id}"><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(r.noi_dung)}
      <span class="trang-thai ${r.nhom_dem === 'QUA_HAN_NGHIEM_THU' ? 'tt-qua' : 'tt-cho'}">${escapeHtml(nhanTrangThai(r, state.user?.id))}</span>
      <small>Minh chứng số ${escapeHtml(m.so_hieu || '')}${m.ngay_van_ban ? ` ngày ${formatNgay(m.ngay_van_ban)}` : ''}${m.cap_nhan ? `, cấp nhận ${escapeHtml(tenTrongDanhMuc('cap', m.cap_nhan))}` : ''}
        · ${escapeHtml(nguoi?.full_name || 'không xác định')} nộp ${formatDateTime(m.nop_luc)} · hạn hoàn thành ${r.han_xu_ly ? formatNgay(r.han_xu_ly) : 'chưa có'}</small>
      ${m.trich_yeu ? `<span class="mc-trich-yeu">${escapeHtml(m.trich_yeu)}</span>` : ''}${m.mo_ta_ket_qua ? `<span class="mc-mo-ta">${escapeHtml(m.mo_ta_ket_qua)}</span>` : ''}</p>
    <span class="hanh-dong" style="margin:0"><button type="button" class="nut nho" data-action="ntMoViec" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">Mở việc</button>
      ${nghiemThuDongViec(r, m) ? `<button type="button" class="nut nho lam" data-action="moO" data-o="oNtCl-${m.id}">Nghiệm thu</button>`   // PR-3: chọn chất lượng
    : `<button type="button" class="nut nho lam" data-action="ntNghiemThu" data-id="${m.id}" data-ma="${escapeHtml(r.ma)}">Nghiệm thu</button>`}
      <button type="button" class="nut nho" data-action="moO" data-o="oNt-${m.id}">Trả lại</button></span>
    ${nghiemThuDongViec(r, m) ? oNghiemThuHtml(`oNtCl-${m.id}`, 'ntNghiemThuCl', { id: m.id, ma: r.ma }) : ''}
    <form class="o" id="oNt-${m.id}" data-submit="ntTraLai" data-id="${m.id}"><input name="ly_do" required placeholder="Lý do trả lại (bắt buộc)" aria-label="Lý do trả lại">
      <input type="date" name="han_nop_lai" required min="${hom}"${toiDa ? ` max="${toiDa}"` : ''} aria-label="Hạn nộp lại" title="${toiDa ? `muộn nhất ${formatNgay(toiDa)}` : 'đã qua hạn hoàn thành: tối đa 2 ngày làm việc'}">
      <button type="submit" class="nut chinh">Trả lại minh chứng</button><button type="button" class="nut" data-action="dongO" data-o="oNt-${m.id}">Huỷ</button></form></div>`;
}

function ve() {
  const cuaToi = ds.filter((x) => x.cua_toi); const hien = tab === 'cua-toi' ? cuaToi : ds;
  const nutTab = (ma, nhan, n) => `<button type="button" role="tab" class="nut nho${tab === ma ? ' lam' : ''}" aria-selected="${tab === ma}" data-action="ntTab" data-tab="${ma}">${nhan} (${n})</button>`;
  const traNhap = giuONhap($('viewNghiemThu'));   // PR-3: hộp chất lượng đang mở / đã chọn giữ qua lần vẽ lại (sau hành động, tải lại)
  $('viewNghiemThu').innerHTML = `
    <div class="dau"><h1>Cần nghiệm thu</h1><span>minh chứng đã nộp, chờ đồng chí nghiệm thu · nghiệm thu = hoàn thành việc; trả lại phải có lý do và hạn nộp lại</span>
      <div class="phai-dau"><button type="button" class="nut nho" data-action="openNghiemThu">Tải lại</button></div></div>
    <div role="tablist" class="hanh-dong">${nutTab('cua-toi', 'Của tôi', cuaToi.length)}${nutTab('pham-vi', 'Trong phạm vi', ds.length)}</div>
    <div class="da-gui" id="ntDanhSach" data-tab="${tab}" data-nap="${Date.now()}">${hien.map(dongHtml).join('') || '<p class="trong">Không có minh chứng nào chờ nghiệm thu.</p>'}</div>`;
  traNhap(); dongBoNutNghiemThu($('viewNghiemThu'));
}

async function openNghiemThu() {
  showSection('viewNghiemThu');
  setActiveNav('navNghiemThu');
  await napNghiemThu();
}
async function napNghiemThu() {
  try {
    await loadDanhMucKl();
    ds = await canNghiemThu();
    const [rows, dsMc] = await Promise.all([docTheoId('v_nhiem_vu', COT_VIEC, [...new Set(ds.map((x) => x.nhiem_vu_id))]),
      docTheoId('minh_chung', 'id, nhiem_vu_id, so_hieu, ngay_van_ban, cap_nhan, trich_yeu, mo_ta_ket_qua, nop_boi, nop_luc', ds.map((x) => x.minh_chung_id))]);
    viec = new Map(rows.map((r) => [r.id, r])); mcs = new Map(dsMc.map((m) => [m.id, m]));
    ve();
  } catch (e) { notifyError(e.message); }
}
// Sau nghiệm thu / trả lại: báo, làm mới huy hiệu, nạp lại danh sách — KHÔNG gọi openNghiemThu (showSection) vì người dùng có thể đã chuyển
// mục trong lúc chờ mạng; ép hiện lại màn này sẽ kéo họ về (e2e pr3-hien-thi chập chờn vì đúng cuộc đua đó).
async function sauHanhDong(thongBao) { notifySuccess(thongBao); await lamMoiHuyHieu(); await napNghiemThu(); }
async function ntNghiemThu({ id, ma }) {
  try { await xacNhanMinhChung(id, true); await sauHanhDong(`Đã nghiệm thu minh chứng — nhiệm vụ ${ma} hoàn thành.`); } catch (e) { notifyError(e.message); }
}
async function ntNghiemThuCl({ id, ma }, form) {
  const cl = chatLuongCuaForm(form);
  if (!cl) { notifyError('Chọn chất lượng hoàn thành trước khi nghiệm thu.'); return; }
  try { await xacNhanMinhChung(id, true, null, null, cl); await sauHanhDong(`Đã nghiệm thu minh chứng — nhiệm vụ ${ma} hoàn thành.`); } catch (e) { notifyError(e.message); }
}
async function ntTraLai({ id }, form) {
  const f = new FormData(form); const lyDo = (f.get('ly_do') || '').trim(); const han = f.get('han_nop_lai') || null;
  if (!lyDo || !han) { notifyError('Trả lại minh chứng phải ghi lý do và chọn hạn nộp lại.'); return; }
  try { await xacNhanMinhChung(id, false, lyDo, han); await sauHanhDong('Đã trả lại minh chứng. Người nộp nhận thông báo kèm hạn nộp lại.'); } catch (e) { notifyError(e.message); }
}

export function registerNghiemThu() {
  registerActions({ openNghiemThu, ntNghiemThu, ntNghiemThuCl, ntTraLai, ntTab: ({ tab: t }) => { tab = t; ve(); }, ntMoViec: ({ id, ma }) => moNhiemVu(id, ma) });
  khiGhiTrongNgan('viewNghiemThu', napNghiemThu);   // "Mở việc" → ngăn chi tiết; nghiệm thu / trả lại trong ngăn → danh sách tự cập nhật
}
