// Mục tiêu then chốt (0105, v3.24) ở ngăn chi tiết nhiệm vụ: ô "Mục tiêu then chốt" (chip từng mục tiêu; "theo văn bản" khi việc chưa gắn riêng),
// biểu mẫu chọn theo bốn nhóm (đột phá, chương trình, nghị quyết Trung ương, chỉ tiêu) với hai nút lưu — cho việc này (gan_muc_tieu: tầng giao hoặc
// lãnh đạo trong phạm vi) / cho cả văn bản (gan_muc_tieu_van_ban: người nhập văn bản, Chánh Văn phòng, lãnh đạo xử lý được mọi việc của văn bản). Nút
// chỉ ẩn / hiện cho đẹp; hàm DB là chốt. oChonMucTieuHtml / docChonMucTieu dùng chung với Giao việc.
import { escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { danhMucKl } from '../../../lib/kl/du-lieu.js';
import { NHOM_MUC_TIEU, mucTieuTheoNhom, timMucTieu, laTheoVanBan, mucTieuCua, sapTheoDanhMuc } from '../../../lib/kl/muc-tieu.js';
import { ganMucTieu, ganMucTieuVanBan, quyenVanBan } from '../../../lib/kl/muc-tieu-db.js';
import { laTangGiao } from '../../../lib/kl/sua-tang.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { chiXem } from '../../../lib/kl/pham-vi.js';
import { timKlRow } from './danh-sach.js';
import { BUT } from './sua-tang.js';

export const TOI_DA_MUC_TIEU = 10;
let sauHanhDong = async () => {};
const vai = () => state.user?.role_group;
const conDung = (r) => Boolean(r) && !chiXem(r) && !state.user?.bi_khoa;   // 0103: việc chỉ xem → không sửa
export const duocGanMucTieu = (r) => conDung(r) && (laTangGiao(r) || ['A1', 'A2'].includes(vai()));
// "Lưu cho cả văn bản": Chánh VP (cả tài khoản toàn quyền — hồ sơ hiệu dụng is_chief) hiện ngay; người khác (trừ Thường trực) hiện sau khi kiểm
// (napMucTieu): người nhập văn bản, hoặc Phó Chánh VP / Trưởng phòng xử lý được mọi việc gốc của văn bản — như gan_muc_tieu_van_ban.
const vbNgay = (r) => conDung(r) && Boolean(r.van_ban_id) && Boolean(state.user?.is_chief);
const vbKiem = (r) => conDung(r) && Boolean(r.van_ban_id) && !state.user?.is_chief && vai() !== 'A0';
const coDanhMuc = () => (danhMucKl().mucTieu || []).length > 0;   // project chưa áp 0105 → không vẽ gì
const giongNhau = (a = [], b = []) => [...a].sort().join('|') === [...b].sort().join('|');

const chip = (dm, ma) => { const m = timMucTieu(dm, ma); return `<span class="chip-mt" title="${escapeHtml(m?.ten || ma)}">${escapeHtml(m?.ten_ngan || ma)}</span>`; };
// Ô lưới (toàn chiều ngang) của ngăn: chip + bút mở biểu mẫu.
export function oMucTieuHtml(r) {
  if (!coDanhMuc()) return '';
  const dm = danhMucKl().mucTieu; const ds = sapTheoDanhMuc(mucTieuCua(r), dm); const sua = duocGanMucTieu(r);
  const gt = ds.length ? `<span class="ds-chip-mt">${ds.map((ma) => chip(dm, ma)).join('')}</span>${laTheoVanBan(r) ? '<small class="chu-phu">theo văn bản</small>' : ''}`
    : '<span class="chu-phu">chưa gắn</span>';
  const nut = sua ? `<button type="button" class="nut-tang" data-action="moO" data-o="oMt-${r.id}" aria-controls="oMt-${r.id}" aria-label="Gắn mục tiêu then chốt" title="Gắn mục tiêu then chốt — lịch sử được ghi lại">${BUT}</button>` : '';
  return `<div class="ct-mt${sua ? ' co-tang' : ''}" data-truong="muc-tieu"><dt>Mục tiêu then chốt</dt><dd>${gt}</dd>${nut}</div>`;
}

// Chữ (bảng "Xem chi tiết"): tên ngắn các mục tiêu, kèm "(theo văn bản)".
export function tenMucTieuViec(r) {
  const dm = danhMucKl().mucTieu || []; const ds = sapTheoDanhMuc(mucTieuCua(r), dm);
  return ds.length ? `${ds.map((ma) => timMucTieu(dm, ma)?.ten_ngan || ma).join('; ')}${laTheoVanBan(r) ? ' (theo văn bản)' : ''}` : '(chưa gắn)';
}

// Bốn nhóm ô chọn; mã ngừng dùng mà đang chọn vẫn hiện (để bỏ được). ten = name của ô.
export function oChonMucTieuHtml(chon = [], ten = 'muc_tieu') {
  const co = new Set(chon); const dm = danhMucKl().mucTieu || [];
  return NHOM_MUC_TIEU.map((n) => {
    const ds = mucTieuTheoNhom(dm, n.ma).filter((m) => m.dang_dung || co.has(m.ma));
    return ds.length ? `<fieldset class="mt-nhom"><legend>${escapeHtml(n.tab)}</legend>${ds.map((m) => `<label class="mt-o" title="${escapeHtml(m.ten)}">
      <input type="checkbox" name="${ten}" value="${escapeHtml(m.ma)}"${co.has(m.ma) ? ' checked' : ''}><span>${escapeHtml(m.ten_ngan)}</span></label>`).join('')}</fieldset>` : '';
  }).join('');
}
export const docChonMucTieu = (goc, ten = 'muc_tieu') => [...(goc?.querySelectorAll(`input[name="${ten}"]:checked`) || [])].map((i) => i.value);

// Biểu mẫu dưới hàng nút (form.o — mở bằng bút ở ô, đóng bằng Huỷ).
export function khoiMucTieuHtml(r) {
  if (!coDanhMuc() || !duocGanMucTieu(r)) return '';
  const vb = vbNgay(r) || vbKiem(r); const an = vbNgay(r) ? '' : ' hidden';
  return `<form class="o o-mt" id="oMt-${r.id}" data-submit="luuMucTieu" data-id="${r.id}" data-vb="${escapeHtml(r.van_ban_id || '')}" aria-label="Gắn mục tiêu then chốt cho ${escapeHtml(r.ma)}">
    <div class="mt-chon">${oChonMucTieuHtml(mucTieuCua(r))}</div>
    <small>Chọn nội dung đột phá, chương trình, nghị quyết hoặc chỉ tiêu mà việc này phục vụ (tối đa ${TOI_DA_MUC_TIEU}). Bỏ chọn hết rồi "Lưu cho việc này" = tính theo mục tiêu của văn bản.${vb ? `<span class="mt-vb${an}"> "Lưu cho cả văn bản": áp cho mọi nhiệm vụ của văn bản chưa gắn riêng.</span>` : ''}</small>
    <button type="submit" class="nut chinh" name="pham_vi" value="viec">Lưu cho việc này</button>
    ${vb ? `<button type="submit" class="nut mt-vb${an}" name="pham_vi" value="vb">Lưu cho cả văn bản</button>` : ''}
    <button type="button" class="nut" data-action="dongO" data-o="oMt-${r.id}">Huỷ</button></form>`;
}

// Sau khi vẽ ngăn: kiểm quyền gắn cho cả văn bản (người nhập văn bản / lãnh đạo xử lý được mọi việc gốc) rồi mới hiện nút; lỗi đọc → giữ ẩn.
export async function napMucTieu(r) {
  const f = document.getElementById(`oMt-${r?.id}`);
  if (!f || !vbKiem(r) || !f.querySelector('.mt-vb.hidden')) return;
  try {
    const q = await quyenVanBan(r.van_ban_id);
    const duoc = q.taoBoi === state.user?.id || (['A1', 'A2'].includes(vai()) && q.moiViecTrongPhamVi);
    if (duoc) f.querySelectorAll('.mt-vb').forEach((x) => x.classList.remove('hidden'));
  } catch { /* giữ ẩn */ }
}

async function luuVanBan(r, vb, ma) {
  if (giongNhau(ma, r.muc_tieu_vb)) { if (!(r.muc_tieu_rieng || []).length) return 'Mục tiêu then chốt của văn bản không đổi.'; } else {
    const n = await ganMucTieuVanBan(vb, ma);
    if (!(r.muc_tieu_rieng || []).length) return ma.length ? `Đã gắn mục tiêu then chốt cho văn bản — ${n} nhiệm vụ chưa gắn riêng tính theo mục tiêu này.` : `Đã bỏ mục tiêu then chốt của văn bản (${n} nhiệm vụ).`;
  }
  // Việc đang mở có mục tiêu gắn riêng: bỏ gắn riêng để việc theo văn bản như lựa chọn vừa lưu.
  try { await ganMucTieu(r.id, []); return `Đã lưu mục tiêu then chốt cho văn bản; ${r.ma} tính theo văn bản.`; } catch { return `Đã lưu mục tiêu cho văn bản; ${r.ma} vẫn giữ mục tiêu gắn riêng.`; }
}
async function luuMucTieu({ id, vb }, form, ev) {
  const r = timKlRow(id); const ma = docChonMucTieu(form);
  if (!r) return;
  if (ma.length > TOI_DA_MUC_TIEU) { notifyError(`Gắn tối đa ${TOI_DA_MUC_TIEU} mục tiêu then chốt.`); return; }
  const nut = [...form.querySelectorAll('button')]; nut.forEach((b) => { b.disabled = true; });
  try {
    let tb;
    if (ev?.submitter?.value === 'vb' && vb) tb = await luuVanBan(r, vb, ma);
    else if (!(r.muc_tieu_rieng || []).length && giongNhau(ma, r.muc_tieu_vb)) tb = `${r.ma} đang tính theo mục tiêu của văn bản — không đổi.`;
    else if (giongNhau(ma, r.muc_tieu_rieng)) tb = 'Mục tiêu then chốt không đổi.';
    else { await ganMucTieu(id, ma); tb = ma.length ? `Đã gắn ${ma.length} mục tiêu then chốt cho ${r.ma}.` : `Đã bỏ gắn riêng — ${r.ma} tính theo mục tiêu của văn bản.`; }
    notifySuccess(tb);
    form.classList.remove('mo');
    await sauHanhDong(id);
  } catch (e) {
    notifyError('Không gắn được mục tiêu then chốt: ' + loiDeHieu(e));
    nut.forEach((b) => { b.disabled = false; });
  }
}

export function mountMucTieu(registerActions, napLai) {
  sauHanhDong = napLai;
  registerActions({ luuMucTieu });
}
