// Mục tiêu then chốt ở ngăn chi tiết nhiệm vụ (0105, v3.24; v3.25 — 0107–0111): ô "Mục tiêu then chốt" (chip tên ngắn — rê chuột xem nguồn và căn cứ:
// người chọn, tích sẵn theo quy tắc, gợi ý, trợ lý AI, Excel, rà soát; "theo văn bản" khi việc chưa gắn riêng); bút mở biểu mẫu dưới hàng nút: ô chọn
// có gợi ý dùng chung (chon-muc-tieu.js — bộ nhận diện goi_y_muc_tieu_viec chạy khi mở), hai nút lưu — cho việc này (gan_muc_tieu: tầng giao hoặc
// lãnh đạo trong phạm vi) / cho cả văn bản (gan_muc_tieu_van_ban: người nhập văn bản, Chánh Văn phòng, lãnh đạo xử lý được mọi việc của văn bản).
// Lưu kèm nguồn (chỉ mục mới thêm — mục đã gắn giữ nguồn cũ) và phản hồi cho bộ tự học. Nút chỉ ẩn / hiện cho đẹp; hàm DB là chốt.
import { escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { danhMucKl, loadDanhMucKl } from '../../../lib/kl/du-lieu.js';
import { timMucTieu, laTheoVanBan, mucTieuCua, sapTheoDanhMuc } from '../../../lib/kl/muc-tieu.js';
import { taoBoChon, apGoiY, ketQua, phanHoi, khoaSoHieu, NHAN_NGUON, TOI_DA } from '../../../lib/kl/goi-y-muc-tieu.js';
import { ganMucTieu, ganMucTieuVanBan, quyenVanBan, goiYMucTieuViec, themMucTieuTuDong, ghiPhanHoiGoiY } from '../../../lib/kl/muc-tieu-db.js';
import { laTangGiao } from '../../../lib/kl/sua-tang.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { chiXem } from '../../../lib/kl/pham-vi.js';
import { timKlRow } from './danh-sach.js';
import { BUT } from './sua-tang.js';
import { dangKyO, boO, khungHtml, veO, layO, datTrangThai, lyDoChu } from './chon-muc-tieu.js';

export const TOI_DA_MUC_TIEU = TOI_DA;
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
const khoaCt = (id) => `ct-${id}`;

const chip = (r, dm, ma) => {
  const m = timMucTieu(dm, ma); const ng = r.muc_tieu_nguon?.[ma];
  const goi = [m?.ten || ma, laTheoVanBan(r) ? NHAN_NGUON.VAN_BAN : NHAN_NGUON[ng?.nguon], ng?.ly_do ? `căn cứ: ${ng.ly_do}` : ''].filter(Boolean).join(' — ');
  return `<span class="chip-mt" data-nguon="${escapeHtml(ng?.nguon || 'CHON')}" title="${escapeHtml(goi)}">${escapeHtml(m?.ten_ngan || ma)}</span>`;
};
// Ô lưới (toàn chiều ngang) của ngăn: chip + bút mở biểu mẫu.
export function oMucTieuHtml(r) {
  if (!coDanhMuc()) return '';
  const dm = danhMucKl().mucTieu; const ds = sapTheoDanhMuc(mucTieuCua(r), dm, danhMucKl().nhomMucTieu); const sua = duocGanMucTieu(r);
  const gt = ds.length ? `<span class="ds-chip-mt">${ds.map((ma) => chip(r, dm, ma)).join('')}</span>${laTheoVanBan(r) ? '<small class="chu-phu">theo văn bản</small>' : ''}`
    : '<span class="chu-phu">chưa gắn</span>';
  const nut = sua ? `<button type="button" class="nut-tang" data-action="moMucTieu" data-o="oMt-${r.id}" data-id="${r.id}" aria-controls="oMt-${r.id}" aria-label="Gắn mục tiêu then chốt" title="Gắn mục tiêu then chốt — có gợi ý của hệ thống; lịch sử được ghi lại">${BUT}</button>` : '';
  return `<div class="ct-mt${sua ? ' co-tang' : ''}" data-truong="muc-tieu"><dt>Mục tiêu then chốt</dt><dd>${gt}</dd>${nut}</div>`;
}

// Chữ (bảng "Xem chi tiết"): tên ngắn các mục tiêu, kèm "(theo văn bản)".
export function tenMucTieuViec(r) {
  const dm = danhMucKl().mucTieu || []; const ds = sapTheoDanhMuc(mucTieuCua(r), dm, danhMucKl().nhomMucTieu);
  return ds.length ? `${ds.map((ma) => timMucTieu(dm, ma)?.ten_ngan || ma).join('; ')}${laTheoVanBan(r) ? ' (theo văn bản)' : ''}` : '(chưa gắn)';
}

// Biểu mẫu dưới hàng nút (form.o — mở bằng bút ở ô, đóng bằng Huỷ). Ô chọn vẽ khi mở (moMucTieu).
export function khoiMucTieuHtml(r) {
  if (!coDanhMuc() || !duocGanMucTieu(r)) return '';
  const vb = vbNgay(r) || vbKiem(r); const an = vbNgay(r) ? '' : ' hidden';
  return `<form class="o o-mt" id="oMt-${r.id}" data-submit="luuMucTieu" data-id="${r.id}" data-vb="${escapeHtml(r.van_ban_id || '')}" aria-label="Gắn mục tiêu then chốt cho ${escapeHtml(r.ma)}">
    <div class="o-mt-cho" data-mtg-cho="${khoaCt(r.id)}"></div>
    <small>Mục có căn cứ chắc (số hiệu văn bản, cụm từ đặc trưng, lĩnh vực) được tích sẵn; bấm gợi ý để thêm, × để bỏ (tối đa ${TOI_DA_MUC_TIEU}). Bỏ hết rồi "Lưu cho việc này" = tính theo mục tiêu của văn bản.${vb ? `<span class="mt-vb${an}"> "Lưu cho cả văn bản": áp cho mọi nhiệm vụ của văn bản chưa gắn riêng.</span>` : ''}</small>
    <button type="submit" class="nut chinh" name="pham_vi" value="viec">Lưu cho việc này</button>
    ${vb ? `<button type="submit" class="nut mt-vb${an}" name="pham_vi" value="vb">Lưu cho cả văn bản</button>` : ''}
    <button type="button" class="nut" data-action="dongO" data-o="oMt-${r.id}">Huỷ</button></form>`;
}

// Nhận diện chưa về sau 10 giây (mạng treo) → thôi chờ, cho lưu (chọn từ danh mục vẫn được).
const HET_GIO_GOI_Y = 10000;
const coHan = (p, ms) => Promise.race([p, new Promise((_, loi) => { setTimeout(() => loi(new Error('Hết thời gian chờ nhận diện')), ms); })]);

// Mở / đóng biểu mẫu; mở: ô chọn theo phần gắn hiện có (gắn riêng, không thì theo văn bản) rồi chạy bộ nhận diện cho việc này. Nút lưu chỉ sáng khi
// nhận diện xong (hoặc lỗi / quá hạn chờ): phản hồi "bỏ" cần danh sách gợi ý — lưu sớm hơn thì lần mở sau tự tích lại mục vừa bỏ (kiểm tay 18/10).
async function moMucTieu({ o, id }) {
  const f = document.getElementById(o); const r = timKlRow(id);
  if (!f || !r) return;
  f.classList.toggle('mo');
  if (!f.classList.contains('mo')) return;
  const k = khoaCt(id); const rieng = r.muc_tieu_rieng || [];
  const tt = taoBoChon({ rieng, nguonRieng: Object.fromEntries(rieng.map((ma) => [ma, r.muc_tieu_nguon?.[ma] || {}])), vb: r.muc_tieu_vb || [] });
  dangKyO(k, tt);
  f.querySelector('[data-mtg-cho]').innerHTML = khungHtml(k, { nhan: `Mục tiêu then chốt của ${r.ma}` });
  veO(k); datTrangThai(k, 'Đang nhận diện gợi ý…');
  f.querySelector('.mtg-gy, [data-action="mtgMoDm"]')?.focus({ preventScroll: true });
  const nut = [...f.querySelectorAll('button[type="submit"]')]; nut.forEach((b) => { b.disabled = true; });
  try {
    const kq = (await coHan(goiYMucTieuViec([id]), HET_GIO_GOI_Y))?.[id];
    if (layO(k)?.tt !== tt) return;
    if (kq) apGoiY(tt, kq, { moTa: lyDoChu });
    datTrangThai(k, ''); veO(k);
  } catch { if (layO(k)?.tt === tt) datTrangThai(k, 'Chưa nhận diện được gợi ý — có thể chọn từ danh mục.'); } finally {
    if (layO(k)?.tt === tt) nut.forEach((b) => { b.disabled = false; });   // lần mở mới hơn (ô đã thay) tự bật nút của nó
  }
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

// Số hiệu mới đang tích → hệ thống thêm vào danh mục (đã có thì trả mã sẵn có) → Map khoá số hiệu → mã.
async function themSoHieuMoi(tt) {
  const maMoi = new Map();
  for (const m of tt.moi.filter((x) => x.chon)) {
    try { const kq = await themMucTieuTuDong(m.so_hieu, m.ve || null); if (kq?.ma) maMoi.set(khoaSoHieu(m.so_hieu), kq.ma); } catch (e) { notifyError(`Chưa thêm được ${m.so_hieu} vào danh mục: ${loiDeHieu(e)}`); }
  }
  if (maMoi.size) await loadDanhMucKl(true).catch(() => null);
  return maMoi;
}
// Nguồn chỉ gửi cho mục mới thêm (mục đã gắn giữ nguồn cũ — Excel, AI…; mục của văn bản: máy chủ chép nguồn của văn bản).
const nguonMoi = (k, cu) => Object.fromEntries(k.ma.filter((ma) => !cu.includes(ma) && k.nguon[ma]).map((ma) => [ma, k.nguon[ma]]));

async function luuVanBan(r, vb, k) {
  if (giongNhau(k.ma, r.muc_tieu_vb)) { if (!(r.muc_tieu_rieng || []).length) return 'Mục tiêu then chốt của văn bản không đổi.'; } else {
    const n = await ganMucTieuVanBan(vb, k.ma, nguonMoi(k, r.muc_tieu_vb || []));
    if (!(r.muc_tieu_rieng || []).length) return k.ma.length ? `Đã gắn mục tiêu then chốt cho văn bản — ${n} nhiệm vụ chưa gắn riêng tính theo mục tiêu này.` : `Đã bỏ mục tiêu then chốt của văn bản (${n} nhiệm vụ).`;
  }
  // Việc đang mở có mục tiêu gắn riêng: bỏ gắn riêng để việc theo văn bản như lựa chọn vừa lưu.
  try { await ganMucTieu(r.id, []); return `Đã lưu mục tiêu then chốt cho văn bản; ${r.ma} tính theo văn bản.`; } catch { return `Đã lưu mục tiêu cho văn bản; ${r.ma} vẫn giữ mục tiêu gắn riêng.`; }
}
async function luuViec(r, k) {
  const rieng = r.muc_tieu_rieng || [];
  if (rieng.length && giongNhau(k.ma, rieng)) return 'Mục tiêu then chốt không đổi.';   // kể cả khi phần gắn riêng trùng mục tiêu của văn bản
  if (k.theoVb) {
    if (!rieng.length) return `${r.ma} đang tính theo mục tiêu của văn bản — không đổi.`;
    await ganMucTieu(r.id, []); return `Đã bỏ gắn riêng — ${r.ma} tính theo mục tiêu của văn bản.`;
  }
  await ganMucTieu(r.id, k.ma, nguonMoi(k, rieng));
  return `Đã gắn ${k.ma.length} mục tiêu then chốt cho ${r.ma}.`;
}
async function luuMucTieu({ id, vb }, form, ev) {
  const r = timKlRow(id); const x = layO(khoaCt(id));
  if (!r || !x) return;
  const nut = [...form.querySelectorAll('button[type="submit"]')]; nut.forEach((b) => { b.disabled = true; });
  try {
    const k = ketQua(x.tt, await themSoHieuMoi(x.tt));
    const tb = ev?.submitter?.value === 'vb' && vb ? await luuVanBan(r, vb, k) : await luuViec(r, k);
    notifySuccess(tb);
    form.classList.remove('mo'); boO(khoaCt(id));
    // Tự học + trí nhớ "đã bỏ" (0115) theo tập đồng chí để lại (kể cả khi lưu thành "theo văn bản"); ghi xong mới nạp lại — Rà soát (nghe 'viec-da-ghi')
    // nhận diện lại dòng này theo dữ liệu mới. Lỗi bỏ qua (ghiPhanHoiGoiY không ném lỗi).
    await ghiPhanHoiGoiY(id, phanHoi(x.tt, k.ma));
    await sauHanhDong(id);
  } catch (e) {
    notifyError('Không gắn được mục tiêu then chốt: ' + loiDeHieu(e));
  }
  nut.forEach((b) => { b.disabled = false; });
}

export function mountMucTieu(registerActions, napLai) {
  sauHanhDong = napLai;
  registerActions({ luuMucTieu, moMucTieu });
}
