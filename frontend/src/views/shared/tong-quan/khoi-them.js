// Tổng quan cho lãnh đạo (v3.24): khối 4 "Xếp hạng thực hiện" (theo đơn vị chịu trách nhiệm / theo đồng chí Thường trực chỉ đạo), khối 9 "Quản lý
// nội bộ Văn phòng" (KPI theo phòng, cán bộ chủ trì, theo lãnh đạo VP phụ trách — gập mặc định với Thường trực / lãnh đạo Văn phòng, mở sẵn với Trưởng
// phòng, chuyên viên xem phòng) và ghi chú chất lượng dữ liệu (việc chưa gắn mục tiêu, chưa có ngành / lĩnh vực). Chỉ dựng HTML từ số đã tính.
import { escapeHtml } from '../../../lib/dom.js';
import { mo, dauKhoi, nhomNut, thuoc } from './template.js';

const pillsXh = (d, cach) => [[d.ddb, 'ddb', 'Đỏ đặc biệt'], [d.do, 'do', 'Đỏ']].filter(([n]) => n)
  .map(([n, lop, ten]) => `<button type="button" class="muc-tq ${lop}" title="${n} việc ${ten}" ${mo({ t: 'xh', cach, ma: d.ma, ten: d.ten, m: lop })}>${n}<span class="sr"> việc ${ten}</span></button>`).join('')
  || '<span class="muc-tq tot">Không</span>';
// ds: xepHang(rows, k, cach); cach: 'dv' | 'tt'.
export function xepHangHtml(ds, cach, k) {
  const cot = cach === 'tt' ? 'Đồng chí Thường trực chỉ đạo' : 'Đơn vị chịu trách nhiệm';
  const ten = (d) => (cach === 'tt' && d.ma !== 'KHONG' ? `Đồng chí ${d.ten}` : d.ten);
  const dong = (d) => `<tr><td class="c-ten"><button type="button" class="ten-bam" ${mo({ t: 'xh', cach, ma: d.ma, ten: ten(d) })}><b>${escapeHtml(ten(d))}</b><small><span class="chi-mt">${d.giao} giao ${k.trong}</span><span class="chi-dt">${d.xong} hoàn thành, ${d.dangMo} đang làm</span></small></button></td>
    <td class="so" data-n="Tổng">${d.giao}</td><td class="so" data-n="Hoàn thành">${d.xong}</td><td data-n="Đúng hạn">${thuoc(d.tyLe)}</td><td class="so" data-n="Đang làm">${d.dangMo}</td>
    <td data-n="Cảnh báo"><span class="canh-tq">${pillsXh(d, cach)}</span></td></tr>`;
  return `<article class="the-bd n7" id="tqXepHang">${dauKhoi(4, 'Xếp hạng thực hiện', `Nhiều việc quá hạn trước; giao, hoàn thành và đúng hạn tính ${k.trong}; đang làm, quá hạn tính đến hôm nay.`,
    nhomNut('tqXh', 'cach', [['dv', 'Theo đơn vị chịu trách nhiệm'], ['tt', 'Theo đồng chí Thường trực chỉ đạo']], cach, 'Xếp hạng theo'))}
    ${ds.length ? `<div class="cuon-ngang"><table class="bang-tq"><thead><tr><th>${cot}</th><th class="so">Giao</th><th class="so">Hoàn thành</th><th>Đúng hạn</th><th class="so">Đang làm</th><th>Quá hạn</th></tr></thead>
      <tbody>${ds.map(dong).join('')}</tbody></table></div>` : '<p class="trong">Chưa có nhiệm vụ trong kỳ.</p>'}
    ${cach === 'dv' ? '<p class="chu-phu tq-chu-nho">Đơn vị chịu trách nhiệm = cơ quan trình ghi khi giao việc; việc không ghi cơ quan trình tính cho Văn phòng Tỉnh ủy.</p>' : ''}</article>`;
}

// than: HTML các bảng (KPI theo cán bộ, theo lãnh đạo VP phụ trách, theo phòng / cán bộ); moKhoi: đang mở; phong: góc nhìn phòng (Trưởng phòng).
export function noiBoHtml(than, moKhoi, phong = false) {
  const phu = phong ? 'Theo cán bộ của phòng — hoàn thành, đúng hạn trong kỳ; đang làm, cảnh báo đến hôm nay.'
    : 'KPI theo phòng, cán bộ chủ trì và theo lãnh đạo Văn phòng phụ trách — gập mặc định, mở khi cần.';
  const nut = `<button type="button" class="nut nho" id="tqNoiBoNut" data-action="tqNoiBo" aria-expanded="${String(moKhoi)}" aria-controls="tqNoiBoThan">${moKhoi ? 'Thu gọn' : 'Mở khối này'}</button>`;
  return `<section class="the-bd n12 khoi-noi-bo" id="tqNoiBo" aria-labelledby="tqNoiBoTieu">${dauKhoi(9, phong ? 'Quản lý nội bộ của phòng' : 'Quản lý nội bộ Văn phòng', phu, nut, 'tqNoiBoTieu')}
    <div class="luoi-tq noi-bo-than" id="tqNoiBoThan"${moKhoi ? '' : ' hidden'}>${than}</div></section>`;
}

// c: chatLuongDuLieu(rows). Không thiếu gì → không vẽ.
export function duLieuHtml(c) {
  const a = c.chuaMucTieu.length; const b = c.chuaNganh.length; const x = (c.xongChuaNgay || []).length;
  if (!a && !b && !x) return '';
  const phan = [a ? `${a} nhiệm vụ chưa gắn mục tiêu then chốt (gắn khi việc phục vụ một mục tiêu)` : '', b ? `${b} nhiệm vụ chưa có ngành, lĩnh vực` : '',
    x ? `${x} nhiệm vụ hoàn thành chưa có ngày hoàn thành (tính theo ngày giao, chưa xét được đúng hạn)` : ''].filter(Boolean).join('; ');
  const khoi = [a ? 'khối 2' : '', b ? 'khối 3' : '', x ? 'tỷ lệ đúng hạn' : ''].filter(Boolean).join(', ');
  return `<div class="dl-tq n12" role="note" id="tqDuLieu"><svg class="dl-bieu" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>
    <span><b>Chất lượng dữ liệu:</b> ${phan} — số liệu ${khoi} chưa đầy đủ.</span><span class="tq-day"></span>
    <button type="button" class="nut nho" ${mo({ t: 'cldl' })}>Xem các việc này</button></div>`;
}
