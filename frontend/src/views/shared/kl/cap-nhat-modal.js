// Modal cập nhật nhanh (thiết kế 3.4, 6.8): kiểm tra ở form chỉ để báo sớm bằng tiếng Việt; chốt thật là trigger
// 0015/0021/0052 và policy — lỗi DB qua loiDeHieu (câu tiếng Việt dễ hiểu). Mục tiêu: một lần cập nhật < 30 giây.
// Q7 (0052): việc ĐÃ có hạn thì Owner / người theo dõi không tự đổi hạn (đổi hạn = đề nghị gia hạn) — ô hạn chỉ hiện khi việc chưa có hạn,
// trừ người quản trị KL (quan_tri_kl) vẫn sửa được.
// Đợt C1 v3.19 (0086): việc theo 1400 đang mở, người mở được nộp minh chứng → mục "Nộp minh chứng nhanh" trong cùng hộp; Lưu = cập nhật
// rồi nop_minh_chung khi đánh dấu "Việc đã hoàn thành — ghi kết quả" (C2; cấp nhận trống = theo việc; trích yếu, mô tả tuỳ chọn). Lỗi → hộp giữ mở.
// Đợt D v3.20 (0089–0090): nộp minh chứng hợp lệ = nhiệm vụ hoàn thành; ô tệp + tự điền (minh-chung-tep.js); người nộp gồm cả người giao việc,
// lãnh đạo trong phạm vi (duocNopMinhChung — chuyên viên nộp thay khi Owner là lãnh đạo).
import { $, show, setText, escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { danhMucKl, capNhatNhiemVu, homNayTheoDb, datThongTinGiao } from '../../../lib/kl/du-lieu.js';
import { duocSuaThongTinGiao, nguonOptionsHtml } from './thong-tin-giao.js';
import { homNayVN, formatNgay, ghiChuHan, ngayTrongMinhChung } from '../../../lib/kl/ngay.js';
import { nopMinhChung, loiMinhChung, duocNopMinhChung } from '../../../lib/kl/minh-chung.js';
import { batBuocTep, taiLenTep, xoaTepChuaGan } from '../../../lib/kl/tep-minh-chung.js';
import { ganSuKienTep, tepDangChon, datLaiTep } from './minh-chung-tep.js';
import { klCapNhatTemplate } from './cap-nhat-template.js';
import { timKlRow } from './danh-sach.js';

let afterSave = () => {};
let row = null;
let homNay = homNayVN();

const laHT = () => $('klCnTienDo').value === 'HOAN_THANH';
const coMcNhanh = () => Boolean(row?.theo_1400) && row.tien_do_ma !== 'HOAN_THANH' && duocNopMinhChung(row);
const khoaHan = () => Boolean(row?.han_xu_ly) && !state.user?.quan_tri_kl;
const trong = (s) => !s || !s.trim();

function capNhatHienThi() {
  const coHanCuThe = row.loai_thoi_han_ma === 'CO_HAN_CU_THE';
  show('klCnHoanThanhWrap', laHT());
  show('klCnChuaCoHanWrap', coHanCuThe && !laHT() && !khoaHan());
  show('klCnLyDoWrap', $('klCnChuaCoHan').checked);
  $('klCnHan').disabled = row.loai_thoi_han_ma === 'KY_BAN_HANH' || $('klCnChuaCoHan').checked;
  const han = $('klCnHan').value;
  setText('klCnHanGhiChu', han && !laHT() ? ghiChuHan(han, homNay) : '');
}

export async function openKlCapNhat({ id, rows }) {
  row = timKlRow(id) || rows?.find((r) => r.id === id);
  if (!row) return;
  homNay = (await homNayTheoDb()) || homNayVN();
  $('klCnId').value = row.id;
  setText('klCnTieuDe', `Cập nhật ${row.ma}`);
  setText('klCnMoTa', `${row.noi_dung} — ${row.loai_thoi_han_ten}, ban hành ${formatNgay(row.ngay_ban_hanh)}`);
  // GĐ16 (MC-3, MC-4): việc theo quy tắc 1400 đóng bằng nút "Đóng nhiệm vụ" sau khi nộp minh chứng có cấu trúc — modal này
  // không có ô chữ tự do và không chọn Hoàn thành (trigger 0028 là chốt); việc cũ giữ quy tắc chữ.
  const theo1400 = Boolean(row.theo_1400) && row.tien_do_ma !== 'HOAN_THANH';
  $('klCnTienDo').innerHTML = danhMucKl().tienDo.filter((t) => !(theo1400 && t.ma === 'HOAN_THANH'))
    .map((t) => `<option value="${t.ma}"${t.ma === row.tien_do_ma ? ' selected' : ''}>${t.ten}</option>`).join('');
  show('klCnMinhChungWrap', !row.theo_1400);
  show('klCnGhiChu1400', theo1400);
  show('klCnMcWrap', coMcNhanh()); $('klCnXong').checked = false; show('klCnMcTruong', false); show('klCnXongGoiY', true);   // C2: mở bằng ô đánh dấu
  ['klCnMcSoHieu', 'klCnMcTrichYeu', 'klCnMcMoTa'].forEach((id) => { $(id).value = ''; });
  $('klCnMcNgay').value = ''; $('klCnMcNgay').min = row.ngay_ban_hanh; $('klCnMcNgay').max = homNay;
  datLaiTep('klCn', batBuocTep());
  $('klCnMcCap').innerHTML = '<option value="">— Theo việc —</option>' + danhMucKl().cap.map((c) => `<option value="${c.ma}"${c.ma === row.cap_nhan_san_pham ? ' selected' : ''}>${escapeHtml(c.ten)}</option>`).join('');
  $('klCnHan').value = row.han_xu_ly || '';
  show('klCnHanWrap', !khoaHan());
  show('klCnHanKhoa', khoaHan());
  setText('klCnHanKhoa', khoaHan() ? `Hạn xử lý: ${formatNgay(row.han_xu_ly)} — đã chốt khi giao. Muốn đổi hạn, đồng chí đề nghị gia hạn với lãnh đạo giao việc.` : '');
  $('klCnHan').min = row.ngay_ban_hanh;
  setText('klCnHanLoai', row.loai_thoi_han_ma === 'KY_BAN_HANH' ? '(tự tính = ngày ban hành + 10, không sửa)' : row.loai_thoi_han_ma === 'CO_HAN_CU_THE' ? '' : '(không bắt buộc với loại này)');
  $('klCnChuaCoHan').checked = row.loai_thoi_han_ma === 'CO_HAN_CU_THE' && !row.han_xu_ly && row.tien_do_ma !== 'HOAN_THANH';
  $('klCnLyDo').value = row.ly_do_chua_co_han || '';
  $('klCnNgayHT').value = row.ngay_hoan_thanh || '';
  $('klCnNgayHT').min = row.ngay_ban_hanh; $('klCnNgayHT').max = homNay;
  $('klCnMinhChung').value = row.minh_chung || '';
  $('klCnVanBan').value = row.van_ban_trien_khai || '';
  $('klCnGhiChu').value = row.ghi_chu || '';
  // PR-3: vướng mắc (Owner / người theo dõi / quan_tri_kl — guard a3 0062 cho cột này); nguồn + đơn vị phối hợp chỉ người giao / quan_tri_kl (hàm 0065).
  $('klCnVuongMac').value = row.vuong_mac || '';
  show('klCnGiaoWrap', duocSuaThongTinGiao(row));
  $('klCnNguon').innerHTML = nguonOptionsHtml(row.nguon_nhiem_vu_ma, row.nguon_nhiem_vu_ma ? null : 'Chưa xác định');
  $('klCnPhoiHop').value = row.don_vi_phoi_hop || '';
  $('klCnLuu').disabled = false;
  capNhatHienThi();
  show('klCapNhatModal', true);
  $('klCnTienDo').focus();
}

export function closeKlCapNhat() {
  show('klCapNhatModal', false);
  row = null;
}

// Kiểm tra phía form (cùng quy tắc với DB, để báo ngay): trả về chuỗi lỗi hoặc null.
function kiemTra(p) {
  if (p.han_xu_ly && p.han_xu_ly < row.ngay_ban_hanh) return `Hạn xử lý không được trước ngày ban hành (${formatNgay(row.ngay_ban_hanh)}). Chọn lại ngày.`;
  if (p.tien_do_ma === 'HOAN_THANH') {
    if (!row.theo_1400 && trong(p.minh_chung)) return 'Chuyển sang Hoàn thành phải có minh chứng (số hiệu văn bản hoặc đường dẫn).';
    if (!p.ngay_hoan_thanh) return 'Chuyển sang Hoàn thành phải ghi ngày hoàn thành thật (theo văn bản minh chứng).';
    if (p.ngay_hoan_thanh > homNay || p.ngay_hoan_thanh < row.ngay_ban_hanh) return 'Ngày hoàn thành phải từ ngày ban hành tới hôm nay.';
  } else if (row.loai_thoi_han_ma === 'CO_HAN_CU_THE' && !khoaHan() && !p.han_xu_ly && trong(p.ly_do_chua_co_han)) {   // Q7: hạn đã chốt thì không gửi, không đòi
    return 'Loại "Có hạn cụ thể" phải có hạn xử lý, hoặc tích "Chưa xác định được hạn" và ghi lý do.';
  }
  if (!row.theo_1400 && p.tien_do_ma === 'HOAN_THANH' && row.tien_do_ma === 'HOAN_THANH' && !trong(row.minh_chung) && trong(p.minh_chung)) return 'Không xoá minh chứng của việc đã Hoàn thành. Muốn sửa, ghi minh chứng mới.';
  return null;
}

// Minh chứng nhanh: null = không nộp (cả số hiệu lẫn ngày trống); chuỗi = lỗi form; object = tham số nop_minh_chung.
function minhChungNhanh() {
  if (!coMcNhanh() || !$('klCnXong').checked) return null;   // C2: chỉ khi đánh dấu "Việc đã hoàn thành — ghi kết quả"
  const p = { nhiem_vu_id: row.id, so_hieu: $('klCnMcSoHieu').value.trim(), ngay_van_ban: $('klCnMcNgay').value, cap_nhan: $('klCnMcCap').value || row.cap_nhan_san_pham,
    trich_yeu: $('klCnMcTrichYeu').value.trim(), mo_ta_ket_qua: $('klCnMcMoTa').value.trim() };
  if (p.ngay_van_ban > homNay) return 'Ngày văn bản minh chứng không được sau hôm nay.';
  return loiMinhChung(p, row.cap_nhan_san_pham, { batBuoc: batBuocTep(), coTep: Boolean(tepDangChon('klCn')) }) || p;
}

async function luuKlCapNhat() {
  if (!row) return;
  // Ô "chưa xác định được hạn" chỉ có nghĩa khi đang hiện (Có hạn cụ thể, chưa Hoàn thành); khi ẩn thì KHÔNG gửi
  // ly_do_chua_co_han — giữ giá trị DB (việc "Cần điền hạn" hoàn thành mà không có hạn vẫn thoả CHECK 0014;
  // có hạn thì trigger 0015 tự xoá lý do).
  const oChuaCoHanHien = !$('klCnChuaCoHan').closest('.hidden');
  const chuaCoHan = oChuaCoHanHien && $('klCnChuaCoHan').checked;
  const p = {
    tien_do_ma: $('klCnTienDo').value,
    ...(oChuaCoHanHien ? { ly_do_chua_co_han: chuaCoHan ? $('klCnLyDo').value.trim() || null : null } : {}),
    ngay_hoan_thanh: laHT() ? $('klCnNgayHT').value || null : null,
    ...(row.theo_1400 ? {} : { minh_chung: $('klCnMinhChung').value.trim() || null }), // việc 1400: minh chứng ở bảng minh_chung, không gửi cột chữ
    van_ban_trien_khai: $('klCnVanBan').value.trim() || null,
    ghi_chu: $('klCnGhiChu').value.trim() || null,
    vuong_mac: $('klCnVuongMac').value.trim() || null,
  };
  if (row.loai_thoi_han_ma !== 'KY_BAN_HANH' && !khoaHan()) p.han_xu_ly = chuaCoHan ? null : $('klCnHan').value || null;   // Q7: hạn đã chốt thì không gửi
  const loi = kiemTra(p); const mc = minhChungNhanh();
  if (loi || typeof mc === 'string') { notifyError(loi || mc); return; }
  $('klCnLuu').disabled = true;
  try {
    await capNhatNhiemVu(row.id, p);
    if (mc) {
      const tep = tepDangChon('klCn'); let path = null;
      try {
        if (tep) { path = await taiLenTep(row.id, tep); Object.assign(mc, { tep_path: path, tep_ten: tep.name }); }
        await nopMinhChung(mc);
      } catch (e) {   // cập nhật đã lưu — giữ hộp mở để sửa minh chứng rồi Lưu lại (cập nhật lưu lại là vô hại)
        await xoaTepChuaGan(path);
        notifyError(`Đã cập nhật ${row.ma} nhưng chưa nộp được minh chứng: ${e.message}`); $('klCnLuu').disabled = false; afterSave(row.id); return;
      }
    }
    const giao = !$('klCnGiaoWrap').classList.contains('hidden') && { nguon: $('klCnNguon').value, phoiHop: $('klCnPhoiHop').value.trim() };
    if (giao && (giao.nguon !== (row.nguon_nhiem_vu_ma || '') || giao.phoiHop !== (row.don_vi_phoi_hop || ''))) {
      try { await datThongTinGiao(row.id, giao.nguon, giao.phoiHop); } catch (e) {   // cập nhật chính đã lưu — báo đúng phần chưa lưu, không để người dùng gửi lại cả hộp
        notifyError(`Đã cập nhật ${row.ma} nhưng chưa lưu được nguồn / đơn vị phối hợp: ${loiDeHieu(e)}`); closeKlCapNhat(); afterSave(row.id); return;
      }
    }
    notifySuccess(mc ? `Đã cập nhật ${row.ma} và nộp minh chứng số ${mc.so_hieu} — nhiệm vụ hoàn thành.` : `Đã cập nhật ${row.ma}.`);
    closeKlCapNhat();
    afterSave(row.id);
  } catch (e) {
    notifyError('Không lưu được: ' + loiDeHieu(e));
    $('klCnLuu').disabled = false;
  }
}

export function mountKlCapNhatModal(onSave) {
  afterSave = onSave;
  $('modalRoot').insertAdjacentHTML('beforeend', klCapNhatTemplate);
  $('klCnTienDo').addEventListener('change', capNhatHienThi);
  ganSuKienTep('klCn', { soHieu: 'klCnMcSoHieu', ngay: 'klCnMcNgay', trichYeu: 'klCnMcTrichYeu' });
  $('klCnXong').addEventListener('change', () => { const x = $('klCnXong').checked; show('klCnMcTruong', x); show('klCnXongGoiY', !x); if (x) $('klCnMcSoHieu').focus(); });
  $('klCnChuaCoHan').addEventListener('change', () => { if ($('klCnChuaCoHan').checked) $('klCnHan').value = ''; capNhatHienThi(); });
  $('klCnHan').addEventListener('input', capNhatHienThi);
  // Dán minh chứng có "ngày d/m/yyyy" → gợi ý ngày hoàn thành nếu ô còn trống (6.8), người dùng sửa được.
  $('klCnMinhChung').addEventListener('input', () => {
    const goiY = ngayTrongMinhChung($('klCnMinhChung').value);
    if (goiY && !$('klCnNgayHT').value && goiY <= homNay) $('klCnNgayHT').value = goiY;
  });
  registerActions({ openKlCapNhat, closeKlCapNhat, luuKlCapNhat });
}
