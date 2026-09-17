// Hành động tại chỗ trên thẻ / dòng của các màn hình điều hành (A0/A1/A2/A3): mở/đóng ô một dòng, điền gợi ý, gửi chỉ đạo Thường trực
// (A0), đôn đốc (A1/A2), phản hồi chỉ đạo, xác nhận minh chứng hợp lệ / không hợp lệ, xem diễn biến. Mọi ghi qua hàm DB 0026/0028/0032;
// sau mỗi hành động màn hình gọi lại hàm nạp (napLai) do màn hình đăng ký.
import { $ } from '../../../lib/dom.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { chiDaoGui, chiDaoPhanHoi, deNghiTuChoi, duyetTuChoi } from '../../../lib/kl/dieu-hanh.js';
import { xacNhanMinhChung } from '../../../lib/kl/minh-chung.js';
import { xacNhanNhanViec } from '../../../lib/kl/du-lieu.js';
import { dh } from './du-lieu.js';
import { veDieuHanh } from './man-hinh.js';
import { napLaiViec } from '../kl/nap-lai-viec.js';
import { chonDoKhan } from '../../../lib/kl/do-khan.js';
import { moNhiemVu } from '../kl/index.js';
import { xemDienBien } from '../dien-bien.js';
import { lamMoiHuyHieu } from '../../../features/huy-hieu.js';

let napLai = async () => {};
export const datNapLai = (fn) => { napLai = fn; };

export function moO({ o }) {
  const f = $(o);
  if (!f) return;
  f.classList.toggle('mo');
  if (f.classList.contains('mo')) f.querySelector('input, textarea')?.focus();
}
export function dongO({ o }) { $(o)?.classList.remove('mo'); }
export function dienGoiY({ goiY }, el) {
  const inp = el.closest('form')?.querySelector('input[name=noi_dung]');
  if (inp) { inp.value = goiY; inp.focus(); }
}
const noiDung = (form) => (new FormData(form).get('noi_dung') || '').trim();
// Việc của một nút/biểu mẫu trên thẻ: data-id là việc, hoặc khối cha có data-nhiem-vu / id="the-<id>" (đề nghị từ chối, minh chứng, phản hồi).
const nvCua = (el, ds) => ds?.nv || el?.closest?.('[data-nhiem-vu]')?.dataset.nhiemVu || el?.closest?.('[id^="the-"]')?.id.slice(4) || null;
// Sau hành động ghi thành công (GĐ23): nạp lại đúng việc đó ngay (thẻ / ngăn / dòng), rồi nạp lại trang; không phụ thuộc realtime.
const thanhCong = async (form, chu, nvId) => { form.classList.remove('mo'); form.reset(); notifySuccess(chu); await napLaiViec(nvId); await napLai(); };

// A0: chỉ đạo Thường trực — người nhận tự tính, hạn phản hồi 2 ngày làm việc (0032).
async function guiChiDaoTTThe(ds, form) {
  const nd = noiDung(form);
  if (!nd) { notifyError('Cần một dòng nội dung.'); return; }
  try {
    await chiDaoGui({ nhiem_vu_id: ds.id, loai: 'CHI_DAO_TT', noi_dung: nd });
    await thanhCong(form, `Đã gửi chỉ đạo cho ${ds.ma}. Chánh Văn phòng và PCVP phụ trách có thông báo; trạng thái phản hồi hiện ngay trên trang này.`, ds.id);
  } catch (e) { notifyError(e.message); }
}
// A1/A2: đôn đốc (DON_DOC); traLoiCho = chỉ đạo Thường trực đang chờ → chỉ đạo con, Thường trực được báo đã chuyển xuống.
async function guiDonDocThe(ds, form) {
  const nd = noiDung(form);
  if (!nd) { notifyError('Cần một dòng nội dung.'); return; }
  try {
    await chiDaoGui({ nhiem_vu_id: ds.id, loai: 'DON_DOC', noi_dung: nd, ...(ds.traLoiCho ? { tra_loi_cho: ds.traLoiCho } : {}) });
    await thanhCong(form, `Đã gửi đôn đốc cho ${ds.ma}. Người liên quan nhận thông báo trên hệ thống.`, ds.id);
  } catch (e) { notifyError(e.message); }
}
// Phản hồi một chỉ đạo (A1 trả lời Thường trực; A2 phản hồi thay; A3 trả lời chỉ đạo).
async function phanHoiThe(ds, form) {
  const nd = noiDung(form);
  if (!nd) { notifyError('Cần một dòng nội dung.'); return; }
  try {
    await chiDaoPhanHoi({ chi_dao_id: ds.chiDao, noi_dung: nd });
    await thanhCong(form, 'Đã gửi phản hồi.', nvCua(form, ds));
  } catch (e) { notifyError(e.message); }
}
// Minh chứng chờ xác nhận: Hợp lệ (một bấm) / Không hợp lệ (ô lý do bắt buộc, MC-6).
async function mcHopLeThe(ds) {
  try { await xacNhanMinhChung(ds.id, true); notifySuccess('Đã xác nhận minh chứng hợp lệ.'); await napLaiViec(ds.nv); await napLai(); } catch (e) { notifyError(e.message); }
}
async function mcKhongHopLeThe(ds, form) {
  const lyDo = noiDung(form);
  if (!lyDo) { notifyError('Bác minh chứng phải ghi lý do.'); return; }
  try { await xacNhanMinhChung(ds.id, false, lyDo); await thanhCong(form, 'Đã ghi minh chứng không hợp lệ. Người nộp nhận thông báo.', nvCua(form, ds)); } catch (e) { notifyError(e.message); }
}
// Giao lại tại chỗ (GIAO_LAI 0026): người theo dõi mới + một dòng lý do; cờ bị từ chối tự xoá (0034).
async function giaoLaiThe(ds, form) {
  const moi = new FormData(form).get('nguoi_theo_doi_moi'); const nd = noiDung(form);
  if (!moi) { notifyError('Chọn người theo dõi mới.'); return; }
  if (!nd) { notifyError('Cần một dòng lý do giao lại.'); return; }
  try {
    await chiDaoGui({ nhiem_vu_id: ds.id, loai: 'GIAO_LAI', noi_dung: nd, nguoi_theo_doi_moi: moi });
    await thanhCong(form, `Đã giao lại ${ds.ma}. Người theo dõi mới và người cũ nhận thông báo.`, ds.id);
  } catch (e) { notifyError(e.message); }
}
// Từ chối nhận việc (0034): đề nghị (lý do bắt buộc, chỉ cấp duyệt và cấp trên đọc) / duyệt (nút bấm quyết định đồng ý hay không).
async function deNghiTuChoiThe(ds, form) {
  const nd = noiDung(form);
  if (!nd) { notifyError('Đề nghị từ chối phải có lý do.'); return; }
  try {
    await deNghiTuChoi(ds.id, nd);
    await thanhCong(form, `Đã gửi đề nghị từ chối ${ds.ma}. Lãnh đạo trực tiếp của đồng chí sẽ duyệt; hạn và trạng thái việc không đổi.`, ds.id);
  } catch (e) { notifyError(e.message); }
}
// Quyết định chỉ qua hai nút bấm (data-dong-y); Enter trong ô ý kiến (submit form) không được coi là đồng ý.
async function duyetTuChoiThe(ds, el) {
  const form = el.tagName === 'FORM' ? el : el.closest('form');
  if (ds.dongY !== '1' && ds.dongY !== '0') { notifyError('Bấm "Đồng ý từ chối" hoặc "Không đồng ý".'); return; }
  const dongY = ds.dongY === '1';
  try {
    await duyetTuChoi(ds.id, dongY, noiDung(form));
    await thanhCong(form, dongY ? `Đã đồng ý từ chối ${ds.ma}. Việc chờ giao lại cho người khác.` : `Đã ghi không đồng ý với đề nghị từ chối ${ds.ma}. Người đề nghị tiếp tục thực hiện.`, nvCua(el, ds));
  } catch (e) { notifyError(e.message); }
}
const moChiDaoViec = ({ id, ma }) => moNhiemVu(id, ma, 'chi-dao');
// Xác nhận đã nhận việc Thường trực giao ngay tại khối đầu trang (A1/A2, GĐ22): chỉ ghi lịch sử (0025), huy hiệu và trang nạp lại.
async function xacNhanNhanTT({ id, ma }) {
  try {
    const moi = await xacNhanNhanViec(id);
    notifySuccess(moi ? `Đã xác nhận nhận việc ${ma}. Thường trực được báo; hạn và trạng thái không đổi.` : 'Đồng chí đã xác nhận nhận việc này trước đó.');
    // Hàm DB đã ghi: cập nhật dòng cục bộ và vẽ lại ngay (khối Thường trực giao biến mất tức thì), không chờ nạp lại toàn trang (staging bận có thể vài giây).
    const r = dh.rows.find((x) => x.id === id); if (r) { r.da_xac_nhan_nhan = true; veDieuHanh(); }
    await napLaiViec(id); await lamMoiHuyHieu(); await napLai();
  } catch (e) { notifyError('Không xác nhận được: ' + e.message); }
}
// Dải "Cần xử lý ngay": cuộn tới khối trong trang (id), không có thì về đầu trang.
const cuonToi = ({ toi }) => { const el = $(toi); if (el && !el.classList.contains('hidden')) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); else window.scrollTo({ top: 0, behavior: 'smooth' }); };

export function mountHanhDongDieuHanh() {
  registerActions({ moO, dongO, dienGoiY, guiChiDaoTTThe, guiDonDocThe, phanHoiThe, mcHopLeThe, mcKhongHopLeThe, xemDienBien, moChiDaoViec,
    giaoLaiThe, deNghiTuChoiThe, duyetTuChoiThe, xacNhanNhanTT, chonDoKhan, cuonToi });
}
