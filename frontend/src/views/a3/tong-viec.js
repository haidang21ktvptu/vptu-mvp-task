// "Việc của tôi" (A3) — v3.23 (chủ dự án 13/10/2026): trước đây trang chỉ hiện việc cần làm nên dễ hiểu nhầm "chỉ có vài việc". Nay đầu danh
// sách là dải số TỔNG của mọi việc đồng chí chủ trì hoặc theo dõi (đang thực hiện · cần làm ngay · quá hạn · đang theo dõi · đã hoàn thành · tất
// cả) — bấm một số để xem đúng các việc đó; bộ lọc cán bộ chủ trì / người theo dõi / lãnh đạo VP phụ trách; "Nhóm theo văn bản" gom thẻ theo văn
// bản gốc (như màn Theo văn bản). Mặc định "Đang thực hiện" = các nhóm ưu tiên như cũ (id #vctMuc-<nhóm> giữ nguyên).
import { escapeHtml } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { formatNgay } from '../../lib/kl/ngay.js';
import { LOC_CAN_BO, coLocCanBo, locCanBo, tuyChonCanBo, nhomTheoVanBan, vanBanGocText } from '../../lib/kl/pham-vi.js';
import { tenLoaiVanBan } from '../shared/kl/them-owner.js';
import { dh } from '../shared/dieu-hanh/du-lieu.js';
import { me, mo, laCuaToi, quaHan, nhomViecCuaToi, kieuTheo } from './viec-cua-toi.js';
import { mucHtml, theViec } from './the-viec-gon.js';

export const vct = { xem: 'dang-lam', loc: { ...LOC_CAN_BO }, theoVb: false, phanCong: [] };
const XEM = [['dang-lam', 'Đang thực hiện'], ['can-lam', 'Cần làm ngay'], ['qua-han', 'Quá hạn'], ['theo-doi', 'Đang theo dõi'], ['xong', 'Đã hoàn thành'], ['tat-ca', 'Tất cả']];
const TEN_XEM = Object.fromEntries(XEM);

// Mọi con số và tập việc của trang tính trên CÙNG một mảng (việc của tôi đã qua bộ lọc cán bộ).
export function soLieuVct() {
  const rows = locCanBo(dh.rows.filter(laCuaToi), vct.loc, vct.phanCong);
  const n = nhomViecCuaToi(rows);
  const canLam = [...n.tuChoi, ...n.moi, ...n.chiDao, ...n.canMinhChung];
  const tap = { 'dang-lam': [...canLam, ...n.dangLam], 'can-lam': canLam, 'qua-han': rows.filter(quaHan),
    'theo-doi': rows.filter((r) => mo(r) && r.nguoi_theo_doi === me() && r.owner_tai_khoan !== me()), xong: n.xong, 'tat-ca': rows };
  return { rows, n, kieu: kieuTheo(n), tap };
}

export const tomTat = (s) => `${s.rows.length} việc của đồng chí · ${s.tap['can-lam'].length} việc cần làm ngay · ${s.rows.filter(mo).length} đang mở · ${s.n.xong.length} đã hoàn thành`;

export const tongSoHtml = (s) => `<div class="vct-tong tq" role="group" aria-label="Số việc của đồng chí — bấm để xem">${XEM.map(([k, ten]) =>
  `<button type="button" class="o-so" data-action="vctXem" data-xem="${k}" data-so="${s.tap[k].length}" aria-pressed="${String(vct.xem === k)}"><b>${s.tap[k].length}</b> ${ten.toLowerCase()}</button>`).join('')}</div>`;

// Ô lọc (lựa chọn đếm trên mọi việc của tôi — không theo bộ lọc đang chọn); ô chỉ một lựa chọn và chưa chọn thì ẩn.
export function locHtml() {
  const tc = tuyChonCanBo(dh.rows.filter(laCuaToi), { ten: (id) => state.accounts.find((a) => a.id === id)?.full_name, phanCong: vct.phanCong,
    lanhDaoVP: state.accounts.filter((a) => a.role_group === 'A1' && !a.is_chief && !a.is_system) });
  const o = (k, nhan) => (tc[k].length > 1 || vct.loc[k] ? `<select data-vct-loc="${k}" aria-label="${nhan}"><option value="">${nhan} (${tc[k].length})</option>${tc[k].map((x) =>
    `<option value="${escapeHtml(x.ma)}"${vct.loc[k] === x.ma ? ' selected' : ''}>${escapeHtml(x.ten)} (${x.n})</option>`).join('')}</select>` : '');
  return `<div class="vct-loc kl-loc" id="vctLoc" role="group" aria-label="Lọc việc của tôi">${o('chuTri', 'Cán bộ chủ trì')}${o('theoDoi', 'Người theo dõi')}${o('ldvp', 'Lãnh đạo VP phụ trách')}
    <label class="nhan-checkbox vct-theo-vb"><input type="checkbox" id="vctTheoVb" data-vct-vb${vct.theoVb ? ' checked' : ''}> Nhóm theo văn bản</label>
    ${coLocCanBo(vct.loc) ? '<button type="button" class="nut nho" data-action="vctBoLoc">Bỏ lọc</button>' : ''}</div>`;
}

const theoVanBanHtml = (ds, kieu) => nhomTheoVanBan(ds).map((g) => `<div class="muc vct-vb" id="vctVb-${escapeHtml(g.khoa)}"><b>${escapeHtml(vanBanGocText(g.r, tenLoaiVanBan, formatNgay))} (${g.rows.length})</b>
  ${g.rows.map((r) => theViec(r, kieu.get(r.id) || 'dang-lam')).join('')}</div>`).join('');

// Danh sách thẻ của mục đang xem (mặc định: các nhóm ưu tiên như cũ).
export function danhSachHtml(s) {
  const ds = s.tap[vct.xem]; const n = s.n;
  if (ds.length === 0) return `<div class="muc"><b>${vct.xem === 'dang-lam' || vct.xem === 'can-lam' ? 'Hôm nay đồng chí không có việc nào cần làm.' : `Không có việc nào ở mục "${TEN_XEM[vct.xem]}".`}</b></div>`;
  if (vct.theoVb) return theoVanBanHtml(ds, s.kieu);
  if (vct.xem === 'dang-lam' || vct.xem === 'can-lam') {
    return [mucHtml('do', 'Bị từ chối, chờ lãnh đạo giao lại', n.tuChoi, 'tu-choi'), mucHtml('lam', 'Việc mới giao — cần xác nhận đã nhận', n.moi, 'moi'),
      mucHtml('do', 'Có chỉ đạo chờ đồng chí trả lời', n.chiDao, 'chi-dao'), mucHtml('vang', 'Sắp đến hạn hoặc quá hạn, chưa có minh chứng', n.canMinhChung, 'minh-chung'),
      vct.xem === 'dang-lam' ? mucHtml('luc', 'Đang thực hiện, còn thời gian', n.dangLam, 'dang-lam') : ''].join('');
  }
  if (vct.xem === 'tat-ca') return mucHtml('luc', 'Đang mở', ds.filter(mo), 'dang-lam', 'tat-ca-mo', s.kieu) + mucHtml('', 'Đã hoàn thành', ds.filter((r) => !mo(r)), 'xong', 'tat-ca-xong', s.kieu);
  return mucHtml(vct.xem === 'qua-han' ? 'do' : vct.xem === 'xong' ? '' : 'luc', TEN_XEM[vct.xem], ds, 'dang-lam', vct.xem, s.kieu);
}

export const datXem = (xem) => { if (TEN_XEM[xem]) vct.xem = xem; };
export const boLocVct = () => { vct.loc = { ...LOC_CAN_BO }; };
export const datLaiVct = () => { Object.assign(vct, { xem: 'dang-lam', loc: { ...LOC_CAN_BO }, theoVb: false }); };
// Ô chọn / ô đánh dấu trên dải lọc (gắn một lần ở a3/index.js): trả true khi trạng thái đổi.
export function doiLocVct(el) {
  if (el.matches?.('select[data-vct-loc]')) { vct.loc = { ...vct.loc, [el.dataset.vctLoc]: el.value }; return true; }
  if (el.matches?.('input[data-vct-vb]')) { vct.theoVb = el.checked; return true; }
  return false;
}
