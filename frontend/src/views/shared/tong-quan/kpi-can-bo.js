// Khối "KPI theo cán bộ" của Tổng quan (Đợt E v3.18) — Thường trực / lãnh đạo Văn phòng nhìn MỘT bảng: từng phòng (dòng tổng của phòng) rồi từng
// cán bộ chủ trì trong phòng: tổng nhiệm vụ, hoàn thành (trong kỳ), đang làm, cảnh báo Vàng / Đỏ / Đỏ đặc biệt (đến hôm nay), tỷ lệ đúng hạn (kỳ).
// Bấm tên phòng / cán bộ → danh sách việc trong ngăn chi tiết; bấm pill cảnh báo → đúng tập việc đó (tqMo với kh = 'cb' | 'phong'). Chỉ dựng HTML từ
// số đã tính (lib/kl/tong-quan.js theoCanBo); Trưởng phòng (A2) dùng bảng "Theo cán bộ" sẵn có.
import { escapeHtml } from '../../../lib/dom.js';
import { mo, dauThe, pillCanh, thuoc } from './template.js';

const ten = (d, phu) => `<b>${escapeHtml(d.ten)}</b><small><span class="chi-mt">${phu}</span><span class="chi-dt">${d.xong} hoàn thành, ${d.dangMo} đang làm</span></small>`;
const dongCanBo = (d) => `<tr class="kpi-cb"><td class="c-ten"><button type="button" class="ten-bam" ${mo({ t: 'nhom', kh: 'cb', ma: d.ma, ten: d.ten })}>${ten(d, `${d.tong} nhiệm vụ`)}</button></td>
    <td class="so" data-n="Tổng">${d.tong}</td><td class="so" data-n="Hoàn thành">${d.xong}</td><td class="so" data-n="Đang làm">${d.dangMo}</td>
    <td data-n="Cảnh báo"><span class="canh-tq">${pillCanh(d, 'cb')}</span></td><td data-n="Đúng hạn">${thuoc(d.tyLe)}</td></tr>`;
const dongPhong = (p) => `<tr class="kpi-phong"><td class="c-ten"><button type="button" class="ten-bam" ${mo({ t: 'nhom', kh: 'phong', ma: p.ma, ten: p.ten })}>${ten(p, `${p.soCanBo} cán bộ · ${p.tong} nhiệm vụ`)}</button></td>
    <td class="so" data-n="Tổng">${p.tong}</td><td class="so" data-n="Hoàn thành">${p.xong}</td><td class="so" data-n="Đang làm">${p.dangMo}</td>
    <td data-n="Cảnh báo"><span class="canh-tq">${pillCanh(p, 'phong')}</span></td><td data-n="Đúng hạn">${thuoc(p.tyLe)}</td></tr>`;

export function kpiCanBoHtml(ds, k) {
  const soCb = ds.reduce((s, p) => s + p.soCanBo, 0);
  return `<article class="the-bd n12" id="tqKpiCanBo">${dauThe('KPI theo cán bộ', `${soCb} cán bộ chủ trì · tổng, hoàn thành và đúng hạn tính ${k.trong}; đang làm, cảnh báo tính đến hôm nay · bấm tên để xem việc`)}
    ${ds.length ? `<div class="cuon-ngang"><table class="bang-tq bang-kpi"><thead><tr><th>Phòng / cán bộ</th><th class="so">Tổng</th><th class="so">Hoàn thành</th><th class="so">Đang làm</th><th>Cảnh báo</th><th>Đúng hạn</th></tr></thead>
      <tbody>${ds.map((p) => dongPhong(p) + p.canBo.map(dongCanBo).join('')).join('')}</tbody></table></div>` : '<p class="trong">Chưa có nhiệm vụ do cán bộ chủ trì trong phạm vi.</p>'}</article>`;
}
