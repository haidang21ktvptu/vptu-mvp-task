// Khu "Nhật ký hệ thống" (bảng nhat_ky_he_thong 0041, RLS chỉ quan_tri_he_thong): tài khoản (Edge Function), cấu hình, dọn dữ liệu, backup.
import { supabase } from '../../../lib/supabase.js';
import { $, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { findAccount } from '../../../lib/state.js';
import { notifyError } from '../../../components/toast.js';

// Mã hành động (Edge Function quan-tri-tai-khoan, hàm admin_*, nhat_ky_ghi, workflow backup) → nhãn tiếng Việt; mã lạ hiện nguyên.
const TEN_HANH_DONG = { tao_tai_khoan: 'Tạo tài khoản', reset_mat_khau: 'Đặt lại mật khẩu tạm', khoa_tai_khoan: 'Khoá tài khoản', mo_tai_khoan: 'Mở khoá tài khoản',
  sua_tai_khoan: 'Sửa vai trò / phòng / chức danh', cap_co: 'Cấp hoặc thu quyền', thu_co: 'Thu quyền', cau_hinh: 'Đổi ngưỡng cảnh báo', ngay_nghi: 'Sửa lịch ngày nghỉ',
  don_du_lieu: 'Dọn dữ liệu', backup: 'Sao lưu production', nhap_excel_mo_lo: 'Nhập Excel — mở lô', nhap_excel_chot_lo: 'Nhập Excel — chốt lô',
  hoan_tac_lo: 'Nhập Excel — hoàn tác lô', ho_so_nhap_luu: 'Lưu hồ sơ ghép cột Excel', ho_so_nhap_xoa: 'Xoá hồ sơ ghép cột Excel', tu_dien_nhap_luu: 'Thêm từ điển chuẩn hoá Excel',
  reset_hang_loat: 'Bàn giao tài khoản — đặt lại mật khẩu hàng loạt' };
// Khoá trong cột chi tiết → tiếng Việt (giá trị giữ nguyên: mã cờ, số dòng…).
const TEN_KHOA = { co: 'quyền', bat: 'bật', ly_do: 'lý do', ghi_chu: 'ghi chú', cu: 'cũ', moi: 'mới', full_name: 'họ tên', role_group: 'vai trò', department: 'phòng',
  so_dong: 'số dòng', tep: 'tệp', ma: 'mã', mau: 'mẫu', che_do_xong: 'việc đã xong', so_cot: 'số cột', so_muc: 'số mục', hoan_tac: 'hoàn tác', giu_lai: 'giữ lại',
  GIAO: 'giao', DA_XONG: 'đã xong', CHO_NGHIEM_THU: 'chờ nghiệm thu', CAP_NHAT: 'cập nhật', CHO_HOAN_THIEN: 'chờ hoàn thiện', BO_QUA: 'bỏ qua',
  nhiem_vu: 'nhiệm vụ', chi_dao: 'chỉ đạo', minh_chung: 'minh chứng', lich_su: 'lịch sử', canh_bao: 'cảnh báo', tin_nhan: 'tin nhắn', van_ban: 'văn bản', tai_khoan: 'tài khoản',
  so_dat_lai: 'đặt lại', so_bo_qua: 'bỏ qua', ke_ca_dang_dung: 'kể cả đang dùng', hang_loat: 'hàng loạt' };
const TEN_CO = { quan_tri_kl: 'quản trị nhiệm vụ', quan_tri_he_thong: 'quản trị hệ thống', thu_ky_thuong_truc: 'thư ký Thường trực' };
const giaTri = (k, v) => (k === 'co' && TEN_CO[v]) || (k === 'bat' ? (v ? 'cấp' : 'thu') : typeof v === 'object' ? JSON.stringify(v) : String(v));

// Chi tiết jsonb → chuỗi ngắn "khoá: giá trị" (khoá dịch sang tiếng Việt), bỏ phạm vi dài của dọn dữ liệu (chỉ số dòng).
function chiTietNgan(ct) {
  if (!ct || typeof ct !== 'object') return '';
  const src = ct.ket_qua && typeof ct.ket_qua === 'object' ? Object.fromEntries(Object.entries(ct.ket_qua).filter(([, v]) => typeof v === 'number' && v > 0)) : ct;
  return Object.entries(src).filter(([k]) => k !== 'pham_vi').map(([k, v]) => `${TEN_KHOA[k] || k}: ${giaTri(k, v)}`).join(' · ').slice(0, 160);
}

const rowHtml = (r) => `<tr><td class="whitespace-nowrap">${formatDateTime(r.luc)}</td><td data-nhan="Người">${escapeHtml(r.nguoi ? findAccount(r.nguoi)?.full_name || r.nguoi : 'Hệ thống / workflow')}</td>
  <td data-nhan="Hành động">${escapeHtml(TEN_HANH_DONG[r.hanh_dong] || r.hanh_dong)}</td><td data-nhan="Đối tượng">${escapeHtml(r.doi_tuong || '')}</td><td data-nhan="Chi tiết" class="chu-phu">${escapeHtml(chiTietNgan(r.chi_tiet))}</td></tr>`;

export async function renderNhatKyHeThong() {
  const { data, error } = await supabase.from('nhat_ky_he_thong').select('luc, nguoi, hanh_dong, doi_tuong, chi_tiet').order('id', { ascending: false }).limit(100);
  if (error) { notifyError('Không đọc được nhật ký hệ thống: ' + error.message); return; }
  $('qtNhatKyHeThongBody').innerHTML = data.length ? data.map(rowHtml).join('') : '<tr><td colspan="5" class="trong">Chưa có dòng nào.</td></tr>';
}
