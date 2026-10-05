// v3.15.1 hết phiên do không thao tác (lib/het-phien.js): trạng thái theo mốc thao tác cuối, ngưỡng nhắc, ghi đè số phút khi kiểm thử.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trangThaiPhien, phutHetPhien, PHUT_HET_PHIEN, PHUT_BAO_TRUOC, CAU_HET_PHIEN, CAU_SAP_HET } from '../src/lib/het-phien.js';

const P = 60_000;
test('trangThaiPhien: ok → sắp hết (còn ≤ 2 phút) → hết (quá 30 phút)', () => {
  const t0 = 1_000_000_000_000;
  assert.deepEqual(trangThaiPhien(t0, t0), { trangThai: 'ok', conGiay: 30 * 60 });
  assert.equal(trangThaiPhien(t0, t0 + 27 * P).trangThai, 'ok');
  assert.deepEqual(trangThaiPhien(t0, t0 + 28 * P), { trangThai: 'sap_het', conGiay: 120 });
  assert.equal(trangThaiPhien(t0, t0 + 29.5 * P).trangThai, 'sap_het');
  assert.deepEqual(trangThaiPhien(t0, t0 + 30 * P), { trangThai: 'het', conGiay: 0 });
  assert.equal(trangThaiPhien(t0, t0 + 10 * 60 * P).trangThai, 'het');       // treo qua đêm
  assert.equal(PHUT_HET_PHIEN, 30); assert.equal(PHUT_BAO_TRUOC, 2);
});

test('trangThaiPhien: chưa có mốc → ok; số phút nhỏ (kiểm thử) thì ngưỡng nhắc co lại theo nửa thời gian', () => {
  assert.equal(trangThaiPhien(NaN, 5).trangThai, 'ok');
  const t0 = 0;
  assert.equal(trangThaiPhien(t0, 1_000, { phut: 0.1 }).trangThai, 'ok');       // 6 giây, còn 5 s > 3 s
  assert.equal(trangThaiPhien(t0, 4_000, { phut: 0.1 }).trangThai, 'sap_het');  // còn 2 s ≤ 3 s
  assert.equal(trangThaiPhien(t0, 6_000, { phut: 0.1 }).trangThai, 'het');
});

test('phutHetPhien: ghi đè hợp lệ (0 < n ≤ 1440) mới được dùng, còn lại về mặc định 30', () => {
  assert.equal(phutHetPhien(undefined), 30); assert.equal(phutHetPhien(null), 30); assert.equal(phutHetPhien('abc'), 30);
  assert.equal(phutHetPhien('0'), 30); assert.equal(phutHetPhien('-5'), 30); assert.equal(phutHetPhien('100000'), 30);
  assert.equal(phutHetPhien('0.1'), 0.1); assert.equal(phutHetPhien('15'), 15);
});

test('câu thông báo tiếng Việt', () => {
  assert.match(CAU_HET_PHIEN(30), /không có thao tác trong 30 phút/);
  assert.match(CAU_SAP_HET(120), /sau 2 phút/); assert.match(CAU_SAP_HET(61), /sau 2 phút/); assert.match(CAU_SAP_HET(5), /sau 1 phút/);
});
