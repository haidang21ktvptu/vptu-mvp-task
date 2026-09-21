// Màn hình Giao việc một khối (GĐ22; SPEC GV-2: người giao chỉ thiết lập Owner, Product, Deadline — hệ thống tự điền, cho sửa: ngày nhận, cấp
// nhận, người theo dõi). Dùng chung: A1/A2 (đầy đủ), A3 quan_tri_kl (thêm ô Thay mặt bắt buộc), A0 (bản rút gọn: ẩn người theo dõi, ngày nhận,
// loại hạn, cấp quyết định, ngành/lĩnh vực, ghi chú — DB tự suy; mặc định Khẩn, uu_tien Thường trực; v8 đợt 4: khối 1 văn bản hiện đủ, để trống
// số hiệu + ngày → DB ghi mốc "Thường trực giao …"). Kiểm phía form để báo lỗi sớm; DB là chốt qua giao_viec (0035). Thanh tóm tắt + chấm bước cập
// nhật theo từng ô; "Giao, nhập tiếp" giữ văn bản/ngành/lĩnh vực/loại hạn. Trích yếu văn bản lưu bằng van_ban_dat_trich_yeu (0046) sau giao_viec —
// lỗi thì báo rõ "đã giao nhưng chưa lưu trích yếu". Giao tiếp xuống từ ngăn chi tiết (action giaoTiepXuong): điền sẵn văn bản của việc cha, gửi nhiem_vu_cha.
import { $, show, setText, escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { loadDanhMucKl, danhMucKl, linhVucCuaNganh, cauHinhKl, homNayTheoDb, loadVanBan, giaoViec, datTrichYeuVanBan } from '../../../lib/kl/du-lieu.js';
import { homNayVN, formatNgay, ghiChuHan, congNgay } from '../../../lib/kl/ngay.js';
import { tenDoKhan } from '../../../lib/kl/do-khan.js';
import { setActiveNav, showSection } from '../../shell/index.js';
import { openKl } from '../kl/index.js';
import { napLaiViec } from '../kl/nap-lai-viec.js';
import { timKlRow } from '../kl/danh-sach.js';
import { giaoViecTemplate } from './template.js';
import { ownerOptionsHtml, parseOwner, nguoiTheoDoiOptionsHtml, thayMatOptionsHtml, goiYTheoDoi, LOAI_VAN_BAN, tenLoaiVanBan, canNganh } from '../kl/them-owner.js';

let vanBan = [];
let homNay = homNayVN();
let cha = null; // việc cha khi giao tiếp xuống (nhiem_vu_cha)
const MOI = '__moi__';
const opt = (v, t, chon = false) => `<option value="${escapeHtml(v)}"${chon ? ' selected' : ''}>${escapeHtml(t)}</option>`;
const laA0 = () => state.user?.role_group === 'A0';
const canThayMat = () => state.user?.role_group === 'A3'; // người giao không phải lãnh đạo (giữ quan_tri_kl) → giao thay mặt
const AN_A0 = ['klThNguoiTheoDoiWrap', 'gvGoiYCanBo', 'klThNgayNhanWrap', 'klThLoaiWrap', 'klThCapQDWrap', 'gvNganhWrap', 'gvPhuWrap', 'klThLuuTiep'];

const vanBanChon = () => vanBan.find((h) => h.id === $('klThVanBan').value);
const laMoi = () => $('klThVanBan').value === MOI;
// A0 chọn "mới" mà để trống cả số hiệu lẫn ngày → giao không kèm văn bản (DB ghi mốc); vai khác bắt buộc đủ số hiệu + ngày.
const vbTrong = () => laA0() && laMoi() && !$('klThSoKL').value.trim() && !$('klThNgayBH').value;
const vanBanOk = () => (laMoi() ? vbTrong() || Boolean($('klThSoKL').value.trim() && $('klThNgayBH').value) : Boolean($('klThVanBan').value));
const ngayBH = () => (laMoi() ? $('klThNgayBH').value : vanBanChon()?.ngay_ban_hanh) || '';
const loaiVanBan = () => (laMoi() ? $('klThLoaiVB').value : vanBanChon()?.loai) || 'KHAC';
const nhanVanBan = (h) => `${tenLoaiVanBan(h.loai)} · ${h.so_hoi_nghi ? `HN ${h.so_hoi_nghi} · ` : ''}${h.so_ket_luan} · BH ${formatNgay(h.ngay_ban_hanh)}${h.trich_yeu ? ` · ${h.trich_yeu.slice(0, 60)}` : ''}`;

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
    setText('klThHanLoai', `(tự tính = ngày ban hành + ${cauHinhKl('ky_ban_hanh_ngay', 10)})`);
  } else {
    $('klThHan').disabled = false;
    setText('klThHanLoai', '(bắt buộc)');
  }
  setText('klThHanGhiChu', $('klThHan').value ? ghiChuHan($('klThHan').value, homNay) : '');
  setText('klThNganhGhiChu', canNganh(loaiVanBan()) ? '(bắt buộc với kết luận / thông báo)' : '(không bắt buộc với loại văn bản này)');
  capNhatTomTat();
}
function dienLinhVuc() {
  $('klThLinhVuc').innerHTML = opt('', 'Chọn lĩnh vực') + linhVucCuaNganh($('klThNganh').value).map((l) => opt(l.ma, l.ten)).join('');
}
function vanBanDoi() { $('klThNgayNhan').value = vanBanChon()?.ngay_nhan || homNay; capNhatHienThi(); }
// Ô chọn văn bản có tìm: ẩn option không khớp từ khoá (giữ "Văn bản mới…"), tự chọn kết quả đầu.
function locVanBan() {
  const kw = $('klThVanBanTim').value.trim().toLowerCase();
  let dau = null;
  [...$('klThVanBan').options].forEach((o) => { const khop = o.value === MOI || !kw || o.text.toLowerCase().includes(kw); o.hidden = !khop; if (khop && o.value !== MOI && !dau) dau = o; });
  if (kw && dau) { $('klThVanBan').value = dau.value; vanBanDoi(); }
}
function ownerDoi() {
  const { capMacDinh } = parseOwner($('klThOwner').value, danhMucKl(), state.accounts);
  if (capMacDinh) $('klThCapNhan').value = capMacDinh;
  const goiY = goiYTheoDoi($('klThOwner').value, danhMucKl(), state.accounts, state.user);
  if (goiY && $('klThNguoiTheoDoi').querySelector(`option[value="${goiY}"]`)) $('klThNguoiTheoDoi').value = goiY;
  capNhatTomTat();
}

// Ba phần đã điền đủ chưa → chấm sáng; đủ cả ba → nút Giao sáng; thanh tóm tắt đọc lại các ô.
export function trangThaiPhan() {
  const p1 = vanBanOk(); // v8: khối 1 = văn bản; khối 2 = nội dung + người
  const p2 = Boolean($('klThNoiDung').value.trim()) && Boolean($('klThOwner').value) && (laA0() || Boolean($('klThNguoiTheoDoi').value)) && (!canThayMat() || Boolean($('klThThayMat').value));
  const p3 = Boolean($('klThSanPham').value) && ($('klThLoai').value === 'KY_BAN_HANH' || Boolean($('klThHan').value)) && (laA0() || Boolean($('klThNgayNhan').value));
  return [p1, p2, p3];
}
// Các yếu tố bắt buộc còn thiếu (theo thứ tự khối) — dòng "Còn thiếu: …" cạnh nút Giao việc.
function conThieu() {
  return [[!vanBanOk(), 'văn bản'], [!$('klThNoiDung').value.trim(), 'nội dung'], [!$('klThOwner').value, 'người chịu trách nhiệm'],
    [!laA0() && !$('klThNguoiTheoDoi').value, 'người theo dõi'], [canThayMat() && !$('klThThayMat').value, 'thay mặt'], [!$('klThSanPham').value, 'sản phẩm'],
    [$('klThLoai').value !== 'KY_BAN_HANH' && !$('klThHan').value, 'hạn hoàn thành'], [!laA0() && !$('klThNgayNhan').value, 'ngày nhận văn bản']].filter(([t]) => t).map(([, n]) => n);
}
function capNhatTomTat() {
  const [p1, p2, p3] = trangThaiPhan();
  [p1, p2, p3].forEach((ok, i) => $(`gvCham${i + 1}`).classList.toggle('xong', ok));
  $('klThLuu').disabled = !(p1 && p2 && p3);
  const owner = $('klThOwner').selectedOptions[0]?.text || '…'; const sp = $('klThSanPham').selectedOptions[0]?.text || '…';
  const nd = $('klThNoiDung').value.trim(); const han = $('klThHan').value ? formatNgay($('klThHan').value) : '…';
  setText('gvTomTatChu', `Giao "${nd ? nd.slice(0, 60) + (nd.length > 60 ? '…' : '') : '…'}" cho ${$('klThOwner').value ? owner : '…'}, hạn ${han}, sản phẩm ${$('klThSanPham').value ? sp : '…'}, độ khẩn ${tenDoKhan($('klThDoKhan').value)}`);
  const thieu = conThieu(); setText('gvConThieu', thieu.length ? `Còn thiếu: ${thieu.join(', ')}` : '');
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
  $('klThVanBan').innerHTML = opt('', 'Đang tải văn bản…'); $('klThLoai').innerHTML = opt('', 'Đang tải…');
  $('klThLuu').disabled = true;
  try { await loadDanhMucKl(); vanBan = await loadVanBan(); } catch (e) { notifyError(e.message); $('giaoViecForm').dataset.sanSang = 'loi'; return; }
  homNay = (await homNayTheoDb()) || homNayVN();
  const dm = danhMucKl(); const a0 = laA0();
  AN_A0.forEach((id) => show(id, !a0));
  show('klThThayMatWrap', canThayMat());
  $('klThVanBan').innerHTML = opt(MOI, a0 ? 'Văn bản mới hoặc giao trực tiếp…' : 'Văn bản giao việc mới…') + vanBan.map((h) => opt(h.id, nhanVanBan(h))).join('');
  if (vanBan.length && !a0) $('klThVanBan').value = vanBan[0].id;
  if (cha && vanBan.some((h) => h.id === cha.van_ban_id)) $('klThVanBan').value = cha.van_ban_id; // giao tiếp xuống: cùng văn bản với việc cha
  setText('gvCha', cha ? `Giao tiếp xuống từ ${cha.ma}: ${cha.noi_dung}` : ''); show('gvCha', Boolean(cha));
  $('klThVanBanTim').value = '';
  $('klThLoaiVB').innerHTML = LOAI_VAN_BAN.map(([ma, ten]) => opt(ma, ten, ma === 'KL_BTV')).join('');
  $('klThNgayBH').max = homNay; $('klThNgayNhanVB').max = homNay;
  $('klThOwner').innerHTML = ownerOptionsHtml(dm, state.accounts, state.user);
  $('klThNguoiTheoDoi').innerHTML = nguoiTheoDoiOptionsHtml(state.accounts, state.user);
  $('klThThayMat').innerHTML = opt('', 'Chọn lãnh đạo được thay mặt') + thayMatOptionsHtml(state.accounts);
  $('klThSanPham').innerHTML = opt('', 'Chọn loại sản phẩm') + dm.sanPham.map((s) => opt(s.ma, s.ten)).join('');
  $('klThCapNhan').innerHTML = dm.cap.map((c) => opt(c.ma, c.ten)).join('');
  $('klThCapQD').innerHTML = opt('', 'Chưa xác định') + dm.cap.map((c) => opt(c.ma, c.ten)).join('');
  $('klThNganh').innerHTML = opt('', 'Chọn ngành') + dm.nganh.map((n) => opt(n.ma, n.ten)).join('');
  $('klThLoai').innerHTML = dm.loaiThoiHan.filter((l) => l.cho_phep_tao_moi).map((l) => opt(l.ma, l.ten, l.ma === 'CO_HAN_CU_THE')).join('');
  ['klThNoiDung', 'klThHan', 'klThVanBanTK', 'klThGhiChu', 'klThSoHN', 'klThSoKL', 'klThNgayBH', 'klThNgayNhanVB', 'klThTrichYeu', 'klThSanPhamMoTa'].forEach((id) => { $(id).value = ''; });
  $('klThNgayNhan').value = homNay;
  $('klThDoKhan').value = a0 ? 'KHAN' : 'THUONG';
  $('giaoViecForm').querySelectorAll('.dk-chon button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.giaTri === $('klThDoKhan').value)));
  dienLinhVuc();
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
  if (!laA0() && !p.ngay_nhan_van_ban) return 'Nhập ngày nhận văn bản (mốc bắt đầu đếm).';
  if (p.loai_thoi_han_ma === 'CO_HAN_CU_THE' && !p.han_xu_ly) return 'Nhập hạn hoàn thành — mỗi việc phải có một hạn cụ thể.';
  if (p.han_xu_ly && ngayBH() && p.han_xu_ly < ngayBH()) return `Hạn không được trước ngày ban hành (${formatNgay(ngayBH())}). Chọn lại ngày.`;
  if (!laA0() && canNganh(loaiVanBan()) && (!p.nganh_ma || !p.linh_vuc_ma)) return 'Chọn ngành và lĩnh vực (bắt buộc với việc từ kết luận / thông báo).';
  if (!laA0() && !p.nguoi_theo_doi) return 'Chọn người theo dõi (cán bộ Văn phòng).';
  return null;
}

function docForm() {
  const owner = parseOwner($('klThOwner').value, danhMucKl(), state.accounts);
  const p = {
    noi_dung: $('klThNoiDung').value.trim(), owner_don_vi_ma: owner.owner_don_vi_ma, owner_tai_khoan: owner.owner_tai_khoan, do_khan: $('klThDoKhan').value,
    san_pham_loai: $('klThSanPham').value || null, san_pham_mo_ta: $('klThSanPhamMoTa').value.trim() || null,
    han_xu_ly: $('klThLoai').value === 'KY_BAN_HANH' ? null : $('klThHan').value || null, cap_nhan_san_pham: $('klThCapNhan').value || null, theo_1400: true,
  };
  if (canThayMat()) p.thay_mat_cho = $('klThThayMat').value || null;
  if (cha) p.nhiem_vu_cha = cha.id;
  if (laA0()) {   // A0: DB tự suy người theo dõi, đặt uu_tien Thường trực; văn bản: đã điền → như vai khác, để trống → DB ghi mốc giao
    if (laMoi() && !vbTrong()) p.van_ban = vanBanMoi(); else if (!laMoi()) p.van_ban_id = $('klThVanBan').value;
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
  ngay_ban_hanh: $('klThNgayBH').value, ngay_nhan: $('klThNgayNhanVB').value || null });

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
    if (p.van_ban) {
      const vb = { id: kq.van_ban_id, ...p.van_ban, trich_yeu: trichYeu || null };
      vanBan.unshift(vb);
      $('klThVanBan').insertAdjacentHTML('afterbegin', opt(vb.id, nhanVanBan(vb)));
    }
    if (!nhapTiep) { await napLaiViec(kq.id); openKl({ tuKhoa: kq.ma }); return; } // dòng vừa giao vào bộ nhớ danh sách trước → hiện ngay, không chờ nạp cả danh sách
    $('klThVanBan').value = p.van_ban_id || kq.van_ban_id;
    ['klThNoiDung', 'klThHan', 'klThVanBanTK', 'klThGhiChu', 'klThSanPhamMoTa'].forEach((id) => { $(id).value = ''; });
    $('klThOwner').value = ''; $('klThSanPham').value = ''; $('klThCapQD').value = '';
    capNhatHienThi(); window.scrollTo({ top: 0 }); $('klThNoiDung').focus();
  } catch (e) {
    notifyError('Không giao được việc: ' + e.message);
    capNhatTomTat();
  }
}

export function registerGiaoViec() {
  $('viewGiaoViec').innerHTML = giaoViecTemplate;
  ['klThLoaiVB', 'klThLoai', 'klThNgayBH'].forEach((id) => $(id).addEventListener('change', capNhatHienThi));
  $('klThVanBan').addEventListener('change', vanBanDoi);
  $('klThVanBanTim').addEventListener('input', locVanBan);
  $('klThHan').addEventListener('input', capNhatHienThi);
  $('klThNganh').addEventListener('change', dienLinhVuc);
  $('klThOwner').addEventListener('change', ownerDoi);
  $('giaoViecForm').addEventListener('input', capNhatTomTat);
  $('giaoViecForm').addEventListener('change', capNhatTomTat);
  registerActions({ openGiaoViec: () => openGiaoViec(), giaoTiepXuong: ({ id }) => openGiaoViec({ cha: timKlRow(id) }),
    huyKlThem: () => openKl(), luuKlThem: () => luu(false), luuKlThemTiep: () => luu(true) });
}
