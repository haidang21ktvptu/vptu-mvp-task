// Phân hệ Nhiệm vụ quý BTV — trong ngăn chi tiết: "Sửa thông tin nhiệm vụ" (đầu mối tổng hợp: trục, nhóm, Stt, nội dung, lãnh đạo phụ trách, đơn vị tham mưu
// chủ trì, kết quả cần đạt, tiến độ, tính chất — lý do bắt buộc, lịch sử) và "Sửa kết quả, sản phẩm" (chủ trì theo dõi, người được cập nhật: thêm / tách / sửa
// mô tả, loại, mốc, chỉ tiêu và mục tiêu, xoá — sửa / xoá có lý do). Danh mục lãnh đạo / đơn vị lấy từ CSDL (nq.lanhDao, nq.donVi).
import { $ } from '../../lib/dom.js';
import { notifyError, notifySuccess } from '../../components/toast.js';
import { nq, luuNhiemVu, luuSanPham, xoaSanPham } from '../../lib/nvq/du-lieu.js';
import { LOAI_SP, NHOM_NGAN, TINH_CHAT, CHI_TIEU_CO_BAN, VAI_TRO_DON_VI } from '../../lib/nvq/nhan.js';
import { e } from './khung.js';
import { ct, moNhiemVuQuy } from './chi-tiet.js';
import { hoiLyDo } from './hoi.js';

let napLaiSauGhi = async () => {};
export const datNapLaiSua = (fn) => { napLaiSauGhi = fn; };
const sau = async () => { await napLaiSauGhi(); if (ct.id) await moNhiemVuQuy(ct.id); };
const opt = (ds, gt) => ds.map(([v, t]) => `<option value="${e(String(v))}"${String(gt ?? '') === String(v) ? ' selected' : ''}>${e(t)}</option>`).join('');
const dau = (tieuDe) => `<button type="button" class="nq-ve" data-action="nqVeChiTiet">← Chi tiết ${e(ct.du.r.so_hieu)}</button><h3>${e(tieuDe)} · ${e(ct.du.r.so_hieu)}</h3>`;
const ve = (html) => { $('nqNganThan').innerHTML = html; $('nqNganThan').scrollTop = 0; };

function formSua() {
  const r = ct.du.r;
  const dv = [...(r.don_vi || []), {}, {}].slice(0, Math.max(3, (r.don_vi || []).length + 1));
  ve(`${dau('Sửa thông tin nhiệm vụ')}<form class="nq-form" data-submit="nqLuuSua"><div class="nq-luoi-form">`
    + `<label class="nq-o-form"><span>Trục</span><select class="o-nhap nho" name="truc_so">${opt(nq.truc.map((t) => [t.so, `Trục ${t.so} — ${t.ten_ngan}`]), r.truc_so)}</select></label>`
    + `<label class="nq-o-form"><span>Nhóm</span><select class="o-nhap nho" name="nhom">${opt(Object.entries(NHOM_NGAN), r.nhom)}</select></label>`
    + `<label class="nq-o-form"><span>Stt</span><input type="number" min="1" max="999" class="o-nhap nho" name="stt" value="${r.stt}" required></label>`
    + `<label class="nq-o-form"><span>Tính chất</span><select class="o-nhap nho" name="tinh_chat">${opt(Object.entries(TINH_CHAT), r.tinh_chat)}</select></label></div>`
    + `<label class="nq-o-form rong"><span>Nhiệm vụ được giao</span><textarea class="o-nhap" name="noi_dung" rows="4" maxlength="4000" required>${e(r.noi_dung)}</textarea></label>`
    + `<label class="nq-o-form rong"><span>Lãnh đạo phụ trách (ghi như văn bản)</span><input class="o-nhap nho" name="lanh_dao_text" maxlength="1000" value="${e(r.lanh_dao_text || '')}"></label>`
    + `<fieldset class="nq-chon-muc"><legend>Lãnh đạo phụ trách (để thống kê)</legend>${nq.lanhDao.filter((l) => l.dang_dung).map((l) => `<label class="nq-hop"><input type="checkbox" name="lanh_dao_ma" value="${l.ma}"${(r.lanh_dao_ma || []).includes(l.ma) ? ' checked' : ''}> ${e(l.ten)}</label>`).join('')}</fieldset>`
    + `<label class="nq-o-form rong"><span>Đơn vị tham mưu, chủ trì (ghi như văn bản)</span><input class="o-nhap nho" name="don_vi_text" maxlength="1000" value="${e(r.don_vi_text || '')}"></label>`
    + `<fieldset class="nq-dv"><legend>Đơn vị (để thống kê)</legend>${dv.map((d, i) => `<div class="nq-dv-dong"><select class="o-nhap nho" name="dv_ma_${i}" aria-label="Đơn vị ${i + 1}"><option value="">—</option>${opt(nq.donVi.map((x) => [x.ma, x.ten]), d.ma)}</select>`
      + `<select class="o-nhap nho" name="dv_vt_${i}" aria-label="Vai trò ${i + 1}">${opt(Object.entries(VAI_TRO_DON_VI), d.vai_tro || 'CHU_TRI')}</select><input class="o-nhap nho" name="dv_ct_${i}" maxlength="200" placeholder="Cơ quan cụ thể (Sở…)" value="${e(d.cu_the || '')}" aria-label="Cơ quan cụ thể ${i + 1}"></div>`).join('')}</fieldset>`
    + `<label class="nq-o-form rong"><span>Kết quả/sản phẩm cần đạt được</span><textarea class="o-nhap" name="ket_qua_can_dat" rows="3" maxlength="4000">${e(r.ket_qua_can_dat || '')}</textarea></label>`
    + `<label class="nq-o-form rong"><span>Tiến độ thực hiện/hoàn thành</span><input class="o-nhap nho" name="tien_do_text" maxlength="300" value="${e(r.tien_do_text || '')}"></label>`
    + '<label class="nq-o-form rong"><span>Lý do sửa</span><textarea class="o-nhap" name="ly_do" rows="2" maxlength="500" required></textarea></label>'
    + `<div class="hanh-dong"><button type="submit" class="nut chinh">Lưu thông tin</button><button type="button" class="nut" data-action="nqVeChiTiet">Huỷ</button></div><input type="hidden" name="so_dv" value="${dv.length}"></form>`);
}
async function luuSua(ds, form) {
  const f = new FormData(form); const g = (k) => String(f.get(k) ?? '').trim();
  const donVi = Array.from({ length: Number(g('so_dv')) }, (_, i) => ({ ma: g(`dv_ma_${i}`), vai_tro: g(`dv_vt_${i}`) || 'CHU_TRI', cu_the: g(`dv_ct_${i}`) || null })).filter((d) => d.ma);
  const p = { id: ct.id, truc_so: Number(g('truc_so')), nhom: g('nhom'), stt: Number(g('stt')), tinh_chat: g('tinh_chat'), noi_dung: g('noi_dung'), lanh_dao_text: g('lanh_dao_text'),
    lanh_dao_ma: f.getAll('lanh_dao_ma'), don_vi_text: g('don_vi_text'), don_vi: donVi, ket_qua_can_dat: g('ket_qua_can_dat'), tien_do_text: g('tien_do_text') };
  try { await luuNhiemVu(p, g('ly_do')); notifySuccess('Đã lưu thông tin nhiệm vụ.'); await sau(); } catch (err) { notifyError(err.message); }
}

function oSp(s, i) {
  const id = s?.id || 'moi';
  return `<form class="nq-form nq-sp-sua" data-submit="nqLuuSp" data-id="${s?.id || ''}"><div class="nq-luoi-form">`
    + `<label class="nq-o-form rong"><span>${s ? `Kết quả, sản phẩm ${i + 1}` : 'Thêm kết quả, sản phẩm'}</span><textarea class="o-nhap" name="mo_ta" rows="2" maxlength="2000" required>${e(s?.mo_ta || '')}</textarea></label>`
    + `<label class="nq-o-form"><span>Loại</span><select class="o-nhap nho" name="loai">${opt(Object.entries(LOAI_SP), s?.loai || 'VAN_BAN')}</select></label>`
    + `<label class="nq-o-form"><span>Mốc hoàn thành</span><input type="date" class="o-nhap nho" name="han" value="${s?.han || nq.ky?.den_ngay || ''}"></label>`
    + `<label class="nq-o-form"><span>Tiến độ ghi</span><input class="o-nhap nho" name="han_text" maxlength="100" value="${e(s?.han_text || '')}" placeholder="Tháng 11/2026"></label>`
    + `<label class="nq-o-form"><span>Thứ tự</span><input type="number" min="1" class="o-nhap nho" name="thu_tu" value="${s?.thu_tu || ''}"></label>`
    + `<label class="nq-o-form"><span>Chỉ tiêu cơ bản</span><select class="o-nhap nho" name="chi_tieu_co_ban"><option value="">— Không —</option>${opt(Object.entries(CHI_TIEU_CO_BAN), s?.chi_tieu_co_ban)}</select></label>`
    + `<label class="nq-o-form"><span>Mục tiêu (chỉ tiêu)</span><input type="number" step="any" class="o-nhap nho" name="muc_tieu" value="${s?.muc_tieu ?? ''}"></label>`
    + `<label class="nq-o-form"><span>Đơn vị tính</span><input class="o-nhap nho" name="don_vi_tinh" maxlength="40" value="${e(s?.don_vi_tinh || '')}" placeholder="%, tỷ đồng…"></label>`
    + `<label class="nq-o-form"><span>Chiều đánh giá</span><select class="o-nhap nho" name="chieu">${opt([['CAO_HON_TOT', 'Đạt khi ≥ mục tiêu'], ['THAP_HON_TOT', 'Đạt khi ≤ mục tiêu']], s?.chieu || 'CAO_HON_TOT')}</select></label></div>`
    + `<div class="hanh-dong"><button type="submit" class="nut ${s ? '' : 'chinh'}">${s ? 'Lưu' : 'Thêm'}</button>${s && (nq.quyen.quan_ly || (!['HOAN_THANH', 'KHONG_PHAT_SINH'].includes(s.trang_thai) && !(s.so_ngay_qua > 0))) ? `<button type="button" class="nut" data-action="nqXoaSp" data-id="${id}">Xoá</button>` : ''}</div></form>`;
}
function formSanPham() {
  ve(`${dau('Sửa kết quả, sản phẩm')}<p class="chu-phu">Tách kết quả cần đạt thành từng kết quả, sản phẩm (văn bản, chỉ tiêu, hoạt động, định kỳ) với mốc riêng để theo dõi đúng tiến độ.</p>`
    + ct.du.sp.map(oSp).join('') + oSp(null, ct.du.sp.length));
}
async function luuSp(ds, form) {
  const f = new FormData(form); const g = (k) => String(f.get(k) ?? '').trim();
  const p = { id: form.dataset.id || null, nhiem_vu_id: ct.id, mo_ta: g('mo_ta'), loai: g('loai'), han: g('han'), han_text: g('han_text'), thu_tu: g('thu_tu'),
    chi_tieu_co_ban: g('chi_tieu_co_ban'), muc_tieu: g('muc_tieu'), don_vi_tinh: g('don_vi_tinh'), chieu: g('chieu') };
  let ly = null;
  if (p.id) { ly = await hoiLyDo({ tieuDe: 'Sửa kết quả, sản phẩm', moTa: p.mo_ta }); if (!ly) return; }
  try { await luuSanPham(p, ly); notifySuccess(p.id ? 'Đã lưu kết quả, sản phẩm.' : 'Đã thêm kết quả, sản phẩm.'); await napLaiSauGhi(); await moNhiemVuQuy(ct.id); formSanPham(); } catch (err) { notifyError(err.message); }
}
async function xoaSp({ id }) {
  const ly = await hoiLyDo({ tieuDe: 'Xoá kết quả, sản phẩm', moTa: 'Số liệu, trạng thái của kết quả này bị xoá theo; lịch sử ghi lại.' });
  if (!ly) return;
  try { await xoaSanPham(id, ly); notifySuccess('Đã xoá kết quả, sản phẩm.'); await napLaiSauGhi(); await moNhiemVuQuy(ct.id); formSanPham(); } catch (err) { notifyError(err.message); }
}
export const HANH_DONG_SUA = { nqFormSua: formSua, nqLuuSua: luuSua, nqFormSanPham: formSanPham, nqLuuSp: luuSp, nqXoaSp: xoaSp };
