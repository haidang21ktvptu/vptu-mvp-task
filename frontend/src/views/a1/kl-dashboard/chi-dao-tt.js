// Hàng 0 dashboard "Chỉ đạo Thường trực" (GĐ19, CH-16, v_chi_dao_tt 0032): A1 thấy các chỉ đạo Thường trực mình là người
// nhận — chờ phản hồi xếp trước (đếm ở tiêu đề = cấp cần quyết định), quá hạn tô đỏ; nút "Phản hồi" mở ngăn chi tiết của việc
// với con trỏ vào ô nhập. A0 thấy chỉ đạo mình đã gửi và trạng thái phản hồi (ai, lúc nào). Vai khác: khối ẩn.
import { $, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { TEN_TRANG_THAI_CHI_DAO } from '../../../lib/kl/dieu-hanh.js';
import { laA0, duocChiDao } from '../../shared/kl/chi-dao.js';
import { moNgoaiLe } from './ngoai-le.js';

const LOP_TT = { CHO_PHAN_HOI: 'muc muc-vang', DA_PHAN_HOI: 'muc muc-xanh', DA_DONG: 'muc' };

// Dòng của tôi: A0 = mình gửi; A1 = mình là người nhận.
export function locChiDaoTT(rows) {
  const me = state.user?.id;
  if (!me) return [];
  if (laA0()) return rows.filter((r) => r.nguoi_gui === me);
  if (duocChiDao()) return rows.filter((r) => (r.nguoi_nhan || []).includes(me));
  return [];
}

function dongHtml(r) {
  const a0 = laA0();
  const trangThai = `<span class="${LOP_TT[r.trang_thai] || 'muc'}">${TEN_TRANG_THAI_CHI_DAO[r.trang_thai] || r.trang_thai}</span>${r.qua_han_phan_hoi ? ' <span class="chu-canh-bao-inline">quá hạn</span>' : ''}`;
  const phanHoi = r.trang_thai === 'CHO_PHAN_HOI' ? '<span class="chu-phu">chưa có</span>'
    : `${escapeHtml(r.phan_hoi || '')}<small>${escapeHtml((state.accounts || []).find((a) => a.id === r.phan_hoi_boi)?.full_name || '')}${r.phan_hoi_luc ? ` · ${formatDateTime(r.phan_hoi_luc)}` : ''}</small>`;
  const nut = a0 ? 'Xem' : r.trang_thai === 'CHO_PHAN_HOI' ? 'Phản hồi' : 'Xem';
  return `
    <tr id="ttRow-${r.id}" class="${r.qua_han_phan_hoi ? 'r-do' : ''}" data-trang-thai="${escapeHtml(r.trang_thai)}">
      <td class="tieude">${escapeHtml(r.ma)}<small>hạn việc ${formatNgay(r.han_xu_ly)}</small></td>
      <td data-nhan="Chỉ đạo"><span title="${escapeHtml(r.noi_dung)}">${escapeHtml(r.noi_dung.length > 120 ? `${r.noi_dung.slice(0, 119)}…` : r.noi_dung)}</span><small>${formatDateTime(r.created_at)}</small></td>
      <td data-nhan="Người nhận" class="nguoi">${(r.nguoi_nhan_ten || []).map(escapeHtml).join('<br>')}</td>
      <td data-nhan="Hạn phản hồi" class="so">${formatNgay(r.han_phan_hoi)}</td>
      <td data-nhan="Trạng thái">${trangThai}</td>
      <td data-nhan="Phản hồi">${phanHoi}</td>
      <td><div class="thao-tac"><button type="button" class="btn ${nut === 'Phản hồi' ? 'btn-chinh' : 'btn-phu'} btn-nho" data-action="moChiDaoTT" data-id="${r.nhiem_vu_id}" data-ma="${escapeHtml(r.ma)}">${nut}</button></div></td>
    </tr>`;
}

// Vẽ khối; ẩn khi vai không liên quan hoặc A1 không có dòng nào. Trả về số chờ phản hồi (A1) để tiêu đề đếm.
export function veChiDaoTT(rows) {
  const khoi = $('klDbChiDaoTTKhoi');
  if (!khoi) return 0;
  const ds = locChiDaoTT(rows);
  const cho = ds.filter((r) => r.trang_thai === 'CHO_PHAN_HOI').length;
  const a0 = laA0();
  khoi.classList.toggle('hidden', !(a0 || ds.length > 0));
  $('klDbH0').firstChild.textContent = a0 ? `Chỉ đạo Thường trực đã gửi (${cho} chờ phản hồi)` : `Chỉ đạo Thường trực chờ phản hồi (${cho})`;
  $('klDbH0Phu').textContent = a0 ? ' — trạng thái phản hồi của Chánh Văn phòng / PCVP phụ trách; bấm Xem để mở luồng trên nhiệm vụ'
    : ' — Chánh Văn phòng / PCVP phụ trách phản hồi hoặc chuyển thành chỉ đạo điều hành trong hạn';
  $('klDbChiDaoTT').innerHTML = ds.length === 0 ? '<p class="bd-trong">Chưa có chỉ đạo Thường trực nào.</p>' : `
    <div class="bang-cuon"><table class="nl-bang tt-bang">
      <thead><tr><th>Mã · Hạn việc</th><th>Chỉ đạo</th><th>Người nhận</th><th class="so">Hạn phản hồi</th><th>Trạng thái</th><th>Phản hồi</th><th class="phai">Thao tác</th></tr></thead>
      <tbody id="klDbChiDaoTTBody">${ds.map(dongHtml).join('')}</tbody>
    </table></div>`;
  return cho;
}

const moChiDaoTT = ({ id, ma }) => moNgoaiLe(id, ma, 'chi-dao');
export function mountChiDaoTT(registerActions) {
  registerActions({ moChiDaoTT });
}
