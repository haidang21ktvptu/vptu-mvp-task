// Dữ liệu "Việc của tôi" (A3): nhóm theo thứ tự ưu tiên, mỗi việc ở một nhóm — bị từ chối chờ giao lại → mới giao chưa xác nhận → có chỉ đạo chờ
// trả lời → sắp đến hạn / quá hạn chưa có minh chứng hợp lệ → đang thực hiện (tôi chủ trì). v3.23.1: phần "Cần xử lý ngay" chỉ vẽ bốn nhóm đầu;
// mọi việc (kể cả đang thực hiện, theo dõi, đã xong) xem ở phần theo văn bản gốc (van-ban-cua-toi.js). Thẻ vẽ ở the-viec-gon.js. Quyền thật ở DB.
import { escapeHtml, formatDateTime } from '../../lib/dom.js';
import { state, findAccount } from '../../lib/state.js';
import { deNghiToiGuiDangCho } from '../../lib/kl/sua-tang.js';
import { dh } from '../shared/dieu-hanh/du-lieu.js';

export const me = () => state.user?.id;
export const mo = (r) => r.tien_do_ma !== 'HOAN_THANH';
export const laCuaToi = (r) => r.owner_tai_khoan === me() || r.nguoi_theo_doi === me();
const canNhan = (r) => r.theo_1400 && mo(r) && !r.toi_da_xac_nhan && laCuaToi(r) && !r.bi_tu_choi; // chính tôi chưa nhận (owner / người theo dõi mỗi người tự nhận)
export const choNghiemThu = (r) => ['CHO_NGHIEM_THU', 'QUA_HAN_NGHIEM_THU'].includes(r.nhom_dem);
// Chỉ đạo (không phải Thường trực) đang chờ TÔI trả lời trên một việc.
export const chiDaoCua = (id) => dh.chiDaoCho.filter((c) => c.nhiem_vu_id === id && c.nguoi_gui !== me() && c.loai !== 'CHI_DAO_TT');
// Quá hạn (mở, Đỏ / Đỏ đặc biệt — gồm quá hạn ở bước xác nhận minh chứng cũ, đang đính chính).
export const quaHan = (r) => mo(r) && ['DO', 'DO_DAC_BIET'].includes(r.muc_canh_bao);

// Kết quả đề nghị từ chối của TÔI (GĐ22, mục 5b): đã đồng ý → chờ giao lại; không đồng ý → phải nhận việc (kèm ý kiến) cho tới khi xác nhận.
export const ketQuaTuChoi = (r) => {
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

// rows: việc của tôi (chủ trì hoặc theo dõi). Trả các nhóm ưu tiên + theo dõi (đang mở, không chủ trì) + đã hoàn thành + tất cả.
export function nhomViecCuaToi(rows = dh.rows.filter(laCuaToi)) {
  const daXep = new Set();
  const lay = (ds) => { const kq = ds.filter((r) => !daXep.has(r.id)); kq.forEach((r) => daXep.add(r.id)); return kq; };
  const tuChoi = lay(rows.filter((r) => r.bi_tu_choi && mo(r))); // đề nghị từ chối đã được đồng ý (0034), chờ lãnh đạo giao lại
  const moi = lay(rows.filter(canNhan));
  const chiDao = lay(rows.filter((r) => mo(r) && chiDaoCua(r.id).length));
  const canMinhChung = lay(rows.filter((r) => mo(r) && ['VANG', 'DO', 'DO_DAC_BIET'].includes(r.muc_canh_bao) && (r.so_minh_chung_hop_le || 0) === 0 && !choNghiemThu(r)));
  const dangLam = lay(rows.filter((r) => mo(r) && r.owner_tai_khoan === me()));
  const theoDoi = rows.filter((r) => mo(r) && !daXep.has(r.id));   // tôi theo dõi (không chủ trì), không cần làm gì ngay
  const xong = rows.filter((r) => !mo(r));
  return { tuChoi, moi, chiDao, canMinhChung, dangLam, theoDoi, xong, tatCa: rows };
}
// Đề nghị sửa của tôi đang chờ duyệt (0071): thẻ ghi "chờ … duyệt" + nút Rút thay nút Đề nghị sửa. Đọc khi nạp trang và mỗi lần số chưa xử lý
// làm mới (a3/index.js — sau ghi, theo hai kênh realtime); trả true khi danh sách đổi (để vẽ lại).
let dnsCuaToi = [];
export async function napDnsCuaToi() {
  const ds = await deNghiToiGuiDangCho();
  const doi = ds.map((d) => d.id).join() !== dnsCuaToi.map((d) => d.id).join();
  dnsCuaToi = ds;
  return doi;
}
export const dnsCho = (id) => dnsCuaToi.find((d) => d.nhiem_vu_id === id);
