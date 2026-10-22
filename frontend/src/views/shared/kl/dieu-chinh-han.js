// Hộp "Điều chỉnh hạn" (v3.29, 0123 — chủ dự án quyết 22/10/2026, CAU-HOI O-4): chủ trì theo dõi (việc chưa quá hạn), thư ký Thường trực, tài
// khoản quản trị. Hạn hiện tại + số lần đã gia hạn, hạn mới (không trước ngày ban hành), lý do bắt buộc; lùi hạn = gia hạn lần n, rút ngắn không
// tính. Hàm dieu_chinh_han là chốt (quyền, quá hạn, ngày, việc cha – con); người giao việc, Trưởng phòng, lãnh đạo Văn phòng phụ trách được báo.
import { $, show, setText } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { formatNgay, homNayVN } from '../../../lib/kl/ngay.js';
import { laToanQuyen } from '../../../lib/toan-quyen.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { dieuChinhHan } from '../../../lib/kl/quyen-them-db.js';
import { ghiChuHanMoi } from '../../../lib/kl/quyen-them.js';
import { timKlRow } from './danh-sach.js';
import { dh } from '../dieu-hanh/du-lieu.js';

let sauHanhDong = async () => {};
let homNay = homNayVN();
const dongViec = (id) => timKlRow(id) || dh.rows.find((x) => x.id === id);
const choQuaKhu = () => laToanQuyen(state.user);   // tài khoản toàn quyền đính chính được hạn đã qua; người khác: từ hôm nay (dieu_chinh_han)

const template = `
<div id="dchModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="dchTieuDe">
  <form class="modal" data-submit="luuDieuChinhHan" novalidate>
    <h2 id="dchTieuDe" class="modal-tieu-de">Điều chỉnh hạn</h2>
    <p id="dchMoTa" class="chu-phu mt-1 mb-4"></p>
    <input type="hidden" id="dchId">
    <div class="cot-2">
      <div><p class="nhan">Hạn hiện tại</p><p id="dchCu" class="st-cu"></p></div>
      <div><label for="dchHan" class="nhan">Hạn mới</label><input type="date" id="dchHan" class="o-nhap"></div>
    </div>
    <p id="dchGhiChu" class="chu-phu mt-2" aria-live="polite"></p>
    <div class="mt-3"><label for="dchLyDo" class="nhan">Lý do <span class="chu-phu">bắt buộc, tối đa 500 ký tự</span></label>
      <input type="text" id="dchLyDo" class="o-nhap" maxlength="500" placeholder="Ví dụ: chờ số liệu quý IV của các đảng ủy xã"></div>
    <p class="chu-phu mt-3">Lịch sử ghi lại hạn cũ, hạn mới và lý do. Người giao việc, Trưởng phòng và lãnh đạo Văn phòng phụ trách được báo.</p>
    <div class="modal-chan"><button type="button" class="nut" data-action="dongDieuChinhHan">Huỷ</button><button type="submit" id="dchLuu" class="nut chinh">Lưu hạn mới</button></div>
  </form>
</div>`;

const capNhatGhiChu = () => { const r = dongViec($('dchId').value); setText('dchGhiChu', r ? ghiChuHanMoi(r, $('dchHan').value, { homNay, choQuaKhu: choQuaKhu() }) : ''); };

function moDieuChinhHan({ id }) {
  const r = dongViec(id);
  if (!r) return;
  $('dchId').value = id;
  setText('dchTieuDe', `Điều chỉnh hạn · ${r.ma}`);
  setText('dchMoTa', r.noi_dung || '');
  setText('dchCu', `${formatNgay(r.han_xu_ly)}${r.so_lan_gia_han ? ` (đã gia hạn ${r.so_lan_gia_han} lần)` : ''}`);
  homNay = homNayVN();
  const banHanh = r.ngay_ban_hanh || '';
  $('dchHan').value = ''; $('dchHan').min = choQuaKhu() || banHanh > homNay ? banHanh : homNay;
  $('dchLyDo').value = ''; $('dchLuu').disabled = false;
  capNhatGhiChu();
  show('dchModal', true);
  $('dchHan').focus();
}
const dongDieuChinhHan = () => show('dchModal', false);

async function luuDieuChinhHan() {
  const id = $('dchId').value; const r = dongViec(id); const han = $('dchHan').value; const lyDo = $('dchLyDo').value.trim();
  if (!han) { notifyError('Chọn hạn mới.'); $('dchHan').focus(); return; }
  if (r && han === r.han_xu_ly) { notifyError('Hạn mới trùng hạn hiện tại.'); return; }
  if (!choQuaKhu() && han < homNay) { notifyError('Hạn mới không được trước hôm nay.'); $('dchHan').focus(); return; }
  if (!lyDo) { notifyError('Ghi lý do điều chỉnh hạn (bắt buộc).'); $('dchLyDo').focus(); return; }
  $('dchLuu').disabled = true;
  try {
    const kq = await dieuChinhHan(id, han, lyDo);
    notifySuccess(`Đã điều chỉnh hạn ${r?.ma || ''} thành ${formatNgay(han)}${kq?.gia_han ? ` (gia hạn lần ${kq.so_lan_gia_han})` : ''}. Người giao việc, lãnh đạo phụ trách được báo.`);
    dongDieuChinhHan();
    await sauHanhDong(id);
  } catch (e) { notifyError(loiDeHieu(e)); $('dchLuu').disabled = false; }
}

export function mountDieuChinhHan(registerActions, napLai) {
  sauHanhDong = napLai;
  $('modalRoot').insertAdjacentHTML('beforeend', template);
  $('dchHan').addEventListener('input', capNhatGhiChu);
  registerActions({ moDieuChinhHan, dongDieuChinhHan, luuDieuChinhHan });
}
