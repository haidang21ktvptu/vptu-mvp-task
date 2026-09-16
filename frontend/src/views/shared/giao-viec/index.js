// Màn hình Giao việc (ba bước một trang, dùng chung A1/A2/quan_tri_kl; SPEC v3 GV-2: người giao chỉ thiết lập Owner, Product, Deadline —
// hệ thống tự điền, cho sửa: ngày nhận, cấp nhận, người theo dõi). Kiểm phía form để báo lỗi sớm; DB là chốt qua giao_viec (0025).
// "Giao, nhập tiếp" giữ văn bản/ngành/lĩnh vực/loại hạn cho kết luận có nhiều việc.
import { $, show, setText, escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { loadDanhMucKl, danhMucKl, linhVucCuaNganh, cauHinhKl, homNayTheoDb, loadVanBan, giaoViec } from '../../../lib/kl/du-lieu.js';
import { homNayVN, formatNgay, ghiChuHan, congNgay } from '../../../lib/kl/ngay.js';
import { setActiveNav, showSection } from '../../shell/index.js';
import { openKl } from '../kl/index.js';
import { giaoViecTemplate } from './template.js';
import { ownerOptionsHtml, parseOwner, nguoiTheoDoiOptionsHtml, LOAI_VAN_BAN, tenLoaiVanBan, canNganh } from '../kl/them-owner.js';

let vanBan = [];
let homNay = homNayVN();
const MOI = '__moi__';
const opt = (v, t, chon = false) => `<option value="${escapeHtml(v)}"${chon ? ' selected' : ''}>${escapeHtml(t)}</option>`;

const vanBanChon = () => vanBan.find((h) => h.id === $('klThVanBan').value);
const laMoi = () => $('klThVanBan').value === MOI;
const ngayBH = () => (laMoi() ? $('klThNgayBH').value : vanBanChon()?.ngay_ban_hanh) || '';
const loaiVanBan = () => (laMoi() ? $('klThLoaiVB').value : vanBanChon()?.loai) || 'KHAC';
const nhanVanBan = (h) => `${tenLoaiVanBan(h.loai)} · ${h.so_hoi_nghi ? `HN ${h.so_hoi_nghi} · ` : ''}${h.so_ket_luan} · BH ${formatNgay(h.ngay_ban_hanh)}`;

function capNhatHienThi() {
  const loai = $('klThLoai').value;
  const bh = ngayBH();
  show('klThVanBanMoi', laMoi());
  show('klThSoHNWrap', laMoi() && $('klThLoaiVB').value === 'KL_BTV');
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
}
function dienLinhVuc() {
  $('klThLinhVuc').innerHTML = opt('', 'Chọn lĩnh vực') + linhVucCuaNganh($('klThNganh').value).map((l) => opt(l.ma, l.ten)).join('');
}
function vanBanDoi() { $('klThNgayNhan').value = vanBanChon()?.ngay_nhan || homNay; capNhatHienThi(); }
function ownerDoi() {
  const { capMacDinh } = parseOwner($('klThOwner').value, danhMucKl(), state.accounts);
  if (capMacDinh) $('klThCapNhan').value = capMacDinh;
}

export async function openGiaoViec() {
  showSection('viewGiaoViec');
  setActiveNav('navGiaoViec');
  try { await loadDanhMucKl(); vanBan = await loadVanBan(); } catch (e) { notifyError(e.message); return; }
  homNay = (await homNayTheoDb()) || homNayVN();
  const dm = danhMucKl();
  $('klThVanBan').innerHTML = opt(MOI, 'Văn bản giao việc mới…') + vanBan.map((h) => opt(h.id, nhanVanBan(h))).join('');
  if (vanBan.length) $('klThVanBan').value = vanBan[0].id;
  $('klThLoaiVB').innerHTML = LOAI_VAN_BAN.map(([ma, ten]) => opt(ma, ten, ma === 'KL_BTV')).join('');
  $('klThNgayBH').max = homNay; $('klThNgayNhanVB').max = homNay;
  $('klThOwner').innerHTML = ownerOptionsHtml(dm, state.accounts, state.user);
  $('klThNguoiTheoDoi').innerHTML = nguoiTheoDoiOptionsHtml(state.accounts, state.user);
  $('klThSanPham').innerHTML = opt('', 'Chọn loại sản phẩm') + dm.sanPham.map((s) => opt(s.ma, s.ten)).join('');
  $('klThCapNhan').innerHTML = dm.cap.map((c) => opt(c.ma, c.ten)).join('');
  $('klThCapQD').innerHTML = opt('', 'Chưa xác định') + dm.cap.map((c) => opt(c.ma, c.ten)).join('');
  $('klThNganh').innerHTML = opt('', 'Chọn ngành') + dm.nganh.map((n) => opt(n.ma, n.ten)).join('');
  $('klThLoai').innerHTML = dm.loaiThoiHan.filter((l) => l.cho_phep_tao_moi).map((l) => opt(l.ma, l.ten, l.ma === 'CO_HAN_CU_THE')).join('');
  ['klThNoiDung', 'klThHan', 'klThVanBanTK', 'klThGhiChu', 'klThSoHN', 'klThSoKL', 'klThNgayBH', 'klThNgayNhanVB', 'klThSanPhamMoTa'].forEach((id) => { $(id).value = ''; });
  $('klThNgayNhan').value = homNay;
  dienLinhVuc();
  capNhatHienThi();
  $('klThLuu').disabled = false;
  $('klThNoiDung').focus();
}

// Kiểm tra phía form (cùng quy tắc với giao_viec); trả về chuỗi lỗi hoặc null.
function kiemTra(p) {
  if (p.van_ban) {
    if (!p.van_ban.so_ket_luan || !p.van_ban.ngay_ban_hanh) return 'Văn bản mới phải có số hiệu và ngày ban hành.';
    if (p.van_ban.loai === 'KL_BTV' && !p.van_ban.so_hoi_nghi) return 'Kết luận Ban Thường vụ phải có số hội nghị.';
    if (p.van_ban.ngay_ban_hanh > homNay) return 'Ngày ban hành ở tương lai — kiểm tra lại năm.';
  } else if (!p.van_ban_id) return 'Chọn văn bản giao việc hoặc nhập văn bản mới.';
  if (!p.noi_dung) return 'Nhập nội dung nhiệm vụ.';
  if (!p.owner_don_vi_ma) return 'Chọn đơn vị hoặc cán bộ chịu trách nhiệm — mỗi việc đúng một Owner.';
  if (!p.san_pham_loai) return 'Chọn loại sản phẩm đầu ra — mỗi việc phải định nghĩa sản phẩm ngay từ đầu.';
  if (!p.ngay_nhan_van_ban) return 'Nhập ngày nhận văn bản (mốc bắt đầu đếm).';
  if (p.loai_thoi_han_ma === 'CO_HAN_CU_THE' && !p.han_xu_ly) return 'Nhập hạn hoàn thành — mỗi việc phải có một hạn cụ thể.';
  if (p.han_xu_ly && ngayBH() && p.han_xu_ly < ngayBH()) return `Hạn không được trước ngày ban hành (${formatNgay(ngayBH())}). Chọn lại ngày.`;
  if (canNganh(loaiVanBan()) && (!p.nganh_ma || !p.linh_vuc_ma)) return 'Chọn ngành và lĩnh vực (bắt buộc với việc từ kết luận / thông báo).';
  if (!p.nguoi_theo_doi) return 'Chọn người theo dõi (cán bộ Văn phòng).';
  return null;
}

function docForm() {
  const owner = parseOwner($('klThOwner').value, danhMucKl(), state.accounts);
  const p = {
    noi_dung: $('klThNoiDung').value.trim(), owner_don_vi_ma: owner.owner_don_vi_ma, owner_tai_khoan: owner.owner_tai_khoan,
    san_pham_loai: $('klThSanPham').value || null, san_pham_mo_ta: $('klThSanPhamMoTa').value.trim() || null,
    ngay_nhan_van_ban: $('klThNgayNhan').value || null, loai_thoi_han_ma: $('klThLoai').value,
    han_xu_ly: $('klThLoai').value === 'KY_BAN_HANH' ? null : $('klThHan').value || null,
    cap_nhan_san_pham: $('klThCapNhan').value || null, cap_quyet_dinh: $('klThCapQD').value || null,
    nganh_ma: $('klThNganh').value || null, linh_vuc_ma: $('klThLinhVuc').value || null, nguoi_theo_doi: $('klThNguoiTheoDoi').value || null,
    van_ban_trien_khai: $('klThVanBanTK').value.trim() || null, linh_vuc_chi_tiet: $('klThGhiChu').value.trim() || null, theo_1400: true,
  };
  if (laMoi()) {
    p.van_ban = { loai: $('klThLoaiVB').value, so_hoi_nghi: Number($('klThSoHN').value) || null, so_ket_luan: $('klThSoKL').value.trim(),
      ngay_ban_hanh: $('klThNgayBH').value, ngay_nhan: $('klThNgayNhanVB').value || null };
  } else p.van_ban_id = $('klThVanBan').value;
  return p;
}

async function luu(nhapTiep) {
  const p = docForm();
  const loiForm = kiemTra(p);
  if (loiForm) { notifyError(loiForm); return; }
  $('klThLuu').disabled = true;
  try {
    const kq = await giaoViec(p);
    notifySuccess(`Đã giao việc ${kq.ma}.`);
    if (p.van_ban) {
      const vb = { id: kq.van_ban_id, ...p.van_ban };
      vanBan.unshift(vb);
      $('klThVanBan').insertAdjacentHTML('afterbegin', opt(vb.id, nhanVanBan(vb)));
    }
    if (!nhapTiep) { openKl({ tuKhoa: kq.ma }); return; }
    $('klThVanBan').value = p.van_ban_id || kq.van_ban_id;
    ['klThNoiDung', 'klThHan', 'klThVanBanTK', 'klThGhiChu', 'klThSanPhamMoTa'].forEach((id) => { $(id).value = ''; });
    $('klThOwner').value = ''; $('klThSanPham').value = ''; $('klThCapQD').value = '';
    capNhatHienThi(); window.scrollTo({ top: 0 }); $('klThNoiDung').focus();
  } catch (e) {
    notifyError('Không giao được việc: ' + e.message);
  } finally {
    $('klThLuu').disabled = false;
  }
}

export function registerGiaoViec() {
  $('viewGiaoViec').innerHTML = giaoViecTemplate;
  ['klThLoaiVB', 'klThLoai', 'klThNgayBH'].forEach((id) => $(id).addEventListener('change', capNhatHienThi));
  $('klThVanBan').addEventListener('change', vanBanDoi);
  $('klThHan').addEventListener('input', capNhatHienThi);
  $('klThNganh').addEventListener('change', dienLinhVuc);
  $('klThOwner').addEventListener('change', ownerDoi);
  registerActions({ openGiaoViec, huyKlThem: () => openKl(), luuKlThem: () => luu(false), luuKlThemTiep: () => luu(true) });
}
