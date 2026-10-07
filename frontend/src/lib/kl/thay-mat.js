// Thay mặt theo NHÓM (v3.18, migration 0079): người quản trị KL (A3) giao thay mặt "Lãnh đạo Văn phòng" (Chánh + các Phó Chánh VP) hoặc
// "Thường trực Tỉnh ủy" (tài khoản A0) bên cạnh thay mặt từng người. DB ghi nhiem_vu.giao_thay_mat_nhom + giao_thay_mat_cho = người đại
// diện nhóm; cả nhóm được báo, bất kỳ thành viên duyệt từ chối / đề nghị sửa, là "tầng giao". Ở ô Thay mặt của biểu mẫu, nhóm có giá trị
// "nhom:<mã>" (người là uuid). Các hàm ở đây chỉ để ẩn / hiện và đặt tên đúng — kl_duoc_duyet_thay / kl_la_tang_giao ở DB là chốt.
import { state, findAccount } from '../state.js';

export const NHOM_THAY_MAT = [['LANH_DAO_VP', 'Lãnh đạo Văn phòng'], ['THUONG_TRUC', 'Thường trực Tỉnh ủy']];
export const tenNhomThayMat = (nhom) => NHOM_THAY_MAT.find(([m]) => m === nhom)?.[1] || '';
const TIEN_TO = 'nhom:';
export const giaTriNhom = (nhom) => `${TIEN_TO}${nhom}`;
// Giá trị ô Thay mặt → { thay_mat_nhom, thay_mat_cho } cho giao_viec (đúng một trong hai).
export const tachThayMat = (v) => (v && v.startsWith(TIEN_TO) ? { thay_mat_nhom: v.slice(TIEN_TO.length), thay_mat_cho: null } : { thay_mat_nhom: null, thay_mat_cho: v || null });
export const nhomCuaGiaTri = (v) => tachThayMat(v).thay_mat_nhom;
// Thay mặt Thường trực = quy tắc Thường trực giao (giao_viec v_nhu_a0): người nhận là lãnh đạo Văn phòng hoặc một phòng, người theo dõi tự suy, Khẩn mặc định.
export const laThayMatThuongTruc = (v) => nhomCuaGiaTri(v) === 'THUONG_TRUC';

// Thành viên nhóm (cùng kl_nhom_thay_mat_thanh_vien): LANH_DAO_VP = A1, THUONG_TRUC = A0; đang hoạt động, không hệ thống.
export const laThanhVienNhom = (nhom, a) => Boolean(nhom && a) && !a.is_system && !a.bi_khoa
  && (nhom === 'LANH_DAO_VP' ? a.role_group === 'A1' : nhom === 'THUONG_TRUC' && a.role_group === 'A0');
export const toiTrongNhom = (nhom) => laThanhVienNhom(nhom, state.user);
// Cấp duyệt ghi trên một đề nghị (tu_choi / de_nghi_sua) là người đại diện nhóm của việc → mọi thành viên nhóm được duyệt (kl_duoc_duyet_thay).
export const duyetThayNhom = (r, capDuyet) => Boolean(r?.giao_thay_mat_nhom) && r.giao_thay_mat_cho === capDuyet && toiTrongNhom(r.giao_thay_mat_nhom);
// "Người giao" của việc là tôi: người được thay mặt, người tạo, hoặc thành viên nhóm được thay mặt.
export const laNguoiGiao = (r, me = state.user?.id) => Boolean(r && me) && (r.giao_thay_mat_cho === me || r.tao_boi === me || toiTrongNhom(r.giao_thay_mat_nhom));
// Tên hiển thị của cấp duyệt / người giao: nhóm (khi id là người đại diện nhóm của việc) hoặc họ tên.
export const tenCapDuyet = (r, id) => (r?.giao_thay_mat_nhom && r.giao_thay_mat_cho === id ? tenNhomThayMat(r.giao_thay_mat_nhom) : findAccount(id)?.full_name || '');
