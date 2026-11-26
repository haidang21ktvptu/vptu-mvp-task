// v3.36 (CAU-HOI V-12) chuyển động giao diện (lib/chuyen-dong.js): chuỗi HTML số lăn / tiêu đề từng chữ / đường xu hướng nhỏ giữ nguyên văn chữ và số;
// "cửa vào" của một vùng: gắn – gỡ lớp, việc chờ cửa đóng, lần vẽ thứ hai đóng cửa, giảm chuyển động thì không gắn lớp nào; hết hẹn mà hiệu ứng
// còn chạy thì cửa chờ thêm; số không đổi thì không vẽ lại; vẽ sau lượt nạp nền chờ cửa đóng. (Chốt giữ yên nội dung vẽ lại dùng MutationObserver
// của trình duyệt — kiểm ở tests/e2e/chuyen-dong.spec.js.)
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { soLanHtml, datSo, tieuDeHtml, duongNhoSvg, coChuyenDong, moCuaVao, dongCuaVao, dangVao, truocKhiVe, sauKhiVao, veSauNap } from '../src/lib/chuyen-dong.js';

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
  assert.equal(soLanHtml(null), '<data class="so-lan" value=""></data>');
  assert.equal(soLanHtml('<5'), '<data class="so-lan" value="&lt;5">&lt;<bdi class="cs" style="--d:5;--i:0">5</bdi></data>');
  assert.ok(!soLanHtml(12).includes('<span'));   // không dùng thẻ span: quy tắc CSS viết theo thẻ của nơi đặt số (".nq-o span") không đổi cỡ, màu của số
});

test('datSo: số không đổi thì không vẽ lại (số đang lăn không bị cắt ngang); số đổi thì vẽ số lăn mới; chữ trong DOM vẫn là con số', () => {
  let lanGhi = 0;
  const el = { noiDung: '0', get textContent() { return boThe(this.noiDung); }, set innerHTML(v) { lanGhi += 1; this.noiDung = v; }, get innerHTML() { return this.noiDung; } };
  datSo(el, 0); assert.equal(lanGhi, 0); assert.equal(el.innerHTML, '0');          // "0" của mẫu HTML giữ nguyên là chữ thường
  datSo(el, 37); assert.equal(lanGhi, 1); assert.equal(el.textContent, '37'); assert.ok(el.innerHTML.includes('class="so-lan"'));
  datSo(el, '37'); assert.equal(lanGhi, 1);
  datSo(el, 41); assert.equal(lanGhi, 2); assert.equal(el.textContent, '41');
  datSo(null, 5);   // không có phần tử: không lỗi
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

test('veSauNap: lần nạp đầu (chưa có nội dung) hoặc không có cửa thì vẽ ngay; đang có nội dung và cửa đang mở thì chờ cửa đóng, lượt sau thay lượt trước; lỗi lần vẽ chờ báo qua khiLoi', () => {
  const el = phanTu(); const nhat = []; const loi = [];
  veSauNap(el, true, () => nhat.push('khong-cua'));   // không có cửa
  moCuaVao(el, { ms: 60000 });
  veSauNap(el, false, () => nhat.push('lan-dau'));    // cửa mở, chưa có nội dung: vẽ ngay để nội dung mới chạy hiệu ứng
  veSauNap(el, true, () => nhat.push('cho-1'));
  veSauNap(el, true, () => { nhat.push('cho-2'); throw new Error('vẽ lỗi'); }, (e) => loi.push(e.message));
  assert.deepEqual(nhat, ['khong-cua', 'lan-dau']);
  dongCuaVao(el);
  assert.deepEqual(nhat, ['khong-cua', 'lan-dau', 'cho-2']); assert.deepEqual(loi, ['vẽ lỗi']);
  assert.throws(() => veSauNap(el, false, () => { throw new Error('ngay'); }), /ngay/);   // vẽ ngay: lỗi về nơi gọi như trước
});

test('cửa vào: hết hẹn mà hiệu ứng hữu hạn còn chạy thì cửa chờ thêm (không cắt ngang); hiệu ứng lặp vô hạn không giữ cửa; có trần chờ', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const hieuUng = (endTime, playState = 'running') => ({ playState, effect: { getComputedTiming: () => ({ endTime }) } });
  const el = phanTu(); let ds = [hieuUng(900), hieuUng(Infinity)]; el.getAnimations = () => ds;
  moCuaVao(el, { ms: 200, veSau: true });
  t.mock.timers.tick(200); assert.equal(dangVao(el), true);    // còn hiệu ứng hữu hạn đang chạy
  t.mock.timers.tick(150); t.mock.timers.tick(150); t.mock.timers.tick(150); assert.equal(dangVao(el), true);
  ds = [hieuUng(900, 'finished'), hieuUng(Infinity)];
  t.mock.timers.tick(150); assert.equal(dangVao(el), false);   // chỉ còn hiệu ứng lặp vô hạn: đóng
  const el2 = phanTu(); el2.getAnimations = () => [hieuUng(900)];   // "chạy mãi": trần 1,8 giây
  moCuaVao(el2, { ms: 100 });
  t.mock.timers.tick(100);
  for (let i = 0; i < 11; i += 1) t.mock.timers.tick(150);   // từng nhịp 150 ms (đồng hồ giả tính hẹn mới từ mốc cuối của mỗi lần tick)
  assert.equal(dangVao(el2), true);
  t.mock.timers.tick(150); assert.equal(dangVao(el2), false);
  const el3 = phanTu();   // phần tử không có getAnimations (môi trường cũ): đóng đúng hẹn
  moCuaVao(el3, { ms: 100 }); t.mock.timers.tick(100); assert.equal(dangVao(el3), false);
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
