// Phân hệ Nhiệm vụ quý BTV: hộp hỏi lý do / nội dung một ô (DESIGN mục 15 "Hộp sửa có lý do": tiêu đề, dòng mô tả chữ phụ, ô lý do bắt buộc ngay trên chân hộp,
// nút chính bên phải). Trả Promise<string | null> (Huỷ / Esc = null). Không dùng alert / prompt của trình duyệt.
import { $, show, escapeHtml } from '../../lib/dom.js';

let traVe = null;
let coO = true;
function dung(gt) { show('nqHoi', false); const f = traVe; traVe = null; if (f) f(gt); }
function gan() {
  if ($('nqHoi')) return;
  document.body.insertAdjacentHTML('beforeend', '<div id="nqHoi" class="nq-hoi hidden" role="dialog" aria-modal="true" aria-labelledby="nqHoiTieuDe">'
    + '<form class="nq-hoi-hop" id="nqHoiForm"><h2 id="nqHoiTieuDe"></h2><p id="nqHoiMoTa" class="chu-phu"></p><label for="nqHoiO" id="nqHoiNhan">Lý do</label>'
    + '<textarea id="nqHoiO" class="o-nhap" rows="3" maxlength="500" required></textarea><div class="hanh-dong"><button type="button" class="nut" id="nqHoiHuy">Huỷ</button>'
    + '<button type="submit" class="nut chinh" id="nqHoiDongY">Xác nhận</button></div></form></div>');
  $('nqHoiForm').addEventListener('submit', (ev) => { ev.preventDefault(); ev.stopPropagation(); if (!coO) { dung('dong-y'); return; } const v = $('nqHoiO').value.trim(); if (v) dung(v); else $('nqHoiO').focus(); });
  $('nqHoiHuy').addEventListener('click', () => dung(null));
  $('nqHoi').addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); dung(null); } });
}
// khongO: chỉ hỏi xác nhận (không có ô nhập) — trả 'dong-y' hoặc null.
export function hoiLyDo({ tieuDe, moTa = '', nhan = 'Lý do', nutXacNhan = 'Xác nhận', toiDa = 500, khongO = false } = {}) {
  gan();
  if (traVe) dung(null);
  coO = !khongO;
  show('nqHoiNhan', coO); show('nqHoiO', coO); $('nqHoiO').required = coO;
  $('nqHoiTieuDe').textContent = tieuDe;
  $('nqHoiMoTa').innerHTML = escapeHtml(moTa);
  $('nqHoiNhan').textContent = nhan;
  $('nqHoiO').value = ''; $('nqHoiO').maxLength = toiDa;
  $('nqHoiDongY').textContent = nutXacNhan;
  show('nqHoi', true);
  (coO ? $('nqHoiO') : $('nqHoiDongY')).focus();
  return new Promise((ok) => { traVe = ok; });
}
