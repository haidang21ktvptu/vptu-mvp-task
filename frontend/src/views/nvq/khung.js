// Phân hệ Nhiệm vụ quý BTV (v3.35): phần dùng chung của các màn — đầu trang (tên màn, chọn quý, dòng căn cứ và tuần báo cáo), tên người / phòng /
// đơn vị / lãnh đạo, nhãn trạng thái, ô số, dải "có thay đổi mới". Tên lớp viết nguyên văn (Tailwind cắt lớp ghép chuỗi).
import { escapeHtml } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { homNayVN } from '../../lib/kl/ngay.js';
import { nq } from '../../lib/nvq/du-lieu.js';
import { tenKy, tenTrangThai, lopTrangThai, ghiMoc, VAI_TRO_DON_VI } from '../../lib/nvq/nhan.js';
import { tuanCua } from '../../lib/nvq/tinh.js';

export const e = escapeHtml;
export const vn = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
export const vnNgan = (iso) => (iso ? iso.split('-').slice(1).reverse().join('/') : '');
export const tenNguoi = (id) => state.accounts.find((a) => a.id === id)?.full_name || (id === state.user?.id ? state.user.full_name : 'Cán bộ');
export const tenPhong = (ma) => DEPT_NAMES[ma] || ma || '';
export const tenChuTri = (r) => (r.chu_tri_theo_doi ? tenNguoi(r.chu_tri_theo_doi) : r.phong_theo_doi ? tenPhong(r.phong_theo_doi) : 'Chưa phân công');
export const tenDonVi = (r, vaiTro = 'CHU_TRI') => (r.don_vi || []).filter((d) => !vaiTro || (d.vai_tro || 'CHU_TRI') === vaiTro)
  .map((d) => nq.donVi.find((x) => x.ma === d.ma)?.ten).filter(Boolean).join(', ') || r.don_vi_text || 'Chưa xác định';
export const donViDayDu = (r) => (r.don_vi || []).map((d) => `${nq.donVi.find((x) => x.ma === d.ma)?.ten || d.ma} (${VAI_TRO_DON_VI[d.vai_tro || 'CHU_TRI']}${d.cu_the ? `: ${d.cu_the}` : ''})`).join('; ');
export const tenLanhDao = (r) => (r.lanh_dao_ma || []).map((m) => nq.lanhDao.find((l) => l.ma === m)?.ten).filter(Boolean).join('; ') || r.lanh_dao_text || 'Chưa ghi';
export const nhanTrangThai = (r) => `<span class="trang-thai ${lopTrangThai(r)}">${e(tenTrangThai(r))}</span>`;
export const ghiMocHtml = (r) => { const m = ghiMoc(r); return m && r.trang_thai !== 'HOAN_THANH' && r.trang_thai !== 'RUT' ? `<small class="${r.so_ngay_qua > 0 ? 'nq-chu-do' : 'chu-phu'}">${e(m)}</small>` : ''; };
export const laCuaToi = (r) => Boolean(state.user) && (r.chu_tri_theo_doi === state.user.id || (r.phoi_hop_theo_doi || []).includes(state.user.id)
  || (r.phong_theo_doi && r.phong_theo_doi === state.user.department));
export const tuanNay = () => tuanCua(nq.tuans, homNayVN());

// Đầu trang: tiêu đề + chọn quý; dòng phụ: kế hoạch, văn bản điều chỉnh, tuần báo cáo hiện tại và hạn 11h00 thứ Năm.
export function dauTrang(tieuDe, { nut = '' } = {}) {
  const k = nq.ky;
  const chon = nq.kys.length > 1
    ? `<label class="nq-chon-ky"><span class="sr">Chọn quý</span><select class="o-nhap nho" data-nq-chon-ky>${nq.kys.map((x) => `<option value="${x.id}"${x.id === k?.id ? ' selected' : ''}>${e(tenKy(x))}</option>`).join('')}</select></label>`
    : '';
  const vb = nq.vanBan.map((v) => `${v.loai === 'KE_HOACH' ? 'Kế hoạch' : v.loai === 'DIEU_CHINH' ? 'điều chỉnh theo' : ''} ${v.so_ky_hieu}${v.ngay ? ` ngày ${vn(v.ngay)}` : ''}`.trim());
  const w = tuanNay();
  const phu = k ? [vb.length ? `Căn cứ: ${vb.join('; ')}` : '', w ? `Tuần ${w.so} (${vnNgan(w.tu_ngay)} – ${vn(w.den_ngay)}) · hạn báo cáo 11h00 thứ Năm ${vnNgan(w.den_ngay)}${w.trang_thai === 'DA_CHOT' ? ' · đã chốt' : ''}` : '',
    k.trang_thai === 'DA_CHOT' ? 'Quý đã chốt — chỉ xem' : ''].filter(Boolean).join(' · ') : '';
  return `<div class="dau nq-dau"><div><h1>${e(tieuDe)}${k ? ` <span class="nq-ten-ky">${e(tenKy(k))}</span>` : ''}</h1>${phu ? `<p class="chu-phu nq-can-cu">${e(phu)}</p>` : ''}</div>`
    + `<div class="nq-dau-nut">${chon}${nut}</div></div><div id="nqCoMoi" class="nq-co-moi hidden" role="status">Có cập nhật mới của các đồng chí chủ trì theo dõi. <button type="button" class="nut nho" data-action="nqNapLai">Nạp lại</button></div>`;
}
export const chuaCoKy = (laQuanLy) => `<div class="trong nq-trong"><p>Chưa có quý nào được tạo trong phân hệ Nhiệm vụ quý của Ban Thường vụ.</p>${laQuanLy
  ? '<button type="button" class="nut chinh" data-action="openNqQuanLy">Tạo quý và nhập danh mục</button>' : '<p class="chu-phu">Đầu mối tổng hợp của Văn phòng sẽ tạo quý và nhập danh mục.</p>'}</div>`;

// Ô số (một hàng, bấm được): [{ khoa, nhan, so, lop }] → nút có data-action.
export function oSo(ds, action, dangChon = '') {
  return `<div class="nq-o-so" role="group">${ds.map((x) => `<button type="button" class="nq-o ${x.lop || ''}${dangChon === x.khoa ? ' chon' : ''}" data-action="${action}" data-loc="${e(x.khoa)}" aria-pressed="${dangChon === x.khoa}">`
    + `<b>${x.so}</b><span>${e(x.nhan)}</span></button>`).join('')}</div>`;
}
// Thanh tiến độ xếp chồng: [{ so, lop, nhan }] trên tổng.
export function thanh(phan, tong) {
  if (!tong) return '<div class="nq-thanh"></div>';
  return `<div class="nq-thanh" role="img" aria-label="${e(phan.filter((x) => x.so).map((x) => `${x.so} ${x.nhan}`).join(', '))}">${phan.filter((x) => x.so)
    .map((x) => `<span class="${x.lop}" style="width:${(100 * x.so) / tong}%"></span>`).join('')}</div>`;
}
export const linkNv = (r, chu) => `<button type="button" class="nq-link" data-action="nqMo" data-id="${r.id}">${e(chu ?? r.so_hieu)}</button>`;
export const rutGon = (s, n = 160) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
export const thoiGian = (ts) => (ts ? new Date(ts).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
