// "Việc tôi đã giao" (Chuyên viên — v3.25 "Việc tôi theo dõi", mẫu ViecTheoDoi 16/10/2026; v3.31 — 0128: chỉ còn chủ trì theo dõi): chế độ của
// màn Nhiệm vụ khi có khoá daGiaoCuaToi (việc tôi giao hoặc nhập, người khác chủ trì theo dõi — locRows, tong-hop.js). Ô số riêng #klTdSo (mặc
// định Cần đôn đốc) thay dải trạng thái #klStats, bộ cột có Chủ trì và Tình hình (dong.js); sắp xếp chỉ Mới nhập trước / Hạn gần trước. Ô số đếm
// trên đúng các dòng đã lọc ngữ cảnh (bấm ô = lọc đúng mảng đó). Hàm thuần ở lib/kl/tinh-hinh.js.
import { $, show } from '../../../lib/dom.js';
import { O_SO_TD, locOTd, demOTd } from '../../../lib/kl/tinh-hinh.js';
import { oSoHtml } from '../bang/khung.js';

export const td = { loc: 'don' };
export const datLaiTheoDoi = () => Object.assign(td, { loc: 'don' });
export const laTheoDoi = (loc) => Boolean(loc?.daGiaoCuaToi);
const MAU = { nhan: 'canh', vm: 'do', sap: 'vang', qua: 'do', xong: 'luc' };

// rows: dòng đã lọc ngữ cảnh → { so: số mỗi ô, list: dòng của ô đang chọn }.
export const locTheoDoi = (rows) => ({ so: demOTd(rows), list: locOTd(rows, td.loc) });

// Bật / tắt phần riêng của chế độ (ô số, ẩn dải trạng thái và cách sắp xếp "Mức cảnh báo").
export function veTheoDoi(bat, so) {
  show('klTdSo', bat); show('klStats', !bat);
  const nutMuc = document.querySelector('#klSapXep [data-sx="canh-bao"]'); if (nutMuc) nutMuc.classList.toggle('hidden', bat);
  if (!bat) return;
  $('klTdSo').innerHTML = oSoHtml(O_SO_TD, so, td.loc, 'klTdLoc', MAU);
}
