// Danh sách gọn dưới dải "Cần xử lý ngay" (GĐ23): bấm một mục của dải → các việc thuộc mục đó, mỗi dòng = mã (bấm mở diễn biến tại chỗ), trích nội
// dung, ai liên quan và NÚT HÀNH ĐỘNG đúng việc cần làm — bị từ chối → Giao lại (A1/A2); đề nghị từ chối chờ duyệt → Đồng ý / Không đồng ý; việc
// mới chờ xác nhận → Xác nhận đã nhận / Từ chối; Hỏa tốc chưa Đã nhận → Đã nhận; tin chưa đọc → mở hội thoại / chuông. Dùng cho mọi vai có dải
// (A0, A1, A2, A3); dữ liệu từ dh.rows (RLS) và kl_so_chua_xu_ly; hàm DB là chốt cho từng hành động (đăng ký ở dieu-hanh/hanh-dong.js, thanh-hoa-toc.js).
import { $, escapeHtml, formatDateTime } from '../../lib/dom.js';
import { state, findAccount } from '../../lib/state.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { formatNgay } from '../../lib/kl/ngay.js';
import { nhanPhuHtml } from '../../lib/kl/do-khan.js';
import { dh, canToiQuyet, tuChoiChoToiDuyet } from './dieu-hanh/du-lieu.js';
import { oGiaoLaiHtml } from './dieu-hanh/the-viec.js';

const me = () => state.user?.id;
const vai = () => state.user?.role_group;
const mo = (r) => r.tien_do_ma !== 'HOAN_THANH';
const trich = (s, n = 110) => { const t = (s || '').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
const ten = (id) => findAccount(id)?.full_name || '';
// Ai liên quan (đã escape — chu của dong() là HTML).
const lienQuan = (r) => escapeHtml([r.owner_tai_khoan_ten || r.owner_don_vi_ten, r.nguoi_theo_doi_ten && r.nguoi_theo_doi_ten !== r.owner_tai_khoan_ten ? `theo dõi: ${r.nguoi_theo_doi_ten}` : '']
  .filter(Boolean).join(' · '));
const maNut = (r) => `<button type="button" class="cx-ma" data-action="xemDienBien" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}" aria-expanded="false" title="Mở diễn biến của việc"><b>${escapeHtml(r.ma)}</b></button>`;
const dong = (muc, r, chu, hanhDong = '', them = '') => `<div class="cx-dong the-con" id="cx-${muc}-${r.id}" data-nhiem-vu="${r.id}">
    <p>${maNut(r)} ${escapeHtml(trich(r.noi_dung))}${r.han_xu_ly ? `, hạn ${formatNgay(r.han_xu_ly)}` : ''} ${nhanPhuHtml(r)}<span class="chu-phu"> · ${chu}</span></p>
    ${hanhDong ? `<div class="hanh-dong">${hanhDong}</div>` : ''}${them}</div>`;
const nut = (nhan, action, data, lop = '') => `<button type="button" class="nut nho ${lop}" data-action="${action}" ${Object.entries(data).map(([k, v]) => `data-${k}="${escapeHtml(String(v))}"`).join(' ')}>${nhan}</button>`;

// ---- Các tập việc theo mục (cùng quy tắc đếm với kl_so_chua_xu_ly ở DB)
// Việc mới chờ CHÍNH TÔI xác nhận (cùng quy tắc kl_so_chua_xu_ly.viec_moi: owner và người theo dõi mỗi người tự nhận, không nhận thay nhau).
export const cuaToiChoNhan = () => dh.rows.filter((r) => mo(r) && !r.bi_tu_choi && r.theo_1400 && !r.toi_da_xac_nhan && (r.owner_tai_khoan === me() || r.nguoi_theo_doi === me()));
const canQuyet = () => dh.rows.filter((r) => mo(r) && !r.bi_tu_choi && canToiQuyet(r) && ['DO', 'DO_DAC_BIET'].includes(r.muc_canh_bao) && !r.dang_dinh_chinh);
const biTuChoi = () => dh.rows.filter((r) => mo(r) && r.bi_tu_choi && (['A0', 'A1', 'A2'].includes(vai()) || r.tao_boi === me() || r.giao_thay_mat_cho === me()));
const deNghiChoDuyet = () => (vai() === 'A0'
  ? dh.tuChoiCho.filter((t) => findAccount(t.cap_duyet)?.role_group === 'A0' && dh.rows.some((r) => r.id === t.nhiem_vu_id))
  : tuChoiChoToiDuyet());

// ---- Dòng theo mục
function dongTin(so) {
  const ds = Object.entries(state.dmUnread || {}).filter(([k, n]) => k && k !== 'null' && n > 0)
    .map(([k, n]) => `<div class="cx-dong"><p><b>${escapeHtml(ten(k) || 'Cán bộ')}</b><span class="chu-phu"> · ${n} tin chưa đọc</span></p>
      <div class="hanh-dong">${nut('Mở hội thoại', 'openDMChat', { 'peer-id': k }, 'lam')}</div></div>`);
  const tb = Number(so?.thong_bao || 0);
  if (tb) ds.unshift(`<div class="cx-dong"><p><b>Thông báo trên nhiệm vụ</b><span class="chu-phu"> · ${tb} chưa đọc (chỉ đạo, minh chứng, cảnh báo)</span></p>
      <div class="hanh-dong">${nut('Mở chuông', 'cxMoChuong', {}, 'lam')}</div></div>`);
  return ds;
}
const dongCanQuyet = () => canQuyet().map((r) => dong('quyet', r, `${escapeHtml(r.cap_quyet_dinh_ten || 'cấp cần quyết')} · ${lienQuan(r)}`,
  nut('Chỉ đạo / ý kiến', 'moChiDaoViec', { id: r.id, ma: r.ma }, 'lam')));
function dongDeNghi() {
  return deNghiChoDuyet().map((t) => {
    const r = dh.rows.find((x) => x.id === t.nhiem_vu_id); const a = findAccount(t.nguoi_de_nghi);
    return dong('denghi', r, `${escapeHtml(a?.full_name || 'cán bộ')}${a?.department ? ` (${escapeHtml(DEPT_NAMES[a.department] || a.department)})` : ''} đề nghị ${formatDateTime(t.tao_luc)}`, '',
      `<p class="ly-do">Lý do: ${escapeHtml(t.ly_do)}</p>
      <form class="o mo" data-submit="duyetTuChoiThe" data-id="${t.id}" data-ma="${escapeHtml(r.ma)}">
        <input name="noi_dung" placeholder="Ý kiến duyệt (không bắt buộc)" aria-label="Ý kiến duyệt">
        ${nut('Đồng ý từ chối', 'duyetTuChoiThe', { 'dong-y': 1, id: t.id, ma: r.ma }, 'chinh')}${nut('Không đồng ý', 'duyetTuChoiThe', { 'dong-y': 0, id: t.id, ma: r.ma })}
      </form>`);
  });
}
function dongBiTuChoi() {
  const giaoLai = ['A1', 'A2'].includes(vai());
  return biTuChoi().map((r) => dong('tuchoi', r, `${lienQuan(r)} · <span class="nhan-tu-choi">Bị từ chối</span>`,
    giaoLai ? nut('Giao lại', 'moO', { o: `cxGiaoLai-${r.id}` }, 'lam') : '', giaoLai ? oGiaoLaiHtml(r, 'cxGiaoLai') : ''));
}
function dongViecMoi() {
  return cuaToiChoNhan().map((r) => (r.tu_choi_cho
    ? dong('moi', r, `${lienQuan(r)} · đã đề nghị từ chối ${formatDateTime(r.tu_choi_cho.tao_luc)}, chờ ${escapeHtml(ten(r.tu_choi_cho.cap_duyet) || 'cấp duyệt')} duyệt`)
    : dong('moi', r, lienQuan(r), `${nut('Xác nhận đã nhận', 'cxXacNhanNhan', { id: r.id, ma: r.ma }, 'lam')}${nut('Từ chối', 'moO', { o: `cxTc-${r.id}` })}`,
      `<form class="o" id="cxTc-${r.id}" data-submit="deNghiTuChoiThe" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">
        <input name="noi_dung" required placeholder="Lý do từ chối (bắt buộc)" aria-label="Lý do từ chối">
        <button type="submit" class="nut chinh">Gửi đề nghị</button><button type="button" class="nut" data-action="dongO" data-o="cxTc-${r.id}">Huỷ</button></form>`)));
}
const dongHoaToc = (so) => (so?.hoa_toc || []).map((x) => `<div class="cx-dong the-con" id="cx-hoatoc-${x.id}" data-nhiem-vu="${x.nhiem_vu_id}">
    <p><button type="button" class="cx-ma" data-action="xemDienBien" data-id="${x.nhiem_vu_id}" data-ma="${escapeHtml(x.ma)}" aria-expanded="false"><b>${escapeHtml(x.ma)}</b></button>
      ${x.loai === 'chi_dao' ? 'chỉ đạo hỏa tốc: ' : ''}${escapeHtml(trich(x.noi_dung))}<span class="chu-phu"> · Hỏa tốc, cần bấm Đã nhận trong 2 giờ làm việc</span></p>
    <div class="hanh-dong">${nut('Đã nhận', 'daNhanHoaToc', { loai: x.loai, id: x.id }, 'lam')}</div></div>`);

export const TIEU_DE_MUC = { tin: 'Tin chưa đọc', quyet: 'Việc cần đồng chí quyết', denghi: 'Đề nghị từ chối chờ đồng chí duyệt', tuchoi: 'Việc bị từ chối, cần giao lại',
  moi: 'Việc mới chờ đồng chí xác nhận đã nhận', hoatoc: 'Hỏa tốc chưa bấm Đã nhận' };

// Nội dung hộp dưới dải cho một mục; rỗng → câu "không còn việc nào" (dải và danh sách có thể lệch vài giây khi realtime).
export function chiTietHtml(muc, so) {
  const ds = { tin: dongTin, quyet: dongCanQuyet, denghi: dongDeNghi, tuchoi: dongBiTuChoi, moi: dongViecMoi, hoatoc: dongHoaToc }[muc]?.(so) || [];
  return `<div class="cx-dau"><b>${TIEU_DE_MUC[muc] || ''}</b><button type="button" class="nut nho" data-action="moCanXuLy" data-muc="${muc}" aria-label="Đóng danh sách">Đóng</button></div>
    ${ds.length ? ds.join('') : '<p class="chu-phu">Không còn việc nào ở mục này.</p>'}`;
}

export const veChiTietCanXuLy = (muc, so) => { const el = $('cxChiTiet'); if (el) { el.innerHTML = chiTietHtml(muc, so); el.classList.remove('hidden'); } };
