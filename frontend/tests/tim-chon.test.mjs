// v3.17 tìm nhanh ở ô chọn người (lib/tim-chon.js): bỏ dấu, lọc lựa chọn (ẩn / hiện, nhóm rỗng ẩn), lựa chọn khớp đầu; giả lập <select> tối thiểu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boDau, locLuaChon, chuKetQua } from '../src/lib/tim-chon.js';

test('boDau: bỏ dấu tiếng Việt, đ → d, chữ thường', () => {
  assert.equal(boDau('Nguyễn Văn Đạt — Phòng Tổng hợp'), 'nguyen van dat — phong tong hop');
  assert.equal(boDau('ĐẶNG THỊ Hà'), 'dang thi ha');
  assert.equal(boDau(null), '');
});

const op = (value, text) => ({ value, text, hidden: false });
function selectGia() {
  const nhom1 = [op('tk:1', 'Nguyễn Văn An — Phòng Tổng hợp'), op('tk:2', 'Trần Thị Bình — Phòng Hành chính')];
  const nhom2 = [op('dv:TONG_HOP', '1. Phòng Tổng hợp')];
  const g1 = { children: nhom1, hidden: false }; const g2 = { children: nhom2, hidden: false };
  return { options: [op('', 'Chọn…'), ...nhom1, ...nhom2], querySelectorAll: () => [g1, g2], g1, g2 };
}

test('locLuaChon: khớp tên hoặc phòng (bỏ dấu), ẩn lựa chọn không khớp và nhóm rỗng, trả lựa chọn khớp đầu; chuỗi rỗng hiện lại tất cả', () => {
  const s = selectGia();
  let kq = locLuaChon(s, 'tong hop');
  assert.deepEqual([kq.hien, kq.dau.value], [2, 'tk:1']);
  assert.deepEqual(s.options.map((o) => o.hidden), [false, false, true, false]);   // lựa chọn trống luôn hiện
  assert.deepEqual([s.g1.hidden, s.g2.hidden], [false, false]);
  kq = locLuaChon(s, 'Bình');
  assert.deepEqual([kq.hien, kq.dau.value, s.g2.hidden], [1, 'tk:2', true]);
  kq = locLuaChon(s, 'xyz');
  assert.deepEqual([kq.hien, kq.dau, s.g1.hidden, s.g2.hidden], [0, null, true, true]);
  kq = locLuaChon(s, '   ');
  assert.equal(kq.hien, 3); assert.ok(s.options.every((o) => !o.hidden) && !s.g1.hidden && !s.g2.hidden);
});

test('chuKetQua: rỗng khi chưa gõ; số người khớp + người đang chọn; không ai khớp', () => {
  assert.equal(chuKetQua(3, '  '), '');
  assert.equal(chuKetQua(2, 'chuyen vien', 'Hoàng Chuyên Viên Hai — Phòng Tổng hợp'), '2 người khớp — đang chọn: Hoàng Chuyên Viên Hai — Phòng Tổng hợp. Bấm tên khác để đổi, xoá chữ để xem đủ.');
  assert.equal(chuKetQua(1, 'an', ''), '1 người khớp. Bấm tên khác để đổi, xoá chữ để xem đủ.');
  assert.equal(chuKetQua(0, 'xyz', ''), 'Không ai khớp "xyz" — thử gõ ít chữ hơn.');
});
