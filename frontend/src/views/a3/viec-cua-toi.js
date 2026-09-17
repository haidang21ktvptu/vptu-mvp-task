// Nhóm và vẽ thẻ "Việc của tôi" (A3, mockup): mỗi nhóm một .muc có mép trái theo mức; mỗi việc một dòng với hành động tại chỗ.
// Nhóm: mới giao chưa xác nhận (theo_1400, đang mở) → chỉ đạo chờ tôi trả lời → sắp đến hạn / quá hạn chưa có minh chứng hợp lệ (3 ô nộp
// ngay) → đang thực hiện. Việc tôi theo dõi (không phải Owner) đếm riêng.
import { escapeHtml, formatDateTime } from '../../lib/dom.js';
import { state, findAccount } from '../../lib/state.js';
import { danhMucKl } from '../../lib/kl/du-lieu.js';
import { formatNgay, ghiChuHan, homNayVN } from '../../lib/kl/ngay.js';
import { TEN_LOAI_CHI_DAO } from '../../lib/kl/dieu-hanh.js';
import { dh, timRow } from '../shared/dieu-hanh/du-lieu.js';

const me = () => state.user?.id;
const mo = (r) => r.tien_do_ma !== 'HOAN_THANH';
const laCuaToi = (r) => r.owner_tai_khoan === me() || r.nguoi_theo_doi === me();
const canNhan = (r) => r.theo_1400 && mo(r) && !r.da_xac_nhan_nhan && laCuaToi(r);

export function nhomViecCuaToi() {
  const rows = dh.rows.filter(laCuaToi);
  const moi = rows.filter(canNhan);
  const chiDao = dh.chiDaoCho.filter((c) => c.nguoi_gui !== me() && timRow(c.nhiem_vu_id) && c.loai !== 'CHI_DAO_TT');
  const daXep = new Set(moi.map((r) => r.id));
  const canMinhChung = rows.filter((r) => !daXep.has(r.id) && mo(r) && ['VANG', 'DO', 'DO_DAC_BIET'].includes(r.muc_canh_bao) && (r.so_minh_chung_hop_le || 0) === 0);
  canMinhChung.forEach((r) => daXep.add(r.id));
  const dangLam = rows.filter((r) => !daXep.has(r.id) && mo(r) && r.owner_tai_khoan === me());
  const theoDoi = rows.filter((r) => mo(r) && r.nguoi_theo_doi === me() && r.owner_tai_khoan !== me());
  return { moi, chiDao, canMinhChung, dangLam, theoDoi };
}

const xem = (r) => `<button type="button" class="nut" data-action="xemDienBien" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">Xem</button>`;

function dongMoi(r) {
  return `<div class="the-con" id="vct-${r.id}"><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(r.noi_dung)}, hạn ${r.han_xu_ly ? formatNgay(r.han_xu_ly) : 'chưa có'}${r.so_ket_luan ? `, ${escapeHtml(r.so_ket_luan)}` : ''}</p>
    <div class="hanh-dong"><button type="button" class="nut lam" data-action="xacNhanNhanThe" data-id="${r.id}">Xác nhận đã nhận việc</button>${xem(r)}</div></div>`;
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
  const dong = { moi: dongMoi, 'chi-dao': dongChiDao, 'minh-chung': (r) => dongMinhChung(r, homNay), 'dang-lam': dongDangLam }[kieu];
  return `<div class="muc ${lop}" id="vctMuc-${kieu}"><b>${tieuDe} (${ds.length})</b>${ds.map(dong).join('')}</div>`;
}
