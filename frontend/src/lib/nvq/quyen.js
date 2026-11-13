// Phân hệ Nhiệm vụ quý BTV: ẩn / hiện nút theo quyền — chép đúng điều kiện của hàm CSDL (0134 nvq_duoc_cap_nhat, nvq_duoc_chi_dao, nvq_la_quan_ly) để
// người dùng không bấm nút sẽ bị từ chối. Quyền thật vẫn ở CSDL. Thuần — unit test frontend/tests/nvq-tinh.test.mjs.

// u: hồ sơ người dùng (role_group, department, id; toan_quyen đã áp — vai hiệu dụng); q: nvq_quyen_cua_toi(); timPhong(id) → phòng của tài khoản.
export function duocCapNhat(r, u, q = {}, timPhong = () => null, ky = null) {
  if (!r || !u || u.role_group === 'A0' || r.dieu_chinh === 'RUT' || (ky && ky.trang_thai === 'DA_CHOT')) return false;
  if (q.quan_ly || u.role_group === 'A1') return true;
  if (r.chu_tri_theo_doi === u.id || (r.phoi_hop_theo_doi || []).includes(u.id)) return true;
  if (r.phong_theo_doi && r.phong_theo_doi === u.department) return true;
  if (u.role_group === 'A2') return [r.chu_tri_theo_doi, ...(r.phoi_hop_theo_doi || [])].some((id) => id && timPhong(id) === u.department);
  return false;
}
export const duocChiDao = (u, q = {}) => Boolean(u) && (u.role_group === 'A0' || u.role_group === 'A1' || Boolean(q.chi_dao) || Boolean(q.quan_ly));
export const duocTraoDoi = (r, u, q, timPhong, ky) => duocChiDao(u, q) || duocCapNhat(r, u, q, timPhong, ky);
// Chủ trì theo dõi (người cập nhật chính) hoặc cán bộ của phòng được giao: thấy "Việc tôi theo dõi" / "Cập nhật tuần".
export const laNguoiTheoDoi = (r, u) => Boolean(u) && (r.chu_tri_theo_doi === u.id || (r.phoi_hop_theo_doi || []).includes(u.id)
  || Boolean(r.phong_theo_doi && r.phong_theo_doi === u.department));
