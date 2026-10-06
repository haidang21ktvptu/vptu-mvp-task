// Hộp "Xuất Excel theo kỳ" (v3.16) ở màn Nhiệm vụ: chọn tuần (theo một ngày) / tháng / quý / năm, mặc định kỳ hiện tại; xem trước bốn số đếm
// (giao, hoàn thành, đến hạn, còn mở cuối kỳ) rồi tải .xlsx (lib/kl/xuat.js xuatTheoKy, nạp động). Phạm vi mặc định = toàn bộ việc RLS trả về
// (getKlRows), tick "chỉ danh sách đang lọc" thì lấy dsDangHien().
import { $, show, setText, escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { homNayVN } from '../../../lib/kl/ngay.js';
import { khoangKyChon, phanLoaiTheoKy } from '../../../lib/kl/ky.js';
import { getKlRows, dsDangHien } from './danh-sach.js';

export const xuatKyTemplate = `
<div id="xkModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="xkTitle">
  <form id="xkForm" class="modal" data-submit="thucHienXuatKy" novalidate>
    <h2 id="xkTitle" class="modal-tieu-de">Xuất Excel theo kỳ</h2>
    <p class="chu-phu" style="margin-top:6px">Tệp gồm: tổng hợp theo phòng / đơn vị; danh sách việc giao trong kỳ, hoàn thành trong kỳ, đến hạn trong kỳ, còn mở cuối kỳ (mỗi loại một sheet).</p>
    <label class="nhan" for="xkKy">Kỳ</label>
    <select id="xkKy" class="o-nhap"><option value="tuan">Tuần</option><option value="thang" selected>Tháng</option><option value="quy">Quý</option><option value="nam">Năm</option></select>
    <div id="xkTuanWrap" class="hidden"><label class="nhan" for="xkNgay">Một ngày bất kỳ trong tuần (thứ Hai – Chủ nhật)</label><input type="date" id="xkNgay" class="o-nhap"></div>
    <div id="xkThangWrap"><label class="nhan" for="xkThang">Tháng</label><select id="xkThang" class="o-nhap">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">Tháng ${i + 1}</option>`).join('')}</select></div>
    <div id="xkQuyWrap" class="hidden"><label class="nhan" for="xkQuy">Quý</label><select id="xkQuy" class="o-nhap"><option value="1">Quý I</option><option value="2">Quý II</option><option value="3">Quý III</option><option value="4">Quý IV</option></select></div>
    <div id="xkNamWrap"><label class="nhan" for="xkNam">Năm</label><input type="number" id="xkNam" class="o-nhap" min="2020" max="2100" step="1"></div>
    <label class="cn-o" style="margin-top:10px"><input type="checkbox" id="xkLoc"><span><b>Chỉ trong danh sách đang lọc</b><small>mặc định lấy toàn bộ việc trong phạm vi của đồng chí, không theo bộ lọc trên màn hình</small></span></label>
    <p id="xkXemTruoc" class="luong-ok" style="margin-top:12px" aria-live="polite"></p>
    <div class="modal-chan"><button type="button" class="nut" data-action="dongXuatKy">Huỷ</button><button type="submit" id="xkXuat" class="nut chinh">Tải tệp Excel</button></div>
  </form>
</div>`;

function luaChon() {
  return { ky: $('xkKy').value, ngay: $('xkNgay').value || homNayVN(), nam: $('xkNam').value, thang: $('xkThang').value, quy: $('xkQuy').value };
}
const rowsChon = () => ($('xkLoc').checked ? dsDangHien() : getKlRows());

function xemTruocXuatKy() {
  const lc = luaChon();
  show('xkTuanWrap', lc.ky === 'tuan'); show('xkThangWrap', lc.ky === 'thang'); show('xkQuyWrap', lc.ky === 'quy'); show('xkNamWrap', lc.ky !== 'tuan');
  if (lc.ky !== 'tuan' && !(Number(lc.nam) >= 2020 && Number(lc.nam) <= 2100)) { setText('xkXemTruoc', 'Nhập năm từ 2020 đến 2100.'); $('xkXuat').disabled = true; return null; }
  const k = khoangKyChon(lc); const pl = phanLoaiTheoKy(rowsChon(), k);
  $('xkXemTruoc').innerHTML = `<b>${escapeHtml(k.ten)}</b> — giao trong kỳ: <b>${pl.giao.length}</b> · hoàn thành: <b>${pl.xong.length}</b> · đến hạn: <b>${pl.denHan.length}</b> · còn mở cuối kỳ: <b>${pl.mo.length}</b> (trên ${rowsChon().length} việc).`;
  $('xkXuat').disabled = false;
  return k;
}

function moXuatKy() {
  const [y, m] = homNayVN().split('-').map(Number);
  $('xkKy').value = 'thang'; $('xkNgay').value = homNayVN(); $('xkThang').value = String(m); $('xkQuy').value = String(Math.ceil(m / 3)); $('xkNam').value = String(y); $('xkLoc').checked = false;
  xemTruocXuatKy();
  show('xkModal', true);
}

async function thucHienXuatKy() {
  const k = xemTruocXuatKy();
  if (!k) return;
  const btn = $('xkXuat'); btn.disabled = true;
  try {
    const { xuatTheoKy } = await import('../../../lib/kl/xuat.js');
    const { ten, so } = xuatTheoKy(rowsChon(), k, { phamVi: $('xkLoc').checked ? 'Danh sách đang lọc trên màn hình' : 'Toàn bộ việc trong phạm vi', nguoi: `${state.user.full_name} (${state.user.username})` });
    notifySuccess(`Đã xuất ${k.ten}: ${so.giao} giao, ${so.xong} hoàn thành, ${so.denHan} đến hạn, ${so.mo} còn mở — tệp ${ten}.`);
    show('xkModal', false);
  } catch (e) { notifyError('Không xuất được Excel: ' + e.message); } finally { btn.disabled = false; }
}

export function mountXuatKy() {
  $('modalRoot').insertAdjacentHTML('beforeend', xuatKyTemplate);
  ['xkKy', 'xkNgay', 'xkThang', 'xkQuy', 'xkNam', 'xkLoc'].forEach((id) => { $(id).addEventListener('change', xemTruocXuatKy); $(id).addEventListener('input', xemTruocXuatKy); });
  registerActions({ moXuatKy, dongXuatKy: () => show('xkModal', false), thucHienXuatKy });
}
