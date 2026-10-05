// v3.15 bàn giao tài khoản (lib/ban-giao-xuat.js): quy tắc bỏ qua giống Edge Function, phạm vi, ghép danh bạ, sheet .xlsx và trang in phiếu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lyDoBoQua, locBanGiao, dongBanGiao, sheetsBanGiao, htmlPhieuBanGiao, tenTepBanGiao, TOI_DA_HANG_LOAT } from '../src/lib/ban-giao-xuat.js';
import { taoXlsx } from '../src/lib/xlsx.js';

const tk = (id, username, full_name, o = {}) => ({ id, username, full_name, role_group: 'A3', department: 'TONG_HOP', position_title: 'Chuyên viên', must_change_password: true, is_system: false, bi_khoa: false, ...o });
const ME = 'me-1';
const DS = [
  tk('me-1', 'qt_vptu', 'Quản trị hệ thống', { department: 'CDS_CY', quan_tri_he_thong: true }),
  tk('a-1', 'nguyenvana', 'Nguyễn Văn A'),
  tk('b-2', 'tranthib', 'Trần Thị B', { must_change_password: false }),                 // đang dùng
  tk('c-3', 'levanc', 'Lê Văn C', { bi_khoa: true }),                                   // đang khoá
  tk('d-4', 'smoke_test', 'Tài khoản kỹ thuật', { is_system: true }),                   // hệ thống
  tk('e-5', 'phamthie', 'Phạm Thị E', { department: 'HC_LT', role_group: 'A2', position_title: 'Trưởng phòng' }),
  tk('f-6', 'hoangvanf', 'Hoàng Văn F', { department: 'HC_LT', must_change_password: false }),
];

test('lyDoBoQua: chính mình, hệ thống, đang khoá, đã đổi mật khẩu (trừ khi kể cả đang dùng); không có → null', () => {
  assert.equal(lyDoBoQua(undefined, ME), 'không tìm thấy tài khoản');
  assert.equal(lyDoBoQua(DS[0], ME), 'chính tài khoản đang thao tác');
  assert.equal(lyDoBoQua(DS[4], ME), 'tài khoản hệ thống');
  assert.equal(lyDoBoQua(DS[3], ME), 'đang bị khoá');
  assert.equal(lyDoBoQua(DS[2], ME), 'đã đổi mật khẩu lần đầu (đang dùng)');
  assert.equal(lyDoBoQua(DS[2], ME, true), null);
  assert.equal(lyDoBoQua(DS[1], ME), null);
});

test('locBanGiao: toàn bộ → chỉ tài khoản chưa đổi mật khẩu, không khoá, không hệ thống, không phải mình; xếp theo họ tên', () => {
  const { chon, boQua } = locBanGiao(DS, { phamVi: 'toan_bo' }, ME);
  assert.deepEqual(chon.map((a) => a.username), ['nguyenvana', 'phamthie']);
  assert.deepEqual(boQua.map((b) => b.tk.username).sort(), ['hoangvanf', 'levanc', 'qt_vptu', 'smoke_test', 'tranthib']);
  assert.equal(boQua.find((b) => b.tk.username === 'tranthib').lyDo, 'đã đổi mật khẩu lần đầu (đang dùng)');
});

test('locBanGiao: theo phòng / theo vai / kể cả đang dùng', () => {
  assert.deepEqual(locBanGiao(DS, { phamVi: 'phong', phong: 'HC_LT' }, ME).chon.map((a) => a.username), ['phamthie']);
  assert.deepEqual(locBanGiao(DS, { phamVi: 'phong', phong: 'HC_LT', keCaDangDung: true }, ME).chon.map((a) => a.username), ['hoangvanf', 'phamthie']);
  assert.deepEqual(locBanGiao(DS, { phamVi: 'vai', vai: 'A2' }, ME).chon.map((a) => a.username), ['phamthie']);
  const keCa = locBanGiao(DS, { phamVi: 'toan_bo', keCaDangDung: true }, ME);
  assert.deepEqual(keCa.chon.map((a) => a.username), ['hoangvanf', 'nguyenvana', 'phamthie', 'tranthib']);
  assert.deepEqual(keCa.boQua.map((b) => b.tk.username).sort(), ['levanc', 'qt_vptu', 'smoke_test']);   // khoá / mình / hệ thống vẫn bị bỏ qua
  assert.equal(TOI_DA_HANG_LOAT, 100);
});

test('dongBanGiao: ghép phòng, chức danh, vai từ danh bạ (theo id, rơi về username); STT từ 1', () => {
  const rows = dongBanGiao([{ id: 'e-5', username: 'phamthie', full_name: 'Phạm Thị E', mat_khau_tam: 'Ab3kd9Qm2x' }, { id: 'x', username: 'nguyenvana', full_name: 'Nguyễn Văn A', mat_khau_tam: 'Zz7hq2Kp4m' }], DS);
  assert.deepEqual(rows[0], { stt: 1, ho_ten: 'Phạm Thị E', username: 'phamthie', phong: 'Phòng Hành chính - Lưu trữ', chuc_danh: 'Trưởng phòng', vai: 'Trưởng phòng chuyên môn (A2)', mat_khau: 'Ab3kd9Qm2x' });
  assert.equal(rows[1].phong, 'Phòng Tổng hợp'); assert.equal(rows[1].stt, 2);
});

test('sheetsBanGiao: sheet "Bàn giao" 8 cột một dòng/người + sheet "Hướng dẫn"; taoXlsx tạo gói ZIP', () => {
  const rows = dongBanGiao([{ id: 'a-1', username: 'nguyenvana', full_name: 'Nguyễn Văn A', mat_khau_tam: 'Zz7hq2Kp4m' }], DS);
  const sheets = sheetsBanGiao(rows, { url: 'https://vd.local/app/', luc: '05/10/2026 09:00', nguoi: 'Quản trị (qt_vptu)' });
  assert.equal(sheets[0].ten, 'Bàn giao'); assert.equal(sheets[0].cot.length, 8);
  assert.deepEqual(sheets[0].cot.map((c) => c.nhan), ['STT', 'Họ và tên', 'Tên đăng nhập', 'Phòng / đơn vị', 'Chức danh', 'Vai trò', 'Mật khẩu tạm', 'Ghi chú']);
  assert.deepEqual(sheets[0].dong[0].slice(0, 7), [1, 'Nguyễn Văn A', 'nguyenvana', 'Phòng Tổng hợp', 'Chuyên viên', 'Cán bộ thực hiện (A3)', 'Zz7hq2Kp4m']);
  assert.equal(sheets[1].ten, 'Hướng dẫn'); assert.match(sheets[1].dong[0][0], /https:\/\/vd\.local\/app\//); assert.match(sheets[1].dong[1][0], /05\/10\/2026 09:00/);
  const bytes = taoXlsx(sheets);
  assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b);   // "PK"
});

test('htmlPhieuBanGiao: mỗi người một phiếu, có tên đăng nhập + mật khẩu + địa chỉ, escape HTML, không tải tài nguyên ngoài', () => {
  const rows = dongBanGiao([{ id: 'a-1', username: 'nguyenvana', full_name: 'Nguyễn <b>A</b>', mat_khau_tam: 'Zz7hq2Kp4m' }, { id: 'e-5', username: 'phamthie', full_name: 'Phạm Thị E', mat_khau_tam: 'Ab3kd9Qm2x' }], DS);
  const html = htmlPhieuBanGiao(rows, { url: 'https://vd.local/app/', luc: '05/10/2026', nguoi: 'QT' });
  assert.equal((html.match(/<section class="phieu">/g) || []).length, 2);
  assert.ok(html.includes('Nguyễn &lt;b&gt;A&lt;/b&gt;') && !html.includes('Nguyễn <b>A</b>'));
  assert.ok(html.includes('>nguyenvana<') && html.includes('>Zz7hq2Kp4m<') && html.includes('https://vd.local/app/'));
  assert.ok(!/<(script|link|img)[^>]*(src|href)=["']https?:/.test(html));
  assert.ok(html.includes('window.print()'));
  assert.ok(!htmlPhieuBanGiao(rows, { tuIn: false }).includes('window.print()'));
});

test('tenTepBanGiao: ngày giờ + hậu tố', () => {
  const d = new Date(2026, 9, 5, 9, 7);
  assert.equal(tenTepBanGiao(d), 'ban-giao-tai-khoan-2026-10-05-0907.xlsx');
  assert.equal(tenTepBanGiao(d, 'xlsx', 'nguyenvana'), 'ban-giao-tai-khoan-nguyenvana-2026-10-05-0907.xlsx');
});
