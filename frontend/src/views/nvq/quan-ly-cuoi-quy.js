// Phân hệ Nhiệm vụ quý BTV — Cuối quý (đầu mối tổng hợp): bảng đánh giá từng nhiệm vụ (đề xuất của chủ trì theo dõi → mức chốt; điền sẵn theo trạng thái như
// nvq_danh_gia_goi_y), chốt quý (nhiệm vụ chưa đánh giá nhận mức theo đề xuất / trạng thái — 0139), mở lại quý, chuyển nhiệm vụ chưa hoàn thành sang quý sau.
import { notifyError, notifySuccess } from '../../components/toast.js';
import { nq, danhGia, chotKy, moLaiKy, chuyenKy } from '../../lib/nvq/du-lieu.js';
import { DANH_GIA, tenKy, tenKyNgan, laMa } from '../../lib/nvq/nhan.js';
import { sapXepViTri, trongDanhMuc, soNgayGiua } from '../../lib/nvq/tinh.js';
import { homNayVN } from '../../lib/kl/ngay.js';
import { e, vn, nhanTrangThai, tenChuTri, rutGon, linkNv, tenNguoi, thoiGian } from './khung.js';
import { hoiLyDo } from './hoi.js';

export const goiY = (r) => (r.trang_thai === 'RUT' ? null : r.trang_thai === 'HOAN_THANH' && r.ket_qua === 'CHAM_TIEN_DO' ? 'HOAN_THANH_CHAM'
  : ['HOAN_THANH', 'THUONG_XUYEN'].includes(r.trang_thai) ? 'HOAN_THANH' : 'CHUA_HOAN_THANH');
const CAN_LY_DO = ['HOAN_THANH_CHAM', 'CHUA_HOAN_THANH', 'KHONG_DANH_GIA'];
const viTri = (r) => `${laMa(r.truc_so)}.${r.nhom === 'TRONG_CT' ? 1 : 2}.(${r.stt})`;
const kySau = () => nq.kys.filter((k) => k.id !== nq.ky.id && k.trang_thai !== 'DA_CHOT' && k.tu_ngay > nq.ky.den_ngay).sort((a, b) => (a.tu_ngay < b.tu_ngay ? -1 : 1));

export function veCuoiQuy() {
  const k = nq.ky; const daChot = k.trang_thai === 'DA_CHOT';
  const rows = sapXepViTri(trongDanhMuc(nq.rows));
  const muc = (r) => r.danh_gia || r.danh_gia_de_xuat || goiY(r);
  const dem = Object.fromEntries(Object.keys(DANH_GIA).map((m) => [m, rows.filter((r) => muc(r) === m).length]));
  const daDg = rows.filter((r) => r.danh_gia).length; const choChot = rows.filter((r) => !r.danh_gia && r.danh_gia_de_xuat).length;
  const tomTat = `<section class="nq-khoi rong"><h3>Đánh giá kết quả ${e(tenKy(k))}</h3><p>${rows.length} nhiệm vụ trong danh mục · <b>${daDg}</b> đã chốt đánh giá · `
    + `${choChot} có đề xuất của chủ trì theo dõi chờ chốt · ${rows.length - daDg - choChot} chưa có đánh giá (khi chốt quý nhận mức theo trạng thái).</p>`
    + `<p>Dự kiến: ${Object.entries(DANH_GIA).map(([m, t]) => `${e(t)}: <b>${dem[m]}</b>`).join(' · ')}.</p></section>`;
  const hang = rows.map((r) => {
    const gt = muc(r);
    const chuaXong = !['HOAN_THANH', 'THUONG_XUYEN'].includes(r.trang_thai);
    const o = daChot ? `<b>${e(DANH_GIA[r.danh_gia] || '—')}</b>${r.danh_gia_ly_do ? `<small class="chu-phu">${e(r.danh_gia_ly_do)}</small>` : ''}${r.chuyen_ky_sau ? '<small>Chuyển quý sau</small>' : ''}`
      : `<form class="nq-dg-dong" data-submit="nqLuuDanhGiaDong" data-id="${r.id}"><select class="o-nhap nho" name="muc" aria-label="Mức đánh giá ${viTri(r)}">`
        + `${Object.entries(DANH_GIA).map(([m, t]) => `<option value="${m}"${m === gt ? ' selected' : ''}>${e(t)}</option>`).join('')}</select>`
        + `<input class="o-nhap nho" name="ly_do" maxlength="500" value="${e(r.danh_gia_ly_do || '')}" placeholder="Lý do, nguyên nhân" aria-label="Lý do ${viTri(r)}">`
        + (chuaXong ? `<label class="nq-hop"><input type="checkbox" name="chuyen"${r.chuyen_ky_sau ? ' checked' : ''}> Chuyển quý sau</label>` : '')
        + `<button type="submit" class="nut nho${r.danh_gia ? '' : ' chinh'}">${r.danh_gia ? 'Sửa' : 'Chốt'}</button></form>`;
    return `<tr><td data-nhan="Vị trí">${linkNv(r, viTri(r))}</td><td class="nq-nd" data-nhan="Nhiệm vụ">${e(rutGon(r.noi_dung, 200))}<small class="chu-phu">${e(tenChuTri(r))}</small></td>`
      + `<td data-nhan="Trạng thái">${nhanTrangThai(r)}<small class="chu-phu">${r.so_xong ?? 0}/${r.so_san_pham ?? 0} kết quả, sản phẩm</small></td>`
      + `<td data-nhan="Đề xuất">${r.danh_gia_de_xuat ? e(DANH_GIA[r.danh_gia_de_xuat]) : '<span class="chu-phu">—</span>'}</td>`
      + `<td data-nhan="Đánh giá chốt">${o}</td></tr>`;
  }).join('');
  const bang = `<section class="nq-khoi rong"><div class="nq-bang-cuon"><table class="nq-bang nq-bang-dg"><thead><tr><th>Vị trí</th><th>Nhiệm vụ</th><th>Trạng thái</th>`
    + `<th>Đề xuất của chủ trì theo dõi</th><th>Đánh giá chốt</th></tr></thead><tbody>${hang}</tbody></table></div></section>`;
  const conNgay = soNgayGiua(homNayVN(), k.den_ngay);
  const chot = daChot
    ? `<section class="nq-khoi rong"><h3>Đã chốt quý</h3><p>${e(tenNguoi(k.chot_boi))} chốt lúc ${thoiGian(k.chot_luc)}.${k.chot_nhan_xet ? ` Nhận xét: ${e(k.chot_nhan_xet)}` : ''}</p>`
      + '<button type="button" class="nut" data-action="nqMoLaiKy">Mở lại quý</button></section>'
    : `<section class="nq-khoi rong"><h3>Chốt quý</h3><p class="chu-phu">Chốt quý: nhiệm vụ chưa chốt đánh giá nhận mức theo đề xuất hoặc theo trạng thái; sau khi chốt không cập nhật được nữa (mở lại phải ghi lý do). `
      + `${conNgay > 31 ? `Chỉ chốt được trong tháng cuối quý (còn ${conNgay} ngày đến hết quý).` : ''}</p>`
      + `<form class="nq-form" data-submit="nqChotKy"><label class="nq-o-form rong"><span>Nhận xét chung (đưa vào báo cáo quý)</span><textarea class="o-nhap" name="nhan_xet" rows="3" maxlength="4000"></textarea></label>`
      + `<button type="submit" class="nut chinh"${conNgay > 31 ? ' disabled' : ''}>Chốt ${e(tenKyNgan(k))}</button></form></section>`;
  const chuyen = rows.filter((r) => r.chuyen_ky_sau);   // đã chuyển rồi: hàm CSDL bỏ qua (không tạo trùng)
  const dsSau = kySau();
  const phanChuyen = `<section class="nq-khoi rong"><h3>Chuyển nhiệm vụ chưa hoàn thành sang quý sau</h3>`
    + (!chuyen.length ? '<p class="chu-phu">Chưa có nhiệm vụ đánh dấu "Chuyển quý sau".</p>'
      : `<ul class="nq-ds">${chuyen.map((r) => `<li>${linkNv(r, viTri(r))} ${e(rutGon(r.noi_dung, 140))}</li>`).join('')}</ul>`
        + (dsSau.length ? `<form class="nq-form" data-submit="nqChuyenKy"><label class="nq-o-form"><span>Sang quý</span><select class="o-nhap nho" name="ky_moi">${dsSau.map((x) => `<option value="${x.id}">${e(tenKy(x))}</option>`).join('')}</select></label>`
          + `<button type="submit" class="nut chinh">Chuyển ${chuyen.length} nhiệm vụ</button><p class="chu-phu">Mỗi nhiệm vụ thành một nhiệm vụ mới ở quý sau (giữ liên kết, chủ trì theo dõi, kết quả đã cập nhật; chỉ chép kết quả, sản phẩm chưa xong).</p></form>`
          : '<p>Tạo quý sau ở thẻ "Quý, văn bản căn cứ" rồi chuyển.</p>'))
    + '</section>';
  return tomTat + bang + chot + phanChuyen + (daChot ? '' : `<p class="chu-phu">Hết quý: ${vn(k.den_ngay)}.</p>`);
}

export function hanhDongCuoiQuy(veLai, napLaiSauGhi) {
  const chay = async (viec, tb) => { try { const kq = await viec(); notifySuccess(typeof tb === 'function' ? tb(kq) : tb); await napLaiSauGhi(); } catch (err) { notifyError(err.message); } };
  return {
    nqLuuDanhGiaDong: (ds, form) => {
      const f = new FormData(form); const m = f.get('muc'); const ly = String(f.get('ly_do') || '').trim();
      if (CAN_LY_DO.includes(m) && !ly) { notifyError(`Ghi lý do, nguyên nhân khi đánh giá "${DANH_GIA[m]}".`); form.querySelector('[name="ly_do"]')?.focus(); return undefined; }
      return chay(() => danhGia(form.dataset.id, m, ly, true, f.get('chuyen') === 'on'), 'Đã chốt đánh giá.');
    },
    nqChotKy: (ds, form) => chay(() => chotKy(nq.ky.id, String(new FormData(form).get('nhan_xet') || '')),
      (kq) => `Đã chốt quý: ${kq.hoan_thanh} hoàn thành, ${kq.hoan_thanh_cham} hoàn thành nhưng chậm tiến độ, ${kq.chua_hoan_thanh} chưa hoàn thành.`),
    nqMoLaiKy: async () => {
      const ly = await hoiLyDo({ tieuDe: `Mở lại ${tenKy(nq.ky)}`, moTa: 'Quý mở lại thì được cập nhật, đánh giá lại; cần chốt lại khi xong.', nutXacNhan: 'Mở lại quý' });
      if (ly) await chay(() => moLaiKy(nq.ky.id, ly), 'Đã mở lại quý.');
    },
    nqChuyenKy: (ds, form) => {
      const ids = trongDanhMuc(nq.rows).filter((r) => r.chuyen_ky_sau).map((r) => r.id);
      return chay(() => chuyenKy(ids, new FormData(form).get('ky_moi')), (n) => (n ? `Đã chuyển ${n} nhiệm vụ sang quý sau.` : 'Các nhiệm vụ này đã được chuyển trước đó.'));
    },
  };
}
