// Khối 2 của Tổng quan (v3.27 — chủ dự án 20/10/2026: bỏ khối "Thực hiện các mục tiêu then chốt" do chưa đủ dữ liệu; hiển thị tối đa thông tin chính xác
// từ dữ liệu hiện có): "Theo chủ trì theo dõi" — cùng cột với bảng tổng hợp của Văn phòng (Tổng · Hoàn thành · Đang thực hiện · Quá hạn), thêm Đúng hạn.
// Số liệu: lib/kl/tong-quan-lanh-dao.js theoChuTri. Bấm tên / số → danh sách việc trong ngăn chi tiết (tqMo, kh = 'ct'). Chỉ dựng HTML.
import { escapeHtml } from '../../../lib/dom.js';
import { mo, dauKhoi, thuoc } from './template.js';

// ds: theoChuTri(rows, k); k: kỳ.
export function chuTriHtml(ds, k) {
  const tong = ds.reduce((t, d) => ({ tong: t.tong + d.tong, xong: t.xong + d.xong, dangLam: t.dangLam + d.dangLam, qh: t.qh + d.qh }), { tong: 0, xong: 0, dangLam: 0, qh: 0 });
  const dong = (d) => { const ct = { t: 'nhom', kh: 'ct', ma: d.ma, ten: d.ten };
    return `<tr><td class="c-ten"><button type="button" class="ten-bam" ${mo(ct)}><b>${escapeHtml(d.ten)}</b><small><span class="chi-dt">${d.xong} hoàn thành, ${d.dangLam + d.qh} đang làm</span></small></button></td>
      <td class="so" data-n="Tổng">${d.tong}</td><td class="so" data-n="Hoàn thành">${d.xong}</td><td class="so" data-n="Đang thực hiện">${d.dangLam}</td>
      <td class="so" data-n="Quá hạn">${d.qh ? `<button type="button" class="muc-tq ddb" ${mo({ ...ct, m: 'qh' })}>${d.qh}<span class="sr"> việc quá hạn</span></button>` : '0'}</td>
      <td data-n="Đúng hạn">${d.xetDuoc ? thuoc(d.tyLe) : '<span class="chu-phu">chưa xét được</span>'}</td></tr>`; };
  return `<article class="the-bd n12" id="tqChuTri">${dauKhoi(2, 'Theo chủ trì theo dõi', `Hoàn thành ${k.trong}; đang thực hiện, quá hạn tính đến hôm nay; tổng = ba cột cộng lại · lọc Kết luận Ban Thường vụ / Thông báo Thường trực ở thanh lọc`)}
    ${ds.length ? `<div class="cuon-ngang"><table class="bang-tq bang-chu-tri"><thead><tr><th>Chủ trì theo dõi</th><th class="so">Tổng</th><th class="so">Hoàn thành</th>
      <th class="so">Đang thực hiện</th><th class="so">Quá hạn</th><th>Đúng hạn</th></tr></thead>
      <tbody>${ds.map(dong).join('')}</tbody>
      <tfoot><tr><th scope="row">Tổng cộng</th><td class="so">${tong.tong}</td><td class="so">${tong.xong}</td><td class="so">${tong.dangLam}</td><td class="so">${tong.qh}</td><td></td></tr></tfoot></table></div>`
    : '<p class="trong">Chưa có nhiệm vụ trong kỳ.</p>'}</article>`;
}
