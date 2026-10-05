// Hộp "Bàn giao tài khoản" (v3.15, chỉ quan_tri_he_thong — Edge Function là chốt): chọn phạm vi (toàn bộ / theo phòng / theo vai), xem trước
// số tài khoản sẽ đặt lại và danh sách bị bỏ qua (lib/ban-giao-xuat.js, cùng quy tắc với function), lý do bắt buộc, gõ BÀN GIAO → hành động
// reset_hang_loat → hộp kết quả hiện MỘT lần với "Tải Excel bàn giao" / "In phiếu từng người". Kết quả chỉ giữ trong biến của module cho tới khi
// đóng hộp; không vào state, không vào storage. Cùng hai nút xuất cho hộp "Mật khẩu tạm" của một người (tạo tài khoản / đặt lại lẻ).
import { $, show, setText, escapeHtml, showInlineError, formatDateTime } from '../../../lib/dom.js';
import { DEPT_NAMES, ROLE_LABELS } from '../../../lib/constants.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { goiQuanTriTaiKhoan } from '../../../lib/quan-tri-api.js';
import { locBanGiao, dongBanGiao, sheetsBanGiao, htmlPhieuBanGiao, tenTepBanGiao, TOI_DA_HANG_LOAT } from '../../../lib/ban-giao-xuat.js';
import { banGiaoModalTemplate } from './template-ban-giao.js';

const XAC_NHAN = 'BÀN GIAO';
let onDone = async () => {};
let ketQua = null;          // { rows, luc, boQua } — chỉ sống khi hộp kết quả đang mở
let daXuat = false;
let motNguoi = null;        // { username, matKhau } của hộp "Mật khẩu tạm"

const urlApp = () => `${location.origin}${location.pathname}`.replace(/index\.html$/, '');
const thongTinChung = (luc) => ({ url: urlApp(), luc: formatDateTime(luc), nguoi: `${state.user.full_name} (${state.user.username})` });

function tuyChon() {
  return { phamVi: $('qtBgPhamVi').value, phong: $('qtBgPhong').value, vai: $('qtBgVai').value, keCaDangDung: $('qtBgKeCa').checked };
}

// Xem trước: đếm sẽ đặt lại / bỏ qua theo lựa chọn hiện tại; bật nút khi đủ điều kiện.
function xemTruocBanGiao() {
  const tc = tuyChon();
  show('qtBgPhongWrap', tc.phamVi === 'phong'); show('qtBgVaiWrap', tc.phamVi === 'vai');
  const { chon, boQua } = locBanGiao(state.accounts, tc, state.user.id);
  const quaNhieu = chon.length > TOI_DA_HANG_LOAT;
  setText('qtBgSoChon', chon.length ? `Sẽ đặt lại mật khẩu tạm cho ${chon.length} tài khoản${quaNhieu ? ` — vượt mức ${TOI_DA_HANG_LOAT}/lượt, hãy thu hẹp phạm vi` : ''}.` : 'Không có tài khoản nào trong phạm vi này cần đặt lại.');
  $('qtBgBoQua').innerHTML = boQua.length ? `<summary>Bỏ qua ${boQua.length} tài khoản</summary><ul>${boQua.map((b) => `<li>${escapeHtml(b.tk.full_name)} (${escapeHtml(b.tk.username)}) — ${escapeHtml(b.lyDo)}</li>`).join('')}</ul>` : '';
  show('qtBgBoQua', boQua.length > 0);
  show('qtBgCanhBaoKeCa', tc.keCaDangDung);
  $('qtBgThucHien').disabled = !chon.length || quaNhieu || $('qtBgXacNhan').value.trim() !== XAC_NHAN || !$('qtBgLyDo').value.trim();
  return chon;
}

function moBanGiao() {
  $('qtBgPhong').innerHTML = Object.entries(DEPT_NAMES).map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`).join('');
  $('qtBgVai').innerHTML = Object.entries(ROLE_LABELS).map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`).join('');
  $('qtBgPhamVi').value = 'toan_bo'; $('qtBgKeCa').checked = false; $('qtBgLyDo').value = ''; $('qtBgXacNhan').value = '';
  showInlineError('qtBgError', '');
  xemTruocBanGiao();
  show('qtBgModal', true);
  $('qtBgLyDo').focus();
}

async function thucHienBanGiao() {
  const chon = xemTruocBanGiao();
  if ($('qtBgThucHien').disabled) return;
  const btn = $('qtBgThucHien'); btn.disabled = true; btn.textContent = 'Đang đặt lại…';
  try {
    const kq = await goiQuanTriTaiKhoan({ hanh_dong: 'reset_hang_loat', ids: chon.map((a) => a.id), ly_do: $('qtBgLyDo').value.trim(), ke_ca_dang_dung: $('qtBgKeCa').checked });
    ketQua = { rows: dongBanGiao(kq.dat_lai, state.accounts), boQua: kq.bo_qua || [], luc: new Date().toISOString() };
    daXuat = false;
    show('qtBgModal', false);
    setText('qtBgKqMoTa', `Đã đặt lại mật khẩu tạm cho ${ketQua.rows.length} tài khoản${ketQua.boQua.length ? `, bỏ qua ${ketQua.boQua.length}` : ''}. Tải tệp hoặc in phiếu NGAY — đóng hộp này là không xem lại được.`);
    $('qtBgKqDanhSach').innerHTML = ketQua.rows.map((r) => `<li>${escapeHtml(r.ho_ten)} <small>${escapeHtml(r.username)} · ${escapeHtml(r.phong)}</small></li>`).join('')
      + ketQua.boQua.map((b) => `<li class="chu-phu">Bỏ qua ${escapeHtml(b.username)} — ${escapeHtml(b.ly_do)}</li>`).join('');
    $('qtBgKqDong').disabled = true; $('qtBgKqDaGhi').checked = false;
    show('qtBgKqModal', true);
    await onDone();
  } catch (e) { showInlineError('qtBgError', e.message); } finally { btn.textContent = 'Đặt lại và xuất tệp'; xemTruocBanGiao(); }
}

// Tải .xlsx (bộ ghi sẵn có, nạp động) / mở trang in. Dùng chung cho hàng loạt và một người.
async function taiExcel(rows, luc, hauTo) {
  const { taoXlsx, taiXuong } = await import('../../../lib/xlsx.js');
  taiXuong(tenTepBanGiao(new Date(luc), 'xlsx', hauTo), taoXlsx(sheetsBanGiao(rows, thongTinChung(luc))));
  notifySuccess(`Đã tải tệp bàn giao ${rows.length} tài khoản.`);
}
function inPhieu(rows, luc) {
  const w = window.open('', '_blank');
  if (!w) { notifyError('Trình duyệt chặn cửa sổ mới — cho phép cửa sổ bật lên rồi bấm lại.'); return; }
  w.document.open(); w.document.write(htmlPhieuBanGiao(rows, thongTinChung(luc))); w.document.close();
}
const choPhepDong = () => { daXuat = true; $('qtBgKqDong').disabled = false; };

async function taiExcelBanGiao() { if (!ketQua) return; await taiExcel(ketQua.rows, ketQua.luc, ''); choPhepDong(); }
function inPhieuBanGiao() { if (!ketQua) return; inPhieu(ketQua.rows, ketQua.luc); choPhepDong(); }
function dongKetQuaBanGiao() {
  if (!daXuat && !$('qtBgKqDaGhi').checked) { notifyError('Tải tệp, in phiếu hoặc đánh dấu "đã ghi lại" trước khi đóng.'); return; }
  ketQua = null; daXuat = false; $('qtBgKqDanhSach').innerHTML = '';
  show('qtBgKqModal', false);
}

// Một người (hộp "Mật khẩu tạm"): tai-khoan-form gọi datMotNguoi khi hiện hộp; xoá khi đóng.
export function datMotNguoi(username, matKhau) { motNguoi = username ? { username, matKhau, luc: new Date().toISOString() } : null; }
const dongMotNguoi = () => {
  if (!motNguoi) return null;
  const a = state.accounts.find((x) => x.username === motNguoi.username) || {};
  return dongBanGiao([{ id: a.id, username: motNguoi.username, full_name: a.full_name || '', mat_khau_tam: motNguoi.matKhau }], state.accounts);
};
async function taiPhieuMotNguoi() { const rows = dongMotNguoi(); if (rows) await taiExcel(rows, motNguoi.luc, motNguoi.username); }
function inPhieuMotNguoi() { const rows = dongMotNguoi(); if (rows) inPhieu(rows, motNguoi.luc); }

export function mountBanGiao(reload) {
  onDone = reload;
  $('modalRoot').insertAdjacentHTML('beforeend', banGiaoModalTemplate);
  ['qtBgPhamVi', 'qtBgPhong', 'qtBgVai', 'qtBgKeCa'].forEach((id) => $(id).addEventListener('change', xemTruocBanGiao));
  ['qtBgXacNhan', 'qtBgLyDo'].forEach((id) => $(id).addEventListener('input', xemTruocBanGiao));
  $('qtBgKqDaGhi').addEventListener('change', (e) => { $('qtBgKqDong').disabled = !(daXuat || e.target.checked); });
  registerActions({ moBanGiao, dongHopBanGiao: () => show('qtBgModal', false), thucHienBanGiao, taiExcelBanGiao, inPhieuBanGiao, dongKetQuaBanGiao, taiPhieuMotNguoi, inPhieuMotNguoi });
}
