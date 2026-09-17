// Hành động tại chỗ trên thẻ / dòng của các màn hình điều hành (A0/A1/A2/A3): mở/đóng ô một dòng, điền gợi ý, gửi chỉ đạo Thường trực
// (A0), đôn đốc (A1/A2), phản hồi chỉ đạo, xác nhận minh chứng hợp lệ / không hợp lệ, xem diễn biến. Mọi ghi qua hàm DB 0026/0028/0032;
// sau mỗi hành động màn hình gọi lại hàm nạp (napLai) do màn hình đăng ký.
import { $ } from '../../../lib/dom.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { chiDaoGui, chiDaoPhanHoi, deNghiTuChoi, duyetTuChoi } from '../../../lib/kl/dieu-hanh.js';
import { xacNhanMinhChung } from '../../../lib/kl/minh-chung.js';
import { moNhiemVu } from '../kl/index.js';

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
const thanhCong = async (form, chu) => { form.classList.remove('mo'); form.reset(); notifySuccess(chu); await napLai(); };

// A0: chỉ đạo Thường trực — người nhận tự tính, hạn phản hồi 2 ngày làm việc (0032).
async function guiChiDaoTTThe(ds, form) {
  const nd = noiDung(form);
  if (!nd) { notifyError('Cần một dòng nội dung.'); return; }
  try {
    await chiDaoGui({ nhiem_vu_id: ds.id, loai: 'CHI_DAO_TT', noi_dung: nd });
    await thanhCong(form, `Đã gửi chỉ đạo cho ${ds.ma}. Chánh Văn phòng và PCVP phụ trách có thông báo; trạng thái phản hồi hiện ngay trên trang này.`);
  } catch (e) { notifyError(e.message); }
}
// A1/A2: đôn đốc (DON_DOC); traLoiCho = chỉ đạo Thường trực đang chờ → chỉ đạo con, Thường trực được báo đã chuyển xuống.
async function guiDonDocThe(ds, form) {
  const nd = noiDung(form);
  if (!nd) { notifyError('Cần một dòng nội dung.'); return; }
  try {
    await chiDaoGui({ nhiem_vu_id: ds.id, loai: 'DON_DOC', noi_dung: nd, ...(ds.traLoiCho ? { tra_loi_cho: ds.traLoiCho } : {}) });
    await thanhCong(form, `Đã gửi đôn đốc cho ${ds.ma}. Người liên quan nhận thông báo trên hệ thống.`);
  } catch (e) { notifyError(e.message); }
}
// Phản hồi một chỉ đạo (A1 trả lời Thường trực; A2 phản hồi thay; A3 trả lời chỉ đạo).
async function phanHoiThe(ds, form) {
  const nd = noiDung(form);
  if (!nd) { notifyError('Cần một dòng nội dung.'); return; }
  try {
    await chiDaoPhanHoi({ chi_dao_id: ds.chiDao, noi_dung: nd });
    await thanhCong(form, 'Đã gửi phản hồi.');
  } catch (e) { notifyError(e.message); }
}
// Minh chứng chờ xác nhận: Hợp lệ (một bấm) / Không hợp lệ (ô lý do bắt buộc, MC-6).
async function mcHopLeThe(ds) {
  try { await xacNhanMinhChung(ds.id, true); notifySuccess('Đã xác nhận minh chứng hợp lệ.'); await napLai(); } catch (e) { notifyError(e.message); }
}
async function mcKhongHopLeThe(ds, form) {
  const lyDo = noiDung(form);
  if (!lyDo) { notifyError('Bác minh chứng phải ghi lý do.'); return; }
  try { await xacNhanMinhChung(ds.id, false, lyDo); await thanhCong(form, 'Đã ghi minh chứng không hợp lệ. Người nộp nhận thông báo.'); } catch (e) { notifyError(e.message); }
}
// Giao lại tại chỗ (GIAO_LAI 0026): người theo dõi mới + một dòng lý do; cờ bị từ chối tự xoá (0034).
async function giaoLaiThe(ds, form) {
  const moi = new FormData(form).get('nguoi_theo_doi_moi'); const nd = noiDung(form);
  if (!moi) { notifyError('Chọn người theo dõi mới.'); return; }
  if (!nd) { notifyError('Cần một dòng lý do giao lại.'); return; }
  try {
    await chiDaoGui({ nhiem_vu_id: ds.id, loai: 'GIAO_LAI', noi_dung: nd, nguoi_theo_doi_moi: moi });
    await thanhCong(form, `Đã giao lại ${ds.ma}. Người theo dõi mới và người cũ nhận thông báo.`);
  } catch (e) { notifyError(e.message); }
}
// Từ chối nhận việc (0034): đề nghị (lý do bắt buộc, chỉ cấp duyệt và cấp trên đọc) / duyệt (nút bấm quyết định đồng ý hay không).
async function deNghiTuChoiThe(ds, form) {
  const nd = noiDung(form);
  if (!nd) { notifyError('Đề nghị từ chối phải có lý do.'); return; }
  try {
    await deNghiTuChoi(ds.id, nd);
    await thanhCong(form, `Đã gửi đề nghị từ chối ${ds.ma}. Lãnh đạo trực tiếp của đồng chí sẽ duyệt; hạn và trạng thái việc không đổi.`);
  } catch (e) { notifyError(e.message); }
}
// Quyết định chỉ qua hai nút bấm (data-dong-y); Enter trong ô ý kiến (submit form) không được coi là đồng ý.
async function duyetTuChoiThe(ds, el) {
  const form = el.tagName === 'FORM' ? el : el.closest('form');
  if (ds.dongY !== '1' && ds.dongY !== '0') { notifyError('Bấm "Đồng ý từ chối" hoặc "Không đồng ý".'); return; }
  const dongY = ds.dongY === '1';
  try {
    await duyetTuChoi(ds.id, dongY, noiDung(form));
    await thanhCong(form, dongY ? `Đã đồng ý từ chối ${ds.ma}. Việc chờ giao lại cho người khác.` : `Đã ghi không đồng ý với đề nghị từ chối ${ds.ma}. Người đề nghị tiếp tục thực hiện.`);
  } catch (e) { notifyError(e.message); }
}
const xemDienBien = ({ id, ma }) => moNhiemVu(id, ma, 'chi-tiet');
const moChiDaoViec = ({ id, ma }) => moNhiemVu(id, ma, 'chi-dao');

export function mountHanhDongDieuHanh() {
  registerActions({ moO, dongO, dienGoiY, guiChiDaoTTThe, guiDonDocThe, phanHoiThe, mcHopLeThe, mcKhongHopLeThe, xemDienBien, moChiDaoViec,
    giaoLaiThe, deNghiTuChoiThe, duyetTuChoiThe });
}
