// Phân hệ Nhiệm vụ quý BTV — thao tác trong ngăn chi tiết: cập nhật tiến độ, ý kiến chỉ đạo / trao đổi, tệp, xoá số liệu, sửa nội dung một lần cập nhật,
// rút / khôi phục (căn cứ văn bản điều chỉnh, lý do bắt buộc), đánh giá (chủ trì theo dõi đề xuất, đầu mối chốt), phân công một việc. Ghi xong: nạp lại dữ
// liệu quý + màn đang xem + ngăn (napLaiSauGhi do index.js truyền vào).
import { $ } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { notifyError, notifySuccess } from '../../components/toast.js';
import { nq, guiYKien, xongYKien, taiVaGanTep, goTep, moTep, xoaSoLieu, suaCapNhat, dieuChinh, danhGia, phanCong } from '../../lib/nvq/du-lieu.js';
import { DANH_GIA } from '../../lib/nvq/nhan.js';
import { e, tenNguoi, tenPhong } from './khung.js';
import { ct, veChiTiet, moNhiemVuQuy, coQuyenCapNhat } from './chi-tiet.js';
import { formCapNhatHtml, guiForm } from './cap-nhat-form.js';
import { hoiLyDo } from './hoi.js';

let napLaiSauGhi = async () => {};
export const datNapLai = (fn) => { napLaiSauGhi = fn; };
const sau = async () => { await napLaiSauGhi(); if (ct.id) await moNhiemVuQuy(ct.id); };
const chay = async (viec, thongBao) => { try { await viec(); if (thongBao) notifySuccess(thongBao); await sau(); } catch (err) { notifyError(err.message); } };
const veForm = (html) => { $('nqNganThan').innerHTML = html; $('nqNganThan').scrollTop = 0; $('nqNganThan').querySelector('input,select,textarea')?.focus(); };
const dauForm = (tieuDe) => `<button type="button" class="nq-ve" data-action="nqVeChiTiet">← Chi tiết ${e(ct.du.r.so_hieu)}</button><h3>${e(tieuDe)} · ${e(ct.du.r.so_hieu)}</h3><p class="chu-phu">${e(ct.du.r.noi_dung)}</p>`;

export const HANH_DONG_NGAN = {
  nqVeChiTiet: () => veChiTiet(),
  nqFormCapNhat: () => { if (ct.du && coQuyenCapNhat(ct.du.r)) veForm(formCapNhatHtml(ct.du.r, ct.du.sp)); },
  nqGuiCapNhat: (ds, form) => guiForm(form, ct.du.r, ct.du.sp, sau),
  nqCuonYKien: () => { const s = $('nqPhanYKien'); s?.scrollIntoView({ block: 'start' }); $('nqYKienMoi')?.focus(); },
  nqTraLoi: ({ id }) => { const f = document.querySelector(`form[data-tra-loi="${id}"]`); f?.classList.toggle('hidden'); f?.querySelector('textarea')?.focus(); },
  nqGuiYKien: (ds, form) => {
    const f = new FormData(form); const nd = String(f.get('noi_dung') || '').trim();
    if (!nd) { notifyError('Ghi nội dung ý kiến.'); return; }
    const p = { nhiem_vu_id: ct.id, noi_dung: nd, loai: f.get('chi_dao') === 'on' ? 'CHI_DAO' : 'TRAO_DOI', tra_loi_cho: form.dataset.traLoi || null, han_tra_loi: f.get('han_tra_loi') || null };
    return chay(() => guiYKien(p), 'Đã gửi ý kiến.');
  },
  nqXongYKien: ({ id }) => chay(() => xongYKien(id), 'Đã đánh dấu đã xử lý.'),
  nqMoTep: async ({ duong }) => { try { window.open(await moTep(duong), '_blank', 'noopener'); } catch (err) { notifyError(err.message); } },
  nqGoTep: async ({ id }) => chay(() => goTep(id), 'Đã gỡ tệp.'),
  nqXoaSoLieu: async ({ id }) => {
    const ly = await hoiLyDo({ tieuDe: 'Xoá số liệu', moTa: 'Số liệu thực hiện của chỉ tiêu được tính lại theo số liệu còn lại.' });
    if (ly) await chay(() => xoaSoLieu(id, ly), 'Đã xoá số liệu.');
  },
  nqSuaCapNhat: ({ id }) => {
    const c = ct.du.capNhat.find((x) => x.id === id); if (!c) return;
    veForm(`${dauForm('Sửa nội dung cập nhật')}<form class="nq-form" data-submit="nqLuuSuaCapNhat" data-id="${id}">`
      + ['noi_dung|Kết quả trong tuần|6000', 'vuong_mac|Vướng mắc|2000', 'de_xuat|Đề xuất|2000'].map((x) => { const [k, n, m] = x.split('|'); return `<label class="nq-o-form rong"><span>${n}</span><textarea class="o-nhap" name="${k}" rows="3" maxlength="${m}">${e(c[k] || '')}</textarea></label>`; }).join('')
      + `<label class="nq-o-form rong"><span>Nguồn thông tin</span><input class="o-nhap nho" name="nguon_thong_tin" maxlength="300" value="${e(c.nguon_thong_tin || '')}"></label>`
      + '<div class="hanh-dong"><button type="submit" class="nut chinh">Lưu</button><button type="button" class="nut" data-action="nqVeChiTiet">Huỷ</button></div></form>');
  },
  nqLuuSuaCapNhat: async (ds, form) => {
    const c = ct.du.capNhat.find((x) => x.id === form.dataset.id); const f = new FormData(form);
    const ly = c?.tao_boi !== state.user?.id ? await hoiLyDo({ tieuDe: 'Sửa cập nhật của đồng chí khác', moTa: `Người ghi: ${tenNguoi(c?.tao_boi)}.` }) : null;
    if (c?.tao_boi !== state.user?.id && !ly) return;
    await chay(() => suaCapNhat(form.dataset.id, Object.fromEntries(['noi_dung', 'vuong_mac', 'de_xuat', 'nguon_thong_tin'].map((k) => [k, String(f.get(k) || '')])), ly), 'Đã sửa nội dung cập nhật.');
  },
  nqDieuChinh: ({ loai }) => {
    const vb = nq.vanBan.filter((v) => v.ky_id === ct.du.r.ky_id);
    veForm(`${dauForm(loai === 'RUT' ? 'Rút khỏi danh mục' : 'Khôi phục vào danh mục')}<form class="nq-form" data-submit="nqLuuDieuChinh" data-loai="${loai}">`
      + `<label class="nq-o-form rong"><span>Căn cứ văn bản</span><select class="o-nhap nho" name="van_ban"><option value="">— Không ghi —</option>${vb.map((v) => `<option value="${v.id}"${v.loai === 'DIEU_CHINH' ? ' selected' : ''}>${e(v.so_ky_hieu)}</option>`).join('')}</select></label>`
      + `<label class="nq-o-form rong"><span>Lý do</span><textarea class="o-nhap" name="ly_do" rows="3" maxlength="500" required></textarea></label>`
      + `<p class="chu-phu">${loai === 'RUT' ? 'Nhiệm vụ rút khỏi danh mục không tính vào số liệu, không cập nhật được; vẫn xem được.' : 'Nhiệm vụ trở lại danh mục và được tính vào số liệu.'}</p>`
      + `<div class="hanh-dong"><button type="submit" class="nut chinh">${loai === 'RUT' ? 'Rút khỏi danh mục' : 'Khôi phục'}</button><button type="button" class="nut" data-action="nqVeChiTiet">Huỷ</button></div></form>`);
  },
  nqLuuDieuChinh: (ds, form) => { const f = new FormData(form); return chay(() => dieuChinh(ct.id, form.dataset.loai, f.get('van_ban') || null, String(f.get('ly_do') || '')), 'Đã lưu điều chỉnh.'); },
  nqFormDanhGia: () => {
    const r = ct.du.r; const ql = nq.quyen.quan_ly; const hien = r.danh_gia || r.danh_gia_de_xuat || '';
    veForm(`${dauForm(ql ? 'Đánh giá kết quả' : 'Đề xuất đánh giá')}<form class="nq-form" data-submit="nqLuuDanhGia">`
      + `<fieldset class="nq-chon-muc"><legend>Mức đánh giá</legend>${Object.entries(DANH_GIA).map(([k, t]) => `<label class="nq-hop"><input type="radio" name="muc" value="${k}"${k === hien ? ' checked' : ''} required> ${e(t)}</label>`).join('')}</fieldset>`
      + `<label class="nq-o-form rong"><span>Lý do, nguyên nhân (bắt buộc khi chưa hoàn thành, không đánh giá hoặc chậm tiến độ)</span><textarea class="o-nhap" name="ly_do" rows="3" maxlength="500">${e(r.danh_gia_ly_do || '')}</textarea></label>`
      + `<label class="nq-hop"><input type="checkbox" name="chuyen"${r.chuyen_ky_sau ? ' checked' : ''}> Chuyển sang quý sau (khi chưa hoàn thành)</label>`
      + `<div class="hanh-dong"><button type="submit" class="nut chinh">${ql ? 'Lưu đánh giá' : 'Gửi đề xuất'}</button><button type="button" class="nut" data-action="nqVeChiTiet">Huỷ</button></div></form>`);
  },
  nqLuuDanhGia: (ds, form) => { const f = new FormData(form); return chay(() => danhGia(ct.id, f.get('muc'), String(f.get('ly_do') || ''), nq.quyen.quan_ly, f.get('chuyen') === 'on'), 'Đã lưu đánh giá.'); },
  nqFormPhanCong: () => {
    const r = ct.du.r;
    const canBo = state.accounts.filter((a) => a.role_group !== 'A0' && !a.is_system).sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
    const phong = [...new Set(canBo.map((a) => a.department).filter((p) => p && p !== 'LANH_DAO_VAN_PHONG'))];
    veForm(`${dauForm('Phân công chủ trì theo dõi')}<form class="nq-form" data-submit="nqLuuPhanCong">`
      + `<label class="nq-o-form rong"><span>Chủ trì theo dõi</span><select class="o-nhap nho" name="chu_tri"><option value="">— Chưa phân công —</option>${canBo.map((a) => `<option value="${a.id}"${a.id === r.chu_tri_theo_doi ? ' selected' : ''}>${e(a.full_name)} (${e(tenPhong(a.department))})</option>`).join('')}</select></label>`
      + `<label class="nq-o-form rong"><span>Phối hợp theo dõi (giữ Ctrl để chọn nhiều)</span><select class="o-nhap" name="phoi_hop" multiple size="6">${canBo.map((a) => `<option value="${a.id}"${(r.phoi_hop_theo_doi || []).includes(a.id) ? ' selected' : ''}>${e(a.full_name)}</option>`).join('')}</select></label>`
      + `<label class="nq-o-form rong"><span>Phòng theo dõi (cán bộ của phòng cùng cập nhật)</span><select class="o-nhap nho" name="phong"><option value="">— Không —</option>${phong.map((p) => `<option value="${p}"${p === r.phong_theo_doi ? ' selected' : ''}>${e(tenPhong(p))}</option>`).join('')}</select></label>`
      + '<label class="nq-o-form rong"><span>Lý do (bắt buộc khi đổi người đang chủ trì)</span><textarea class="o-nhap" name="ly_do" rows="2" maxlength="500"></textarea></label>'
      + '<div class="hanh-dong"><button type="submit" class="nut chinh">Lưu phân công</button><button type="button" class="nut" data-action="nqVeChiTiet">Huỷ</button></div></form>');
  },
  nqLuuPhanCong: (ds, form) => {
    const f = new FormData(form);
    return chay(() => phanCong([ct.id], { chu_tri: f.get('chu_tri') || null, phoi_hop: f.getAll('phoi_hop'), phong: f.get('phong') || null }, String(f.get('ly_do') || '')), 'Đã lưu phân công.');
  },
};

// Chọn tệp ở nút "Đính kèm tệp" (ô file ẩn trong nhãn) → tải lên, gắn vào nhiệm vụ.
export async function khiChonTep(input) {
  const tep = input.files?.[0]; if (!tep || !ct.id) return;
  if (tep.size > 10 * 1024 * 1024) { notifyError('Tệp quá 10 MB.'); input.value = ''; return; }
  await chay(() => taiVaGanTep(ct.id, tep), `Đã đính kèm tệp ${tep.name}.`);
}
