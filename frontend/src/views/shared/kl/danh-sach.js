// Trạng thái và vẽ màn hình Nhiệm vụ: một lần đọc v_nhiem_vu (RLS lọc phạm vi) → dải số và danh sách sinh từ CÙNG một mảng (tổng các ô =
// số dòng; bấm ô = lọc đúng mảng đó). Bộ lọc "ngữ cảnh" (kết luận/hội nghị/ngành/lĩnh vực/tìm kiếm/chip đơn vị và các khoá màn hình
// điều hành truyền sang) áp cho cả dải số lẫn danh sách; bộ lọc "nhóm" chỉ áp cho danh sách. Ngăn chi tiết đang mở giữ nguyên qua vẽ lại.
// v3.24: bộ lọc chi tiết (thời gian nhập, người nhập, cấp giao, hạn xử lý, độ khẩn — loc-them.js) và ba cách sắp xếp (kl.sx; mặc định mới nhập trước).
// v3.25 (bảng theo cột, mẫu NhiemVu 16/10/2026): 50 dòng mỗi trang (kl.trang; đổi lọc / tìm / sắp xếp / ô số → trang 1; nạp lại, realtime giữ
// trang; In / Xuất Excel lấy đủ danh sách), hàng tiêu đề theo bộ cột; chế độ "Việc tôi theo dõi" (theo-doi.js) khi có khoá theoDoiCuaToi.
import { $, show, setText, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { notifyError } from '../../../components/toast.js';
import { loadDanhMucKl, loadCauHinhKl, loadKlRows, danhMucKl, linhVucCuaNganh, tenTrongDanhMuc, loadPhanCongHieuLuc, xemToanBo } from '../../../lib/kl/du-lieu.js';
import { trongPhamVi, locCanBo, tuyChonCanBo, chiXem } from '../../../lib/kl/pham-vi.js';
import { tongHop, sapXep, locRows, kiemBatBien, CHUA_PHAN_LOAI, CHUA_CO_NGANH, CHUA_CO_NGUON } from '../../../lib/kl/tong-hop.js';
import { THU_TU_NHOM, tenNhom, boSoThuTu } from '../../../lib/kl/nhan.js';
import { homNayVN } from '../../../lib/kl/ngay.js';
import { giaiLocThem, sapXepMoiNhap, sapXepHan, demLocThem } from '../../../lib/kl/loc-them.js';
import { THU_TU_DO_KHAN, tenDoKhan } from '../../../lib/kl/do-khan.js';
import { tuyChonMucTieu } from '../../../lib/kl/tq-bo-loc.js';   // v3.24 (0105): ô lọc mục tiêu then chốt
import { phanTrang, chuHienThi } from '../../../lib/kl/bang-o.js';
import { dauBangHtml, nutTrangHtml, giuTieuDiem } from '../bang/khung.js';
import { dongHtml } from './dong.js';
import { veLaiChiTiet, idDangMo, dongBoNgan } from './chi-tiet.js';
import { td, laTheoDoi, locTheoDoi, veTheoDoi } from './theo-doi.js';

// v3.23 (0103): kl.rows = mọi dòng đọc được (cấu hình xem toàn bộ: cả việc chỉ xem); danh sách mặc định chỉ việc trong phạm vi xử lý, nút
// "Toàn Văn phòng" (kl.loc.toanBo) mở cả việc chỉ xem. Ngăn chi tiết tìm dòng trong kl.rows nên mở được mọi việc đọc được (ngoài phạm vi: chỉ xem).
const kl = { rows: [], luc: null, loc: {}, phanCong: [], sx: 'moi', trang: 1, inDayDu: false };
const COT_NV = [['STT', 'bnv-c-stt'], ['Thời gian nhập', 'bnv-c-tg'], ['Nhiệm vụ'], ['Văn bản giao'], ['Chủ trì'], ['Hạn xử lý'], ['Trạng thái']];
const COT_TD = [['STT', 'bnv-c-stt'], ['Nhiệm vụ'], ['Chủ trì'], ['Văn bản giao'], ['Hạn xử lý'], ['Trạng thái'], ['Tình hình']];
const SAP_XEP_HAM = { moi: sapXepMoiNhap, han: sapXepHan, 'canh-bao': sapXep };
let sauKhiNap = null;
export const setKlSauKhiNap = (fn) => { sauKhiNap = fn; };
export const getKlRows = () => kl.rows;
export const timKlRow = (id) => kl.rows.find((r) => r.id === id);
const coSo = () => (kl.loc.toanBo ? kl.rows : trongPhamVi(kl.rows));

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
const MAP_O = { klLocDonVi: 'donVi', klLocKetLuan: 'ketLuan', klLocHoiNghi: 'hoiNghi', klLocNganh: 'nganh', klLocLinhVuc: 'linhVuc', klLocNguon: 'nguon', klTimKiem: 'tuKhoa',
  klLocChuTri: 'chuTri', klLocTheoDoi: 'theoDoi', klLocLdvp: 'ldvp',   // v3.23: lọc theo cán bộ chủ trì, người theo dõi, lãnh đạo VP phụ trách
  klLocNhap: 'nhapKy', klLocNhapTu: 'nhapTuNgay', klLocNhapDen: 'nhapDenNgay', klLocNguoiNhap: 'nguoiNhap', klLocCapGiao: 'capGiao',   // v3.24
  klLocHan: 'hanKy', klLocHanTu: 'hanTuNgay', klLocHanDen: 'hanDenNgay', klLocDoKhan: 'doKhan', klLocMucTieu: 'mucTieu' };   // ô ngày: khoá *Ngay, locRows nhận khoá đã giải
// PR-3: danh sách ĐANG HIỆN (lọc ngữ cảnh + nhóm, đã sắp xếp) — nút Xuất Excel xuất đúng các dòng này.
let dangHien = [];
export const dsDangHien = () => dangHien;

export function setKlLoc(loc, thayThe = false) {
  kl.loc = thayThe ? { ...loc } : { ...kl.loc, ...loc };
  kl.trang = 1;
  if (thayThe) Object.entries(MAP_O).forEach(([id, khoa]) => { if ($(id)) $(id).value = kl.loc[khoa] || ''; });
  render();
}

// Đọc lỗi tạm (mạng, staging bận) → thử lại một lần sau 800 ms rồi mới báo; giữ dòng cũ trên màn hình.
// Đánh dấu "chưa nạp" khi mở lại màn hình: render() bỏ data-nap cho tới khi có dữ liệu mới.
export function datKlChuaNap() { kl.luc = null; }

// Gộp lượt nạp trùng (mở màn hình + realtime + sau hành động cùng lúc): một lượt tại một thời điểm; lượt tới trong lúc đang nạp chỉ ghi nhớ
// "cần nạp lại" và chạy MỘT lần sau khi xong — mỗi lượt là 3 truy vấn (v_nhiem_vu tính trạng thái từng dòng) nên chạy chồng làm staging quá tải.
let dangNap = null; let canNapLai = false;
export const dangNapKl = () => dangNap;   // nap-lai-viec chờ lượt này xong rồi mới thay một dòng
export function loadKl() {
  if (dangNap) { canNapLai = true; return dangNap; }
  dangNap = (async () => {
    try { await napKl(); } finally { dangNap = null; }
    if (canNapLai) { canNapLai = false; return loadKl(); }
  })();
  return dangNap;
}

async function napKl(lanThu = 0) {
  try {
    await Promise.all([loadDanhMucKl(), loadCauHinhKl()]);
    const [{ tatCa: rows, luc }, phanCong] = await Promise.all([loadKlRows(), loadPhanCongHieuLuc().catch(() => kl.phanCong)]);
    kl.rows = rows; kl.luc = luc; kl.phanCong = phanCong;
    const bb = kiemBatBien(rows);
    if (!bb.dung) notifyError(`Số liệu không khớp: ${bb.tongNhom} theo nhóm, ${bb.tongLV} theo lĩnh vực, ${bb.tong} dòng. Báo người quản trị KL.`);
    dienBoLoc();
    render(true);
    if (sauKhiNap) sauKhiNap(rows);
  } catch (e) {
    if (lanThu < 1) { await new Promise((r) => setTimeout(r, 800)); return napKl(lanThu + 1); }
    notifyError('Không đọc được dữ liệu nhiệm vụ: ' + e.message);
  }
}

const opt = (v, t, chon) => `<option value="${escapeHtml(v)}"${chon ? ' selected' : ''}>${escapeHtml(t)}</option>`;
function dienBoLoc() {
  const rows = coSo();
  const kls = [...new Set(rows.map((r) => r.so_ket_luan).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
  $('klLocKetLuan').innerHTML = opt('', 'Mọi kết luận') + kls.map((k) => opt(k, k, kl.loc.ketLuan === k)).join('');
  const hn = [...new Set(rows.map((r) => r.so_hoi_nghi).filter(Boolean))].sort((a, b) => b - a);
  $('klLocHoiNghi').innerHTML = opt('', 'Mọi hội nghị') + hn.map((s) => opt(s, `Hội nghị ${s}`, String(kl.loc.hoiNghi) === String(s))).join('');
  const coNganhTrong = rows.some((r) => !r.nganh_ma);
  $('klLocNganh').innerHTML = opt('', 'Mọi ngành') + danhMucKl().nganh.map((n) => opt(n.ma, n.ten, kl.loc.nganh === n.ma)).join('')
    + (coNganhTrong ? opt(CHUA_CO_NGANH, 'Chưa phân loại ngành', kl.loc.nganh === CHUA_CO_NGANH) : '');
  dienLinhVuc();
  $('klLocNguon').innerHTML = opt('', 'Mọi nguồn') + (danhMucKl().nguonNhiemVu || []).map((d) => opt(d.ma, d.ten, kl.loc.nguon === d.ma)).join('')
    + (rows.some((r) => !r.nguon_nhiem_vu_ma) ? opt(CHUA_CO_NGUON, 'Chưa xác định nguồn', kl.loc.nguon === CHUA_CO_NGUON) : '');
  // Ô chọn Đơn vị chịu trách nhiệm (có đếm), nhiều việc trước; A2/A3 thường chỉ một đơn vị → ẩn ô.
  const dv = new Map(); rows.forEach((r) => { if (!r.owner_don_vi_ma) return; const c = dv.get(r.owner_don_vi_ma) || { ten: boSoThuTu(r.owner_don_vi_ten), n: 0 }; c.n++; dv.set(r.owner_don_vi_ma, c); });
  const ds = [...dv].sort((a, b) => b[1].n - a[1].n || a[1].ten.localeCompare(b[1].ten, 'vi'));
  $('klLocDonVi').innerHTML = opt('', `Đơn vị (${dv.size})`) + ds.map(([ma, c]) => opt(ma, `${c.ten} (${c.n})`, kl.loc.donVi === ma)).join('');
  show('klLocDonVi', dv.size > 1 || Boolean(kl.loc.donVi));
  // v3.23: ba ô lọc theo cán bộ (có đếm, trên dòng của phạm vi đang xem); ô chỉ một lựa chọn và chưa chọn thì ẩn.
  const tc = tuyChonCanBo(rows, { ten: (id) => state.accounts.find((a) => a.id === id)?.full_name, phanCong: kl.phanCong,
    lanhDaoVP: state.accounts.filter((a) => a.role_group === 'A1' && !a.is_chief && !a.is_system) });
  [['klLocChuTri', 'chuTri', 'Cán bộ chủ trì'], ['klLocTheoDoi', 'theoDoi', 'Người theo dõi'], ['klLocLdvp', 'ldvp', 'Lãnh đạo VP phụ trách']].forEach(([id, k, nhan]) => {
    $(id).innerHTML = opt('', `${nhan} (${tc[k].length})`) + tc[k].map((o) => opt(o.ma, `${o.ten} (${o.n})`, kl.loc[k] === o.ma)).join('');
    show(id, tc[k].length > 1 || Boolean(kl.loc[k]));
  });
  // v3.24: người nhập (tao_boi) và độ khẩn — có đếm trên dòng của phạm vi đang xem; cấp giao, thời gian nhập, hạn là danh sách cố định.
  const nn = new Map(); rows.forEach((r) => { if (r.tao_boi) nn.set(r.tao_boi, (nn.get(r.tao_boi) || 0) + 1); });
  const tenTk = (id) => state.accounts.find((a) => a.id === id)?.full_name || 'Tài khoản đã xoá';
  $('klLocNguoiNhap').innerHTML = opt('', `Mọi người nhập (${nn.size})`) + [...nn].sort((a, b) => tenTk(a[0]).localeCompare(tenTk(b[0]), 'vi'))
    .map(([id, n]) => opt(id, `${tenTk(id)} (${n})`, kl.loc.nguoiNhap === id)).join('');
  const dk = new Map(); rows.forEach((r) => { const m = r.do_khan || 'THUONG'; dk.set(m, (dk.get(m) || 0) + 1); });
  $('klLocDoKhan').innerHTML = opt('', 'Mọi độ khẩn') + [...THU_TU_DO_KHAN].reverse().filter((m) => dk.has(m) || kl.loc.doKhan === m)
    .map((m) => opt(m, `${tenDoKhan(m)} (${dk.get(m) || 0})`, kl.loc.doKhan === m)).join('');
  const mt = tuyChonMucTieu(rows, danhMucKl().mucTieu || [], danhMucKl().nhomMucTieu).map((g) => { const o = g.ds.map((x) => opt(x.ma, `${x.ten} (${x.n})`, kl.loc.mucTieu === x.ma)).join(''); return g.nhom ? `<optgroup label="${escapeHtml(g.nhom)}">${o}</optgroup>` : o; });
  $('klLocMucTieu').innerHTML = opt('', 'Mọi mục tiêu then chốt') + mt.join('');
  show('klLocMucTieu', (danhMucKl().mucTieu || []).length > 0);
  show('klRaSoatMt', (danhMucKl().mucTieu || []).length > 0 && state.user?.role_group !== 'A0' && !state.user?.bi_khoa);   // v3.25: lối vào Rà soát mục tiêu (gan_muc_tieu là chốt)
}
function dienLinhVuc() {
  const ds = kl.loc.nganh && kl.loc.nganh !== CHUA_CO_NGANH ? linhVucCuaNganh(kl.loc.nganh) : danhMucKl().linhVuc;
  $('klLocLinhVuc').innerHTML = opt('', 'Mọi lĩnh vực') + ds.map((l) => opt(l.ma, kl.loc.nganh ? l.ten : `${l.ten} (${tenTrongDanhMuc('nganh', l.nganh_ma).split('.')[0]})`, kl.loc.linhVuc === l.ma)).join('')
    + opt(CHUA_PHAN_LOAI, 'Chưa phân loại', kl.loc.linhVuc === CHUA_PHAN_LOAI);
}

// Vẽ dải số (theo lọc ngữ cảnh) và danh sách (theo lọc ngữ cảnh + nhóm). veLaiNgan: chỉ khi dữ liệu vừa nạp lại (không nạp lại căn cứ
// của ngăn đang mở mỗi lần gõ ô tìm / đổi bộ lọc).
export function render(veLaiNgan = false) {
  const traTd = giuTieuDiem($('viewKl'));   // ô số, nút trang, nút quan hệ, dòng đang chọn giữ con trỏ bàn phím qua lần vẽ lại
  const { nhom, ...nguCanh } = kl.loc;
  const goc = coSo();
  const homNay = homNayVN();
  const trongNguCanh = locCanBo(locRows(goc, { ...nguCanh, ...giaiLocThem(kl.loc, homNay), mucTieuDm: danhMucKl().mucTieu }), kl.loc, kl.phanCong);
  const t = tongHop(trongNguCanh);
  setText('klSo-TONG', t.tong);
  THU_TU_NHOM.forEach((k) => { setText(`klSo-${k}`, t.nhom[k]); show($(`klSo-${k}`).closest('.o-so'), t.nhom[k] > 0 || nhom === k); });
  document.querySelectorAll('#klStats .o-so').forEach((el) => el.setAttribute('aria-pressed', String((el.dataset.nhom || '') === (nhom || ''))));
  // Việc tôi theo dõi (theo-doi.js): ô số riêng + quan hệ thay dải trạng thái; sắp xếp "Mức cảnh báo" không dùng ở chế độ này.
  const theoDoi = laTheoDoi(kl.loc); const tdLoc = theoDoi ? locTheoDoi(trongNguCanh) : null;
  veTheoDoi(theoDoi, tdLoc?.so);
  if (theoDoi && kl.sx === 'canh-bao') kl.sx = 'moi';
  const list = (SAP_XEP_HAM[kl.sx] || sapXep)(theoDoi ? tdLoc.list : locRows(trongNguCanh, { nhom }));
  dangHien = list;
  const p = kl.inDayDu ? { trang: 1, soTrang: 1, tu: 0, den: list.length } : phanTrang(list.length, kl.trang);
  if (!kl.inDayDu) kl.trang = p.trang;   // in xong trở lại đúng trang đang xem
  $('klBang').className = theoDoi ? 'list bnv cot-td' : 'list bnv cot-nv';
  $('klDauBang').innerHTML = dauBangHtml(theoDoi ? COT_TD : COT_NV);
  const dangMo = idDangMo(); const tuyChon = { now: Date.now(), cot: theoDoi ? 'td' : 'nv' };
  $('klBody').innerHTML = list.length === 0
    ? `<p class="trong-nho">${goc.length === 0 ? 'Không có nhiệm vụ nào trong phạm vi của đồng chí.' : 'Không có nhiệm vụ nào phù hợp điều kiện lọc.'}</p>`
    : list.slice(p.tu, p.den).map((r, i) => dongHtml(r, homNay, r.id === dangMo, { ...tuyChon, stt: p.tu + i + 1 })).join('');
  $('klBody').dataset.soLoc = String(list.length); $('klBody').dataset.soHien = String(p.den - p.tu);   // e2e: số dòng đang lọc / đang hiện
  if (veLaiNgan && dangMo && timKlRow(dangMo)) veLaiChiTiet(dangMo);
  setText('klSoDong', `${chuHienThi(p, list.length, goc.length)}${nhom && !theoDoi ? ` · ${tenNhom(nhom)}` : ''}`);
  $('klTrang').innerHTML = kl.inDayDu ? '' : nutTrangHtml(p, 'klTrang');
  const td = $('klTieuDe'); if (td?.dataset.thuong) td.textContent = theoDoi ? 'Việc tôi theo dõi' : td.dataset.thuong;   // bỏ chip / Toàn VP → tên thường
  setText('klPhuDe', theoDoi ? 'việc đồng chí theo dõi hoặc đã giao, do cán bộ, cơ quan khác chủ trì — cột Tình hình cho biết việc cần đôn đốc'
    : kl.loc.toanBo ? 'toàn Văn phòng — việc ngoài phạm vi xử lý của đồng chí ghi "Chỉ xem"; bấm một dòng để mở ngăn chi tiết'
      : 'trong phạm vi của đồng chí — bấm một dòng để mở ngăn chi tiết bên phải');
  dongBoNgan();
  if (kl.inDayDu) document.querySelector('#viewKl .md')?.classList.remove('co-ct');   // in: bảng đủ khổ giấy (ngăn chi tiết không in)
  // Dấu hiệu "đã nạp xong" cho mọi màn / vai (e2e chờ thuộc tính này, không dựa vào "có dòng đầu"): đặt ở đây để cả danh sách rỗng cũng có.
  if (kl.luc) $('klBody').dataset.nap = kl.luc.toISOString(); else $('klBody').removeAttribute('data-nap');
  if (kl.luc) setText('klTinhDen', `Số liệu tính đến ${formatDateTime(kl.luc)}:${String(kl.luc.getSeconds()).padStart(2, '0')}`);
  veChip();
  veTrangThaiLoc();
  traTd();
}

// v3.24: ô ngày của "khoảng ngày…" chỉ hiện khi chọn; nhãn "Thêm bộ lọc" ghi số bộ lọc đang áp dụng; nút Xoá bộ lọc; nút sắp xếp đang chọn.
function veTrangThaiLoc() {
  ['klLocNhapTu', 'klLocNhapDen'].forEach((id) => show(id, kl.loc.nhapKy === 'tuy-chon'));
  ['klLocHanTu', 'klLocHanDen'].forEach((id) => show(id, kl.loc.hanKy === 'tuy-chon'));
  const n = demLocThem(kl.loc);
  setText('klSoLocThem', n ? ` (${n} đang áp dụng)` : '');
  show('klXoaLoc', Boolean(kl.loc.nhom) || Object.values(MAP_O).some((k) => !k.endsWith('Ngay') && kl.loc[k]));   // ô ngày chỉ có tác dụng cùng kỳ "khoảng ngày…"
  document.querySelectorAll('#klSapXep button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sx === kl.sx)));
}

function veChip() {
  const chips = Object.entries(kl.loc).filter(([k, v]) => NHAN_CHIP[k] && v).map(([k, v]) =>
    `<span class="chip">${escapeHtml(NHAN_CHIP[k](v))}<button type="button" data-action="boKlLoc" data-khoa="${k}" aria-label="Bỏ lọc">✕</button></span>`);
  $('klChipLoc').innerHTML = chips.join('');
  $('klChipLoc').classList.toggle('hidden', chips.length === 0);
  // 0086: nút phạm vi của chuyên viên xem cả phòng (Việc của tôi / Cả phòng) luôn khớp khoá cuaToi — kể cả khi bỏ chip.
  document.querySelectorAll('#klPhamVi button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.pv === 'toi') === Boolean(kl.loc.cuaToi))));
  show('klToanBo', xemToanBo() && kl.rows.some(chiXem));   // v3.23 (0103): chỉ khi có việc ngoài phạm vi (Thường trực, Chánh VP vốn thấy hết)
  document.querySelectorAll('#klToanBo button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.tb === '1') === Boolean(kl.loc.toanBo))));
}

export function ganBoLoc() {
  Object.entries(MAP_O).forEach(([id, khoa]) => $(id).addEventListener(id === 'klTimKiem' ? 'input' : 'change', (e) => {
    kl.loc[khoa] = e.target.value;
    if (khoa === 'nganh') { kl.loc.linhVuc = ''; dienLinhVuc(); }
    // v3.24: rời "khoảng ngày…" thì bỏ hai ô ngày (không để khoá cũ treo lại)
    if ((khoa === 'nhapKy' || khoa === 'hanKy') && e.target.value !== 'tuy-chon') {
      const [o1, o2] = khoa === 'nhapKy' ? ['klLocNhapTu', 'klLocNhapDen'] : ['klLocHanTu', 'klLocHanDen'];
      [o1, o2].forEach((id) => { delete kl.loc[MAP_O[id]]; $(id).value = ''; });
    }
    kl.trang = 1; render();
  }));
}
export const locKlNhom = ({ nhom }) => { kl.loc.nhom = nhom || ''; kl.trang = 1; render(); };
// v3.23: đổi phạm vi danh sách (Phạm vi của tôi / Toàn Văn phòng) — bỏ khoá "việc của tôi"; ô chọn vẽ lại theo dòng của phạm vi mới.
export const doiKlToanBo = (toanBo) => { kl.loc = { ...kl.loc, toanBo, ...(toanBo ? { cuaToi: null, theoDoiCuaToi: null } : {}) }; kl.trang = 1; dienBoLoc(); render(); };
export const boKlLoc = ({ khoa }) => { delete kl.loc[khoa]; kl.trang = 1; render(); };
// v3.24: cách sắp xếp (giữ trong phiên làm việc, không đổi khi màn khác truyền bộ lọc sang); Xoá bộ lọc = bỏ mọi ô lọc + ô số đang chọn,
// giữ khoá ngữ cảnh (việc của tôi, phạm vi, chip từ màn điều hành — bỏ bằng nút ✕ của chip).
export const doiKlSapXep = ({ sx }) => { if (SAP_XEP_HAM[sx]) { kl.sx = sx; kl.trang = 1; render(); } };
export function xoaKlLoc() {
  Object.entries(MAP_O).forEach(([id, khoa]) => { delete kl.loc[khoa]; if ($(id)) $(id).value = ''; });
  delete kl.loc.nhom;
  kl.trang = 1; dienLinhVuc(); render();
}
// v3.25: trang (‹ / ›, cuộn về đầu bảng); ô số và quan hệ của "Việc tôi theo dõi"; In / lưu PDF vẽ tạm mọi dòng đang lọc (beforeprint / afterprint).
export function doiKlTrang({ trang }) { kl.trang = Number(trang) || 1; render(); $('klBang')?.scrollIntoView({ block: 'start' }); }
export const locKlTd = ({ loc }) => { td.loc = loc || 'tat'; kl.trang = 1; render(); };
export const doiKlQh = ({ qh }) => { td.qh = qh || ''; kl.trang = 1; render(); };
export function inKlDayDu(bat) { if (kl.inDayDu === bat) return; kl.inDayDu = bat; render(); }
