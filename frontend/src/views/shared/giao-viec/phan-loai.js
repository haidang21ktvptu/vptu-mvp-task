// Giao việc — phân loại bắt buộc (v3.26, 0116; chủ dự án 19/10/2026: "nhắc người dùng điền khi giao nhiệm vụ để số liệu dashboard chính xác; nhiệm
// vụ không thuộc lĩnh vực nào thì phải chọn không thuộc"). Mọi thẻ nhiệm vụ phải có:
//  - ngành/lĩnh vực, hoặc "Không thuộc ngành, lĩnh vực nào" (mục cố định của danh mục — KHONG_THUOC / LV99_KHONG_THUOC); Kết luận BTV / Thông báo
//    Thường trực chỉ chọn ngành cụ thể (ô ngành không có mục "Không thuộc"; DB chặn — trigger 0116). v3.29 (chủ dự án 22/10/2026): bỏ ô Lĩnh vực —
//    bảng Phụ lục chỉ có cột Ngành/lĩnh vực, Lĩnh vực chi tiết; lĩnh vực (danh mục) tự xác định (linhVucTuDong) vào ô ẩn klThLinhVuc / [data-cot=linh_vuc];
//  - mục tiêu then chốt (gắn riêng hoặc theo văn bản), hoặc "Không thuộc mục tiêu then chốt" — v3.27: tạm ẩn (lib/kl/muc-tieu.js HIEN_MUC_TIEU).
// Thường trực (A0) giao: như trước — chỉ Kết luận / Thông báo đòi ngành/lĩnh vực; mục tiêu không bắt buộc (Văn phòng phân loại sau ở màn Rà soát).
// Chỉ đọc DOM / trạng thái ô chọn; DB vẫn nhận việc chưa phân loại từ nhập Excel, API (hiện "Chưa phân loại" ở Tổng quan, Rà soát).
import { danhMucKl, coMucTieu } from '../../../lib/kl/du-lieu.js';
import { linhVucMacDinh } from '../../../lib/kl/nhap/mac-dinh.js';
import { soDaChon } from '../../../lib/kl/goi-y-muc-tieu.js';
import { KHONG_THUOC } from '../../../lib/kl/muc-tieu.js';
import { layO } from '../kl/chon-muc-tieu.js';
import { laA0, canNganhHienTai } from './trang-thai.js';

export const canNganhBatBuoc = () => !laA0() || canNganhHienTai();
export const canMucTieuBatBuoc = () => !laA0() && coMucTieu();   // v3.27: mục tiêu tạm ẩn → không bắt buộc
// Thẻ (khoá ô chọn mục tiêu — muc-tieu.js khoaThe) chưa có mục tiêu nào, kể cả "Không thuộc" (số hiệu mới đang tích cũng tính là đã chọn).
export const thieuMucTieu = (khoa) => canMucTieuBatBuoc() && Boolean(layO(khoa)) && soDaChon(layO(khoa).tt) === 0;
// Ô ngành: Kết luận / Thông báo không có "Không thuộc".
export const nganhChoPhep = (n) => n.ma !== KHONG_THUOC || !canNganhHienTai();
export const mucThieuNganh = () => (canNganhHienTai() ? 'ngành/lĩnh vực' : 'ngành/lĩnh vực (hoặc "Không thuộc")');   // kết luận / thông báo: không có "Không thuộc"
export const MUC_THIEU_MT = 'mục tiêu then chốt (hoặc "Không thuộc")';
// Dòng nhắc (ẩn với Thường trực): kết luận / thông báo không có ngành "Không thuộc". v3.27: mục tiêu then chốt tạm ẩn — câu nhắc chỉ còn ngành – lĩnh vực.
const NHAC_DAU = () => (coMucTieu() ? 'Ngành – lĩnh vực và mục tiêu then chốt là căn cứ số liệu "Thực hiện các mục tiêu then chốt", "Thực hiện theo lĩnh vực trọng tâm" của Tổng quan — bắt buộc chọn ở mọi thẻ.'
  : 'Ngành/lĩnh vực là căn cứ số liệu "Thực hiện theo lĩnh vực trọng tâm" của Tổng quan — bắt buộc chọn ở mọi thẻ.');
const NHAC_AI = 'đọc văn bản gốc (PDF) rồi bấm "Điền" thì trợ lý AI đề xuất sẵn, đồng chí kiểm tra.';
const KHONG = () => (coMucTieu() ? 'ngành, mục tiêu nào' : 'ngành, lĩnh vực nào');
export const nhacPhanLoai = () => `${NHAC_DAU()} ${canNganhHienTai() ? `Kết luận, thông báo: chọn ngành/lĩnh vực cụ thể${coMucTieu() ? '; nhiệm vụ không phục vụ mục tiêu nào thì chọn "Không thuộc mục tiêu then chốt"' : ''}`
  : `Nhiệm vụ không thuộc ${KHONG()} thì chọn "Không thuộc"`}; ${NHAC_AI}`;
export const NHAC = 'Ngành/lĩnh vực là căn cứ số liệu của Tổng quan — bắt buộc chọn ở mọi thẻ; nhiệm vụ không thuộc ngành, lĩnh vực nào thì chọn "Không thuộc".';
export const chuThichNganh = () => (!canNganhBatBuoc() ? 'không bắt buộc với loại văn bản này'
  : canNganhHienTai() ? 'bắt buộc — kết luận / thông báo chọn ngành/lĩnh vực cụ thể' : 'bắt buộc — không thuộc ngành nào thì chọn "Không thuộc ngành, lĩnh vực nào"');
// Lĩnh vực tự xác định (mã | ''): x = { nganh, chiTiet, noiDung, goiY, cho } — quy tắc ở lib/kl/nhap/mac-dinh.js linhVucMacDinh.
export const linhVucTuDong = (x) => linhVucMacDinh(x, danhMucKl())?.ma || '';
// Biểu mẫu mở mới: bỏ gợi ý; "Giao, nhập tiếp" (giu): nhớ lĩnh vực việc vừa giao (data-truoc) — việc sau cùng ngành mà lĩnh vực chi tiết, nội
// dung không nhận ra lĩnh vực thì lấy lại lĩnh vực đó (như ô chọn cũ giữ lựa chọn khi nhập tiếp).
export function nhoLinhVuc(o, giu) { delete o.dataset.goiY; if (giu && o.value) o.dataset.truoc = o.value; else delete o.dataset.truoc; }
// Người nhập gõ "Lĩnh vực chi tiết" → bỏ gợi ý (AI, dòng Excel): chữ người nhập ghi quyết định lĩnh vực (rà soát PR 1, v3.29).
export const boGoiYLinhVuc = (o) => { if (o) delete o.dataset.goiY; };
// Gợi ý lĩnh vực (trợ lý AI, dòng chờ nhập Excel) cho ô ẩn: ghi data-goi-y rồi phát change → biểu mẫu tính lại (gợi ý chỉ dùng khi hợp lệ).
export function goiYLinhVuc(o, ma) {
  if (!o) return;
  if (ma) o.dataset.goiY = String(ma); else delete o.dataset.goiY;
  o.dispatchEvent(new Event('change', { bubbles: true }));
}
