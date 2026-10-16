// Unit test bộ lọc chi tiết và cách sắp xếp màn Nhiệm vụ (v3.24): giải kỳ thời gian nhập / hạn xử lý (giờ Việt Nam), locRows với các khoá
// mới, sắp xếp mới nhập trước (cùng phút: theo mã) và hạn gần trước, nhãn thời điểm nhập. Chạy `npm test` trong frontend/.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { giaiLocThem, sapXepMoiNhap, sapXepHan, laViecMoi, nhanNhap, demLocThem } from '../src/lib/kl/loc-them.js';
import { locRows } from '../src/lib/kl/tong-hop.js';

const HOM_NAY = '2026-10-16';
const viec = (id, o = {}) => ({ id, ma: id, nhom_dem: 'DANG_THUC_HIEN', created_at: '2026-10-01T03:00:00Z', ...o });

describe('Giải kỳ', () => {
  test('thời gian nhập: biên 00:00 giờ Việt Nam, đến không gồm; khoảng gõ ngược được đổi chỗ', () => {
    assert.deepEqual(giaiLocThem({ nhapKy: 'hom-nay' }, HOM_NAY), { nhapTuMs: Date.parse('2026-10-16T00:00:00+07:00'), nhapDenMs: Date.parse('2026-10-17T00:00:00+07:00') });
    assert.equal(giaiLocThem({ nhapKy: '7-ngay' }, HOM_NAY).nhapTuMs, Date.parse('2026-10-10T00:00:00+07:00'));
    assert.equal(giaiLocThem({ nhapKy: 'thang-nay' }, HOM_NAY).nhapTuMs, Date.parse('2026-10-01T00:00:00+07:00'));
    assert.deepEqual(giaiLocThem({ nhapKy: 'tuy-chon', nhapTuNgay: '2026-10-05', nhapDenNgay: '2026-10-03' }, HOM_NAY),
      { nhapTuMs: Date.parse('2026-10-03T00:00:00+07:00'), nhapDenMs: Date.parse('2026-10-06T00:00:00+07:00') });
    assert.deepEqual(giaiLocThem({ nhapKy: 'tuy-chon', nhapTuNgay: '2026-10-05' }, HOM_NAY), { nhapTuMs: Date.parse('2026-10-05T00:00:00+07:00') }, 'một đầu');
    assert.deepEqual(giaiLocThem({ nhapTuNgay: '2026-10-05' }, HOM_NAY), {}, 'ô ngày cũ không áp khi không chọn khoảng');
  });
  test('hạn: N ngày tới chỉ việc đang mở; tháng này / tháng sau (qua năm); chưa có hạn; khoảng ngày', () => {
    assert.deepEqual(giaiLocThem({ hanKy: '3-ngay' }, HOM_NAY), { hanTu: '2026-10-16', hanDen: '2026-10-19', hanMo: true });
    assert.deepEqual(giaiLocThem({ hanKy: 'thang-nay' }, HOM_NAY), { hanTu: '2026-10-01', hanDen: '2026-10-31' });
    assert.deepEqual(giaiLocThem({ hanKy: 'thang-sau' }, '2026-12-20'), { hanTu: '2027-01-01', hanDen: '2027-01-31' });
    assert.deepEqual(giaiLocThem({ hanKy: 'chua-co' }, HOM_NAY), { chuaCoHan: true });
    assert.deepEqual(giaiLocThem({ hanKy: 'tuy-chon', hanTuNgay: '2026-11-01', hanDenNgay: '2026-11-15' }, HOM_NAY), { hanTu: '2026-11-01', hanDen: '2026-11-15' });
  });
  test('đếm bộ lọc trong "Thêm bộ lọc"', () => {
    assert.equal(demLocThem({ nhapKy: 'hom-nay', doKhan: 'HOA_TOC', tuKhoa: 'x', nhom: 'QUA_HAN' }), 2);
    assert.equal(demLocThem({}), 0);
  });
});

describe('locRows — khoá mới', () => {
  const rows = [
    viec('a', { created_at: '2026-10-15T17:30:00Z', tao_boi: 'u1', do_khan: 'HOA_TOC', han_xu_ly: '2026-10-17' }),   // 00:30 16/10 giờ VN
    viec('b', { created_at: '2026-10-15T16:59:00Z', tao_boi: 'u2', nhiem_vu_cha: 'a', han_xu_ly: '2026-10-25' }),     // 23:59 15/10 giờ VN
    viec('c', { nhom_dem: 'HOAN_THANH', tao_boi: 'u1', han_xu_ly: '2026-10-18' }),
    viec('d', { tao_boi: 'u2' }),
  ];
  const loc = (f) => locRows(rows, { ...f, ...giaiLocThem(f, HOM_NAY) }).map((r) => r.id);
  test('thời gian nhập, người nhập, cấp giao, độ khẩn', () => {
    assert.deepEqual(loc({ nhapKy: 'hom-nay' }), ['a']);
    assert.deepEqual(loc({ nhapKy: 'hom-qua' }), ['b']);
    assert.deepEqual(loc({ nguoiNhap: 'u1' }), ['a', 'c']);
    assert.deepEqual(loc({ capGiao: 'TIEP_XUONG' }), ['b']);
    assert.deepEqual(loc({ capGiao: 'GOC' }), ['a', 'c', 'd']);
    assert.deepEqual(loc({ doKhan: 'THUONG' }), ['b', 'c', 'd']);
  });
  test('hạn xử lý', () => {
    assert.deepEqual(loc({ hanKy: '3-ngay' }), ['a'], 'việc đã hoàn thành có hạn 18/10 không tính');
    assert.deepEqual(loc({ hanKy: 'thang-nay' }), ['a', 'b', 'c']);
    assert.deepEqual(loc({ hanKy: 'chua-co' }), ['d']);
    assert.deepEqual(loc({ hanKy: 'tuy-chon', hanTuNgay: '2026-10-18' }), ['b', 'c']);
  });
});

describe('Sắp xếp', () => {
  test('mới nhập trước; cùng phút (một lần giao / một lô) theo mã tăng dần', () => {
    const ds = [viec('NV-9', { created_at: '2026-10-16T01:00:10Z' }), viec('NV-10', { created_at: '2026-10-16T01:00:40Z' }),
      viec('NV-2', { created_at: '2026-10-16T02:00:00Z' }), viec('NV-1', { created_at: '2026-10-10T02:00:00Z' })];
    assert.deepEqual(sapXepMoiNhap(ds).map((r) => r.ma), ['NV-2', 'NV-9', 'NV-10', 'NV-1']);
  });
  test('hạn gần trước: đang mở theo hạn tăng dần (quá hạn đầu) → chưa có hạn → đã hoàn thành; cùng hạn: Hỏa tốc trước', () => {
    const ds = [viec('x1', { han_xu_ly: '2026-10-20' }), viec('x2', { han_xu_ly: '2026-09-01', nhom_dem: 'QUA_HAN' }), viec('x3'),
      viec('x4', { han_xu_ly: '2026-08-01', nhom_dem: 'HOAN_THANH' }), viec('x5', { han_xu_ly: '2026-10-20', do_khan: 'HOA_TOC' })];
    assert.deepEqual(sapXepHan(ds).map((r) => r.id), ['x2', 'x5', 'x1', 'x3', 'x4']);
  });
});

describe('Nhãn trên dòng', () => {
  test('việc mới: nhập trong 24 giờ qua', () => {
    const now = Date.parse('2026-10-16T10:00:00+07:00');
    assert.equal(laViecMoi({ created_at: '2026-10-15T11:00:00+07:00' }, now), true);
    assert.equal(laViecMoi({ created_at: '2026-10-15T09:59:00+07:00' }, now), false);
  });
  test('thời điểm nhập theo giờ Việt Nam', () => {
    assert.equal(nhanNhap('2026-10-16T01:05:00Z', HOM_NAY), 'nhập 08:05 hôm nay');
    assert.equal(nhanNhap('2026-10-15T09:40:00Z', HOM_NAY), 'nhập 16:40 hôm qua');
    assert.equal(nhanNhap('2026-10-03T02:12:00Z', HOM_NAY), 'nhập 09:12 ngày 3/10');
    assert.equal(nhanNhap('2025-12-31T17:30:00Z', HOM_NAY), 'nhập 00:30 ngày 1/1');
    assert.equal(nhanNhap('2025-10-03T02:12:00Z', HOM_NAY), 'nhập 09:12 ngày 3/10/2025');
  });
});
