// Khối "Minh chứng" trong ngăn chi tiết (GĐ16, MC-2…MC-6) + hộp Nộp minh chứng + hộp Đóng nhiệm vụ (việc chuyển đổi cũ). Nút chỉ ẩn/hiện cho
// đẹp — quyền thật trong hàm DB. Đợt D v3.20 (0089–0090, định hướng 8/10/2026: lãnh đạo theo dõi, chuyên viên nhập liệu):
//   - nộp minh chứng hợp lệ (số hiệu + ngày; tệp tuỳ chọn / bắt buộc theo cấu hình) = nhiệm vụ HOÀN THÀNH ngay, không chờ ai xác nhận;
//   - người giao việc / người theo dõi / lãnh đạo trong phạm vi (không bắt buộc): Đánh giá chất lượng, Trả lại (minh chứng hợp lệ cuối cùng bị
//     trả lại thì việc mở lại); minh chứng nộp trước v3.20 còn chờ: Xác nhận hợp lệ;
//   - tệp: xem bằng đường dẫn ký 2 phút, gắn tệp cho minh chứng đã nộp chưa có tệp (minh-chung-tep.js).
// Sau mỗi hành động: sauHanhDong() nạp lại danh sách và mở lại ngăn.
import { $, show, setText, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { state, findAccount } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { danhMucKl, homNayTheoDb, tenTrongDanhMuc } from '../../../lib/kl/du-lieu.js';
import { homNayVN, formatNgay } from '../../../lib/kl/ngay.js';
import { loadMinhChung, nopMinhChung, loiMinhChung, xacNhanMinhChung, dongNhiemVu, mcHopLe, TEN_LOAI_MC, duocNopMinhChung, duocXemLaiMinhChung } from '../../../lib/kl/minh-chung.js';
import { batBuocTep, taiLenTep, xoaTepChuaGan } from '../../../lib/kl/tep-minh-chung.js';
import { klMinhChungTemplate } from './minh-chung-template.js';
import { timKlRow } from './danh-sach.js';
import { duocChiDao } from './chi-dao.js';
import { oDanhGiaHtml, chatLuongCuaForm } from '../chat-luong.js';
import { laQtklConHan } from './thong-tin-giao.js';
import { tepHtml, nutGanTepHtml, ganSuKienTep, tepDangChon, datLaiTep, hanhDongTep } from './minh-chung-tep.js';

// Tên lớp nguyên văn (Tailwind cắt lớp ghép chuỗi khỏi bản build).
const LOP_LOAI = { so_hieu: 'mc-loai', chu_cu: 'mc-loai mc-loai-cu', tep: 'mc-loai' };
const LOP_TRANG_THAI = { null: 'trang-thai tt-cho', true: 'trang-thai tt-xong', false: 'trang-thai tt-qua' };
const TEN_TRANG_THAI = { null: 'Chờ xác nhận', true: 'Hợp lệ', false: 'Bị trả lại' };

const tenNguoi = (id) => findAccount(id)?.full_name || 'không xác định';
const dangMo = (r) => r.tien_do_ma !== 'HOAN_THANH' && !r.dong_luc;

function nutXemLaiHtml(r, m) {
  if (!duocXemLaiMinhChung(r, m) || m.hop_le === false) return '';
  const traLai = `<button type="button" class="nut nho" data-action="moBacMinhChung" data-id="${m.id}" data-nv="${r.id}">Trả lại</button>`;
  if (m.hop_le === null) return `<button type="button" class="nut nho" data-action="xacNhanMinhChung" data-id="${m.id}" data-nv="${r.id}">Xác nhận hợp lệ</button>${traLai}`;
  const danhGia = !dangMo(r) ? `<button type="button" class="nut nho" data-action="moO" data-o="mcDg-${m.id}">${r.chat_luong ? 'Sửa đánh giá' : 'Đánh giá chất lượng'}</button>` : '';
  return danhGia + traLai;
}

function mcHtml(m, r) {
  const k = String(m.hop_le);
  const dau = m.loai === 'chu_cu' ? (m.so_hieu || 'không tách được số hiệu') : m.so_hieu;
  const chiTiet = [m.ngay_van_ban ? `ngày ${formatNgay(m.ngay_van_ban)}` : '', m.cap_nhan ? tenTrongDanhMuc('cap', m.cap_nhan) : ''].filter(Boolean).join(' · ');
  const bonYeuTo = m.trich_yeu || m.mo_ta_ket_qua ? `<p class="mc-trich-yeu">${escapeHtml(m.trich_yeu || '')}</p><p class="mc-mo-ta">${escapeHtml(m.mo_ta_ket_qua || '')}</p>` : '';
  const xacNhan = m.hop_le === false ? `<p class="chu-phu mc-phu">Bị trả lại: ${escapeHtml(m.ly_do_khong_hop_le || '')} — ${escapeHtml(tenNguoi(m.xac_nhan_boi))}, ${formatDateTime(m.xac_nhan_luc)}</p>`
    : m.hop_le === true && m.xac_nhan_boi ? `<p class="chu-phu mc-phu">Xác nhận hợp lệ — ${escapeHtml(tenNguoi(m.xac_nhan_boi))}, ${formatDateTime(m.xac_nhan_luc)}</p>` : '';
  return `
    <div class="mc-dong" id="mc-${m.id}" data-loai="${m.loai}" data-hop-le="${k}">
      <div class="mc-dau">
        <span class="${LOP_LOAI[m.loai] || 'mc-loai'}">${TEN_LOAI_MC[m.loai] || m.loai}</span>
        <b>${escapeHtml(dau)}</b>${chiTiet ? ` <span>${escapeHtml(chiTiet)}</span>` : ''}
        <span class="chu-phu">nộp bởi ${escapeHtml(tenNguoi(m.nop_boi))}, ${formatDateTime(m.nop_luc)}</span>
        <span class="${LOP_TRANG_THAI[k]}">${TEN_TRANG_THAI[k]}</span>
        <span class="mc-nut">${nutGanTepHtml(r, m)}${nutXemLaiHtml(r, m)}</span>
      </div>
      ${m.loai === 'chu_cu' ? `<p class="mc-chu">${escapeHtml(m.noi_dung_chu || '')}</p>` : ''}
      ${bonYeuTo}${tepHtml(m)}
      ${xacNhan}
      ${duocXemLaiMinhChung(r, m) && m.hop_le === true && !dangMo(r) ? oDanhGiaHtml(`mcDg-${m.id}`, 'danhGiaMinhChung', { id: m.id, nv: r.id }) : ''}
      <form class="mc-form-ly-do hidden" id="mcBac-${m.id}" data-submit="bacMinhChung" data-id="${m.id}" data-nv="${r.id}">
        <input type="text" name="ly_do" required class="o-nhap nho" placeholder="Lý do trả lại (bắt buộc)" aria-label="Lý do trả lại">
        <button type="submit" class="nut lam nho">Trả lại minh chứng</button>
      </form>
    </div>`;
}

export function minhChungHtml(r, ds) {
  const hopLe = ds.filter(mcHopLe).length;
  const nutNop = duocNopMinhChung(r) ? `<button type="button" class="nut lam nho" data-action="openMinhChung" data-id="${r.id}">Nộp minh chứng</button>` : '';
  const goiY = r.theo_1400 ? '<p class="chu-phu">Nộp minh chứng hợp lệ (số hiệu, ngày văn bản) là hoàn thành nhiệm vụ — ngày hoàn thành = ngày văn bản minh chứng. Người giao việc hoặc lãnh đạo có thể trả lại nếu chưa đạt.</p>' : '';
  return `
    <div class="khoi-mc" id="klMinhChung-${r.id}" data-hop-le="${hopLe}">
      <h4>Minh chứng <span class="chu-phu">${ds.length === 0 ? 'chưa có' : `${hopLe} hợp lệ / ${ds.length} đã nộp`}</span><span class="mc-nut">${nutNop}</span></h4>
      ${goiY}
      ${ds.length === 0 ? '<p class="chu-phu">Chưa có minh chứng.</p>' : ds.map((m) => mcHtml(m, r)).join('')}
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
  datLaiTep('klMc', batBuocTep());
  $('klMcLuu').disabled = false;
  show('klMcModal', true);
  $('klMcSoHieu').focus();
}
export const closeMinhChung = () => show('klMcModal', false);

const demKyTu = () => setText('klMcDem', String($('klMcMoTaKq').value.normalize('NFC').length));   // đếm như DB (NFC)
async function luuMinhChung() {
  const r = timKlRow($('klMcId').value);
  const p = { nhiem_vu_id: $('klMcId').value, so_hieu: $('klMcSoHieu').value.trim(), ngay_van_ban: $('klMcNgay').value, cap_nhan: $('klMcCap').value,
    trich_yeu: $('klMcTrichYeu').value.trim(), mo_ta_ket_qua: $('klMcMoTaKq').value.trim() };
  const tep = tepDangChon('klMc');
  const loiForm = loiMinhChung(p, r?.cap_nhan_san_pham, { batBuoc: batBuocTep(), coTep: Boolean(tep) });
  if (loiForm) { notifyError(loiForm); return; }
  if (p.ngay_van_ban > homNay) { notifyError('Ngày văn bản không được sau hôm nay.'); return; }
  $('klMcLuu').disabled = true;
  let path = null;
  try {
    if (tep) { path = await taiLenTep(p.nhiem_vu_id, tep); Object.assign(p, { tep_path: path, tep_ten: tep.name }); }
    await nopMinhChung(p);
    notifySuccess(r && dangMo(r) ? `Đã nộp minh chứng số ${p.so_hieu} — nhiệm vụ ${r.ma} hoàn thành.` : `Đã nộp minh chứng số ${p.so_hieu}.`);
    closeMinhChung();
    sauHanhDong();
  } catch (e) {
    await xoaTepChuaGan(path);
    notifyError(e.message);
    $('klMcLuu').disabled = false;
  }
}

// ---- Xác nhận (minh chứng cũ còn chờ) / đánh giá / trả lại ----
async function xacNhanMinhChungAction(ds) {
  try {
    await xacNhanMinhChung(ds.id, true);
    notifySuccess(dangMo(timKlRow(ds.nv) || {}) ? 'Đã xác nhận minh chứng — nhiệm vụ hoàn thành.' : 'Đã xác nhận minh chứng hợp lệ.');
    sauHanhDong();
  } catch (e) {
    notifyError(e.message);
  }
}
async function danhGiaMinhChung(ds, form) {
  const cl = chatLuongCuaForm(form);
  if (!cl) { notifyError('Chọn chất lượng hoàn thành.'); return; }
  try { await xacNhanMinhChung(ds.id, true, null, cl); notifySuccess('Đã lưu đánh giá chất lượng hoàn thành.'); sauHanhDong(); } catch (e) { notifyError(e.message); }
}
function moBacMinhChung(ds) {
  const f = $(`mcBac-${ds.id}`); if (!f) return;
  show(f, true); f.querySelector('input').focus();
}
async function bacMinhChung(ds, form) {
  const lyDo = (new FormData(form).get('ly_do') || '').trim();
  if (!lyDo) { notifyError('Trả lại minh chứng phải ghi lý do.'); return; }
  try {
    await xacNhanMinhChung(ds.id, false, lyDo);
    notifySuccess('Đã trả lại minh chứng. Người nộp nhận thông báo (không còn minh chứng hợp lệ thì nhiệm vụ mở lại).');
    sauHanhDong();
  } catch (e) {
    notifyError(e.message);
  }
}

// ---- Hộp Đóng nhiệm vụ (việc chuyển đổi cũ — dong_nhiem_vu) ----
export async function openDongNhiemVu({ id }) {
  const r = timKlRow(id);
  if (!r) return;
  homNay = (await homNayTheoDb()) || homNayVN();
  let goiY = '';
  try { goiY = (await loadMinhChung(r.id)).find((m) => mcHopLe(m) && m.ngay_van_ban)?.ngay_van_ban || ''; } catch { /* để trống, DB tự lấy */ }
  $('klDongId').value = r.id;
  setText('klDongMoTa', `${r.ma} — ${r.noi_dung}`);
  $('klDongNgay').value = goiY; $('klDongNgay').min = r.ngay_ban_hanh; $('klDongNgay').max = homNay;
  setText('klDongGhiChu', r.ngay_nhan_uoc_tinh ? 'Ngày giao nhiệm vụ là ước tính (= ngày ban hành) nên lead time không được tính.' : `Lead time = ngày hoàn thành − ngày giao nhiệm vụ (${formatNgay(r.ngay_nhan_van_ban)}).`);
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
  ganSuKienTep('klMc', { soHieu: 'klMcSoHieu', ngay: 'klMcNgay', trichYeu: 'klMcTrichYeu' });
  registerActions({ openMinhChung, closeMinhChung, luuMinhChung, xacNhanMinhChung: xacNhanMinhChungAction, danhGiaMinhChung, moBacMinhChung, bacMinhChung,
    openDongNhiemVu, closeDongNhiemVu, luuDongNhiemVu, ...hanhDongTep(() => sauHanhDong()) });
}
