// Ba câu hỏi đầu màn hình "Cần xử lý" (giao diện v9): Ai đang chậm? Nghẽn ở đâu? Cần đồng chí quyết? — trả lời bằng tên (đơn vị chậm nhiều nhất,
// khâu nghẽn nhiều nhất) và số, cùng nguồn với thanh trái (theoDonVi, theoKhau) và số-lọc (canToiQuyet); bấm một ô = lọc danh sách như bấm ở
// thanh trái / ô số (A0/A1). A2 (màn hình phòng không có thanh trái) chỉ hiện câu trả lời.
import { escapeHtml } from '../../../lib/dom.js';
import { KHAU, boSoThuTu } from '../../../lib/kl/nhan.js';
import { dh, theoKhau, theoDonVi, viecDo, canToiQuyet } from './du-lieu.js';

// [lớp màu (viết nguyên văn để Tailwind giữ), hình] — không dùng .cham / .nghen: trùng lớp cũ của dieu-hanh.css.
const ICON = {
  cham: ['bc-cham', '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>'],
  nghen: ['bc-nghen', '<path d="M6 3h12M6 21h12M7 3c0 5 10 6 10 9s-10 4-10 9M17 3c0 5-10 6-10 9"/>'],
  quyet: ['bc-quyet', '<circle cx="12" cy="7" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/>'],
};
const bieu = (k) => `<span class="bc-bieu ${ICON[k][0]}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[k][1]}</svg></span>`;

function o(k, hoi, chinh, phu, hanhDong, bam) {
  const than = `<span class="bc-hoi">${bieu(k)}${hoi}</span><span class="bc-chinh">${chinh}</span><span class="bc-phu">${phu}</span>`;
  return bam ? `<button type="button" class="bc-o" ${hanhDong}>${than}</button>` : `<div class="bc-o">${than}</div>`;
}

// Trưởng phòng (coLoc = false): ai chậm theo cán bộ chủ trì; việc chưa giao cán bộ (hoặc đơn vị khác chủ trì) theo tên đơn vị chủ trì.
function theoNguoi(tre) {
  const m = new Map(); tre.forEach((r) => { const t = r.owner_tai_khoan_ten || boSoThuTu(r.owner_don_vi_ten) || 'Chưa xác định'; m.set(t, (m.get(t) || 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi')).map(([ten, so]) => ({ ten, so }));
}

export function baCauHtml(coLoc = true) {
  const tre = viecDo(); const ddb = tre.filter((r) => r.muc_canh_bao === 'DO_DAC_BIET').length;
  const dv = (coLoc ? theoDonVi(tre) : theoNguoi(tre)).slice(0, 2); const khau = theoKhau().filter((x) => x.so > 0).sort((a, b) => b.so - a.so)[0];
  const quyet = tre.filter(canToiQuyet).length;
  const ai = tre.length
    ? o('cham', 'Ai đang chậm?', `<b>${tre.length}</b> việc quá hạn${ddb ? ` <em class="ddb">${ddb} Đỏ đặc biệt</em>` : ''}`, escapeHtml(dv.map((d) => `${d.ten} ${d.so}`).join(', ')),
      `data-action="locKpi" data-loc="nghen" aria-pressed="${String(dh.loc.kpi === 'nghen')}"`, coLoc)
    : o('cham', 'Ai đang chậm?', '<b>0</b> việc quá hạn', 'Mọi việc trong phạm vi đang trong hạn', '', false);
  const nghen = khau
    ? o('nghen', 'Nghẽn ở đâu?', escapeHtml(KHAU[khau.khau].ten), `${khau.so} việc đang dừng ở khâu này`, `data-action="locKhau" data-khau="${khau.khau}" aria-pressed="${String(dh.loc.khau === khau.khau)}"`, coLoc)
    : o('nghen', 'Nghẽn ở đâu?', 'Không có điểm nghẽn', 'Chưa có việc quá hạn dừng ở một khâu', '', false);
  const cq = o('quyet', 'Cần đồng chí quyết?', `<b>${quyet}</b> việc`, quyet ? 'Đã ghi cấp cần quyết là đồng chí' : 'Không có việc chờ đồng chí quyết',
    `data-action="locKpi" data-loc="quyet" aria-pressed="${String(dh.loc.kpi === 'quyet')}"`, coLoc && quyet > 0);
  return `<div class="ba-cau tam" role="group" aria-label="Ba câu hỏi điều hành">${ai}${nghen}${cq}</div>`;
}
