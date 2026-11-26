// Tổng quan ba tầng — tầng 1 (v3.36, CAU-HOI V-1; DESIGN mục 10): vừa một màn hình, đọc trong 10 giây. Đầu trang (tên, phạm vi, giờ cập nhật, kỳ,
// Giao việc) → năm thẻ #tqSo (Quá hạn chưa hoàn thành là thẻ duy nhất có màu nhấn; Cần lãnh đạo cho ý kiến; Chỉ đạo chờ phản hồi; Đang thực hiện trong
// hạn; Đã hoàn thành trong kỳ) → câu kết luận + xu hướng 12 tuần → một dòng Nhiệm vụ quý của Ban Thường vụ. Mỗi thẻ, mỗi cột tuần là nút mở đúng danh
// sách tạo nên con số (data-action="tqMo", lib/kl/tong-quan-loc.js). Chỉ dựng chuỗi HTML từ số đã tính (lib/kl/tong-quan-tang.js).
import { escapeHtml } from '../../../lib/dom.js';
import { tenMuc } from '../../../lib/kl/nhan.js';
import { ngayVanBanVN } from '../../../lib/kl/ngay.js';
import { soSanh } from '../../../lib/kl/tong-quan-tang.js';
import { demTheoTrangThai, cauTomTat } from '../../../lib/nvq/tinh.js';
import { tenKyNgan } from '../../../lib/nvq/nhan.js';
import { mo, KY } from './template.js';

const ICON_GIAO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></svg>';
const ICON_IN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/></svg>';
const phan = (ds) => ds.filter(([n, , luon]) => n || luon).map(([n, chu]) => `${n} ${chu}`).join(', ');
const goi = (s) => `data-goi="${escapeHtml(s)}"`;

// Dòng so sánh: lop 'xau' khi tăng là xấu (quá hạn, cần ý kiến, chỉ đạo chờ), 'tot' khi giảm; thẻ trong hạn không tô màu.
function dongSoSanh(nay, cu, tangLaXau = true) {
  const s = soSanh(nay, cu);
  if (!s) return '';
  const lop = !tangLaXau || s.d === 0 ? '' : s.d > 0 ? ' xau' : ' tot';
  return `<span class="ss-tq${lop}">${s.chu}</span>`;
}
function the(khoa, so, nhan, phu, ssHtml, lop = '') {
  return `<button type="button" class="the-so${lop}" data-so="${khoa}" ${mo({ t: khoa })} aria-label="${escapeHtml(`${so} ${nhan}, xem danh sách`)}">
    <span class="gia">${so}</span><span class="nhan-so">${escapeHtml(nhan)}</span><span class="phu-h">${escapeHtml(phu)}</span>${ssHtml}</button>`;
}

// t: theTang1; cu: tuanTruoc (cu.ngay null = chưa có bản chụp tuần trước); k: kỳ đang chọn (thẻ hoàn thành).
export function theSoHtml(t, cu, k) {
  const coCu = Boolean(cu?.ngay);
  const qh = the('qh', t.qh.so, 'nhiệm vụ quá hạn chưa hoàn thành',
    t.qh.so ? phan([[t.qh.do, tenMuc('do'), true], [t.qh.ddb, tenMuc('ddb'), true]]) : 'Không có nhiệm vụ quá hạn', coCu ? dongSoSanh(t.qh.so, cu.qh) : '', t.qh.so ? ' nhan' : '');
  const quyet = the('quyet', t.quyet.so, 'nhiệm vụ cần lãnh đạo cho ý kiến',
    t.quyet.so ? phan([[t.quyet.vm, 'có vướng mắc hoặc đề xuất', true], [t.quyet.cq, 'quá hạn đã ghi cấp cần quyết định', true]]) : 'Không có vướng mắc, đề xuất chờ ý kiến', coCu ? dongSoSanh(t.quyet.so, cu.quyet) : '');
  const cd = the('cdCho', t.cd.so, 'nhiệm vụ có chỉ đạo chờ phản hồi',
    t.cd.so ? phan([[t.cd.quaHan, 'quá hạn phản hồi', true], [t.cd.trongHan, 'trong hạn phản hồi', true]]) : 'Không có chỉ đạo chờ phản hồi', dongSoSanh(t.cd.so, cu?.cd));
  const th = the('th', t.th.so, 'nhiệm vụ đang thực hiện trong hạn',
    phan([[t.th.trongHan, 'trong hạn', true], [t.th.vang, tenMuc('vang'), true], [t.th.khac, 'chưa có hạn hoặc thường xuyên']]), coCu ? dongSoSanh(t.th.so, cu.th, false) : '');
  const x = t.xong;
  const dh = x.tyLe !== null ? `Đúng hạn ${x.tyLe}%, tính trên ${x.xet} nhiệm vụ có đủ hạn và ngày hoàn thành${x.boSung ? ` (trong đó ${x.boSung} nhiệm vụ có ngày hoàn thành bổ sung)` : ''}`
    : x.so ? `Chưa tính tỷ lệ đúng hạn: ${x.xet}/${x.canXet} nhiệm vụ có hạn đã ghi ngày hoàn thành` : 'Chưa có nhiệm vụ hoàn thành trong kỳ';
  const xong = the('xong', x.so, `nhiệm vụ đã hoàn thành ${k.trong}`, dh, `<span class="ss-tq">${x.tuan} nhiệm vụ hoàn thành trong 7 ngày qua</span>`);
  return `<div class="tq1-the" id="tqSo">${qh}${quyet}${cd}${th}${xong}</div>`;
}

// Xu hướng 12 tuần: cột giao mới, hoàn thành; chấm quá hạn cuối tuần (bản chụp Chủ nhật, tuần này: số hiện tại). Mỗi tuần là nút mở danh sách giao
// mới / hoàn thành của tuần (t: 'tuan').
export function xuHuongHtml(ds) {
  const mx = Math.max(1, ...ds.map((w) => Math.max(w.giao, w.xong, w.qh || 0)));
  const buoc = [1, 2, 5, 10, 20, 50, 100, 200, 500].find((b) => Math.ceil(mx / b) <= 4) || 1000; const dinh = Math.ceil(mx / buoc) * buoc;
  const pt = (v) => `${(v / dinh) * 100}%`; const coQh = ds.filter((w) => w.qh !== null).length;
  const cot = ds.map((w, i) => {
    const chu = `Tuần ${w.nhan}${i === ds.length - 1 ? ' (tuần này)' : ''}: ${w.giao} giao mới, ${w.xong} hoàn thành${w.qh === null ? '' : `, ${w.qh} quá hạn ${i === ds.length - 1 ? 'hiện nay' : 'cuối tuần'}`}`;
    return `<button type="button" class="tuan-cot" ${mo({ t: 'tuan', tu: w.tu, den: w.den, ten: w.nhan })} ${goi(chu)} aria-label="${escapeHtml(chu)}">
      <span class="s1" style="height:${pt(w.giao)}"></span><span class="s2" style="height:${pt(w.xong)}"></span>${w.qh === null ? '' : `<i class="cham-qh" style="bottom:${pt(w.qh)}"></i>`}</button>`;
  }).join('');
  const nhan = ds.map((w, i) => `<span>${i === ds.length - 1 ? 'Tuần này' : i % 3 === 0 ? escapeHtml(w.nhan.split('–')[0]) : ''}</span>`).join('');
  return `<figure class="tq1-xu-huong" id="tqXuHuong" aria-labelledby="tqXuHuongTieu"><figcaption id="tqXuHuongTieu"><b>Xu hướng 12 tuần</b>
    <span class="chu-giai ngang"><span><i class="s1"></i>Giao mới</span><span><i class="s2"></i>Hoàn thành</span><span><i class="cg-qh"></i>Quá hạn</span></span></figcaption>
    <div class="tuan-ve" role="group" aria-label="Giao mới, hoàn thành và quá hạn theo tuần">${cot}</div><div class="tuan-truc" aria-hidden="true">${nhan}</div>
    ${coQh < 2 ? '<p class="chu-phu tq-chu-nho">Số quá hạn cuối tuần lấy từ bản chụp số liệu hằng ngày, có dần từ tuần đầu tiên chụp.</p>' : ''}</figure>`;
}

// Dòng Nhiệm vụ quý của Ban Thường vụ (phân hệ riêng): câu tóm tắt như trang Tổng quan quý; nvq null (chưa có quý đang diễn ra, lỗi đọc) → không vẽ.
export function nvqHtml(nvq, homNay) {
  if (!nvq?.ky) return '';
  return `<div class="tq1-nvq" id="tqNvq"><p><b>Nhiệm vụ quý của Ban Thường vụ, ${escapeHtml(tenKyNgan(nvq.ky))}:</b> ${escapeHtml(cauTomTat(demTheoTrangThai(nvq.rows || []), nvq.ky, homNay))}</p>
    <button type="button" class="nut nho" data-action="openNqTongQuan">Xem Tổng quan quý</button></div>`;
}

// Tầng 1 đầy đủ. luc: thời điểm đọc số liệu; kyChon null = đang dùng kỳ tuỳ chọn của bộ lọc chi tiết (không nút nào sáng).
// v3.36 (CAU-HOI V-1): bản in A4 "Báo cáo nhanh" — phần đầu theo thể thức Văn phòng (cơ quan, dòng Đảng, ngày), tên báo cáo, phạm vi, kỳ; chân ghi nguồn.
// Chỉ hiện khi in (tong-quan-in.css); in tầng 1, ma trận đơn vị, điểm nghẽn. coQuan = [cấp trên, cơ quan].
// Ngày theo thể thức (ngayVanBanVN: chỉ tháng 1, 2 viết hai chữ số), ngày giờ theo giờ Việt Nam.
const VN = { timeZone: 'Asia/Ho_Chi_Minh' };
export function inDauHtml({ coQuan = ['TỈNH ỦY CAO BẰNG', 'VĂN PHÒNG'], phamVi, kyTen, luc = new Date() }) {
  return `<div class="tq-in-dau" aria-hidden="true"><div class="tq-in-the-thuc"><div><span>${escapeHtml(coQuan[0])}</span><b>${escapeHtml(coQuan[1])}</b><span>*</span></div>
      <div><b class="tq-in-dang">ĐẢNG CỘNG SẢN VIỆT NAM</b><i>${ngayVanBanVN(luc)}</i></div></div>
    <p class="tq-in-ten">BÁO CÁO NHANH</p><p class="tq-in-trich-yeu">Tình hình thực hiện nhiệm vụ đến ngày ${luc.toLocaleDateString('vi-VN', VN)}</p>
    <p class="tq-in-pham-vi">Phạm vi: ${escapeHtml(phamVi)}. Kỳ tính hoàn thành: ${escapeHtml(kyTen || '')}. Số liệu lúc ${luc.toLocaleTimeString('vi-VN', { ...VN, hour: '2-digit', minute: '2-digit' })}.</p></div>`;
}
export const inChanHtml = () => '<p class="tq-in-chan" aria-hidden="true">In từ Hệ thống quản trị nhiệm vụ của Văn phòng Tỉnh ủy Cao Bằng; số liệu theo phạm vi của người in, việc đang mở và cảnh báo tính đến ngày in.</p>';

export function tang1Html({ tieuDe, phamVi, luc, ten, kyChon, coGiaoViec, theHtml, ketLuan, xuHuong, nvq, coQuan, kyTen }) {
  const capNhat = luc ? `Số liệu cập nhật ${luc.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })} ngày ${luc.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : 'Đang nạp số liệu…';
  return `<section class="tq-tang1" id="tqTang1" aria-labelledby="tqTieuDe">${inDauHtml({ coQuan, phamVi, kyTen, luc: luc || new Date() })}
    <div class="tq1-dau"><div class="tq1-ten"><h1 id="tqTieuDe">${escapeHtml(tieuDe)}</h1><p>${escapeHtml(phamVi)}. <span class="tq1-luc">${capNhat}</span></p></div>
      <div class="tq1-phai"><div class="pham-vi" role="group" aria-label="Kỳ tính hoàn thành và các bảng phân tích" id="tqKy">${KY.map((ky) => `<button type="button" data-action="tqKy" data-ky="${ky}" aria-pressed="${String(kyChon === ky)}">${escapeHtml(ten[ky])}</button>`).join('')}</div>
        <button type="button" class="nut" data-action="tqIn" id="tqIn" aria-label="In báo cáo nhanh trên một trang A4">${ICON_IN}<span class="chu-nut">In báo cáo nhanh</span></button>
        ${coGiaoViec ? `<button type="button" class="nut chinh" data-action="openGiaoViec" aria-label="Giao việc">${ICON_GIAO}<span class="chu-nut">Giao việc</span></button>` : ''}</div></div>
    ${theHtml}
    <div class="tq1-duoi"><p class="tq1-ket-luan" id="tqKetLuan">${escapeHtml(ketLuan)}</p>${xuHuong}</div>${nvq}</section>`;
}

// Khung chờ (lần mở đầu chưa có số): đầu trang + năm thẻ nhấp nháy, không hiện số 0 gây hiểu nhầm.
export function khungCho1Html(tieuDe, phamVi) {
  const o = '<span class="the-so cho" aria-hidden="true"><span class="xuong" style="width:56px;height:30px"></span><span class="xuong" style="width:80%;margin-top:10px"></span><span class="xuong" style="width:60%;margin-top:8px"></span></span>';
  return `<section class="tq-tang1" aria-busy="true"><div class="tq1-dau"><div class="tq1-ten"><h1>${escapeHtml(tieuDe)}</h1><p>${escapeHtml(phamVi)}. <span class="tq1-luc">Đang nạp số liệu…</span></p></div></div>
    <div class="tq1-the">${o.repeat(5)}</div></section>`;
}
