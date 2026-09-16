// Phần thuần (không DOM) của form giao việc GĐ14: ô "Chịu trách nhiệm" (Owner, NT-1) gộp ba kiểu trong MỘT ô chọn —
// đơn vị ngoài Văn phòng (chỉ quan_tri_kl), Văn phòng/phòng (A1, quan_tri_kl), cán bộ (A2 chỉ chuyên viên phòng mình) —
// giá trị "dv:<mã>" hoặc "tk:<id>"; cấp nhận sản phẩm mặc định = cấp ngay trên Owner (CH-7); người theo dõi trong phạm vi
// người giao (mặc định = người nhập). Quyền thật kiểm trong hàm giao_viec (0025); đây chỉ là gợi ý đúng cho người dùng.
import { escapeHtml } from '../../../lib/dom.js';
import { DEPT_NAMES } from '../../../lib/constants.js';

const opt = (v, t, chon = false) => `<option value="${escapeHtml(v)}"${chon ? ' selected' : ''}>${escapeHtml(t)}</option>`;
const nhomOpt = (nhan, ds) => (ds.length ? `<optgroup label="${escapeHtml(nhan)}">${ds.join('')}</optgroup>` : '');
const tenPhong = (ma) => DEPT_NAMES[ma] || ma || '';
const laQtkl = (me) => Boolean(me?.quan_tri_kl);

// Cán bộ được chọn làm Owner theo vai người giao.
export function canBoOwner(accounts, me) {
  const ds = accounts.filter((a) => !a.is_system);
  if (laQtkl(me) || me?.role_group === 'A1') return ds;
  if (me?.role_group === 'A2') return ds.filter((a) => a.role_group === 'A3' && a.department === me.department);
  return [];
}

export function ownerOptionsHtml(dm, accounts, me) {
  const sapTen = (a, b) => a.full_name.localeCompare(b.full_name, 'vi');
  const canBo = canBoOwner(accounts, me).sort(sapTen).map((a) => opt(`tk:${a.id}`, `${a.full_name} — ${tenPhong(a.department)}`));
  const trongVp = laQtkl(me) || me?.role_group === 'A1' ? dm.donVi.filter((d) => d.trong_van_phong).map((d) => opt(`dv:${d.ma}`, d.ten)) : [];
  const ngoai = laQtkl(me) ? dm.donVi.filter((d) => !d.trong_van_phong).map((d) => opt(`dv:${d.ma}`, d.ten)) : [];
  return opt('', 'Chọn đơn vị hoặc cán bộ chịu trách nhiệm') + nhomOpt('Cán bộ', canBo) + nhomOpt('Văn phòng và các phòng', trongVp) + nhomOpt('Đơn vị ngoài Văn phòng', ngoai);
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
  return ds.sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi')).map((a) => opt(a.id, `${a.full_name} — ${tenPhong(a.department)}`, a.id === me?.id)).join('');
}

export const LOAI_VAN_BAN = [['KL_BTV', 'Kết luận Hội nghị Ban Thường vụ'], ['TB_THUONG_TRUC', 'Thông báo của Thường trực Tỉnh ủy'],
  ['NQ_TW', 'Nghị quyết Trung ương'], ['CONG_VAN', 'Công văn'], ['KHAC', 'Văn bản khác']];
export const tenLoaiVanBan = (ma) => LOAI_VAN_BAN.find(([m]) => m === ma)?.[1] || ma;
// Ngành/lĩnh vực bắt buộc với việc từ kết luận BTV / thông báo Thường trực (GV-2, phục vụ phân công PCVP).
export const canNganh = (loaiVanBan) => ['KL_BTV', 'TB_THUONG_TRUC'].includes(loaiVanBan);
