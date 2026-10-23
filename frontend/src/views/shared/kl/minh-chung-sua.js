// Sửa / gỡ minh chứng đã nộp (v3.29, 0126 — chủ dự án quyết 22/10/2026, CAU-HOI O-6): chỉ tài khoản quản trị (toàn quyền). Nút "Sửa" / "Gỡ" cạnh
// từng minh chứng trong ngăn chi tiết. Sửa: số hiệu, ngày văn bản, cấp nhận, trích yếu, mô tả kết quả (minh chứng chữ cũ: nội dung); sửa ngày văn
// bản của minh chứng đã làm việc hoàn thành → ngày hoàn thành theo. Gỡ: lý do bắt buộc; tệp đính kèm giữ trong kho; gỡ minh chứng hợp lệ cuối cùng
// thì việc mở lại (như "Trả lại"). Hàm sua_minh_chung / go_minh_chung là chốt; bản cũ chụp vào minh_chung_lich_su; Diễn biến + tin báo chủ trì.
import { $, show, setText, escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { danhMucKl } from '../../../lib/kl/du-lieu.js';
import { loadMinhChung } from '../../../lib/kl/minh-chung.js';
import { suaMinhChung, goMinhChung } from '../../../lib/kl/quyen-them-db.js';
import { duocSuaMinhChung } from '../../../lib/kl/quyen-them.js';

let sauHanhDong = async () => {};
let cu = null;   // minh chứng đang sửa (đọc lại lúc mở hộp)
const O_MC = [['so_hieu', 'smcSoHieu', 'số hiệu'], ['ngay_van_ban', 'smcNgay', 'ngày văn bản'], ['cap_nhan', 'smcCap', 'cấp nhận'], ['trich_yeu', 'smcTrichYeu', 'trích yếu'],
  ['mo_ta_ket_qua', 'smcMoTa', 'mô tả kết quả'], ['noi_dung_chu', 'smcNoiDung', 'nội dung']];

// Nút cạnh minh chứng (trong .mc-nut) và ô lý do gỡ (dưới minh chứng).
export const nutSuaMcHtml = (r, m) => (duocSuaMinhChung(state.user)
  ? `<button type="button" class="nut nho" data-action="moSuaMinhChung" data-id="${m.id}" data-nv="${r.id}">Sửa</button><button type="button" class="nut nho" data-action="moO" data-o="mcGo-${m.id}">Gỡ</button>` : '');
export const oGoMcHtml = (r, m) => (duocSuaMinhChung(state.user) ? `<form class="o" id="mcGo-${m.id}" data-submit="goMinhChung" data-id="${m.id}" data-nv="${r.id}">
    <small>Gỡ minh chứng ${escapeHtml(m.so_hieu || '')}: bản cũ được lưu lại, tệp đính kèm giữ trong kho; gỡ minh chứng hợp lệ cuối cùng thì nhiệm vụ mở lại.</small>
    <input name="ly_do" required maxlength="500" placeholder="Lý do gỡ (bắt buộc)" aria-label="Lý do gỡ minh chứng">
    <button type="submit" class="nut lam">Gỡ minh chứng</button><button type="button" class="nut" data-action="dongO" data-o="mcGo-${m.id}">Huỷ</button></form>` : '');

const template = `
<div id="smcModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="smcTieuDe">
  <form class="modal" data-submit="luuSuaMinhChung" novalidate>
    <h2 id="smcTieuDe" class="modal-tieu-de">Sửa minh chứng</h2>
    <p class="chu-phu mt-1 mb-4">Bản trước khi sửa được lưu lại. Sửa ngày văn bản của minh chứng đã làm nhiệm vụ hoàn thành thì ngày hoàn thành đổi theo.</p>
    <div id="smcSoWrap">
      <label for="smcSoHieu" class="nhan">Số hiệu văn bản</label><input type="text" id="smcSoHieu" class="o-nhap" autocomplete="off">
      <div class="cot-2 mt-3">
        <div><label for="smcNgay" class="nhan">Ngày văn bản</label><input type="date" id="smcNgay" class="o-nhap"></div>
        <div><label for="smcCap" class="nhan">Cấp nhận sản phẩm</label><select id="smcCap" class="o-nhap"></select></div>
      </div>
      <div class="mt-3"><label for="smcTrichYeu" class="nhan">Trích yếu văn bản</label><input type="text" id="smcTrichYeu" class="o-nhap" maxlength="300"></div>
      <div class="mt-3"><label for="smcMoTa" class="nhan">Mô tả kết quả <span class="chu-phu">tối đa 600 ký tự</span></label><textarea id="smcMoTa" class="o-nhap" rows="3" maxlength="600"></textarea></div>
    </div>
    <div id="smcChuWrap" class="mt-3"><label for="smcNoiDung" class="nhan">Nội dung (minh chứng dạng chữ)</label><textarea id="smcNoiDung" class="o-nhap" rows="3"></textarea></div>
    <p id="smcDoi" class="chu-phu mt-2" aria-live="polite"></p>
    <div class="mt-3"><label for="smcLyDo" class="nhan">Lý do <span class="chu-phu">bắt buộc, tối đa 500 ký tự</span></label>
      <input type="text" id="smcLyDo" class="o-nhap" maxlength="500" placeholder="Ví dụ: ghi nhầm ngày văn bản"></div>
    <div class="modal-chan"><button type="button" class="nut" data-action="dongSuaMinhChung">Huỷ</button><button type="submit" id="smcLuu" class="nut chinh">Lưu thay đổi</button></div>
  </form>
</div>`;

function thayDoi() {
  const thay = {};
  O_MC.forEach(([cot, id]) => { const moi = $(id).value.trim(); if (moi !== String(cu?.[cot] ?? '')) thay[cot] = moi || null; });
  if (cu?.loai !== 'chu_cu') delete thay.noi_dung_chu;
  return thay;
}
const capNhat = () => { const ten = Object.keys(thayDoi()).map((c) => O_MC.find(([k]) => k === c)[2]); setText('smcDoi', ten.length ? `Sẽ sửa: ${ten.join(', ')}.` : 'Chưa đổi ô nào.'); };

async function moSuaMinhChung({ id, nv }) {
  try { cu = (await loadMinhChung(nv)).find((m) => m.id === id) || null; } catch (e) { notifyError(loiDeHieu(e)); return; }
  if (!cu) { notifyError('Không tìm thấy minh chứng (có thể đã được gỡ).'); return; }
  setText('smcTieuDe', `Sửa minh chứng ${cu.so_hieu || ''}`.trim());
  $('smcCap').innerHTML = '<option value="">— Chọn cấp nhận —</option>' + (danhMucKl().cap || []).map((c) => `<option value="${escapeHtml(c.ma)}">${escapeHtml(c.ten)}</option>`).join('');
  O_MC.forEach(([cot, oid]) => { $(oid).value = cu[cot] ?? ''; });
  show('smcChuWrap', cu.loai === 'chu_cu');
  $('smcLyDo').value = ''; $('smcLuu').disabled = false;
  capNhat();
  show('smcModal', true);
  $('smcSoHieu').focus();
}
const dongSuaMinhChung = () => show('smcModal', false);

async function luuSuaMinhChung() {
  const thay = thayDoi(); const lyDo = $('smcLyDo').value.trim();
  if (!cu) return;
  if (!Object.keys(thay).length) { notifyError('Chưa đổi ô nào.'); return; }
  if (!lyDo) { notifyError('Ghi lý do sửa (bắt buộc).'); $('smcLyDo').focus(); return; }
  $('smcLuu').disabled = true;
  try {
    await suaMinhChung(cu.id, thay, lyDo);
    notifySuccess('Đã sửa minh chứng. Bản cũ được lưu lại; chủ trì theo dõi được báo.');
    dongSuaMinhChung();
    await sauHanhDong(cu.nhiem_vu_id);
  } catch (e) { notifyError(loiDeHieu(e)); $('smcLuu').disabled = false; }
}

async function goMinhChungAction({ id, nv }, form) {
  const lyDo = String(new FormData(form).get('ly_do') || '').trim();
  const nut = form.querySelector('button[type="submit"]');
  if (!lyDo) { notifyError('Ghi lý do gỡ (bắt buộc).'); return; }
  if (nut) nut.disabled = true;   // bấm hai lần: lần sau báo "không có minh chứng" gây hiểu nhầm
  try {
    const kq = await goMinhChung(id, lyDo);
    notifySuccess(kq?.mo_lai ? 'Đã gỡ minh chứng — không còn minh chứng hợp lệ nên nhiệm vụ mở lại.' : 'Đã gỡ minh chứng. Bản cũ được lưu lại.');
    await sauHanhDong(nv);
  } catch (e) { notifyError(loiDeHieu(e)); if (nut) nut.disabled = false; }
}

export function mountMinhChungSua(registerActions, napLai) {
  sauHanhDong = napLai;
  $('modalRoot').insertAdjacentHTML('beforeend', template);
  ['input', 'change'].forEach((ev) => $('smcModal').addEventListener(ev, capNhat));
  registerActions({ moSuaMinhChung, dongSuaMinhChung, luuSuaMinhChung, goMinhChung: goMinhChungAction });
}
