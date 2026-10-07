// Khối "Minh chứng" trong ngăn chi tiết (GĐ16, MC-2…MC-6) + hộp Nộp minh chứng + hộp Đóng nhiệm vụ. Nút chỉ ẩn/hiện cho đẹp —
// quyền thật trong hàm 0028/0046 (nop_minh_chung: Owner/người theo dõi, 5 ô bắt buộc; xac_nhan_minh_chung: người theo dõi hoặc lãnh đạo trong
// phạm vi, không tự xác nhận; dong_nhiem_vu: cần ≥ 1 minh chứng hợp lệ). Sau mỗi hành động: loadKl() vẽ lại và mở lại ngăn.
import { $, show, setText, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { state, findAccount } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { danhMucKl, homNayTheoDb, tenTrongDanhMuc } from '../../../lib/kl/du-lieu.js';
import { homNayVN, formatNgay } from '../../../lib/kl/ngay.js';
import { loadMinhChung, nopMinhChung, loiMinhChung, xacNhanMinhChung, dongNhiemVu, mcHopLe, TEN_LOAI_MC, laViecTtGiaoCvp, nghiemThuViecTt } from '../../../lib/kl/minh-chung.js';
import { klMinhChungTemplate } from './minh-chung-template.js';
import { timKlRow } from './danh-sach.js';
import { duocChiDao } from './chi-dao.js';
import { laBenTrong } from './dong.js';
import { nghiemThuDongViec, oNghiemThuHtml, chatLuongCuaForm } from '../chat-luong.js';
import { laQtklConHan } from './thong-tin-giao.js';

// Tên lớp nguyên văn (Tailwind cắt lớp ghép chuỗi khỏi bản build).
const LOP_LOAI = { so_hieu: 'mc-loai', chu_cu: 'mc-loai mc-loai-cu', tep: 'mc-loai' };
const LOP_TRANG_THAI = { null: 'trang-thai tt-cho', true: 'trang-thai tt-xong', false: 'trang-thai tt-qua' };
const TEN_TRANG_THAI = { null: 'Chờ nghiệm thu', true: 'Đã nghiệm thu', false: 'Bị trả lại' };

const tenNguoi = (id) => findAccount(id)?.full_name || 'không xác định';
// Ai được bấm nghiệm thu (hàm kl_duoc_nghiem_thu chốt): việc Thường trực giao cho Chánh VP — thư ký Thường trực (không có: quan_tri_kl), không phải
// chính Chánh VP (Q8, 0061); việc khác — người theo dõi, A1/A2 trong phạm vi, quan_tri_kl. Trừ A0 và minh chứng do chính mình nộp (MC-6).
const duocXacNhan = (r, m) => state.user?.role_group !== 'A0' && m.nop_boi !== state.user?.id
  && (laViecTtGiaoCvp(r) ? nghiemThuViecTt(r, m.nop_boi) : r.nguoi_theo_doi === state.user?.id || duocChiDao() || Boolean(state.user?.quan_tri_kl));
const dangMo = (r) => r.tien_do_ma !== 'HOAN_THANH' && !r.dong_luc;

function mcHtml(m, r) {
  const k = String(m.hop_le);
  const dau = m.loai === 'chu_cu' ? (m.so_hieu || 'không tách được số hiệu') : m.so_hieu;
  const chiTiet = [m.ngay_van_ban ? `ngày ${formatNgay(m.ngay_van_ban)}` : '', m.cap_nhan ? tenTrongDanhMuc('cap', m.cap_nhan) : ''].filter(Boolean).join(' · ');
  const bonYeuTo = m.trich_yeu || m.mo_ta_ket_qua ? `<p class="mc-trich-yeu">${escapeHtml(m.trich_yeu || '')}</p><p class="mc-mo-ta">${escapeHtml(m.mo_ta_ket_qua || '')}</p>` : '';
  const xacNhan = m.hop_le === null ? '' : `<p class="chu-phu mc-phu">${m.hop_le ? 'Đã nghiệm thu' : `Bị trả lại: ${escapeHtml(m.ly_do_khong_hop_le || '')}`} — ${escapeHtml(tenNguoi(m.xac_nhan_boi))}, ${formatDateTime(m.xac_nhan_luc)}</p>`;
  // PR-3: nghiệm thu đóng việc ⇒ mở hộp chọn chất lượng (bắt buộc); không đóng việc (việc đã đóng / minh chứng không có ngày) ⇒ một bấm như cũ.
  const dong = nghiemThuDongViec(r, m); const tat = m.hop_le === true || (m.hop_le === false && dangMo(r)) ? ' disabled' : '';
  const nut = duocXacNhan(r, m) ? `
        ${dong ? `<button type="button" class="nut nho" data-action="moO" data-o="mcNt-${m.id}"${tat}>Nghiệm thu, hoàn thành</button>`
    : `<button type="button" class="nut nho" data-action="xacNhanMinhChung" data-id="${m.id}" data-nv="${r.id}"${tat}>${dangMo(r) ? 'Nghiệm thu, hoàn thành' : 'Xác nhận hợp lệ'}</button>`}
        <button type="button" class="nut nho" data-action="moBacMinhChung" data-id="${m.id}" data-nv="${r.id}"${m.hop_le === false ? ' disabled' : ''}>Trả lại</button>` : '';
  return `
    <div class="mc-dong" id="mc-${m.id}" data-loai="${m.loai}" data-hop-le="${k}">
      <div class="mc-dau">
        <span class="${LOP_LOAI[m.loai] || 'mc-loai'}">${TEN_LOAI_MC[m.loai] || m.loai}</span>
        <b>${escapeHtml(dau)}</b>${chiTiet ? ` <span>${escapeHtml(chiTiet)}</span>` : ''}
        <span class="chu-phu">nộp bởi ${escapeHtml(tenNguoi(m.nop_boi))}, ${formatDateTime(m.nop_luc)}</span>
        <span class="${LOP_TRANG_THAI[k]}">${TEN_TRANG_THAI[k]}</span>
        <span class="mc-nut">${nut}</span>
      </div>
      ${m.loai === 'chu_cu' ? `<p class="mc-chu">${escapeHtml(m.noi_dung_chu || '')}</p>` : ''}
      ${bonYeuTo}
      ${xacNhan}
      ${duocXacNhan(r, m) && dong && m.hop_le === null ? oNghiemThuHtml(`mcNt-${m.id}`, 'nghiemThuMinhChung', { id: m.id, nv: r.id }) : ''}
      <form class="mc-form-ly-do hidden" id="mcBac-${m.id}" data-submit="bacMinhChung" data-id="${m.id}" data-nv="${r.id}">
        <input type="text" name="ly_do" required class="o-nhap nho" placeholder="Lý do trả lại (bắt buộc)" aria-label="Lý do trả lại">
        <button type="submit" class="nut lam nho">Trả lại minh chứng</button>
      </form>
    </div>`;
}

export function minhChungHtml(r, ds) {
  const hopLe = ds.filter(mcHopLe).length;
  const nutNop = laBenTrong(r) ? `<button type="button" class="nut lam nho" data-action="openMinhChung" data-id="${r.id}">Nộp minh chứng</button>` : '';
  return `
    <div class="khoi-mc" id="klMinhChung-${r.id}" data-hop-le="${hopLe}">
      <h4>Minh chứng <span class="chu-phu">${ds.length === 0 ? 'chưa có' : `${hopLe} hợp lệ / ${ds.length} đã nộp`}</span><span class="mc-nut">${nutNop}</span></h4>
      ${r.theo_1400 && ds.length ? '<p class="chu-phu">Việc hoàn thành khi lãnh đạo nghiệm thu minh chứng (ngày hoàn thành = ngày văn bản minh chứng); nộp trước hạn hoàn thành.</p>' : ''}
      ${ds.length === 0 ? `<p class="chu-phu">Chưa có minh chứng. ${r.theo_1400 ? 'Nhiệm vụ chỉ đóng được khi có ít nhất một minh chứng hợp lệ (số hiệu, ngày văn bản, cấp nhận).' : ''}</p>` : ds.map((m) => mcHtml(m, r)).join('')}
    </div>`;
}

// Nạp và vẽ khối vào ngăn chi tiết đang mở.
export async function napMinhChung(r) {
  const o = $(`klMinhChung-${r.id}`);
  if (!o) return;
  try {
    o.outerHTML = minhChungHtml(r, await loadMinhChung(r.id));
  } catch (e) {
    notifyError('Không đọc được minh chứng: ' + e.message);
  }
}

let sauHanhDong = () => {};
let homNay = homNayVN();

// ---- Hộp Nộp minh chứng ----
export async function openMinhChung({ id }) {
  const r = timKlRow(id);
  if (!r) return;
  homNay = (await homNayTheoDb()) || homNayVN();
  $('klMcId').value = r.id;
  setText('klMcMoTa', `${r.ma} — ${r.noi_dung}`);
  $('klMcSoHieu').value = ''; $('klMcTrichYeu').value = ''; $('klMcMoTaKq').value = ''; demKyTu();
  $('klMcNgay').value = ''; $('klMcNgay').min = r.ngay_ban_hanh; $('klMcNgay').max = homNay;
  $('klMcCap').innerHTML = '<option value="">— Chọn cấp nhận —</option>' + danhMucKl().cap.map((c) => `<option value="${c.ma}"${c.ma === r.cap_nhan_san_pham ? ' selected' : ''}>${escapeHtml(c.ten)}</option>`).join('');
  $('klMcLuu').disabled = false;
  show('klMcModal', true);
  $('klMcSoHieu').focus();
}
export const closeMinhChung = () => show('klMcModal', false);

const demKyTu = () => setText('klMcDem', String($('klMcMoTaKq').value.normalize('NFC').length));   // đếm như DB (NFC)
async function luuMinhChung() {
  const p = { nhiem_vu_id: $('klMcId').value, so_hieu: $('klMcSoHieu').value.trim(), ngay_van_ban: $('klMcNgay').value, cap_nhan: $('klMcCap').value,
    trich_yeu: $('klMcTrichYeu').value.trim(), mo_ta_ket_qua: $('klMcMoTaKq').value.trim() };
  const loiForm = loiMinhChung(p);
  if (loiForm) { notifyError(loiForm); return; }
  if (p.ngay_van_ban > homNay) { notifyError('Ngày văn bản không được sau hôm nay.'); return; }
  $('klMcLuu').disabled = true;
  try {
    await nopMinhChung(p);
    notifySuccess(`Đã nộp minh chứng số ${p.so_hieu}. Người liên quan nhận thông báo trên hệ thống.`);
    closeMinhChung();
    sauHanhDong();
  } catch (e) {
    notifyError(e.message);
    $('klMcLuu').disabled = false;
  }
}

// ---- Xác nhận / không hợp lệ ----
async function xacNhanMinhChungAction(ds) {
  try {
    await xacNhanMinhChung(ds.id, true);
    notifySuccess(dangMo(timKlRow(ds.nv) || {}) ? 'Đã nghiệm thu minh chứng — nhiệm vụ hoàn thành.' : 'Đã xác nhận minh chứng hợp lệ.');
    sauHanhDong();
  } catch (e) {
    notifyError(e.message);
  }
}
async function nghiemThuMinhChung(ds, form) {
  const cl = chatLuongCuaForm(form);
  if (!cl) { notifyError('Chọn chất lượng hoàn thành trước khi nghiệm thu.'); return; }
  try { await xacNhanMinhChung(ds.id, true, null, null, cl); notifySuccess('Đã nghiệm thu minh chứng — nhiệm vụ hoàn thành.'); sauHanhDong(); } catch (e) { notifyError(e.message); }
}
// Hộp trả lại (0077: chỉ lý do — không còn hạn nộp lại; người nộp nộp lại trước hạn hoàn thành).
function moBacMinhChung(ds) {
  const f = $(`mcBac-${ds.id}`); if (!f) return;
  show(f, true); f.querySelector('input').focus();
}
async function bacMinhChung(ds, form) {
  const lyDo = (new FormData(form).get('ly_do') || '').trim();
  if (!lyDo) { notifyError('Trả lại minh chứng phải ghi lý do.'); return; }
  try {
    await xacNhanMinhChung(ds.id, false, lyDo);
    notifySuccess('Đã trả lại minh chứng. Người nộp nhận thông báo để nộp lại trước hạn hoàn thành.');
    sauHanhDong();
  } catch (e) {
    notifyError(e.message);
  }
}

// ---- Hộp Đóng nhiệm vụ ----
export async function openDongNhiemVu({ id }) {
  const r = timKlRow(id);
  if (!r) return;
  homNay = (await homNayTheoDb()) || homNayVN();
  let goiY = '';
  try { goiY = (await loadMinhChung(r.id)).find((m) => mcHopLe(m) && m.ngay_van_ban)?.ngay_van_ban || ''; } catch { /* để trống, DB tự lấy */ }
  $('klDongId').value = r.id;
  setText('klDongMoTa', `${r.ma} — ${r.noi_dung}`);
  $('klDongNgay').value = goiY; $('klDongNgay').min = r.ngay_ban_hanh; $('klDongNgay').max = homNay;
  setText('klDongGhiChu', r.ngay_nhan_uoc_tinh ? 'Ngày nhận văn bản là ước tính nên lead time không được tính.' : `Lead time = ngày hoàn thành − ngày nhận văn bản (${formatNgay(r.ngay_nhan_van_ban)}).`);
  // PR-3 (0063): lãnh đạo trong phạm vi / quan_tri_kl (không phải Owner của việc) đánh giá chất lượng khi đóng — tuỳ chọn; Owner tự đóng thì không.
  $('klDongChatLuong').value = '';
  show('klDongClWrap', r.owner_tai_khoan !== state.user?.id && (duocChiDao() || laQtklConHan()));
  $('klDongLuu').disabled = false;
  show('klDongModal', true);
  $('klDongNgay').focus();
}
export const closeDongNhiemVu = () => show('klDongModal', false);

async function luuDongNhiemVu() {
  const id = $('klDongId').value; const ngay = $('klDongNgay').value;
  if (ngay && ngay > homNay) { notifyError('Ngày hoàn thành phải từ ngày ban hành tới hôm nay.'); return; }
  $('klDongLuu').disabled = true;
  try {
    await dongNhiemVu(id, ngay || null, $('klDongClWrap').classList.contains('hidden') ? null : $('klDongChatLuong').value || null);
    notifySuccess('Đã đóng nhiệm vụ. Lead time đã chốt theo ngày hoàn thành.');
    closeDongNhiemVu();
    sauHanhDong();
  } catch (e) {
    notifyError(e.message);
    $('klDongLuu').disabled = false;
  }
}

export function mountMinhChung(registerActions, napLaiDanhSach) {
  sauHanhDong = napLaiDanhSach;
  $('modalRoot').insertAdjacentHTML('beforeend', klMinhChungTemplate);
  $('klMcMoTaKq').addEventListener('input', demKyTu);
  registerActions({ openMinhChung, closeMinhChung, luuMinhChung, xacNhanMinhChung: xacNhanMinhChungAction, nghiemThuMinhChung, moBacMinhChung, bacMinhChung,
    openDongNhiemVu, closeDongNhiemVu, luuDongNhiemVu });
}
