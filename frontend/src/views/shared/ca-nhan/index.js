// Màn hình Cá nhân (GĐ23): Hồ sơ (chỉ sửa ảnh, điện thoại → cap_nhat_ho_so; ảnh lên bucket riêng tư anh-ho-so thư mục <uid>/, lưu ĐƯỜNG DẪN,
// hiện bằng signed URL — PR-2a C2, lib/anh-ho-so.js), Thông báo (dat_tuy_chon),
// trang Trợ giúp theo vai; A0 có "Bản gọn" (tuy_chon.ban_gon → body.ban-gon). Quyền thật ở hàm SQL/RLS Storage.
import { supabase } from '../../../lib/supabase.js';
import { $, show, setText } from '../../../lib/dom.js';
import { veAnh, taiAnhHoSo, xoaAnhHoSo } from '../../../lib/anh-ho-so.js';
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
  veAnh($('cnAvatar'), u);
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

// Ảnh mới: tải lên tên mới → lưu đường dẫn kèm điện thoại → xoá ảnh cũ của mình. Lưu hồ sơ lỗi thì xoá ảnh vừa tải (không để tệp mồ côi).
async function luuHoSo(e) {
  e.preventDefault();
  const btn = $('cnLuuHoSo'); btn.disabled = true;
  // URL công khai cũ (trước 0052) không phải đường dẫn trong thư mục của mình → bỏ, không gửi lại (cap_nhat_ho_so sẽ từ chối).
  const uid = state.user.id; const cu = state.user.anh_url?.startsWith(`${uid}/`) ? state.user.anh_url : null; let moi = null;
  try {
    const file = $('cnAnhFile').files[0];
    if (file) moi = await taiAnhHoSo(file, uid);
    const anh = moi || cu;
    try { await rpc('cap_nhat_ho_so', { p_dien_thoai: $('cnDienThoai').value, p_anh_url: anh }); } catch (err) { await xoaAnhHoSo(moi, uid); throw err; }
    if (moi && cu && cu !== moi) xoaAnhHoSo(cu, uid);
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
