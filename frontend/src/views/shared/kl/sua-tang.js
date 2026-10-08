// Ngăn chi tiết — nhập theo tầng (giao diện v9 đợt 2, 0070–0071): ô do cấp giao điền có biểu tượng BÚT (đồng chí là cấp giao: sửa ngay, lý do bắt
// buộc, lịch sử + tin cho người nhận) hoặc KHOÁ (đồng chí là Owner / người theo dõi: bấm để "Đề nghị sửa", người giao duyệt một bấm). Một hộp thoại
// cho cả hai (chọn ô, giá trị mới, lý do). Khối "Đề nghị sửa đang chờ" trong ngăn: người duyệt Chấp nhận / Giữ nguyên (ý kiến bắt buộc), người gửi
// Rút đề nghị. Hàm DB là chốt (cheDoTang chỉ ẩn / hiện).
import { $, escapeHtml, show, formatDateTime } from '../../../lib/dom.js';
import { state, findAccount } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { danhMucKl, tenTrongDanhMuc } from '../../../lib/kl/du-lieu.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { THU_TU_DO_KHAN, tenDoKhan } from '../../../lib/kl/do-khan.js';
import { tenCapDuyet } from '../../../lib/kl/thay-mat.js';
import { MUC_QUAN_TRONG, tenMucQuanTrong } from '../../../lib/kl/ma-nguon.js';
import { O_GIAO, tenOGiao, cheDoTang, laTangGiao, suaThongTinGiao, guiDeNghiSua, duyetDeNghiSua, rutDeNghiSua, deNghiChoCuaViec, deNghiChoToiDuyet } from '../../../lib/kl/sua-tang.js';
import { timKlRow } from './danh-sach.js';
import { dh } from '../dieu-hanh/du-lieu.js';

let sauHanhDong = async () => {};
const BUT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const KHOA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const DM = { sanPham: 'sanPham', cap: 'cap', nganh: 'nganh', linhVuc: 'linhVuc', nguonNhiemVu: 'nguonNhiemVu' };
const kieuCua = (cot) => O_GIAO.find(([c]) => c === cot)?.[2] || 'chu';
const nguoiGiao = (r) => tenCapDuyet(r, r.giao_thay_mat_cho || r.tao_boi) || 'cấp giao việc';   // nhóm được thay mặt → tên nhóm (v3.18)
const dongViec = (id) => timKlRow(id) || dh.rows.find((x) => x.id === id);   // ngăn chi tiết (kl.rows) hoặc thẻ "Việc của tôi" (dh.rows)

// Giá trị hiển thị của một ô (mã danh mục → tên).
export function giaTriO(cot, v) {
  if (v === null || v === undefined || v === '') return '(trống)';
  const k = kieuCua(cot);
  if (k === 'doKhan') return tenDoKhan(v);
  if (k === 'mucQT') return tenMucQuanTrong(v);
  if (k === 'donViNgoai') return tenTrongDanhMuc('donVi', v);
  if (k === 'thuongTruc') return findAccount(v)?.full_name || String(v);
  return DM[k] ? tenTrongDanhMuc(DM[k], v) : String(v);
}

// Nút bút / khoá cạnh một ô của ngăn chi tiết ('' khi chỉ xem).
export function nutTangHtml(r, cot) {
  const che = cheDoTang(r); const ten = tenOGiao(cot);
  if (che === 'sua') return `<button type="button" class="nut-tang" data-action="moSuaTang" data-id="${r.id}" data-cot="${cot}" aria-label="Sửa ${escapeHtml(ten.toLowerCase())}" title="Sửa tại chỗ — lịch sử được ghi lại, người nhận việc được báo">${BUT}</button>`;
  if (che === 'de-nghi') {
    const ai = escapeHtml(nguoiGiao(r));
    return `<button type="button" class="nut-tang khoa" data-action="moDeNghiSua" data-id="${r.id}" data-cot="${cot}" aria-label="${escapeHtml(ten)} do ${ai} điền. Bấm để đề nghị sửa" title="Do ${ai} điền. Bấm để đề nghị sửa">${KHOA}</button>`;
  }
  return '';
}
// Nút ở hàng hành động của ngăn.
export function nutHanhDongTang(r) {
  const che = cheDoTang(r);
  if (che === 'sua') return `<button type="button" class="nut" data-action="moSuaTang" data-id="${r.id}">${BUT} Sửa thông tin giao</button>`;
  if (che === 'de-nghi') return `<button type="button" class="nut" data-action="moDeNghiSua" data-id="${r.id}">${KHOA} Đề nghị sửa</button>`;
  return '';
}

// ---- Khối "Đề nghị sửa đang chờ" (nạp sau khi ngăn vẽ, như chỉ đạo / minh chứng)
export const khoiDeNghiSuaHtml = (r) => `<div class="khoi-nho khoi-dns hidden" id="klDns-${r.id}"></div>`;
export async function napDeNghiSua(r) {
  const o = $(`klDns-${r.id}`);
  if (!o) return;
  const d = await deNghiChoCuaViec(r.id);
  if (!d || !$(`klDns-${r.id}`)) { show(o, false); return; }
  o.closest('.chi-tiet-noi')?.querySelectorAll('[data-action="moDeNghiSua"]').forEach((b) => { b.disabled = true; b.title = 'Việc đã có một đề nghị sửa đang chờ duyệt'; });
  const me = state.user?.id; const nguoiGui = findAccount(d.nguoi_de_nghi)?.full_name || 'cán bộ'; const duyet = findAccount(d.cap_duyet)?.full_name || 'người giao việc';
  const duocDuyet = me !== d.nguoi_de_nghi && (d.cap_duyet === me || laTangGiao(r) || (state.user?.role_group === 'A0' && findAccount(d.cap_duyet)?.role_group === 'A0'));
  const dong = Object.entries(d.thay_doi).map(([c, v]) => `<li><b>${escapeHtml(tenOGiao(c))}</b>: ${escapeHtml(giaTriO(c, d.gia_tri_cu?.[c]))} → <b>${escapeHtml(giaTriO(c, v))}</b></li>`).join('');
  o.innerHTML = `<h4>Đề nghị sửa đang chờ duyệt</h4><ul class="dns-ds">${dong}</ul>
    <p class="chu-phu">Lý do: ${escapeHtml(d.ly_do)} — ${escapeHtml(nguoiGui)} gửi ${formatDateTime(d.tao_luc)}, chờ ${escapeHtml(duyet)} duyệt. Việc vẫn chạy trong lúc chờ.</p>
    ${duocDuyet ? `<div class="hanh-dong"><button type="button" class="nut chinh nho" data-action="dnsChapNhan" data-id="${d.id}" data-nv="${r.id}">Chấp nhận</button>
      <button type="button" class="nut nho" data-action="moO" data-o="oDns-${d.id}">Giữ nguyên</button></div>
      <form class="o" id="oDns-${d.id}" data-submit="dnsGiuNguyen" data-id="${d.id}" data-nv="${r.id}">
        <input name="y_kien" required maxlength="500" placeholder="Ý kiến cho người đề nghị (bắt buộc)" aria-label="Ý kiến khi giữ nguyên">
        <button type="submit" class="nut chinh">Giữ nguyên</button><button type="button" class="nut" data-action="dongO" data-o="oDns-${d.id}">Huỷ</button></form>` : ''}
    ${me === d.nguoi_de_nghi ? `<div class="hanh-dong"><button type="button" class="nut nho" data-action="dnsRut" data-id="${d.id}" data-nv="${r.id}">Rút đề nghị</button></div>` : ''}`;
  show(o, true);
}

// ---- Dải "Cần xử lý ngay" (can-xu-ly.js, mục dnsua): đề nghị chờ CHÍNH TÔI duyệt — đọc khi mở mục, đọc lại sau mỗi lần duyệt.
let choToi = null;
export async function napDnsChoToi() { try { choToi = await deNghiChoToiDuyet(); } catch { choToi = []; } return choToi; }
const nutCx = (nhan, action, d, lop = '') => `<button type="button" class="nut nho ${lop}" data-action="${action}" data-id="${d.id}" data-nv="${d.nhiem_vu_id}">${nhan}</button>`;
export const dongDeNghiSuaCx = () => (choToi || []).map((d) => {
  const ma = d.nhiem_vu?.ma || 'Nhiệm vụ'; const thay = Object.entries(d.thay_doi).map(([c, v]) => `${escapeHtml(tenOGiao(c))}: ${escapeHtml(giaTriO(c, d.gia_tri_cu?.[c]))} → <b>${escapeHtml(giaTriO(c, v))}</b>`).join('; ');
  return `<div class="cx-dong the-con" id="cx-dnsua-${d.id}" data-nhiem-vu="${d.nhiem_vu_id}">
    <p><button type="button" class="cx-ma" data-action="xemDienBien" data-id="${d.nhiem_vu_id}" data-ma="${escapeHtml(ma)}" aria-expanded="false"><b>${escapeHtml(ma)}</b></button>
      ${escapeHtml((d.nhiem_vu?.noi_dung || '').slice(0, 110))}<span class="chu-phu"> · ${escapeHtml(findAccount(d.nguoi_de_nghi)?.full_name || 'cán bộ')} đề nghị ${formatDateTime(d.tao_luc)}</span></p>
    <p>${thay}</p><p class="ly-do">Lý do: ${escapeHtml(d.ly_do)}</p>
    <div class="hanh-dong">${nutCx('Chấp nhận', 'dnsChapNhan', d, 'chinh')}<button type="button" class="nut nho" data-action="moO" data-o="oDnsCx-${d.id}">Giữ nguyên</button></div>
    <form class="o" id="oDnsCx-${d.id}" data-submit="dnsGiuNguyen" data-id="${d.id}" data-nv="${d.nhiem_vu_id}">
      <input name="y_kien" required maxlength="500" placeholder="Ý kiến cho người đề nghị (bắt buộc)" aria-label="Ý kiến khi giữ nguyên">
      <button type="submit" class="nut chinh">Giữ nguyên</button><button type="button" class="nut" data-action="dongO" data-o="oDnsCx-${d.id}">Huỷ</button></form></div>`;
});

// ---- Hộp thoại sửa / đề nghị sửa
export const suaTangTemplate = `
<div id="stModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="stTieuDe">
  <form class="modal modal-rong" data-submit="luuSuaTang" novalidate>
    <h2 id="stTieuDe" class="modal-tieu-de">Sửa thông tin giao</h2>
    <p id="stMoTa" class="chu-phu mt-1 mb-4"></p>
    <input type="hidden" id="stId"><input type="hidden" id="stCheDo">
    <div class="cot-2">
      <div><label for="stCot" class="nhan">Ô cần sửa</label><select id="stCot" class="o-nhap"></select></div>
      <div><p class="nhan">Đang ghi</p><p id="stCu" class="st-cu"></p></div>
    </div>
    <div class="mt-3" id="stMoiWrap"></div>
    <div class="mt-3"><label for="stLyDo" class="nhan">Lý do <span class="chu-phu">bắt buộc, tối đa 500 ký tự</span></label>
      <input type="text" id="stLyDo" class="o-nhap" maxlength="500" placeholder="Một câu, ví dụ: theo kết luận giao ban ngày 2/10"></div>
    <div class="modal-chan"><button type="button" class="nut" data-action="dongSuaTang">Huỷ</button><button type="submit" id="stLuu" class="nut chinh">Lưu</button></div>
  </form>
</div>`;

const opt = (v, t, chon) => `<option value="${escapeHtml(v)}"${chon ? ' selected' : ''}>${escapeHtml(t)}</option>`;
const linhVucOpts = (nganh, chon) => opt('', '(để trống)', !chon) + (danhMucKl().linhVuc || []).filter((l) => !nganh || l.nganh_ma === nganh).map((l) => opt(l.ma, l.ten, l.ma === chon)).join('');
function oMoiHtml(cot, r) {
  const k = kieuCua(cot); const v = r[cot] ?? ''; const nhan = `<label for="stMoi" class="nhan">Giá trị mới</label>`;
  // Đổi ngành kéo theo chọn lại lĩnh vực trong ngành mới (DB kiểm lĩnh vực thuộc ngành; việc từ kết luận phải có cả hai).
  if (k === 'nganh') {
    return `${nhan}<select id="stMoi" class="o-nhap">${opt('', '(để trống)', !v)}${(danhMucKl().nganh || []).map((d) => opt(d.ma, d.ten, d.ma === v)).join('')}</select>
      <label for="stMoi2" class="nhan mt-3">Lĩnh vực trong ngành</label><select id="stMoi2" class="o-nhap">${linhVucOpts(v, r.linh_vuc_ma)}</select>`;
  }
  if (k === 'linhVuc') return `${nhan}<select id="stMoi" class="o-nhap">${linhVucOpts(r.nganh_ma, v)}</select>`;
  if (k === 'vb') return `${nhan}<textarea id="stMoi" class="o-nhap" rows="3" maxlength="2000">${escapeHtml(v)}</textarea>`;
  if (k === 'chu') return `${nhan}<input type="text" id="stMoi" class="o-nhap" maxlength="${cot === 'don_vi_phoi_hop' ? 300 : 1000}" value="${escapeHtml(v)}">`;
  const dm = danhMucKl();
  const ds = k === 'doKhan' ? THU_TU_DO_KHAN.map((m) => ({ ma: m, ten: tenDoKhan(m) }))
    : k === 'nguonNhiemVu' ? (dm.nguonNhiemVu || []).filter((d) => d.dang_dung || d.ma === v)
      : k === 'mucQT' ? MUC_QUAN_TRONG.map(([ma, ten]) => ({ ma, ten }))
        : k === 'donViNgoai' ? (dm.donVi || []).filter((d) => !d.trong_van_phong)
          : k === 'thuongTruc' ? state.accounts.filter((a) => a.role_group === 'A0' && !a.is_system).map((a) => ({ ma: a.id, ten: a.full_name })) : (dm[DM[k]] || []);
  const trong = ['doKhan', 'sanPham', 'cap'].includes(k) ? '' : opt('', '(để trống)', !v);   // độ khẩn, sản phẩm, cấp nhận: luôn phải có
  return `${nhan}<select id="stMoi" class="o-nhap">${trong}${ds.map((d) => opt(d.ma, d.ten, d.ma === v)).join('')}</select>`;
}
function veO() {
  const r = dongViec($('stId').value); const cot = $('stCot').value;
  if (!r) return;
  $('stCu').textContent = giaTriO(cot, r[cot]) + (cot === 'nganh_ma' ? ` · lĩnh vực ${giaTriO('linh_vuc_ma', r.linh_vuc_ma)}` : '');
  $('stMoiWrap').innerHTML = oMoiHtml(cot, r);
  if (cot === 'nganh_ma') $('stMoi').addEventListener('change', () => { $('stMoi2').innerHTML = linhVucOpts($('stMoi').value, ''); });
}
function moHop(cheDo, { id, cot }) {
  const r = dongViec(id);
  if (!r) return;
  const sua = cheDo === 'sua';
  $('stId').value = id; $('stCheDo').value = cheDo;
  $('stTieuDe').textContent = sua ? `Sửa thông tin giao · ${r.ma}` : `Đề nghị sửa · ${r.ma}`;
  $('stMoTa').textContent = sua ? 'Đồng chí là cấp giao việc: thay đổi áp ngay, ghi lịch sử kèm lý do; chủ trì và người theo dõi được báo.'
    : `Ô này do ${nguoiGiao(r)} điền. Đề nghị được gửi tới người duyệt; việc vẫn chạy trong lúc chờ.`;
  $('stCot').innerHTML = O_GIAO.map(([c, ten]) => opt(c, ten, c === (cot || 'noi_dung'))).join('');
  $('stLyDo').value = ''; $('stLuu').disabled = false;
  $('stLuu').textContent = sua ? 'Lưu thay đổi' : 'Gửi đề nghị';
  veO();
  show('stModal', true);
  $('stMoi')?.focus();
}
const dongSuaTang = () => show('stModal', false);

async function luuSuaTang() {
  const id = $('stId').value; const cot = $('stCot').value; const lyDo = $('stLyDo').value.trim();
  const moi = $('stMoi').value.trim();
  const thay = cot === 'nganh_ma' ? { nganh_ma: moi || null, linh_vuc_ma: $('stMoi2').value || null } : { [cot]: moi || null };
  if (!lyDo) { notifyError('Ghi lý do (bắt buộc).'); $('stLyDo').focus(); return; }
  if (['noi_dung', 'do_khan'].includes(cot) && !moi) { notifyError(`${tenOGiao(cot)} không được để trống.`); return; }
  $('stLuu').disabled = true;
  try {
    if ($('stCheDo').value === 'sua') {
      await suaThongTinGiao(id, thay, lyDo);
      notifySuccess(`Đã sửa ${tenOGiao(cot).toLowerCase()}. Chủ trì và người theo dõi được báo.`);
    } else {
      await guiDeNghiSua(id, thay, lyDo);
      notifySuccess('Đã gửi đề nghị sửa. Người duyệt nhận thông báo; việc vẫn chạy trong lúc chờ.');
    }
    dongSuaTang();
    await sauHanhDong(id);
  } catch (e) { notifyError(loiDeHieu(e)); $('stLuu').disabled = false; }
}

async function sauDuyet(nv, chu) { notifySuccess(chu); if (choToi) await napDnsChoToi(); await sauHanhDong(nv); }
async function dnsChapNhan({ id, nv }) {
  try { await duyetDeNghiSua(id, true); await sauDuyet(nv, 'Đã chấp nhận đề nghị sửa — thông tin giao đã cập nhật.'); } catch (e) { notifyError(loiDeHieu(e)); }
}
async function dnsGiuNguyen({ id, nv }, form) {
  const yKien = String(new FormData(form).get('y_kien') || '').trim();
  if (!yKien) { notifyError('Giữ nguyên thì ghi ý kiến cho người đề nghị.'); return; }
  try { await duyetDeNghiSua(id, false, yKien); await sauDuyet(nv, 'Đã giữ nguyên, người đề nghị nhận ý kiến của đồng chí.'); } catch (e) { notifyError(loiDeHieu(e)); }
}
async function dnsRut({ id, nv }) {
  try { await rutDeNghiSua(id); await sauDuyet(nv, 'Đã rút đề nghị sửa.'); } catch (e) { notifyError(loiDeHieu(e)); }
}

export function mountSuaTang(registerActions, napLai) {
  sauHanhDong = napLai;
  $('modalRoot').insertAdjacentHTML('beforeend', suaTangTemplate);
  $('stCot').addEventListener('change', veO);
  registerActions({ moSuaTang: (d) => moHop('sua', d), moDeNghiSua: (d) => moHop('de-nghi', d), dongSuaTang, luuSuaTang, dnsChapNhan, dnsGiuNguyen, dnsRut });
}
