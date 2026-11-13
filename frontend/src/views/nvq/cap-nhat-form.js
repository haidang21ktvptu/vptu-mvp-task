// Phân hệ Nhiệm vụ quý BTV — biểu mẫu "Cập nhật tiến độ" (chủ trì theo dõi là người cập nhật chính): một lần ghi gồm kết quả trong tuần, kết quả thực hiện
// lũy kế (hiện ở Tổng quan, Danh mục, báo cáo), và từng kết quả / sản phẩm theo đúng loại — văn bản: trạng thái + số, ngày, cơ quan ban hành, trích yếu;
// hoạt động: ngày tổ chức, kết quả; chỉ tiêu: số thực hiện lũy kế, ngày số liệu, ước tính, nguồn; định kỳ / khác: kết quả từng mốc; vướng mắc, đề xuất,
// nguồn thông tin; "Không có thay đổi trong tuần". Chỉ gửi phần đã đổi. Gửi: nvq_cap_nhat_gui (0137) — một giao dịch, gắn tuần báo cáo của ngày báo cáo.
import { notifyError, notifySuccess } from '../../components/toast.js';
import { homNayVN } from '../../lib/kl/ngay.js';
import { nq, guiCapNhat } from '../../lib/nvq/du-lieu.js';
import { LOAI_SP, luaChonTrangThaiSp, tenTrangThaiSp, soVN } from '../../lib/nvq/nhan.js';
import { e, vn } from './khung.js';

const o = (nhan, html, lop = '') => `<label class="nq-o-form ${lop}"><span>${nhan}</span>${html}</label>`;
const vb = (s, k, nhan, kieu = 'text', them = '') => o(nhan, `<input type="${kieu}" class="o-nhap nho" name="${k}_${s.id}" value="${e(s[k] ?? '')}" ${them}>`);

function spForm(s) {
  const hom = homNayVN();
  const chon = `<select class="o-nhap nho" name="tt_${s.id}" data-nq-tt-sp>${luaChonTrangThaiSp(s.loai, { quanLy: nq.quyen.quan_ly })
    .map((t) => `<option value="${t}"${t === s.trang_thai ? ' selected' : ''}>${e(tenTrangThaiSp(s.loai, t))}</option>`).join('')}</select>`;
  let rieng = '';
  if (s.loai === 'VAN_BAN') {
    rieng = `<div class="nq-luoi-form">${vb(s, 'kq_so_ky_hieu', 'Số, ký hiệu văn bản', 'text', 'maxlength="100" placeholder="Ví dụ: 199-KH/TU"')}${vb(s, 'kq_ngay', 'Ngày văn bản', 'date', `max="${hom}"`)}`
      + `${vb(s, 'kq_co_quan', 'Cơ quan ban hành', 'text', 'maxlength="200"')}${vb(s, 'kq_trich_yeu', 'Trích yếu', 'text', 'maxlength="1000"')}</div>`;
  } else if (s.loai === 'CHI_TIEU') {
    rieng = `<p class="chu-phu">Mục tiêu: <b>${soVN(s.muc_tieu) || '—'}</b> ${e(s.don_vi_tinh || '')}${s.thuc_hien !== null && s.thuc_hien !== undefined ? ` · đã ghi ${soVN(s.thuc_hien)} (ngày ${vn(s.thuc_hien_ngay)})` : ''}</p>`
      + `<div class="nq-luoi-form">${o(`Số thực hiện (lũy kế, ${e(s.don_vi_tinh || 'đơn vị')})`, `<input type="number" step="any" class="o-nhap nho" name="so_${s.id}" inputmode="decimal">`)}`
      + `${o('Ngày số liệu', `<input type="date" class="o-nhap nho" name="ngay_so_${s.id}" value="${hom}" max="${hom}">`)}`
      + `${o('Nguồn số liệu', `<input type="text" class="o-nhap nho" name="nguon_so_${s.id}" maxlength="300" placeholder="Ví dụ: Báo cáo của Sở Tài chính">`)}`
      + `<label class="nq-hop"><input type="checkbox" name="uoc_${s.id}"> Số ước tính</label></div>`;
  } else {
    rieng = `<div class="nq-luoi-form">${vb(s, 'kq_ngay', s.loai === 'HOAT_DONG' ? 'Ngày tổ chức' : 'Ngày thực hiện', 'date', `max="${hom}"`)}${vb(s, 'kq_mo_ta', 'Kết quả', 'text', 'maxlength="2000"')}</div>`;
  }
  return `<fieldset class="nq-sp-form"><legend><span class="nq-loai">${e(LOAI_SP[s.loai])}</span> ${e(s.mo_ta)}</legend>`
    + `<small class="${s.so_ngay_qua > 0 ? 'nq-chu-do' : 'chu-phu'}">${s.han ? `Mốc ${vn(s.han)}` : ''}${s.so_ngay_qua > 0 ? ` · chậm ${s.so_ngay_qua} ngày` : ''}</small>`
    + `${o('Trạng thái', chon)}${rieng}</fieldset>`;
}

export function formCapNhatHtml(r, sp, { trongNgan = true } = {}) {
  const hom = homNayVN();
  return `<form class="nq-form" data-submit="${trongNgan ? 'nqGuiCapNhat' : 'nqGuiCapNhatDong'}" data-id="${r.id}">`
    + (trongNgan ? `<button type="button" class="nq-ve" data-action="nqVeChiTiet">← Chi tiết ${e(r.so_hieu)}</button><h3>Cập nhật tiến độ · ${e(r.so_hieu)}</h3><p class="chu-phu">${e(r.noi_dung)}</p>` : '')
    + `<div class="nq-luoi-form">${o('Ngày báo cáo', `<input type="date" class="o-nhap nho" name="ngay_bao_cao" value="${hom}" max="${hom}" required>`)}`
    + `${o('Nguồn thông tin', '<input type="text" class="o-nhap nho" name="nguon_thong_tin" maxlength="300" placeholder="Văn bản, báo cáo của đơn vị; trao đổi trực tiếp…">')}</div>`
    + '<label class="nq-hop nq-ktd"><input type="checkbox" name="khong_thay_doi"> Không có thay đổi trong tuần</label>'
    + o('Kết quả trong tuần', '<textarea class="o-nhap" name="noi_dung" rows="3" maxlength="6000" placeholder="Nội dung đơn vị tham mưu, chủ trì báo cáo trong tuần"></textarea>', 'rong')
    + o('Kết quả thực hiện (lũy kế — hiện ở Tổng quan và báo cáo)', `<textarea class="o-nhap" name="ket_qua_thuc_hien" rows="4" maxlength="6000">${e(r.ket_qua_thuc_hien || '')}</textarea>`, 'rong')
    + `<div class="nq-sp-forms">${sp.filter((s) => s.trang_thai !== 'KHONG_THUC_HIEN').map(spForm).join('')}</div>`
    + o('Vướng mắc', `<textarea class="o-nhap" name="vuong_mac" rows="2" maxlength="2000" placeholder="Để trống nếu không có">${e(r.vuong_mac || '')}</textarea>`, 'rong')
    + o('Đề xuất', `<textarea class="o-nhap" name="de_xuat" rows="2" maxlength="2000" placeholder="Đề xuất lãnh đạo xem xét, chỉ đạo">${e(r.de_xuat || '')}</textarea>`, 'rong')
    + `<div class="hanh-dong"><button type="submit" class="nut chinh">Lưu cập nhật</button><button type="button" class="nut" data-action="${trongNgan ? 'nqVeChiTiet' : 'nqHuyDong'}">Huỷ</button></div></form>`;
}

// Gom các ô đã đổi → tham số nvq_cap_nhat_gui.
export function docForm(form, r, sp) {
  const f = new FormData(form);
  const gt = (k) => String(f.get(k) ?? '').trim();
  const p = { nhiem_vu_id: r.id, ngay_bao_cao: gt('ngay_bao_cao'), noi_dung: gt('noi_dung'), nguon_thong_tin: gt('nguon_thong_tin'), khong_thay_doi: f.get('khong_thay_doi') === 'on', san_pham: [], so_lieu: [] };
  if (gt('ket_qua_thuc_hien') !== String(r.ket_qua_thuc_hien || '').trim()) p.ket_qua_thuc_hien = gt('ket_qua_thuc_hien');
  if (gt('vuong_mac') !== String(r.vuong_mac || '').trim()) p.vuong_mac = gt('vuong_mac');
  if (gt('de_xuat') !== String(r.de_xuat || '').trim()) p.de_xuat = gt('de_xuat');
  sp.filter((s) => s.trang_thai !== 'KHONG_THUC_HIEN').forEach((s) => {
    const x = { id: s.id }; let doi = false;
    const tt = gt(`tt_${s.id}`); if (tt && tt !== s.trang_thai) { x.trang_thai = tt; doi = true; }
    ['kq_so_ky_hieu', 'kq_ngay', 'kq_co_quan', 'kq_trich_yeu', 'kq_mo_ta'].forEach((k) => { if (f.has(`${k}_${s.id}`) && gt(`${k}_${s.id}`) !== String(s[k] ?? '')) { x[k] = gt(`${k}_${s.id}`); doi = true; } });
    if (doi) { if (x.trang_thai === 'HOAN_THANH' && !x.kq_ngay && f.has(`kq_ngay_${s.id}`) && gt(`kq_ngay_${s.id}`)) x.ngay_hoan_thanh = gt(`kq_ngay_${s.id}`); p.san_pham.push(x); }
    if (s.loai === 'CHI_TIEU' && gt(`so_${s.id}`) !== '') {
      p.so_lieu.push({ san_pham_id: s.id, gia_tri: Number(gt(`so_${s.id}`)), ngay_so_lieu: gt(`ngay_so_${s.id}`) || p.ngay_bao_cao, nguon: gt(`nguon_so_${s.id}`), uoc_tinh: f.get(`uoc_${s.id}`) === 'on' });
    }
  });
  return p;
}

export async function guiForm(form, r, sp, sauKhiGhi) {
  const p = docForm(form, r, sp);
  if (!p.khong_thay_doi && !p.noi_dung && !p.san_pham.length && !p.so_lieu.length && !('ket_qua_thuc_hien' in p) && !('vuong_mac' in p) && !('de_xuat' in p)) {
    notifyError('Ghi nội dung cập nhật, hoặc chọn "Không có thay đổi trong tuần".'); return false;
  }
  const nut = form.querySelector('[type="submit"]'); if (nut) nut.disabled = true;
  try {
    const kq = await guiCapNhat(p);
    notifySuccess(`Đã lưu cập nhật (tuần ${kq?.tuan ?? ''}).`);
    await sauKhiGhi?.();
    return true;
  } catch (err) { notifyError(err.message); if (nut) nut.disabled = false; return false; }
}
