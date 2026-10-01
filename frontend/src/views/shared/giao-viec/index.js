// Màn hình Giao việc một khối (GĐ22; SPEC GV-2: người giao chỉ thiết lập Owner, Product, Deadline — hệ thống tự điền, cho sửa: ngày nhận, cấp
// nhận, người theo dõi). Dùng chung: A1/A2 (đầy đủ), A3 quan_tri_kl (thêm ô Thay mặt bắt buộc), A0 (bản rút gọn: ẩn người theo dõi, ngày nhận,
// loại hạn, cấp quyết định, ngành/lĩnh vực, ghi chú — DB tự suy; mặc định Khẩn, uu_tien Thường trực; v8 đợt 4: khối 1 văn bản hiện đủ, để trống
// số hiệu + ngày → DB ghi mốc "Thường trực giao …"). Kiểm phía form để báo lỗi sớm; DB là chốt qua giao_viec (0035). Thanh tóm tắt + chấm bước cập
// nhật theo từng ô; "Giao, nhập tiếp" giữ văn bản/ngành/lĩnh vực/loại hạn. Trích yếu văn bản lưu bằng van_ban_dat_trich_yeu (0046) sau giao_viec —
// lỗi thì báo rõ "đã giao nhưng chưa lưu trích yếu". Giao tiếp xuống từ ngăn chi tiết (action giaoTiepXuong): điền sẵn văn bản của việc cha, gửi nhiem_vu_cha.
// PR-2a: ô văn bản tìm ở DB + "Xem thêm" (van-ban.js, B6); Owner / ngành / lĩnh vực lọc theo phạm vi giao của DB (pham-vi.js, C3).
import { $, show, setText, escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { loadDanhMucKl, danhMucKl, linhVucCuaNganh, cauHinhKl, homNayTheoDb, giaoViec, datTrichYeuVanBan } from '../../../lib/kl/du-lieu.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { MOI, vb, timTrongDs, napVanBan, datLaiVanBan, themVanBanMoi, timKhiGo } from './van-ban.js';
import { napPhamVi, phongCuaOwner, locOwner, nganhDuocChon, linhVucDuocChon, thongBaoPhamVi, theoDoiHopLe, locTheoDoi, lanhDaoLoc } from './pham-vi.js';
import { datLaiHanNop, napKhungHanNop, capNhatLyDo, dungNgayGoiY, thieuHanNop, loiHanNop, docHanNop, tomTatHanNop } from './han.js';
import { datLaiNguon, apMacDinhNguon, nguonDoi, thieuNguon, loiNguon, docNguon, docVanBanThem } from './nguon.js';   // PR-3
import { homNayVN, formatNgay, ghiChuHan, congNgay } from '../../../lib/kl/ngay.js';
import { tenDoKhan } from '../../../lib/kl/do-khan.js';
import { setActiveNav, showSection } from '../../shell/index.js';
import { openKl } from '../kl/index.js';
import { napLaiViec } from '../kl/nap-lai-viec.js';
import { timKlRow } from '../kl/danh-sach.js';
import { giaoViecTemplate } from './template.js';
import { ownerOptionsHtml, parseOwner, nguoiTheoDoiOptionsHtml, thayMatOptionsHtml, goiYTheoDoi, LOAI_VAN_BAN, canNganh } from '../kl/them-owner.js';

let homNay = homNayVN();
let cha = null; // việc cha khi giao tiếp xuống (nhiem_vu_cha)
// Lỗi đua (CI #96): trong lúc nạp (mở biểu mẫu, đổi người được thay mặt) mọi ô bị khoá — fieldset#gvKhoa disabled + aria-busy, nút "Giao,
// nhập tiếp" mờ — nên người dùng không chọn được gì để rồi bị bước khởi tạo ghi đè; mở lại biểu mẫu khi lượt trước chưa xong: lượt cũ dừng.
let luotMo = 0;
function khoaBieuMau(khoa) {
  $('gvKhoa').disabled = khoa; $('gvKhoa').setAttribute('aria-busy', String(khoa));
  $('klThLuuTiep').disabled = khoa;
  if (khoa) $('klThLuu').disabled = true;
}
const opt = (v, t, chon = false) => `<option value="${escapeHtml(v)}"${chon ? ' selected' : ''}>${escapeHtml(t)}</option>`;
const laA0 = () => state.user?.role_group === 'A0';
const canThayMat = () => state.user?.role_group === 'A3'; // người giao không phải lãnh đạo (giữ quan_tri_kl) → giao thay mặt
const AN_A0 = ['klThNguoiTheoDoiWrap', 'gvGoiYCanBo', 'klThCapQDWrap', 'gvPhuWrap', 'klThLuuTiep'];
// A0 với văn bản kết luận / thông báo: giao_viec bắt buộc ngành + lĩnh vực (và ngày nhận, loại hạn như A1) → hiện các ô này theo loại văn bản.
const THEO_LOAI_A0 = ['gvNganhWrap', 'klThNgayNhanWrap', 'klThLoaiWrap'];
const canNganhHienTai = () => canNganh(loaiVanBan());
const canNgayNhan = () => !laA0() || canNganhHienTai();

const vanBanChon = () => timTrongDs($('klThVanBan').value);
const nhanMoi = () => (laA0() ? 'Văn bản mới hoặc giao trực tiếp…' : 'Văn bản giao việc mới…');
const phongOwner = () => phongCuaOwner($('klThOwner').value, danhMucKl(), state.accounts);
const laMoi = () => $('klThVanBan').value === MOI;
// A0 chọn "mới" mà để trống cả số hiệu lẫn ngày → giao không kèm văn bản (DB ghi mốc); vai khác bắt buộc đủ số hiệu + ngày.
const vbTrong = () => laA0() && laMoi() && !$('klThSoKL').value.trim() && !$('klThNgayBH').value;
// Các điều kiện khối 1 khớp kiemTra(): số hiệu + ngày ban hành (không ở tương lai) + số hội nghị nếu Kết luận BTV.
const thieuSoHN = () => laMoi() && !vbTrong() && $('klThLoaiVB').value === 'KL_BTV' && !$('klThSoHN').value;
const bhTuongLai = () => laMoi() && Boolean($('klThNgayBH').value) && $('klThNgayBH').value > homNay;
const vanBanOk = () => (laMoi() ? vbTrong() || (Boolean($('klThSoKL').value.trim() && $('klThNgayBH').value) && !thieuSoHN() && !bhTuongLai()) : Boolean($('klThVanBan').value));
const hanTruocBH = () => Boolean($('klThHan').value && ngayBH()) && $('klThHan').value < ngayBH();
const ngayBH = () => (laMoi() ? $('klThNgayBH').value : vanBanChon()?.ngay_ban_hanh) || '';
// Loại văn bản đang áp dụng; A0 để trống văn bản → DB tạo văn bản KHAC (mốc giao) nên không đòi ngành/lĩnh vực.
const loaiVanBan = () => (laMoi() ? (vbTrong() ? 'KHAC' : $('klThLoaiVB').value) : vanBanChon()?.loai) || 'KHAC';
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
}

function capNhatHienThi() {
  const loai = $('klThLoai').value;
  const bh = ngayBH();
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
  napKhungHanNop({ han: loai === 'KY_BAN_HANH' ? null : $('klThHan').value, ngayBH: bh, loai }, capNhatTomTat);
  capNhatNganh();
  capNhatTomTat();
}
// Bắt buộc động theo loại văn bản (canNganh): kết luận / thông báo → dấu *; còn lại → chú thích "không bắt buộc".
function capNhatNganh() {
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
function vanBanDoi() { $('klThNgayNhan').value = vanBanChon()?.ngay_nhan || homNay; capNhatHienThi(); }
// Người quản trị KL đổi lãnh đạo được thay mặt → phạm vi của người đó; lọc lại Owner / ngành / lĩnh vực.
// Khoá biểu mẫu trong lúc đọc phạm vi; đọc lỗi → trả ô Thay mặt về người cũ (phạm vi đang áp là của người cũ).
let thayMatCu = '';
async function thayMatDoi() {
  khoaBieuMau(true);
  try { await napPhamVi($('klThThayMat').value || null); thayMatCu = $('klThThayMat').value; } catch (e) { notifyError(e.message); $('klThThayMat').value = thayMatCu; }
  khoaBieuMau(false);
  dienOwner(); dienNganh(); capNhatTomTat();
}
function dienOwner() {
  const cu = $('klThOwner').value;
  $('klThOwner').innerHTML = ownerOptionsHtml(danhMucKl(), state.accounts, state.user);
  locOwner($('klThOwner'), danhMucKl(), state.accounts);
  if ([...$('klThOwner').options].some((o) => o.value === cu)) $('klThOwner').value = cu;
}
function ownerDoi() {
  dienNganh();
  const { capMacDinh } = parseOwner($('klThOwner').value, danhMucKl(), state.accounts);
  if (capMacDinh) $('klThCapNhan').value = capMacDinh;
  const goiY = goiYTheoDoi($('klThOwner').value, danhMucKl(), state.accounts, state.user);
  if (goiY && $('klThNguoiTheoDoi').querySelector(`option[value="${goiY}"]`)) $('klThNguoiTheoDoi').value = goiY;
  capNhatTomTat();
}

// Ba phần đã điền đủ chưa → chấm sáng; đủ cả ba → nút Giao sáng; thanh tóm tắt đọc lại các ô.
export function trangThaiPhan() {
  const p1 = vanBanOk() && !thieuNguon(); // v8: khối 1 = văn bản (+ nguồn, PR-3); khối 2 = nội dung + người
  const p2 = Boolean($('klThNoiDung').value.trim()) && Boolean($('klThOwner').value) && (laA0() || Boolean($('klThNguoiTheoDoi').value)) && (!canThayMat() || Boolean($('klThThayMat').value));
  const p3 = Boolean($('klThSanPham').value) && ($('klThLoai').value === 'KY_BAN_HANH' || Boolean($('klThHan').value)) && !hanTruocBH() && (!canNgayNhan() || Boolean($('klThNgayNhan').value))
    && (!canNganhHienTai() || (Boolean($('klThNganh').value) && Boolean($('klThLinhVuc').value))) && !phamViThieu().thieu && !theoDoiNgoaiPhamVi() && !thieuHanNop().length;
  return [p1, p2, p3];
}
// Các yếu tố bắt buộc còn thiếu (theo thứ tự khối) — dòng "Còn thiếu: …" cạnh nút Giao việc.
function conThieu() {
  return [[thieuSoHN(), 'số hội nghị'], [bhTuongLai(), 'ngày ban hành không ở tương lai'], [!vanBanOk() && !thieuSoHN() && !bhTuongLai(), 'văn bản'], [thieuNguon(), 'nguồn nhiệm vụ'],
    [!$('klThNoiDung').value.trim(), 'nội dung'], [!$('klThOwner').value, 'người chịu trách nhiệm'],
    [!laA0() && !$('klThNguoiTheoDoi').value, 'người theo dõi'], [canThayMat() && !$('klThThayMat').value, 'thay mặt'], [!$('klThSanPham').value, 'sản phẩm'],
    [$('klThLoai').value !== 'KY_BAN_HANH' && !$('klThHan').value, 'hạn hoàn thành'], [hanTruocBH(), 'hạn sau ngày ban hành'], [canNgayNhan() && !$('klThNgayNhan').value, 'ngày nhận văn bản'],
    [canNganhHienTai() && !$('klThNganh').value, 'ngành'], [canNganhHienTai() && !$('klThLinhVuc').value, 'lĩnh vực'],
    [Boolean(phamViThieu().thieu), phamViThieu().thieu], [theoDoiNgoaiPhamVi(), 'người theo dõi thuộc phòng, lĩnh vực đồng chí phụ trách']].filter(([t]) => t).map(([, n]) => n)
    .concat(thieuHanNop());
}
function capNhatTomTat() {
  apMacDinhNguon(loaiVanBan());   // PR-3: nguồn theo loại văn bản đang áp dụng (mới hoặc có sẵn) cho tới khi người dùng tự chọn
  if (laA0()) { THEO_LOAI_A0.forEach((id) => show(id, canNganhHienTai())); capNhatNganh(); } // theo từng ô gõ (số hiệu / ngày / loại văn bản)
  capNhatLyDo();
  const [p1, p2, p3] = trangThaiPhan();
  [p1, p2, p3].forEach((ok, i) => $(`gvCham${i + 1}`).classList.toggle('xong', ok));
  $('klThLuu').disabled = !(p1 && p2 && p3);
  const owner = $('klThOwner').selectedOptions[0]?.text || '…'; const sp = $('klThSanPham').selectedOptions[0]?.text || '…';
  const nd = $('klThNoiDung').value.trim(); const han = $('klThHan').value ? formatNgay($('klThHan').value) : '…';
  setText('gvTomTatChu', `Giao "${nd ? nd.slice(0, 60) + (nd.length > 60 ? '…' : '') : '…'}" cho ${$('klThOwner').value ? owner : '…'}, hạn ${han}${tomTatHanNop()}, sản phẩm ${$('klThSanPham').value ? sp : '…'}, độ khẩn ${tenDoKhan($('klThDoKhan').value)}`);
  const thieu = conThieu(); setText('gvConThieu', thieu.length ? `Còn thiếu: ${thieu.join(', ')}` : '');
  setText('gvPhamViGhiChu', phamViThieu().chuThich || 'theo ngành đã chọn');
  // Xem trước thẻ việc (cột phụ) đọc lại các ô
  setText('gvXtDoKhan', tenDoKhan($('klThDoKhan').value)); $('gvXtDoKhan').className = `tag ${['THUONG_KHAN', 'HOA_TOC'].includes($('klThDoKhan').value) ? 'do' : $('klThDoKhan').value === 'KHAN' ? 'vang' : ''}`;
  setText('gvXtNoiDung', nd || 'Nội dung nhiệm vụ…');
  setText('gvXtPhu', `Chủ trì ${$('klThOwner').value ? owner : '…'} · hạn ${han} · sản phẩm ${$('klThSanPham').value ? sp : '…'}`);
}

export async function openGiaoViec(opts = {}) {
  cha = opts.cha || null;
  showSection('viewGiaoViec');
  $('giaoViecForm').removeAttribute('data-san-sang'); // đang khởi tạo theo vai/dữ liệu — spec chờ cờ này trước khi đọc ô
  setActiveNav('navGiaoViec');
  const lan = ++luotMo;
  khoaBieuMau(true);
  $('klThVanBan').innerHTML = opt('', 'Đang tải văn bản…'); $('klThLoai').innerHTML = opt('', 'Đang tải…');
  datLaiVanBan(); thayMatCu = '';
  try {
    await loadDanhMucKl();
    // Văn bản: trang đầu 50 (B6) + văn bản của việc cha; phạm vi giao theo DB (C3) — hai lời gọi song song (biểu mẫu đang khoá).
    await Promise.all([napVanBan({ nhanMoi: nhanMoi(), giu: '', kem: cha?.van_ban_id }), napPhamVi()]);
    homNay = (await homNayTheoDb()) || homNayVN();
  } catch (e) { if (lan === luotMo) { notifyError(e.message); $('giaoViecForm').dataset.sanSang = 'loi'; } return; }   // lỗi: giữ khoá
  if (lan !== luotMo) return;   // đã mở lại biểu mẫu: lượt mới khởi tạo
  const dm = danhMucKl(); const a0 = laA0();
  AN_A0.forEach((id) => show(id, !a0));
  show('klThThayMatWrap', canThayMat());
  if (vb.ds.length && !a0) $('klThVanBan').value = vb.ds[0].id;
  if (cha && timTrongDs(cha.van_ban_id)) $('klThVanBan').value = cha.van_ban_id; // giao tiếp xuống: cùng văn bản với việc cha
  setText('gvCha', cha ? `Giao tiếp xuống từ ${cha.ma}: ${cha.noi_dung}` : ''); show('gvCha', Boolean(cha));
  $('klThLoaiVB').innerHTML = LOAI_VAN_BAN.map(([ma, ten]) => opt(ma, ten, ma === 'KL_BTV')).join('');
  $('klThNgayBH').max = homNay; $('klThNgayNhanVB').max = homNay;
  $('klThOwner').innerHTML = ''; dienOwner();
  $('klThNguoiTheoDoi').innerHTML = nguoiTheoDoiOptionsHtml(state.accounts, state.user); $('klThNguoiTheoDoi').value = state.user?.id || '';
  $('klThThayMat').innerHTML = opt('', 'Chọn lãnh đạo được thay mặt') + thayMatOptionsHtml(state.accounts);
  datLaiHanNop(); datLaiNguon();
  $('klThSanPham').innerHTML = opt('', 'Chọn loại sản phẩm') + dm.sanPham.map((s) => opt(s.ma, s.ten)).join('');
  $('klThCapNhan').innerHTML = dm.cap.map((c) => opt(c.ma, c.ten)).join('');
  $('klThCapQD').innerHTML = opt('', 'Chưa xác định') + dm.cap.map((c) => opt(c.ma, c.ten)).join('');
  $('klThNganh').innerHTML = '';
  $('klThLoai').innerHTML = dm.loaiThoiHan.filter((l) => l.cho_phep_tao_moi).map((l) => opt(l.ma, l.ten, l.ma === 'CO_HAN_CU_THE')).join('');
  ['klThNoiDung', 'klThHan', 'klThVanBanTK', 'klThGhiChu', 'klThSoHN', 'klThSoKL', 'klThNgayBH', 'klThNgayNhanVB', 'klThTrichYeu', 'klThSanPhamMoTa'].forEach((id) => { $(id).value = ''; });
  $('klThNgayNhan').value = homNay;
  $('klThDoKhan').value = a0 ? 'KHAN' : 'THUONG';
  $('giaoViecForm').querySelectorAll('.dk-chon button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.giaTri === $('klThDoKhan').value)));
  dienNganh();
  khoaBieuMau(false);
  capNhatHienThi();
  $('klThNoiDung').focus();
  $('giaoViecForm').dataset.sanSang = '1'; // mặc định theo vai (A0 = Khẩn) đã đặt sau khi phiên và danh mục sẵn sàng
}

// Kiểm tra phía form (cùng quy tắc với giao_viec); trả về chuỗi lỗi hoặc null.
function kiemTra(p) {
  if (p.van_ban) {
    if (!p.van_ban.so_ket_luan || !p.van_ban.ngay_ban_hanh) return 'Văn bản mới phải có số hiệu và ngày ban hành.';
    if (p.van_ban.loai === 'KL_BTV' && !p.van_ban.so_hoi_nghi) return 'Kết luận Ban Thường vụ phải có số hội nghị.';
    if (p.van_ban.ngay_ban_hanh > homNay) return 'Ngày ban hành ở tương lai — kiểm tra lại năm.';
  } else if (!p.van_ban_id && !laA0()) return 'Chọn văn bản giao việc hoặc nhập văn bản mới.';
  if (!p.noi_dung) return 'Nhập nội dung nhiệm vụ.';
  if (!p.owner_don_vi_ma) return 'Chọn đơn vị hoặc cán bộ chịu trách nhiệm — mỗi việc đúng một Owner.';
  if (canThayMat() && !p.thay_mat_cho) return 'Chọn lãnh đạo mà đồng chí giao thay mặt — lãnh đạo đó là cấp duyệt nếu việc bị từ chối.';
  if (!p.san_pham_loai) return 'Chọn loại sản phẩm đầu ra — mỗi việc phải định nghĩa sản phẩm ngay từ đầu.';
  if (canNgayNhan() && !p.ngay_nhan_van_ban) return 'Nhập ngày nhận văn bản (mốc bắt đầu đếm).';
  if (p.loai_thoi_han_ma === 'CO_HAN_CU_THE' && !p.han_xu_ly) return 'Nhập hạn hoàn thành — mỗi việc phải có một hạn cụ thể.';
  if (p.han_xu_ly && ngayBH() && p.han_xu_ly < ngayBH()) return `Hạn không được trước ngày ban hành (${formatNgay(ngayBH())}). Chọn lại ngày.`;
  if (canNganhHienTai() && (!p.nganh_ma || !p.linh_vuc_ma)) return 'Chọn ngành và lĩnh vực (bắt buộc với việc từ kết luận / thông báo).';
  if (!laA0() && !p.nguoi_theo_doi) return 'Chọn người theo dõi (cán bộ Văn phòng).';
  return loiNguon() || loiHanNop();
}

function docForm() {
  const owner = parseOwner($('klThOwner').value, danhMucKl(), state.accounts);
  const p = {
    noi_dung: $('klThNoiDung').value.trim(), owner_don_vi_ma: owner.owner_don_vi_ma, owner_tai_khoan: owner.owner_tai_khoan, do_khan: $('klThDoKhan').value,
    san_pham_loai: $('klThSanPham').value || null, san_pham_mo_ta: $('klThSanPhamMoTa').value.trim() || null,
    han_xu_ly: $('klThLoai').value === 'KY_BAN_HANH' ? null : $('klThHan').value || null, cap_nhan_san_pham: $('klThCapNhan').value || null, theo_1400: true,
    ...docHanNop(), ...docNguon(),
  };
  if (canThayMat()) p.thay_mat_cho = $('klThThayMat').value || null;
  if (cha) p.nhiem_vu_cha = cha.id;
  if (laA0()) {   // A0: DB tự suy người theo dõi, đặt uu_tien Thường trực; văn bản: đã điền → như vai khác, để trống → DB ghi mốc giao
    if (laMoi() && !vbTrong()) p.van_ban = vanBanMoi(); else if (!laMoi()) p.van_ban_id = $('klThVanBan').value;
    if (canNganhHienTai()) Object.assign(p, { nganh_ma: $('klThNganh').value || null, linh_vuc_ma: $('klThLinhVuc').value || null, ngay_nhan_van_ban: $('klThNgayNhan').value || null, loai_thoi_han_ma: $('klThLoai').value });
    return p;
  }
  Object.assign(p, {
    ngay_nhan_van_ban: $('klThNgayNhan').value || null, loai_thoi_han_ma: $('klThLoai').value, cap_quyet_dinh: $('klThCapQD').value || null,
    nganh_ma: $('klThNganh').value || null, linh_vuc_ma: $('klThLinhVuc').value || null, nguoi_theo_doi: $('klThNguoiTheoDoi').value || null,
    van_ban_trien_khai: $('klThVanBanTK').value.trim() || null, linh_vuc_chi_tiet: $('klThGhiChu').value.trim() || null,
  });
  if (laMoi()) p.van_ban = vanBanMoi(); else p.van_ban_id = $('klThVanBan').value;
  return p;
}
const vanBanMoi = () => ({ loai: $('klThLoaiVB').value, so_hoi_nghi: Number($('klThSoHN').value) || null, so_ket_luan: $('klThSoKL').value.trim(),
  ngay_ban_hanh: $('klThNgayBH').value, ngay_nhan: $('klThNgayNhanVB').value || null, ...docVanBanThem() });

async function luu(nhapTiep) {
  const p = docForm();
  const loiForm = kiemTra(p);
  if (loiForm) { notifyError(loiForm); return; }
  $('klThLuu').disabled = true;
  try {
    const kq = await giaoViec(p);
    notifySuccess(`Đã giao việc ${kq.ma}.${laA0() ? ' Người nhận và Chánh Văn phòng có thông báo; xác nhận nhận việc trong 1 ngày làm việc.' : ''}`);
    const trichYeu = laMoi() ? $('klThTrichYeu').value.trim() : '';
    if (trichYeu) { // văn bản vừa tạo (kể cả mốc "Thường trực giao …" của A0): đặt trích yếu; lỗi → báo rõ, việc đã giao vẫn còn
      try { await datTrichYeuVanBan(kq.van_ban_id, trichYeu); } catch (e) { notifyError(`Đã giao việc ${kq.ma} nhưng chưa lưu được trích yếu văn bản: ${e.message}`); }
    }
    if (p.van_ban) themVanBanMoi({ id: kq.van_ban_id, ...p.van_ban, trich_yeu: trichYeu || null }, nhanMoi());
    if (!nhapTiep) { await napLaiViec(kq.id); openKl({ tuKhoa: kq.ma }); return; } // dòng vừa giao vào bộ nhớ danh sách trước → hiện ngay, không chờ nạp cả danh sách
    $('klThVanBan').value = p.van_ban_id || kq.van_ban_id;
    ['klThNoiDung', 'klThHan', 'klThVanBanTK', 'klThGhiChu', 'klThSanPhamMoTa', 'klThPhoiHop'].forEach((id) => { $(id).value = ''; });
    $('klThOwner').value = ''; $('klThSanPham').value = ''; $('klThCapQD').value = ''; datLaiHanNop(); dienNganh();
    capNhatHienThi(); window.scrollTo({ top: 0 }); $('klThNoiDung').focus();
  } catch (e) {
    notifyError('Không giao được việc: ' + loiDeHieu(e));
    capNhatTomTat();
  }
}

export function registerGiaoViec() {
  $('viewGiaoViec').innerHTML = giaoViecTemplate;
  ['klThLoaiVB', 'klThLoai', 'klThNgayBH'].forEach((id) => $(id).addEventListener('change', capNhatHienThi));
  $('klThVanBan').addEventListener('change', vanBanDoi);
  $('klThVanBanTim').addEventListener('input', () => timKhiGo(nhanMoi(), vanBanDoi));
  $('klThThayMat').addEventListener('change', thayMatDoi);
  $('klThHan').addEventListener('input', capNhatHienThi);
  $('klThNganh').addEventListener('change', dienLinhVuc);
  $('klThLinhVuc').addEventListener('change', dienTheoDoi); $('klThNguon').addEventListener('input', nguonDoi);   // 'input' tới ô trước khi nổi lên form (capNhatTomTat)
  $('klThOwner').addEventListener('change', ownerDoi);
  $('giaoViecForm').addEventListener('input', capNhatTomTat);
  $('giaoViecForm').addEventListener('change', capNhatTomTat);
  registerActions({ openGiaoViec: () => openGiaoViec(), giaoTiepXuong: ({ id }) => openGiaoViec({ cha: timKlRow(id) }),
    huyKlThem: () => openKl(), luuKlThem: () => luu(false), luuKlThemTiep: () => luu(true), gvDungHanNop: () => { dungNgayGoiY(); capNhatTomTat(); },
    gvVbXemThem: () => napVanBan({ them: true, nhanMoi: nhanMoi() }).catch((e) => notifyError(e.message)) });
}
