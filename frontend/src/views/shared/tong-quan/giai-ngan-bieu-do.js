// Biểu đồ "Tỷ lệ giải ngân qua các kỳ" của khối Giải ngân vốn (v3.28): trục ngang là năm kế hoạch vốn (1/1 → 31/12, kéo tới mốc / kỳ tháng 1 năm
// sau nếu có), trục dọc 0–100% kế hoạch vốn; đường liền = lũy kế đã giải ngân theo các kỳ số liệu, đường đứt = tiến độ đều tới mục tiêu (mục tiêu của
// việc "Số liệu toàn tỉnh"). Đường vẽ bằng SVG co giãn (nét không co — vector-effect), chấm và chữ bằng HTML đặt theo % nên không méo ở mọi độ rộng.
// Chấm rỗng = số ước tính. Mỗi chấm nhận tiêu điểm bàn phím, có data-goi (gợi ý #tqGoi của Tổng quan). Không thư viện.
import { escapeHtml } from '../../../lib/dom.js';
import { soNgay, formatNgay } from '../../../lib/kl/ngay.js';
import { ptVN, soVN, mocMacDinh } from '../../../lib/kl/giai-ngan.js';

const VACH = [0, 25, 50, 75, 100];
const goiCua = (d) => `Đến ${formatNgay(d.ngay)}${d.uoc ? ' (ước tính)' : ''}: ${ptVN(d.pt)} — ${soVN(d.da)} / ${soVN(d.kh)} tỷ đồng · tiến độ đều ${ptVN(d.canDat)}`;

// th: tongHopNam (lib/kl/giai-ngan.js). Không có kỳ → ''.
export function xuHuongHtml(th) {
  const diem = th.diem.filter((d) => d.pt !== null);
  if (!diem.length) return '';
  const { nam, mucTieu } = th; const dau = `${nam}-01-01`;
  const cuoi = [mocMacDinh(nam), mucTieu.mucTieuNgay, diem.at(-1).ngay].sort().at(-1);
  const tong = Math.max(1, soNgay(dau, cuoi)); const tran = Math.max(100, ...diem.map((d) => d.pt));
  const x = (ngay) => Math.min(100, Math.max(0, (soNgay(dau, ngay) / tong) * 100)); const y = (p) => Math.min(100, Math.max(0, (p / tran) * 100));
  const diemSvg = (a, b) => `${a.toFixed(2)},${(100 - b).toFixed(2)}`;
  const thuc = diem.map((d) => diemSvg(x(d.ngay), y(d.pt))).join(' ');
  const yMt = y(Number(mucTieu.mucTieuPt)); const deu = `${diemSvg(0, 0)} ${diemSvg(x(mucTieu.mucTieuNgay), yMt)} ${diemSvg(100, yMt)}`;
  const thang = Array.from({ length: 12 }, (_, i) => [i + 1, x(`${nam}-${String(i + 1).padStart(2, '0')}-01`)]);
  const cuoiDiem = diem.at(-1); const xCuoi = x(cuoiDiem.ngay);
  const nhan = `Tỷ lệ giải ngân qua các kỳ: ${diem.map((d) => `${formatNgay(d.ngay)} ${ptVN(d.pt)}${d.uoc ? ' (ước tính)' : ''}`).join('; ')}. Tiến độ đều tới ${ptVN(mucTieu.mucTieuPt)} trước ${formatNgay(mucTieu.mucTieuNgay)}.`;
  return `<div class="gn-bd" role="group" aria-label="${escapeHtml(nhan)}">
    <div class="truc-y" aria-hidden="true">${VACH.map((v) => `<span style="bottom:${y((v * tran) / 100)}%">${Math.round((v * tran) / 100)}%</span>`).join('')}</div>
    <div class="gn-ve">${VACH.slice(1).map((v) => `<i class="luoi" style="bottom:${v}%"></i>`).join('')}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline class="gn-deu" points="${deu}"/>${diem.length > 1 ? `<polyline class="gn-thuc" points="${thuc}"/>` : ''}</svg>
      ${diem.map((d) => `<span class="gn-diem${d.uoc ? ' uoc' : ''}" style="left:${x(d.ngay).toFixed(2)}%;bottom:${y(d.pt).toFixed(2)}%" tabindex="0" data-goi="${escapeHtml(goiCua(d))}" aria-label="${escapeHtml(goiCua(d))}"></span>`).join('')}
      <span class="gn-nhan-diem${xCuoi > 80 ? ' phai' : ''}" style="left:${xCuoi.toFixed(2)}%;bottom:${y(cuoiDiem.pt).toFixed(2)}%" aria-hidden="true">${ptVN(cuoiDiem.pt)}</span></div>
    <div class="gn-truc-x" aria-hidden="true">${thang.map(([t, v]) => `<span style="left:${v.toFixed(2)}%">T${t}</span>`).join('')}</div></div>
    <div class="chu-giai ngang gn-chu-giai"><span><i class="gn-cg-thuc"></i>Lũy kế đã giải ngân</span><span><i class="gn-cg-deu"></i>Tiến độ đều tới mục tiêu</span>${diem.some((d) => d.uoc) ? '<span><i class="gn-cg-uoc"></i>Số ước tính</span>' : ''}</div>`;
}
