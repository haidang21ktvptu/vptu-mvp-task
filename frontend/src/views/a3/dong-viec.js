// Một dòng bảng "Việc của tôi" (v3.25, mẫu Main 16/10/2026): STT | Nhiệm vụ | Văn bản giao | Thời gian giao | Hạn xử lý | Trạng thái | Việc cần
// làm, rồi khối thao tác dưới dòng (khoi-viec.js, ẩn tới khi mở). Dòng #vct-<id> mang data-nhiem-vu (phanHoiThe tìm việc qua thuộc tính này),
// data-viec (việc cần làm), data-kieu (nhóm ưu tiên — tu-choi | moi | chi-dao | minh-chung | dang-lam | theo-doi | xong | xem), data-muc,
// data-nhom, data-de-nghi khi đã đề nghị từ chối. Bấm nội dung → ngăn chi tiết dùng chung. Tên lớp viết nguyên văn (Tailwind giữ lớp).
import { escapeHtml } from '../../lib/dom.js';
import { findAccount } from '../../lib/state.js';
import { lopMep } from '../../lib/kl/nhan.js';
import { nhanDoKhanHtml } from '../../lib/kl/do-khan.js';
import { hanO, trangThaiO, gioVN, vanBanNgan } from '../../lib/kl/bang-o.js';
import { viecCanLam, vaiCua, chuaNhan } from '../../lib/kl/viec-toi.js';
import { laViecMoi } from '../../lib/kl/loc-them.js';
import { chiXem } from '../../lib/kl/pham-vi.js';
import { NHAN_CHI_XEM } from '../shared/kl/dong.js';
import { deNghiCuaToi } from '../shared/dieu-hanh/du-lieu.js';
import { KIEU_KHOI, khoiHtml, ghiChuHtml } from './khoi-viec.js';

const nutKhoi = (r, kieu, chu, chinh, mo) => `<button type="button" class="nut${chinh ? ' lam' : ''}" data-action="vctMoKhoi" data-id="${r.id}" data-kieu="${kieu}" aria-expanded="${String(mo)}" aria-controls="vctKhoi-${r.id}">${chu}</button>`;
function viecHtml(r, v, mo, ro) {
  switch (v.ma) {
    case 'nhan': return `<button type="button" class="nut lam" data-action="xacNhanNhanThe" data-id="${r.id}">Xác nhận đã nhận việc</button>${nutKhoi(r, 'tu-choi', 'Từ chối', false, mo)}`;
    case 'tra-loi': return nutKhoi(r, 'tra-loi', 'Trả lời chỉ đạo', true, mo);
    case 'nop': return nutKhoi(r, 'nop', 'Nộp minh chứng', v.chinh, mo);
    case 'cap-nhat': return `<button type="button" class="nut" data-action="capNhatThe" data-id="${r.id}">Cập nhật tiến độ</button>`;
    case 'cho-giao-lai': return '<span class="bnv-phu">Chờ lãnh đạo giao lại</span>';
    case 'cho-duyet': return '<span class="bnv-phu">Chờ duyệt đề nghị từ chối</span>';
    default: return `<span class="bnv-phu">${ro ? 'Chỉ xem' : 'Không có việc chờ'}</span>`;
  }
}

// o = { stt, homNay, now, ctx, kieu (nhóm ưu tiên), khoi: { id, kieu } đang mở | null }.
export function dongViecHtml(r, o) {
  const me = o.ctx.me; const ro = chiXem(r);
  const v = ro ? { ma: '', chinh: false } : viecCanLam(r, o.ctx);
  const kieuKhoi = KIEU_KHOI[v.ma]; const mo = Boolean(kieuKhoi) && o.khoi?.id === r.id && o.khoi?.kieu === kieuKhoi;
  const lop = lopMep(r, me); const tt = trangThaiO(r, me); const han = hanO(r, o.homNay); const g = gioVN(r.created_at); const vb = vanBanNgan(r);
  const vai = vaiCua(r, me); const nguoiGiao = findAccount(r.tao_boi)?.full_name;
  const dau = [`<span class="ma">${escapeHtml(r.ma)}</span>`, vai ? `<span class="bnv-nhan ${vai === 'Chủ trì theo dõi' ? 'vai' : 'xam'}">${vai}</span>` : '',
    nhanDoKhanHtml(r.do_khan), r.uu_tien === 'THUONG_TRUC' ? '<span class="nhan-tt">Thường trực giao</span>' : '',
    laViecMoi(r, o.now) ? '<span class="bnv-nhan moi" title="Giao trong 24 giờ qua">Mới</span>' : '', ro ? NHAN_CHI_XEM : ''].join('');
  const trangThai = r.bi_tu_choi && r.tien_do_ma !== 'HOAN_THANH'
    ? `<span class="nhan-tu-choi">${v.ma === 'cho-giao-lai' ? 'Đã đồng ý từ chối, chờ giao lại' : 'Bị từ chối, chờ giao lại'}</span>`
    : `<span class="trang-thai ${tt.lop}">${escapeHtml(tt.chu)}</span>`;
  const sp = [r.san_pham_ten, r.san_pham_mo_ta].filter(Boolean).join(': ');
  return `<div class="bnv-dong ${lop}" id="vct-${r.id}" data-nhiem-vu="${r.id}" data-viec="${v.ma}" data-kieu="${escapeHtml(o.kieu || '')}" data-muc="${escapeHtml(r.muc_canh_bao || '')}" data-nhom="${escapeHtml(r.nhom_dem || '')}"${deNghiCuaToi(r.id) ? ' data-de-nghi="1"' : ''}${ro ? ' data-chi-xem="1"' : ''}>
    <div class="bnv-hang">
      <span class="bnv-c bnv-c-stt">${o.stt}</span>
      <div class="bnv-c bnv-c-nv"><span class="bnv-dong1">${dau}</span>
        <button type="button" class="bnv-nd${chuaNhan(r, me) ? ' dam' : ''}" data-action="nganMoViec" data-id="${r.id}" title="Bấm để xem chi tiết">${escapeHtml(r.noi_dung)}</button>
        ${sp ? `<span class="bnv-phu">Sản phẩm đầu ra: ${escapeHtml(sp)}</span>` : ''}<span class="bnv-phu bnv-chi-gon">Giao ${g.gio} ${g.ngay}</span></div>
      <div class="bnv-c" data-nhan="Văn bản giao"><span class="bnv-vb">${escapeHtml(vb.ten)}</span>${nguoiGiao ? `<span class="bnv-phu">${escapeHtml(nguoiGiao)} giao</span>` : ''}</div>
      <div class="bnv-c bnv-c-tg" data-nhan="Thời gian giao"><span>${g.ngay}</span><span class="bnv-phu">${g.gio}</span></div>
      <div class="bnv-c han" data-nhan="Hạn xử lý"><b>${escapeHtml(han.ngay)}</b><span>${escapeHtml(han.chu)}</span></div>
      <div class="bnv-c bnv-c-tt" data-nhan="Trạng thái">${trangThai}${ghiChuHtml(r)}</div>
      <div class="bnv-c bnv-c-viec" data-nhan="Việc cần làm">${viecHtml(r, v, mo, ro)}</div>
    </div>${kieuKhoi ? khoiHtml(r, kieuKhoi, o.homNay, mo) : ''}</div>`;
}

// Hàng nhóm "Nhóm theo văn bản giao": văn bản · trích yếu · số việc của cả nhóm (tong — nhóm vắt sang trang sau).
export const nhomHtml = (g, trichYeu, tong = g.rows.length) => `<div class="bnv-nhom"><span><b>${escapeHtml(vanBanNgan(g.r).ten)}</b>${trichYeu ? `<span>${escapeHtml(trichYeu)}</span>` : ''}<span class="bnv-phu">${tong} việc</span></span></div>`;
