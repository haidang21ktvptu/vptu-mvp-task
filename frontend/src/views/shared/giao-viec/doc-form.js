// Đọc biểu mẫu Giao việc thành tham số giao_viec và kiểm tra phía form (cùng quy tắc với giao_viec; DB là chốt). Tách khỏi index.js (v3.17).
// v3.18 (gộp bố cục): docForm() đọc phần chung + thẻ "Nhiệm vụ 1" (bộ ô chính); có thẻ thêm (nhieu.js) thì tachDong(p) tách thành p_chung và
// dòng 1 cho giao_viec_nhieu — các thẻ thêm kiểm riêng ở nhieu.js (thieuNhieu).
import { $ } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { danhMucKl } from '../../../lib/kl/du-lieu.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { parseOwner } from '../kl/them-owner.js';
import { loiNguon, docNguon, docVanBanThem } from './nguon.js';
import { themHoanThien } from './dien-san.js';
import { getHomNay, laA0, anTheoDoi, laA3GiaoThang, canThayMat, canNgayNhan, canNganhHienTai, laMoi, vbTrong, ngayBH } from './trang-thai.js';
import { tachThayMat } from '../../../lib/kl/thay-mat.js';

// Kiểm tra phía form (phần chung + thẻ 1); trả về chuỗi lỗi hoặc null. Có thẻ thêm: nhieu.js loiNhieu() kiểm tiếp.
export function kiemTra(p) {
  const homNay = getHomNay();
  if (p.van_ban) {
    if (!p.van_ban.so_ket_luan || !p.van_ban.ngay_ban_hanh) return 'Văn bản mới phải có số hiệu và ngày ban hành.';
    if (p.van_ban.loai === 'KL_BTV' && !p.van_ban.so_hoi_nghi) return 'Kết luận Ban Thường vụ phải có số hội nghị.';
    if (p.van_ban.ngay_ban_hanh > homNay) return 'Ngày ban hành ở tương lai — kiểm tra lại năm.';
  } else if (!p.van_ban_id && !laA0()) return 'Chọn văn bản giao việc hoặc nhập văn bản mới.';
  if (canNgayNhan() && !p.ngay_nhan_van_ban) return 'Nhập ngày giao nhiệm vụ (mốc bắt đầu đếm).';
  if (!p.noi_dung) return 'Nhập nội dung nhiệm vụ.';
  if (!p.owner_don_vi_ma) return 'Chọn phòng hoặc cán bộ chịu trách nhiệm — mỗi việc đúng một Owner.';
  if (!p.san_pham_loai) return 'Chọn loại sản phẩm đầu ra — mỗi việc phải định nghĩa sản phẩm ngay từ đầu.';
  if (p.loai_thoi_han_ma === 'CO_HAN_CU_THE' && !p.han_xu_ly) return 'Nhập hạn hoàn thành — mỗi việc phải có một hạn cụ thể.';
  if (p.han_xu_ly && ngayBH() && p.han_xu_ly < ngayBH()) return `Hạn không được trước ngày ban hành (${formatNgay(ngayBH())}). Chọn lại ngày.`;
  if (canNganhHienTai() && (!p.nganh_ma || !p.linh_vuc_ma)) return 'Chọn ngành và lĩnh vực (bắt buộc với việc từ kết luận / thông báo).';
  if (!anTheoDoi() && !p.nguoi_theo_doi) return 'Chọn người theo dõi (cán bộ Văn phòng).';
  return loiNguon();
}

export const vanBanMoi = () => ({ loai: $('klThLoaiVB').value, so_hoi_nghi: Number($('klThSoHN').value) || null, so_ket_luan: $('klThSoKL').value.trim(),
  ngay_ban_hanh: $('klThNgayBH').value, ngay_nhan: $('klThNgayNhanVB').value || null, ...docVanBanThem() });

// Tham số giao_viec từ các ô; cha = việc cha khi giao tiếp xuống.
export function docForm(cha) {
  const owner = parseOwner($('klThOwner').value, danhMucKl(), state.accounts);
  const p = {
    noi_dung: $('klThNoiDung').value.trim(), owner_don_vi_ma: owner.owner_don_vi_ma, owner_tai_khoan: owner.owner_tai_khoan, do_khan: $('klThDoKhan').value,
    san_pham_loai: $('klThSanPham').value || null, san_pham_mo_ta: $('klThSanPhamMoTa').value.trim() || null,
    han_xu_ly: $('klThLoai').value === 'KY_BAN_HANH' ? null : $('klThHan').value || null, cap_nhan_san_pham: $('klThCapNhan').value || null, theo_1400: true,
    ...docNguon(),
  };
  if (canThayMat()) Object.assign(p, tachThayMat($('klThThayMat').value));   // thay_mat_cho (một lãnh đạo) hoặc thay_mat_nhom (v3.18); trống = giao thẳng (0085)
  if (cha) p.nhiem_vu_cha = cha.id;
  if (laA0()) {   // A0: DB tự suy người theo dõi, đặt uu_tien Thường trực; văn bản: đã điền → như vai khác, để trống → DB ghi mốc giao
    if (laMoi() && !vbTrong()) p.van_ban = vanBanMoi(); else if (!laMoi()) p.van_ban_id = $('klThVanBan').value;
    if (canNganhHienTai()) Object.assign(p, { nganh_ma: $('klThNganh').value || null, linh_vuc_ma: $('klThLinhVuc').value || null, ngay_nhan_van_ban: $('klThNgayNhan').value || null, loai_thoi_han_ma: $('klThLoai').value });
    return p;
  }
  Object.assign(p, {
    ngay_nhan_van_ban: $('klThNgayNhan').value || null, loai_thoi_han_ma: $('klThLoai').value, cap_quyet_dinh: $('klThCapQD').value || null,
    nganh_ma: $('klThNganh').value || null, linh_vuc_ma: $('klThLinhVuc').value || null,
    nguoi_theo_doi: laA3GiaoThang() ? state.user?.id || null : $('klThNguoiTheoDoi').value || null,   // 0085: chuyên viên giao thẳng — theo dõi = người giao
    van_ban_trien_khai: $('klThVanBanTK').value.trim() || null, linh_vuc_chi_tiet: $('klThGhiChu').value.trim() || null,
  });
  if (laMoi()) p.van_ban = vanBanMoi(); else p.van_ban_id = $('klThVanBan').value;
  return themHoanThien(p);
}

// Có thẻ thêm → giao_viec_nhieu(p_chung, p_dong): tách docForm thành phần chung (văn bản, nguồn, thay mặt, ngày giao, cấp quyết định, văn bản triển
// khai, ghi chú, theo_1400) và dòng 1 = các khoá của thẻ nhiệm vụ (cùng khoá với nhieu.js docDong cho thẻ 2…n).
const KHOA_DONG = ['noi_dung', 'owner_don_vi_ma', 'owner_tai_khoan', 'nguoi_theo_doi', 'do_khan', 'san_pham_loai', 'san_pham_mo_ta', 'cap_nhan_san_pham',
  'loai_thoi_han_ma', 'han_xu_ly', 'nganh_ma', 'linh_vuc_ma', 'don_vi_phoi_hop', 'dong_nhap_id', 'vuong_mac'];
export function tachDong(p) {
  const chung = { ...p }; const dong1 = {};
  KHOA_DONG.forEach((k) => { if (k in chung) { dong1[k] = chung[k]; delete chung[k]; } });
  return { chung, dong1 };
}
