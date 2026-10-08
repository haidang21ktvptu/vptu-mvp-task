// "Mẫu nhập chuẩn VPTU-TASK" (v9 đợt 2): sheet "Nhập liệu" 25 cột theo chuẩn 3 mức (nền tiêu đề theo mức), ô danh mục có danh sách chọn lấy từ
// sheet "Danh mục" (danh mục hiện hành của hệ thống + cán bộ "Họ tên — Phòng"), cột ngày định dạng dd/mm/yyyy; sheet "Hướng dẫn". "Xuất ra Excel
// theo mẫu": cùng tệp, sheet "Nhập liệu" điền sẵn các việc đang lọc (có mã) — sửa trong Excel rồi nhập lại để cập nhật theo mã.
import { taoXlsx } from '../../xlsx.js';
import { TRUONG_MAU } from './truong.js';
import { LOAI_VB, DO_KHAN, TIEN_DO, CHAT_LUONG } from './chuan-hoa.js';
import { NHOM_THAY_MAT, tenNhomThayMat } from '../thay-mat.js';

const S_MUC = { 0: 7, 1: 4, 2: 5, 3: 6 };   // kiểu tiêu đề theo mức (lib/xlsx.js: 4 vàng, 5 lam, 6 lục, 7 xám)
const RONG = { noi_dung: 50, kq_mo_ta: 40, vuong_mac: 30, don_vi: 30, can_bo: 28, theo_doi: 28, lanh_dao_giao: 28, nganh: 34, linh_vuc: 30, kq_trich_yeu: 30 };
const ten = (ds, ma) => ds.find(([m]) => m === ma)?.[1] || '';
export const nhanCanBo = (a, tenPhong) => `${a.full_name}${a.department ? ` — ${tenPhong(a.department)}` : ''}`;

// Danh mục cho danh sách chọn: [tiêu đề cột, [giá trị]] theo đúng thứ tự cột của sheet "Danh mục".
function danhMuc({ dm, accounts, tenPhong }) {
  const canBo = accounts.filter((a) => !a.is_system && !a.bi_khoa && a.role_group !== 'A0').sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'vi'));
  return [
    ['Loại văn bản', LOAI_VB.map(([, t]) => t), 'loai_van_ban'], ['Đơn vị chủ trì', dm.donVi.map((d) => d.ten), 'don_vi'],
    ['Cán bộ', canBo.map((a) => nhanCanBo(a, tenPhong)), 'can_bo theo_doi'],
    ['Lãnh đạo giao', [...NHOM_THAY_MAT.map(([, t]) => `${t} (cả nhóm)`), ...canBo.filter((a) => ['A1', 'A2'].includes(a.role_group)).map((a) => nhanCanBo(a, tenPhong))], 'lanh_dao_giao'],
    ['Loại thời hạn', dm.loaiThoiHan.filter((l) => l.cho_phep_tao_moi).map((l) => l.ten), 'loai_thoi_han'], ['Sản phẩm', dm.sanPham.map((x) => x.ten), 'san_pham'],
    ['Cấp nhận', dm.cap.map((x) => x.ten), 'cap_nhan'], ['Độ khẩn', DO_KHAN.map(([, t]) => t), 'do_khan'],
    ['Nguồn nhiệm vụ', (dm.nguonNhiemVu || []).filter((x) => x.dang_dung).map((x) => x.ten), 'nguon'], ['Ngành', dm.nganh.map((x) => x.ten), 'nganh'],
    ['Lĩnh vực', dm.linhVuc.map((x) => x.ten), 'linh_vuc'], ['Tiến độ', TIEN_DO.map(([, t]) => t), 'tien_do'], ['Chất lượng', CHAT_LUONG.map(([, t]) => t), 'chat_luong'],
  ];
}
const chuCot = (i) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

const HUONG_DAN = [
  ['Mẫu nhập chuẩn VPTU-TASK — mỗi dòng ở sheet "Nhập liệu" là một nhiệm vụ.'],
  ['Mức 1 (nền vàng) — đủ để GIAO: văn bản (loại, số hội nghị nếu là Kết luận BTV, số/ký hiệu, ngày ban hành), nội dung, đơn vị hoặc cán bộ chủ trì, sản phẩm, hạn hoàn thành (loại "Có hạn cụ thể"), ngành + lĩnh vực (Kết luận / Thông báo).'],
  ['Ô để trống được điền theo quy tắc: độ khẩn Thường; loại hạn Có hạn cụ thể; nguồn theo loại văn bản; người theo dõi = cán bộ chủ trì hoặc Trưởng phòng; lãnh đạo giao = Trưởng phòng của phòng chủ trì hoặc Chánh Văn phòng; cấp nhận theo hệ thống.'],
  ['Dòng còn thiếu mức 1 không mất: vào mục "Chờ hoàn thiện" để bổ sung bằng biểu mẫu Giao việc.'],
  ['Mức 2 (nền lam) — tiến độ: Đang thực hiện / Hoàn thành; vướng mắc (gửi lãnh đạo quyết định).'],
  ['Mức 3 (nền lục) — đủ để ĐÓNG: số hiệu, ngày, trích yếu văn bản kết quả, mô tả kết quả; chất lượng. Việc Hoàn thành được xử lý theo lựa chọn khi nhập: "Đã xong ngoài hệ thống" (đóng ngay, không tính tỷ lệ đúng hạn) hoặc "Chờ nghiệm thu" (lãnh đạo nghiệm thu, chấm chất lượng).'],
  ['Mã nhiệm vụ (nền xám): để trống khi nhập việc mới. Có mã → cập nhật việc đó (nội dung, sản phẩm, độ khẩn, ngành, lĩnh vực, nguồn, vướng mắc…); ô trống không xoá dữ liệu đang có. Đổi chủ trì / hạn dùng Giao lại / Gia hạn trên hệ thống.'],
  ['Ngày ghi dd/mm/yyyy. Ô có danh sách chọn lấy từ sheet "Danh mục"; gõ giá trị khác vẫn được — hệ thống thử khớp và hỏi lại khi chưa chắc.'],
];

// rows: dòng v_nhiem_vu (Xuất theo mẫu) — rỗng: mẫu trống. ctx: { dm, accounts, tenPhong, findAccount }
export function taoMauNhap(ctx, rows = []) {
  const ds = danhMuc(ctx);
  const cotDm = (k) => ds.findIndex(([, , ks]) => ks.split(' ').includes(k));
  const cot = TRUONG_MAU.map((t) => ({ nhan: t.nhan, rong: RONG[t.k] || 16, kieu: t.kieu === 'ngay' ? 'ngay' : undefined, sTieuDe: S_MUC[t.muc] }));
  const kiemTra = TRUONG_MAU.map((t, i) => [i, cotDm(t.k)]).filter(([, j]) => j >= 0 && ds[j][1].length)
    .map(([i, j]) => ({ cot: i, nguon: `'Danh mục'!$${chuCot(j)}$2:$${chuCot(j)}$${ds[j][1].length + 1}`, den: Math.max(1001, rows.length + 501) }));
  const dai = Math.max(...ds.map(([, v]) => v.length));
  return taoXlsx([
    { ten: 'Nhập liệu', cot, dong: rows.map((r) => TRUONG_MAU.map((t) => giaTriXuat(r, t.k, ctx))), kiemTra },
    { ten: 'Danh mục', cot: ds.map(([nhan]) => ({ nhan, rong: 30 })), dong: Array.from({ length: dai }, (_, i) => ds.map(([, v]) => v[i] ?? null)) },
    { ten: 'Hướng dẫn', cot: [{ nhan: 'Hướng dẫn nhập', rong: 140 }], dong: HUONG_DAN },
  ]);
}

// Giá trị một ô khi xuất việc đang có theo mẫu (tên hiển thị — nhập lại khớp ngược về mã).
function giaTriXuat(r, k, { findAccount, tenPhong }) {
  const nguoi = (id) => { const a = id && findAccount(id); return a ? nhanCanBo(a, tenPhong) : ''; };
  const lanhDao = () => (r.giao_thay_mat_nhom ? `${tenNhomThayMat(r.giao_thay_mat_nhom)} (cả nhóm)` : nguoi(r.giao_thay_mat_cho) || (['A1', 'A2'].includes(findAccount(r.tao_boi)?.role_group) ? nguoi(r.tao_boi) : ''));
  switch (k) {
    case 'ma': return r.ma;
    case 'loai_van_ban': return ten(LOAI_VB, r.van_ban_loai);
    case 'so_hoi_nghi': return r.so_hoi_nghi ?? null;
    case 'so_ket_luan': return r.so_ket_luan;
    case 'ngay_ban_hanh': return r.ngay_ban_hanh;
    case 'noi_dung': return r.noi_dung;
    case 'don_vi': return r.owner_don_vi_ten || '';
    case 'can_bo': return nguoi(r.owner_tai_khoan);
    case 'theo_doi': return nguoi(r.nguoi_theo_doi);
    case 'lanh_dao_giao': return lanhDao();
    case 'loai_thoi_han': return r.loai_thoi_han_ten || '';
    case 'han_xu_ly': return r.han_xu_ly;
    case 'san_pham': return r.san_pham_ten || '';
    case 'cap_nhan': return r.cap_nhan_san_pham_ten || '';
    case 'do_khan': return ten(DO_KHAN, r.do_khan);
    case 'nguon': return r.nguon_nhiem_vu_ten || '';
    case 'nganh': return r.nganh_ten || '';
    case 'linh_vuc': return r.linh_vuc_ten || '';
    case 'tien_do': return ten(TIEN_DO, r.tien_do_ma);
    case 'vuong_mac': return r.vuong_mac || '';
    case 'chat_luong': return ten(CHAT_LUONG, r.chat_luong);
    default: return '';
  }
}
