// Nhập Excel theo bảng Phụ lục (v3.27 — chủ dự án 20/10/2026: "điền đủ cột B tới M thì import được ngay"): cột "Chủ trì theo dõi" (cán bộ / VPTU / phòng),
// "Cơ quan/đơn vị trình" (ngoài Văn phòng + Văn phòng Tỉnh ủy), quy tắc điền mặc định (mac-dinh.js: sản phẩm, lĩnh vực, hạn, loại thời hạn), tiến độ
// "Chưa hoàn thành (quá hạn)", đơn vị ngoài Văn phòng ở cột đơn vị chủ trì → cơ quan trình, danh sách "Chờ hoàn thiện" tính lại (lỗi lô LO-0003 báo
// "thiếu đơn vị chủ trì" khi đã có cán bộ). Dữ liệu hư cấu (fixtures-nhap.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chuanGiaTri } from '../src/lib/kl/nhap/chuan-hoa.js';
import { danhGia } from '../src/lib/kl/nhap/danh-gia.js';
import { chuanDong } from '../src/lib/kl/nhap/bang.js';
import { sanPhamMacDinh, linhVucMacDinh, congThang, hanMacDinh, dienSanCho, chuDienSan } from '../src/lib/kl/nhap/mac-dinh.js';
import { chuKetQua } from '../src/lib/kl/nhap/mau.js';
import { CTX, DG, DM } from './fixtures-nhap.mjs';

const dong = (raw, soDong = 7) => chuanDong({ soDong, raw, goc: {} }, CTX);
// Một dòng bảng Phụ lục đủ B–M (A STT, N, O để trống) — việc đang làm của Kết luận BTV.
const PL = { so_hoi_nghi: 45, so_ket_luan: '45-KL/TU', ngay_ban_hanh: '01/08/2026', chu_tri: 'Đàm Văn Sơn', nganh: '8. Kinh tế tổng hợp - Tài chính - Đầu tư - Ngân sách',
  co_quan_trinh: '6. Đảng ủy Ủy ban nhân dân tỉnh', linh_vuc_chi_tiet: 'Đầu tư công', noi_dung: 'Báo cáo tiến độ giải ngân vốn', loai_thoi_han: 'Có hạn cụ thể',
  han_xu_ly: '31/12/2026', tien_do: 'Chưa hoàn thành (quá hạn)' };
const LANH_DAO = { ...DG, me: { id: 'qt', role_group: 'A1', is_chief: true } };   // tài khoản toàn quyền: như Chánh VP (lib/toan-quyen.js)

test('Chủ trì theo dõi: cán bộ → tk:, "VPTU" / tên Văn phòng → đơn vị Văn phòng Tỉnh ủy, tên phòng → đơn vị phòng; trùng họ tên → chọn lại', () => {
  assert.equal(chuanGiaTri('chuTri', 'Đàm Văn Sơn', CTX).ma, 'tk:tpqt');
  for (const v of ['VPTU', 'vptu', '1. Văn phòng Tỉnh ủy']) assert.equal(chuanGiaTri('chuTri', v, CTX).ma, 'dv:VAN_PHONG_TINH_UY', v);
  assert.equal(chuanGiaTri('chuTri', 'Phòng Quản trị', CTX).ma, 'dv:QUAN_TRI');
  const trung = chuanGiaTri('chuTri', 'Lý Văn Phúc', CTX);
  assert.ok(trung.loi?.includes('trùng tên')); assert.ok(trung.chon.every((x) => x.ma.startsWith('tk:')));
  assert.equal(chuanGiaTri('tienDo', 'Chưa hoàn thành (quá hạn)', CTX).ma, 'DANG_THUC_HIEN', 'không khớp gần đúng nhầm sang Hoàn thành');
  assert.equal(chuanGiaTri('tienDo', 'Cơ bản đã hoàn thành', CTX).ma, 'DANG_THUC_HIEN');
});

test('Dòng đủ B–M → GIAO ngay: chủ trì = cán bộ + người theo dõi, đơn vị theo phòng, cơ quan trình, lĩnh vực theo lĩnh vực chi tiết, sản phẩm theo quy tắc', () => {
  const kq = danhGia(dong(PL), { ...DG, hangLoat: { loai_van_ban: 'KL_BTV' } });
  assert.equal(kq.ket_qua, 'GIAO', kq.thieu.join(', '));
  const d = kq.du_lieu;
  assert.deepEqual([d.owner_tai_khoan, d.nguoi_theo_doi, d.owner_don_vi_ma, d.co_quan_trinh], ['tpqt', 'tpqt', 'QUAN_TRI', 'DANG_UY_UBND']);
  assert.deepEqual([d.nganh_ma, d.linh_vuc_ma, d.linh_vuc_chi_tiet, d.san_pham_loai, d.tien_do_ma, d.han_xu_ly], ['KTTH', 'LV_DT', 'Đầu tư công', 'BAO_CAO', 'DANG_THUC_HIEN', '2026-12-31']);
  assert.ok(kq.macDinh.has('san_pham') && kq.macDinh.has('linh_vuc') && kq.macDinh.has('don_vi'), [...kq.macDinh].join(','));
  assert.equal(d.loai_van_ban, 'KL_BTV');
  const ld = danhGia(dong(PL), { ...LANH_DAO, hangLoat: { loai_van_ban: 'TB_THUONG_TRUC' } });   // lãnh đạo nhập: không cần "Lãnh đạo giao"
  assert.equal(ld.ket_qua, 'GIAO'); assert.equal(ld.du_lieu.thay_mat_cho, null); assert.equal(ld.du_lieu.loai_van_ban, 'TB_THUONG_TRUC');
});

test('"VPTU" ở cột chủ trì: đơn vị Văn phòng Tỉnh ủy, người theo dõi = Chánh Văn phòng; việc đang làm chưa có hạn → 1 tháng kể từ hôm nay', () => {
  const kq = danhGia(dong({ ...PL, chu_tri: 'VPTU', han_xu_ly: undefined }), LANH_DAO);
  assert.equal(kq.ket_qua, 'GIAO', kq.thieu.join(', '));
  assert.deepEqual([kq.du_lieu.owner_don_vi_ma, kq.du_lieu.owner_tai_khoan, kq.du_lieu.nguoi_theo_doi], ['VAN_PHONG_TINH_UY', null, 'cvp']);
  assert.equal(kq.du_lieu.han_xu_ly, '2026-11-02'); assert.ok(kq.macDinh.has('han_xu_ly'));
});

test('Hoàn thành + "Đã xong ngoài hệ thống": nhập DA_XONG, giữ cơ quan trình và kết quả (cột M); việc đang làm có kết quả → ghi chú tiến độ', () => {
  const xong = danhGia(dong({ ...PL, tien_do: 'Hoàn thành', kq_mo_ta: 'Đã ban hành Kế hoạch số 12-KH/TU', han_xu_ly: undefined, loai_thoi_han: 'Nhiệm vụ thường xuyên' }), LANH_DAO);
  assert.equal(xong.ket_qua, 'DA_XONG');
  assert.deepEqual([xong.du_lieu.co_quan_trinh, xong.du_lieu.kq_mo_ta, xong.du_lieu.loai_thoi_han_ma, xong.du_lieu.han_xu_ly],
    ['DANG_UY_UBND', 'Đã ban hành Kế hoạch số 12-KH/TU', 'THUONG_XUYEN', null], 'việc đã xong: không đổi loại hạn, không tự điền hạn');
  const mo = danhGia(dong({ ...PL, kq_mo_ta: 'Đang tổng hợp số liệu' }), LANH_DAO);
  assert.equal(mo.ket_qua, 'GIAO'); assert.match(mo.du_lieu.ghi_chu, /Tiến độ theo tệp: Đang tổng hợp số liệu/);
});

test('"Chủ trì theo dõi" không khớp ai: Chờ hoàn thiện chỉ báo thiếu chủ trì theo dõi (không kèm "thiếu đơn vị chủ trì")', () => {
  const kq = danhGia(dong({ ...PL, chu_tri: 'Người Không Có Tên' }), LANH_DAO);
  assert.equal(kq.ket_qua, 'CHO_HOAN_THIEN');
  assert.ok(kq.thieu.includes('chu_tri') && !kq.thieu.includes('don_vi'), kq.thieu.join(', '));
});

test('Tệp kiểu cũ: đơn vị ngoài Văn phòng ở cột "Đơn vị chủ trì" có cán bộ chủ trì → thành cơ quan trình, không báo thiếu đơn vị', () => {
  const kq = danhGia(dong({ ...PL, chu_tri: undefined, can_bo: 'Đàm Văn Sơn', don_vi: 'Đảng ủy Ủy ban nhân dân tỉnh', co_quan_trinh: undefined }), LANH_DAO);
  assert.equal(kq.ket_qua, 'GIAO', kq.thieu.join(', '));
  assert.deepEqual([kq.du_lieu.owner_don_vi_ma, kq.du_lieu.co_quan_trinh], ['QUAN_TRI', 'DANG_UY_UBND']);
  assert.ok(kq.canhBao.some((c) => c.includes('ghi vào cơ quan/đơn vị trình')));
});

test('Quy tắc mặc định: sản phẩm theo nội dung, lĩnh vực theo lĩnh vực chi tiết / từ khoá / ngành, cộng tháng (cuối tháng), hạn từ hôm nay', () => {
  const sp = [{ ma: 'BAO_CAO' }, { ma: 'KE_HOACH' }, { ma: 'DE_AN' }, { ma: 'DU_THAO_VAN_BAN' }];
  assert.equal(sanPhamMacDinh('Thống nhất ban hành Kế hoạch triển khai Nghị quyết', 'CO_HAN_CU_THE', sp), 'KE_HOACH');
  assert.equal(sanPhamMacDinh('Giao xây dựng Đề án phát triển du lịch', 'CO_HAN_CU_THE', sp), 'DE_AN');
  assert.equal(sanPhamMacDinh('Tờ trình về công tác cán bộ', 'KY_BAN_HANH', sp), 'DU_THAO_VAN_BAN');
  assert.equal(sanPhamMacDinh('Rà soát, báo cáo', 'CO_HAN_CU_THE', sp), 'BAO_CAO');
  assert.equal(sanPhamMacDinh('Ban hành kế hoạch', 'CO_HAN_CU_THE', [{ ma: 'BAO_CAO' }]), 'BAO_CAO', 'chỉ mã có trong danh mục');
  assert.deepEqual(linhVucMacDinh({ nganh: 'KTTH', chiTiet: 'Đầu tư công' }, DM), { ma: 'LV_DT', chac: true });
  assert.deepEqual(linhVucMacDinh({ nganh: 'KTTH', noiDung: 'Rà soát thu thuế, quản lý tài sản công' }, DM), { ma: 'LV_TC', chac: true });
  assert.deepEqual(linhVucMacDinh({ nganh: 'KTTH', noiDung: 'Tổ chức hội nghị' }, DM), { ma: 'LV_TC', chac: false }, 'không nhận ra: lĩnh vực đầu, nhắc kiểm tra');
  assert.deepEqual(linhVucMacDinh({ nganh: 'NOI_CHINH' }, DM), { ma: 'LV_TP', chac: true }, 'ngành một lĩnh vực');
  assert.equal(linhVucMacDinh({ nganh: '' }, DM), null);
  // v3.29 (bỏ ô Lĩnh vực — dùng chung cho Giao việc, Sửa thông tin giao, Rà soát): chỉ trong phạm vi được giao (kiêm nhiệm), gợi ý hợp lệ trước từ khoá
  assert.deepEqual(linhVucMacDinh({ nganh: 'KTTH', chiTiet: 'Đầu tư công', cho: new Set(['LV_TC']) }, DM), { ma: 'LV_TC', chac: true }, 'chỉ còn một lĩnh vực trong phạm vi');
  assert.deepEqual(linhVucMacDinh({ nganh: 'KTTH', noiDung: 'Tổ chức hội nghị', goiY: 'LV_DT' }, DM), { ma: 'LV_DT', chac: true }, 'gợi ý (AI, Excel, lĩnh vực đang có)');
  assert.deepEqual(linhVucMacDinh({ nganh: 'KTTH', chiTiet: 'Đầu tư công', goiY: 'LV_TP' }, DM), { ma: 'LV_DT', chac: true }, 'gợi ý không thuộc ngành → bỏ qua');
  assert.deepEqual(linhVucMacDinh({ nganh: 'KTTH', chiTiet: 'Đầu tư công', goiY: 'LV_DT', cho: new Set(['LV_TC', 'LV_TP']) }, DM), { ma: 'LV_TC', chac: true }, 'gợi ý ngoài phạm vi → bỏ qua');
  assert.equal(linhVucMacDinh({ nganh: 'KTTH', cho: new Set(['LV_TP']) }, DM), null, 'ngành không còn lĩnh vực nào trong phạm vi');
  assert.deepEqual(linhVucMacDinh({ nganh: 'KTTH', noiDung: 'Tổ chức hội nghị', truoc: 'LV_DT' }, DM), { ma: 'LV_DT', chac: false }, '"Giao, nhập tiếp": không nhận ra → lĩnh vực việc vừa giao');
  assert.deepEqual(linhVucMacDinh({ nganh: 'KTTH', noiDung: 'Rà soát thu thuế', truoc: 'LV_DT' }, DM), { ma: 'LV_TC', chac: true }, 'nhận ra từ nội dung thì theo nội dung');
  assert.deepEqual(linhVucMacDinh({ nganh: 'KTTH', noiDung: 'Tổ chức hội nghị', truoc: 'LV_TP' }, DM), { ma: 'LV_TC', chac: false }, 'việc trước khác ngành → bỏ qua');
  assert.deepEqual([congThang('2026-01-31', 1), congThang('2026-12-15', 1), congThang('2028-01-31', 1)], ['2026-02-28', '2027-01-15', '2028-02-29']);
  assert.deepEqual([hanMacDinh('2026-10-20', '2026-09-01'), hanMacDinh('2026-10-20', '2026-10-25')], ['2026-11-20', '2026-11-25']);
});

test('"Chờ hoàn thiện" tính lại (lỗi lô LO-0003): có cán bộ chủ trì → không thiếu đơn vị; mục tiêu tạm bỏ; điền sẵn sản phẩm, lĩnh vực, hạn, cơ quan trình', () => {
  const x = dienSanCho({ thieu: ['don_vi', 'linh_vuc', 'muc_tieu'], du: { owner_tai_khoan: 'cv1', nganh_ma: 'KTTH', noi_dung: 'Báo cáo rà soát thu thuế', loai_thoi_han_ma: 'THUONG_XUYEN' },
    goc: { 'Đơn vị chủ trì': '13. Đảng ủy Ủy ban nhân dân tỉnh' } }, { ...DM, donVi: [...DM.donVi, { ma: 'KHAC', ten: '13. Các cơ quan, đơn vị khác', trong_van_phong: false }] }, '2026-10-20');
  assert.deepEqual(x.thieu, []);
  assert.deepEqual(x.dien, { loai_thoi_han_ma: 'CO_HAN_CU_THE', san_pham_loai: 'BAO_CAO', linh_vuc_ma: 'LV_TC', han_xu_ly: '2026-11-20', co_quan_trinh: 'DANG_UY_UBND' });
  const khac = dienSanCho({ thieu: ['don_vi'], du: { owner_tai_khoan: 'cv1' }, goc: { 'Đơn vị chủ trì': '13. Các cơ quan, đơn vị khác' } },
    { ...DM, donVi: [...DM.donVi, { ma: 'KHAC', ten: '13. Các cơ quan, đơn vị khác', trong_van_phong: false }] }, '2026-10-20');
  assert.equal(khac.dien.co_quan_trinh, 'KHAC'); assert.deepEqual(khac.thieu, []);
  const chuaRo = dienSanCho({ thieu: ['linh_vuc', 'don_vi'], du: { nganh_ma: 'KTTH', noi_dung: 'Tổ chức hội nghị' } }, DM, '2026-10-20');
  assert.equal(chuaRo.dien.linh_vuc_ma, 'LV_TC', 'v3.29: lĩnh vực tự xác định theo ngành (không nhận ra → lĩnh vực đầu)');
  assert.deepEqual(chuaRo.thieu, ['don_vi'], 'v3.29: không còn nhắc lĩnh vực; chưa có cán bộ vẫn thiếu đơn vị');
  const chu = chuDienSan(chuaRo);   // đơn vị → chủ trì theo dõi; lĩnh vực không hiện ở "điền sẵn" (không còn là ô của biểu mẫu)
  assert.deepEqual(chu.thieu, ['chủ trì theo dõi']);
  assert.ok(!chu.dien.includes('lĩnh vực') && chu.dien.includes('sản phẩm đầu ra'), chu.dien.join(', '));
  assert.deepEqual(chuDienSan(x), { thieu: [], dien: ['loại thời hạn', 'sản phẩm đầu ra', 'hạn xử lý', 'cơ quan/đơn vị trình'] });
  assert.deepEqual(chuDienSan({ thieu: ['nganh', 'linh_vuc'] }).thieu, ['ngành/lĩnh vực'], 'thiếu ngành, lĩnh vực → một mục "ngành/lĩnh vực"');
});

test('Cột M khi xuất theo mẫu: minh chứng → số hiệu · ngày · trích yếu · mô tả; minh chứng chữ giữ nguyên', () => {
  assert.equal(chuKetQua({ so_hieu: '12/BC', ngay_van_ban: '2026-09-20', trich_yeu: 'Báo cáo kết quả', mo_ta_ket_qua: 'Đã gửi' }), 'Số 12/BC · ngày 20/09/2026 · Báo cáo kết quả · Đã gửi');
  assert.equal(chuKetQua({ noi_dung_chu: '[Tự điền] Đã ban hành kế hoạch' }), '[Tự điền] Đã ban hành kế hoạch');
  assert.equal(chuKetQua(null), '');
});

test('Cập nhật theo mã có ngành, không có cột Lĩnh vực: gửi lĩnh vực gợi ý (DB chỉ dùng khi lĩnh vực đang có không thuộc ngành mới); có lĩnh vực thì không', () => {
  const kq = danhGia(dong({ ma: 'NV-9', nganh: PL.nganh, linh_vuc_chi_tiet: 'Đầu tư công', noi_dung: PL.noi_dung }), LANH_DAO);
  assert.equal(kq.ket_qua, 'CAP_NHAT');
  assert.deepEqual([kq.du_lieu.nganh_ma, kq.du_lieu.linh_vuc_ma, kq.du_lieu.linh_vuc_goi_y], ['KTTH', null, 'LV_DT']);
  assert.equal(danhGia(dong({ ma: 'NV-9', nganh: PL.nganh, linh_vuc: 'Tài chính' }), LANH_DAO).du_lieu.linh_vuc_goi_y, null);
  assert.equal(danhGia(dong({ ma: 'NV-9', noi_dung: 'x' }), LANH_DAO).du_lieu.linh_vuc_goi_y, null, 'không có ngành → không gợi ý');
});

test('Trưởng phòng nhập: chủ trì ngoài phòng mình ("VPTU", cán bộ phòng khác) → Chờ hoàn thiện, báo ở bản xem trước; trong phòng → giao ngay', () => {
  const TP = { ...DG, me: { id: 'tp', role_group: 'A2', department: 'TONG_HOP' } };
  for (const chu of ['VPTU', 'Đàm Văn Sơn']) {
    const kq = danhGia(dong({ ...PL, chu_tri: chu }), TP);
    assert.equal(kq.ket_qua, 'CHO_HOAN_THIEN', chu); assert.ok(kq.thieu.includes('chu_tri')); assert.ok(kq.canhBao.some((x) => /ngoài phòng của đồng chí/.test(x)), chu);
  }
  assert.equal(danhGia(dong({ ...PL, chu_tri: 'Phòng Tổng hợp' }), TP).ket_qua, 'GIAO');
});

test('"Ghi minh chứng" với mẫu Phụ lục (chỉ cột M): Hoàn thành chưa đủ 4 yếu tố → giao như việc đang làm, chữ cột M giữ ở ghi chú', () => {
  const kq = danhGia(dong({ ...PL, tien_do: 'Hoàn thành', kq_mo_ta: 'Đã ban hành Kế hoạch số 12-KH/TU' }), { ...LANH_DAO, cheDoXong: 'CHO_NGHIEM_THU' });
  assert.equal(kq.ket_qua, 'GIAO'); assert.match(kq.du_lieu.ghi_chu, /Kết quả theo tệp: Đã ban hành Kế hoạch số 12-KH\/TU/);
});

