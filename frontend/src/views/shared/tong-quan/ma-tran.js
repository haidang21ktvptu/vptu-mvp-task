// Tổng quan ba tầng — tầng 2 (v3.36, CAU-HOI V-1): ma trận đơn vị theo trạng thái (Thường trực: đơn vị chủ trì; lãnh đạo Văn phòng: phòng, đơn vị;
// Trưởng phòng: cán bộ). Thay bảng "Theo phòng, đơn vị / Theo cán bộ" trong khối Quản lý nội bộ. Mỗi việc đang mở vào đúng một cột mức; ô có việc tô
// nền theo mức (tím: quá hạn từ N ngày, đỏ: quá hạn dưới N ngày, vàng: sắp đến hạn — màu luôn kèm nhãn cột); mỗi ô số, mỗi tên là nút mở đúng danh
// sách (t: 'nhom', lib/kl/tong-quan-loc.js). Tỷ lệ đúng hạn chỉ ghi khi đủ dữ liệu (tyLeDungHan), luôn kèm mẫu số. Chỉ dựng HTML (lib/kl/tong-quan-tang.js).
import { escapeHtml } from '../../../lib/dom.js';
import { tenMuc } from '../../../lib/kl/nhan.js';
import { mo, dauKhoi } from './template.js';

const TIEU = { A0: ['Theo đơn vị chủ trì và trạng thái', 'Đơn vị chủ trì'], A2: ['Theo cán bộ và trạng thái', 'Cán bộ'], A1: ['Theo phòng, đơn vị và trạng thái', 'Phòng, đơn vị'] };
// [khoá, tên cột, lớp màu của ô khi có việc, lớp đầu cột] — tên lớp viết nguyên văn (Tailwind chỉ giữ lớp xuất hiện nguyên chữ trong mã nguồn).
const COT = () => [['ddb', tenMuc('ddb', true), 'ddb', 'so c-ddb'], ['do', tenMuc('do', true), 'do', 'so c-do'], ['vang', 'Sắp đến hạn', 'vang', 'so c-vang'],
  ['th', 'Trong hạn', '', 'so'], ['ch', 'Chưa có hạn', '', 'so'], ['xong', 'Hoàn thành', '', 'so']];

const dungHan = (d) => (d.tyLe !== null ? `<b>${d.tyLe}%</b><small>${d.dung}/${d.xet} việc</small>`
  : d.xet ? `<b class="chua-du">${d.dung}/${d.xet}</b><small>chưa đủ dữ liệu</small>` : '<span class="o-0">—</span>');

// mt: maTran(rows, k, khoa); vai: cách gom (vaiNhom); k: kỳ (cột hoàn thành, đúng hạn).
export function maTranHtml(mt, vai, k) {
  const [tieu, cotTen] = TIEU[vai] || TIEU.A1; const cot = COT();
  const o = (d, [m, nhan, lop]) => {
    const n = d[m];
    if (!n) return `<td class="so" data-n="${escapeHtml(nhan)}"><span class="o-0">0</span></td>`;
    const chu = `${n} nhiệm vụ ${m === 'xong' ? `hoàn thành ${k.trong}` : nhan.toLowerCase()}: ${d.ten}`;
    return `<td class="so" data-n="${escapeHtml(nhan)}"><button type="button" class="${lop ? `o-mt ${lop}` : 'o-mt'}" ${mo({ t: 'nhom', ma: d.ma, ten: d.ten, m })} aria-label="${escapeHtml(chu)}">${n}</button></td>`;
  };
  const dong = (d) => `<tr><th scope="row" class="c-ten"><button type="button" class="ten-bam" ${mo({ t: 'nhom', ma: d.ma, ten: d.ten })}><b>${escapeHtml(d.ten)}</b>
      <small>${d.mo} đang thực hiện, ${d.xong} hoàn thành</small></button></th>${cot.map((c) => o(d, c)).join('')}<td class="dh-mt" data-n="Đúng hạn">${dungHan(d)}</td></tr>`;
  const t = mt.tong;
  const chan = `<tr class="tong-mt"><th scope="row" class="c-ten"><b>Tổng cộng</b><small>${t.mo} đang thực hiện, ${t.xong} hoàn thành</small></th>
    ${cot.map(([m, nhan]) => `<td class="so" data-n="${escapeHtml(nhan)}">${t[m]}</td>`).join('')}<td class="dh-mt" data-n="Đúng hạn">${dungHan(t)}</td></tr>`;
  const than = mt.dong.length ? `<div class="cuon-ngang mt-cuon"><table class="bang-mt"><caption class="sr">${escapeHtml(tieu)}</caption>
      <thead><tr><th scope="col">${cotTen}</th>${cot.map(([, nhan, , lopDau]) => `<th scope="col" class="${lopDau}">${escapeHtml(nhan)}</th>`).join('')}<th scope="col">Đúng hạn</th></tr></thead>
      <tbody>${mt.dong.map(dong).join('')}</tbody><tfoot>${chan}</tfoot></table></div>` : '<p class="trong">Chưa có nhiệm vụ trong phạm vi.</p>';
  return `<article class="the-bd n12" id="tqMaTran">${dauKhoi(1, tieu, `Đang thực hiện tính đến hôm nay; hoàn thành và đúng hạn tính ${k.trong}. Bấm một ô để xem đúng các nhiệm vụ đó.`)}${than}</article>`;
}
