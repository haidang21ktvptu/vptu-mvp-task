// "Việc tôi theo dõi" (Chuyên viên — v3.25, mẫu ViecTheoDoi 16/10/2026): chế độ của màn Nhiệm vụ khi có khoá theoDoiCuaToi (việc tôi theo dõi
// hoặc đã giao, người khác chủ trì — locRows, tong-hop.js). Ô số riêng #klTdSo (mặc định Cần đôn đốc) thay dải trạng thái #klStats, nút Mọi việc
// / Tôi đã giao / Tôi theo dõi (#klTdQh), bộ cột có Chủ trì và Tình hình (dong.js); sắp xếp chỉ Mới nhập trước / Hạn gần trước. Ô số đếm trên
// đúng các dòng đã lọc ngữ cảnh + quan hệ (bấm ô = lọc đúng mảng đó). Hàm thuần ở lib/kl/tinh-hinh.js.
import { $, show } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { O_SO_TD, QUAN_HE, locOTd, demOTd, khopQuanHe } from '../../../lib/kl/tinh-hinh.js';
import { oSoHtml } from '../bang/khung.js';

export const td = { loc: 'don', qh: '' };
export const datLaiTheoDoi = () => Object.assign(td, { loc: 'don', qh: '' });
export const laTheoDoi = (loc) => Boolean(loc?.theoDoiCuaToi);
const MAU = { nhan: 'canh', vm: 'do', sap: 'vang', qua: 'do', xong: 'luc' };

// rows: dòng đã lọc ngữ cảnh → { so: số mỗi ô (sau quan hệ), list: dòng của ô đang chọn }.
export function locTheoDoi(rows) {
  const me = state.user?.id;
  const theoQh = rows.filter((r) => khopQuanHe(r, me, td.qh));
  return { so: demOTd(theoQh), list: locOTd(theoQh, td.loc) };
}

// Bật / tắt phần riêng của chế độ (ô số, nút quan hệ, ẩn dải trạng thái và cách sắp xếp "Mức cảnh báo").
export function veTheoDoi(bat, so) {
  show('klTdSo', bat); show('klTdQh', bat); show('klStats', !bat);
  const nutMuc = document.querySelector('#klSapXep [data-sx="canh-bao"]'); if (nutMuc) nutMuc.classList.toggle('hidden', bat);
  if (!bat) return;
  $('klTdSo').innerHTML = oSoHtml(O_SO_TD, so, td.loc, 'klTdLoc', MAU);
  $('klTdQh').innerHTML = QUAN_HE.map(([k, t]) => `<button type="button" data-action="klTdQh" data-qh="${k}" aria-pressed="${String(td.qh === k)}">${t}</button>`).join('');
}
