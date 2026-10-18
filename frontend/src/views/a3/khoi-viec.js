// "Việc của tôi" dạng bảng (v3.25, mẫu Main 16/10/2026) — khối thao tác mở NGAY DƯỚI DÒNG (bang-viec.js giữ một khối đang mở qua lần vẽ lại) và
// ghi chú trạng thái của dòng. Khối: từ chối nhận việc (lý do bắt buộc), trả lời chỉ đạo (trích nguyên văn + ô một dòng), nộp minh chứng (số
// hiệu, ngày, cấp nhận, trích yếu, mô tả, đính kèm tệp — a3/index.js tải tệp lên rồi mới gọi nop_minh_chung). id giữ như thẻ v3.23 (e2e,
// giuONhap): #oTc-<việc>, #oPh-<chỉ đạo>, #vctCd-<chỉ đạo>, #oMcNop-<việc>, ô mc-<việc>-* kèm <label for>. Hàm DB là chốt mọi ghi.
import { escapeHtml, formatDateTime } from '../../lib/dom.js';
import { findAccount } from '../../lib/state.js';
import { danhMucKl } from '../../lib/kl/du-lieu.js';
import { formatNgay } from '../../lib/kl/ngay.js';
import { TEN_LOAI_CHI_DAO } from '../../lib/kl/dieu-hanh.js';
import { NHAN_TEP } from '../../lib/kl/tep-ten.js';
import { tenOGiao } from '../../lib/kl/sua-tang.js';
import { tenCapDuyet } from '../../lib/kl/thay-mat.js';
import { deNghiCuaToi } from '../shared/dieu-hanh/du-lieu.js';
import { chiDaoCua, ketQuaTuChoi, dnsCho } from './viec-cua-toi.js';

const huy = (id) => `<button type="button" class="nut" data-action="vctDongKhoi" data-id="${id}">Huỷ</button>`;
const oMc = (id, ten, nhan, mo, dong = '') => `<label for="mc-${id}-${ten}" class="sr-only">${nhan}</label>${mo} id="mc-${id}-${ten}">${dong}`;

function formMinhChung(r, homNay) {
  const cap = danhMucKl().cap.map((c) => `<option value="${c.ma}"${c.ma === r.cap_nhan_san_pham ? ' selected' : ''}>${escapeHtml(c.ten)}</option>`).join('');
  return `<form class="mc-inline" id="oMcNop-${r.id}" data-submit="nopMinhChungThe" data-id="${r.id}">
      ${oMc(r.id, 'so-hieu', 'Số hiệu văn bản', '<input name="so_hieu" placeholder="Số hiệu văn bản" autocomplete="off"')}
      ${oMc(r.id, 'ngay-van-ban', 'Ngày văn bản', `<input type="date" name="ngay_van_ban" max="${homNay}"`)}
      ${oMc(r.id, 'cap-nhan', 'Cấp nhận', '<select name="cap_nhan"', `<option value="">Cấp nhận</option>${cap}</select>`)}
      ${oMc(r.id, 'trich-yeu', 'Trích yếu văn bản', '<input name="trich_yeu" placeholder="Trích yếu văn bản" autocomplete="off" maxlength="300" class="mc-rong"')}
      ${oMc(r.id, 'mo-ta', 'Mô tả kết quả', '<textarea name="mo_ta_ket_qua" rows="2" placeholder="Mô tả kết quả (khoảng 100 chữ: đã làm gì, kết quả, gửi ai)" class="mc-rong"', '</textarea>')}
      <span class="mc-rong o-tep-hang mc-tep-the"><input type="file" name="tep" id="mc-${r.id}-tep" class="an-tep" accept="${NHAN_TEP}"><label class="nut nho" for="mc-${r.id}-tep">Đính kèm tệp…</label><span class="ten-tep" id="mc-${r.id}-tep-ten">Chưa chọn tệp (PDF, Word, Excel, ảnh; tối đa 10 MB)</span></span>
      <span class="mc-rong bnv-khoi-nut">${huy(r.id)}<button type="submit" class="nut chinh">Nộp minh chứng</button></span></form>`;
}
// Chỉ đạo chờ tôi trả lời: trích nguyên văn + ô trả lời một dòng (phanHoiThe tìm việc qua data-nhiem-vu của dòng).
const chiDaoHtml = (r) => chiDaoCua(r.id).map((c) => `<div class="trich-phe" id="vctCd-${c.id}">"${escapeHtml(c.noi_dung)}"<small>${escapeHtml(findAccount(c.nguoi_gui)?.full_name || 'Lãnh đạo')} ${(TEN_LOAI_CHI_DAO[c.loai] || '').toLowerCase()} ${formatDateTime(c.created_at)}${c.han_phan_hoi ? ` · hạn trả lời ${formatNgay(c.han_phan_hoi)}` : ''}</small></div>
    <form class="o mo" id="oPh-${c.id}" data-submit="phanHoiThe" data-chi-dao="${c.id}"><input name="noi_dung" required placeholder="Trả lời một dòng: lý do, mốc hoàn thành" aria-label="Nội dung phản hồi chỉ đạo"><button type="submit" class="nut chinh">Gửi phản hồi</button>${huy(r.id)}</form>`).join('');
const formTuChoi = (r) => `<form class="o mo" id="oTc-${r.id}" data-submit="deNghiTuChoiThe" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">
    <small>Lý do chỉ người xử lý đề nghị (người giao việc) và lãnh đạo cấp trên đọc được; hạn và trạng thái việc không đổi cho tới khi được duyệt.</small>
    <input name="noi_dung" required placeholder="Lý do từ chối (bắt buộc)" aria-label="Lý do từ chối">
    <button type="submit" class="nut chinh">Gửi đề nghị</button>${huy(r.id)}</form>`;

// Khối của một dòng theo kiểu: 'tu-choi' | 'tra-loi' | 'nop'.
export const KIEU_KHOI = { nhan: 'tu-choi', 'tra-loi': 'tra-loi', nop: 'nop' };
const TIEU = { 'tu-choi': 'Đề nghị từ chối nhận việc', 'tra-loi': 'Ý kiến chỉ đạo chờ đồng chí trả lời', nop: 'Nộp minh chứng' };
export function khoiHtml(r, kieu, homNay, mo) {
  const tieu = kieu === 'nop' ? `Nộp minh chứng cho ${escapeHtml(r.ma)}${r.san_pham_ten ? ` · sản phẩm: ${escapeHtml(r.san_pham_ten)}` : ''}` : `${TIEU[kieu]} · ${escapeHtml(r.ma)}`;
  const than = kieu === 'nop' ? formMinhChung(r, homNay) : kieu === 'tra-loi' ? chiDaoHtml(r) : formTuChoi(r);
  return `<div class="bnv-khoi${mo ? ' mo' : ''}" id="vctKhoi-${r.id}" data-kieu="${kieu}" role="group" aria-label="${escapeHtml(TIEU[kieu])}"><p class="bnv-khoi-tieu">${tieu}</p>${than}</div>`;
}

// Ghi chú dưới nhãn trạng thái: đề nghị từ chối của tôi đang chờ, kết quả "không đồng ý", đề nghị sửa đang chờ (có nút Rút), minh chứng bị trả lại.
export function ghiChuHtml(r) {
  const ghi = [];
  const dn = deNghiCuaToi(r.id);
  if (dn) ghi.push(`<span class="bnv-ghi">Đã đề nghị từ chối ${formatDateTime(dn.tao_luc)}, chờ ${escapeHtml(tenCapDuyet(r, dn.cap_duyet) || 'lãnh đạo trực tiếp')} duyệt.</span>`);
  const kq = ketQuaTuChoi(r);
  if (kq && kq.t.trang_thai !== 'DONG_Y') ghi.push(`<span class="bnv-ghi" data-ket-qua="${escapeHtml(kq.t.trang_thai)}">${escapeHtml(kq.chu)}</span>`);
  const d = dnsCho(r.id);
  if (d) {
    ghi.push(`<span class="bnv-ghi" data-dns="${d.id}">Đã đề nghị sửa ${escapeHtml(Object.keys(d.thay_doi || {}).map((c) => tenOGiao(c).toLowerCase()).join(', '))} ${formatDateTime(d.tao_luc)}, chờ ${escapeHtml(findAccount(d.cap_duyet)?.full_name || 'người giao việc')} duyệt.</span>`,
      `<button type="button" class="nut nho" data-action="dnsRut" data-id="${d.id}" data-nv="${r.id}">Rút đề nghị sửa</button>`);
  }
  if (r.minh_chung_buoc === 'BI_TRA_LAI' && r.tien_do_ma !== 'HOAN_THANH') ghi.push('<span class="bnv-ghi">Minh chứng bị trả lại — nộp lại</span>');
  return ghi.join('');
}
