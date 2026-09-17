// Khối "Đề nghị từ chối nhận việc, cần duyệt" (A1 Điều hành hôm nay / A2 Phòng tôi, 0034): đề nghị mà tôi là cấp duyệt — mã, nội dung việc,
// người đề nghị, lý do (RLS: chỉ người đề nghị, cấp duyệt và cấp trên đọc được), ô ý kiến + Đồng ý / Không đồng ý (duyet_tu_choi là chốt).
import { escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { findAccount } from '../../../lib/state.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { tuChoiChoToiDuyet, timRow } from './du-lieu.js';

function dongHtml(t) {
  const r = timRow(t.nhiem_vu_id); const a = findAccount(t.nguoi_de_nghi);
  return `<div class="the-con" id="tc-${t.id}" data-nhiem-vu="${r.id}">
      <p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(r.noi_dung)}, hạn ${r.han_xu_ly ? formatNgay(r.han_xu_ly) : 'chưa có'} · <b>${escapeHtml(a?.full_name || 'cán bộ')}</b>${a?.department ? ` (${escapeHtml(DEPT_NAMES[a.department] || a.department)})` : ''} đề nghị ${formatDateTime(t.tao_luc)}</p>
      <p class="ly-do">Lý do: ${escapeHtml(t.ly_do)}</p>
      <form class="o mo" data-submit="duyetTuChoiThe" data-id="${t.id}" data-ma="${escapeHtml(r.ma)}">
        <input name="noi_dung" placeholder="Ý kiến duyệt (không bắt buộc)" aria-label="Ý kiến duyệt">
        <button type="button" class="nut chinh" data-action="duyetTuChoiThe" data-dong-y="1" data-id="${t.id}" data-ma="${escapeHtml(r.ma)}">Đồng ý từ chối</button>
        <button type="button" class="nut" data-action="duyetTuChoiThe" data-dong-y="0" data-id="${t.id}" data-ma="${escapeHtml(r.ma)}">Không đồng ý</button>
      </form></div>`;
}

export function tuChoiChoHtml() {
  const ds = tuChoiChoToiDuyet();
  if (ds.length === 0) return '';
  return `<div class="muc do" id="dhTuChoi"><b>Đề nghị từ chối nhận việc, cần đồng chí duyệt (${ds.length})</b>
    <p>Đồng ý → việc chờ giao lại cho người khác (cờ tự xoá khi giao lại); không đồng ý → người đề nghị tiếp tục thực hiện. Lý do không ghi vào lịch sử việc.</p>
    ${ds.map(dongHtml).join('')}</div>`;
}
