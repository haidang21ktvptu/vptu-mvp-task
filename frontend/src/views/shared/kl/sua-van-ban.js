// Hộp "Sửa văn bản giao" (v3.29, 0126 — chủ dự án quyết 22/10/2026, CAU-HOI O-6): chỉ tài khoản quản trị (toàn quyền). Mở từ ngăn chi tiết của một
// việc hoặc cuối bảng con của văn bản ở "Theo văn bản". Sửa loại, số hội nghị, số / ký hiệu, ngày ban hành, ngày nhận, trích yếu; lý do bắt buộc. Hàm
// van_ban_sua là chốt: Kết luận BTV cần số hội nghị; đổi sang Kết luận / Thông báo thì mọi việc phải có ngành, lĩnh vực; không trùng văn bản; ngày ban
// hành không sau hạn / ngày nhận / ngày hoàn thành / ngày minh chứng của việc. Việc "theo ngày ký ban hành" tính lại hạn; ngày giao chép từ văn bản
// đổi theo; mỗi việc của văn bản ghi một dòng lịch sử, nhật ký hệ thống ghi bản cũ / mới.
import { $, show, setText, escapeHtml } from '../../../lib/dom.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { LOAI_VB } from '../../../lib/kl/nhap/chuan-hoa.js';
import { suaVanBan, docVanBan } from '../../../lib/kl/quyen-them-db.js';
import { timKlRow } from './danh-sach.js';
import { dh } from '../dieu-hanh/du-lieu.js';

let sauHanhDong = async () => {};
let cu = null; let tuViec = null;   // văn bản đang sửa (bản đọc lúc mở); việc mở hộp (null = mở từ Theo văn bản)
const dongViec = (id) => timKlRow(id) || dh.rows.find((x) => x.id === id);
const O_VB = [['loai', 'svbLoai', 'loại'], ['so_hoi_nghi', 'svbSoHn', 'số hội nghị'], ['so_ket_luan', 'svbSo', 'số / ký hiệu'], ['ngay_ban_hanh', 'svbBanHanh', 'ngày ban hành'],
  ['ngay_nhan', 'svbNhan', 'ngày nhận'], ['trich_yeu', 'svbTrichYeu', 'trích yếu']];

const template = `
<div id="svbModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="svbTieuDe">
  <form class="modal modal-rong" data-submit="luuSuaVanBan" novalidate>
    <h2 id="svbTieuDe" class="modal-tieu-de">Sửa văn bản giao</h2>
    <p class="chu-phu mt-1 mb-4">Thay đổi áp cho mọi nhiệm vụ giao từ văn bản này: việc "theo ngày ký ban hành" tính lại hạn, ngày giao chép từ văn bản đổi theo
      ngày nhận mới; mỗi việc ghi một dòng lịch sử kèm lý do.</p>
    <div class="cot-2">
      <div><label for="svbLoai" class="nhan">Loại văn bản</label><select id="svbLoai" class="o-nhap">${LOAI_VB.map(([ma, ten]) => `<option value="${ma}">${escapeHtml(ten)}</option>`).join('')}</select></div>
      <div id="svbSoHnWrap"><label for="svbSoHn" class="nhan">Số hội nghị <span class="chu-phu">bắt buộc với Kết luận BTV</span></label><input type="number" id="svbSoHn" class="o-nhap" min="1" step="1"></div>
    </div>
    <div class="cot-2 mt-3">
      <div><label for="svbSo" class="nhan">Số / ký hiệu</label><input type="text" id="svbSo" class="o-nhap" maxlength="200" autocomplete="off"></div>
      <div><label for="svbBanHanh" class="nhan">Ngày ban hành</label><input type="date" id="svbBanHanh" class="o-nhap"></div>
    </div>
    <div class="cot-2 mt-3">
      <div><label for="svbNhan" class="nhan">Ngày nhận <span class="chu-phu">để trống = ngày ban hành</span></label><input type="date" id="svbNhan" class="o-nhap"></div>
      <div><label for="svbTrichYeu" class="nhan">Trích yếu</label><input type="text" id="svbTrichYeu" class="o-nhap" maxlength="1000"></div>
    </div>
    <p id="svbDoi" class="chu-phu mt-2" aria-live="polite"></p>
    <div class="mt-3"><label for="svbLyDo" class="nhan">Lý do <span class="chu-phu">bắt buộc, tối đa 500 ký tự</span></label>
      <input type="text" id="svbLyDo" class="o-nhap" maxlength="500" placeholder="Ví dụ: nhập sai số hiệu khi giao việc"></div>
    <div class="modal-chan"><button type="button" class="nut" data-action="dongSuaVanBan">Huỷ</button><button type="submit" id="svbLuu" class="nut chinh">Lưu thay đổi</button></div>
  </form>
</div>`;

// Ô đổi so với bản đang có ('' → null); so_hoi_nghi so theo số.
function thayDoi() {
  const thay = {};
  O_VB.forEach(([cot, id]) => {
    const moi = $(id).value.trim(); const dang = cu?.[cot] == null ? '' : String(cu[cot]);
    if (moi !== dang) thay[cot] = moi === '' ? null : cot === 'so_hoi_nghi' ? Number(moi) : moi;
  });
  return thay;
}
function capNhat() {
  show('svbSoHnWrap', $('svbLoai').value === 'KL_BTV' || Boolean($('svbSoHn').value));
  const ten = Object.keys(thayDoi()).map((c) => O_VB.find(([k]) => k === c)[2]);
  setText('svbDoi', ten.length ? `Sẽ sửa: ${ten.join(', ')}.` : 'Chưa đổi ô nào.');
}

async function moSuaVanBan({ id, vb }) {
  const r = id ? dongViec(id) : null; const vbId = vb || r?.van_ban_id;
  if (!vbId) return;
  try { cu = await docVanBan(vbId); } catch (e) { notifyError('Không đọc được văn bản: ' + loiDeHieu(e)); return; }
  tuViec = r?.id || null;
  setText('svbTieuDe', `Sửa văn bản giao · ${cu.so_ket_luan || ''}`);
  O_VB.forEach(([cot, oid]) => { $(oid).value = cu[cot] == null ? '' : String(cu[cot]); });
  $('svbLyDo').value = ''; $('svbLuu').disabled = false;
  capNhat();
  show('svbModal', true);
  $('svbSo').focus();
}
const dongSuaVanBan = () => show('svbModal', false);

async function luuSuaVanBan() {
  const thay = thayDoi(); const lyDo = $('svbLyDo').value.trim();
  if (!cu) return;
  if (!Object.keys(thay).length) { notifyError('Chưa đổi ô nào.'); return; }
  if ('so_ket_luan' in thay && !thay.so_ket_luan) { notifyError('Văn bản phải có số / ký hiệu.'); return; }
  if ('ngay_ban_hanh' in thay && !thay.ngay_ban_hanh) { notifyError('Văn bản phải có ngày ban hành.'); return; }
  if (!lyDo) { notifyError('Ghi lý do sửa (bắt buộc).'); $('svbLyDo').focus(); return; }
  $('svbLuu').disabled = true;
  try {
    await suaVanBan(cu.id, thay, lyDo);
    notifySuccess(`Đã sửa văn bản ${thay.so_ket_luan || cu.so_ket_luan}. Lịch sử của các nhiệm vụ giao từ văn bản đã ghi lại thay đổi.`);
    dongSuaVanBan();
    document.dispatchEvent(new CustomEvent('van-ban-da-sua', { detail: cu.id }));   // Theo văn bản nạp lại (theo-van-ban/index.js)
    await sauHanhDong(tuViec);
  } catch (e) { notifyError(loiDeHieu(e)); $('svbLuu').disabled = false; }
}

export function mountSuaVanBan(registerActions, napLai) {
  sauHanhDong = napLai;
  $('modalRoot').insertAdjacentHTML('beforeend', template);
  ['input', 'change'].forEach((ev) => $('svbModal').addEventListener(ev, capNhat));
  registerActions({ moSuaVanBan, dongSuaVanBan, luuSuaVanBan });
}
