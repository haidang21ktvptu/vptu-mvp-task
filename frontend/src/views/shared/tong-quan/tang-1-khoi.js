// Tổng quan — tầng 1, phần dưới dải điều hành (v3.36, phương án A — CAU-HOI V-11): hàng hai khối "Quá hạn theo phòng, đơn vị" (thanh ngang, đơn vị
// nhiều việc quá hạn đứng trước; Trưởng phòng: theo cán bộ) và "Giao mới và hoàn thành theo tuần" (12 tuần, cột đôi có trục số); dòng Nhiệm vụ quý của
// Ban Thường vụ có thanh cơ cấu. Mỗi dòng đơn vị, mỗi cột tuần là nút mở đúng danh sách (t: 'nhom' m 'qh', t: 'tuan' — lib/kl/tong-quan-loc.js).
// Chỉ dựng chuỗi HTML từ số đã tính (lib/kl/tong-quan-tang.js maTran, xuHuongTuan; lib/nvq/tinh.js).
// v3.36 (CAU-HOI V-13, số trước, chi tiết bấm mới mở): bỏ câu phụ dưới tiêu đề khối và câu "Tuần này…" (đã có ở gợi ý của cột); số nhiệm vụ quý và số
// ngày còn lại chuyển vào gợi ý của tên dòng.
import { escapeHtml } from '../../../lib/dom.js';
import { tenMuc } from '../../../lib/kl/nhan.js';
import { demTheoTrangThai, cauTomTat } from '../../../lib/nvq/tinh.js';
import { tenKyNgan } from '../../../lib/nvq/nhan.js';
import { mo } from './template.js';

const hoaDau = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const goi = (s) => `data-goi="${escapeHtml(s)}"`;
// [tiêu đề khối, tên nhóm ghi trong câu] theo cách gom của ma trận (vaiNhom).
const NHOM = { A0: ['Quá hạn theo đơn vị chủ trì', 'đơn vị'], A2: ['Quá hạn theo cán bộ', 'cán bộ'], A1: ['Quá hạn theo phòng, đơn vị', 'đơn vị'] };
export const SO_DONG_QUA_HAN = 8;   // nhiều hơn: 7 dòng đầu + một dòng gộp các nhóm còn lại (mở toàn bộ việc quá hạn)

// dong: maTran(...).dong (mỗi nhóm: ma, ten, ddb, do, mo); vai: vaiNhom.
export function quaHanNhomHtml(dong, vai) {
  const [tieu, nhom] = NHOM[vai] || NHOM.A1;
  const co = dong.map((d) => ({ ...d, qh: d.ddb + d.do })).filter((d) => d.qh > 0).sort((a, b) => b.qh - a.qh || b.ddb - a.ddb || a.ten.localeCompare(b.ten, 'vi'));
  const tong = co.reduce((s, d) => s + d.qh, 0);
  if (!tong) return `<article class="tq1-khoi" id="tqQuaHanNhom"><div class="khoi-dau"><h2>${tieu}</h2></div><p class="chu-phu">Không có nhiệm vụ quá hạn chưa hoàn thành.</p></article>`;
  const hien = co.length > SO_DONG_QUA_HAN ? co.slice(0, SO_DONG_QUA_HAN - 1) : co; const conLai = co.slice(hien.length);
  const lon = hien[0].qh;
  const thanh = (d) => `<span class="qh-thanh" aria-hidden="true">${d.ddb ? `<i class="p-ddb" style="width:${(d.ddb / lon) * 100}%"></i>` : ''}${d.do ? `<i class="p-do" style="width:${Math.max((d.do / lon) * 100, 2.5)}%"></i>` : ''}</span>`;
  const hang = hien.map((d, i) => `<button type="button" class="qh-dong" style="--i:${i}" ${mo({ t: 'nhom', ma: d.ma, ten: d.ten, m: 'qh' })} aria-label="${escapeHtml(`${d.ten}: ${d.qh} nhiệm vụ quá hạn trong ${d.mo} nhiệm vụ đang thực hiện, xem danh sách`)}">
    <span class="qh-ten">${escapeHtml(d.ten)}</span>${thanh(d)}<b class="qh-so">${d.qh}</b></button>`).join('');
  const gop = conLai.length ? (() => {
    const g = { ddb: conLai.reduce((s, d) => s + d.ddb, 0), do: conLai.reduce((s, d) => s + d.do, 0) }; const n = g.ddb + g.do;
    return `<button type="button" class="qh-dong" style="--i:${hien.length}" ${mo({ t: 'qh' })} aria-label="${escapeHtml(`${conLai.length} ${nhom} còn lại: ${n} nhiệm vụ quá hạn, xem toàn bộ nhiệm vụ quá hạn`)}">
      <span class="qh-ten">${conLai.length} ${nhom} còn lại</span>${thanh({ ddb: Math.min(g.ddb, lon), do: Math.min(g.do, Math.max(lon - g.ddb, 0)) })}<b class="qh-so">${n}</b></button>`;
  })() : '';
  return `<article class="tq1-khoi" id="tqQuaHanNhom"><div class="khoi-dau"><h2>${tieu}</h2></div>
    <div class="qh-ds">${hang}${gop}</div>
    <div class="chu-giai-nho"><span><i class="p-ddb"></i>${escapeHtml(hoaDau(tenMuc('ddb')))}</span><span><i class="p-do"></i>${escapeHtml(hoaDau(tenMuc('do')))}</span></div></article>`;
}

// Giao mới và hoàn thành 12 tuần: cột đôi theo tuần, trục số chia tối đa bốn nấc; mỗi tuần là nút mở danh sách giao mới / hoàn thành của tuần.
export function xuHuongHtml(ds) {
  const mx = Math.max(1, ...ds.map((w) => Math.max(w.giao, w.xong)));
  const buoc = [1, 2, 5, 10, 20, 50, 100, 200, 500].find((b) => Math.ceil(mx / b) <= 4) || 1000; const nac = Math.ceil(mx / buoc); const dinh = nac * buoc;
  const pt = (v) => `${(v / dinh) * 100}%`;
  const luoi = Array.from({ length: nac + 1 }, (_, i) => `<span style="bottom:${pt(i * buoc)}"><b>${i * buoc}</b><i></i></span>`).join('');
  const cot = ds.map((w, i) => {
    const chu = `Tuần ${w.nhan}${i === ds.length - 1 ? ' (tuần này)' : ''}: ${w.giao} giao mới, ${w.xong} hoàn thành`;
    return `<button type="button" class="tuan-cot" style="--i:${i}" ${mo({ t: 'tuan', tu: w.tu, den: w.den, ten: w.nhan })} ${goi(chu)} aria-label="${escapeHtml(chu)}">
      <span class="${w.giao ? 's1' : 's1 s-0'}" style="height:${pt(w.giao)}"></span><span class="${w.xong ? 's2' : 's2 s-0'}" style="height:${pt(w.xong)}"></span></button>`;
  }).join('');
  const nhan = ds.map((w, i) => `<span>${i === ds.length - 1 ? 'Tuần này' : i % 3 === 0 ? escapeHtml(w.nhan.split('–')[0]) : ''}</span>`).join('');
  return `<figure class="tq1-xu-huong" id="tqXuHuong" aria-labelledby="tqXuHuongTieu"><figcaption><div class="khoi-dau"><h2 id="tqXuHuongTieu">Giao mới và hoàn thành theo tuần</h2></div>
      <span class="chu-giai-nho"><span><i class="s1"></i>Giao mới</span><span><i class="s2"></i>Hoàn thành</span></span></figcaption>
    <div class="tuan-ve"><div class="tuan-luoi" aria-hidden="true">${luoi}</div><div class="tuan-cac" role="group" aria-label="Giao mới và hoàn thành theo tuần, 12 tuần gần đây">${cot}</div></div>
    <div class="tuan-truc" aria-hidden="true">${nhan}</div></figure>`;
}

// Dòng Nhiệm vụ quý của Ban Thường vụ (phân hệ riêng): tên, số nhiệm vụ và số ngày còn lại của quý, thanh cơ cấu theo trạng thái; câu tóm tắt như
// trang Tổng quan quý chỉ hiện ở bản in. nvq null (chưa có quý đang diễn ra, lỗi đọc) → không vẽ.
export function nvqHtml(nvq, homNay) {
  if (!nvq?.ky) return '';
  const d = demTheoTrangThai(nvq.rows || []); const cau = cauTomTat(d, nvq.ky, homNay);
  const phan = [[d.HOAN_THANH, 'hoàn thành', 'p-luc', true], [d.DANG_THUC_HIEN + d.THUONG_XUYEN, 'đang thực hiện', 'p-lam', true], [d.CHAM_TIEN_DO, 'chậm tiến độ', 'p-do', false],
    [d.CHUA_TRIEN_KHAI, 'chưa triển khai', 'p-xam', false]];
  const sau = cau.includes('. ') ? cau.slice(cau.indexOf('. ') + 2) : '';   // "Còn 35 ngày đến hết quý."
  const coCau = d.tong ? `<div class="nvq-co-cau"><span class="nvq-thanh" aria-hidden="true">${phan.filter(([n]) => n).map(([n, , lop]) => `<i class="${lop}" style="flex-grow:${n}"></i>`).join('')}</span>
      <span class="chu-giai-nho">${phan.filter(([n, , , luon]) => n || luon).map(([n, ten, lop]) => `<span><i class="${lop}"></i><b>${n}</b> ${ten}</span>`).join('')}</span></div>` : '';
  return `<div class="tq1-nvq" id="tqNvq"><div class="nvq-ten" ${goi(d.tong ? `${d.tong} nhiệm vụ. ${sau}` : cau)}><b>Nhiệm vụ quý của Ban Thường vụ, ${escapeHtml(tenKyNgan(nvq.ky))}</b>
      ${d.tong ? `<span class="sr">${d.tong} nhiệm vụ. ${escapeHtml(sau)}</span>` : `<small>${escapeHtml(cau)}</small>`}</div>${coCau}
    <p class="nvq-cau-in"><b>Nhiệm vụ quý của Ban Thường vụ, ${escapeHtml(tenKyNgan(nvq.ky))}:</b> ${escapeHtml(cau)}</p>
    <button type="button" class="nut" data-action="openNqTongQuan">Xem Tổng quan quý</button></div>`;
}
