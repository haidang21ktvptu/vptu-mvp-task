// Bảng đề xuất sửa được của trợ lý AI ở Giao việc (v3.27 — lib/kl/bang-de-xuat.js): giá trị ban đầu của dòng (hạn chỉ khi đối chiếu được, sản phẩm AI /
// quy tắc, việc trùng bỏ sẵn), điền nhanh các dòng còn trống, kế hoạch điền thẻ từ giá trị đã sửa (chỉ ô trống của thẻ, đề xuất chưa sửa được ghi chú,
// nội dung chưa đối chiếu mà người giao không sửa → cảnh báo). Dữ liệu hư cấu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dongBanDau, dienNhanh, keHoachBang, conDien } from '../src/lib/kl/bang-de-xuat.js';

const SP = [{ ma: 'BAO_CAO' }, { ma: 'KE_HOACH' }, { ma: 'DU_THAO_VAN_BAN' }];
const nv = (them = {}) => ({ noi_dung: { gia_tri: 'Giao Sở Tài chính chủ trì rà soát dự toán', xac_minh: 'dung' }, han: { gia_tri: '2026-11-30', trich: 'trước 30/11/2026', xac_minh: 'dung' },
  loai_thoi_han: { gia_tri: 'CO_HAN_CU_THE' }, san_pham: { gia_tri: 'BAO_CAO' }, nganh: { gia_tri: 'KINH_TE_TONG_HOP' }, linh_vuc: { gia_tri: 'LV08_TAI_CHINH' },
  co_quan_trinh: { gia_tri: 'DANG_UY_UBND' }, don_vi_chu_tri: { gia_tri: 'Sở Tài chính' }, don_vi_phoi_hop: { gia_tri: 'Sở Nội vụ', xac_minh: 'dung' },
  mo_ta_san_pham: { gia_tri: '', xac_minh: false }, ...them });

test('dòng ban đầu: hạn đã đối chiếu điền sẵn, chưa đối chiếu → gợi ý "Dùng ngày"; Ký ban hành; sản phẩm AI / quy tắc; cơ quan trình; việc trùng bỏ sẵn', () => {
  const d = dongBanDau(nv(), SP);
  assert.deepEqual([d.noi_dung, d.owner, d.san_pham, d.sp_ai, d.loai, d.han, d.han_goi_y, d.co_quan_trinh, d.bo],
    ['Giao Sở Tài chính chủ trì rà soát dự toán', '', 'BAO_CAO', true, 'CO_HAN_CU_THE', '2026-11-30', '', 'DANG_UY_UBND', false]);
  assert.ok(d.sua instanceof Set && d.sua.size === 0);
  const lech = dongBanDau(nv({ han: { gia_tri: '2026-12-31', trich: 'trong năm 2026', xac_minh: false } }), SP);
  assert.deepEqual([lech.han, lech.han_goi_y, lech.han_trich], ['', '2026-12-31', 'trong năm 2026']);
  const ky = dongBanDau(nv({ han: { gia_tri: '' }, loai_thoi_han: { gia_tri: 'KY_BAN_HANH' }, san_pham: { gia_tri: '' } }), SP);
  assert.deepEqual([ky.loai, ky.han, ky.san_pham, ky.sp_ai], ['KY_BAN_HANH', '', 'DU_THAO_VAN_BAN', false], 'Ký ban hành: sản phẩm theo quy tắc');
  const kh = dongBanDau(nv({ noi_dung: { gia_tri: 'Thống nhất ban hành Kế hoạch triển khai', xac_minh: 'dung' }, san_pham: { gia_tri: 'MA_LA' } }), SP);
  assert.equal(kh.san_pham, 'KE_HOACH', 'mã AI không có trong danh mục → quy tắc từ khoá');
  assert.equal(dongBanDau(nv({ trung_voi: 0 }), SP).bo, true);
});

test('điền nhanh: chịu trách nhiệm, hạn chung vào dòng còn trống; dòng đã bỏ / đã điền vào thẻ giữ nguyên; Ký ban hành không nhận hạn', () => {
  const ds = [dongBanDau(nv(), SP), dongBanDau(nv({ han: { gia_tri: '' } }), SP), dongBanDau(nv({ trung_voi: 0 }), SP),
    dongBanDau(nv({ han: { gia_tri: '' }, loai_thoi_han: { gia_tri: 'KY_BAN_HANH' } }), SP), dongBanDau(nv(), SP)];
  ds[4].owner = 'tk:cu';
  const n = dienNhanh(ds, { owner: 'tk:moi', han: '2026-12-15' }, (i) => i === 0);
  assert.equal(n, 2, 'dòng 2 (chịu trách nhiệm + hạn), dòng 4 (chịu trách nhiệm); dòng 5 đã đủ');
  assert.deepEqual(ds.map((d) => [d.owner, d.han]), [['', '2026-11-30'], ['tk:moi', '2026-12-15'], ['', '2026-11-30'], ['tk:moi', ''], ['tk:cu', '2026-11-30']]);
  assert.ok(ds[1].sua.has('owner') && ds[1].sua.has('han'));
  assert.deepEqual(conDien(ds, (i) => i === 0), [1, 3, 4], 'dòng còn điền được: chưa bỏ, chưa điền');
  assert.equal(dienNhanh(ds, {}, () => false), 0);
});

test('kế hoạch điền thẻ: giá trị đã sửa trên bảng; ngành, lĩnh vực, phối hợp theo AI; chỉ ô trống; đề xuất chưa sửa được ghi chú', () => {
  const n = nv(); const d = dongBanDau(n, SP);
  Object.assign(d, { noi_dung: 'Giao Sở Tài chính chủ trì rà soát dự toán năm 2027', owner: 'tk:cv1', han: '2026-12-15' }); d.sua.add('noi_dung').add('owner').add('han');
  const k = keHoachBang(n, d, { loai: 'CO_HAN_CU_THE' });
  assert.deepEqual(k.dien, { nganh: 'KINH_TE_TONG_HOP', linh_vuc: 'LV08_TAI_CHINH', phoi_hop: 'Sở Nội vụ', noi_dung: 'Giao Sở Tài chính chủ trì rà soát dự toán năm 2027',
    owner: 'tk:cv1', san_pham: 'BAO_CAO', loai: 'CO_HAN_CU_THE', han: '2026-12-15', co_quan_trinh: 'DANG_UY_UBND' });
  assert.deepEqual(k.deXuat.sort(), ['co_quan_trinh', 'linh_vuc', 'nganh', 'san_pham']);
  assert.deepEqual(k.canhBao, []); assert.deepEqual(k.goiY, { chuTri: 'Sở Tài chính' });
  d.sua.add('san_pham').add('co_quan_trinh');
  assert.deepEqual(keHoachBang(n, d, {}).deXuat.sort(), ['linh_vuc', 'nganh'], 'người giao đã chọn lại: không còn là đề xuất');
  const co = keHoachBang(n, d, { noi_dung: 'đã gõ', owner: 'tk:khac', san_pham: 'KE_HOACH', han: '2026-10-30', loai: 'CO_HAN_CU_THE', co_quan_trinh: 'BAN_TO_CHUC', nganh: 'X', linh_vuc: 'Y' });
  assert.deepEqual(Object.keys(co.dien), ['phoi_hop'], 'thẻ đã có giá trị: giữ nguyên');
});

test('kế hoạch điền thẻ: nội dung chưa đối chiếu / chưa trọn câu mà không sửa → cảnh báo; Ký ban hành không điền hạn; việc trùng lấy lại → cảnh báo trùng', () => {
  const lech = nv({ noi_dung: { gia_tri: 'Nội dung AI tóm tắt', xac_minh: false } });
  assert.match(keHoachBang(lech, dongBanDau(lech, SP), {}).canhBao.join(' '), /chưa khớp nguyên văn/);
  assert.match(keHoachBang(lech, dongBanDau(lech, SP), {}, { banChup: true }).canhBao.join(' '), /bản chụp/);
  const sua = dongBanDau(lech, SP); sua.noi_dung = 'Nội dung người giao chép từ văn bản gốc';
  assert.deepEqual(keHoachBang(lech, sua, {}).canhBao, [], 'đã sửa nội dung: không cảnh báo');
  const tiep = nv({ noi_dung: { gia_tri: 'Giao Sở Tài chính', xac_minh: 'dung', con_tiep: ', báo cáo kết quả.' } });
  assert.match(keHoachBang(tiep, dongBanDau(tiep, SP), {}).canhBao.join(' '), /còn tiếp/);
  const ky = nv({ han: { gia_tri: '' }, loai_thoi_han: { gia_tri: 'KY_BAN_HANH' } }); const dk = dongBanDau(ky, SP); dk.han = '2026-12-01';
  const kk = keHoachBang(ky, dk, { loai: 'CO_HAN_CU_THE' });
  assert.deepEqual([kk.dien.loai, kk.dien.han], ['KY_BAN_HANH', undefined]); assert.ok(kk.deXuat.includes('loai'));
  const trung = nv({ trung_voi: 0 });
  assert.match(keHoachBang(trung, { ...dongBanDau(trung, SP), bo: false }, {}).canhBao.join(' '), /trùng với nhiệm vụ 1/);
});
