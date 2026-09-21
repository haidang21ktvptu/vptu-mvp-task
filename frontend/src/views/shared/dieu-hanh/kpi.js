// Bốn số-lọc đầu trang (mockup bản 5): mỗi con số là một bộ lọc (aria-pressed), có xu hướng so với tuần trước từ kl_so_lieu_tai
// (chỉ ở những số có lịch sử: quá hạn, hoàn thành); bấm lại để bỏ lọc. Cấu hình theo vai ở a0/a1.
import { escapeHtml } from '../../../lib/dom.js';
import { tongHop } from '../../../lib/kl/tong-hop.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { dh, viecDo, viecTuChoi, ttCho, canToiQuyet, xuHuong, chuXuHuong } from './du-lieu.js';

// Ô có `action` riêng (v8: sắp đến hạn → mở danh sách Nhiệm vụ lọc nhóm) không phải bộ lọc trang, không có aria-pressed.
const o = (k) => `<button type="button" class="${k.lop}" ${k.action ? `data-action="${k.action}" data-loc='${k.loc}'` : `data-action="locKpi" data-loc="${k.loc}" aria-pressed="${String(dh.loc.kpi === k.loc)}"`}>
    <b>${k.so}</b><span>${escapeHtml(k.nhan)}</span>${k.phu ? `<small class="${k.phuLop || ''}">${escapeHtml(k.phu)}</small>` : ''}</button>`;

// Số quá hạn (Đỏ + Đỏ đặc biệt) với xu hướng; số khâu đang nghẽn.
export function kpiQuaHan() {
  const soKhau = new Set(viecDo().map((r) => r.khau)).size; // chỉ khâu của việc quá hạn (bị từ chối chưa quá hạn đếm ở ô riêng)
  const xh = chuXuHuong(xuHuong('muc_canh_bao', ['DO', 'DO_DAC_BIET']).chenh);
  return { lop: 'cam', loc: 'nghen', so: viecDo().length, nhan: `việc quá hạn, nghẽn ở ${soKhau} khâu`, phu: xh.chu, phuLop: xh.lop };
}
// Hoàn thành: tỷ lệ và số tuyệt đối, xu hướng tuần (tăng là tốt).
export function kpiHoanThanh() {
  const t = tongHop(dh.rows);
  const xh = chuXuHuong(xuHuong('nhom_dem', ['HOAN_THANH']).chenh, true);
  return { lop: 'luc', loc: 'tat', so: `${t.tyLeHoanThanh}%`, nhan: `đã hoàn thành, ${t.nhom.HOAN_THANH} trên ${t.tong}`,
    phu: xh.chu ? xh.chu.replace('so với tuần trước', 'việc trong tuần') : '', phuLop: xh.lop };
}
// Chỉ đạo Thường trực chờ phản hồi (A0: mình gửi, Văn phòng chưa trả lời; A1: Thường trực chờ mình).
export function kpiChiDaoTT(nhan) {
  const cho = ttCho();
  const han = cho.map((c) => c.han_phan_hoi).sort()[0];
  const quaHan = cho.some((c) => c.qua_han_phan_hoi);
  return { lop: quaHan ? 'do' : 'vang', loc: 'cho', so: cho.length, nhan, phu: han ? `hạn phản hồi ${quaHan ? 'đã quá — ' : ''}${formatNgay(han)}` : '', phuLop: quaHan ? 'tang' : '' };
}
// Việc cần cấp của tôi quyết (A0: Thường trực / Ban Thường vụ).
export function kpiCanQuyet(nhan) {
  return { lop: 'do', loc: 'quyet', so: viecDo().filter(canToiQuyet).length, nhan, phu: 'cấp cần quyết đã ghi trên việc' };
}
// Việc bị từ chối, chờ giao lại (A0, 0034) — ô riêng, không cộng vào quá hạn.
export function kpiTuChoi() {
  const n = viecTuChoi().length;
  return { lop: 'cam', loc: 'tuchoi', so: n, nhan: 'việc bị từ chối, chờ giao lại', phu: n ? 'đề nghị từ chối đã được cấp duyệt đồng ý' : '' };
}
// Việc sắp đến hạn (nhóm Vàng SAP_DEN_HAN trong phạm vi, từ dòng đã tải) — A1 v8 (mockup 03); bấm mở danh sách Nhiệm vụ lọc nhóm.
export function kpiSapHan() {
  const n = dh.rows.filter((r) => r.nhom_dem === 'SAP_DEN_HAN').length;
  return { lop: 'vang', loc: JSON.stringify({ nhom: 'SAP_DEN_HAN' }), action: 'moKlDanhSach', so: n, nhan: 'việc sắp đến hạn', phu: n ? 'mở danh sách Nhiệm vụ để nhắc' : 'không có việc nào sắp đến hạn' };
}
// Minh chứng chờ xác nhận (A1/A2).
export function kpiMinhChung() {
  return { lop: 'lam', loc: 'mc', so: dh.mcCho.length, nhan: 'minh chứng đã nộp, chờ xác nhận', phu: dh.mcCho.length ? 'xác nhận bằng một bấm ở cuối trang' : '' };
}

export const kpiHtml = (ds) => ds.map(o).join('');

// Nhãn đuôi cho tiêu đề danh sách theo số-lọc đang chọn.
export const NHAN_KPI = { quyet: ' cần Thường trực quyết', nghen: ' đang nghẽn', cho: ' có chỉ đạo Thường trực chờ phản hồi', tt: ' có chỉ đạo Thường trực chờ phản hồi', mc: ' chờ xác nhận minh chứng', tuchoi: ' bị từ chối, chờ giao lại', null: ' đang nghẽn' };
