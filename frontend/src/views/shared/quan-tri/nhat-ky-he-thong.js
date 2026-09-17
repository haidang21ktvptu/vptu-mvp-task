// Khu "Nhật ký hệ thống" (bảng nhat_ky_he_thong 0041, RLS chỉ quan_tri_he_thong): tài khoản (Edge Function), cấu hình, dọn dữ liệu, backup.
import { supabase } from '../../../lib/supabase.js';
import { $, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { findAccount } from '../../../lib/state.js';
import { notifyError } from '../../../components/toast.js';

const TEN_HANH_DONG = { tao_tai_khoan: 'Tạo tài khoản', reset_mat_khau: 'Đặt lại mật khẩu tạm', khoa_tai_khoan: 'Khoá tài khoản', mo_tai_khoan: 'Mở khoá',
  cap_co: 'Cấp cờ', thu_co: 'Thu cờ', cau_hinh: 'Đổi ngưỡng cảnh báo', don_du_lieu: 'Dọn dữ liệu', backup: 'Backup production' };

// Chi tiết jsonb → chuỗi ngắn "khoá: giá trị", bỏ phạm vi dài của dọn dữ liệu (chỉ số dòng).
function chiTietNgan(ct) {
  if (!ct || typeof ct !== 'object') return '';
  const src = ct.ket_qua && typeof ct.ket_qua === 'object' ? Object.fromEntries(Object.entries(ct.ket_qua).filter(([, v]) => typeof v === 'number' && v > 0)) : ct;
  return Object.entries(src).filter(([k]) => k !== 'pham_vi').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ').slice(0, 160);
}

const rowHtml = (r) => `<tr><td class="whitespace-nowrap">${formatDateTime(r.luc)}</td><td data-nhan="Người">${escapeHtml(r.nguoi ? findAccount(r.nguoi)?.full_name || r.nguoi : 'Hệ thống / workflow')}</td>
  <td data-nhan="Hành động">${escapeHtml(TEN_HANH_DONG[r.hanh_dong] || r.hanh_dong)}</td><td data-nhan="Đối tượng">${escapeHtml(r.doi_tuong || '')}</td><td data-nhan="Chi tiết" class="chu-phu">${escapeHtml(chiTietNgan(r.chi_tiet))}</td></tr>`;

export async function renderNhatKyHeThong() {
  const { data, error } = await supabase.from('nhat_ky_he_thong').select('luc, nguoi, hanh_dong, doi_tuong, chi_tiet').order('id', { ascending: false }).limit(100);
  if (error) { notifyError('Không đọc được nhật ký hệ thống: ' + error.message); return; }
  $('qtNhatKyHeThongBody').innerHTML = data.length ? data.map(rowHtml).join('') : '<tr><td colspan="5" class="trong">Chưa có dòng nào.</td></tr>';
}
