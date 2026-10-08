// Phần thuần (không DOM) của form giao việc GĐ14: ô "Chịu trách nhiệm" (Owner, NT-1) gộp hai kiểu trong MỘT ô chọn — Văn phòng/phòng
// (A1, quan_tri_kl), cán bộ (A2 chỉ chuyên viên phòng mình) — giá trị "dv:<mã>" hoặc "tk:<id>"; v3.18 (0079): Owner luôn là phòng / cán bộ
// Văn phòng, đơn vị ngoài không còn trong ô chọn (việc giao cho sở, ngành ghi tên đơn vị trong nội dung). Cấp nhận sản phẩm mặc định = cấp
// ngay trên Owner (CH-7); người theo dõi trong phạm vi người giao (mặc định = người nhập). Ô Thay mặt (A3 quản trị KL): nhóm "Lãnh đạo Văn
// phòng" / "Thường trực Tỉnh ủy" (lib/kl/thay-mat.js) rồi từng lãnh đạo. Quyền thật kiểm trong hàm giao_viec (0025); đây chỉ là gợi ý đúng.
import { escapeHtml } from '../../../lib/dom.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { NHOM_THAY_MAT, giaTriNhom } from '../../../lib/kl/thay-mat.js';

const opt = (v, t, chon = false) => `<option value="${escapeHtml(v)}"${chon ? ' selected' : ''}>${escapeHtml(t)}</option>`;
const nhomOpt = (nhan, ds) => (ds.length ? `<optgroup label="${escapeHtml(nhan)}">${ds.join('')}</optgroup>` : '');
const tenPhong = (ma) => DEPT_NAMES[ma] || ma || '';
const laQtkl = (me) => Boolean(me?.quan_tri_kl);

// Cán bộ được chọn làm Owner theo vai người giao (A0 — GĐ22: chỉ lãnh đạo Văn phòng, hoặc một phòng ở nhóm dưới; nhuA0 = thay mặt Thường
// trực, cùng quy tắc). v3.17: lãnh đạo (A1, A2) giao được cho chính mình — A2 thêm chính mình bên cạnh chuyên viên phòng (giao_viec 0078 là
// chốt; cấp nhận = cấp trên của chính họ). Đợt E (0085): chuyên viên không thay mặt (thayMat trống) giao thẳng cho chuyên viên phòng bất kỳ
// hoặc chính mình; người quản trị KL chọn thay mặt thì như trước.
export const laGiaoThang = (me, thayMat = '') => me?.role_group === 'A3' && !thayMat;
export function canBoOwner(accounts, me, nhuA0 = false, thayMat = '') {
  const ds = accounts.filter((a) => !a.is_system && a.role_group !== 'A0');
  if (me?.role_group === 'A0' || nhuA0) return ds.filter((a) => a.role_group === 'A1');
  if (laGiaoThang(me, thayMat)) return ds.filter((a) => a.role_group === 'A3');
  if (laQtkl(me) || me?.role_group === 'A1') return ds;
  if (me?.role_group === 'A2') return ds.filter((a) => (a.role_group === 'A3' && a.department === me.department) || a.id === me.id);
  return [];
}

// nhuA0 (v3.18): A3 giao thay mặt Thường trực → danh sách như Thường trực giao (lãnh đạo Văn phòng hoặc một phòng).
export function ownerOptionsHtml(dm, accounts, me, nhuA0 = false, thayMat = '') {
  const sapTen = (a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'vi'); // tên trống (tài khoản tạm) không làm hỏng biểu mẫu
  const a0 = me?.role_group === 'A0' || nhuA0; const thang = laGiaoThang(me, thayMat);
  const laToi = (a) => a.id === me?.id;   // chính tôi: xếp đầu nhóm cán bộ, nhãn "(chính tôi)"
  const canBo = canBoOwner(accounts, me, nhuA0, thayMat).sort((a, b) => Number(laToi(b)) - Number(laToi(a)) || sapTen(a, b))
    .map((a) => opt(`tk:${a.id}`, `${a.full_name}${laToi(a) ? ' (chính tôi)' : ''} — ${tenPhong(a.department) || 'Lãnh đạo Văn phòng'}`));
  const trongVp = a0 ? dm.donVi.filter((d) => d.trong_van_phong && d.phong).map((d) => opt(`dv:${d.ma}`, d.ten))
    : !thang && (laQtkl(me) || me?.role_group === 'A1') ? dm.donVi.filter((d) => d.trong_van_phong).map((d) => opt(`dv:${d.ma}`, d.ten)) : [];
  return opt('', a0 ? 'Chọn lãnh đạo Văn phòng hoặc phòng nhận việc' : thang ? 'Chọn chuyên viên thực hiện (hoặc chính tôi)' : 'Chọn phòng hoặc cán bộ chịu trách nhiệm')
    + nhomOpt(a0 ? 'Lãnh đạo Văn phòng' : thang ? 'Chuyên viên' : 'Cán bộ', canBo) + nhomOpt(a0 ? 'Các phòng' : 'Văn phòng và các phòng', trongVp);
}

// Lãnh đạo được giao thay mặt (GĐ22): nhóm (v3.18 — "nhom:<mã>", cả nhóm được báo / duyệt) rồi A1/A2 đang hoạt động; giao_viec kiểm phạm vi với Owner.
export function thayMatOptionsHtml(accounts) {
  const nhom = NHOM_THAY_MAT.map(([ma, ten]) => opt(giaTriNhom(ma), `${ten} (cả nhóm)`));
  const nguoi = accounts.filter((a) => !a.is_system && ['A1', 'A2'].includes(a.role_group))
    .sort((a, b) => a.role_group.localeCompare(b.role_group) || (a.full_name || '').localeCompare(b.full_name || '', 'vi'))
    .map((a) => opt(a.id, `${a.full_name} — ${a.position_title || ''}${a.department ? ` · ${tenPhong(a.department)}` : ''}`));
  return nhomOpt('Nhóm lãnh đạo', nhom) + nhomOpt('Từng lãnh đạo', nguoi);
}
// Người theo dõi gợi ý theo Owner (GĐ22): phòng → Trưởng phòng; Văn phòng → Chánh VP; lãnh đạo A1/A2 → chính họ; chuyên viên → giữ mặc định (người giao).
export function goiYTheoDoi(value, dm, accounts) {
  if (!value) return null;
  const [kieu, ma] = value.split(':');
  if (kieu === 'tk') { const a = accounts.find((x) => x.id === ma); return a && ['A1', 'A2'].includes(a.role_group) ? a.id : null; }
  const dv = dm.donVi.find((d) => d.ma === ma);
  if (!dv?.trong_van_phong) return null;
  const a = dv.phong ? accounts.find((x) => x.role_group === 'A2' && x.department === dv.phong && !x.is_system) : accounts.find((x) => x.role_group === 'A1' && x.is_chief && !x.is_system);
  return a?.id || null;
}

// "tk:<id>" → { owner_tai_khoan, owner_don_vi_ma (phòng của cán bộ, hoặc Văn phòng với lãnh đạo), capMacDinh };
// "dv:<mã>" → { owner_don_vi_ma, owner_tai_khoan: null, capMacDinh }.
export function parseOwner(value, dm, accounts) {
  if (!value) return { owner_don_vi_ma: null, owner_tai_khoan: null, capMacDinh: '' };
  const [kieu, ma] = value.split(':');
  if (kieu === 'tk') {
    const a = accounts.find((x) => x.id === ma);
    const phong = dm.donVi.find((d) => d.phong && d.phong === a?.department);
    const cap = a?.role_group === 'A3' ? 'TRUONG_PHONG' : a?.role_group === 'A2' ? 'PHO_CHANH_VAN_PHONG' : 'THUONG_TRUC';
    return { owner_tai_khoan: ma, owner_don_vi_ma: phong ? phong.ma : 'VAN_PHONG_TINH_UY', capMacDinh: cap };
  }
  const dv = dm.donVi.find((d) => d.ma === ma);
  return { owner_don_vi_ma: ma, owner_tai_khoan: null, capMacDinh: dv?.phong ? 'PHO_CHANH_VAN_PHONG' : 'THUONG_TRUC' };
}

// Người theo dõi (CH-2): cán bộ Văn phòng trong phạm vi người giao; A2 chỉ phòng mình (+ chính mình).
export function nguoiTheoDoiOptionsHtml(accounts, me) {
  let ds = accounts.filter((a) => !a.is_system);
  if (me?.role_group === 'A2' && !laQtkl(me)) ds = ds.filter((a) => a.department === me.department || a.id === me.id);
  return ds.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'vi')).map((a) => opt(a.id, `${a.full_name} — ${tenPhong(a.department)}`, a.id === me?.id)).join('');
}

export const LOAI_VAN_BAN = [['KL_BTV', 'Kết luận Hội nghị Ban Thường vụ'], ['TB_THUONG_TRUC', 'Thông báo của Thường trực Tỉnh ủy'],
  ['KL_BCH', 'Kết luận Ban Chấp hành Đảng bộ tỉnh'], ['NQ_BCH', 'Nghị quyết Ban Chấp hành Đảng bộ tỉnh'],   // 0087 (Đợt C2)
  ['NQ_TW', 'Nghị quyết Trung ương'], ['CONG_VAN', 'Công văn'], ['KHAC', 'Văn bản khác']];
export const LOAI_CO_HOI_NGHI = ['KL_BTV', 'KL_BCH', 'NQ_BCH'];   // ô "Số hội nghị" hiện (bắt buộc với KL_BTV — CHECK 0022)
export const tenLoaiVanBan = (ma) => LOAI_VAN_BAN.find(([m]) => m === ma)?.[1] || ma;
// Ngành/lĩnh vực bắt buộc với việc từ kết luận BTV / thông báo Thường trực (GV-2, phục vụ phân công PCVP).
export const canNganh = (loaiVanBan) => ['KL_BTV', 'TB_THUONG_TRUC'].includes(loaiVanBan);
