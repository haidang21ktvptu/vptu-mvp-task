// v3.29 (chủ dự án 22/10/2026 — CAU-HOI O-7): đường dẫn riêng cho từng chức năng — tách, chuẩn hoá, chỉ mở chức năng có trong menu của vai; tệp dựng
// sẵn cho GitHub Pages; chính sách nội dung (CSP) của bản build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TUYEN, THE_QUAN_TRI, DS_TEP, tachDuong, timTuyen, duongCua, chonMo } from '../src/lib/tuyen.js';
import { chinhSachNoiDung, doanScriptNoiTuyen } from '../src/lib/csp.js';
import { menuCuaVai } from '../src/views/shell/menu.js';

const B = '/vptu-mvp-task/'; const S = '/vptu-mvp-task/staging/';

test('Tách đường dẫn: bỏ base, ".html", gạch chéo cuối, giải mã; ngoài base → null; base của staging', () => {
  assert.deepEqual(tachDuong('/vptu-mvp-task/Tong-quan', B), { duong: 'Tong-quan', the: '' });
  assert.deepEqual(tachDuong('/vptu-mvp-task/Quan-tri/Tai-khoan/', B), { duong: 'Quan-tri', the: 'Tai-khoan' });
  assert.deepEqual(tachDuong('/vptu-mvp-task/Bao-cao.html', B), { duong: 'Bao-cao', the: '' });
  assert.deepEqual(tachDuong('/vptu-mvp-task/', B), { duong: '', the: '' });
  assert.deepEqual(tachDuong('/vptu-mvp-task', B), { duong: '', the: '' });
  assert.deepEqual(tachDuong('/vptu-mvp-task/index.html', B), { duong: '', the: '' });
  assert.deepEqual(tachDuong('/vptu-mvp-task/staging/Can-bo', S), { duong: 'Can-bo', the: '' });
  assert.deepEqual(tachDuong('/VPTU-MVP-TASK/tong%2Dquan', B), { duong: 'tong-quan', the: '' });
  assert.equal(tachDuong('/khac/Tong-quan', B), null);
});

test('Bảng đường dẫn: tên không trùng; tìm không phân biệt hoa / thường; chuyên viên "Việc của tôi"; tệp dựng sẵn gồm cả thẻ Quản trị', () => {
  const ten = TUYEN.map((t) => t.duong.toLowerCase());
  assert.equal(new Set(ten).size, ten.length);
  assert.equal(timTuyen('BAO-CAO').duong, 'Bao-cao');
  assert.equal(timTuyen('khong-co'), null);
  assert.equal(duongCua({ nav: 'navDieuHanh', vai: 'A3' }), 'Viec-cua-toi');
  assert.equal(duongCua({ nav: 'navDieuHanh', vai: 'A1' }), 'Can-xu-ly');
  assert.equal(duongCua({ nav: 'navKl', man: 'viewRaSoatMucTieu' }), 'Ra-soat-phan-loai', 'màn ngoài menu theo section');
  assert.equal(duongCua({ nav: 'navQuanTri', the: 'qtKhuTaiKhoan' }), 'Quan-tri/Tai-khoan');
  assert.equal(duongCua({ nav: 'navGiaoViec', the: 'nhap' }), 'Nhap-Excel', 'thẻ Nhập từ Excel của Giao việc');
  assert.equal(duongCua({ nav: 'navGiaoViec', the: 'cho' }), 'Cho-hoan-thien');
  assert.equal(duongCua({ nav: 'navGiaoViec', the: 'giao' }), 'Giao-viec');
  assert.equal(duongCua({ nav: 'navNhapExcel' }), 'Nhap-Excel', 'mục menu riêng của người chỉ nhập liệu');
  assert.equal(duongCua({ nav: 'navNhapExcel', the: 'cho' }), 'Cho-hoan-thien');
  assert.equal(duongCua({ nav: '' }), '');
  assert.ok(DS_TEP.includes('Tong-quan') && DS_TEP.includes('Quan-tri/Thong-ke-su-dung'));
  assert.equal(DS_TEP.length, new Set(TUYEN.map((t) => t.duong)).size + Object.keys(THE_QUAN_TRI).length);
  DS_TEP.forEach((d) => assert.match(d, /^[A-Za-z]+(-[A-Za-z]+)*(\/[A-Za-z]+(-[A-Za-z]+)*)?$/, `${d}: chỉ chữ không dấu và gạch nối`));
});

test('Chỉ mở chức năng có trong menu của vai; đường dẫn lạ / không thuộc vai → từ chối (mở trang đầu); chuẩn hoá chữ hoa', () => {
  const menu = (u, o) => menuCuaVai(u, o);
  const a1 = { role_group: 'A1', is_chief: true }; const a3 = { role_group: 'A3' };
  assert.deepEqual(chonMo({ duong: 'bao-cao', the: '' }, { vai: 'A1', menu: menu(a1) }), { action: 'openBaoCao', ds: {} });
  assert.deepEqual(chonMo({ duong: 'Bao-cao', the: '' }, { vai: 'A3', menu: menu(a3) }), { tuChoi: true }, 'chuyên viên không có Báo cáo');
  assert.deepEqual(chonMo({ duong: 'Viec-cua-toi', the: '' }, { vai: 'A3', menu: menu(a3) }), { action: 'openDieuHanh', ds: {} });
  assert.equal(chonMo({ duong: 'Can-xu-ly', the: '' }, { vai: 'A3', menu: menu(a3) }).action, 'openDieuHanh', 'cùng màn (màn ghi lại tên của vai)');
  assert.deepEqual(chonMo({ duong: 'Nhiem-vu', the: '' }, { vai: 'A3', menu: menu(a3, { xemPhong: true }) }).action, 'openKlPhong', 'mục theo cấu hình của chuyên viên');
  assert.deepEqual(chonMo({ duong: 'xyz', the: '' }, { vai: 'A1', menu: menu(a1) }), { tuChoi: true });
  assert.equal(chonMo({ duong: '', the: '' }, { vai: 'A1', menu: menu(a1) }), null);
  assert.deepEqual(chonMo({ duong: 'Quan-tri', the: 'tai-khoan' }, { vai: 'A1', menu: menu(a1), quyen: { quanTri: true } }),
    { action: 'openQuanTri', ds: { tab: 'qtKhuTaiKhoan' } });
  assert.deepEqual(chonMo({ duong: 'Quan-tri', the: '' }, { vai: 'A3', menu: menu(a3), quyen: { quanTri: false } }), { tuChoi: true });
  assert.deepEqual(chonMo({ duong: 'Ra-soat-phan-loai', the: '' }, { vai: 'A0', menu: [], quyen: { raSoat: false } }), { tuChoi: true });
  assert.deepEqual(chonMo({ duong: 'Tro-giup', the: '' }, { vai: 'A0', menu: [] }), { action: 'openTroGiup', ds: {} });
  assert.deepEqual(chonMo({ duong: 'nhap-excel', the: '' }, { vai: 'A1', menu: menu(a1), quyen: { nhapExcel: true } }), { action: 'openNhapExcel', ds: { tab: 'nhap' } });
  assert.deepEqual(chonMo({ duong: 'Cho-hoan-thien', the: '' }, { vai: 'A3', menu: menu(a3), quyen: { nhapExcel: true } }), { action: 'openNhapExcel', ds: { tab: 'cho' } });
  assert.deepEqual(chonMo({ duong: 'Nhap-Excel', the: '' }, { vai: 'A1', menu: menu(a1), quyen: { nhapExcel: false } }), { tuChoi: true }, 'không phải người nhập liệu');
  assert.deepEqual(chonMo({ duong: 'Nhap-Excel', the: '' }, { vai: 'A0', menu: [], quyen: { nhapExcel: true } }), { tuChoi: true }, 'menu không có Giao việc / Nhập từ Excel');
});

test('Chính sách nội dung: chỉ mã của hệ thống, chỉ máy chủ dữ liệu của bản đó (https + wss), không nhúng đối tượng ngoài', () => {
  const c = chinhSachNoiDung('https://abcxyz.supabase.co');
  assert.match(c, /(^|; )script-src 'self'(;|$)/);
  assert.match(c, /connect-src 'self' https:\/\/abcxyz\.supabase\.co wss:\/\/abcxyz\.supabase\.co/);
  assert.match(c, /object-src 'none'/); assert.match(c, /form-action 'self'/); assert.match(c, /base-uri 'self'/);
  assert.doesNotMatch(c, /unsafe-eval|\*/);
  assert.match(chinhSachNoiDung('http://127.0.0.1:54321'), /connect-src 'self' http:\/\/127\.0\.0\.1:54321 ws:\/\/127\.0\.0\.1:54321/, 'Supabase cục bộ (CI)');
  assert.match(chinhSachNoiDung(undefined), /connect-src 'self'(;|$)/);
  assert.match(chinhSachNoiDung('https://x.supabase.co', { bamScript: ['QUJD'] }), /script-src 'self' 'sha256-QUJD'(;|$)/, 'đoạn nội tuyến đã biết (băm lúc build)');
  const html = '<head><script>var a = 1;</script><script type="module" crossorigin src="/vptu-mvp-task/assets/index.js"></script><script defer>b()</script></head>';
  assert.deepEqual(doanScriptNoiTuyen(html), ['var a = 1;', 'b()'], 'chỉ đoạn không có src');
});
