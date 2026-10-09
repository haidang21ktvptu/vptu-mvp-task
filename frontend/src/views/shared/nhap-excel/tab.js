// Thẻ của màn Giao việc (v9 đợt 2): Giao từng việc · Nhập từ Excel · Chờ hoàn thiện (n). Hai thẻ nhập với người nhập liệu (Đợt F v3.21, 0096:
// mọi tài khoản trừ Thường trực); mọi vai dùng biểu mẫu Giao việc (chuyên viên giao thẳng từ 0085). Mở thẻ nào thì nạp thẻ đó (hàm do nhap-excel/index.js, cho.js đăng ký). Quyền thật ở DB.
import { $, show, setText } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { laNguoiNhap } from '../../../lib/kl/nhap/du-lieu.js';
import { setActiveNav } from '../../shell/index.js';

const KHU = { giao: 'gvKhuGiao', nhap: 'gvKhuNhap', cho: 'gvKhuCho' };
const NUT = { giao: 'gvTabGiao', nhap: 'gvTabNhap', cho: 'gvTabCho' };
const PHU_DE = { nhap: 'mẫu chuẩn của hệ thống hoặc bảng đang dùng — ghép cột, chuẩn hoá, xem trước; chưa ghi gì cho tới khi bấm Nhập',
  cho: 'dòng còn thiếu thông tin để giao: hoàn thiện bằng biểu mẫu Giao việc điền sẵn, hoặc bỏ; hoàn tác cả lô trong 24 giờ' };
const nap = {};
let phuDeGiao = '';
export const datNapTab = (ten, fn) => { nap[ten] = fn; };
export const duocGiao = (u) => Boolean(u) && !u.is_system;   // dùng được biểu mẫu Giao việc (mọi vai từ 0085)

// Gọi mỗi lần mở Giao việc (openGiaoViec): tab mong muốn, không hợp lệ với vai → thẻ mặc định của vai.
export function hienTabGiaoViec(tab) {
  const u = state.user; const nhap = laNguoiNhap(u); const giao = duocGiao(u);
  phuDeGiao ||= $('gvPhuDe')?.textContent || '';
  show('gvTabs', nhap); show(NUT.giao, giao);
  const t = !nhap ? 'giao' : KHU[tab] && (tab !== 'giao' || giao) ? tab : giao ? 'giao' : 'nhap';
  Object.entries(KHU).forEach(([k, id]) => show(id, k === t));
  Object.entries(NUT).forEach(([k, id]) => $(id)?.setAttribute('aria-selected', String(k === t)));
  setText('gvPhuDe', PHU_DE[t] || phuDeGiao);
  show('gvHoanThien', t === 'giao' && Boolean($('gvHoanThien')?.innerHTML));   // dải "Hoàn thiện dòng …" chỉ đi cùng biểu mẫu
  if (!giao && nhap) setActiveNav('navNhapExcel');
  if (t !== 'giao') nap[t]?.();
  return t;
}
export function datSoCho(n) { setText('gvSoCho', String(n)); show('gvSoCho', n > 0); }

export function mountTabGiaoViec(openGiaoViec) {
  registerActions({
    gvChonTab: ({ tab }) => hienTabGiaoViec(tab),
    openNhapExcel: async () => { await openGiaoViec({ tab: 'nhap' }); },
  });
}
