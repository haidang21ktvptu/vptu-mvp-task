// Nhóm và vẽ thẻ "Việc của tôi" (A3). Giao diện v9 đợt 2: MỘT THẺ MỖI VIỆC, mọi thao tác trên thẻ — chỉ đạo đang chờ tôi trả lời trích ngay trên
// thẻ của việc đó (ô trả lời một dòng), Xác nhận đã nhận / Từ chối (việc mới), Nộp minh chứng (mở sẵn khi sắp / quá hạn chưa có minh chứng), Cập
// nhật tiến độ, Ghi vướng mắc, Đề nghị sửa (ô do cấp giao điền — sua-tang.js), Xem diễn biến. Nhóm theo thứ tự ưu tiên, mỗi việc ở một nhóm: bị từ
// chối chờ giao lại → mới giao chưa xác nhận → có chỉ đạo chờ trả lời → sắp đến hạn / quá hạn chưa có minh chứng hợp lệ → đang thực hiện. Việc
// tôi theo dõi (không phải Owner) đếm riêng. Quyền thật ở hàm DB / policy.
import { escapeHtml, formatDateTime } from '../../lib/dom.js';
import { state, findAccount } from '../../lib/state.js';
import { danhMucKl } from '../../lib/kl/du-lieu.js';
import { formatNgay, ghiChuHan, homNayVN } from '../../lib/kl/ngay.js';
import { TEN_LOAI_CHI_DAO } from '../../lib/kl/dieu-hanh.js';
import { nhanPhuHtml, nhanDoKhanHtml } from '../../lib/kl/do-khan.js';
import { cheDoTang, tenOGiao, deNghiToiGuiDangCho } from '../../lib/kl/sua-tang.js';
import { dh, deNghiCuaToi } from '../shared/dieu-hanh/du-lieu.js';

const me = () => state.user?.id;
const mo = (r) => r.tien_do_ma !== 'HOAN_THANH';
const laCuaToi = (r) => r.owner_tai_khoan === me() || r.nguoi_theo_doi === me();
const canNhan = (r) => r.theo_1400 && mo(r) && !r.toi_da_xac_nhan && laCuaToi(r) && !r.bi_tu_choi; // chính tôi chưa nhận (owner / người theo dõi mỗi người tự nhận)
const choNghiemThu = (r) => ['CHO_NGHIEM_THU', 'QUA_HAN_NGHIEM_THU'].includes(r.nhom_dem);
// Chỉ đạo (không phải Thường trực) đang chờ TÔI trả lời trên một việc.
const chiDaoCua = (id) => dh.chiDaoCho.filter((c) => c.nhiem_vu_id === id && c.nguoi_gui !== me() && c.loai !== 'CHI_DAO_TT');

// Kết quả đề nghị từ chối của TÔI (GĐ22, mục 5b): đã đồng ý → chờ giao lại; không đồng ý → phải nhận việc (kèm ý kiến) cho tới khi xác nhận.
const ketQuaTuChoi = (r) => {
  const t = r.tu_choi_moi_nhat;
  if (!t || t.nguoi_de_nghi !== me() || !mo(r) || !laCuaToi(r)) return null;
  if (t.trang_thai === 'DONG_Y' && r.bi_tu_choi) return { r, t, chu: 'Đã đồng ý từ chối, chờ giao lại' };
  if (t.trang_thai === 'KHONG_DONG_Y' && !r.toi_da_xac_nhan) return { r, t, chu: `Không đồng ý, phải nhận việc${t.y_kien_duyet ? `: ${t.y_kien_duyet}` : ''}` };
  return null;
};
export function thanhTuChoiHtml() {
  const ds = dh.rows.map(ketQuaTuChoi).filter(Boolean);
  if (ds.length === 0) return '';
  return `<div class="muc vang" id="vctThanhTuChoi"><b>Kết quả đề nghị từ chối của đồng chí (${ds.length})</b>${ds.map(({ r, t, chu }) =>
    `<p data-nhiem-vu="${r.id}" data-ket-qua="${t.trang_thai}"><b>${escapeHtml(r.ma)}</b> ${escapeHtml(r.noi_dung)} — <b>${escapeHtml(chu)}</b> (${escapeHtml(findAccount(t.cap_duyet)?.full_name || 'cấp duyệt')} duyệt ${t.duyet_luc ? formatDateTime(t.duyet_luc) : ''})</p>`).join('')}</div>`;
}

export function nhomViecCuaToi() {
  const rows = dh.rows.filter(laCuaToi);
  const daXep = new Set();
  const lay = (ds) => { const kq = ds.filter((r) => !daXep.has(r.id)); kq.forEach((r) => daXep.add(r.id)); return kq; };
  const tuChoi = lay(rows.filter((r) => r.bi_tu_choi && mo(r))); // đề nghị từ chối đã được đồng ý (0034), chờ lãnh đạo giao lại
  const moi = lay(rows.filter(canNhan));
  const chiDao = lay(rows.filter((r) => mo(r) && chiDaoCua(r.id).length));
  const canMinhChung = lay(rows.filter((r) => mo(r) && ['VANG', 'DO', 'DO_DAC_BIET'].includes(r.muc_canh_bao) && (r.so_minh_chung_hop_le || 0) === 0 && !choNghiemThu(r)));
  const dangLam = lay(rows.filter((r) => mo(r) && r.owner_tai_khoan === me()));
  const theoDoi = rows.filter((r) => mo(r) && r.nguoi_theo_doi === me() && r.owner_tai_khoan !== me());
  return { tuChoi, moi, chiDao, canMinhChung, dangLam, theoDoi };
}

const nut = (nhan, action, them = '', lop = '') => `<button type="button" class="nut ${lop}" data-action="${action}" ${them}>${nhan}</button>`;
const xem = (r) => nut('Xem diễn biến', 'xemDienBien', `data-id="${r.id}" data-ma="${escapeHtml(r.ma)}"`);
const moO = (o, nhan, lop = '') => nut(nhan, 'moO', `data-o="${o}"`, lop);
const huy = (o) => `<button type="button" class="nut" data-action="dongO" data-o="${o}">Huỷ</button>`;

// Đề nghị sửa của tôi đang chờ duyệt (0071): thẻ ghi "chờ … duyệt" + nút Rút thay nút Đề nghị sửa. Đọc khi nạp trang và mỗi lần số chưa xử lý
// làm mới (a3/index.js — sau ghi, theo hai kênh realtime); trả true khi danh sách đổi (để vẽ lại).
let dnsCuaToi = [];
export async function napDnsCuaToi() {
  const ds = await deNghiToiGuiDangCho();
  const doi = ds.map((d) => d.id).join() !== dnsCuaToi.map((d) => d.id).join();
  dnsCuaToi = ds;
  return doi;
}
const dnsCho = (id) => dnsCuaToi.find((d) => d.nhiem_vu_id === id);
const dnsHtml = (r) => { const d = dnsCho(r.id); return d ? `<p class="chu-canh-bao-inline" data-dns="${d.id}">Đã đề nghị sửa ${escapeHtml(Object.keys(d.thay_doi || {}).map((c) => tenOGiao(c).toLowerCase()).join(', '))} ${formatDateTime(d.tao_luc)}, chờ ${escapeHtml(findAccount(d.cap_duyet)?.full_name || 'người giao việc')} duyệt.</p>` : ''; };
const nutDns = (r) => { const d = dnsCho(r.id); if (d) return nut('Rút đề nghị sửa', 'dnsRut', `data-id="${d.id}" data-nv="${r.id}"`); return cheDoTang(r) === 'de-nghi' ? nut('Đề nghị sửa', 'moDeNghiSua', `data-id="${r.id}"`) : ''; };

// Ô nộp tại chỗ (PR-2a lỗi (3)): mỗi thẻ một bộ id riêng theo việc (mc-<id>-so-hieu…) kèm nhãn ẩn <label for> — nhiều thẻ trên cùng trang
// không trùng id, trình đọc màn hình và tự điền của trình duyệt nhận đúng ô. mo = form mở sẵn (nhóm cần minh chứng) hay mở bằng nút.
const oMc = (id, ten, nhan, mo_, dong = '') => `<label for="mc-${id}-${ten}" class="sr-only">${nhan}</label>${mo_} id="mc-${id}-${ten}">${dong}`;
function formMinhChung(r, homNay, moSan) {
  const cap = danhMucKl().cap.map((c) => `<option value="${c.ma}"${c.ma === r.cap_nhan_san_pham ? ' selected' : ''}>${escapeHtml(c.ten)}</option>`).join('');
  return `<form class="mc-inline${moSan ? '' : ' o'}" id="oMcNop-${r.id}" data-submit="nopMinhChungThe" data-id="${r.id}">${oMc(r.id, 'so-hieu', 'Số hiệu văn bản', '<input name="so_hieu" placeholder="Số hiệu văn bản" autocomplete="off"')}${oMc(r.id, 'ngay-van-ban', 'Ngày văn bản', `<input type="date" name="ngay_van_ban" max="${homNay}"`)}
      ${oMc(r.id, 'cap-nhan', 'Cấp nhận', '<select name="cap_nhan"', `<option value="">Cấp nhận</option>${cap}</select>`)}
      ${oMc(r.id, 'trich-yeu', 'Trích yếu văn bản', '<input name="trich_yeu" placeholder="Trích yếu văn bản" autocomplete="off" maxlength="300" class="mc-rong"')}
      ${oMc(r.id, 'mo-ta', 'Mô tả kết quả', '<textarea name="mo_ta_ket_qua" rows="2" placeholder="Mô tả kết quả (khoảng 100 chữ: đã làm gì, kết quả, gửi ai)" class="mc-rong"', '</textarea>')}
      <button type="submit" class="nut chinh">Nộp minh chứng</button>${moSan ? '' : huy(`oMcNop-${r.id}`)}</form>`;
}
// Chỉ đạo chờ tôi trả lời: trích nguyên văn + ô trả lời một dòng (mở sẵn).
const chiDaoHtml = (r) => chiDaoCua(r.id).map((c) => `<div class="trich-phe" id="vctCd-${c.id}">"${escapeHtml(c.noi_dung)}"<small>${escapeHtml(findAccount(c.nguoi_gui)?.full_name || 'Lãnh đạo')} ${(TEN_LOAI_CHI_DAO[c.loai] || '').toLowerCase()} ${formatDateTime(c.created_at)}${c.han_phan_hoi ? ` · hạn trả lời ${formatNgay(c.han_phan_hoi)}` : ''} · chờ đồng chí trả lời</small></div>
    <form class="o mo" id="oPh-${c.id}" data-submit="phanHoiThe" data-chi-dao="${c.id}"><input name="noi_dung" required placeholder="Trả lời một dòng: lý do, mốc hoàn thành" aria-label="Nội dung phản hồi chỉ đạo"><button type="submit" class="nut chinh">Gửi phản hồi</button></form>`).join('');
// Ghi vướng mắc (dat_vuong_mac, kl/thong-tin-giao.js luuVuongMac): mở bằng nút.
const formVuongMac = (r) => `<form class="o" id="oVmThe-${r.id}" data-submit="luuVuongMac" data-id="${r.id}">
    <input name="vuong_mac" maxlength="500" value="${escapeHtml(r.vuong_mac || '')}" placeholder="Vướng mắc / đề nghị lãnh đạo quyết định" aria-label="Vướng mắc / đề nghị lãnh đạo quyết định">
    <button type="submit" class="nut chinh">Lưu</button>${huy(`oVmThe-${r.id}`)}</form>`;
const formTuChoi = (r) => `<form class="o" id="oTc-${r.id}" data-submit="deNghiTuChoiThe" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">
    <small>Lý do chỉ lãnh đạo trực tiếp và cấp trên đọc được; hạn và trạng thái việc không đổi cho tới khi được duyệt.</small>
    <input name="noi_dung" required placeholder="Lý do từ chối (bắt buộc)" aria-label="Lý do từ chối">
    <button type="submit" class="nut chinh">Gửi đề nghị</button>${huy(`oTc-${r.id}`)}</form>`;

// Một thẻ việc. kieu = nhóm đang vẽ (quyết định lớp mép, ô nộp mở sẵn, nút nào hiện).
function theViec(r, kieu, homNay) {
  if (kieu === 'tu-choi') {
    return `<div class="the-con vct-the do" id="vct-${r.id}" data-nhiem-vu="${r.id}" data-tu-choi="1"><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(r.noi_dung)} ${nhanDoKhanHtml(r.do_khan)} · <span class="nhan-tu-choi">Đã đồng ý từ chối, chờ giao lại</span></p>
      <div class="hanh-dong">${xem(r)}</div></div>`;
  }
  const cam = r.nhom_dem === 'CHAM_NOP_MINH_CHUNG';
  const lop = cam ? 'cam' : kieu === 'minh-chung' && r.muc_canh_bao !== 'VANG' ? 'do' : '';   // mép cam = chậm nộp minh chứng, ở nhóm nào cũng vậy
  const nopMc = r.han_nop_hieu_luc && !choNghiemThu(r) ? `nộp minh chứng trước ${formatNgay(r.han_nop_hieu_luc)}${r.minh_chung_buoc === 'BI_TRA_LAI' ? ' (bị trả lại, nộp lại)' : ''}, ` : '';
  const han = r.han_xu_ly ? `hạn ${formatNgay(r.han_xu_ly)}${kieu === 'minh-chung' ? ` (${ghiChuHan(r.han_xu_ly, homNay).toLowerCase()})` : ''}` : 'chưa có hạn';
  const dau = `<p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(r.noi_dung)}${cam ? ' <span class="trang-thai tt-cam">Chậm nộp minh chứng</span>' : ''}${choNghiemThu(r) ? ' <span class="nhan-trung-tinh">Đã nộp — chờ nghiệm thu</span>' : ''}, ${nopMc}${han}${r.so_ket_luan && kieu === 'moi' ? `, ${escapeHtml(r.so_ket_luan)}` : ''}${r.san_pham_ten ? ` · sản phẩm: ${escapeHtml(r.san_pham_ten)}` : ''} ${nhanPhuHtml(r)}</p>`;
  const kq = ketQuaTuChoi(r);
  const kqHtml = kq ? `<p class="chu-canh-bao-inline" data-ket-qua="${kq.t.trang_thai}">${escapeHtml(kq.chu)}</p>` : '';
  if (kieu === 'moi') {
    const dn = deNghiCuaToi(r.id);
    const hd = dn ? `<p class="chu-canh-bao-inline">Đã đề nghị từ chối ${formatDateTime(dn.tao_luc)}, chờ ${escapeHtml(findAccount(dn.cap_duyet)?.full_name || 'lãnh đạo trực tiếp')} duyệt.</p><div class="hanh-dong">${xem(r)}</div>`
      : `<div class="hanh-dong">${nut('Xác nhận đã nhận việc', 'xacNhanNhanThe', `data-id="${r.id}"`, 'lam')}${moO(`oTc-${r.id}`, 'Từ chối')}${nutDns(r)}${xem(r)}</div>${formTuChoi(r)}`;
    return `<div class="the-con vct-the" id="vct-${r.id}" data-nhiem-vu="${r.id}"${dn ? ' data-de-nghi="1"' : ''}>${dau}${kqHtml}${dnsHtml(r)}${chiDaoHtml(r)}${hd}</div>`;
  }
  const coMc = r.theo_1400 && (r.so_minh_chung_hop_le || 0) === 0 && !choNghiemThu(r);
  const moSan = kieu === 'minh-chung';
  const hd = [coMc && !moSan ? moO(`oMcNop-${r.id}`, 'Nộp minh chứng', 'lam') : '', nut('Cập nhật tiến độ', 'capNhatThe', `data-id="${r.id}"`),
    moO(`oVmThe-${r.id}`, r.vuong_mac ? 'Sửa vướng mắc' : 'Ghi vướng mắc'), nutDns(r), xem(r)].join('');
  return `<div class="the-con vct-the ${lop}" id="vct-${r.id}" data-nhiem-vu="${r.id}" data-muc="${escapeHtml(r.muc_canh_bao)}" data-nhom="${escapeHtml(r.nhom_dem)}">${dau}${kqHtml}${dnsHtml(r)}${chiDaoHtml(r)}
    ${coMc || moSan ? formMinhChung(r, homNay, moSan) : ''}<div class="hanh-dong">${hd}</div>${formVuongMac(r)}</div>`;
}

export function mucHtml(lop, tieuDe, ds, kieu) {
  if (ds.length === 0) return '';
  const homNay = homNayVN();
  return `<div class="muc ${lop}" id="vctMuc-${kieu}"><b>${tieuDe} (${ds.length})</b>${ds.map((r) => theViec(r, kieu, homNay)).join('')}</div>`;
}
