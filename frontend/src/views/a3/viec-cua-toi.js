// Nhóm và vẽ thẻ "Việc của tôi" (A3, mockup): mỗi nhóm một .muc có mép trái theo mức; mỗi việc một dòng với hành động tại chỗ.
// Nhóm: mới giao chưa xác nhận (theo_1400, đang mở) → chỉ đạo chờ tôi trả lời → sắp đến hạn / quá hạn chưa có minh chứng hợp lệ (3 ô nộp
// ngay) → đang thực hiện. Việc tôi theo dõi (không phải Owner) đếm riêng.
import { escapeHtml, formatDateTime } from '../../lib/dom.js';
import { state, findAccount } from '../../lib/state.js';
import { danhMucKl } from '../../lib/kl/du-lieu.js';
import { formatNgay, ghiChuHan, homNayVN } from '../../lib/kl/ngay.js';
import { TEN_LOAI_CHI_DAO } from '../../lib/kl/dieu-hanh.js';
import { dh, timRow, deNghiCuaToi } from '../shared/dieu-hanh/du-lieu.js';

const me = () => state.user?.id;
const mo = (r) => r.tien_do_ma !== 'HOAN_THANH';
const laCuaToi = (r) => r.owner_tai_khoan === me() || r.nguoi_theo_doi === me();
const canNhan = (r) => r.theo_1400 && mo(r) && !r.da_xac_nhan_nhan && laCuaToi(r) && !r.bi_tu_choi;

export function nhomViecCuaToi() {
  const rows = dh.rows.filter(laCuaToi);
  const tuChoi = rows.filter((r) => r.bi_tu_choi && mo(r)); // đề nghị từ chối đã được đồng ý (0034), chờ lãnh đạo giao lại
  const moi = rows.filter(canNhan);
  const chiDao = dh.chiDaoCho.filter((c) => c.nguoi_gui !== me() && timRow(c.nhiem_vu_id) && c.loai !== 'CHI_DAO_TT');
  const daXep = new Set([...tuChoi, ...moi].map((r) => r.id));
  const canMinhChung = rows.filter((r) => !daXep.has(r.id) && mo(r) && ['VANG', 'DO', 'DO_DAC_BIET'].includes(r.muc_canh_bao) && (r.so_minh_chung_hop_le || 0) === 0);
  canMinhChung.forEach((r) => daXep.add(r.id));
  const dangLam = rows.filter((r) => !daXep.has(r.id) && mo(r) && r.owner_tai_khoan === me());
  const theoDoi = rows.filter((r) => mo(r) && r.nguoi_theo_doi === me() && r.owner_tai_khoan !== me());
  return { tuChoi, moi, chiDao, canMinhChung, dangLam, theoDoi };
}

const xem = (r) => `<button type="button" class="nut" data-action="xemDienBien" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">Xem</button>`;

// Việc mới giao: Xác nhận đã nhận / Từ chối (lý do bắt buộc, 0034); đã đề nghị → chờ cấp duyệt, không còn nút.
function dongMoi(r) {
  const dn = deNghiCuaToi(r.id);
  const hanhDong = dn
    ? `<p class="chu-canh-bao-inline">Đã đề nghị từ chối ${formatDateTime(dn.tao_luc)}, chờ ${escapeHtml(findAccount(dn.cap_duyet)?.full_name || 'lãnh đạo trực tiếp')} duyệt.</p><div class="hanh-dong">${xem(r)}</div>`
    : `<div class="hanh-dong"><button type="button" class="nut lam" data-action="xacNhanNhanThe" data-id="${r.id}">Xác nhận đã nhận việc</button>
        <button type="button" class="nut" data-action="moO" data-o="oTc-${r.id}">Từ chối</button>${xem(r)}</div>
      <form class="o" id="oTc-${r.id}" data-submit="deNghiTuChoiThe" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">
        <small>Lý do chỉ lãnh đạo trực tiếp và cấp trên đọc được; hạn và trạng thái việc không đổi cho tới khi được duyệt.</small>
        <input name="noi_dung" required placeholder="Lý do từ chối (bắt buộc)" aria-label="Lý do từ chối">
        <button type="submit" class="nut chinh">Gửi đề nghị</button><button type="button" class="nut" data-action="dongO" data-o="oTc-${r.id}">Huỷ</button></form>`;
  return `<div class="the-con" id="vct-${r.id}"${dn ? ' data-de-nghi="1"' : ''}><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(r.noi_dung)}, hạn ${r.han_xu_ly ? formatNgay(r.han_xu_ly) : 'chưa có'}${r.so_ket_luan ? `, ${escapeHtml(r.so_ket_luan)}` : ''}</p>${hanhDong}</div>`;
}
function dongTuChoi(r) {
  return `<div class="the-con do" id="vct-${r.id}" data-tu-choi="1"><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(r.noi_dung)} · <span class="nhan-tu-choi">Bị từ chối, chờ giao lại</span></p>
    <div class="hanh-dong">${xem(r)}</div></div>`;
}
function dongChiDao(c) {
  const r = timRow(c.nhiem_vu_id);
  return `<div class="the-con" id="vctCd-${c.id}"><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(findAccount(c.nguoi_gui)?.full_name || 'Lãnh đạo')} ${TEN_LOAI_CHI_DAO[c.loai]?.toLowerCase() || ''} ${formatDateTime(c.created_at)}: "${escapeHtml(c.noi_dung)}"${c.han_phan_hoi ? ` · hạn trả lời ${formatNgay(c.han_phan_hoi)}` : ''}. Chưa phản hồi.</p>
    <form class="o mo" data-submit="phanHoiThe" data-chi-dao="${c.id}"><input name="noi_dung" required placeholder="Trả lời một dòng" aria-label="Nội dung phản hồi"><button type="submit" class="nut chinh">Gửi phản hồi</button>${xem(r)}</form></div>`;
}
function dongMinhChung(r, homNay) {
  const cap = danhMucKl().cap.map((c) => `<option value="${c.ma}"${c.ma === r.cap_nhan_san_pham ? ' selected' : ''}>${escapeHtml(c.ten)}</option>`).join('');
  const han = r.han_xu_ly ? `hạn ${formatNgay(r.han_xu_ly)} (${ghiChuHan(r.han_xu_ly, homNay).toLowerCase()})` : 'chưa có hạn';
  return `<div class="the-con ${r.muc_canh_bao === 'VANG' ? '' : 'do'}" id="vct-${r.id}" data-muc="${escapeHtml(r.muc_canh_bao)}"><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(r.noi_dung)}, ${han}${r.san_pham_ten ? ` · sản phẩm: ${escapeHtml(r.san_pham_ten)}` : ''}</p>
    <form class="mc-inline" data-submit="nopMinhChungThe" data-id="${r.id}"><input name="so_hieu" placeholder="Số hiệu văn bản" aria-label="Số hiệu" autocomplete="off"><input type="date" name="ngay_van_ban" aria-label="Ngày văn bản" max="${homNay}">
      <select name="cap_nhan" aria-label="Cấp nhận"><option value="">Cấp nhận</option>${cap}</select><button type="submit" class="nut chinh">Nộp minh chứng</button></form>
    <div class="hanh-dong"><button type="button" class="nut" data-action="capNhatThe" data-id="${r.id}">Cập nhật tiến độ</button>${xem(r)}</div></div>`;
}
function dongDangLam(r) {
  return `<div class="the-con" id="vct-${r.id}"><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(r.noi_dung)}, hạn ${r.han_xu_ly ? formatNgay(r.han_xu_ly) : 'chưa có'}</p>
    <div class="hanh-dong"><button type="button" class="nut" data-action="capNhatThe" data-id="${r.id}">Cập nhật tiến độ</button>${xem(r)}</div></div>`;
}

export function mucHtml(lop, tieuDe, ds, kieu) {
  if (ds.length === 0) return '';
  const homNay = homNayVN();
  const dong = { 'tu-choi': dongTuChoi, moi: dongMoi, 'chi-dao': dongChiDao, 'minh-chung': (r) => dongMinhChung(r, homNay), 'dang-lam': dongDangLam }[kieu];
  return `<div class="muc ${lop}" id="vctMuc-${kieu}"><b>${tieuDe} (${ds.length})</b>${ds.map(dong).join('')}</div>`;
}
