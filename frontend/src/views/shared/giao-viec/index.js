// Màn hình Giao việc (GĐ22; SPEC GV-2: người giao thiết lập Owner, Product, Deadline — hệ thống tự điền, cho sửa ngày giao, cấp nhận, người theo
// dõi). Dùng chung: A1/A2 (đầy đủ), A3 quan_tri_kl (thêm ô Thay mặt bắt buộc), A0 (rút gọn: DB tự suy người theo dõi, ngày giao, loại hạn…; để trống số
// hiệu + ngày → DB ghi mốc "Thường trực giao …"). Kiểm phía form để báo sớm (doc-form.js); DB là chốt (giao_viec). "Giao, nhập tiếp" giữ văn bản/ngành/
// lĩnh vực/loại hạn; trích yếu lưu bằng van_ban_dat_trich_yeu sau giao_viec. Giao tiếp xuống (giaoTiepXuong): văn bản của việc cha, gửi nhiem_vu_cha.
// PR-2a: văn bản tìm ở DB (van-ban.js), phạm vi giao theo DB (pham-vi.js). v9 đợt 2: thẻ Nhập từ Excel / Chờ hoàn thiện (nhap-excel/tab.js), hoàn thiện
// dòng chờ (dien-san.js). v3.17: tìm nhanh ở ô chọn người (lib/tim-chon.js), lãnh đạo giao cho chính mình (them-owner.js canBoOwner + giao_viec 0078).
// v3.18: thay mặt theo nhóm (lib/kl/thay-mat.js — thay mặt Thường trực: Owner như Thường trực giao, không ô người theo dõi, Khẩn mặc định, nhuA0);
// gộp bố cục (8/10/2026): hai khối — (1) văn bản và mốc giao, (2) các thẻ nhiệm vụ: thẻ 1 = bộ ô chính ở đây, thẻ 2…20 ở nhieu.js; có thẻ thêm →
// giao_viec_nhieu (dòng 1 tách từ docForm). Trạng thái đọc từ ô: trang-thai.js.
import { $, show, setText, escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { loadDanhMucKl, danhMucKl, linhVucCuaNganh, cauHinhKl, tuNhanViec, homNayTheoDb, giaoViec, giaoViecNhieu, datTrichYeuVanBan } from '../../../lib/kl/du-lieu.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { ganTimChon } from '../../../lib/tim-chon.js';
import { laThayMatThuongTruc } from '../../../lib/kl/thay-mat.js';
import { vb, timTrongDs, napVanBan, datLaiVanBan, themVanBanMoi, timKhiGo } from './van-ban.js';
import { napPhamVi, locOwner, nganhDuocChon, linhVucDuocChon, thongBaoPhamVi, theoDoiHopLe, locTheoDoi, lanhDaoLoc } from './pham-vi.js';
import { datLaiNguon, apMacDinhNguon, nguonDoi, thieuNguon } from './nguon.js';   // PR-3
import { formatNgay, ghiChuHan, congNgay } from '../../../lib/kl/ngay.js';
import { tenDoKhan } from '../../../lib/kl/do-khan.js';
import { setActiveNav, showSection } from '../../shell/index.js';
import { openKl, moNhiemVu } from '../kl/index.js';
import { timKlRow } from '../kl/danh-sach.js';
import { giaoViecTemplate } from './template.js';
import { apDienSan, boHoanThien } from './dien-san.js';
import { hienTabGiaoViec } from '../nhap-excel/tab.js';
import { ownerOptionsHtml, parseOwner, nguoiTheoDoiOptionsHtml, thayMatOptionsHtml, goiYTheoDoi, LOAI_VAN_BAN } from '../kl/them-owner.js';
import { getHomNay, datHomNay, laA0, nhuA0, anTheoDoi, laThayMatTT, canThayMat, nhanMoi, phongOwner, laMoi, thieuSoHN, bhTuongLai, vanBanOk, hanTruocBH, ngayBH, loaiVanBan,
  canNganhHienTai, canNgayNhan } from './trang-thai.js';
import { kiemTra, docForm, tachDong } from './doc-form.js';
import { datLaiNhieu, anHienNhieu, lamMoiLuaChonLuoi, ganSuKienNhieu, themDong, xoaDong, thieuNhieu, duNhieu, loiNhieu, docDong, soThe, coThem, doiDoKhanMacDinhNhieu } from './nhieu.js';

let cha = null; // việc cha khi giao tiếp xuống (nhiem_vu_cha)
// Lỗi đua (CI #96): trong lúc nạp (mở biểu mẫu, đổi người được thay mặt) mọi ô bị khoá — fieldset#gvKhoa disabled + aria-busy, nút "Giao,
// nhập tiếp" mờ — nên người dùng không chọn được gì để rồi bị bước khởi tạo ghi đè; mở lại biểu mẫu khi lượt trước chưa xong: lượt cũ dừng.
let luotMo = 0;
const tim = {};   // ô tìm nhanh gắn vào ba ô chọn người (apLai sau khi vẽ lại <select>)
function khoaBieuMau(khoa) {
  $('gvKhoa').disabled = khoa; $('gvKhoa').setAttribute('aria-busy', String(khoa));
  $('klThLuuTiep').disabled = khoa;
  if (khoa) $('klThLuu').disabled = true;
}
const opt = (v, t, chon = false) => `<option value="${escapeHtml(v)}"${chon ? ' selected' : ''}>${escapeHtml(t)}</option>`;
function datDoKhanChinh(ma) { $('klThDoKhan').value = ma; $('klThDoKhanWrap').querySelectorAll('.dk-chon button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.giaTri === ma))); }
const AN_A0 = ['klThNguoiTheoDoiWrap', 'gvGoiYCanBo', 'gvThemWrap', 'klThLuuTiep'];   // A0: không người theo dõi, không "Thông tin thêm" (cấp QĐ, VB triển khai, ghi chú), không "Giao, nhập tiếp"
const anHienTheoDoi = () => ['klThNguoiTheoDoiWrap', 'gvGoiYCanBo'].forEach((id) => show(id, !anTheoDoi()));   // ẩn khi Thường trực giao / chuyên viên giao thẳng (0085)
// A0 với văn bản kết luận / thông báo: giao_viec bắt buộc ngành + lĩnh vực (và ngày giao, loại hạn như A1) → hiện các ô này theo loại văn bản.
const THEO_LOAI_A0 = ['gvNganhWrap', 'klThNgayNhanWrap', 'klThLoaiWrap'];
const vanBanChon = () => timTrongDs($('klThVanBan').value);
// C3: tổ hợp (phòng Owner, ngành, lĩnh vực) đang chọn có trong phạm vi giao (kl_pham_vi_giao) không; người theo dõi: pham-vi.js (3.4, F).
const phamViThieu = () => thongBaoPhamVi(phongOwner(), $('klThNganh').value, $('klThLinhVuc').value, danhMucKl().linhVuc);
const theoDoiNgoaiPhamVi = () => !theoDoiHopLe($('klThNguoiTheoDoi').value, $('klThThayMat').value, $('klThNganh').value, $('klThLinhVuc').value);
// Danh sách người theo dõi theo phạm vi hiện tại; giữ lựa chọn nếu còn hợp lệ, không thì gợi ý theo người chịu trách nhiệm.
function dienTheoDoi() {
  const s = $('klThNguoiTheoDoi'); const cu = s.value;
  s.innerHTML = nguoiTheoDoiOptionsHtml(state.accounts, state.user);
  locTheoDoi(s, $('klThThayMat').value, $('klThNganh').value, $('klThLinhVuc').value);
  const goiY = goiYTheoDoi($('klThOwner').value, danhMucKl(), state.accounts, state.user);
  s.value = [cu, goiY, lanhDaoLoc($('klThThayMat').value)].find((v) => v && s.querySelector(`option[value="${v}"]`)) || s.options[0]?.value || '';
  tim.theoDoi?.apLai();
}

function capNhatHienThi() {
  const loai = $('klThLoai').value;
  const bh = ngayBH(); const homNay = getHomNay();
  show('klThVanBanMoi', laMoi());
  show('klThSoHNWrap', laMoi() && $('klThLoaiVB').value === 'KL_BTV');
  show('gvVbA0', laA0() && laMoi());
  $('klThHan').min = bh;
  $('klThNgayNhan').min = bh; $('klThNgayNhan').max = homNay;
  if (loai === 'KY_BAN_HANH') {
    $('klThHan').value = bh ? congNgay(bh, cauHinhKl('ky_ban_hanh_ngay', 10)) : '';
    $('klThHan').disabled = true;
    setText('klThHanLoai', `tự tính = ngày ban hành + ${cauHinhKl('ky_ban_hanh_ngay', 10)}`);
  } else {
    $('klThHan').disabled = false;
    setText('klThHanLoai', '');
  }
  show('klThHanBatBuoc', loai !== 'KY_BAN_HANH');
  setText('klThHanGhiChu', $('klThHan').value ? `${$('klThHanLoai').textContent ? ' · ' : ''}${ghiChuHan($('klThHan').value, homNay)}` : '');
  lamMoiLuaChonLuoi();   // min hạn từng dòng theo ngày ban hành
  capNhatNganh();
  capNhatTomTat();
}
function capNhatNganh() {   // bắt buộc động theo loại văn bản: kết luận / thông báo → dấu *; còn lại → chú thích "không bắt buộc"
  const bb = canNganhHienTai();
  show('klThNganhBatBuoc', bb); show('klThLinhVucBatBuoc', bb);
  setText('klThNganhGhiChu', bb ? 'bắt buộc với kết luận / thông báo' : 'không bắt buộc với loại văn bản này');
}
// Ngành / lĩnh vực: chỉ các mục trong phạm vi giao ở phòng của Owner (C3); giữ lựa chọn cũ nếu vẫn hợp lệ.
function dienNganh() {
  const cho = nganhDuocChon(phongOwner()); const cu = $('klThNganh').value;
  $('klThNganh').innerHTML = opt('', 'Chọn ngành') + danhMucKl().nganh.filter((n) => !cho || cho.has(n.ma)).map((n) => opt(n.ma, n.ten, n.ma === cu)).join('');
  dienLinhVuc();
}
function dienLinhVuc() {
  const cho = linhVucDuocChon(phongOwner()); const cu = $('klThLinhVuc').value;
  $('klThLinhVuc').innerHTML = opt('', 'Chọn lĩnh vực') + linhVucCuaNganh($('klThNganh').value).filter((l) => !cho || cho.has(l.ma)).map((l) => opt(l.ma, l.ten, l.ma === cu)).join('');
  dienTheoDoi();
}
function vanBanDoi() { $('klThNgayNhan').value = vanBanChon()?.ngay_nhan || getHomNay(); capNhatHienThi(); }
// Đổi lãnh đạo được thay mặt → phạm vi của người đó; lọc lại Owner / ngành / lĩnh vực. Khoá biểu mẫu khi đọc; lỗi → trả ô Thay mặt về người cũ.
// Vào / rời "Thường trực Tỉnh ủy" (v3.18): ẩn / hiện người theo dõi, độ khẩn mặc định Khẩn ↔ Thường (chỉ khi người dùng chưa chọn mức khác).
let thayMatCu = '';
async function thayMatDoi() {
  const ttCu = laThayMatThuongTruc(thayMatCu);
  khoaBieuMau(true);
  try { await napPhamVi($('klThThayMat').value || null); thayMatCu = $('klThThayMat').value; } catch (e) { notifyError(e.message); $('klThThayMat').value = thayMatCu; }
  khoaBieuMau(false);
  if (laThayMatTT() !== ttCu) {   // mức mặc định đổi Thường ↔ Khẩn ở ô chính và các thẻ (chỉ khi còn ở mức mặc định cũ)
    const [tu, den] = laThayMatTT() ? ['THUONG', 'KHAN'] : ['KHAN', 'THUONG'];
    if ($('klThDoKhan').value === tu) datDoKhanChinh(den); doiDoKhanMacDinhNhieu(tu, den);
  }
  anHienTheoDoi(); dienOwner(); dienNganh(); capNhatTomTat();
}
function dienOwner() {
  const cu = $('klThOwner').value;
  $('klThOwner').innerHTML = ownerOptionsHtml(danhMucKl(), state.accounts, state.user, laThayMatTT(), $('klThThayMat').value);   // 0085: chuyên viên không thay mặt → chỉ chuyên viên
  locOwner($('klThOwner'), danhMucKl(), state.accounts);
  if ([...$('klThOwner').options].some((o) => o.value === cu)) $('klThOwner').value = cu;
  tim.owner?.apLai(); lamMoiLuaChonLuoi();
}
function ownerDoi() {
  dienNganh();
  const { capMacDinh } = parseOwner($('klThOwner').value, danhMucKl(), state.accounts);
  if (capMacDinh) $('klThCapNhan').value = capMacDinh;
  const goiY = goiYTheoDoi($('klThOwner').value, danhMucKl(), state.accounts, state.user);
  if (goiY && $('klThNguoiTheoDoi').querySelector(`option[value="${goiY}"]`)) $('klThNguoiTheoDoi').value = goiY;
  capNhatTomTat();
}

// Hai khối đã điền đủ chưa → chấm sáng; đủ cả hai → nút Giao sáng. Khối 1: văn bản, nguồn, ngày giao (thay mặt tuỳ chọn từ 0085). Khối 2: thẻ 1 (bộ ô
// chính) + các thẻ thêm (nhieu.js thieuNhieu).
export function trangThaiPhan() {
  const p1 = vanBanOk() && !thieuNguon() && (!canNgayNhan() || Boolean($('klThNgayNhan').value));
  const nguoi = anTheoDoi() || Boolean($('klThNguoiTheoDoi').value);
  const nganh = (!canNganhHienTai() || (Boolean($('klThNganh').value) && Boolean($('klThLinhVuc').value))) && !theoDoiNgoaiPhamVi() && !phamViThieu().thieu;
  const the1 = Boolean($('klThNoiDung').value.trim()) && Boolean($('klThOwner').value) && nguoi
    && Boolean($('klThSanPham').value) && ($('klThLoai').value === 'KY_BAN_HANH' || Boolean($('klThHan').value)) && !hanTruocBH() && nganh;
  return [p1, the1 && duNhieu()];
}
// Các yếu tố bắt buộc còn thiếu (theo thứ tự khối; thẻ thêm ghi "nhiệm vụ n: …") — dòng "Còn thiếu: …" cạnh nút Giao việc.
function conThieu() {
  return [[thieuSoHN(), 'số hội nghị'], [bhTuongLai(), 'ngày ban hành không ở tương lai'], [!vanBanOk() && !thieuSoHN() && !bhTuongLai(), 'văn bản'], [thieuNguon(), 'nguồn nhiệm vụ'],
    [canNgayNhan() && !$('klThNgayNhan').value, 'ngày giao nhiệm vụ'],
    [!$('klThNoiDung').value.trim(), 'nội dung'], [!$('klThOwner').value, 'người chịu trách nhiệm'], [!anTheoDoi() && !$('klThNguoiTheoDoi').value, 'người theo dõi'],
    [!$('klThSanPham').value, 'sản phẩm'], [$('klThLoai').value !== 'KY_BAN_HANH' && !$('klThHan').value, 'hạn hoàn thành'], [hanTruocBH(), 'hạn sau ngày ban hành'],
    [canNganhHienTai() && !$('klThNganh').value, 'ngành'], [canNganhHienTai() && !$('klThLinhVuc').value, 'lĩnh vực'],
    [Boolean(phamViThieu().thieu), phamViThieu().thieu], [theoDoiNgoaiPhamVi(), 'người theo dõi thuộc phòng, lĩnh vực đồng chí phụ trách']].filter(([t]) => t).map(([, n]) => n)
    .concat(thieuNhieu());
}
function capNhatTomTat() {
  apMacDinhNguon(loaiVanBan());   // PR-3: nguồn theo loại văn bản đang áp dụng (mới hoặc có sẵn) cho tới khi người dùng tự chọn
  if (laA0()) { THEO_LOAI_A0.forEach((id) => show(id, canNganhHienTai())); capNhatNganh(); } // theo từng ô gõ (số hiệu / ngày / loại văn bản)
  anHienNhieu();
  const [p1, p2] = trangThaiPhan();
  [p1, p2].forEach((ok, i) => $(`gvCham${i + 1}`).classList.toggle('xong', ok));
  $('klThLuu').disabled = !(p1 && p2);
  const so = soThe(); const maDk = $('klThDoKhan').value; const dk = tenDoKhan(maDk);
  const owner = $('klThOwner').value ? $('klThOwner').selectedOptions[0]?.text : '…';
  const sp = $('klThSanPham').value ? $('klThSanPham').selectedOptions[0]?.text : '…';
  const nd = $('klThNoiDung').value.trim(); const han = $('klThHan').value ? formatNgay($('klThHan').value) : '…';
  const khac = so > 1 ? ` · và ${so - 1} việc khác` : '';
  setText('klThLuu', so > 1 ? `Giao ${so} việc` : 'Giao việc');
  setText('gvTomTatChu', `Giao "${nd ? nd.slice(0, 60) + (nd.length > 60 ? '…' : '') : '…'}" cho ${owner}, hạn ${han}, sản phẩm ${sp}, độ khẩn ${dk}${khac}`);
  const thieu = conThieu(); setText('gvConThieu', thieu.length ? `Còn thiếu: ${thieu.join(', ')}` : '');
  setText('gvPhamViGhiChu', phamViThieu().chuThich || 'theo ngành đã chọn');
  // Xem trước thẻ việc (cột phụ) đọc lại các ô của thẻ 1
  setText('gvXtDoKhan', dk); $('gvXtDoKhan').className = `tag ${['THUONG_KHAN', 'HOA_TOC'].includes(maDk) ? 'do' : maDk === 'KHAN' ? 'vang' : ''}`;
  setText('gvXtNoiDung', nd || 'Nội dung nhiệm vụ…');
  setText('gvXtPhu', `Chủ trì ${owner} · hạn ${han} · sản phẩm ${sp}${khac}`);
}

export async function openGiaoViec(opts = {}) {
  cha = opts.cha || null;
  showSection('viewGiaoViec');
  $('giaoViecForm').removeAttribute('data-san-sang'); // đang khởi tạo theo vai/dữ liệu — spec chờ cờ này trước khi đọc ô
  setActiveNav('navGiaoViec'); hienTabGiaoViec(opts.tab); if (!opts.dienSan) boHoanThien();
  const lan = ++luotMo;
  khoaBieuMau(true);
  $('klThVanBan').innerHTML = opt('', 'Đang tải văn bản…'); $('klThLoai').innerHTML = opt('', 'Đang tải…');
  datLaiVanBan(); thayMatCu = '';
  try {
    await loadDanhMucKl();
    // Văn bản: trang đầu 50 (B6) + văn bản của việc cha; phạm vi giao theo DB (C3) — hai lời gọi song song (biểu mẫu đang khoá).
    await Promise.all([napVanBan({ nhanMoi: nhanMoi(), giu: '', kem: cha?.van_ban_id }), napPhamVi()]);
    datHomNay(await homNayTheoDb());
  } catch (e) { if (lan === luotMo) { notifyError(e.message); $('giaoViecForm').dataset.sanSang = 'loi'; } return; }   // lỗi: giữ khoá
  if (lan !== luotMo) return;   // đã mở lại biểu mẫu: lượt mới khởi tạo
  const dm = danhMucKl(); const a0 = laA0(); const homNay = getHomNay();
  AN_A0.forEach((id) => show(id, !a0)); anHienTheoDoi();
  setText('gvBuoc1', tuNhanViec() ? 'Người chịu trách nhiệm được báo ngay và việc tính là đã nhận, không cần xác nhận; cần đổi người thì người giao giao lại.' : 'Người chịu trách nhiệm và người theo dõi mỗi người tự xác nhận đã nhận việc trong 1 ngày làm việc; từ chối cần lý do, cấp trên duyệt.');
  show('klThThayMatWrap', canThayMat());
  if (vb.ds.length && !a0) $('klThVanBan').value = vb.ds[0].id;
  if (cha && timTrongDs(cha.van_ban_id)) $('klThVanBan').value = cha.van_ban_id; // giao tiếp xuống: cùng văn bản với việc cha
  setText('gvCha', cha ? `Giao tiếp xuống từ ${cha.ma}: ${cha.noi_dung}` : ''); show('gvCha', Boolean(cha)); $('gvCha').dataset.id = cha?.id || '';
  show('gvLuoiWrap', !cha && !opts.dienSan);   // giao tiếp xuống / hoàn thiện dòng chờ nhập Excel: một việc, không thêm thẻ
  $('klThLoaiVB').innerHTML = LOAI_VAN_BAN.map(([ma, ten]) => opt(ma, ten, ma === 'KL_BTV')).join('');
  $('klThNgayBH').max = homNay; $('klThNgayNhanVB').max = homNay;
  ['klThOwnerTim', 'klThNguoiTheoDoiTim', 'klThThayMatTim'].forEach((id) => { $(id).value = ''; });
  $('klThOwner').innerHTML = ''; dienOwner();
  $('klThNguoiTheoDoi').innerHTML = nguoiTheoDoiOptionsHtml(state.accounts, state.user); $('klThNguoiTheoDoi').value = state.user?.id || '';
  $('klThThayMat').innerHTML = opt('', 'Không — giao thẳng cho chuyên viên') + thayMatOptionsHtml(state.accounts); tim.thayMat?.apLai();
  datLaiNguon();
  $('klThSanPham').innerHTML = opt('', 'Chọn loại sản phẩm') + dm.sanPham.map((s) => opt(s.ma, s.ten)).join('');
  $('klThCapNhan').innerHTML = dm.cap.map((c) => opt(c.ma, c.ten)).join('');
  $('klThCapQD').innerHTML = opt('', 'Chưa xác định') + dm.cap.map((c) => opt(c.ma, c.ten)).join('');
  $('klThNganh').innerHTML = '';
  $('klThLoai').innerHTML = dm.loaiThoiHan.filter((l) => l.cho_phep_tao_moi).map((l) => opt(l.ma, l.ten, l.ma === 'CO_HAN_CU_THE')).join('');
  ['klThNoiDung', 'klThHan', 'klThVanBanTK', 'klThGhiChu', 'klThSoHN', 'klThSoKL', 'klThNgayBH', 'klThNgayNhanVB', 'klThTrichYeu', 'klThSanPhamMoTa'].forEach((id) => { $(id).value = ''; });
  $('klThNgayNhan').value = homNay;
  datDoKhanChinh(a0 ? 'KHAN' : 'THUONG');
  datLaiNhieu();
  dienNganh();
  khoaBieuMau(false);
  capNhatHienThi();
  $('klThNoiDung').focus();
  if (opts.dienSan) await apDienSan(opts.dienSan, { nhanMoi: nhanMoi() });   // hoàn thiện một dòng chờ của lô nhập Excel
  $('giaoViecForm').dataset.sanSang = '1'; // mặc định theo vai (A0 = Khẩn) đã đặt sau khi phiên và danh mục sẵn sàng
}

// Có thẻ thêm: giao nhiều việc một giao dịch (giao_viec_nhieu — dòng 1 = thẻ chính); xong thì mở lại biểu mẫu sạch, văn bản vừa tạo vào danh sách,
// ngăn chi tiết mở việc đầu.
async function luuNhieu() {
  const p = docForm(cha);
  const loiForm = kiemTra(p) || loiNhieu();
  if (loiForm) { notifyError(loiForm); return; }
  const { chung, dong1 } = tachDong(p);
  $('klThLuu').disabled = true;
  try {
    const kq = await giaoViecNhieu(chung, [dong1, ...docDong()]);
    const ma = kq.viec.map((v) => v.ma);
    notifySuccess(`Đã giao ${kq.so} việc: ${ma.slice(0, 5).join(', ')}${ma.length > 5 ? '…' : ''}.`);
    const trichYeu = laMoi() ? $('klThTrichYeu').value.trim() : '';
    if (trichYeu) { try { await datTrichYeuVanBan(kq.van_ban_id, trichYeu); } catch (e) { notifyError(`Đã giao ${kq.so} việc nhưng chưa lưu được trích yếu văn bản: ${e.message}`); } }
    if (chung.van_ban) themVanBanMoi({ id: kq.van_ban_id, ...chung.van_ban, trich_yeu: trichYeu || null }, nhanMoi());
    await openGiaoViec(); await moNhiemVu(kq.viec[0].id, kq.viec[0].ma);
  } catch (e) { notifyError('Không giao được: ' + loiDeHieu(e)); capNhatTomTat(); }
}

async function luu(nhapTiep) {
  if (coThem()) return luuNhieu();
  const p = docForm(cha);
  const loiForm = kiemTra(p);
  if (loiForm) { notifyError(loiForm); return; }
  $('klThLuu').disabled = true;
  try {
    const kq = await giaoViec(p);
    notifySuccess(`Đã giao việc ${kq.ma}.${nhuA0() ? ` Người nhận và Chánh Văn phòng có thông báo${tuNhanViec() ? '' : '; xác nhận nhận việc trong 1 ngày làm việc'}.` : ''}`);
    const trichYeu = laMoi() ? $('klThTrichYeu').value.trim() : '';
    if (trichYeu) { // văn bản vừa tạo (kể cả mốc "Thường trực giao …" của A0): đặt trích yếu; lỗi → báo rõ, việc đã giao vẫn còn
      try { await datTrichYeuVanBan(kq.van_ban_id, trichYeu); } catch (e) { notifyError(`Đã giao việc ${kq.ma} nhưng chưa lưu được trích yếu văn bản: ${e.message}`); }
    }
    if (p.van_ban) themVanBanMoi({ id: kq.van_ban_id, ...p.van_ban, trich_yeu: trichYeu || null }, nhanMoi());
    if (p.dong_nhap_id) { boHoanThien(); await openGiaoViec({ tab: 'cho' }); await moNhiemVu(kq.id, kq.ma); return; }   // dòng chờ đã thành việc
    if (!nhapTiep) { await openGiaoViec(); await moNhiemVu(kq.id, kq.ma); return; } // v9 đợt 2: ở lại Giao việc (biểu mẫu mở lại sạch), việc vừa giao hiện trong ngăn chi tiết
    $('klThVanBan').value = p.van_ban_id || kq.van_ban_id;
    ['klThNoiDung', 'klThHan', 'klThVanBanTK', 'klThGhiChu', 'klThSanPhamMoTa', 'klThPhoiHop'].forEach((id) => { $(id).value = ''; });
    $('klThOwner').value = ''; $('klThSanPham').value = ''; $('klThCapQD').value = ''; dienNganh();
    capNhatHienThi(); window.scrollTo({ top: 0 }); $('klThNoiDung').focus(); $('giaoViecForm').dispatchEvent(new Event('gv-da-giao'));   // v9.js: số đã nhập
  } catch (e) {
    notifyError('Không giao được việc: ' + loiDeHieu(e));
    capNhatTomTat();
  }
}

export function registerGiaoViec() {
  $('viewGiaoViec').innerHTML = giaoViecTemplate;
  ['klThLoaiVB', 'klThLoai', 'klThNgayBH'].forEach((id) => $(id).addEventListener('change', capNhatHienThi));
  $('klThVanBan').addEventListener('change', vanBanDoi);
  $('klThVanBanTim').addEventListener('input', () => timKhiGo(nhanMoi()));   // tự chọn kết quả đầu → phát change của ô văn bản (vanBanDoi, v9)
  $('klThThayMat').addEventListener('change', thayMatDoi);
  $('klThHan').addEventListener('input', capNhatHienThi);
  $('klThNganh').addEventListener('change', dienLinhVuc);
  $('klThLinhVuc').addEventListener('change', dienTheoDoi); $('klThNguon').addEventListener('input', nguonDoi);   // 'input' tới ô trước khi nổi lên form (capNhatTomTat)
  $('klThOwner').addEventListener('change', ownerDoi);
  tim.owner = ganTimChon($('klThOwnerTim'), $('klThOwner')); tim.theoDoi = ganTimChon($('klThNguoiTheoDoiTim'), $('klThNguoiTheoDoi')); tim.thayMat = ganTimChon($('klThThayMatTim'), $('klThThayMat'));
  ganSuKienNhieu();   // ô trong thẻ nhiệm vụ: chuỗi Owner → ngành → lĩnh vực → người theo dõi, hạn theo loại — trước khi nổi lên form
  $('giaoViecForm').addEventListener('input', capNhatTomTat);
  $('giaoViecForm').addEventListener('change', capNhatTomTat);
  registerActions({ openGiaoViec: () => openGiaoViec(), giaoTiepXuong: ({ id }) => openGiaoViec({ cha: timKlRow(id) }),
    huyKlThem: () => openKl(), luuKlThem: () => luu(false), luuKlThemTiep: () => luu(true),
    gvThemDong: () => { themDong(); capNhatTomTat(); }, gvXoaDong: (ds) => { xoaDong(ds); capNhatTomTat(); },
    gvBoHoanThien: () => { boHoanThien(); openGiaoViec({ tab: 'cho' }); },
    gvVbXemThem: () => napVanBan({ them: true, nhanMoi: nhanMoi() }).catch((e) => notifyError(e.message)) });
}
