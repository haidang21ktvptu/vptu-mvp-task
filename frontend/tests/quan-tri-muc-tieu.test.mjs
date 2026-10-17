// Unit test phần thuần của Quản trị › Danh mục mục tiêu, Cấu hình AI (v3.25 — views/shared/quan-tri/muc-tieu-thuan.js): quyền hiển thị như
// kl_quyen_muc_tieu / kl_sua_muc_tieu (0108), lọc danh mục, mô tả kiểm thử / soạn quy tắc, nhà cung cấp AI khớp secret của Edge Function, so sánh
// và kiểm cấu hình AI như CHECK của cau_hinh_ai (0112), mô tả dòng nhật ký danh mục.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { laQuanTriMt, laNhapMt, quyenSuaMt, locMucTieu, demQuyTac, moTaKiemThu, moTaSoanAi, NHA_CUNG_CAP_AI, doiCauHinhAi, kiemCauHinhAi, moTaThayDoiDm }
  from '../src/views/shared/quan-tri/muc-tieu-thuan.js';
import { NHA_CUNG_CAP } from '../../supabase/functions/tro-ly-ai/nha-cung-cap.js';

const qt = { id: 'q', role_group: 'A3', quan_tri_he_thong: true };
const cv = { id: 'c', role_group: 'A3' };
const tq = { id: 't', role_group: 'A1', vai_goc: 'A3', toan_quyen: true };

test('quyền: quản trị hệ thống, toàn quyền; Thường trực, tài khoản khoá không nhập liệu', () => {
  assert.equal(laQuanTriMt(qt), true); assert.equal(laQuanTriMt(tq), true); assert.equal(laQuanTriMt(cv), false);
  assert.equal(laQuanTriMt({ ...qt, bi_khoa: true }), false);
  assert.equal(laNhapMt(cv), true); assert.equal(laNhapMt({ role_group: 'A0' }), false); assert.equal(laNhapMt({ ...cv, is_system: true }), false);
});

test('sửa mục tiêu: quản trị (mục đã đối chiếu phải mở khoá trước); người thêm sửa mục MOI của mình', () => {
  const moi = { ma: 'MT_A', trang_thai: 'MOI', nguon_them: 'NGUOI_DUNG', tao_boi: 'c' };
  assert.equal(quyenSuaMt(qt, moi), 'sua');
  assert.equal(quyenSuaMt(qt, { ...moi, trang_thai: 'DA_DOI_CHIEU' }), 'mo_khoa_truoc');
  assert.equal(quyenSuaMt(cv, moi), 'sua');
  assert.equal(quyenSuaMt(cv, { ...moi, tao_boi: 'khac' }), null);
  assert.equal(quyenSuaMt(cv, { ...moi, nguon_them: 'TU_DONG' }), null);
  assert.equal(quyenSuaMt(qt, { ...moi, gop_vao: 'MT_B' }), null);
});

test('lọc danh mục: mặc định đang dùng; tìm không dấu theo tên, số hiệu; trạng thái', () => {
  const ds = [{ ma: 'NQ_57', nhom: 'NQ_TW', ten: 'Nghị quyết số 57-NQ/TW', ten_ngan: 'Nghị quyết 57-NQ/TW', so_hieu: '57-NQ/TW', trang_thai: 'DA_DOI_CHIEU', dang_dung: true },
    { ma: 'DP_CAN_BO', nhom: 'DOT_PHA', ten: 'Nâng cao chất lượng đội ngũ cán bộ', ten_ngan: 'Đột phá cán bộ', trang_thai: 'MOI', dang_dung: true },
    { ma: 'CU', nhom: 'DOT_PHA', ten: 'Mục cũ', ten_ngan: 'Mục cũ', trang_thai: 'MOI', dang_dung: false, gop_vao: 'DP_CAN_BO' }];
  assert.deepEqual(locMucTieu(ds).map((m) => m.ma), ['NQ_57', 'DP_CAN_BO']);
  assert.deepEqual(locMucTieu(ds, { tim: 'dot pha can bo' }).map((m) => m.ma), ['DP_CAN_BO']);
  assert.deepEqual(locMucTieu(ds, { tim: '57-nq' }).map((m) => m.ma), ['NQ_57']);
  assert.deepEqual(locMucTieu(ds, { trangThai: 'MOI' }).map((m) => m.ma), ['DP_CAN_BO']);
  assert.deepEqual(locMucTieu(ds, { trangThai: 'NGUNG' }).map((m) => m.ma), ['CU']);
  assert.equal(locMucTieu(ds, { trangThai: 'TAT_CA', nhom: 'DOT_PHA' }).length, 2);
});

test('bộ đếm tự học, kết quả kiểm thử, kết quả soạn bằng AI', () => {
  assert.equal(demQuyTac({ muc: 'GOI_Y', so_lan_hien: 0 }), 'chưa hiện lần nào');
  assert.equal(demQuyTac({ muc: 'TU_TICH', so_lan_hien: 20, so_lan_nhan: 19, so_lan_bo: 1 }), 'hiện 20 · giữ 19 (95%) · bỏ 1');
  assert.match(moTaKiemThu({ tong: 200, khop: 50, xac_nhan: 10, dung: 9 }), /Khớp 50\/200 việc gốc \(25%\); trong 10 việc khớp đã gắn mục tiêu, 9 việc đúng mục tiêu này \(90%\) — quá rộng/);
  assert.match(moTaKiemThu({ tong: 5, khop: 1, xac_nhan: 0, dung: 0 }), /chưa có việc khớp nào đã gắn/);
  assert.match(moTaSoanAi({ them: 3, quy_tac: [{ trang_thai: 'BAT' }, { trang_thai: 'BAT' }, { trang_thai: 'TAT' }] }), /thêm 3 quy tắc: 2 đang bật.*1 tự tắt/);
  assert.match(moTaSoanAi({ them: 0, quy_tac: [] }), /không có quy tắc mới/);
});

test('nhà cung cấp AI: cùng tên secret với Edge Function tro-ly-ai (không có giả lập ở giao diện)', () => {
  NHA_CUNG_CAP_AI.forEach((n) => assert.equal(NHA_CUNG_CAP[n.ma]?.khoa, n.khoa, n.ma));
  assert.equal(NHA_CUNG_CAP_AI.some((n) => n.ma === 'gia_lap'), false);
});

test('cấu hình AI: chỉ gửi phần đổi; kiểm như CHECK của bảng', () => {
  const cu = { nha_cung_cap: 'anthropic', mo_hinh: 'claude-sonnet-5-5', dia_chi: null, muc_suy_nghi: 'medium', bat: true, gui_noi_dung: true, gioi_han_ngay: 300, gioi_han_nguoi: 40 };
  assert.deepEqual(doiCauHinhAi(cu, { ...cu }), {});
  assert.deepEqual(doiCauHinhAi(cu, { ...cu, nha_cung_cap: 'gemini', mo_hinh: 'gemini-2.5-pro', dia_chi: '' }), { nha_cung_cap: 'gemini', mo_hinh: 'gemini-2.5-pro' });
  assert.equal(kiemCauHinhAi(cu), null);
  assert.match(kiemCauHinhAi({ ...cu, mo_hinh: 'mô hình' }), /Tên mô hình/);
  assert.match(kiemCauHinhAi({ ...cu, nha_cung_cap: 'khac', dia_chi: null }), /địa chỉ https/);
  assert.match(kiemCauHinhAi({ ...cu, nha_cung_cap: 'khac', dia_chi: 'http://a.vn' }), /https/);
  assert.equal(kiemCauHinhAi({ ...cu, nha_cung_cap: 'khac', dia_chi: 'https://api.dichvu.vn/v1' }), null);
  assert.match(kiemCauHinhAi({ ...cu, gioi_han_nguoi: 0 }), /mỗi người/);
  assert.match(kiemCauHinhAi({ ...cu, nha_cung_cap: 'gia_lap' }), /nhà cung cấp/);
});

test('nhật ký danh mục: thêm lĩnh vực, quy tắc, gộp, sửa nhiều cột', () => {
  assert.equal(moTaThayDoiDm({ bang: 'dm_linh_vuc', hanh_dong: 'them', gia_tri_moi: { ten: 'Tài chính công', nganh_ma: 'N8' } }, { nganh: () => 'ngành 8' }), 'Thêm "Tài chính công" vào ngành 8');
  assert.equal(moTaThayDoiDm({ bang: 'quy_tac_muc_tieu', hanh_dong: 'them', gia_tri_moi: { loai: 'TU_KHOA', gia_tri: 'chuyển đổi số', muc_tieu_ma: 'DP_KHCN_CDS', muc: 'GOI_Y' } }),
    'Từ khoá "chuyển đổi số" cho DP_KHCN_CDS · Gợi ý');
  assert.equal(moTaThayDoiDm({ bang: 'dm_muc_tieu', hanh_dong: 'gop', gia_tri_moi: { gop_vao: 'NQ_57', so_viec: 4, so_van_ban: 1 } }), 'Gộp vào NQ_57 — chuyển 4 việc, 1 văn bản');
  assert.equal(moTaThayDoiDm({ bang: 'dm_muc_tieu', hanh_dong: 'sua', gia_tri_cu: { ten_ngan: 'A', thu_tu: 2 }, gia_tri_moi: { ten_ngan: 'B', thu_tu: 3 } }),
    'tên ngắn: "A" → "B"; thứ tự: "2" → "3"');
  assert.equal(moTaThayDoiDm({ bang: 'quy_tac_muc_tieu', hanh_dong: 'doi_muc', gia_tri_cu: { muc: 'GOI_Y', trang_thai: 'BAT' }, gia_tri_moi: { muc: 'TU_TICH', trang_thai: 'BAT' } }),
    'mức: "Gợi ý" → "Tích sẵn"');   // hệ thống ghi cả cột không đổi — chỉ hiện cột đổi
  assert.equal(moTaThayDoiDm({ bang: 'dm_nganh', hanh_dong: 'sua', gia_tri_cu: { khoi_ma: 'KT' }, gia_tri_moi: { khoi_ma: 'XD' } }, { khoi: (m) => ({ KT: 'Kinh tế', XD: 'Xây dựng Đảng' })[m] }),
    'khối: "Kinh tế" → "Xây dựng Đảng"');
});
