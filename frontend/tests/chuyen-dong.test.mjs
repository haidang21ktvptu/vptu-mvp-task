// v3.36 (CAU-HOI V-12) chuyển động giao diện (lib/chuyen-dong.js): chuỗi HTML số lăn / tiêu đề từng chữ / đường xu hướng nhỏ giữ nguyên văn chữ và số;
// "cửa vào" của một vùng: gắn – gỡ lớp, việc chờ cửa đóng, lần vẽ thứ hai đóng cửa, giảm chuyển động thì không gắn lớp nào.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { soLanHtml, tieuDeHtml, duongNhoSvg, coChuyenDong, moCuaVao, dongCuaVao, dangVao, truocKhiVe, sauKhiVao } from '../src/lib/chuyen-dong.js';

const boThe = (html) => html.replace(/<[^>]+>/g, '');
// Môi trường giả tối thiểu: <html> có thuộc tính data-chuyen-dong, matchMedia, phần tử có classList.
const moiTruong = { giam: null, heDieuHanhGiam: false };
globalThis.document = { documentElement: { getAttribute: (k) => (k === 'data-chuyen-dong' ? moiTruong.giam : null) } };
globalThis.window = { matchMedia: () => ({ matches: moiTruong.heDieuHanhGiam }) };
const phanTu = () => { const lop = new Set(); return { lop, classList: { add: (...x) => x.forEach((c) => lop.add(c)), remove: (...x) => x.forEach((c) => lop.delete(c)) } }; };
beforeEach(() => { moiTruong.giam = null; moiTruong.heDieuHanhGiam = false; });

test('soLanHtml: chữ trong DOM là con số thật; mỗi chữ số một ô mang chữ số đích và thứ tự cột; ký tự khác giữ nguyên, có thoát HTML', () => {
  const h = soLanHtml('1.240');
  assert.equal(boThe(h), '1.240');
  assert.deepEqual([...h.matchAll(/--d:(\d);--i:(\d)/g)].map((m) => [m[1], m[2]]), [['1', '0'], ['2', '1'], ['4', '2'], ['0', '3']]);
  assert.equal(boThe(soLanHtml('69%')), '69%');
  assert.equal(boThe(soLanHtml(0)), '0');
  assert.equal(soLanHtml(null), '<span class="so-lan"></span>');
  assert.equal(soLanHtml('<5'), '<span class="so-lan">&lt;<span class="cs" style="--d:5;--i:0">5</span></span>');
});

test('tieuDeHtml: giữ nguyên văn tiêu đề; hai từ đầu chữ thẳng, phần còn lại là cụm nhấn; thứ tự chữ liên tục; một – hai từ thì không có cụm nhấn', () => {
  const h = tieuDeHtml('Tổng quan thực hiện nhiệm vụ');
  assert.equal(boThe(h), 'Tổng quan thực hiện nhiệm vụ');
  assert.equal(boThe(h.slice(h.indexOf('<em class="nhan-td">'))), 'thực hiện nhiệm vụ');
  assert.deepEqual([...h.matchAll(/--i:(\d+)/g)].map((m) => Number(m[1])), Array.from({ length: 23 }, (_, i) => i));
  assert.ok(h.startsWith('<span class="tach-chu" aria-hidden="true">'));
  assert.ok(!tieuDeHtml('Tổng quan').includes('nhan-td'));
  assert.equal(boThe(tieuDeHtml('  Tổng quan   Phòng Tổng hợp ')), 'Tổng quan Phòng Tổng hợp');
  assert.equal(boThe(tieuDeHtml('Việc <b>')), 'Việc &lt;b&gt;');
  const mot = tieuDeHtml('Một hai ba', 1);   // số từ đầu tuỳ chọn
  assert.equal(boThe(mot.split('<em')[0]), 'Một '); assert.equal(boThe(mot.slice(mot.indexOf('<em'))), 'hai ba');
});

test('tieuDeHtml: dấu tiếng Việt dạng tổ hợp đi cùng chữ gốc (không tách dấu thành ô riêng)', () => {
  const toHop = 'Tổng'.normalize('NFD');   // T + o + dấu mũ + dấu hỏi + n + g
  assert.equal([...tieuDeHtml(toHop).matchAll(/class="chu"/g)].length, 4);
});

test('duongNhoSvg: dưới hai điểm hoặc toàn số 0 thì không vẽ; nét đi qua đủ số điểm, nằm trong khung 100×28, chấm ở điểm cuối', () => {
  assert.equal(duongNhoSvg([]), '');
  assert.equal(duongNhoSvg([5]), '');
  assert.equal(duongNhoSvg([0, 0, 0]), '');
  const h = duongNhoSvg([1, 14, 17, 11, 26, 14, 35, 0, 22, 3, 0, 0]);
  const net = h.match(/class="dn-net" pathLength="1" d="([^"]+)"/)[1];
  const diem = [...net.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.equal(diem.length, 12);
  assert.ok(diem.every(([x, y]) => x >= 0 && x <= 100 && y >= 3 && y <= 25));
  assert.deepEqual(diem[6], [54.5, 3]);        // giá trị lớn nhất chạm mép trên (trừ lề)
  assert.deepEqual(diem[11], [100, 25]);       // 0 nằm ở đáy
  assert.ok(h.includes('cx="100.0" cy="25.0"'));
  assert.ok(duongNhoSvg([1, 2], 'tren-dai').includes('class="duong-nho tren-dai"'));
});

test('cửa vào: gắn lớp khi mở, gỡ khi đóng; vào lại và lớp kèm theo; việc chờ chạy một lần lúc cửa đóng, cùng khoá chỉ giữ việc sau', () => {
  const el = phanTu(); const nhat = [];
  assert.equal(coChuyenDong(), true);
  assert.equal(moCuaVao(el, { ms: 60000, lai: true, them: ['sau-cho'] }), true);
  assert.deepEqual([...el.lop].sort(), ['dang-vao', 'sau-cho', 'vao-lai']);
  assert.equal(dangVao(el), true);
  sauKhiVao(el, () => nhat.push('a'), 'nap'); sauKhiVao(el, () => nhat.push('b'), 'nap'); sauKhiVao(el, () => nhat.push('c'));
  assert.deepEqual(nhat, []);
  dongCuaVao(el);
  assert.deepEqual(nhat, ['b', 'c']);
  assert.equal(el.lop.size, 0); assert.equal(dangVao(el), false);
  dongCuaVao(el);   // đóng lần nữa: không chạy lại
  assert.deepEqual(nhat, ['b', 'c']);
  sauKhiVao(el, () => nhat.push('d'));   // không có cửa: chạy ngay
  assert.deepEqual(nhat, ['b', 'c', 'd']);
});

test('cửa vào: mở lại thì đóng cửa cũ trước (việc chờ của cửa cũ chạy); lớp dang-doi cho số liệu đổi tại chỗ', () => {
  const el = phanTu(); const nhat = [];
  moCuaVao(el, { ms: 60000 }); sauKhiVao(el, () => nhat.push('nap'), 'nap');
  moCuaVao(el, { lop: 'dang-doi', ms: 60000 });
  assert.deepEqual(nhat, ['nap']);
  assert.deepEqual([...el.lop], ['dang-doi']);
  dongCuaVao(el);
});

test('truocKhiVe: lần vẽ đầu trong cửa giữ cửa, lần vẽ thứ hai đóng cửa (nội dung mới hiện ngay)', () => {
  const el = phanTu();
  truocKhiVe(el);   // chưa có cửa: không lỗi
  moCuaVao(el, { ms: 60000 });
  truocKhiVe(el); assert.equal(dangVao(el), true);
  truocKhiVe(el); assert.equal(dangVao(el), false); assert.equal(el.lop.size, 0);
});

test('giảm chuyển động (bánh răng hoặc hệ điều hành): không gắn lớp, việc chờ chạy ngay; cửa đang mở vẫn đóng được', () => {
  const el = phanTu(); const nhat = [];
  moCuaVao(el, { ms: 60000 });
  moiTruong.giam = 'giam';
  assert.equal(coChuyenDong(), false);
  assert.equal(moCuaVao(el), false);   // đóng cửa cũ, không mở cửa mới
  assert.equal(el.lop.size, 0); assert.equal(dangVao(el), false);
  sauKhiVao(el, () => nhat.push('x')); assert.deepEqual(nhat, ['x']);
  moiTruong.giam = null; moiTruong.heDieuHanhGiam = true;
  assert.equal(coChuyenDong(), false);
  assert.equal(moCuaVao(el, { lop: 'dang-doi' }), false);
  assert.equal(moCuaVao(null), false);
});
