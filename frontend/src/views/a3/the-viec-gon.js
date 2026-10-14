// Thẻ "Việc của tôi" (A3) — v3.23 (chủ dự án 13/10/2026): thẻ TỐI GIẢN — mã, trạng thái, nội dung (2 dòng), hạn, văn bản gốc, MỘT thao tác chính
// theo nhóm (Xác nhận đã nhận / Từ chối; trả lời chỉ đạo; nộp minh chứng — có đính kèm tệp; cập nhật tiến độ) và nút "Chi tiết": mở ngay dưới
// thẻ đủ thông tin (chủ trì, theo dõi, người giao, sản phẩm, vướng mắc) cùng các thao tác phụ (cập nhật, ghi vướng mắc — chọn người được đề nghị
// xử lý, đề nghị sửa, xem diễn biến, mở ngăn chi tiết). id giữ nguyên (e2e): #vct-<id>, #vctMuc-<nhóm>, #oTc-, #oMcNop-, #oVmThe-, mc-<id>-*.
import { escapeHtml, formatDateTime } from '../../lib/dom.js';
import { findAccount } from '../../lib/state.js';
import { danhMucKl } from '../../lib/kl/du-lieu.js';
import { formatNgay, ghiChuHan, homNayVN } from '../../lib/kl/ngay.js';
import { TEN_LOAI_CHI_DAO } from '../../lib/kl/dieu-hanh.js';
import { nhanPhuHtml, nhanDoKhanHtml } from '../../lib/kl/do-khan.js';
import { nhanTrangThai, boSoThuTu, lopQuaHan, laBenNop } from '../../lib/kl/nhan.js';
import { NHAN_TEP } from '../../lib/kl/tep-ten.js';
import { vanBanGocText } from '../../lib/kl/pham-vi.js';
import { cheDoTang, tenOGiao } from '../../lib/kl/sua-tang.js';
import { deNghiCuaToi } from '../shared/dieu-hanh/du-lieu.js';
import { tenCapDuyet } from '../../lib/kl/thay-mat.js';
import { tenLoaiVanBan } from '../shared/kl/them-owner.js';
import { nguoiNhanVuongMacHtml, daGuiVuongMacHtml } from '../shared/kl/thong-tin-giao.js';
import { me, chiDaoCua, choNghiemThu, ketQuaTuChoi, dnsCho } from './viec-cua-toi.js';

// Thẻ đang mở phần "Chi tiết" (giữ qua các lần vẽ lại theo realtime / sau hành động).
const moRong = new Set();
export function vctChiTiet({ id }) {
  if (moRong.has(id)) moRong.delete(id); else moRong.add(id);
  const o = document.getElementById(`vctThem-${id}`); if (o) o.hidden = !moRong.has(id);
  document.getElementById(`vct-${id}`)?.querySelector('[data-action="vctChiTiet"]')?.setAttribute('aria-expanded', String(moRong.has(id)));
}

const nut = (nhan, action, them = '', lop = '') => `<button type="button" class="nut ${lop}" data-action="${action}" ${them}>${nhan}</button>`;
const xem = (r) => nut('Xem diễn biến', 'xemDienBien', `data-id="${r.id}" data-ma="${escapeHtml(r.ma)}"`);
const moO = (o, nhan, lop = '') => nut(nhan, 'moO', `data-o="${o}"`, lop);
const huy = (o) => `<button type="button" class="nut" data-action="dongO" data-o="${o}">Huỷ</button>`;
const nutChiTiet = (r) => `<button type="button" class="nut vct-nut-ct" data-action="vctChiTiet" data-id="${r.id}" aria-expanded="${String(moRong.has(r.id))}" aria-controls="vctThem-${r.id}">Chi tiết</button>`;

const dnsHtml = (r) => { const d = dnsCho(r.id); return d ? `<p class="chu-canh-bao-inline" data-dns="${d.id}">Đã đề nghị sửa ${escapeHtml(Object.keys(d.thay_doi || {}).map((c) => tenOGiao(c).toLowerCase()).join(', '))} ${formatDateTime(d.tao_luc)}, chờ ${escapeHtml(findAccount(d.cap_duyet)?.full_name || 'người giao việc')} duyệt.</p>` : ''; };
const nutDns = (r) => { const d = dnsCho(r.id); if (d) return nut('Rút đề nghị sửa', 'dnsRut', `data-id="${d.id}" data-nv="${r.id}"`); return cheDoTang(r) === 'de-nghi' ? nut('Đề nghị sửa', 'moDeNghiSua', `data-id="${r.id}"`) : ''; };

// Ô nộp tại chỗ (PR-2a lỗi (3)): mỗi thẻ một bộ id riêng theo việc (mc-<id>-so-hieu…) kèm nhãn ẩn <label for>. v3.23: thêm ô đính kèm tệp
// (như hộp Nộp minh chứng của ngăn chi tiết) — a3/index.js tải tệp lên rồi mới gọi nop_minh_chung.
const oMc = (id, ten, nhan, mo_, dong = '') => `<label for="mc-${id}-${ten}" class="sr-only">${nhan}</label>${mo_} id="mc-${id}-${ten}">${dong}`;
function formMinhChung(r, homNay, moSan) {
  const cap = danhMucKl().cap.map((c) => `<option value="${c.ma}"${c.ma === r.cap_nhan_san_pham ? ' selected' : ''}>${escapeHtml(c.ten)}</option>`).join('');
  return `<form class="mc-inline${moSan ? '' : ' o'}" id="oMcNop-${r.id}" data-submit="nopMinhChungThe" data-id="${r.id}">${oMc(r.id, 'so-hieu', 'Số hiệu văn bản', '<input name="so_hieu" placeholder="Số hiệu văn bản" autocomplete="off"')}${oMc(r.id, 'ngay-van-ban', 'Ngày văn bản', `<input type="date" name="ngay_van_ban" max="${homNay}"`)}
      ${oMc(r.id, 'cap-nhan', 'Cấp nhận', '<select name="cap_nhan"', `<option value="">Cấp nhận</option>${cap}</select>`)}
      ${oMc(r.id, 'trich-yeu', 'Trích yếu văn bản', '<input name="trich_yeu" placeholder="Trích yếu văn bản" autocomplete="off" maxlength="300" class="mc-rong"')}
      ${oMc(r.id, 'mo-ta', 'Mô tả kết quả', '<textarea name="mo_ta_ket_qua" rows="2" placeholder="Mô tả kết quả (khoảng 100 chữ: đã làm gì, kết quả, gửi ai)" class="mc-rong"', '</textarea>')}
      <span class="mc-rong o-tep-hang mc-tep-the"><input type="file" name="tep" id="mc-${r.id}-tep" class="an-tep" accept="${NHAN_TEP}"><label class="nut nho" for="mc-${r.id}-tep">Đính kèm tệp…</label><span class="ten-tep" id="mc-${r.id}-tep-ten">Chưa chọn tệp (PDF, Word, Excel, ảnh; tối đa 10 MB)</span></span>
      <button type="submit" class="nut chinh">Nộp minh chứng</button>${moSan ? '' : huy(`oMcNop-${r.id}`)}</form>`;
}
// Chỉ đạo chờ tôi trả lời: trích nguyên văn + ô trả lời một dòng (mở sẵn).
const chiDaoHtml = (r) => chiDaoCua(r.id).map((c) => `<div class="trich-phe" id="vctCd-${c.id}">"${escapeHtml(c.noi_dung)}"<small>${escapeHtml(findAccount(c.nguoi_gui)?.full_name || 'Lãnh đạo')} ${(TEN_LOAI_CHI_DAO[c.loai] || '').toLowerCase()} ${formatDateTime(c.created_at)}${c.han_phan_hoi ? ` · hạn trả lời ${formatNgay(c.han_phan_hoi)}` : ''} · chờ đồng chí trả lời</small></div>
    <form class="o mo" id="oPh-${c.id}" data-submit="phanHoiThe" data-chi-dao="${c.id}"><input name="noi_dung" required placeholder="Trả lời một dòng: lý do, mốc hoàn thành" aria-label="Nội dung phản hồi chỉ đạo"><button type="submit" class="nut chinh">Gửi phản hồi</button></form>`).join('');
// Ghi vướng mắc (dat_vuong_mac, kl/thong-tin-giao.js luuVuongMac) + 0103: chọn người được đề nghị xử lý.
const formVuongMac = (r) => `<form class="o" id="oVmThe-${r.id}" data-submit="luuVuongMac" data-id="${r.id}">
    <input name="vuong_mac" maxlength="500" value="${escapeHtml(r.vuong_mac || '')}" placeholder="Vướng mắc / đề nghị lãnh đạo quyết định" aria-label="Vướng mắc / đề nghị lãnh đạo quyết định">
    <select name="gui_cho" aria-label="Đề nghị xử lý gửi tới">${nguoiNhanVuongMacHtml(r)}</select>
    <button type="submit" class="nut chinh">Lưu</button>${huy(`oVmThe-${r.id}`)}</form>`;
const formTuChoi = (r) => `<form class="o" id="oTc-${r.id}" data-submit="deNghiTuChoiThe" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">
    <small>Lý do chỉ người xử lý đề nghị (người giao việc) và lãnh đạo cấp trên đọc được; hạn và trạng thái việc không đổi cho tới khi được duyệt.</small>
    <input name="noi_dung" required placeholder="Lý do từ chối (bắt buộc)" aria-label="Lý do từ chối">
    <button type="submit" class="nut chinh">Gửi đề nghị</button>${huy(`oTc-${r.id}`)}</form>`;

const lopTT = (r) => (r.nhom_dem === 'HOAN_THANH' ? 'tt-xong' : laBenNop(r, me()) ? 'tt-cho' : ['QUA_HAN', 'QUA_HAN_NGHIEM_THU', 'DANG_DINH_CHINH'].includes(r.nhom_dem) ? lopQuaHan(r) : 'tt-cho');
// Phần luôn hiện: mã + trạng thái + nhãn phụ; nội dung (2 dòng); hạn · văn bản gốc.
function chinhHtml(r, homNay, nhanPhu = true) {
  const han = r.nhom_dem === 'HOAN_THANH' ? (r.ngay_hoan_thanh ? `xong ${formatNgay(r.ngay_hoan_thanh)}` : 'đã hoàn thành')
    : r.han_xu_ly ? `hạn ${formatNgay(r.han_xu_ly)} (${ghiChuHan(r.han_xu_ly, homNay).toLowerCase()})` : 'chưa có hạn';
  const traLai = r.minh_chung_buoc === 'BI_TRA_LAI' && !choNghiemThu(r) ? 'minh chứng bị trả lại — nộp lại · ' : '';   // 0077: không còn hạn nộp riêng
  return `<p class="vct-chinh"><b>${escapeHtml(r.ma)}</b><span class="trang-thai ${lopTT(r)}">${escapeHtml(nhanTrangThai(r, me()))}</span> ${nhanPhu ? nhanPhuHtml(r) : ''}
    <span class="vct-nd" title="${escapeHtml(r.noi_dung)}">${escapeHtml(r.noi_dung)}</span>
    <span class="vct-phu">${traLai}${han} · <span class="vct-vb">${escapeHtml(vanBanGocText(r, tenLoaiVanBan, formatNgay))}</span></span></p>`;
}
// Phần "Chi tiết": đủ thông tin + thao tác phụ.
function themHtml(r, phu, form = '') {
  const giao = findAccount(r.tao_boi)?.full_name;   // v3.23.1: tài khoản đã giao việc (chủ dự án 13/10/2026)
  const o = (nhan, gt) => (gt ? `<dt>${nhan}</dt><dd>${gt}</dd>` : '');
  return `<div class="vct-them" id="vctThem-${r.id}"${moRong.has(r.id) ? '' : ' hidden'}><dl>
      ${o('Chủ trì', escapeHtml(r.owner_tai_khoan_ten || boSoThuTu(r.owner_don_vi_ten) || 'chưa xác định'))}${o('Người theo dõi', escapeHtml(r.nguoi_theo_doi_ten || ''))}
      ${o('Người giao', escapeHtml(giao || ''))}${o('Sản phẩm', escapeHtml([r.san_pham_ten, r.san_pham_mo_ta].filter(Boolean).join(': ')))}
      ${o('Loại thời hạn', escapeHtml(boSoThuTu(r.loai_thoi_han_ten) || ''))}${o('Lĩnh vực', escapeHtml([boSoThuTu(r.nganh_ten), r.linh_vuc_ten].filter(Boolean).join(' · ')))}
      ${o('Vướng mắc', r.vuong_mac ? `${escapeHtml(r.vuong_mac)}${daGuiVuongMacHtml(r)}` : '')}</dl>
    <div class="hanh-dong">${phu}${nut('Mở ngăn chi tiết', 'nganMoViec', `data-id="${r.id}"`)}</div>${form}</div>`;
}

// Một thẻ việc. kieu = nhóm của việc (tu-choi | moi | chi-dao | minh-chung | dang-lam | theo-doi | xong) — quyết định thao tác chính.
export function theViec(r, kieu, homNay = homNayVN()) {
  const dau = chinhHtml(r, homNay, kieu !== 'tu-choi');   // thẻ bị từ chối: nhãn riêng bên dưới (không lặp nhãn "Bị từ chối")
  if (kieu === 'tu-choi') {
    return `<div class="the-con vct-the do" id="vct-${r.id}" data-nhiem-vu="${r.id}" data-tu-choi="1">${dau}<p class="chu-canh-bao-inline"><span class="nhan-tu-choi">Đã đồng ý từ chối, chờ giao lại</span> ${nhanDoKhanHtml(r.do_khan)}</p>
      <div class="hanh-dong">${nutChiTiet(r)}</div>${themHtml(r, xem(r))}</div>`;
  }
  const kq = ketQuaTuChoi(r);
  const kqHtml = kq ? `<p class="chu-canh-bao-inline" data-ket-qua="${kq.t.trang_thai}">${escapeHtml(kq.chu)}</p>` : '';
  if (kieu === 'moi') {
    const dn = deNghiCuaToi(r.id);
    const hd = dn ? `<p class="chu-canh-bao-inline">Đã đề nghị từ chối ${formatDateTime(dn.tao_luc)}, chờ ${escapeHtml(tenCapDuyet(r, dn.cap_duyet) || 'lãnh đạo trực tiếp')} duyệt.</p><div class="hanh-dong">${nutChiTiet(r)}</div>`
      : `<div class="hanh-dong">${nut('Xác nhận đã nhận việc', 'xacNhanNhanThe', `data-id="${r.id}"`, 'lam')}${moO(`oTc-${r.id}`, 'Từ chối')}${nutChiTiet(r)}</div>${formTuChoi(r)}`;
    return `<div class="the-con vct-the" id="vct-${r.id}" data-nhiem-vu="${r.id}"${dn ? ' data-de-nghi="1"' : ''}>${dau}${kqHtml}${dnsHtml(r)}${chiDaoHtml(r)}${hd}${themHtml(r, `${nutDns(r)}${xem(r)}`)}</div>`;
  }
  const lop = kieu === 'minh-chung' ? ({ DO: 'do', DO_DAC_BIET: 'dac-biet' }[r.muc_canh_bao] || '') : '';   // chấm mức (v3.23.2: Đỏ đặc biệt tím)
  const xong = kieu === 'xong';
  const coMc = !xong && r.theo_1400 && (r.so_minh_chung_hop_le || 0) === 0 && !choNghiemThu(r);
  const moSan = kieu === 'minh-chung';
  const capNhat = nut('Cập nhật tiến độ', 'capNhatThe', `data-id="${r.id}"`);
  const chinh = xong ? '' : coMc && !moSan ? moO(`oMcNop-${r.id}`, 'Nộp minh chứng', 'lam') : kieu === 'chi-dao' || moSan ? '' : capNhat;
  const phu = xong ? xem(r) : [chinh === capNhat ? '' : capNhat, moO(`oVmThe-${r.id}`, r.vuong_mac ? 'Sửa vướng mắc' : 'Ghi vướng mắc'), nutDns(r), xem(r)].join('');
  return `<div class="the-con vct-the ${lop}" id="vct-${r.id}" data-nhiem-vu="${r.id}" data-muc="${escapeHtml(r.muc_canh_bao)}" data-nhom="${escapeHtml(r.nhom_dem)}" data-kieu="${kieu}">${dau}${kqHtml}${dnsHtml(r)}${chiDaoHtml(r)}
    ${coMc || moSan ? formMinhChung(r, homNay, moSan) : ''}<div class="hanh-dong">${chinh}${nutChiTiet(r)}</div>${themHtml(r, phu, xong ? '' : formVuongMac(r))}</div>`;
}

export function mucHtml(lop, tieuDe, ds, kieu, idMuc = kieu, kieuCua = null) {
  if (ds.length === 0) return '';
  const homNay = homNayVN();
  return `<div class="muc ${lop}" id="vctMuc-${idMuc}"><b>${tieuDe} (${ds.length})</b>${ds.map((r) => theViec(r, kieuCua?.get(r.id) || kieu, homNay)).join('')}</div>`;
}
