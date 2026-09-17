// Màn hình Cá nhân (GĐ23): Hồ sơ (chỉ sửa ảnh, điện thoại → cap_nhat_ho_so; ảnh lên bucket anh-ho-so thư mục <uid>/), Thông báo (dat_tuy_chon),
// trang Trợ giúp theo vai; A0 có "Bản gọn" (tuy_chon.ban_gon → body.ban-gon). Quyền thật ở hàm SQL/RLS Storage.
import { supabase } from '../../../lib/supabase.js';
import { $, show, setText, escapeHtml } from '../../../lib/dom.js';
import { DEPT_NAMES, nhanChucDanh } from '../../../lib/constants.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { showSection, setActiveNav, renderAvatar } from '../../shell/index.js';
import { renderBanhRang } from '../../shell/banh-rang.js';
import { caNhanTemplate, troGiupTemplate } from './template.js';
import { troGiupHtml } from './tro-giup.js';

const rpc = async (fn, args) => { const { data, error } = await supabase.rpc(fn, args); if (error) throw new Error(error.message); return data; };

function chonTabCaNhan({ tab }) {
  show('cnKhuHoSo', tab === 'hoSo'); show('cnKhuThongBao', tab === 'thongBao');
  $('cnTabHoSo').setAttribute('aria-selected', String(tab === 'hoSo'));
  $('cnTabThongBao').setAttribute('aria-selected', String(tab === 'thongBao'));
}

function renderHoSo() {
  const u = state.user;
  setText('cnTen', u.full_name); setText('cnChucDanh', u.position_title || nhanChucDanh(u));
  setText('cnPhong', DEPT_NAMES[u.department] || (u.role_group === 'A0' ? 'Thường trực Tỉnh ủy' : u.department || '—'));
  setText('cnUsername', u.username);
  $('cnDienThoai').value = u.dien_thoai || '';
  $('cnAvatar').innerHTML = u.anh_url ? `<img src="${escapeHtml(u.anh_url)}" alt="">` : escapeHtml((u.full_name || '?').trim().split(/\s+/).pop().charAt(0).toUpperCase());
  $('cnAmChuong').checked = u.tuy_chon?.am_chuong === true;
  $('cnGomTin').checked = u.tuy_chon?.gom_tin === true;
}

function openCaNhan({ tab }) {
  showSection('viewCaNhan'); setActiveNav('');
  renderHoSo();
  chonTabCaNhan({ tab: tab === 'thongBao' ? 'thongBao' : 'hoSo' });
}

function openTroGiup() {
  showSection('viewTroGiup'); setActiveNav('');
  $('tgNoiDung').innerHTML = troGiupHtml(state.user?.role_group);
}

// Tải ảnh lên Storage (ghi đè <uid>/anh.<ext>), rồi lưu URL công khai kèm điện thoại hiện có.
async function taiAnh(file) {
  if (!file) return null;
  if (file.size > 2 * 1024 * 1024) throw new Error('Ảnh vượt 2 MB.');
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
  if (!ext) throw new Error('Chỉ nhận ảnh JPG, PNG hoặc WebP.');
  const path = `${state.user.id}/anh.${ext}`;
  const { error } = await supabase.storage.from('anh-ho-so').upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error('Không tải được ảnh: ' + error.message);
  return `${supabase.storage.from('anh-ho-so').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
}

async function luuHoSo(e) {
  e.preventDefault();
  const btn = $('cnLuuHoSo'); btn.disabled = true;
  try {
    const anh = (await taiAnh($('cnAnhFile').files[0])) || state.user.anh_url || null;
    await rpc('cap_nhat_ho_so', { p_dien_thoai: $('cnDienThoai').value, p_anh_url: anh });
    state.user = { ...state.user, dien_thoai: $('cnDienThoai').value.trim() || null, anh_url: anh };
    $('cnAnhFile').value = '';
    renderHoSo(); renderAvatar();
    notifySuccess('Đã lưu hồ sơ.');
  } catch (err) { notifyError(err.message); } finally { btn.disabled = false; }
}

async function doiTuyChon(e) {
  const khoa = e.target.dataset.khoa; if (!khoa) return;
  try {
    const tuyChon = await rpc('dat_tuy_chon', { p_tuy_chon: { [khoa]: e.target.checked } });
    state.user = { ...state.user, tuy_chon: tuyChon };
    notifySuccess('Đã lưu tuỳ chọn.');
  } catch (err) { e.target.checked = !e.target.checked; notifyError(err.message); }
}

// A0 Bản gọn: lưu vào tuy_chon để mọi thiết bị của Thường trực giống nhau.
async function toggleBanGon() {
  const bat = !(state.user.tuy_chon?.ban_gon === true);
  try {
    const tuyChon = await rpc('dat_tuy_chon', { p_tuy_chon: { ban_gon: bat } });
    state.user = { ...state.user, tuy_chon: tuyChon };
    document.body.classList.toggle('ban-gon', bat);
    renderBanhRang();
    notifySuccess(bat ? 'Đã bật bản gọn.' : 'Đã tắt bản gọn.');
  } catch (err) { notifyError(err.message); }
}

export function registerCaNhanView() {
  $('viewCaNhan').innerHTML = caNhanTemplate;
  $('viewTroGiup').innerHTML = troGiupTemplate;
  $('cnHoSoForm').addEventListener('submit', luuHoSo);
  $('cnKhuThongBao').addEventListener('change', doiTuyChon);
  registerActions({ openCaNhan, openTroGiup, chonTabCaNhan, toggleBanGon });
}
