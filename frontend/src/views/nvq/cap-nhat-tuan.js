// Phân hệ Nhiệm vụ quý BTV — "Cập nhật tuần": nơi làm việc của CHỦ TRÌ THEO DÕI (người cập nhật chính). Đầu trang: tuần báo cáo, hạn 11h00 thứ Năm, số
// nhiệm vụ đã / chưa báo cáo tuần này. Danh sách việc mình theo dõi (chủ trì, phối hợp, phòng được giao) — Trưởng phòng xem cả phòng, đầu mối / lãnh đạo Văn
// phòng xem tất cả; xếp "chưa báo cáo tuần này" trước. Mỗi việc: kết quả mới nhất, kết quả / sản phẩm, nút "Cập nhật" (biểu mẫu mở ngay dưới) và "Không có
// thay đổi trong tuần" (một bấm).
import { $ } from '../../lib/dom.js';
import { state, findAccount } from '../../lib/state.js';
import { notifyError, notifySuccess } from '../../components/toast.js';
import { nq, guiCapNhat } from '../../lib/nvq/du-lieu.js';
import { spTheoNv, sapXepViTri, laMo } from '../../lib/nvq/tinh.js';
import { duocCapNhat, laNguoiTheoDoi } from '../../lib/nvq/quyen.js';
import { e, vn, vnNgan, dauTrang, chuaCoKy, nhanTrangThai, ghiMocHtml, tuanNay, rutGon, thoiGian, tenChuTri } from './khung.js';
import { spMiniHtml } from './dong.js';
import { formCapNhatHtml, guiForm } from './cap-nhat-form.js';

const tt = { phamVi: 'toi', mo: null };
const timPhong = (id) => findAccount(id)?.department || null;
const coCapNhat = (r) => duocCapNhat(r, state.user, nq.quyen, timPhong, nq.ky);

function dongCuaPhamVi() {
  const u = state.user;
  return nq.rows.filter((r) => r.trang_thai !== 'RUT' && (tt.phamVi === 'tat-ca' ? true
    : tt.phamVi === 'phong' ? coCapNhat(r) && (laNguoiTheoDoi(r, u) || [r.chu_tri_theo_doi, ...(r.phoi_hop_theo_doi || [])].some((id) => timPhong(id) === u.department))
      : laNguoiTheoDoi(r, u)));
}

function theHtml(r, spMap) {
  const coQuyen = coCapNhat(r);
  const moForm = tt.mo === r.id;
  return `<article class="nq-the ${r.cap_nhat_tuan_nay || !laMo(r) ? '' : 'chua'}" id="nqThe-${r.id}"><div class="nq-the-dau">`
    + `<button type="button" class="nq-link" data-action="nqMo" data-id="${r.id}"><b>${e(r.so_hieu)}</b></button> ${nhanTrangThai(r)}${ghiMocHtml(r)}`
    + `${laMo(r) ? `<span class="${r.cap_nhat_tuan_nay ? 'nq-chu-luc' : 'nq-chu-vang'}">${r.cap_nhat_tuan_nay ? 'Đã báo cáo tuần này' : 'Chưa báo cáo tuần này'}</span>` : ''}</div>`
    + `<p class="nq-the-nd">${e(rutGon(r.noi_dung, 260))}</p><p class="chu-phu">Đơn vị tham mưu, chủ trì: ${e(rutGon(r.don_vi_text || '', 120))}${tt.phamVi !== 'toi' ? ` · Chủ trì theo dõi: ${e(tenChuTri(r))}` : ''}</p>`
    + spMiniHtml(spMap.get(r.id) || [])
    + `<div class="nq-the-kq"><b>Kết quả thực hiện:</b> ${r.ket_qua_thuc_hien ? `${e(rutGon(r.ket_qua_thuc_hien, 300))} <small class="chu-phu">(${thoiGian(r.ket_qua_luc)})</small>` : '<span class="chu-phu">chưa cập nhật</span>'}</div>`
    + (coQuyen && !moForm ? `<div class="hanh-dong"><button type="button" class="nut chinh" data-action="nqMoFormDong" data-id="${r.id}">Cập nhật</button>`
      + `${laMo(r) && !r.cap_nhat_tuan_nay ? `<button type="button" class="nut" data-action="nqKhongDoi" data-id="${r.id}">Không có thay đổi trong tuần</button>` : ''}</div>` : '')
    + (moForm ? `<div class="nq-the-form">${formCapNhatHtml(r, spMap.get(r.id) || [], { trongNgan: false })}</div>` : '')
    + '</article>';
}

export async function veCapNhatTuan(el, ds = {}) {
  if (ds.phamVi) tt.phamVi = ds.phamVi;
  if (!nq.ky) { el.innerHTML = dauTrang('Cập nhật tuần') + chuaCoKy(nq.quyen.quan_ly); return; }
  const w = tuanNay();
  const rows = sapXepViTri(dongCuaPhamVi());
  const mo = rows.filter(laMo); const da = mo.filter((r) => r.cap_nhat_tuan_nay);
  const spMap = spTheoNv(nq.sp);
  const nhomChua = mo.filter((r) => !r.cap_nhat_tuan_nay); const nhomDa = da; const nhomXong = rows.filter((r) => !laMo(r));
  const u = state.user;
  const chip = [['toi', 'Việc tôi theo dõi'], ...(u?.role_group === 'A2' ? [['phong', 'Cả phòng']] : []), ...(nq.quyen.quan_ly || u?.role_group === 'A1' ? [['tat-ca', 'Tất cả nhiệm vụ']] : [])];
  const nhom = (tieuDe, ds2) => (ds2.length ? `<h2 class="nq-nhom-tieu-de">${e(tieuDe)} (${ds2.length})</h2>${ds2.map((r) => theHtml(r, spMap)).join('')}` : '');
  el.innerHTML = dauTrang('Cập nhật tuần')
    + `<section class="nq-tom-tat"><p class="nq-cau">${w ? `Tuần ${w.so} (${vnNgan(w.tu_ngay)} – ${vn(w.den_ngay)}), hạn báo cáo 11h00 thứ Năm ${vnNgan(w.den_ngay)}${w.trang_thai === 'DA_CHOT' ? ' — tuần đã chốt, cập nhật mới tính vào tuần sau' : ''}.` : ''}`
    + ` ${mo.length ? `Đã báo cáo ${da.length}/${mo.length} nhiệm vụ đang thực hiện.` : 'Không có nhiệm vụ đang thực hiện.'}</p>`
    + (chip.length > 1 ? `<div class="nq-chip" role="group" aria-label="Phạm vi">${chip.map(([k, t]) => `<button type="button" class="nut nho${tt.phamVi === k ? ' lam' : ''}" aria-pressed="${tt.phamVi === k}" data-action="nqPhamViTuan" data-pham-vi="${k}">${e(t)}</button>`).join('')}</div>` : '')
    + '</section>'
    + (rows.length ? nhom('Chưa báo cáo tuần này', nhomChua) + nhom('Đã báo cáo tuần này', nhomDa) + nhom('Đã hoàn thành', nhomXong)
      : `<div class="trong"><p>${tt.phamVi === 'toi' ? 'Đồng chí chưa được phân công theo dõi nhiệm vụ quý nào.' : 'Không có nhiệm vụ.'}</p></div>`);
  if (tt.mo) $(`nqThe-${tt.mo}`)?.scrollIntoView({ block: 'nearest' });
}

export function hanhDongTuan(veLai, napLaiSauGhi) {
  return {
    nqPhamViTuan: ({ phamVi }) => { tt.phamVi = phamVi; tt.mo = null; return veLai(); },
    nqMoFormDong: ({ id }) => { tt.mo = id; return veLai(); },
    nqHuyDong: () => { tt.mo = null; return veLai(); },
    nqGuiCapNhatDong: (ds, form) => {
      const r = nq.rows.find((x) => x.id === form.dataset.id);
      return guiForm(form, r, spTheoNv(nq.sp).get(r.id) || [], async () => { tt.mo = null; await napLaiSauGhi(); });
    },
    nqKhongDoi: async ({ id }) => {
      try { await guiCapNhat({ nhiem_vu_id: id, khong_thay_doi: true }); notifySuccess('Đã ghi "Không có thay đổi trong tuần".'); await napLaiSauGhi(); } catch (err) { notifyError(err.message); }
    },
  };
}
