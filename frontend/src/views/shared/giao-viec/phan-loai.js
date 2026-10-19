// Giao việc — phân loại bắt buộc (v3.26, 0116; chủ dự án 19/10/2026: "nhắc người dùng điền khi giao nhiệm vụ để số liệu dashboard chính xác; nhiệm
// vụ không thuộc lĩnh vực nào thì phải chọn không thuộc"). Mọi thẻ nhiệm vụ phải có:
//  - ngành + lĩnh vực, hoặc "Không thuộc ngành, lĩnh vực nào" (mục cố định của danh mục — KHONG_THUOC / LV99_KHONG_THUOC); Kết luận BTV / Thông báo
//    Thường trực chỉ chọn ngành cụ thể (ô ngành không có mục "Không thuộc"; DB chặn — trigger 0116);
//  - mục tiêu then chốt (gắn riêng hoặc theo văn bản), hoặc "Không thuộc mục tiêu then chốt".
// Thường trực (A0) giao: như trước — chỉ Kết luận / Thông báo đòi ngành, lĩnh vực; mục tiêu không bắt buộc (Văn phòng phân loại sau ở màn Rà soát).
// Chỉ đọc DOM / trạng thái ô chọn; DB vẫn nhận việc chưa phân loại từ nhập Excel, API (hiện "Chưa phân loại" ở Tổng quan, Rà soát).
import { danhMucKl, linhVucCuaNganh } from '../../../lib/kl/du-lieu.js';
import { soDaChon } from '../../../lib/kl/goi-y-muc-tieu.js';
import { KHONG_THUOC } from '../../../lib/kl/muc-tieu.js';
import { layO } from '../kl/chon-muc-tieu.js';
import { laA0, canNganhHienTai } from './trang-thai.js';

export const canNganhBatBuoc = () => !laA0() || canNganhHienTai();
export const canMucTieuBatBuoc = () => !laA0() && (danhMucKl().mucTieu || []).length > 0;
// Thẻ (khoá ô chọn mục tiêu — muc-tieu.js khoaThe) chưa có mục tiêu nào, kể cả "Không thuộc" (số hiệu mới đang tích cũng tính là đã chọn).
export const thieuMucTieu = (khoa) => canMucTieuBatBuoc() && Boolean(layO(khoa)) && soDaChon(layO(khoa).tt) === 0;
// Ô ngành: Kết luận / Thông báo không có "Không thuộc".
export const nganhChoPhep = (n) => n.ma !== KHONG_THUOC || !canNganhHienTai();
export const mucThieuNganh = () => (canNganhHienTai() ? 'ngành' : 'ngành (hoặc "Không thuộc")');   // kết luận / thông báo: không có "Không thuộc"
export const MUC_THIEU_MT = 'mục tiêu then chốt (hoặc "Không thuộc")';
// Dòng nhắc (ẩn với Thường trực — mục tiêu không bắt buộc): kết luận / thông báo không có ngành "Không thuộc".
const NHAC_DAU = 'Ngành – lĩnh vực và mục tiêu then chốt là căn cứ số liệu khối 2, 3 của Tổng quan — bắt buộc chọn ở mọi thẻ.';
const NHAC_AI = 'đọc văn bản gốc (PDF) rồi bấm "Điền" thì trợ lý AI đề xuất sẵn, đồng chí kiểm tra.';
export const nhacPhanLoai = () => `${NHAC_DAU} ${canNganhHienTai() ? 'Kết luận, thông báo: chọn ngành, lĩnh vực cụ thể; nhiệm vụ không phục vụ mục tiêu nào thì chọn "Không thuộc mục tiêu then chốt"'
  : 'Nhiệm vụ không thuộc ngành, mục tiêu nào thì chọn "Không thuộc"'}; ${NHAC_AI}`;
export const NHAC = `${NHAC_DAU} Nhiệm vụ không thuộc ngành, mục tiêu nào thì chọn "Không thuộc"; ${NHAC_AI}`;
export const chuThichNganh = () => (!canNganhBatBuoc() ? 'không bắt buộc với loại văn bản này'
  : canNganhHienTai() ? 'bắt buộc — kết luận / thông báo chọn ngành, lĩnh vực cụ thể' : 'bắt buộc — không thuộc ngành nào thì chọn "Không thuộc ngành, lĩnh vực nào"');
// Lĩnh vực duy nhất của ngành đang chọn trong phạm vi được giao (cho) → tự chọn; không thì ''.
export function linhVucDuyNhat(nganh, cho = null) {
  const ds = linhVucCuaNganh(nganh).filter((l) => !cho || cho.has(l.ma));
  return nganh && ds.length === 1 ? ds[0].ma : '';
}
