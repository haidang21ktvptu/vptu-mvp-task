// Biểu đồ của màn hình Tổng quan — HTML/SVG thuần, không thư viện (docs/DESIGN.md mục 5, theo dataviz): chữ dùng màu chữ, không màu dữ liệu;
// cột ≤ 24px bo đầu 4px, khe 2px giữa các phần xếp chồng; chú giải khi ≥ 2 chuỗi; mỗi phần tử có data-goi = câu gợi ý khi rê chuột / chạm
// (tong-quan/index.js hiện #tqGoi). Màu trạng thái luôn đi kèm nhãn chữ ở chú giải — không dùng màu làm kênh duy nhất. v9 đợt 2: cột, đoạn,
// mục chú giải nhận thuộc tính hành động (hd = chuỗi data-action + data-ct) → bấm mở danh sách việc trong ngăn chi tiết.
import { escapeHtml } from '../../../lib/dom.js';

const goi = (s) => `data-goi="${escapeHtml(s)}"`;

// Vòng tỷ lệ (0–100) ở giữa ghi số; null = chưa có việc được đánh giá.
export function vongHtml(p, nhan = 'đúng hạn') {
  const C = 2 * Math.PI * 50;
  const cung = p > 0 ? `<circle cx="60" cy="60" r="50" class="tien-vong" stroke-dasharray="${((C * p) / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/>` : '';
  return `<span class="vong-tq"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" class="ray-vong"/>${cung}</svg>`
    + `<span class="giua-vong"><b>${p === null ? '—' : `${p}%`}</b><span>${nhan}</span></span></span>`;
}

// Đường xu hướng nhỏ (tỷ lệ theo tháng); tháng chưa có số bị bỏ qua, chấm cuối là tháng gần nhất có số.
export function duongHtml(ds) {
  const co = ds.filter((d) => d.tyLe !== null);
  if (co.length < 2) return '';
  const w = 140; const h = 36; const vals = co.map((d) => d.tyLe);
  const mn = Math.min(...vals) - 2; const mx = Math.max(...vals) + 2; const n = ds.length - 1 || 1;
  const pts = co.map((d) => [((d.thang - ds[0].thang) / n) * w, h - ((d.tyLe - mn) / (mx - mn)) * h].map((v) => v.toFixed(1)));
  const cuoi = pts[pts.length - 1];
  return `<svg class="duong" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts.map((p) => p.join(',')).join(' ')}"/><circle cx="${cuoi[0]}" cy="${cuoi[1]}" r="4"/></svg>`;
}

// Trục dọc "đẹp": bước 1/2/5/10/20/50… sao cho ≤ 5 vạch.
function truc(mx) {
  const buoc = [1, 2, 5, 10, 20, 50, 100, 200, 500].find((b) => Math.ceil(Math.max(mx, 1) / b) <= 5) || 1000;
  const dinh = Math.max(buoc, Math.ceil(mx / buoc) * buoc);
  return { dinh, vach: Array.from({ length: dinh / buoc + 1 }, (_, i) => i * buoc) };
}

// Cột nhóm theo tháng: giao mới (s1) và hoàn thành (s2); hd(d) → mỗi tháng là một nút.
export function cotThangHtml(ds, hd = null) {
  const { dinh, vach } = truc(Math.max(0, ...ds.map((d) => Math.max(d.giao, d.xong))));
  const cot = `repeat(${ds.length}, minmax(0, 1fr))`; const pt = (v) => `${(v / dinh) * 100}%`;
  return `<div class="bd-thang" role="${hd ? 'group' : 'img'}" aria-label="Giao mới và hoàn thành theo tháng">
    <div class="truc-y">${vach.map((v) => `<span style="bottom:${pt(v)}">${v}</span>`).join('')}</div>
    <div class="ve-thang" style="grid-template-columns:${cot}">${vach.slice(1).map((v) => `<i class="luoi" style="bottom:${pt(v)}"></i>`).join('')}
      ${ds.map((d) => { const goiY = `Tháng ${d.thang}: giao mới ${d.giao}, hoàn thành ${d.xong}`; const cot = `<span class="s1" style="height:${pt(d.giao)}"></span><span class="s2" style="height:${pt(d.xong)}"></span>`;
    return hd ? `<button type="button" class="nhom-cot" ${hd(d)} ${goi(goiY)} aria-label="${escapeHtml(goiY)}">${cot}</button>` : `<div class="nhom-cot" ${goi(goiY)}>${cot}</div>`; }).join('')}</div>
    <div class="truc-x" style="grid-template-columns:${cot}">${ds.map((d) => `<span>T${d.thang}</span>`).join('')}</div></div>`;
}

// Thanh xếp chồng: phan = [[tên, số, biến màu, hd?], …]; phần 0 bị bỏ; có hd → đoạn là nút.
export function xepHtml(phan, tong) {
  if (!tong) return '<div class="xep rong" aria-hidden="true"></div>';
  return `<div class="xep">${phan.filter(([, so]) => so > 0).map(([ten, so, mau, hd]) => {
    const goiY = `${ten}: ${so} việc (${Math.round((so / tong) * 100)}%)`; const kieu = `style="width:${(so / tong) * 100}%;background:var(${mau})"`;
    return hd ? `<button type="button" class="doan" ${kieu} ${hd} ${goi(goiY)} aria-label="${escapeHtml(goiY)}"></button>` : `<i ${kieu} ${goi(goiY)}></i>`;
  }).join('')}</div>`;
}

// Chú giải hai cột: ô màu + nhãn + số; có hd (phần tử thứ 4) → mục là nút.
export const chuGiaiHtml = (phan, them = '') => `<ul class="chu-giai-doc ${them}">${phan.map(([ten, so, mau, hd]) => {
  const noi = `<i style="background:var(${mau})"></i><span>${escapeHtml(ten)}</span><b>${so}</b>`;
  return `<li>${hd && so > 0 ? `<button type="button" class="muc-cg" ${hd}>${noi}</button>` : noi}</li>`;
}).join('')}</ul>`;

// Thanh ngang theo nhóm (lĩnh vực): tên, thanh tỉ lệ theo nhóm lớn nhất, số; dòng bấm được nếu có hành động.
export function thanhNgangHtml(ds, hanhDong) {
  const mx = Math.max(1, ...ds.map((d) => d.so));
  return ds.map((d) => `<button type="button" class="lv-hang" ${hanhDong ? hanhDong(d) : 'disabled'} ${goi(`${d.ten}: ${d.so} việc đang mở`)}>
    <span class="ten-lv">${escapeHtml(d.ten)}</span><span class="ray-lv"><i style="width:${(d.so / mx) * 100}%"></i></span><b>${d.so}</b></button>`).join('');
}
