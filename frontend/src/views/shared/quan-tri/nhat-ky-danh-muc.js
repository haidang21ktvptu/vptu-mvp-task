// Nhật ký danh mục (tab Nhật ký — bảng dm_lich_su 0020; v3.25 thêm mục tiêu, quy tắc nhận diện, nhóm, khối lĩnh vực và các hành động khoá / mở khoá /
// ngừng / dùng lại / gộp / khôi phục / hệ thống tự thêm / tự đổi mức / bật / tắt — 0107). Đọc theo RLS (cán bộ nhập liệu, quản trị hệ thống).
import { supabase } from '../../../lib/supabase.js';
import { $, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { findAccount } from '../../../lib/state.js';
import { notifyError } from '../../../components/toast.js';
import { danhMucKl } from '../../../lib/kl/du-lieu.js';
import { TEN_HANH_DONG_DM, TEN_BANG_DM, moTaThayDoiDm, hoaDau } from './muc-tieu-thuan.js';
import { tenNganhNgan } from './danh-muc.js';

const esc = escapeHtml;
const LOP = { them: 'tt-xong', tu_dong: 'tt-xong', khoi_phuc: 'tt-xong', dung_lai: 'tt-xong', bat: 'tt-xong', ngung: 'tt-xam', tat: 'tt-xam', gop: 'tt-xam' };
// Mã của quy tắc là uuid — hiện loại + giá trị thay vì mã.
const doiTuong = (r) => (r.bang === 'quy_tac_muc_tieu' ? (r.gia_tri_moi?.gia_tri ? `“${r.gia_tri_moi.gia_tri}”` : 'quy tắc') : r.ma);

export async function renderNhatKyDanhMuc() {
  const { data, error } = await supabase.from('dm_lich_su')
    .select('luc, nguoi, nguoi_ghi_chu, bang, ma, hanh_dong, gia_tri_cu, gia_tri_moi, ly_do').order('id', { ascending: false }).limit(30);
  if (error) { notifyError('Không đọc được nhật ký danh mục: ' + error.message); return; }
  const ten = { nganh: tenNganhNgan, khoi: (ma) => danhMucKl().khoi?.find((k) => k.ma === ma)?.ten };
  $('qtLvNhatKyBody').innerHTML = data.length === 0
    ? '<tr><td colspan="6" class="trong">Chưa có thay đổi danh mục nào.</td></tr>'
    : data.map((r) => `
      <tr>
        <td class="whitespace-nowrap">${formatDateTime(r.luc)}</td>
        <td data-nhan="Người thực hiện">${esc(r.nguoi ? findAccount(r.nguoi)?.full_name || r.nguoi : (hoaDau(r.nguoi_ghi_chu) || 'Hệ thống'))}</td>
        <td data-nhan="Hành động"><span class="trang-thai ${LOP[r.hanh_dong] || 'tt-cho'}">${esc(TEN_HANH_DONG_DM[r.hanh_dong] || r.hanh_dong)}</span></td>
        <td data-nhan="Mục"><code class="text-xs">${esc(doiTuong(r))}</code><small class="chu-phu qt-mt-nguoi">${esc(TEN_BANG_DM[r.bang] || r.bang)}</small></td>
        <td data-nhan="Thay đổi">${esc(moTaThayDoiDm(r, ten))}</td>
        <td data-nhan="Lý do">${esc(r.ly_do)}</td>
      </tr>`).join('');
}
