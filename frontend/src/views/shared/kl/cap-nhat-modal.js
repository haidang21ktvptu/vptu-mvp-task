// Modal cập nhật nhanh (thiết kế 3.4, 6.8): kiểm tra ở form chỉ để báo sớm bằng tiếng Việt; chốt thật là trigger
// 0015/0021 và policy 0016 — lỗi DB hiện nguyên văn qua toast. Mục tiêu: một lần cập nhật < 30 giây.
import { $, show, setText } from '../../../lib/dom.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { danhMucKl, capNhatNhiemVu, homNayTheoDb } from '../../../lib/kl/du-lieu.js';
import { homNayVN, formatNgay, ghiChuHan, ngayTrongMinhChung } from '../../../lib/kl/ngay.js';
import { klCapNhatTemplate } from './cap-nhat-template.js';
import { timKlRow } from './danh-sach.js';

let afterSave = () => {};
let row = null;
let homNay = homNayVN();

const laHT = () => $('klCnTienDo').value === 'HOAN_THANH';
const trong = (s) => !s || !s.trim();

function capNhatHienThi() {
  const coHanCuThe = row.loai_thoi_han_ma === 'CO_HAN_CU_THE';
  show('klCnHoanThanhWrap', laHT());
  show('klCnChuaCoHanWrap', coHanCuThe && !laHT());
  show('klCnLyDoWrap', $('klCnChuaCoHan').checked);
  $('klCnHan').disabled = row.loai_thoi_han_ma === 'KY_BAN_HANH' || $('klCnChuaCoHan').checked;
  const han = $('klCnHan').value;
  setText('klCnHanGhiChu', han && !laHT() ? ghiChuHan(han, homNay) : '');
}

export async function openKlCapNhat({ id }) {
  row = timKlRow(id);
  if (!row) return;
  homNay = (await homNayTheoDb()) || homNayVN();
  $('klCnId').value = row.id;
  setText('klCnTieuDe', `Cập nhật ${row.ma}`);
  setText('klCnMoTa', `${row.noi_dung} — ${row.loai_thoi_han_ten}, ban hành ${formatNgay(row.ngay_ban_hanh)}`);
  $('klCnTienDo').innerHTML = danhMucKl().tienDo.map((t) => `<option value="${t.ma}"${t.ma === row.tien_do_ma ? ' selected' : ''}>${t.ten}</option>`).join('');
  $('klCnHan').value = row.han_xu_ly || '';
  $('klCnHan').min = row.ngay_ban_hanh;
  setText('klCnHanLoai', row.loai_thoi_han_ma === 'KY_BAN_HANH' ? '(tự tính = ngày ban hành + 10, không sửa)' : row.loai_thoi_han_ma === 'CO_HAN_CU_THE' ? '' : '(không bắt buộc với loại này)');
  $('klCnChuaCoHan').checked = row.loai_thoi_han_ma === 'CO_HAN_CU_THE' && !row.han_xu_ly && row.tien_do_ma !== 'HOAN_THANH';
  $('klCnLyDo').value = row.ly_do_chua_co_han || '';
  $('klCnNgayHT').value = row.ngay_hoan_thanh || '';
  $('klCnNgayHT').min = row.ngay_ban_hanh; $('klCnNgayHT').max = homNay;
  $('klCnMinhChung').value = row.minh_chung || '';
  $('klCnVanBan').value = row.van_ban_trien_khai || '';
  $('klCnGhiChu').value = row.ghi_chu || '';
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
    if (trong(p.minh_chung)) return 'Chuyển sang Hoàn thành phải có minh chứng (số hiệu văn bản hoặc đường dẫn).';
    if (!p.ngay_hoan_thanh) return 'Chuyển sang Hoàn thành phải ghi ngày hoàn thành thật (theo văn bản minh chứng).';
    if (p.ngay_hoan_thanh > homNay || p.ngay_hoan_thanh < row.ngay_ban_hanh) return 'Ngày hoàn thành phải từ ngày ban hành tới hôm nay.';
  } else if (row.loai_thoi_han_ma === 'CO_HAN_CU_THE' && !p.han_xu_ly && trong(p.ly_do_chua_co_han)) {
    return 'Loại "Có hạn cụ thể" phải có hạn xử lý, hoặc tích "Chưa xác định được hạn" và ghi lý do.';
  }
  if (p.tien_do_ma === 'HOAN_THANH' && row.tien_do_ma === 'HOAN_THANH' && !trong(row.minh_chung) && trong(p.minh_chung)) return 'Không xoá minh chứng của việc đã Hoàn thành. Muốn sửa, ghi minh chứng mới.';
  return null;
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
    minh_chung: $('klCnMinhChung').value.trim() || null,
    van_ban_trien_khai: $('klCnVanBan').value.trim() || null,
    ghi_chu: $('klCnGhiChu').value.trim() || null,
  };
  if (row.loai_thoi_han_ma !== 'KY_BAN_HANH') p.han_xu_ly = chuaCoHan ? null : $('klCnHan').value || null;
  const loi = kiemTra(p);
  if (loi) { notifyError(loi); return; }
  $('klCnLuu').disabled = true;
  try {
    await capNhatNhiemVu(row.id, p);
    notifySuccess(`Đã cập nhật ${row.ma}.`);
    closeKlCapNhat();
    afterSave();
  } catch (e) {
    notifyError('Không lưu được: ' + e.message);
    $('klCnLuu').disabled = false;
  }
}

export function mountKlCapNhatModal(onSave) {
  afterSave = onSave;
  $('modalRoot').insertAdjacentHTML('beforeend', klCapNhatTemplate);
  $('klCnTienDo').addEventListener('change', capNhatHienThi);
  $('klCnChuaCoHan').addEventListener('change', () => { if ($('klCnChuaCoHan').checked) $('klCnHan').value = ''; capNhatHienThi(); });
  $('klCnHan').addEventListener('input', capNhatHienThi);
  // Dán minh chứng có "ngày d/m/yyyy" → gợi ý ngày hoàn thành nếu ô còn trống (6.8), người dùng sửa được.
  $('klCnMinhChung').addEventListener('input', () => {
    const goiY = ngayTrongMinhChung($('klCnMinhChung').value);
    if (goiY && !$('klCnNgayHT').value && goiY <= homNay) $('klCnNgayHT').value = goiY;
  });
  registerActions({ openKlCapNhat, closeKlCapNhat, luuKlCapNhat });
}
