// Khối giao diện của màn hình Tổng quan (bản mẫu v9; v3.24 bố cục 9 khối cho lãnh đạo; v3.36 ba tầng: đầu trang và năm thẻ ở tang-1.js, ma trận đơn vị
// ở ma-tran.js thay dải đầu và bảng theo phòng / cán bộ): khối theo tháng (+ đúng hạn theo quý), văn bản (Văn bản / Loại văn bản), chỉ đạo (+ vướng mắc
// chờ ý kiến), chất lượng; các mẩu dùng chung (mo, dauKhoi, nhomNut, pillCanh, thuoc). Chỉ dựng chuỗi HTML từ số đã tính (lib/kl/tong-quan.js). MỌI số, cột, đoạn, dòng bấm được — data-action="tqMo" +
// data-ct (chỉ tiêu, lib/kl/tong-quan-loc.js) → danh sách việc mở ngay trong ngăn chi tiết dùng chung; không chuyển sang mục khác.
import { escapeHtml } from '../../../lib/dom.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { tenLoaiVanBan } from '../kl/them-owner.js';
import { cotThangHtml, xepHtml, chuGiaiHtml } from './bieu-do.js';
import { tenMuc } from '../../../lib/kl/nhan.js';

export const mo = (ct) => `data-action="tqMo" data-ct='${escapeHtml(JSON.stringify(ct))}'`;
export const dauThe = (tieu, phu, phai = '') => `<div class="dau-bd"><div><h2>${tieu}</h2><p>${phu}</p></div>${phai}</div>`;
// v3.24: tiêu đề khối có số thứ tự. v3.28: số do danhSoKhoi đánh lại theo thứ tự các khối đang hiện (khối ẩn — Giải ngân vốn chưa có số liệu, Chất
// lượng chưa có việc xếp loại — không làm hụt số); `so` truyền vào chỉ là chỗ giữ.
export const dauKhoi = (so, tieu, phu, phai = '', id = '') => `<div class="dau-bd"><div><h2${id ? ` id="${id}"` : ''}><span class="so-khoi" aria-hidden="true">${so}</span>${tieu}</h2><p>${phu}</p></div>${phai}</div>`;
export const danhSoKhoi = (html) => { let n = 0; return html.replace(/<span class="so-khoi" aria-hidden="true">\d+<\/span>/g, () => `<span class="so-khoi" aria-hidden="true">${++n}</span>`); };
// Nhóm nút chọn một (segmented) — act: hành động; k: tên data-*; ds: [[giá trị, nhãn]].
export const nhomNut = (act, k, ds, chon, nhan) => `<div class="pham-vi" role="group" aria-label="${nhan}">${ds.map(([v, ten]) => `<button type="button" data-action="${act}" data-${k}="${escapeHtml(v)}" aria-pressed="${String(chon === v)}">${escapeHtml(ten)}</button>`).join('')}</div>`;
export const KY = ['thang', 'quy', 'nam', 'nhiem-ky'];

// Khối 5: cột theo tháng (năm hiện tại) + tỷ lệ đúng hạn quý trước / quý này (dungHanQuy).
export function theThangHtml(thang, nam, quy = []) {
  const dongQuy = quy.map((q) => `<button type="button" class="dong-td dong-bam" ${mo({ t: 'quy', tu: q.tu, den: q.den, ten: q.ten })}><span>Tỷ lệ đúng hạn ${escapeHtml(q.ten)}</span><b>${q.tyLe === null ? '—' : `${q.tyLe}%`}</b></button>`).join('');
  return `<article class="the-bd n5" id="tqThang">${dauKhoi(5, 'Giao mới và hoàn thành theo tháng', `Số nhiệm vụ, năm ${nam} · bấm một tháng để xem việc`,
    '<div class="chu-giai ngang"><span><i class="s1"></i>Giao mới</span><span><i class="s2"></i>Hoàn thành</span></div>')}${cotThangHtml(thang, (d) => mo({ t: 'thang', th: d.thang }))}
    <div class="quy-tq">${dongQuy}</div></article>`;
}

// kh: cách gom của bảng bấm vào (mặc định khoaNhom theo vai; 'cb' / 'phong' = bảng KPI theo cán bộ, kpi-can-bo.js).
export const pillCanh = (d, kh = null) => [[d.ddb, 'ddb'], [d.do, 'do'], [d.vang, 'vang']].filter(([n]) => n).map(([n, lop]) => [n, lop, tenMuc(lop)])
  .map(([n, lop, ten]) => `<button type="button" class="muc-tq ${lop}" title="${n} nhiệm vụ ${ten}" ${mo({ t: 'nhom', ma: d.ma, ten: d.ten, m: lop, ...(kh ? { kh } : {}) })}>${n}<span class="sr"> nhiệm vụ ${ten}</span></button>`).join('') || '<span class="chu-phu">Không</span>';
export const thuoc = (p) => `<span class="dong-han"><span class="thuoc-tq ${p === null ? '' : p >= 85 ? 'tot' : p >= 70 ? 'canh' : 'nguy'}"><i style="width:${p || 0}%"></i></span><b>${p === null ? '—' : `${p}%`}</b></span>`;
// Khối 6: tiến độ theo văn bản chỉ đạo; nút "Loại văn bản" chuyển sang bảng theo loại (loaiHtml — loc-template.js) trong cùng khối.
export function vanBanHtml(ds, xem = 'vb', loaiHtml = '') {
  const li = (v) => {
    const p = v.tong ? Math.round((v.xong / v.tong) * 100) : 0;
    return `<li><button type="button" class="vb-dong" ${mo({ t: 'vb', id: v.id, ten: v.soHieu || 'không số hiệu' })}><span class="vb-ten"><span class="so-hieu">${escapeHtml(v.soHieu || 'Không số hiệu')}${v.do ? `<span class="muc-tq do">${v.do} quá hạn</span>` : ''}</span>
      <span class="trich">${escapeHtml([tenLoaiVanBan(v.loai), v.ngay ? `ban hành ${formatNgay(v.ngay)}` : ''].filter(Boolean).join(', '))}</span></span>
      <span class="td"><span class="td-so"><span>${p}%</span><b>${v.xong} / ${v.tong}</b></span><span class="thuoc-tq tot"><i style="width:${p}%"></i></span></span></button></li>`;
  };
  const nut = nhomNut('tqVbXem', 'xem', [['vb', 'Văn bản'], ['loai', 'Loại văn bản']], xem, 'Xem theo');
  const than = xem === 'loai' ? loaiHtml : ds.length ? `<ul class="vb-tq">${ds.map(li).join('')}</ul>` : '<p class="trong">Chưa có văn bản giao việc.</p>';
  return `<article class="the-bd n4" id="tqVanBan">${dauKhoi(6, 'Tiến độ theo văn bản chỉ đạo', xem === 'loai' ? 'Tổng, hoàn thành (mọi kỳ) và đang làm theo loại văn bản' : 'Việc đã hoàn thành trên tổng số việc đã nhập', nut)}${than}</article>`;
}

export function chatLuongHtml(c, k) {
  const phan = [['Xuất sắc', c.xuatSac, '--f-xs', mo({ t: 'cl', cl: 'DAT_XUAT_SAC' })], ['Đạt tốt', c.tot, '--f-dt', mo({ t: 'cl', cl: 'DAT_TOT' })],
    ['Đạt', c.dat, '--f-d', mo({ t: 'cl', cl: 'DAT' })], ['Không đạt', c.khongDat, '--f-do', mo({ t: 'cl', cl: 'KHONG_DAT' })]];
  return `<article class="the-bd n4" id="tqChatLuong">${dauKhoi(8, 'Chất lượng hoàn thành', `${c.coDanhGia} việc được xếp loại chất lượng ${k.trong}${c.chuaDanhGia ? `, ${c.chuaDanhGia} việc chưa xếp loại (không bắt buộc)` : ''}`)}
    <div class="so-dau"><b>${c.tyLeTot === null ? '—' : `${c.tyLeTot}%`}</b><span>đạt tốt trở lên</span></div>${xepHtml(phan, c.coDanhGia)}${chuGiaiHtml(phan, 'sat')}
    <button type="button" class="cuoi-the" ${mo({ t: 'traLai' })}><span>Trả lại để bổ sung</span><b>${c.traLai} lượt${c.viecTraLai ? ` · ${c.viecTraLai} việc` : ''}</b></button></article>`;
}

// Khối 7: chỉ đạo và phản hồi + số việc có vướng mắc chờ lãnh đạo cho ý kiến (soVm).
const AI_CD = { A0: 'của Thường trực', A1: 'của lãnh đạo Văn phòng', A2: 'của Trưởng phòng', A3: 'của Trưởng phòng' };
export function chiDaoHtml(d, vai, k, soVm = 0) {
  return `<article class="the-bd n4" id="tqChiDao">${dauKhoi(7, 'Chỉ đạo và phản hồi', `Ý kiến chỉ đạo ${AI_CD[vai] || ''} ${k.trong}`)}
    <div class="cd-so"><button type="button" ${mo({ t: 'cd', loai: 'banHanh' })}><b>${d.banHanh}</b><span>ý kiến chỉ đạo</span><small class="on">${d.daPhanHoi} đã phản hồi</small></button>
      <button type="button" ${mo({ t: 'cd', loai: 'dangCho' })}><b>${d.dangCho}</b><span>đang chờ phản hồi</span>${d.quaHan ? `<small>${d.quaHan} quá hạn</small>` : '<small class="on">không quá hạn</small>'}</button></div>
    <div class="cd-chan"><div class="dong-td"><span>Phản hồi đúng hạn</span><b>${d.tyLeDungHan === null ? '—' : `${d.tyLeDungHan}%`}</b></div><span class="thuoc-tq"><i style="width:${d.tyLeDungHan || 0}%"></i></span>
      <div class="dong-td"><span>Thời gian phản hồi trung bình</span><b>${d.tbNgay === null ? '—' : `${String(d.tbNgay).replace('.', ',')} ngày`}</b></div>
      <button type="button" class="dong-td dong-bam" id="tqVuongMac" ${mo({ t: 'vm' })}><span>Vướng mắc chờ lãnh đạo cho ý kiến</span><b>${soVm} việc</b></button>
      <button type="button" class="nut nho" ${mo({ t: 'cd', loai: 'dangCho' })}>Xem việc chờ phản hồi</button></div></article>`;
}
