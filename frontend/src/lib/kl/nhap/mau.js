// "Mẫu nhập chuẩn VPTU-TASK" — v3.27 (chủ dự án 20/10/2026): đúng các cột của bảng Phụ lục Văn phòng đang dùng (tệp TUCB / KL Thường trực): A STT ·
// B Số hội nghị · C Số TB/KL · D Ngày ban hành · E Chủ trì theo dõi · F Ngành/lĩnh vực · G Cơ quan/đơn vị trình · H Lĩnh vực chi tiết · I Nội dung · J Loại
// thời hạn · K Hạn xử lý · L Tiến độ · M Kết quả thực hiện / Minh chứng · N Văn bản triển khai · O Mã nhiệm vụ. Điền đủ B–M là nhập thẳng (ô hệ thống
// cần mà bảng không có — sản phẩm, lĩnh vực theo danh mục, hạn còn trống — điền theo quy tắc, xem mac-dinh.js). Ô danh mục có danh sách chọn lấy từ
// sheet "Danh mục"; cột ngày định dạng dd/mm/yyyy; sheet "Hướng dẫn". "Xuất theo mẫu" (màn Nhiệm vụ): cùng tệp, điền sẵn các việc đang lọc (có mã) —
// vừa là bảng Phụ lục để báo cáo, vừa sửa rồi nhập lại để cập nhật theo mã.
import { taoXlsx } from '../../xlsx.js';
import { COT_MAU } from './truong.js';
import { LOAI_VB, TIEN_DO, dsCoQuanTrinh } from './chuan-hoa.js';
import { KHONG_THUOC } from '../muc-tieu.js';

const ten = (ds, ma) => ds.find(([m]) => m === ma)?.[1] || '';
export const nhanCanBo = (a, tenPhong) => `${a.full_name}${a.department ? ` — ${tenPhong(a.department)}` : ''}`;
// Tên ở cột "Chủ trì theo dõi": họ tên (như bảng Phụ lục); trùng họ tên với cán bộ khác → kèm phòng (nhập lại khớp đúng người).
const canBoMau = (accounts) => accounts.filter((a) => !a.is_system && !a.bi_khoa && a.role_group !== 'A0');
export function tenChuTri(a, accounts, tenPhong) {
  const trung = canBoMau(accounts).filter((x) => x.full_name === a.full_name).length > 1;
  return trung ? nhanCanBo(a, tenPhong) : a.full_name;
}

// Kiểu tiêu đề (lib/xlsx.js: 4 vàng — bắt buộc, 5 lam — tuỳ chọn, 6 lục — kết quả, 7 xám — tự đánh / mã).
const KIEU = { stt: 7, ma: 7, linh_vuc_chi_tiet: 5, van_ban_trien_khai: 5, han_xu_ly: 5, kq_mo_ta: 6 };
const RONG = { stt: 6, so_hoi_nghi: 9, so_ket_luan: 13, ngay_ban_hanh: 12, chu_tri: 24, nganh: 34, co_quan_trinh: 30, linh_vuc_chi_tiet: 20, noi_dung: 60,
  loai_thoi_han: 22, han_xu_ly: 12, tien_do: 16, kq_mo_ta: 44, van_ban_trien_khai: 28, ma: 11 };

// Danh mục cho danh sách chọn: [tiêu đề cột sheet "Danh mục", [giá trị], mã trường dùng danh sách].
function danhMuc({ dm, accounts, tenPhong }) {
  const canBo = canBoMau(accounts).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'vi'));
  const vp = (dm.donVi || []).filter((d) => d.ma === 'VAN_PHONG_TINH_UY').map((d) => d.ten);
  return [
    ['Chủ trì theo dõi', [...vp, ...canBo.map((a) => tenChuTri(a, accounts, tenPhong))], 'chu_tri'],
    ['Ngành/lĩnh vực', (dm.nganh || []).filter((n) => n.ma !== KHONG_THUOC).map((n) => n.ten), 'nganh'],
    ['Cơ quan/đơn vị trình', dsCoQuanTrinh(dm).sort((a, b) => (a.thu_tu ?? 99) - (b.thu_tu ?? 99) || a.ten.localeCompare(b.ten, 'vi', { numeric: true })).map((d) => d.ten), 'co_quan_trinh'],
    ['Loại thời hạn', (dm.loaiThoiHan || []).map((l) => l.ten), 'loai_thoi_han'],
    ['Tiến độ', TIEN_DO.map(([, t]) => t), 'tien_do'],
    ['Loại văn bản (chọn khi nhập)', LOAI_VB.map(([, t]) => t), ''],
  ];
}
const chuCot = (i) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

const HUONG_DAN = [
  ['Mẫu nhập chuẩn VPTU-TASK — mỗi dòng ở sheet "Nhập liệu" là một nhiệm vụ; các cột giống bảng Phụ lục theo dõi kết luận của Văn phòng.'],
  ['Điền đủ các cột B đến M (nền vàng là bắt buộc) thì nhập được ngay, không phải hoàn thiện thêm. Số hội nghị bắt buộc với Kết luận Hội nghị Ban Thường vụ; Hạn xử lý bắt buộc khi loại là "Có hạn cụ thể".'],
  ['Chủ trì theo dõi: họ tên cán bộ (là người chủ trì và theo dõi việc), hoặc "VPTU" khi giao chung cho Văn phòng Tỉnh ủy.'],
  ['Loại văn bản không có cột riêng: chọn một lần cho cả tệp ở bước nhập (hệ thống đoán sẵn theo dòng tiêu đề của bảng, ví dụ "…Thường trực Tỉnh ủy" → Thông báo của Thường trực).'],
  ['Ô hệ thống cần mà bảng không có được điền theo quy tắc, ghi rõ ở bản xem trước: sản phẩm đầu ra theo nội dung (mặc định Báo cáo), lĩnh vực theo ngành và lĩnh vực chi tiết, đơn vị chủ trì theo cán bộ chủ trì.'],
  ['Việc đang thực hiện chưa có hạn: hạn = 1 tháng kể từ ngày nhập. Loại "Nhiệm vụ thường xuyên" / "Chờ quyết định" của việc mới chuyển thành "Có hạn cụ thể" (loại gốc ghi ở ghi chú).'],
  ['Tiến độ "Hoàn thành": khi nhập chọn "Đã xong ngoài hệ thống" (đóng ngay; cột M thành minh chứng) hoặc "Ghi minh chứng". "Chưa hoàn thành (quá hạn)" tính là đang thực hiện — quá hạn do hệ thống tự tính theo hạn.'],
  ['Mã nhiệm vụ (cột O, nền xám): để trống khi nhập việc mới. Có mã → cập nhật việc đó; ô trống không xoá dữ liệu đang có. Đổi chủ trì / hạn dùng Giao lại / Gia hạn trên hệ thống.'],
  ['Ngày ghi dd/mm/yyyy. Ô có danh sách chọn lấy từ sheet "Danh mục"; gõ giá trị khác vẫn được — hệ thống thử khớp và hỏi lại khi chưa chắc.'],
];

// rows: dòng v_nhiem_vu (Xuất theo mẫu; ket_qua_xuat = kết quả / minh chứng đọc kèm) — rỗng: mẫu trống. ctx: { dm, accounts, tenPhong, findAccount }
export function taoMauNhap(ctx, rows = []) {
  const ds = danhMuc(ctx);
  const cotDm = (k) => ds.findIndex(([, , x]) => x === k);
  const cot = COT_MAU.map(([k, nhan]) => ({ nhan, rong: RONG[k] || 16, kieu: ['ngay_ban_hanh', 'han_xu_ly'].includes(k) ? 'ngay' : undefined, sTieuDe: KIEU[k] || 4 }));
  const kiemTra = COT_MAU.map(([k], i) => [i, cotDm(k)]).filter(([, j]) => j >= 0 && ds[j][1].length)
    .map(([i, j]) => ({ cot: i, nguon: `'Danh mục'!$${chuCot(j)}$2:$${chuCot(j)}$${ds[j][1].length + 1}`, den: Math.max(1001, rows.length + 501) }));
  const dai = Math.max(...ds.map(([, v]) => v.length));
  return taoXlsx([
    { ten: 'Nhập liệu', cot, dong: rows.map((r, i) => COT_MAU.map(([k]) => giaTriXuat(r, k, i, ctx))), kiemTra },
    { ten: 'Danh mục', cot: ds.map(([nhan]) => ({ nhan, rong: 34 })), dong: Array.from({ length: dai }, (_, i) => ds.map(([, v]) => v[i] ?? null)) },
    { ten: 'Hướng dẫn', cot: [{ nhan: 'Hướng dẫn nhập', rong: 150 }], dong: HUONG_DAN },
  ]);
}

// Giá trị một ô khi xuất việc đang có theo mẫu (tên hiển thị — nhập lại khớp ngược về mã).
function giaTriXuat(r, k, i, { findAccount, tenPhong, accounts = [] }) {
  switch (k) {
    case 'stt': return i + 1;
    case 'so_hoi_nghi': return r.so_hoi_nghi ?? null;
    case 'chu_tri': { const a = r.owner_tai_khoan && findAccount(r.owner_tai_khoan); return a ? tenChuTri(a, accounts, tenPhong) : r.owner_don_vi_ten || ''; }
    case 'nganh': return r.nganh_ten || '';
    case 'co_quan_trinh': return r.co_quan_trinh_ten || '';
    case 'loai_thoi_han': return r.loai_thoi_han_ten || '';
    case 'tien_do': return ten(TIEN_DO, r.tien_do_ma);
    case 'kq_mo_ta': return r.ket_qua_xuat || '';
    default: return r[k] ?? '';   // so_ket_luan, ngay_ban_hanh, linh_vuc_chi_tiet, noi_dung, han_xu_ly, van_ban_trien_khai, ma
  }
}

// Kết quả / minh chứng một việc để xuất cột M: minh chứng mới nhất còn hiệu lực — số hiệu, ngày, trích yếu, mô tả; minh chứng chữ (dữ liệu chuyển đổi).
export function chuKetQua(mc) {
  if (!mc) return '';
  const ngay = mc.ngay_van_ban ? String(mc.ngay_van_ban).split('-').reverse().join('/') : '';
  return [mc.so_hieu ? `Số ${mc.so_hieu}` : '', ngay ? `ngày ${ngay}` : '', mc.trich_yeu, mc.mo_ta_ket_qua, mc.noi_dung_chu].filter(Boolean).join(' · ');
}
