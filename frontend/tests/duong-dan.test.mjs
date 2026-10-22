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
  state: null,
  back: () => { buoc.push(['back']); },
  pushState: (s, _t, url) => { buoc.push(['push', url]); viTri.pathname = url; globalThis.history.state = s ?? null; },
  replaceState: (s, _t, url) => { buoc.push(['replace', url]); viTri.pathname = url; globalThis.history.state = s ?? null; },
};
globalThis.document = {
  getElementById: (id) => (id === 'toastContainer' ? { appendChild: (el) => thongBao.push(el) } : null),
  createElement: phanTu, body: { appendChild() {} },
};
const { ghiDuongDan, moManDau, datMenuDuongDan, dangKyThe, dangKyQuyenDuongDan, ghiDangNhap, ghiViec, boViec, boMaTrenDuong, khiLichSuDoi, quenViec } =
  await import('../src/views/shell/duong-dan.js');
const { state } = await import('../src/lib/state.js');
const { registerActions } = await import('../src/lib/actions.js');
const { menuCuaVai } = await import('../src/views/shell/menu.js');

const xongLuot = () => new Promise((r) => setTimeout(r, 0));   // chờ microtask ghi đường dẫn
const datLai = (pathname, trangThai = null) => { buoc.length = 0; viTri.pathname = pathname; globalThis.history.state = trangThai; };

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

test('Chưa đăng nhập: thanh địa chỉ "/Dang-nhap", chức năng đang mở giữ trong history.state (không lên đường dẫn); gốc, chữ thường cũng về "/Dang-nhap"', () => {
  state.user = null;
  datLai('/Bao-cao'); ghiDangNhap();
  assert.deepEqual(buoc, [['replace', '/Dang-nhap']]); assert.deepEqual(globalThis.history.state, { tiep: 'Bao-cao' });
  datLai('/Quan-tri/Tai-khoan'); ghiDangNhap();
  assert.deepEqual(globalThis.history.state, { tiep: 'Quan-tri/Tai-khoan' });
  datLai('/'); ghiDangNhap();
  assert.deepEqual(buoc, [['replace', '/Dang-nhap']]); assert.equal(globalThis.history.state, null, 'địa chỉ gốc: không nhớ chức năng');
  datLai('/dang-nhap', { tiep: 'Bao-cao' }); ghiDangNhap();
  assert.deepEqual(buoc, [['replace', '/Dang-nhap']]); assert.deepEqual(globalThis.history.state, { tiep: 'Bao-cao' }, 'tải lại trang đăng nhập: giữ chức năng đã nhớ');
});

test('Đăng nhập xong ở "/Dang-nhap": mở chức năng đã nhớ (thay bước đăng nhập, không thêm bước); không nhớ gì → trang đầu, không thông báo', async () => {
  state.user = { id: 'cvp', role_group: 'A1', is_chief: true };
  datMenuDuongDan(menuCuaVai(state.user));
  let mo = '';
  registerActions({ openBaoCao: () => { mo = 'bao-cao'; ghiDuongDan('navBaoCao'); }, openTongQuan: () => { mo = 'tong-quan'; ghiDuongDan('navTongQuan'); } });
  datLai('/Dang-nhap', { tiep: 'Bao-cao' }); thongBao.length = 0;
  moManDau(() => { mo = 'mac-dinh'; ghiDuongDan('navTongQuan'); });
  await xongLuot();
  assert.equal(mo, 'bao-cao'); assert.deepEqual(buoc, [['replace', '/Bao-cao']]); assert.equal(globalThis.history.state, null);
  datLai('/Dang-nhap');
  moManDau(() => { mo = 'mac-dinh'; ghiDuongDan('navTongQuan'); });
  await xongLuot();
  assert.equal(mo, 'mac-dinh'); assert.deepEqual(buoc, [['replace', '/Tong-quan']]); assert.equal(thongBao.length, 0);
});

// Chi tiết một nhiệm vụ: "…/<chức năng>/NV-…" (chủ dự án 22/10/2026 17:02).
const moMan = async (pathname, navId) => { datLai(pathname); boMaTrenDuong(); ghiDuongDan(navId); await xongLuot(); buoc.length = 0; };
const choXong = () => new Promise((r) => setTimeout(r, 5));

test('Mở việc: thêm một bước "/Tong-quan/NV-12"; đổi sang việc khác thay bước; người dùng đóng → lùi đúng bước đó (popstate tới không vẽ lại gì)', async () => {
  state.user = { id: 'cvp', role_group: 'A1', is_chief: true };
  await moMan('/Tong-quan', 'navTongQuan');
  ghiViec('NV-12');
  assert.deepEqual(buoc, [['push', '/Tong-quan/NV-12']]); assert.deepEqual(globalThis.history.state, { chiTiet: true });
  ghiViec('nv-13');
  assert.deepEqual(buoc.at(-1), ['replace', '/Tong-quan/NV-13']); assert.deepEqual(globalThis.history.state, { chiTiet: true }, 'thay bước: giữ dấu bước do mở việc thêm');
  ghiViec('NV-13');
  assert.equal(buoc.length, 2, 'mở lại đúng việc đang mở: không ghi');
  let dong = 0; registerActions({ dongViecTheoDuong: () => { dong += 1; } });
  boViec({ nguoiDung: true });
  assert.deepEqual(buoc.at(-1), ['back']);
  viTri.pathname = '/Tong-quan'; globalThis.history.state = null; khiLichSuDoi();   // trình duyệt lùi xong
  assert.equal(dong, 0, 'bước lùi của chính app: giao diện đã đóng việc, không gọi lại');
  ghiViec('khong-phai-ma');
  assert.equal(buoc.length, 3, 'chuỗi không đúng dạng NV-<số>: bỏ qua');
});

test('Bỏ việc không do người dùng (mở danh sách khác) hoặc bước không do app thêm → sửa bước hiện tại; đổi màn → đường dẫn màn mới, không kèm mã', async () => {
  state.user = { id: 'cvp', role_group: 'A1', is_chief: true };
  await moMan('/Tong-quan', 'navTongQuan');
  ghiViec('NV-12'); boViec();
  assert.deepEqual(buoc, [['push', '/Tong-quan/NV-12'], ['replace', '/Tong-quan']]);
  datLai('/Tong-quan/NV-30');   // mở bằng đường dẫn: bước không có dấu chiTiet
  ghiViec('NV-30'); boViec({ nguoiDung: true });
  assert.deepEqual(buoc, [['replace', '/Tong-quan']], 'không lùi ra khỏi app');
  ghiViec('NV-31'); buoc.length = 0;
  ghiDuongDan('navBaoCao'); await xongLuot();
  assert.deepEqual(buoc, [['push', '/Bao-cao']]);
});

test('Quay lại / Tiến tới trong cùng màn: chỉ mở / đóng việc (thay bước, không vẽ lại màn); khác màn: mở màn rồi mở việc', async () => {
  state.user = { id: 'cvp', role_group: 'A1', is_chief: true };
  datMenuDuongDan(menuCuaVai(state.user));
  const goi = [];
  registerActions({
    moViecTheoMa: ({ ma }) => { goi.push(`viec ${ma}`); ghiViec(ma); },
    dongViecTheoDuong: () => { goi.push('dong'); },
    openTongQuan: () => { goi.push('tong-quan'); ghiDuongDan('navTongQuan'); },
    openBaoCao: () => { goi.push('bao-cao'); ghiDuongDan('navBaoCao'); },
  });
  moManDau(() => { goi.push('mac-dinh'); ghiDuongDan('navTongQuan'); });   // đăng ký trang đầu của vai cho popstate
  await moMan('/Tong-quan', 'navTongQuan'); goi.length = 0;
  viTri.pathname = '/Tong-quan/NV-20'; globalThis.history.state = { chiTiet: true }; khiLichSuDoi();   // Tiến tới
  assert.deepEqual(goi, ['viec NV-20']); assert.equal(buoc.length, 0, 'thanh địa chỉ đã đúng: không ghi thêm');
  viTri.pathname = '/Tong-quan'; globalThis.history.state = null; khiLichSuDoi();   // Quay lại
  assert.deepEqual(goi, ['viec NV-20', 'dong']);
  goi.length = 0; viTri.pathname = '/Bao-cao/NV-21'; khiLichSuDoi();   // Quay lại tới bước của màn khác
  await xongLuot(); await choXong();
  assert.deepEqual(goi, ['bao-cao', 'viec NV-21']); assert.deepEqual(buoc, [['replace', '/Bao-cao'], ['replace', '/Bao-cao/NV-21']]);
});

test('Mở thẳng / tải lại "/Bao-cao/NV-7": mở màn rồi mở việc, chỉ sửa bước hiện tại; chưa đăng nhập → "/Dang-nhap" nhớ cả việc, đăng nhập xong mở đúng', async () => {
  state.user = { id: 'cvp', role_group: 'A1', is_chief: true };
  datMenuDuongDan(menuCuaVai(state.user));
  const goi = [];
  registerActions({ moViecTheoMa: ({ ma }) => { goi.push(ma); ghiViec(ma); }, openBaoCao: () => { ghiDuongDan('navBaoCao'); }, openTongQuan: () => { ghiDuongDan('navTongQuan'); } });
  await moMan('/Tong-quan', 'navTongQuan');   // đang ở màn khác (như vừa tải trang: chưa có màn nào)
  datLai('/Bao-cao/nv-7');
  moManDau(() => { ghiDuongDan('navTongQuan'); });
  await xongLuot(); await choXong();
  assert.deepEqual(goi, ['NV-7']); assert.deepEqual(buoc, [['replace', '/Bao-cao'], ['replace', '/Bao-cao/NV-7']]);
  state.user = null; boMaTrenDuong();
  datLai('/Tong-quan/NV-9'); ghiDangNhap();
  assert.deepEqual(globalThis.history.state, { tiep: 'Tong-quan/NV-9' });
  state.user = { id: 'cvp', role_group: 'A1', is_chief: true }; goi.length = 0; buoc.length = 0;
  moManDau(() => { ghiDuongDan('navTongQuan'); });
  await xongLuot(); await choXong();
  assert.deepEqual(goi, ['NV-9']); assert.deepEqual(buoc, [['replace', '/Tong-quan'], ['replace', '/Tong-quan/NV-9']]);
});

test('Mở việc theo đường dẫn không vẽ lại màn; màn vẽ lại (lọc, nạp lại) khi việc vẫn mở không chen bước; việc đã đóng (đổi màn) thì ghi đường dẫn màn', async () => {
  state.user = { id: 'cvp', role_group: 'A1', is_chief: true };
  datMenuDuongDan(menuCuaVai(state.user));
  await moMan('/Nhiem-vu', 'navKl');
  registerActions({ moViecTheoMa: ({ ma }) => { ghiViec(ma); } });   // như kl/mo-theo-ma.js: mở ngăn trong màn, không openKl
  viTri.pathname = '/Nhiem-vu/NV-40'; globalThis.history.state = { chiTiet: true }; khiLichSuDoi();   // Tiến tới
  await xongLuot();
  assert.deepEqual(buoc, [], 'thanh địa chỉ đã đúng: không ghi');
  ghiDuongDan('navKl'); await xongLuot();   // màn vẽ lại khi việc vẫn mở
  assert.deepEqual(buoc, []);
  quenViec(); ghiDuongDan('navKl'); await xongLuot();   // "Lọc chi tiết, in" của chuyên viên: ngăn dùng chung đóng, cùng đường dẫn màn
  assert.deepEqual(buoc, [['push', '/Nhiem-vu']], 'việc không còn mở: không giữ mã trên đường dẫn');
});

test('Lượt mở việc theo đường dẫn còn chờ (màn đang nạp) bị bỏ khi người dùng chuyển màn', async () => {
  state.user = { id: 'cvp', role_group: 'A1', is_chief: true };
  datMenuDuongDan(menuCuaVai(state.user));
  const goi = []; let xongBaoCao;
  registerActions({
    moViecTheoMa: ({ ma }) => { goi.push(ma); ghiViec(ma); },
    openBaoCao: () => { ghiDuongDan('navBaoCao'); return new Promise((r) => { xongBaoCao = r; }); },
    openTongQuan: () => { ghiDuongDan('navTongQuan'); },
  });
  await moMan('/Tong-quan', 'navTongQuan');
  datLai('/Bao-cao/NV-7');
  moManDau(() => { ghiDuongDan('navTongQuan'); });
  await xongLuot();
  ghiDuongDan('navTheoVanBan'); await xongLuot();   // người dùng bấm menu khi Báo cáo còn nạp
  xongBaoCao(); await choXong();
  assert.deepEqual(goi, [], 'không mở việc trên màn người dùng vừa chuyển tới');
  assert.deepEqual(buoc.at(-1), ['push', '/Theo-van-ban']);
  ghiViec('NV-8');
  assert.deepEqual(buoc.at(-1), ['push', '/Theo-van-ban/NV-8'], 'lượt "thay bước" đã bỏ: mở việc của người dùng thêm bước');
});

test('Quay lại qua màn khác tới bước việc: giữ dấu bước do mở việc thêm — đóng việc vẫn lùi đúng một bước; bước lùi chỉ bỏ qua đúng đích', async () => {
  state.user = { id: 'cvp', role_group: 'A1', is_chief: true };
  datMenuDuongDan(menuCuaVai(state.user));
  registerActions({ moViecTheoMa: ({ ma }) => { ghiViec(ma); }, openTongQuan: () => { ghiDuongDan('navTongQuan'); }, openBaoCao: () => { ghiDuongDan('navBaoCao'); } });
  moManDau(() => { ghiDuongDan('navTongQuan'); });
  await moMan('/Tong-quan', 'navTongQuan');
  ghiViec('NV-1');   // bước có dấu
  quenViec(); ghiDuongDan('navBaoCao'); await xongLuot();   // đổi màn
  buoc.length = 0;
  viTri.pathname = '/Tong-quan/NV-1'; globalThis.history.state = { chiTiet: true }; khiLichSuDoi();   // Quay lại
  await xongLuot(); await choXong();
  assert.deepEqual(buoc, [['replace', '/Tong-quan'], ['replace', '/Tong-quan/NV-1']]);
  assert.deepEqual(globalThis.history.state, { chiTiet: true }, 'thay bước vẫn giữ dấu');
  boViec({ nguoiDung: true });
  assert.deepEqual(buoc.at(-1), ['back'], 'đóng việc: lùi đúng bước, không để hai bước "/Tong-quan" trùng');
  ghiDuongDan('navBaoCao'); await xongLuot();   // người dùng bấm menu trước khi trình duyệt lùi xong
  assert.deepEqual(buoc.at(-1), ['push', '/Bao-cao'], 'chỉ bỏ qua lần ghi đúng đích của bước lùi');
  viTri.pathname = '/Tong-quan'; globalThis.history.state = null; khiLichSuDoi();   // popstate của bước lùi
});
