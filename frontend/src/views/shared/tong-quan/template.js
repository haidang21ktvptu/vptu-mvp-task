// Khối giao diện của màn hình Tổng quan (bản mẫu v9; v3.24 bố cục 9 khối cho lãnh đạo): dải đầu (vòng đúng hạn, xu hướng, 4 số; kỳ Tháng / Quý / Năm /
// Nhiệm kỳ), khối 5 theo tháng (+ đúng hạn theo quý), 6 văn bản (Văn bản / Loại văn bản), 7 chỉ đạo (+ vướng mắc chờ ý kiến), 8 chất lượng, bảng theo
// phòng / cán bộ (trong khối 9). Chỉ dựng chuỗi HTML từ số đã tính (lib/kl/tong-quan.js). MỌI số, cột, đoạn, dòng bấm được — data-action="tqMo" +
// data-ct (chỉ tiêu, lib/kl/tong-quan-loc.js) → danh sách việc mở ngay trong ngăn chi tiết dùng chung; không chuyển sang mục khác.
import { escapeHtml } from '../../../lib/dom.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { tenLoaiVanBan } from '../kl/them-owner.js';
import { vongHtml, cotThangHtml, xepHtml, chuGiaiHtml } from './bieu-do.js';

export const mo = (ct) => `data-action="tqMo" data-ct='${escapeHtml(JSON.stringify(ct))}'`;
export const dauThe = (tieu, phu, phai = '') => `<div class="dau-bd"><div><h2>${tieu}</h2><p>${phu}</p></div>${phai}</div>`;
// v3.24: tiêu đề khối có số thứ tự. v3.28: số do danhSoKhoi đánh lại theo thứ tự các khối đang hiện (khối ẩn — Giải ngân vốn chưa có số liệu, Chất
// lượng chưa có việc xếp loại — không làm hụt số); `so` truyền vào chỉ là chỗ giữ.
export const dauKhoi = (so, tieu, phu, phai = '', id = '') => `<div class="dau-bd"><div><h2${id ? ` id="${id}"` : ''}><span class="so-khoi" aria-hidden="true">${so}</span>${tieu}</h2><p>${phu}</p></div>${phai}</div>`;
export const danhSoKhoi = (html) => { let n = 0; return html.replace(/<span class="so-khoi" aria-hidden="true">\d+<\/span>/g, () => `<span class="so-khoi" aria-hidden="true">${++n}</span>`); };
// Nhóm nút chọn một (segmented) — act: hành động; k: tên data-*; ds: [[giá trị, nhãn]].
export const nhomNut = (act, k, ds, chon, nhan) => `<div class="pham-vi" role="group" aria-label="${nhan}">${ds.map(([v, ten]) => `<button type="button" data-action="${act}" data-${k}="${escapeHtml(v)}" aria-pressed="${String(chon === v)}">${escapeHtml(ten)}</button>`).join('')}</div>`;
const ICON_GIAO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></svg>';
export const KY = ['thang', 'quy', 'nam', 'nhiem-ky'];

// Đợt C1: mỗi ô có dòng tỷ lệ và một câu quy tắc cảnh báo (quyTac). v3.27 (chủ dự án 20/10/2026 — Tổng quan chính xác tối đa với dữ liệu hiện có):
// vòng tròn là TỶ LỆ HOÀN THÀNH = hoàn thành trong kỳ / (hoàn thành trong kỳ + đang làm) — trước đây "đúng hạn" chỉ dựa trên vài việc có ngày hoàn
// thành (dữ liệu nhập từ Excel chưa có ngày) nên ghi 100% gây hiểu nhầm; đúng hạn ghi kèm số việc xét được; % hoàn thành / đang làm cùng mẫu số đó.
// kyChon null = đang dùng kỳ tuỳ chọn của bộ lọc chi tiết (không nút kỳ nào sáng).
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
export function dauTrangHtml({ tieuDe, phamVi, k, ten, kyChon, luc, s, coGiaoViec, tong = 0, quyTac = '' }) {
  const capNhat = luc ? `Số liệu cập nhật ${luc.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })} ngày ${luc.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : 'Đang nạp số liệu…';
  const kyTong = s.xong + s.dangMo;
  const o = (khoa, so, nhan, phu, tyLe = '') => `<button type="button" class="o-hung" data-so="${khoa}" ${mo({ t: khoa })} aria-label="${escapeHtml(`${so} ${nhan} — xem danh sách`)}"><span class="gia">${so}</span><span class="nhan-so">${nhan}</span><span class="phu-h">${phu}</span>${tyLe ? `<span class="ty-le">${tyLe}</span>` : ''}</button>`;
  return `<section class="anh-hung" aria-label="Tổng quan thực hiện nhiệm vụ">
    <div class="hung-dau"><div><h1>${escapeHtml(tieuDe)}</h1><p>${escapeHtml(phamVi)}. <span class="ngay-hung">${capNhat}</span></p></div>
      <div class="hung-phai"><div class="ky" role="group" aria-label="Kỳ số liệu" id="tqKy">${KY.map((ky) => `<button type="button" data-action="tqKy" data-ky="${ky}" aria-pressed="${String(kyChon === ky)}">${escapeHtml(ten[ky])}</button>`).join('')}</div>
        ${coGiaoViec ? `<button type="button" class="nut chinh" data-action="openGiaoViec" aria-label="Giao việc">${ICON_GIAO}<span class="chu-nut">Giao việc</span></button>` : ''}</div></div>
    <div class="hung-so" id="tqSo">
      <button type="button" class="o-hung o-vong" ${mo({ t: 'xong' })}>${vongHtml(kyTong ? pct(s.xong, kyTong) : null, 'hoàn thành')}<span class="xh-tq"><span class="nhan-so">Tỷ lệ hoàn thành</span><span class="phu-h">${kyTong ? `${s.xong} trên ${kyTong} nhiệm vụ của kỳ (hoàn thành ${k.trong} + đang làm)` : 'chưa có nhiệm vụ trong kỳ'} · đúng hạn: ${s.dungHan + s.tre ? `${s.dungHan}/${s.dungHan + s.tre} việc xét được` : 'chưa có việc xét được'}</span></span></button>
      ${o('giao', s.giao, 'nhiệm vụ giao', k.trong, `tổng ${tong} nhiệm vụ trong phạm vi`)}
      ${o('xong', s.xong, 'đã hoàn thành', `${s.dungHan} đúng hạn${s.tre ? `, ${s.tre} trễ` : ''}${s.chuaRoNgay ? `, ${s.chuaRoNgay} chưa rõ ngày hoàn thành` : ''}`, `${pct(s.xong, kyTong)}% việc của kỳ`)}
      ${o('mo', s.dangMo, 'đang thực hiện', `${s.mo.trongHan + s.mo.nt} việc trong hạn`, `${pct(s.dangMo, kyTong)}% việc của kỳ`)}
      ${o('canh', s.canhBao, 'cảnh báo', s.canhBao ? `${s.mo.vang} Vàng, ${s.mo.do} Đỏ, ${s.mo.ddb} Đỏ đặc biệt` : 'không có việc chậm', `${pct(s.canhBao, s.dangMo)}% việc đang làm`)}
    </div>${quyTac ? `<p class="hung-quy-tac" id="tqQuyTac">${escapeHtml(quyTac)}</p>` : ''}</section>`;
}

// Khối 5: cột theo tháng (năm hiện tại) + tỷ lệ đúng hạn quý trước / quý này (dungHanQuy).
export function theThangHtml(thang, nam, quy = []) {
  const dongQuy = quy.map((q) => `<button type="button" class="dong-td dong-bam" ${mo({ t: 'quy', tu: q.tu, den: q.den, ten: q.ten })}><span>Tỷ lệ đúng hạn ${escapeHtml(q.ten)}</span><b>${q.tyLe === null ? '—' : `${q.tyLe}%`}</b></button>`).join('');
  return `<article class="the-bd n5" id="tqThang">${dauKhoi(5, 'Giao mới và hoàn thành theo tháng', `Số nhiệm vụ, năm ${nam} · bấm một tháng để xem việc`,
    '<div class="chu-giai ngang"><span><i class="s1"></i>Giao mới</span><span><i class="s2"></i>Hoàn thành</span></div>')}${cotThangHtml(thang, (d) => mo({ t: 'thang', th: d.thang }))}
    <div class="quy-tq">${dongQuy}</div></article>`;
}

// kh: cách gom của bảng bấm vào (mặc định khoaNhom theo vai; 'cb' / 'phong' = bảng KPI theo cán bộ, kpi-can-bo.js).
export const pillCanh = (d, kh = null) => [[d.ddb, 'ddb', 'Đỏ đặc biệt'], [d.do, 'do', 'Đỏ'], [d.vang, 'vang', 'Vàng']].filter(([n]) => n)
  .map(([n, lop, ten]) => `<button type="button" class="muc-tq ${lop}" title="${n} việc ${ten}" ${mo({ t: 'nhom', ma: d.ma, ten: d.ten, m: lop, ...(kh ? { kh } : {}) })}>${n}<span class="sr"> việc ${ten}</span></button>`).join('') || '<span class="chu-phu">Không</span>';
export const thuoc = (p) => `<span class="dong-han"><span class="thuoc-tq ${p === null ? '' : p >= 85 ? 'tot' : p >= 70 ? 'canh' : 'nguy'}"><i style="width:${p || 0}%"></i></span><b>${p === null ? '—' : `${p}%`}</b></span>`;
const TIEU_NHOM = { A0: ['Theo đơn vị chủ trì theo dõi', 'Đơn vị'], A2: ['Theo cán bộ', 'Cán bộ'], A3: ['Theo cán bộ', 'Cán bộ'], A1: ['Theo phòng, đơn vị', 'Phòng'] };
export function bangNhomHtml(ds, vai, k) {
  const [tieu, cot] = TIEU_NHOM[vai] || TIEU_NHOM.A1;
  const dong = (d) => {
    const ten = `<b>${escapeHtml(d.ten)}</b><small><span class="chi-mt">${d.tong} nhiệm vụ</span><span class="chi-dt">${d.xong} hoàn thành, ${d.dangMo} đang làm</span></small>`;
    const o = `<button type="button" class="ten-bam" ${mo({ t: 'nhom', ma: d.ma, ten: d.ten })}>${ten}</button>`;
    return `<tr><td class="c-ten">${o}</td>
      <td class="so" data-n="Hoàn thành">${d.xong}</td><td class="so" data-n="Đang làm">${d.dangMo}</td><td data-n="Cảnh báo"><span class="canh-tq">${pillCanh(d)}</span></td><td data-n="Đúng hạn">${thuoc(d.tyLe)}</td></tr>`;
  };
  return `<article class="the-bd n12" id="tqTheoNhom">${dauThe(tieu, `Hoàn thành và đúng hạn tính ${k.trong}; đang làm, cảnh báo tính đến hôm nay`)}
    ${ds.length ? `<div class="cuon-ngang"><table class="bang-tq"><thead><tr><th>${cot}</th><th class="so">Hoàn thành</th><th class="so">Đang làm</th><th>Cảnh báo</th><th>Đúng hạn</th></tr></thead>
      <tbody>${ds.map(dong).join('')}</tbody></table></div>` : '<p class="trong">Chưa có nhiệm vụ trong phạm vi.</p>'}</article>`;
}

// Khối 6: tiến độ theo văn bản chỉ đạo; nút "Loại văn bản" chuyển sang bảng theo loại (loaiHtml — loc-template.js) trong cùng khối.
export function vanBanHtml(ds, xem = 'vb', loaiHtml = '') {
  const li = (v) => {
    const p = v.tong ? Math.round((v.xong / v.tong) * 100) : 0;
    return `<li><button type="button" class="vb-dong" ${mo({ t: 'vb', id: v.id, ten: v.soHieu || 'không số hiệu' })}><span class="vb-ten"><span class="so-hieu">${escapeHtml(v.soHieu || 'Không số hiệu')}${v.do ? `<span class="muc-tq do">${v.do} Đỏ</span>` : ''}</span>
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
