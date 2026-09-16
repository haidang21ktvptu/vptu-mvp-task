// Khối "minh chứng đã nộp, chờ xác nhận" (A1/A2, mockup): mỗi dòng = mã việc, số hiệu · ngày · cấp nhận, ai nộp lúc nào; nút Hợp lệ
// (một bấm) và Không hợp lệ (mở ô lý do). Người nộp không tự xác nhận (MC-6) — ẩn nút; hàm xac_nhan_minh_chung là chốt.
import { escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { state, findAccount } from '../../../lib/state.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { tenTrongDanhMuc } from '../../../lib/kl/du-lieu.js';
import { dh, timRow } from './du-lieu.js';

export function minhChungChoHtml() {
  const ds = dh.mcCho.filter((m) => timRow(m.nhiem_vu_id));
  if (ds.length === 0) return '<p class="trong">Không có minh chứng nào chờ xác nhận.</p>';
  return `<div class="da-gui" id="dhMcCho">${ds.map((m) => {
    const r = timRow(m.nhiem_vu_id);
    const nguoi = findAccount(m.nop_boi);
    const nut = m.nop_boi === state.user?.id ? '<span class="chu-phu">minh chứng do đồng chí nộp — người khác xác nhận</span>' : `
      <button type="button" class="nut lam" data-action="mcHopLeThe" data-id="${m.id}">Hợp lệ</button>
      <button type="button" class="nut" data-action="moO" data-o="oMc-${m.id}">Không hợp lệ</button>`;
    return `<div id="mcCho-${m.id}"><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(m.loai === 'chu_cu' ? 'Minh chứng cũ' : `Văn bản ${m.so_hieu || ''}`)}${m.ngay_van_ban ? ` ngày ${formatNgay(m.ngay_van_ban)}` : ''}${m.cap_nhan ? `, cấp nhận: ${escapeHtml(tenTrongDanhMuc('cap', m.cap_nhan))}` : ''}
        <small>${escapeHtml(r.noi_dung)} · ${escapeHtml(nguoi?.full_name || 'không xác định')}${nguoi?.department ? ` (${escapeHtml(DEPT_NAMES[nguoi.department] || nguoi.department)})` : ''} nộp ${formatDateTime(m.nop_luc)}</small></p>
      ${nut}
      <form class="o" id="oMc-${m.id}" data-submit="mcKhongHopLeThe" data-id="${m.id}"><input name="noi_dung" required placeholder="Lý do không hợp lệ (bắt buộc)" aria-label="Lý do không hợp lệ">
        <button type="submit" class="nut chinh">Ghi không hợp lệ</button><button type="button" class="nut" data-action="dongO" data-o="oMc-${m.id}">Huỷ</button></form>
    </div>`;
  }).join('')}</div>`;
}
