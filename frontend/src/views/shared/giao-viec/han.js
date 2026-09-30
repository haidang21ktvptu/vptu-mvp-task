// Ô "Hạn nộp minh chứng" trên biểu mẫu Giao việc (PR-2b, thiết kế A12; quyết định 30/9 cho việc có hạn hoàn thành đã qua). Khung ngày lấy từ DB
// (kl_khung_han_nop — CÙNG hàm trigger bd_nhiem_vu_han_nop_mc dùng để chặn), không tính ngày làm việc ở client:
//   hạn hoàn thành còn: [hôm nay, H]; từ sau "ngày làm việc liền trước H" phải ghi lý do việc gấp (dòng gợi ý "muộn nhất …");
//   hạn hoàn thành đã qua: [hôm nay, ngày làm việc thứ 2], gợi ý = mốc cuối, không cần lý do (việc vẫn tính Quá hạn).
// Không tự điền: người giao chọn ngày hoặc bấm "Dùng ngày gợi ý". Mọi vai có màn Giao việc (A0 rút gọn, A1, A2, quan_tri_kl) đều bắt buộc.
import { $, show, setText } from '../../../lib/dom.js';
import { khungHanNop } from '../../../lib/kl/han-nop.js';
import { formatNgay } from '../../../lib/kl/ngay.js';

let khung = null; let luot = 0; let hen = null; let khoaCu = ''; let dangHoi = false;   // dangHoi: đang chờ khung từ DB

export function datLaiHanNop() {
  khung = null; khoaCu = ''; luot++; dangHoi = false;
  $('klThHanNop').value = ''; $('klThLyDoSat').value = '';
  $('klThHanNop').removeAttribute('min'); $('klThHanNop').removeAttribute('max');
  setText('klThHanNopGoiY', 'chọn hạn hoàn thành trước'); show('klThHanNopDung', false); show('klThLyDoSatWrap', false);
}

// Gọi mỗi lần hạn hoàn thành / ngày ban hành / loại hạn đổi; chờ 250 ms rồi hỏi DB (lượt cũ về muộn bị bỏ). sau(): vẽ lại tóm tắt.
export function napKhungHanNop({ han, ngayBH, loai }, sau) {
  const khoa = `${han}|${ngayBH}|${loai}`;
  if (khoa === khoaCu) return;
  khoaCu = khoa; clearTimeout(hen);
  const lan = ++luot;
  if (!han && loai !== 'KY_BAN_HANH') { khung = null; dangHoi = false; capNhatGoiY(); sau(); return; }
  dangHoi = true;
  hen = setTimeout(async () => {
    try {
      const k = await khungHanNop(han, ngayBH, loai);
      if (lan !== luot) return;
      khung = k; dangHoi = false; capNhatGoiY(); sau();
    } catch (e) { if (lan === luot) { khung = null; dangHoi = false; setText('klThHanNopGoiY', e.message); sau(); } }
  }, 250);
}

function capNhatGoiY() {
  const o = $('klThHanNop');
  if (!khung) { o.removeAttribute('min'); o.removeAttribute('max'); setText('klThHanNopGoiY', 'chọn hạn hoàn thành trước'); show('klThHanNopDung', false); capNhatLyDo(); return; }
  o.min = khung.tu; o.max = khung.den;
  setText('klThHanNopGoiY', khung.qua_han
    ? `hạn hoàn thành đã qua: hạn nộp từ ${formatNgay(khung.tu)} đến ${formatNgay(khung.den)} (tối đa 2 ngày làm việc), việc vẫn tính Quá hạn`
    : khung.khong_ly_do_den ? `muộn nhất ${formatNgay(khung.khong_ly_do_den)} (trước hạn hoàn thành 1 ngày làm việc); sát hơn phải ghi lý do việc gấp`
      : `hạn hoàn thành còn dưới 1 ngày làm việc: chọn ${formatNgay(khung.tu)}–${formatNgay(khung.den)} và ghi lý do việc gấp`);
  setText('klThHanNopDung', `Dùng ${formatNgay(khung.goi_y)}`); show('klThHanNopDung', o.value !== khung.goi_y);
  capNhatLyDo();
}

export function dungNgayGoiY() { if (khung) { $('klThHanNop').value = khung.goi_y; capNhatGoiY(); } }
const canLyDo = () => Boolean(khung && $('klThHanNop').value) && (!khung.khong_ly_do_den || $('klThHanNop').value > khung.khong_ly_do_den);
const ngoaiKhung = () => Boolean(khung && $('klThHanNop').value) && ($('klThHanNop').value < khung.tu || $('klThHanNop').value > khung.den);
export function capNhatLyDo() {
  show('klThLyDoSatWrap', canLyDo());
  if (khung) show('klThHanNopDung', $('klThHanNop').value !== khung.goi_y);
}

// Mục "Còn thiếu" (theo thứ tự) và thông báo lỗi khi bấm Giao — cùng quy tắc với trigger; DB vẫn là chốt.
export function thieuHanNop() {
  if (!khung) return dangHoi ? ['hạn nộp minh chứng'] : [];
  return [[!$('klThHanNop').value, 'hạn nộp minh chứng'],
    [ngoaiKhung(), `hạn nộp minh chứng trong ${formatNgay(khung.tu)}–${formatNgay(khung.den)}`],
    [canLyDo() && !$('klThLyDoSat').value.trim(), 'lý do việc gấp']].filter(([t]) => t).map(([, n]) => n);
}
export function loiHanNop() {
  const t = thieuHanNop();
  if (!t.length) return null;
  if (t[0] === 'lý do việc gấp') return `Hạn nộp minh chứng sát hạn hoàn thành (muộn nhất ${formatNgay(khung.khong_ly_do_den || khung.tu)}) — việc gấp thì ghi lý do.`;
  return `Chọn hạn nộp minh chứng (${$('klThHanNopGoiY').textContent}).`;
}
export const docHanNop = () => ({ han_nop_minh_chung: $('klThHanNop').value || null, ly_do_han_nop_sat: canLyDo() ? $('klThLyDoSat').value.trim() || null : null });
export const tomTatHanNop = () => ($('klThHanNop').value ? `, nộp minh chứng ${formatNgay($('klThHanNop').value)}` : '');
