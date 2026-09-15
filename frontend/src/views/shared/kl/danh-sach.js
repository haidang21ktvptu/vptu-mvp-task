// Trạng thái và vẽ màn hình danh sách KL: một lần đọc v_kl_dashboard (RLS lọc phạm vi) → ô số và bảng sinh từ CÙNG
// một mảng (tổng các ô = số dòng; bấm ô = lọc đúng mảng đó). Bộ lọc "ngữ cảnh" (hội nghị/ngành/lĩnh vực/tìm kiếm và
// các khoá dashboard truyền sang) áp cho cả ô số lẫn bảng; bộ lọc "nhóm" chỉ áp cho bảng.
import { $, setText, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { notifyError } from '../../../components/toast.js';
import { loadDanhMucKl, loadCauHinhKl, loadKlRows, danhMucKl, linhVucCuaNganh, tenTrongDanhMuc } from '../../../lib/kl/du-lieu.js';
import { tongHop, sapXep, locRows, kiemBatBien, CHUA_PHAN_LOAI, CHUA_CO_NGANH } from '../../../lib/kl/tong-hop.js';
import { THU_TU_NHOM, tenNhom } from '../../../lib/kl/nhan.js';
import { homNayVN } from '../../../lib/kl/ngay.js';
import { dongHtml, SO_COT } from './dong.js';

const kl = { rows: [], luc: null, loc: {} };
export const getKlRows = () => kl.rows;
export const timKlRow = (id) => kl.rows.find((r) => r.id === id);

// Khoá lọc do dashboard (10C) đặt — hiện thành chip có nút bỏ; khoá ở ô chọn/ô tìm không hiện chip.
const NHAN_CHIP = {
  chuTri: (v) => `Chủ trì: ${kl.rows.find((r) => r.chu_tri_id === v)?.chu_tri_ten || v}`,
  coQuanTrinh: (v) => `Cơ quan trình: ${tenTrongDanhMuc('coQuanTrinh', v)}`,
  chiMo: () => 'Chỉ việc đang mở',
  thieuMinhChung: () => 'Hoàn thành chưa có minh chứng',
  khongNgayHoanThanh: () => 'Hoàn thành không có ngày hoàn thành gốc',
  khongCapNhatQua: (v) => `Đang mở, không cập nhật quá ${v} ngày`,
  dangDinhChinh: () => 'Có đề nghị đính chính đang chờ duyệt',
  nhomTrong: (v) => `Nhóm: ${v.map(tenNhom).join(', ')}`,
};

export function setKlLoc(loc, thayThe = false) {
  kl.loc = thayThe ? { ...loc } : { ...kl.loc, ...loc };
  if (thayThe) { ['klLocHoiNghi', 'klLocNganh', 'klLocLinhVuc', 'klTimKiem'].forEach((id) => { if ($(id)) $(id).value = kl.loc[MAP_O[id]] || ''; }); }
  render();
}
const MAP_O = { klLocHoiNghi: 'hoiNghi', klLocNganh: 'nganh', klLocLinhVuc: 'linhVuc', klTimKiem: 'tuKhoa' };

export async function loadKl() {
  try {
    await Promise.all([loadDanhMucKl(), loadCauHinhKl()]);
    const { rows, luc } = await loadKlRows();
    kl.rows = rows; kl.luc = luc;
    const bb = kiemBatBien(rows);
    if (!bb.dung) notifyError(`Số liệu không khớp: ${bb.tongNhom} theo nhóm, ${bb.tongLV} theo lĩnh vực, ${bb.tong} dòng. Báo người quản trị KL.`);
    dienBoLoc();
    render();
  } catch (e) {
    notifyError('Không đọc được dữ liệu Kết luận BTVTU: ' + e.message);
  }
}

function dienBoLoc() {
  const opt = (v, t, chon) => `<option value="${escapeHtml(v)}"${chon ? ' selected' : ''}>${escapeHtml(t)}</option>`;
  const hn = [...new Set(kl.rows.map((r) => r.so_hoi_nghi))].sort((a, b) => b - a);
  $('klLocHoiNghi').innerHTML = opt('', 'Mọi hội nghị') + hn.map((s) => opt(s, `Hội nghị ${s}`, String(kl.loc.hoiNghi) === String(s))).join('');
  const coNganhTrong = kl.rows.some((r) => !r.nganh_ma);
  $('klLocNganh').innerHTML = opt('', 'Mọi ngành') + danhMucKl().nganh.map((n) => opt(n.ma, n.ten, kl.loc.nganh === n.ma)).join('')
    + (coNganhTrong ? opt(CHUA_CO_NGANH, 'Chưa có ngành', kl.loc.nganh === CHUA_CO_NGANH) : '');
  dienLinhVuc();
}
function dienLinhVuc() {
  const opt = (v, t, chon) => `<option value="${escapeHtml(v)}"${chon ? ' selected' : ''}>${escapeHtml(t)}</option>`;
  const ds = kl.loc.nganh && kl.loc.nganh !== CHUA_CO_NGANH ? linhVucCuaNganh(kl.loc.nganh) : danhMucKl().linhVuc;
  $('klLocLinhVuc').innerHTML = opt('', 'Mọi lĩnh vực') + ds.map((l) => opt(l.ma, kl.loc.nganh ? l.ten : `${l.ten} (${tenTrongDanhMuc('nganh', l.nganh_ma).split('.')[0]})`, kl.loc.linhVuc === l.ma)).join('')
    + opt(CHUA_PHAN_LOAI, 'Chưa phân loại', kl.loc.linhVuc === CHUA_PHAN_LOAI);
}

// Vẽ ô số (theo lọc ngữ cảnh) và bảng (theo lọc ngữ cảnh + nhóm).
export function render() {
  const { nhom, ...nguCanh } = kl.loc;
  const trongNguCanh = locRows(kl.rows, nguCanh);
  const t = tongHop(trongNguCanh);
  setText('klSo-TONG', t.tong);
  THU_TU_NHOM.forEach((k) => setText(`klSo-${k}`, t.nhom[k]));
  document.querySelectorAll('#klStats .o-so').forEach((el) => el.setAttribute('aria-pressed', String((el.dataset.nhom || '') === (nhom || ''))));
  // Ô Đang đính chính chỉ hiện khi > 0 (bình thường không có), Sắp đến hạn ghi rõ ngưỡng.
  $('klSo-DANG_DINH_CHINH').closest('.o-so').classList.toggle('hidden', t.nhom.DANG_DINH_CHINH === 0 && nhom !== 'DANG_DINH_CHINH');

  const list = sapXep(locRows(trongNguCanh, { nhom }));
  const homNay = homNayVN();
  $('klBody').innerHTML = list.length === 0
    ? `<tr><td colspan="${SO_COT}" class="trong">${kl.rows.length === 0 ? 'Không có nhiệm vụ Kết luận BTVTU nào trong phạm vi của đồng chí.' : 'Không có nhiệm vụ nào phù hợp điều kiện lọc.'}</td></tr>`
    : list.map((r) => dongHtml(r, homNay)).join('');
  setText('klSoDong', `${list.length} / ${kl.rows.length} nhiệm vụ${nhom ? ` · ${tenNhom(nhom)}` : ''}`);
  if (kl.luc) setText('klTinhDen', `Số liệu tính đến ${formatDateTime(kl.luc)}:${String(kl.luc.getSeconds()).padStart(2, '0')}`);
  veChip();
}

function veChip() {
  const chips = Object.entries(kl.loc).filter(([k, v]) => NHAN_CHIP[k] && v).map(([k, v]) =>
    `<span class="chip">${escapeHtml(NHAN_CHIP[k](v))}<button type="button" data-action="boKlLoc" data-khoa="${k}" aria-label="Bỏ lọc">✕</button></span>`);
  if (kl.loc.tuTongQuan) chips.unshift('<button type="button" class="btn btn-phu btn-nho" data-action="openKlDashboard">← Về tổng quan</button>');
  $('klChipLoc').innerHTML = chips.join('');
  $('klChipLoc').classList.toggle('hidden', chips.length === 0);
}

export function ganBoLoc() {
  Object.entries(MAP_O).forEach(([id, khoa]) => $(id).addEventListener(id === 'klTimKiem' ? 'input' : 'change', (e) => {
    kl.loc[khoa] = e.target.value;
    if (khoa === 'nganh') { kl.loc.linhVuc = ''; dienLinhVuc(); }
    render();
  }));
}
export const locKlNhom = ({ nhom }) => { kl.loc.nhom = nhom || ''; render(); };
export const boKlLoc = ({ khoa }) => { delete kl.loc[khoa]; render(); };
