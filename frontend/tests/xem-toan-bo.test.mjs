// v3.23 (0103, chủ dự án duyệt 13/10/2026): mọi cán bộ xem toàn bộ nhiệm vụ (chỉ xem ngoài phạm vi), lọc theo cán bộ chủ trì / người theo dõi /
// lãnh đạo VP phụ trách, người giao của văn bản, menu theo cấu hình, bỏ Nhắn tin. Chạy `npm test` trong frontend/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chiXem, trongPhamVi, locTheoViec, locCanBo, tuyChonCanBo, ghiNgoaiPhamVi, laNgoaiPhamVi, datNgoaiPhamVi, coLocCanBo } from '../src/lib/kl/pham-vi.js';
import { CHUA_LDVP } from '../src/lib/kl/tong-quan-them.js';
import { menuCuaVai } from '../src/views/shell/menu.js';

const r = (id, o = {}) => ({ id, trong_pham_vi: true, owner_trong_van_phong: true, ...o });
const ROWS = [
  r('a', { owner_tai_khoan: 'cv1', owner_tai_khoan_ten: 'Cán bộ Một', nguoi_theo_doi: 'tp1', nguoi_theo_doi_phong: 'TONG_HOP', owner_phong: 'TONG_HOP', van_ban_id: 'vb1', ngay_ban_hanh: '2026-09-01', so_ket_luan: '12-KL/TU' }),
  r('b', { owner_tai_khoan: 'cv2', owner_tai_khoan_ten: 'Cán bộ Hai', nguoi_theo_doi: 'tp2', nguoi_theo_doi_phong: 'QUAN_TRI', owner_phong: 'QUAN_TRI', van_ban_id: 'vb2', ngay_ban_hanh: '2026-10-01', so_ket_luan: '5-TB/TU', trong_pham_vi: false }),
  r('c', { owner_tai_khoan: 'cv1', nguoi_theo_doi: 'tp1', nguoi_theo_doi_phong: 'HANH_CHINH', owner_phong: 'HANH_CHINH', van_ban_id: 'vb1', ngay_ban_hanh: '2026-09-01' }),
  r('d', { owner_tai_khoan: null, nguoi_theo_doi: 'tp1', nguoi_theo_doi_phong: 'TONG_HOP', owner_trong_van_phong: false, van_ban_id: null }),
];
const PC = [{ lanh_dao_id: 'pc1', phong: 'TONG_HOP', nganh_ma: null, linh_vuc_ma: null }, { lanh_dao_id: 'pc2', phong: 'QUAN_TRI', nganh_ma: null, linh_vuc_ma: null }];

test('Chỉ xem = trong_pham_vi false (thiếu cột / true = trong phạm vi); lọc danh sách phụ theo việc trong phạm vi', () => {
  assert.equal(chiXem(ROWS[1]), true); assert.equal(chiXem(ROWS[0]), false); assert.equal(chiXem({}), false); assert.equal(chiXem(null), false);
  assert.deepEqual(trongPhamVi(ROWS).map((x) => x.id), ['a', 'c', 'd']);
  assert.deepEqual(locTheoViec([{ nhiem_vu_id: 'a' }, { nhiem_vu_id: 'b' }], trongPhamVi(ROWS)), [{ nhiem_vu_id: 'a' }]);
});

test('Việc đã biết ngoài phạm vi (realtime bỏ qua tín hiệu phụ): ghi theo lần đọc, cập nhật theo từng việc', () => {
  ghiNgoaiPhamVi(ROWS); assert.ok(laNgoaiPhamVi('b')); assert.ok(!laNgoaiPhamVi('a'));
  datNgoaiPhamVi('b', false); assert.ok(!laNgoaiPhamVi('b')); datNgoaiPhamVi('a', true); assert.ok(laNgoaiPhamVi('a'));
  ghiNgoaiPhamVi([]); assert.ok(!laNgoaiPhamVi('a'));
});

test('Lọc theo cán bộ chủ trì, người theo dõi, lãnh đạo VP phụ trách (phân công phòng) — kết hợp được; không lọc = nguyên mảng', () => {
  assert.equal(locCanBo(ROWS, {}, PC), ROWS); assert.equal(coLocCanBo({ chuTri: '' }), false);
  assert.deepEqual(locCanBo(ROWS, { chuTri: 'cv1' }, PC).map((x) => x.id), ['a', 'c']);
  assert.deepEqual(locCanBo(ROWS, { theoDoi: 'tp2' }, PC).map((x) => x.id), ['b']);
  assert.deepEqual(locCanBo(ROWS, { ldvp: 'pc1' }, PC).map((x) => x.id), ['a', 'd']);
  assert.deepEqual(locCanBo(ROWS, { ldvp: CHUA_LDVP }, PC).map((x) => x.id), ['c']);
  assert.deepEqual(locCanBo(ROWS, { chuTri: 'cv1', ldvp: 'pc1' }, PC).map((x) => x.id), ['a']);
});

test('Lựa chọn ô lọc có đếm; tên theo danh bạ, thiếu thì theo dòng; lãnh đạo không có việc thì bỏ, có "Chưa có lãnh đạo phụ trách"', () => {
  const tc = tuyChonCanBo(ROWS, { ten: (id) => ({ tp1: 'Trưởng phòng Một' })[id], phanCong: PC, lanhDaoVP: [{ id: 'pc1', full_name: 'Phó Một' }, { id: 'pc3', full_name: 'Phó Ba' }] });
  assert.deepEqual(tc.chuTri.map((o) => [o.ma, o.ten, o.n]), [['cv2', 'Cán bộ Hai', 1], ['cv1', 'Cán bộ Một', 2]]);   // theo tên (tiếng Việt)
  assert.deepEqual(tc.theoDoi.map((o) => [o.ma, o.ten, o.n]), [['tp2', 'Cán bộ', 1], ['tp1', 'Trưởng phòng Một', 3]]);
  assert.deepEqual(tc.ldvp.map((o) => [o.ma, o.n]), [['pc1', 2], [CHUA_LDVP, 1]]);   // pc3 không có việc: bỏ
});

test('Menu: không còn Nhắn tin ở mọi vai; cấu hình xem toàn bộ → chuyên viên có Tổng quan + Toàn bộ nhiệm vụ, Trưởng phòng "Tổng quan"', () => {
  const tk = (role_group, o = {}) => ({ id: 'x', role_group, department: 'TONG_HOP', ...o });
  for (const u of [tk('A0'), tk('A1', { is_chief: true }), tk('A1'), tk('A2'), tk('A3'), tk('A3', { quan_tri_he_thong: true })]) {
    assert.ok(!menuCuaVai(u).some((m) => m.id === 'dmBubbleLauncher' || m.nhom === 'Trao đổi'), u.role_group);
    assert.ok(!menuCuaVai(u, { xemToanBo: true }).some((m) => m.id === 'dmBubbleLauncher'), u.role_group);
  }
  assert.ok(!menuCuaVai(tk('A3')).some((m) => m.id === 'navTongQuan' || m.id === 'navKl'), 'tắt cấu hình: như cũ');
  const a3 = menuCuaVai(tk('A3'), { xemToanBo: true });
  assert.equal(a3[0].id, 'navTongQuan'); assert.equal(a3[0].label, 'Tổng quan'); assert.ok(!a3[0].duoi);
  const kl = a3.filter((m) => m.id === 'navKl'); assert.equal(kl.length, 1); assert.equal(kl[0].action, 'openKlToanBo'); assert.equal(kl[0].label, 'Toàn bộ nhiệm vụ');
  const ca = menuCuaVai(tk('A3'), { xemToanBo: true, xemPhong: true });   // bật cả xem cả phòng (0086): một Tổng quan, một mục Nhiệm vụ (của phòng — có nút Toàn Văn phòng)
  assert.equal(ca.filter((m) => m.id === 'navTongQuan').length, 1); assert.deepEqual(ca.filter((m) => m.id === 'navKl').map((m) => m.action), ['openKlPhong']);
  assert.deepEqual(a3.filter((m) => m.duoi).map((m) => m.id), ['navDieuHanh', 'navGiaoViec', 'navTheoDoi']);
  assert.equal(menuCuaVai(tk('A2'), { xemToanBo: true }).find((m) => m.id === 'navTongQuan').label, 'Tổng quan');
  assert.equal(menuCuaVai(tk('A2')).find((m) => m.id === 'navTongQuan').label, 'Tổng quan phòng');
});

test('v3.23.1: người giao của văn bản = tài khoản tao_boi của việc giao thẳng (không tính việc giao tiếp xuống), nhiều việc trước', async () => {
  const { nguoiGiaoVanBan, nguoiGiaoText } = await import('../src/lib/kl/pham-vi.js');
  const ds = [{ tao_boi: 'u1' }, { tao_boi: 'u2' }, { tao_boi: 'u2' }, { tao_boi: 'u3', nhiem_vu_cha: 'x' }, { tao_boi: null }];
  const ng = nguoiGiaoVanBan(ds, (id) => ({ u1: 'Một', u2: 'Hai' })[id]);
  assert.deepEqual(ng.map((x) => [x.id, x.n]), [['u2', 2], ['u1', 1]]);
  assert.equal(nguoiGiaoText(ng), 'Hai (2 việc), Một (1 việc)');
  assert.equal(nguoiGiaoVanBan([{ tao_boi: 'u9' }])[0].ten, 'Tài khoản không còn trong danh bạ');
});
