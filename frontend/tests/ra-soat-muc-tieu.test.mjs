// Unit test phần thuần của màn Rà soát mục tiêu then chốt (v3.25 — views/shared/ra-soat-muc-tieu/ke-hoach.js): việc chờ xử lý, ghi gì và nguồn
// (RA_SOAT cho mục hệ thống tích sẵn, giữ nguồn mục người bấm, không gửi nguồn mục đã gắn / mục của văn bản), bỏ gắn riêng khi chỉ còn mục của văn
// bản, phản hồi theo tập hiện trên dòng.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoTrangThai, coTichSan, choXuLy, nhomGoiY, keHoachLuu, maSauLuu, phanHoiLuu, tenTap } from '../src/views/shared/ra-soat-muc-tieu/ke-hoach.js';
import { apGoiY, bat, tat, khoaSoHieu } from '../src/lib/kl/goi-y-muc-tieu.js';

const DM = [{ ma: 'NQ_57', nhom: 'NQ_TW', ten_ngan: 'Nghị quyết 57-NQ/TW' }, { ma: 'DP_KHCN_CDS', nhom: 'DOT_PHA', ten_ngan: 'Đột phá KHCN' },
  { ma: 'CTR_DU_LICH', nhom: 'CHUONG_TRINH', ten_ngan: 'Du lịch bền vững' }, { ma: 'DP_HA_TANG', nhom: 'DOT_PHA', ten_ngan: 'Đột phá hạ tầng' }];
const KQ = { goi_y: [{ ma: 'NQ_57', muc: 'TU_TICH', ly_do: [{ loai: 'SO_HIEU', gia_tri: '57-NQ/TW', o: 'noi_dung' }], quy_tac: ['q1'] },
  { ma: 'CTR_DU_LICH', muc: 'GOI_Y', ly_do: [{ loai: 'TU_KHOA', gia_tri: 'du lịch', o: 'noi_dung' }], quy_tac: ['q2'] }], so_hieu_moi: [] };
const viec = (them = {}) => ({ id: 'v1', muc_tieu_rieng: [], muc_tieu_vb: [], muc_tieu: [], muc_tieu_nguon: {}, ...them });

test('việc chưa gắn: tích sẵn chờ chấp nhận; lưu với nguồn RA_SOAT; gợi ý được bấm giữ GOI_Y', () => {
  const r = viec(); const tt = apGoiY(taoTrangThai(r), KQ);
  assert.equal(coTichSan(tt), true); assert.equal(choXuLy(r, tt), true);
  assert.deepEqual([...nhomGoiY(tt, DM)].sort(), ['CHUONG_TRINH', 'NQ_TW']);
  assert.deepEqual(keHoachLuu(r, tt), { id: 'v1', ma: ['NQ_57'], nguon: { NQ_57: { nguon: 'RA_SOAT', ly_do: 'số hiệu 57-NQ/TW trong nội dung' } } });
  bat(tt, 'CTR_DU_LICH', { nguon: 'GOI_Y', ly_do: 'du lịch' });
  assert.equal(keHoachLuu(r, tt).nguon.CTR_DU_LICH.nguon, 'GOI_Y');
  assert.deepEqual(maSauLuu(r, keHoachLuu(r, tt)), ['NQ_57', 'CTR_DU_LICH']);
});

test('việc đã gắn riêng: mục cũ không gửi nguồn (DB giữ EXCEL); không đổi gì → không ghi', () => {
  const r = viec({ muc_tieu_rieng: ['DP_KHCN_CDS'], muc_tieu: ['DP_KHCN_CDS'], muc_tieu_nguon: { DP_KHCN_CDS: { nguon: 'EXCEL', ly_do: null } } });
  const tt = apGoiY(taoTrangThai(r), KQ);
  const ke = keHoachLuu(r, tt);
  assert.deepEqual(ke.ma.sort(), ['DP_KHCN_CDS', 'NQ_57']); assert.deepEqual(Object.keys(ke.nguon), ['NQ_57']);
  tat(tt, 'NQ_57');
  assert.equal(keHoachLuu(r, tt), null, 'trở về đúng phần đã gắn');
  assert.equal(choXuLy(r, tt), false, 'đã có mục tiêu, gợi ý còn lại không tính chờ');
});

test('theo văn bản: chỉ còn mục của văn bản → không ghi (việc chưa gắn riêng) hoặc bỏ gắn riêng (việc đang gắn riêng khác văn bản)', () => {
  const r = viec({ muc_tieu_vb: ['DP_HA_TANG'], muc_tieu: ['DP_HA_TANG'] });
  const tt = taoTrangThai(r);
  assert.equal(keHoachLuu(r, tt), null);
  const r2 = viec({ muc_tieu_rieng: ['NQ_57'], muc_tieu_vb: ['DP_HA_TANG'], muc_tieu: ['NQ_57'] });
  const t2 = taoTrangThai(r2); tat(t2, 'NQ_57');
  assert.deepEqual(keHoachLuu(r2, t2), { id: 'v1', ma: [], nguon: {} });
  assert.deepEqual(maSauLuu(r2, keHoachLuu(r2, t2)), ['DP_HA_TANG']);
  bat(tt, 'NQ_57', { nguon: 'CHON' });
  const ke = keHoachLuu(r, tt);
  assert.deepEqual(ke.ma.sort(), ['DP_HA_TANG', 'NQ_57']); assert.equal(ke.nguon.DP_HA_TANG, undefined, 'mục của văn bản không khai nguồn — máy chủ chép nguồn của văn bản');
  assert.equal(ke.nguon.NQ_57.nguon, 'CHON');
});

test('số hiệu mới: hệ thống tích sẵn → RA_SOAT khi chấp nhận; chưa có mã thì chưa tính', () => {
  const r = viec(); const tt = apGoiY(taoTrangThai(r), { goi_y: [], so_hieu_moi: [{ so_hieu: '81-NQ/TW', nhom: 'NQ_TW', ve: 'về văn hóa' }] });
  assert.equal(coTichSan(tt), true);
  assert.equal(keHoachLuu(r, tt), null, 'chưa thêm vào danh mục: chưa có mã');
  const ke = keHoachLuu(r, tt, new Map([[khoaSoHieu('81-NQ/TW'), 'NQ_81']]));
  assert.deepEqual(ke.ma, ['NQ_81']); assert.equal(ke.nguon.NQ_81.nguon, 'RA_SOAT');
});

test('phản hồi: lưu hàng loạt chưa thao tác chỉ tính mục tích sẵn; đã thao tác tính đủ', () => {
  const r = viec(); const tt = apGoiY(taoTrangThai(r), KQ);
  assert.deepEqual(phanHoiLuu(tt, new Map(), false), [{ quy_tac: ['q1'], ket_qua: 'GIU' }]);
  assert.deepEqual(phanHoiLuu(tt, new Map(), true), [{ quy_tac: ['q1'], ket_qua: 'GIU' }, { quy_tac: ['q2'], ket_qua: 'BO_QUA' }]);
  // Lưu thành "theo văn bản" (bỏ gắn riêng): mục tích sẵn còn hiện trên dòng là GIỮ, không phải bỏ
  const r3 = viec({ muc_tieu_rieng: ['DP_KHCN_CDS'], muc_tieu_vb: ['DP_HA_TANG'], muc_tieu: ['DP_KHCN_CDS'] });
  const t3 = apGoiY(taoTrangThai(r3), { goi_y: [{ ma: 'DP_HA_TANG', muc: 'TU_TICH', ly_do: [{ loai: 'TU_KHOA', gia_tri: 'hạ tầng', o: 'noi_dung' }], quy_tac: ['q3'] }] });
  tat(t3, 'DP_KHCN_CDS');
  assert.deepEqual(keHoachLuu(r3, t3), { id: 'v1', ma: [], nguon: {} });
  assert.deepEqual(phanHoiLuu(t3, new Map(), true), [{ quy_tac: ['q3'], ket_qua: 'GIU' }]);
  assert.equal(tenTap(['NQ_57', 'KHONG_CO'], DM), 'Nghị quyết 57-NQ/TW; KHONG_CO');
});

test('chờ xử lý: việc chưa gắn mục nào chỉ còn gợi ý "đã bỏ ở việc này" (da_bo — 0115) thì không tính chờ', () => {
  const r = viec(); const daBo = { ...KQ.goi_y[0], muc: 'GOI_Y', da_bo: true };
  const tt = apGoiY(taoTrangThai(r), { goi_y: [daBo], so_hieu_moi: [] });
  assert.equal(coTichSan(tt), false); assert.equal(choXuLy(r, tt), false);
  assert.equal(choXuLy(r, apGoiY(taoTrangThai(r), { goi_y: [daBo, KQ.goi_y[1]], so_hieu_moi: [] })), true, 'còn gợi ý khác → vẫn chờ');
});

test('bỏ mục tích sẵn mà tập mục tiêu không đổi (việc chưa gắn gì): vẫn có việc để lưu — phản hồi "bỏ" (0115)', async () => {
  const { coThayDoi, coBoTichSan } = await import('../src/views/shared/ra-soat-muc-tieu/ke-hoach.js');
  const r = viec(); const tt = apGoiY(taoTrangThai(r), KQ);
  assert.equal(coBoTichSan(tt), false);
  tat(tt, 'NQ_57');
  assert.equal(keHoachLuu(r, tt), null, 'không có mục tiêu nào để ghi');
  assert.equal(coBoTichSan(tt), true); assert.equal(coThayDoi(r, tt), true, 'nút Chấp nhận sáng để ghi "bỏ"');
  assert.deepEqual(phanHoiLuu(tt, new Map(), true), [{ quy_tac: ['q1'], ket_qua: 'BO' }, { quy_tac: ['q2'], ket_qua: 'BO_QUA' }]);
});

test('coThayDoi: số hiệu mới đang tích tính là có thay đổi trước khi có mã', async () => {
  const { coThayDoi } = await import('../src/views/shared/ra-soat-muc-tieu/ke-hoach.js');
  const r = viec(); const tt = apGoiY(taoTrangThai(r), { goi_y: [], so_hieu_moi: [{ so_hieu: '81-NQ/TW', nhom: 'NQ_TW' }] });
  assert.equal(coThayDoi(r, tt), true);
  assert.equal(coThayDoi(r, taoTrangThai(r)), false);
});
