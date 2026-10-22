// v3.29 (CAU-HOI O-7) — lịch sử trình duyệt của đường dẫn chức năng (views/shell/duong-dan.js), chạy với history / location / document giả:
// các lần sáng mục menu trong CÙNG một lượt bấm chỉ thêm MỘT bước (mục cuối); mở theo đường dẫn chỉ sửa bước hiện tại (chữ thường → chữ hoa) kể cả khi
// màn còn đang nạp, còn lần bấm sau đó vẫn thêm bước; đường dẫn không thuộc vai → trang đầu, sửa bước hiện tại, có thông báo; thẻ (Giao việc) theo
// thẻ đang chọn. Chạy `npm test` trong frontend/.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const buoc = [];   // nhật ký thao tác lịch sử: ['push' | 'replace', url]
const phanTu = () => ({ setAttribute() {}, append() {}, appendChild() {}, addEventListener() {}, remove() {}, classList: { contains: () => false } });
const thongBao = [];
const viTri = { pathname: '/', search: '', hash: '' };
globalThis.location = viTri;
globalThis.history = {
  pushState: (_s, _t, url) => { buoc.push(['push', url]); viTri.pathname = url; },
  replaceState: (_s, _t, url) => { buoc.push(['replace', url]); viTri.pathname = url; },
};
globalThis.document = {
  getElementById: (id) => (id === 'toastContainer' ? { appendChild: (el) => thongBao.push(el) } : null),
  createElement: phanTu, body: { appendChild() {} },
};
const { ghiDuongDan, moManDau, datMenuDuongDan, dangKyThe, dangKyQuyenDuongDan } = await import('../src/views/shell/duong-dan.js');
const { state } = await import('../src/lib/state.js');
const { registerActions } = await import('../src/lib/actions.js');
const { menuCuaVai } = await import('../src/views/shell/menu.js');

const xongLuot = () => new Promise((r) => setTimeout(r, 0));   // chờ microtask ghi đường dẫn
const datLai = (pathname) => { buoc.length = 0; viTri.pathname = pathname; };

test('Một lượt bấm sáng hai mục (chuyên viên: "Việc tôi theo dõi" mở danh sách rồi đổi mục) → một bước lịch sử, đường dẫn của mục cuối', async () => {
  state.user = { id: 'cv', role_group: 'A3' };
  datLai('/Giao-viec');
  ghiDuongDan('navDieuHanh'); ghiDuongDan('navTheoDoi');
  await xongLuot();
  assert.deepEqual(buoc, [['push', '/Viec-toi-theo-doi']]);
});

test('Mở theo đường dẫn: chữ thường → sửa tại chỗ; màn còn đang nạp thì lần bấm sau vẫn thêm bước (không ghi đè)', async () => {
  state.user = { id: 'cvp', role_group: 'A1', is_chief: true };
  datMenuDuongDan(menuCuaVai(state.user));
  registerActions({
    openBaoCao: () => { ghiDuongDan('navBaoCao'); return new Promise(() => {}); },   // màn nạp mãi chưa xong
    openTongQuan: () => { ghiDuongDan('navTongQuan'); return Promise.resolve(); },
  });
  datLai('/bao-cao');
  moManDau(() => { ghiDuongDan('navTongQuan'); });
  await xongLuot();
  assert.deepEqual(buoc, [['replace', '/Bao-cao']]);
  ghiDuongDan('navTheoVanBan');   // người dùng bấm menu khi Báo cáo vẫn đang nạp
  await xongLuot();
  assert.deepEqual(buoc.at(-1), ['push', '/Theo-van-ban']);
});

test('Đường dẫn không thuộc vai → trang đầu của vai, sửa bước hiện tại, có thông báo; đường dẫn đúng thì không ghi lại', async () => {
  state.user = { id: 'cv', role_group: 'A3' };
  datMenuDuongDan(menuCuaVai(state.user));
  datLai('/Bao-cao'); thongBao.length = 0;
  moManDau(() => { ghiDuongDan('navDieuHanh'); });
  await xongLuot();
  assert.deepEqual(buoc, [['replace', '/Viec-cua-toi']]);
  assert.equal(thongBao.length, 1);
  datLai('/Viec-cua-toi');
  ghiDuongDan('navDieuHanh');
  await xongLuot();
  assert.deepEqual(buoc, [], 'đã đúng đường dẫn: không thêm bước');
});

test('Thẻ Giao việc: "Nhập từ Excel" / "Chờ hoàn thiện" có đường dẫn riêng; mở thẳng cần quyền nhập liệu', async () => {
  state.user = { id: 'tp', role_group: 'A2' };
  datMenuDuongDan(menuCuaVai(state.user));
  let the = 'giao'; let moThe = null;
  dangKyThe('navGiaoViec', () => the);
  registerActions({ openNhapExcel: ({ tab }) => { moThe = tab; the = tab; ghiDuongDan('navGiaoViec'); } });
  datLai('/Giao-viec');
  the = 'nhap'; ghiDuongDan('navGiaoViec');
  await xongLuot();
  assert.deepEqual(buoc, [['push', '/Nhap-Excel']]);
  dangKyQuyenDuongDan('nhapExcel', () => true);
  datLai('/cho-hoan-thien');
  moManDau(() => {});
  await xongLuot();
  assert.equal(moThe, 'cho'); assert.deepEqual(buoc, [['replace', '/Cho-hoan-thien']]);
  dangKyQuyenDuongDan('nhapExcel', () => false); moThe = null;
  datLai('/Nhap-Excel');
  moManDau(() => { the = 'giao'; ghiDuongDan('navDieuHanh'); });
  await xongLuot();
  assert.equal(moThe, null, 'không có quyền nhập liệu: không mở thẻ'); assert.deepEqual(buoc, [['replace', '/Can-xu-ly']]);
});
