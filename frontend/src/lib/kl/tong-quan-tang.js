// Tổng quan ba tầng (v3.36, Đợt 1 sau rà soát 25/11/2026, CAU-HOI V-1). Tầng 1: năm thẻ theo ba nhóm của Báo cáo 3764/BC-VPCP (quá hạn chưa hoàn
// thành, đang thực hiện trong hạn, đã hoàn thành) cộng hai thẻ cần lãnh đạo (cho ý kiến, chỉ đạo chờ phản hồi); so với tuần trước theo bảng chụp số
// liệu hằng ngày (kl_chup_viec, 0140); câu kết luận tự động; xu hướng 12 tuần. Tầng 2: ma trận đơn vị theo trạng thái. Thuần (không DOM, không
// Supabase); unit test frontend/tests/tong-quan-tang.test.mjs. Cùng quy ước với lib/kl/tong-quan.js: việc đang mở và cảnh báo tính đến hôm nay, hoàn
// thành tính trong kỳ đang chọn; các phần của một thẻ cộng đủ số của thẻ (DESIGN mục 13).
import { laMo, laXong, mucMo, xongTrongKy, chiDaoPhan, ngayGiao, ngayXong } from './tong-quan.js';
import { homNayVN, congNgay, formatNgay } from './ngay.js';

export const laQuaHan = (r) => laMo(r) && ['do', 'ddb'].includes(mucMo(r));
export const laTrongHan = (r) => laMo(r) && !laQuaHan(r);
// Cần lãnh đạo cho ý kiến: việc đang mở có vướng mắc, đề xuất (khối "Vướng mắc chờ lãnh đạo cho ý kiến"), hoặc quá hạn đã ghi cấp cần quyết định.
export const canYKien = (r) => laMo(r) && (Boolean(r.vuong_mac) || (laQuaHan(r) && Boolean(r.cap_quyet_dinh)));
const coDanhGia = (r) => r.ket_qua === 'DUNG_HAN' || r.ket_qua === 'TRE';
// Tỷ lệ đúng hạn chỉ ghi khi đủ dữ liệu: ít nhất 5 việc xét được và ít nhất 70% số việc có hạn đã có ngày hoàn thành (rà soát 25/11/2026: trước đây
// "đúng hạn 48/62" dễ đọc thành tỷ lệ của cả 337 việc đã hoàn thành).
export const DU_LIEU_TOI_THIEU = { viec: 5, phan: 0.7 };
export function tyLeDungHan(xet, dung, canXet) {
  return xet >= DU_LIEU_TOI_THIEU.viec && xet >= DU_LIEU_TOI_THIEU.phan * canXet ? Math.round((dung / xet) * 100) : null;
}
const TU_DAU = '2000-01-01';
const ngayVN = (ts) => (ts ? homNayVN(new Date(ts)) : null);
const trongKhoang = (d, w) => Boolean(d) && d >= w.tu && d <= w.den;
// Chỉ đạo đang chờ phản hồi tại một ngày cũ: tính lại từ mốc gửi / phản hồi; chỉ đạo đã đóng mà không phản hồi lấy theo trạng thái hiện tại.
const choTai = (c, ngay) => ngayVN(c.created_at) <= ngay && (c.phan_hoi_luc ? ngayVN(c.phan_hoi_luc) > ngay : c.trang_thai === 'CHO_PHAN_HOI');
const idsCua = (rows) => new Set(rows.map((r) => r.id));

// Việc (trong tập đang xem) có chỉ đạo của vai người xem đang chờ phản hồi — tách quá hạn / trong hạn phản hồi (mỗi việc vào đúng một phần).
export function chiDaoChoViec(rows, cds, ctxCd, homNay) {
  const ids = idsCua(rows);
  const p = chiDaoPhan(cds, { tu: TU_DAU, den: homNay }, ctxCd, new Date(`${homNay}T05:00:00Z`));   // quá hạn phản hồi tính tới 12 giờ trưa hôm nay
  const cho = p.dangCho.filter((c) => ids.has(c.nhiem_vu_id));
  const quaHan = new Set(p.quaHan.filter((c) => ids.has(c.nhiem_vu_id)).map((c) => c.nhiem_vu_id));
  const tat = new Set(cho.map((c) => c.nhiem_vu_id));
  return { quaHan: rows.filter((r) => quaHan.has(r.id)), trongHan: rows.filter((r) => tat.has(r.id) && !quaHan.has(r.id)), yKien: cho.length };
}

export function theTang1(rows, k, { cds = [], ctxCd = {}, homNay = homNayVN() } = {}) {
  const mo = rows.filter(laMo); const qh = mo.filter(laQuaHan); const th = mo.filter((r) => !laQuaHan(r)); const quyet = mo.filter(canYKien);
  const cd = chiDaoChoViec(rows, cds, ctxCd, homNay);
  const xong = rows.filter((r) => xongTrongKy(r, k)); const dg = xong.filter(coDanhGia); const dung = dg.filter((r) => r.ket_qua === 'DUNG_HAN').length;
  const canXet = xong.filter((r) => r.han_xu_ly).length; const d7 = congNgay(homNay, -7);
  const dem = (ds, muc) => ds.filter((r) => muc.includes(mucMo(r))).length;
  return {
    qh: { so: qh.length, do: dem(qh, ['do']), ddb: dem(qh, ['ddb']) },
    quyet: { so: quyet.length, vm: quyet.filter((r) => r.vuong_mac).length, cq: quyet.filter((r) => !r.vuong_mac).length },
    cd: { so: cd.quaHan.length + cd.trongHan.length, quaHan: cd.quaHan.length, trongHan: cd.trongHan.length, yKien: cd.yKien },
    th: { so: th.length, trongHan: dem(th, ['trongHan', 'nt']), vang: dem(th, ['vang']), khac: dem(th, ['khac']) },
    xong: { so: xong.length, dung, tre: dg.length - dung, chuaXet: xong.length - dg.length, xet: dg.length, canXet, tyLe: tyLeDungHan(dg.length, dung, canXet),
      boSung: dg.filter((r) => r.ngay_hoan_thanh_bo_sung).length,   // 0141: việc xét đúng hạn có ngày hoàn thành do hệ thống bổ sung
      tuan: rows.filter((r) => laXong(r) && r.ngay_hoan_thanh && !r.ngay_hoan_thanh_bo_sung && r.ngay_hoan_thanh > d7 && r.ngay_hoan_thanh <= homNay).length },   // 0141: chỉ ngày thật
  };
}

// Số của tuần trước trên CÙNG tập việc đang xem (bộ lọc, phạm vi): việc giao trong tuần không có trong bản chụp; việc hoàn thành trong tuần có (lúc
// đó còn mở). chup: { ngay, rows } — bản chụp gần nhất 7–10 ngày trước (null = chưa có, thẻ không ghi so sánh). Chỉ đạo tính lại tại hôm nay − 7.
const tuChup = (s) => ({ nhom_dem: s.nhom_dem, muc_canh_bao: s.muc_canh_bao, vuong_mac: s.co_vuong_mac ? 'co' : null, cap_quyet_dinh: s.cap_quyet_dinh });
export function tuanTruoc(rows, chup, { cds = [], ctxCd = {}, homNay = homNayVN() } = {}) {
  const ids = idsCua(rows); const ngayCd = congNgay(homNay, -7);
  const p = chiDaoPhan(cds, { tu: TU_DAU, den: ngayCd }, ctxCd);
  const cd = new Set(p.banHanh.filter((c) => ids.has(c.nhiem_vu_id) && choTai(c, ngayCd)).map((c) => c.nhiem_vu_id)).size;
  if (!chup?.ngay) return { ngay: null, cd };
  const cu = (chup.rows || []).filter((s) => ids.has(s.nhiem_vu_id)).map(tuChup);
  return { ngay: chup.ngay, qh: cu.filter(laQuaHan).length, quyet: cu.filter(canYKien).length, th: cu.filter(laTrongHan).length, cd };
}
export function soSanh(nay, cu) {
  if (cu === null || cu === undefined) return null;
  const d = nay - cu;
  return { d, chu: d > 0 ? `tăng ${d} nhiệm vụ so với tuần trước` : d < 0 ? `giảm ${-d} nhiệm vụ so với tuần trước` : 'không đổi so với tuần trước' };
}

// Đơn vị có nhiều việc quá hạn nhất (tối đa n) theo cách gom của bảng (khoaNhom). Gom theo cán bộ (Trưởng phòng) thì màn hình không gọi: câu kết luận
// không nêu tên cán bộ.
export function nhieuQuaHanNhat(rows, khoa, n = 2) {
  const m = new Map();
  rows.filter(laQuaHan).forEach((r) => { const [ma, ten] = khoa(r); const g = m.get(ma) || { ten, so: 0 }; g.so += 1; m.set(ma, g); });
  return [...m.values()].sort((a, b) => b.so - a.so || a.ten.localeCompare(b.ten, 'vi')).slice(0, n).map((g) => [g.ten, g.so]);
}

// Một câu cho lãnh đạo đọc nhanh: quá hạn (so với tuần trước, nơi nhiều nhất), cần cho ý kiến, chỉ đạo chờ phản hồi; không có quá hạn thì nêu số
// đang thực hiện trong hạn. daLoc: số theo bộ lọc đang áp dụng.
export function cauKetLuan(t, cu, { homNay = homNayVN(), nhieuNhat = [], daLoc = false, tong = 1 } = {}) {
  const dau = `${daLoc ? 'Theo bộ lọc đang áp dụng, đến' : 'Đến'} ngày ${formatNgay(homNay)}`;
  if (!tong) return `${dau}, chưa có nhiệm vụ trong phạm vi theo dõi.`;
  const ss = cu?.ngay ? soSanh(t.qh.so, cu.qh) : null;
  const noi = nhieuNhat.filter(([, n]) => n > 0).map(([ten, n]) => `${ten} (${n} nhiệm vụ)`);
  const ve = [t.qh.so ? `có ${t.qh.so} nhiệm vụ quá hạn chưa hoàn thành${ss ? ` (${ss.chu})` : ''}${noi.length ? `, nhiều nhất ở ${noi.join(' và ')}` : ''}`
    : `không có nhiệm vụ quá hạn chưa hoàn thành${ss && ss.d < 0 ? ` (tuần trước có ${cu.qh} nhiệm vụ)` : ''}`];
  if (t.quyet.so) ve.push(`${t.quyet.so} nhiệm vụ cần lãnh đạo cho ý kiến`);
  if (t.cd.so) ve.push(`${t.cd.so} nhiệm vụ có chỉ đạo chờ phản hồi${t.cd.quaHan ? `, trong đó ${t.cd.quaHan} nhiệm vụ quá hạn phản hồi` : ''}`);
  if (!t.qh.so) ve.push(`${t.th.so} nhiệm vụ đang thực hiện trong hạn`);
  return `${dau}, ${ve.join('; ')}.`;
}

// Câu kết luận gọn ghi trên màn hình (v3.36, CAU-HOI V-13 "số trước, chi tiết bấm mới mở"): chỉ số việc quá hạn và nơi nhiều nhất; câu đủ (cauKetLuan)
// dùng cho bản in "Báo cáo nhanh". Cùng tham số với cauKetLuan.
export function cauKetLuanGon(t, { nhieuNhat = [], daLoc = false, tong = 1 } = {}) {
  const noi = nhieuNhat.find(([, n]) => n > 0);
  const cau = !tong ? 'chưa có nhiệm vụ trong phạm vi theo dõi' : !t.qh.so ? 'không có nhiệm vụ quá hạn'
    : `${t.qh.so} nhiệm vụ quá hạn${noi ? `, nhiều nhất ở ${noi[0]} (${noi[1]})` : ''}`;
  return daLoc ? `Theo bộ lọc: ${cau}.` : `${cau.charAt(0).toUpperCase()}${cau.slice(1)}.`;
}

// 12 tuần gần nhất (thứ Hai đến Chủ nhật), tuần cuối chứa hôm nay.
const ngayNgan = (s) => { const [, m, d] = s.split('-'); return `${Number(d)}/${Number(m)}`; };
export function tuanGanDay(homNay, n = 12) {
  const thu = (new Date(`${homNay}T00:00:00Z`).getUTCDay() + 6) % 7;   // 0 = thứ Hai
  const dau = congNgay(homNay, -thu);
  return Array.from({ length: n }, (_, i) => {
    const tu = congNgay(dau, -7 * (n - 1 - i)); const den = congNgay(tu, 6);
    return { tu, den, nhan: `${ngayNgan(tu)}–${ngayNgan(den)}` };
  });
}
// Giao mới, hoàn thành (theo ngày hoàn thành; chưa rõ ngày thì theo ngày giao, như biểu đồ tháng) mỗi tuần; quá hạn cuối tuần lấy từ bản chụp Chủ nhật
// (quaHanChup: Map ngày → Set id việc quá hạn), lọc theo tập việc đang xem; tuần hiện tại dùng số đang có (qhNay). Tuần chưa có bản chụp: qh = null.
export function xuHuongTuan(rows, tuans, quaHanChup = new Map(), qhNay = null) {
  const ids = idsCua(rows);
  return tuans.map((w, i) => {
    const s = quaHanChup.get(w.den);
    return { ...w, giao: rows.filter((r) => trongKhoang(ngayGiao(r), w)).length, xong: rows.filter((r) => laXong(r) && trongKhoang(ngayXong(r), w)).length,
      qh: i === tuans.length - 1 ? qhNay : s ? [...s].filter((id) => ids.has(id)).length : null };
  });
}

// Tầng 2 — ma trận đơn vị (Trưởng phòng: cán bộ) theo trạng thái: mỗi việc đang mở vào đúng một cột mức; hoàn thành và đúng hạn tính trong kỳ. Nhóm có
// việc quá hạn từ N ngày trước, rồi quá hạn, sắp đến hạn, nhiều việc trước. tong: dòng Tổng cộng trên cả tập.
function demMaTran(ma, ten, rows, k) {
  const mo = rows.filter(laMo); const dem = (muc) => mo.filter((r) => muc.includes(mucMo(r))).length;
  const xong = rows.filter((r) => xongTrongKy(r, k)); const dg = xong.filter(coDanhGia); const dung = dg.filter((r) => r.ket_qua === 'DUNG_HAN').length;
  return { ma, ten, ddb: dem(['ddb']), do: dem(['do']), vang: dem(['vang']), th: dem(['trongHan', 'nt']), ch: dem(['khac']), mo: mo.length, xong: xong.length,
    dung, xet: dg.length, tyLe: tyLeDungHan(dg.length, dung, xong.filter((r) => r.han_xu_ly).length) };
}
export function maTran(rows, k, khoa) {
  const m = new Map();
  rows.forEach((r) => { const [ma, ten] = khoa(r); if (!m.has(ma)) m.set(ma, { ten, rows: [] }); m.get(ma).rows.push(r); });
  const dong = [...m.entries()].map(([ma, g]) => demMaTran(ma, g.ten, g.rows, k)).filter((d) => d.mo + d.xong > 0)
    .sort((a, b) => b.ddb - a.ddb || b.do - a.do || b.vang - a.vang || (b.mo + b.xong) - (a.mo + a.xong) || a.ten.localeCompare(b.ten, 'vi'));
  return { dong, tong: demMaTran('', 'Tổng cộng', rows, k) };
}
