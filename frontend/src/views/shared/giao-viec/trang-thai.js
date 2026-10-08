// Đọc trạng thái biểu mẫu Giao việc từ các ô (dùng chung index.js, doc-form.js, nhieu.js — v3.17 tách khỏi index.js; v3.18 số thẻ nhiệm vụ: nhieu.js soThe / coThem).
// Chỉ đọc DOM + state, không ghi. homNay lấy từ DB khi mở biểu mẫu (index.js đặt) — mốc so sánh ngày ban hành / hạn.
import { $ } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { danhMucKl } from '../../../lib/kl/du-lieu.js';
import { homNayVN } from '../../../lib/kl/ngay.js';
import { MOI, timTrongDs } from './van-ban.js';
import { phongCuaOwner } from './pham-vi.js';
import { canNganh } from '../kl/them-owner.js';
import { laThayMatThuongTruc } from '../../../lib/kl/thay-mat.js';

let homNay = homNayVN();
export const getHomNay = () => homNay;
export const datHomNay = (v) => { homNay = v || homNayVN(); };

export const laA0 = () => state.user?.role_group === 'A0';
// Ô Thay mặt: chỉ người quản trị KL (A3 giữ quan_tri_kl), TUỲ CHỌN từ Đợt E (0085) — để trống = giao thẳng như mọi chuyên viên.
export const canThayMat = () => state.user?.role_group === 'A3' && Boolean(state.user?.quan_tri_kl);
// Đợt E (0085): chuyên viên giao thẳng (không thay mặt) — Owner là một chuyên viên (phòng bất kỳ) hoặc chính mình; người theo dõi = người giao (ô ẩn).
export const laA3GiaoThang = () => state.user?.role_group === 'A3' && !$('klThThayMat')?.value;
// v3.18: thay mặt "Thường trực Tỉnh ủy" (nhóm) → quy tắc như Thường trực giao (giao_viec v_nhu_a0): Owner là lãnh đạo Văn phòng / phòng, không ô người
// theo dõi (DB tự suy), Khẩn mặc định; văn bản, ngày giao, ngành / lĩnh vực vẫn theo vai A3.
export const laThayMatTT = () => canThayMat() && laThayMatThuongTruc($('klThThayMat').value);
export const nhuA0 = () => laA0() || laThayMatTT();
export const anTheoDoi = () => nhuA0() || laA3GiaoThang();   // ô người theo dõi ẩn: DB tự suy (Thường trực giao) hoặc = người giao (chuyên viên)
export const vanBanChon = () => timTrongDs($('klThVanBan').value);
export const nhanMoi = () => (laA0() ? 'Văn bản mới hoặc giao trực tiếp…' : 'Văn bản giao việc mới…');
// Phòng của một giá trị Owner ("tk:<id>" / "dv:<mã>") như giao_viec tính; phongOwner() = ô Chịu trách nhiệm đang chọn. Lãnh đạo (A1/A2) giao cho chính
// mình: DB (0078) bỏ qua kiểm phạm vi ⇒ trả null để ngành / lĩnh vực không bị lọc theo phòng (A1 có department LANH_DAO_VAN_PHONG, không có trong phạm vi).
export const laChinhToi = (value) => Boolean(state.user) && ['A1', 'A2'].includes(state.user.role_group) && value === `tk:${state.user.id}`;
export const phongCuaGiaTri = (value) => (laChinhToi(value) ? null : phongCuaOwner(value, danhMucKl(), state.accounts));
export const phongOwner = () => phongCuaGiaTri($('klThOwner').value);
export const laMoi = () => $('klThVanBan').value === MOI;
// A0 chọn "mới" mà để trống cả số hiệu lẫn ngày → giao không kèm văn bản (DB ghi mốc); vai khác bắt buộc đủ số hiệu + ngày.
export const vbTrong = () => laA0() && laMoi() && !$('klThSoKL').value.trim() && !$('klThNgayBH').value;
// Các điều kiện khối 1 khớp kiemTra(): số hiệu + ngày ban hành (không ở tương lai) + số hội nghị nếu Kết luận BTV.
export const thieuSoHN = () => laMoi() && !vbTrong() && $('klThLoaiVB').value === 'KL_BTV' && !$('klThSoHN').value;
export const bhTuongLai = () => laMoi() && Boolean($('klThNgayBH').value) && $('klThNgayBH').value > homNay;
export const vanBanOk = () => (laMoi() ? vbTrong() || (Boolean($('klThSoKL').value.trim() && $('klThNgayBH').value) && !thieuSoHN() && !bhTuongLai()) : Boolean($('klThVanBan').value));
export const ngayBH = () => (laMoi() ? $('klThNgayBH').value : vanBanChon()?.ngay_ban_hanh) || '';
export const hanTruocBH = () => Boolean($('klThHan').value && ngayBH()) && $('klThHan').value < ngayBH();
// Loại văn bản đang áp dụng; A0 để trống văn bản → DB tạo văn bản KHAC (mốc giao) nên không đòi ngành/lĩnh vực.
export const loaiVanBan = () => (laMoi() ? (vbTrong() ? 'KHAC' : $('klThLoaiVB').value) : vanBanChon()?.loai) || 'KHAC';
export const canNganhHienTai = () => canNganh(loaiVanBan());
export const canNgayNhan = () => !laA0() || canNganhHienTai();
