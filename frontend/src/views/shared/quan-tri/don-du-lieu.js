// Khu "Dọn dữ liệu" (quan_tri_he_thong, 0042): bước 1 qt_xem_truoc_xoa → bảng số dòng; bước 2 gõ XOÁ → qt_xoa_du_lieu (ghi nhat_ky_he_thong).
// Trước khi xoá, app kiểm mốc backup (dòng nhat_ky_he_thong hanh_dong = 'backup' mới nhất, do workflow backup ghi qua ghi_moc_backup) phải trong 24 giờ;
// không có → chặn, chỉ dẫn chạy backup.
import { supabase } from '../../../lib/supabase.js';
import { $, show, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { LINK_SAO_LUU } from '../../shell/banh-rang.js';

const TEN_BANG = { direct_messages: 'Tin nhắn / thông báo', chi_dao: 'Chỉ đạo', canh_bao: 'Cảnh báo', lich_su: 'Lịch sử', minh_chung: 'Minh chứng', dinh_chinh: 'Đính chính',
  tu_choi: 'Đề nghị từ chối', nhiem_vu: 'Nhiệm vụ', van_ban_giao_viec: 'Văn bản giao việc', quyen_lich_su: 'Nhật ký cấp quyền', phu_trach_phong: 'Phân công phụ trách',
  dm_lich_su: 'Nhật ký danh mục', accounts: 'Tài khoản (hồ sơ)', auth_users: 'Tài khoản (đăng nhập)' };
const GIO_BACKUP = 24;
let phamViDaXem = null;

// Mốc backup: dòng nhật ký 'backup' mới nhất; không có = chưa từng backup (hoặc chưa ghi mốc).
export async function mocBackup() {
  const { data } = await supabase.from('nhat_ky_he_thong').select('luc').eq('hanh_dong', 'backup').order('id', { ascending: false }).limit(1).maybeSingle();
  const luc = data?.luc ? new Date(data.luc) : null;
  const gioQua = luc ? (Date.now() - luc.getTime()) / 36e5 : Infinity;
  return { luc, gioQua, hopLe: gioQua <= GIO_BACKUP };
}

function veBackup(b) {
  const el = $('qtDonBackup');
  el.classList.toggle('luong-canh-bao', !b.hopLe); el.classList.toggle('luong-ok', b.hopLe);
  el.innerHTML = b.hopLe ? `Backup production gần nhất: ${formatDateTime(b.luc.toISOString())} (trong ${GIO_BACKUP} giờ) — được phép xoá.`
    : `${b.luc ? `Backup gần nhất lúc ${formatDateTime(b.luc.toISOString())}, đã quá ${GIO_BACKUP} giờ.` : 'Chưa có mốc backup nào.'} Chạy workflow <a href="${LINK_SAO_LUU}" target="_blank" rel="noopener">Backup định kỳ production</a> (Run workflow), đợi xong rồi tải lại trang này.`;
}

export function phamViTuForm() {
  const loai = $('qtDonLoai').value; const pv = $('qtDonPhamVi').value;
  const p = { loai };
  if (loai === 'du_lieu_thu') return p;
  if (pv === 'toan_bo') p.toan_bo = true;
  if (pv === 'tai_khoan') p.tai_khoan = $('qtDonTaiKhoan').value;
  if (pv === 'van_ban_id') p.van_ban_id = $('qtDonVanBan').value;
  if (pv === 'ngay') { p.tu_ngay = $('qtDonTuNgay').value || null; p.den_ngay = $('qtDonDenNgay').value || null; }
  return p;
}

function doiPhamVi() {
  const thu = $('qtDonLoai').value === 'du_lieu_thu'; const pv = $('qtDonPhamVi').value;
  show($('qtDonPhamVi').closest('label'), !thu);
  show('qtDonTkWrap', !thu && pv === 'tai_khoan'); show('qtDonVbWrap', !thu && pv === 'van_ban_id');
  show('qtDonTuWrap', !thu && pv === 'ngay'); show('qtDonDenWrap', !thu && pv === 'ngay');
  show('qtDonKetQua', false); phamViDaXem = null;
}

async function napDanhSach() {
  $('qtDonTaiKhoan').innerHTML = [...state.accounts].sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'))
    .map((a) => `<option value="${a.id}">${escapeHtml(a.full_name)} (${escapeHtml(a.username)})</option>`).join('');
  const { data } = await supabase.from('van_ban_giao_viec').select('id, so_hoi_nghi, so_ket_luan').order('created_at', { ascending: false }).limit(300);
  $('qtDonVanBan').innerHTML = (data || []).map((v) => `<option value="${v.id}">${escapeHtml(v.so_ket_luan || '')}${v.so_hoi_nghi ? ` (HN ${v.so_hoi_nghi})` : ''}</option>`).join('');
}

async function xemTruoc(e) {
  e.preventDefault();
  const p = phamViTuForm();
  const { data, error } = await supabase.rpc('qt_xem_truoc_xoa', { p_pham_vi: p });
  if (error) { notifyError(error.message); return; }
  veKetQua(data); phamViDaXem = p;
  $('qtDonXacNhan').value = ''; $('qtDonXoa').disabled = true;
  show('qtDonKetQua', true);
}

function veKetQua(kq) {
  const dong = Object.entries(kq).filter(([k]) => TEN_BANG[k]);
  $('qtDonBody').innerHTML = dong.map(([k, v]) => `<tr><td>${TEN_BANG[k]}</td><td class="phai"><b>${v}</b></td></tr>`).join('')
    + `<tr><td class="chu-phu">Nhiệm vụ trong phạm vi</td><td class="phai">${kq.so_nhiem_vu_pham_vi ?? 0}</td></tr>`;
}

async function xoa(e) {
  e.preventDefault();
  if (!phamViDaXem || $('qtDonXacNhan').value !== 'XOÁ') { notifyError('Xem trước rồi gõ đúng chữ XOÁ.'); return; }
  const b = await mocBackup(); veBackup(b);
  if (!b.hopLe) { notifyError(`Chưa có backup trong ${GIO_BACKUP} giờ — chạy workflow backup trước.`); return; }
  $('qtDonXoa').disabled = true;
  const { data, error } = await supabase.rpc('qt_xoa_du_lieu', { p_pham_vi: phamViDaXem, p_xac_nhan: 'XOÁ' });
  if (error) { notifyError('Không xoá được: ' + error.message); return; }
  veKetQua(data); phamViDaXem = null;
  notifySuccess('Đã xoá. Kết quả ghi vào nhật ký hệ thống.');
}

export async function renderDonDuLieu() {
  await napDanhSach();
  doiPhamVi();
  veBackup(await mocBackup());
}

export function mountDonDuLieu() {
  $('qtDonForm').addEventListener('submit', xemTruoc);
  $('qtDonXoaForm').addEventListener('submit', xoa);
  $('qtDonLoai').addEventListener('change', doiPhamVi);
  $('qtDonPhamVi').addEventListener('change', doiPhamVi);
  $('qtDonXacNhan').addEventListener('input', (e) => { $('qtDonXoa').disabled = e.target.value !== 'XOÁ' || !phamViDaXem; });
}
