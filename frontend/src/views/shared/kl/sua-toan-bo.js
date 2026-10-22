// Hộp "Sửa toàn bộ thông tin" (v3.29, 0125 — chủ dự án quyết 22/10/2026, CAU-HOI O-6): chỉ tài khoản quản trị (toàn quyền — qt_vptu), mọi việc kể
// cả việc đã hoàn thành. Một hộp nhiều ô (sua-toan-bo-o.js), điền sẵn giá trị đang có; dòng "Sẽ sửa" liệt kê ô đã đổi; lý do bắt buộc. Hàm
// sua_toan_bo_nhiem_vu là chốt (quyền, danh mục, ngành – lĩnh vực, ngày); nhật ký từng ô + một dòng tóm tắt có lý do; chủ trì, người theo dõi, người
// giao việc được báo.
import { $, show, setText } from '../../../lib/dom.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { suaToanBo } from '../../../lib/kl/quyen-them-db.js';
import { oSuaToanBoHtml, thayDoiTuForm, oCuaViec, idO } from './sua-toan-bo-o.js';
import { napPhamViSua } from './sua-tang-lv.js';
import { timKlRow } from './danh-sach.js';
import { dh } from '../dieu-hanh/du-lieu.js';

let sauHanhDong = async () => {};
let dau = {};   // giá trị các ô lúc mở hộp
const dongViec = (id) => timKlRow(id) || dh.rows.find((x) => x.id === id);

const template = `
<div id="stbModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="stbTieuDe">
  <form class="modal modal-rong" data-submit="luuSuaToanBo" novalidate>
    <h2 id="stbTieuDe" class="modal-tieu-de">Sửa toàn bộ thông tin</h2>
    <p class="chu-phu mt-1">Tài khoản quản trị sửa được mọi ô, kể cả việc đã hoàn thành. Chỉ ô có thay đổi được ghi; lịch sử lưu cũ → mới, người sửa, lúc
      sửa và lý do; chủ trì, người theo dõi, người giao việc được báo. Chủ trì, người theo dõi: "Đổi chủ trì theo dõi"; văn bản: "Sửa văn bản giao".</p>
    <input type="hidden" id="stbId">
    <div id="stbO"></div>
    <p id="stbLv" class="chu-phu mt-2" aria-live="polite"></p>
    <p id="stbDoi" class="chu-phu mt-2" aria-live="polite"></p>
    <div class="mt-3"><label for="stbLyDo" class="nhan">Lý do <span class="chu-phu">bắt buộc, tối đa 500 ký tự</span></label>
      <input type="text" id="stbLyDo" class="o-nhap" maxlength="500" placeholder="Ví dụ: đính chính theo văn bản gốc"></div>
    <div class="modal-chan"><button type="button" class="nut" data-action="dongSuaToanBo">Huỷ</button><button type="submit" id="stbLuu" class="nut chinh">Lưu thay đổi</button></div>
  </form>
</div>`;

const doc = (cot) => { const el = $(idO(cot)); return el ? el.value.trim() : undefined; };
function capNhatDoi() {
  const r = dongViec($('stbId').value);
  if (!r) return;
  const { ghiChu, ten } = thayDoiTuForm(r, doc, dau);
  setText('stbLv', ghiChu);
  setText('stbDoi', ten.length ? `Sẽ sửa: ${ten.join(', ')}.` : 'Chưa đổi ô nào.');
}

function moSuaToanBo({ id }) {
  const r = dongViec(id);
  if (!r) return;
  $('stbId').value = id;
  setText('stbTieuDe', `Sửa toàn bộ thông tin · ${r.ma}`);
  $('stbO').innerHTML = oSuaToanBoHtml(r);
  dau = Object.fromEntries(oCuaViec(r).map(([c]) => [c, doc(c)]));
  $('stbLyDo').value = ''; $('stbLuu').disabled = false;
  capNhatDoi();
  napPhamViSua(r).then(capNhatDoi).catch(() => {});   // phân công: câu lãnh đạo phụ trách khi đổi ngành
  show('stbModal', true);
  $(idO('noi_dung'))?.focus();
}
const dongSuaToanBo = () => show('stbModal', false);

async function luuSuaToanBo() {
  const id = $('stbId').value; const r = dongViec(id); const lyDo = $('stbLyDo').value.trim();
  if (!r) return;
  const { thay, ten } = thayDoiTuForm(r, doc, dau);
  if (!ten.length) { notifyError('Chưa đổi ô nào.'); return; }
  if ('noi_dung' in thay && !thay.noi_dung) { notifyError('Nội dung không được để trống.'); return; }
  if (!lyDo) { notifyError('Ghi lý do sửa (bắt buộc).'); $('stbLyDo').focus(); return; }
  $('stbLuu').disabled = true;
  try {
    await suaToanBo(id, thay, lyDo);
    notifySuccess(`Đã sửa ${r.ma}: ${ten.join(', ')}. Chủ trì, người theo dõi, người giao việc được báo.`);
    dongSuaToanBo();
    await sauHanhDong(id);
  } catch (e) { notifyError(loiDeHieu(e)); $('stbLuu').disabled = false; }
}

export function mountSuaToanBo(registerActions, napLai) {
  sauHanhDong = napLai;
  $('modalRoot').insertAdjacentHTML('beforeend', template);
  ['input', 'change'].forEach((ev) => $('stbO').addEventListener(ev, capNhatDoi));
  registerActions({ moSuaToanBo, dongSuaToanBo, luuSuaToanBo });
}
