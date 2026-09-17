// Trạng thái và vẽ màn hình Nhiệm vụ: một lần đọc v_nhiem_vu (RLS lọc phạm vi) → dải số và danh sách sinh từ CÙNG một mảng (tổng các ô =
// số dòng; bấm ô = lọc đúng mảng đó). Bộ lọc "ngữ cảnh" (kết luận/hội nghị/ngành/lĩnh vực/tìm kiếm/chip đơn vị và các khoá màn hình
// điều hành truyền sang) áp cho cả dải số lẫn danh sách; bộ lọc "nhóm" chỉ áp cho danh sách. Ngăn chi tiết đang mở giữ nguyên qua vẽ lại.
import { $, show, setText, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { notifyError } from '../../../components/toast.js';
import { loadDanhMucKl, loadCauHinhKl, loadKlRows, danhMucKl, linhVucCuaNganh, tenTrongDanhMuc } from '../../../lib/kl/du-lieu.js';
import { tongHop, sapXep, locRows, kiemBatBien, CHUA_PHAN_LOAI, CHUA_CO_NGANH } from '../../../lib/kl/tong-hop.js';
import { THU_TU_NHOM, tenNhom, boSoThuTu } from '../../../lib/kl/nhan.js';
import { homNayVN } from '../../../lib/kl/ngay.js';
import { dongHtml } from './dong.js';
import { veLaiChiTiet, idDangMo } from './chi-tiet.js';

const kl = { rows: [], luc: null, loc: {} };
let sauKhiNap = null;
export const setKlSauKhiNap = (fn) => { sauKhiNap = fn; };
export const getKlRows = () => kl.rows;
export const timKlRow = (id) => kl.rows.find((r) => r.id === id);

// Khoá lọc do màn hình điều hành đặt — hiện thành chip có nút bỏ; khoá ở ô chọn/ô tìm (đơn vị, kết luận, hội nghị, ngành, lĩnh vực) không hiện chip.
const NHAN_CHIP = {
  nguoiTheoDoi: (v) => `Người theo dõi: ${kl.rows.find((r) => r.nguoi_theo_doi === v)?.nguoi_theo_doi_ten || v}`,
  canBo: (v) => `Cán bộ: ${state.accounts.find((a) => a.id === v)?.full_name || v}`,
  cuaToi: () => 'Việc của tôi (chịu trách nhiệm hoặc theo dõi)',
  theoDoiCuaToi: () => 'Việc tôi theo dõi (không phải Owner)',
  chiMo: () => 'Chỉ việc đang mở',
  thieuMinhChung: () => 'Hoàn thành chưa có minh chứng',
  khongNgayHoanThanh: () => 'Hoàn thành không có ngày hoàn thành gốc',
  khongCapNhatQua: (v) => `Đang mở, không cập nhật quá ${v} ngày`,
  dangDinhChinh: () => 'Có đề nghị đính chính đang chờ duyệt',
  muc: (v) => `Mức cảnh báo: ${v === 'DO_DAC_BIET' ? 'Đỏ đặc biệt' : v}`,
  chuaCapQuyetDinh: () => 'Đang mở, chưa xác định cấp cần quyết định',
  nhomTrong: (v) => `Nhóm: ${v.map(tenNhom).join(', ')}`,
};
const MAP_O = { klLocDonVi: 'donVi', klLocKetLuan: 'ketLuan', klLocHoiNghi: 'hoiNghi', klLocNganh: 'nganh', klLocLinhVuc: 'linhVuc', klTimKiem: 'tuKhoa' };

export function setKlLoc(loc, thayThe = false) {
  kl.loc = thayThe ? { ...loc } : { ...kl.loc, ...loc };
  if (thayThe) Object.entries(MAP_O).forEach(([id, khoa]) => { if ($(id)) $(id).value = kl.loc[khoa] || ''; });
  render();
}

// Đọc lỗi tạm (mạng, staging bận) → thử lại một lần sau 800 ms rồi mới báo; giữ dòng cũ trên màn hình.
export async function loadKl(lanThu = 0) {
  try {
    await Promise.all([loadDanhMucKl(), loadCauHinhKl()]);
    const { rows, luc } = await loadKlRows();
    kl.rows = rows; kl.luc = luc;
    $('klBody').dataset.nap = luc.toISOString(); // dấu hiệu đã nạp xong (e2e chờ thuộc tính này, không dựa vào "có dòng đầu")
    const bb = kiemBatBien(rows);
    if (!bb.dung) notifyError(`Số liệu không khớp: ${bb.tongNhom} theo nhóm, ${bb.tongLV} theo lĩnh vực, ${bb.tong} dòng. Báo người quản trị KL.`);
    dienBoLoc();
    render(true);
    if (sauKhiNap) sauKhiNap(rows);
  } catch (e) {
    if (lanThu < 1) { await new Promise((r) => setTimeout(r, 800)); return loadKl(lanThu + 1); }
    notifyError('Không đọc được dữ liệu nhiệm vụ: ' + e.message);
  }
}

const opt = (v, t, chon) => `<option value="${escapeHtml(v)}"${chon ? ' selected' : ''}>${escapeHtml(t)}</option>`;
function dienBoLoc() {
  const kls = [...new Set(kl.rows.map((r) => r.so_ket_luan).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
  $('klLocKetLuan').innerHTML = opt('', 'Mọi kết luận') + kls.map((k) => opt(k, k, kl.loc.ketLuan === k)).join('');
  const hn = [...new Set(kl.rows.map((r) => r.so_hoi_nghi).filter(Boolean))].sort((a, b) => b - a);
  $('klLocHoiNghi').innerHTML = opt('', 'Mọi hội nghị') + hn.map((s) => opt(s, `Hội nghị ${s}`, String(kl.loc.hoiNghi) === String(s))).join('');
  const coNganhTrong = kl.rows.some((r) => !r.nganh_ma);
  $('klLocNganh').innerHTML = opt('', 'Mọi ngành') + danhMucKl().nganh.map((n) => opt(n.ma, n.ten, kl.loc.nganh === n.ma)).join('')
    + (coNganhTrong ? opt(CHUA_CO_NGANH, 'Chưa có ngành', kl.loc.nganh === CHUA_CO_NGANH) : '');
  dienLinhVuc();
  // Ô chọn Đơn vị chịu trách nhiệm (có đếm), nhiều việc trước; A2/A3 thường chỉ một đơn vị → ẩn ô.
  const dv = new Map(); kl.rows.forEach((r) => { if (!r.owner_don_vi_ma) return; const c = dv.get(r.owner_don_vi_ma) || { ten: boSoThuTu(r.owner_don_vi_ten), n: 0 }; c.n++; dv.set(r.owner_don_vi_ma, c); });
  const ds = [...dv].sort((a, b) => b[1].n - a[1].n || a[1].ten.localeCompare(b[1].ten, 'vi'));
  $('klLocDonVi').innerHTML = opt('', `Đơn vị (${dv.size})`) + ds.map(([ma, c]) => opt(ma, `${c.ten} (${c.n})`, kl.loc.donVi === ma)).join('');
  show('klLocDonVi', dv.size > 1 || Boolean(kl.loc.donVi));
}
function dienLinhVuc() {
  const ds = kl.loc.nganh && kl.loc.nganh !== CHUA_CO_NGANH ? linhVucCuaNganh(kl.loc.nganh) : danhMucKl().linhVuc;
  $('klLocLinhVuc').innerHTML = opt('', 'Mọi lĩnh vực') + ds.map((l) => opt(l.ma, kl.loc.nganh ? l.ten : `${l.ten} (${tenTrongDanhMuc('nganh', l.nganh_ma).split('.')[0]})`, kl.loc.linhVuc === l.ma)).join('')
    + opt(CHUA_PHAN_LOAI, 'Chưa phân loại', kl.loc.linhVuc === CHUA_PHAN_LOAI);
}

// Vẽ dải số (theo lọc ngữ cảnh) và danh sách (theo lọc ngữ cảnh + nhóm). veLaiNgan: chỉ khi dữ liệu vừa nạp lại (không nạp lại căn cứ
// của ngăn đang mở mỗi lần gõ ô tìm / đổi bộ lọc).
export function render(veLaiNgan = false) {
  const { nhom, ...nguCanh } = kl.loc;
  const trongNguCanh = locRows(kl.rows, nguCanh);
  const t = tongHop(trongNguCanh);
  setText('klSo-TONG', t.tong);
  THU_TU_NHOM.forEach((k) => { setText(`klSo-${k}`, t.nhom[k]); show($(`klSo-${k}`).closest('.o-so'), t.nhom[k] > 0 || nhom === k); });
  document.querySelectorAll('#klStats .o-so').forEach((el) => el.setAttribute('aria-pressed', String((el.dataset.nhom || '') === (nhom || ''))));
  const list = sapXep(locRows(trongNguCanh, { nhom }));
  const homNay = homNayVN();
  const dangMo = idDangMo();
  $('klBody').innerHTML = list.length === 0
    ? `<p class="trong-nho">${kl.rows.length === 0 ? 'Không có nhiệm vụ nào trong phạm vi của đồng chí.' : 'Không có nhiệm vụ nào phù hợp điều kiện lọc.'}</p>`
    : list.map((r) => dongHtml(r, homNay, r.id === dangMo)).join('');
  if (veLaiNgan && dangMo && timKlRow(dangMo)) veLaiChiTiet(dangMo);
  setText('klSoDong', `${list.length} / ${kl.rows.length} nhiệm vụ${nhom ? ` · ${tenNhom(nhom)}` : ''}`);
  if (kl.luc) setText('klTinhDen', `Số liệu tính đến ${formatDateTime(kl.luc)}:${String(kl.luc.getSeconds()).padStart(2, '0')}`);
  veChip();
}

function veChip() {
  const chips = Object.entries(kl.loc).filter(([k, v]) => NHAN_CHIP[k] && v).map(([k, v]) =>
    `<span class="chip">${escapeHtml(NHAN_CHIP[k](v))}<button type="button" data-action="boKlLoc" data-khoa="${k}" aria-label="Bỏ lọc">✕</button></span>`);
  if (kl.loc.tuTongQuan) chips.unshift('<button type="button" class="nut nho" data-action="openDieuHanh">← Về điều hành</button>');
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
