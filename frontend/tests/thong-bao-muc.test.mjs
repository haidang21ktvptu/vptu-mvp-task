// v3.36 (0142, CAU-HOI V-10): mức của tin hệ thống ở chuông — features/thong-bao/muc.js. Tin để biết không đếm trên huy hiệu, không bật toast;
// tin chưa có cột mức (trước 0142) coi như cần xử lý.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MUC_TIN, mucCua, demChuaDoc, canBaoNgay } from '../src/features/thong-bao/muc.js';

test('mức của tin: BIET giữ nguyên, còn lại (kể cả thiếu cột) là cần xử lý', () => {
  assert.deepEqual(MUC_TIN, ['XU_LY', 'BIET']);
  assert.equal(mucCua({ muc_tin: 'BIET' }), 'BIET');
  assert.equal(mucCua({ muc_tin: 'XU_LY' }), 'XU_LY');
  assert.equal(mucCua({}), 'XU_LY');
  assert.equal(mucCua(null), 'XU_LY');
});

test('đếm chưa đọc theo mức: tin đã đọc không tính', () => {
  const ds = [
    { muc_tin: 'XU_LY', is_read: false }, { muc_tin: 'XU_LY', is_read: true }, { is_read: false },
    { muc_tin: 'BIET', is_read: false }, { muc_tin: 'BIET', is_read: false }, { muc_tin: 'BIET', is_read: true },
  ];
  assert.deepEqual(demChuaDoc(ds), { XU_LY: 2, BIET: 2 });
  assert.deepEqual(demChuaDoc([]), { XU_LY: 0, BIET: 0 });
  assert.deepEqual(demChuaDoc(undefined), { XU_LY: 0, BIET: 0 });
});

test('toast và âm chuông chỉ cho tin cần xử lý', () => {
  assert.equal(canBaoNgay({ muc_tin: 'XU_LY' }), true);
  assert.equal(canBaoNgay({ muc_tin: 'BIET' }), false);
  assert.equal(canBaoNgay({}), true);
});
