// Thanh trái (mockup bản 5): "Nghẽn ở khâu nào" (4 khâu, thanh tỉ lệ) và "Ai đang chậm" (đơn vị Owner, số việc, tổng ngày trễ);
// bấm là lọc danh sách thẻ bên phải; "Bỏ lọc, xem cả N việc". Cùng một danh sách nhìn được đa chiều.
import { escapeHtml } from '../../../lib/dom.js';
import { KHAU } from '../../../lib/kl/nhan.js';
import { dh, theoKhau, theoDonVi, viecDo } from './du-lieu.js';

const tiLe = (so, max) => (max ? Math.round((so / max) * 100) : 0);

export function rayHtml() {
  const tong = viecDo().length;
  const khau = theoKhau(); const dv = theoDonVi();
  const maxK = Math.max(1, ...khau.map((k) => k.so)); const maxD = Math.max(1, ...dv.map((d) => d.so));
  const nutKhau = (k) => `<button type="button" data-action="locKhau" data-khau="${k.khau}" aria-pressed="${String(dh.loc.khau === k.khau)}">
      <span>${KHAU[k.khau].ten}<small>${KHAU[k.khau].phu}</small></span><b>${k.so}</b><i><span class="${KHAU[k.khau].mau}" style="width:${tiLe(k.so, maxK)}%"></span></i></button>`;
  const nutDv = (d) => `<button type="button" data-action="locDonVi" data-dv="${escapeHtml(d.ma)}" aria-pressed="${String(dh.loc.dv === d.ma)}">
      <span>${escapeHtml(d.ten)}<small>${d.trongVP ? '' : 'đơn vị ngoài, '}${d.so} việc, tổng ${d.ngay} ngày trễ</small></span><b>${d.so}</b><i><span class="do" style="width:${tiLe(d.so, maxD)}%"></span></i></button>`;
  return `<h3>Nghẽn ở khâu nào</h3>${khau.map(nutKhau).join('')}
    <h3>Ai đang chậm</h3>${dv.length ? dv.map(nutDv).join('') : '<p class="chu-phu" style="padding:6px 18px">Không có việc quá hạn.</p>'}
    <button type="button" class="tat" data-action="boLocDieuHanh">Bỏ lọc, xem cả ${tong} việc</button>`;
}

// Tiêu đề danh sách theo bộ lọc: "8 việc đang nghẽn, khâu chờ cấp trên quyết, Phòng Tổng hợp".
export function tieuDeDanhSach(soThe, nhanKpi) {
  const { khau, dv } = dh.loc;
  const dvTen = dv ? theoDonVi().find((d) => d.ma === dv)?.ten : '';
  return `${soThe} việc${nhanKpi}${khau ? `, khâu ${KHAU[khau].ten.toLowerCase()}` : ''}${dvTen ? `, ${dvTen}` : ''}`;
}
