// Phần THUẦN của Quản trị › Danh mục mục tiêu và Cấu hình AI (v3.25, migration 0107–0112): nhãn tiếng Việt, quyền HIỂN THỊ (chỉ ẩn / hiện nút —
// hàm DB là chốt), lọc danh mục, mô tả kết quả kiểm thử / soạn quy tắc, nhà cung cấp AI, so sánh cấu hình, mô tả dòng nhật ký danh mục (dm_lich_su).
// Không DOM, không Supabase — unit test frontend/tests/quan-tri-muc-tieu.test.mjs.
import { boDau } from '../../../lib/tim-chon.js';

// Quyền theo kl_quyen_muc_tieu (0108): QUAN_TRI = quản trị hệ thống hoặc tài khoản toàn quyền (0100, Thường trực không bao giờ là toàn quyền);
// NHAP = mọi cán bộ nhập liệu (kl_nguoi_nhap: không Thường trực, không tài khoản hệ thống, không bị khoá).
const hoatDong = (u) => Boolean(u) && !u.bi_khoa && !u.is_system;
export const laQuanTriMt = (u) => hoatDong(u) && (Boolean(u.quan_tri_he_thong) || (Boolean(u.toan_quyen) && (u.vai_goc || u.role_group) !== 'A0'));
export const laNhapMt = (u) => hoatDong(u) && u.role_group !== 'A0';
// 'sua' | 'mo_khoa_truoc' (quản trị: mục đã đối chiếu phải mở khoá trước) | null — như kl_sua_muc_tieu.
export function quyenSuaMt(u, m) {
  if (!m || m.gop_vao) return null;
  if (laQuanTriMt(u)) return m.trang_thai === 'DA_DOI_CHIEU' ? 'mo_khoa_truoc' : 'sua';
  return laNhapMt(u) && m.tao_boi === u.id && m.trang_thai === 'MOI' && m.nguon_them === 'NGUOI_DUNG' ? 'sua' : null;
}

export const TRANG_THAI_MT = { MOI: 'Mới — chờ đối chiếu', DA_DOI_CHIEU: 'Đã đối chiếu' };
export const NGUON_THEM = { KHOI_TAO: 'Khởi tạo', NGUOI_DUNG: 'Cán bộ bổ sung', TU_DONG: 'Hệ thống tự thêm' };
export const LOAI_QT = { SO_HIEU: 'Số hiệu văn bản', TU_KHOA: 'Từ khoá', LINH_VUC: 'Lĩnh vực', NGANH: 'Ngành', LOAI_TRU: 'Từ loại trừ' };
export const MUC_QT = { TU_TICH: 'Tích sẵn', GOI_Y: 'Gợi ý' };
export const TT_QT = { DE_XUAT: 'Đề xuất (chờ tự kiểm)', BAT: 'Bật', TAT: 'Tắt' };
export const NGUON_QT = { KHOI_TAO: 'Khởi tạo', QUAN_TRI: 'Quản trị', AI: 'Trợ lý AI', TU_DONG: 'Tự động' };
// Bộ lọc trạng thái của bảng danh mục (giá trị ô chọn qtMtLocTT).
export const LOC_TRANG_THAI = [['', 'Đang dùng'], ['MOI', 'Mới — chờ đối chiếu'], ['DA_DOI_CHIEU', 'Đã đối chiếu'], ['NGUNG', 'Ngừng dùng, đã gộp'], ['TAT_CA', 'Tất cả']];

export function locMucTieu(ds, { tim = '', nhom = '', trangThai = '' } = {}) {
  const q = boDau(tim).trim();
  const dung = (m) => m.dang_dung !== false && !m.gop_vao;
  const theoTt = { '': dung, MOI: (m) => dung(m) && m.trang_thai === 'MOI', DA_DOI_CHIEU: (m) => dung(m) && m.trang_thai === 'DA_DOI_CHIEU', NGUNG: (m) => !dung(m), TAT_CA: () => true };
  const khop = theoTt[trangThai] || dung;
  return (ds || []).filter((m) => (!nhom || m.nhom === nhom) && khop(m)
    && (!q || boDau(`${m.ten_ngan} ${m.ten} ${m.so_hieu || ''} ${m.mo_ta || ''} ${m.ma}`).includes(q)));
}

export const tyLe = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
// Bộ đếm tự học của một quy tắc: tích sẵn → được giữ / bị bỏ; gợi ý → được bấm thêm / không chọn.
export function demQuyTac(q) {
  const hien = q?.so_lan_hien || 0; const nhan = q?.so_lan_nhan || 0; const bo = q?.so_lan_bo || 0;
  if (!hien) return 'chưa hiện lần nào';
  return q.muc === 'TU_TICH' ? `hiện ${hien} · giữ ${nhan} (${tyLe(nhan, hien)}) · bỏ ${bo}` : `hiện ${hien} · được chọn ${nhan} (${tyLe(nhan, hien)}) · không chọn ${bo}`;
}
// kiem_thu_quy_tac (0111): { tong, khop, xac_nhan, dung }.
export function moTaKiemThu(k) {
  if (!k) return '';
  const tong = Number(k.tong) || 0; const khop = Number(k.khop) || 0; const xn = Number(k.xac_nhan) || 0; const dung = Number(k.dung) || 0;
  const dau = `Khớp ${khop}/${tong} việc gốc${tong ? ` (${tyLe(khop, tong)})` : ''}`;
  const sau = xn ? `; trong ${xn} việc khớp đã gắn mục tiêu, ${dung} việc đúng mục tiêu này (${tyLe(dung, xn)})` : '; chưa có việc khớp nào đã gắn mục tiêu để đối chiếu';
  const rong = tong >= 20 && khop * 100 > tong * 15 ? ' — quá rộng (khớp trên 15% số việc), nên thu hẹp cụm từ.' : '.';
  return `${dau}${sau}${rong}`;
}
// ai_ghi_quy_tac (0112) qua Edge Function: { them, quy_tac: [{ loai, gia_tri, trang_thai, ly_do }] }.
export function moTaSoanAi(kq) {
  const ds = kq?.quy_tac || []; const them = Number(kq?.them) || 0;
  if (!them) return 'Trợ lý AI không có quy tắc mới (trùng quy tắc đã có hoặc giá trị không hợp lệ).';
  const bat = ds.filter((x) => x.trang_thai === 'BAT').length; const tat = ds.filter((x) => x.trang_thai === 'TAT').length;
  return `Trợ lý AI thêm ${them} quy tắc: ${bat} đang bật (từ khoá ở mức gợi ý, từ loại trừ áp ngay)${tat ? `, ${tat} tự tắt sau khi kiểm trên dữ liệu (quá rộng hoặc trái với việc đã gắn)` : ''}.`;
}

// Nhà cung cấp AI — cùng tên secret cố định với Edge Function (supabase/functions/tro-ly-ai/nha-cung-cap.js NHA_CUNG_CAP; unit test đối chiếu).
// Mô hình là gợi ý; quản trị gõ được tên khác theo bảng giá / tên hiện hành của nhà cung cấp.
export const NHA_CUNG_CAP_AI = [
  { ma: 'anthropic', ten: 'Claude (Anthropic)', khoa: 'AI_KEY_ANTHROPIC', moHinh: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'], moTa: 'Messages API — đọc văn bản, soạn quy tắc' },
  { ma: 'openai', ten: 'ChatGPT (OpenAI)', khoa: 'AI_KEY_OPENAI', moHinh: ['gpt-5', 'gpt-5-mini'], moTa: 'chuẩn Chat Completions' },
  { ma: 'gemini', ten: 'Gemini (Google)', khoa: 'AI_KEY_GEMINI', moHinh: ['gemini-2.5-pro', 'gemini-2.5-flash'], moTa: 'qua cổng tương thích OpenAI của Google' },
  { ma: 'khac', ten: 'Dịch vụ khác theo chuẩn OpenAI', khoa: 'AI_KEY_KHAC', moHinh: [], moTa: 'ví dụ dịch vụ trong nước — cần địa chỉ https', canDiaChi: true },
];
export const timNhaCungCap = (ma) => NHA_CUNG_CAP_AI.find((x) => x.ma === ma) || null;
export const hoaDau = (s) => (s ? s.charAt(0).toLocaleUpperCase('vi') + s.slice(1) : s);
// Số giây kiểu Việt Nam (dấu phẩy thập phân): 14200 ms → "14,2 giây".
export const giay = (ms) => `${(Number(ms || 0) / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giây`;
export const MUC_SUY_NGHI = [['low', 'Thấp — nhanh, ít tốn'], ['medium', 'Vừa (khuyên dùng)'], ['high', 'Cao — kỹ hơn, chậm hơn']];
export const HANH_DONG_AI = { DOC_VAN_BAN: 'Đọc văn bản', SOAN_QUY_TAC: 'Soạn quy tắc', HOC_DEM: 'Học đêm', KIEM_TRA: 'Kiểm tra kết nối' };
export const KET_QUA_AI = { OK: 'Thành công', LOI: 'Lỗi', TU_CHOI: 'Từ chối (hết lượt)', DANG: 'Đang xử lý (chưa ghi kết quả)' };   // DANG: lượt đã giữ — 0112
const KHOA_AI = ['nha_cung_cap', 'mo_hinh', 'dia_chi', 'muc_suy_nghi', 'bat', 'gui_noi_dung', 'gioi_han_ngay', 'gioi_han_nguoi'];
const chuan = (v) => (v === undefined || v === '' ? null : v);
// Khoá đổi so với cấu hình đang lưu (gửi qt_dat_cau_hinh_ai chỉ phần đổi — hàm DB từ chối "không có gì thay đổi").
export function doiCauHinhAi(cu, moi) {
  const d = {};
  KHOA_AI.forEach((k) => { if (k in moi && JSON.stringify(chuan(cu?.[k])) !== JSON.stringify(chuan(moi[k]))) d[k] = chuan(moi[k]); });
  return d;
}
// Kiểm như CHECK của bảng cau_hinh_ai (báo sớm bằng tiếng Việt; DB vẫn là chốt). → chuỗi lỗi | null.
export function kiemCauHinhAi(p) {
  if (!timNhaCungCap(p.nha_cung_cap)) return 'Chọn nhà cung cấp dịch vụ AI.';
  if (!/^[A-Za-z0-9._:/-]{2,100}$/.test(p.mo_hinh || '')) return 'Tên mô hình gồm chữ không dấu, số và các dấu . _ : / - (2–100 ký tự), ví dụ claude-sonnet-5-5.';
  if (p.nha_cung_cap === 'khac' && !p.dia_chi) return 'Dịch vụ khác cần địa chỉ https của dịch vụ (ví dụ https://api.dichvu.vn/v1).';
  if (p.dia_chi && (p.dia_chi.length > 200 || !/^https:\/\/[A-Za-z0-9.-]+(:[0-9]{2,5})?(\/[A-Za-z0-9._~/-]*)?$/.test(p.dia_chi))) return 'Địa chỉ dịch vụ phải bắt đầu bằng https:// và không có khoảng trắng, dấu ? hay #.';
  if (!MUC_SUY_NGHI.some(([m]) => m === p.muc_suy_nghi)) return 'Chọn mức suy nghĩ.';
  if (!Number.isInteger(p.gioi_han_ngay) || p.gioi_han_ngay < 1 || p.gioi_han_ngay > 100000) return 'Giới hạn lượt mỗi ngày (toàn hệ thống) từ 1 đến 100000.';
  if (!Number.isInteger(p.gioi_han_nguoi) || p.gioi_han_nguoi < 1 || p.gioi_han_nguoi > 10000) return 'Giới hạn lượt mỗi người mỗi ngày từ 1 đến 10000.';
  return null;
}

// Nhật ký danh mục (dm_lich_su — 0020, 0107): nhãn hành động, bảng, mô tả thay đổi "cột: cũ → mới".
export const TEN_HANH_DONG_DM = { them: 'Thêm', sua: 'Sửa', khoa: 'Khoá (đã đối chiếu)', mo_khoa: 'Mở khoá', ngung: 'Ngừng dùng', dung_lai: 'Dùng lại', gop: 'Gộp mục trùng',
  khoi_phuc: 'Khôi phục', tu_dong: 'Hệ thống tự thêm', doi_muc: 'Tự đổi mức', bat: 'Bật', tat: 'Tắt' };
export const TEN_BANG_DM = { dm_linh_vuc: 'lĩnh vực', dm_nganh: 'ngành', dm_muc_tieu: 'mục tiêu', quy_tac_muc_tieu: 'quy tắc nhận diện', dm_nhom_muc_tieu: 'nhóm mục tiêu',
  dm_khoi_linh_vuc: 'khối lĩnh vực' };
const TEN_COT = { ten: 'tên', ten_ngan: 'tên ngắn', thu_tu: 'thứ tự', mo_ta: 'nội dung', can_cu: 'căn cứ', chi_tieu: 'chỉ tiêu', so_hieu: 'số hiệu', nhom: 'nhóm', muc: 'mức',
  trang_thai: 'trạng thái', khoa: 'khoá cố định', ghi_chu: 'ghi chú', dang_dung: 'đang dùng', khoi_ma: 'khối', tab: 'nhãn thẻ', mau_so_hieu: 'dạng số hiệu', gop_vao: 'gộp vào',
  nganh_ma: 'ngành', loai: 'loại', gia_tri: 'giá trị', muc_tieu_ma: 'mục tiêu' };
// ten: { khoi(mã), nganh(mã) } → tên hiển thị (không có thì giữ mã).
export function giaTriDm(k, v, ten = {}) {
  if (v === null || v === undefined || v === '') return '(trống)';
  if (typeof v === 'boolean') return v ? 'có' : 'không';
  if (k === 'muc') return MUC_QT[v] || v;
  if (k === 'trang_thai') return TT_QT[v] || TRANG_THAI_MT[v] || v;
  if (k === 'loai') return LOAI_QT[v] || v;
  if (k === 'khoi_ma' && ten.khoi) return ten.khoi(v) || v;
  if (k === 'nganh_ma' && ten.nganh) return ten.nganh(v) || v;
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}
export function moTaThayDoiDm(r, ten = {}) {
  const moi = r?.gia_tri_moi || {}; const cu = r?.gia_tri_cu || {};
  if (r?.hanh_dong === 'them' || r?.hanh_dong === 'tu_dong') {
    if (r.bang === 'dm_linh_vuc') return `Thêm "${moi.ten ?? ''}" vào ${ten.nganh ? ten.nganh(moi.nganh_ma) : moi.nganh_ma ?? ''}`;
    if (r.bang === 'quy_tac_muc_tieu') return `${LOAI_QT[moi.loai] || moi.loai || 'Quy tắc'} "${moi.gia_tri ?? ''}" cho ${moi.muc_tieu_ma ?? ''}${moi.muc ? ` · ${MUC_QT[moi.muc] || moi.muc}` : ''}${moi.trang_thai ? ` · ${TT_QT[moi.trang_thai] || moi.trang_thai}` : ''}`;
    return `Thêm "${moi.ten_ngan || moi.ten || r.ma}"${moi.so_hieu ? ` (${moi.so_hieu})` : ''}`;
  }
  if (r?.hanh_dong === 'gop') return `Gộp vào ${moi.gop_vao ?? ''} — chuyển ${moi.so_viec ?? 0} việc, ${moi.so_van_ban ?? 0} văn bản`;
  const khoa = [...new Set([...Object.keys(moi), ...Object.keys(cu)])].filter((k) => JSON.stringify(cu[k] ?? null) !== JSON.stringify(moi[k] ?? null));   // hệ thống ghi cả cột không đổi (tự đổi mức)
  return khoa.map((k) => `${TEN_COT[k] || k}: "${giaTriDm(k, cu[k], ten)}" → "${giaTriDm(k, moi[k], ten)}"`).join('; ');
}
