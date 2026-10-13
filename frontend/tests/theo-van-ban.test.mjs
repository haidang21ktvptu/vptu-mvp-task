// v3.22.1: màn "Theo văn bản" cho Trưởng phòng và chuyên viên (phạm vi RLS của người xem, không đổi quyền) — menu từng vai, không lên thanh
// dưới điện thoại, chú thích phạm vi trên dòng tóm tắt. Chạy `npm test` trong frontend/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuCuaVai } from '../src/views/shell/menu.js';
import { nhanPhamViTvb } from '../src/views/shared/theo-van-ban/template.js';

const tk = (role_group, o = {}) => ({ id: 'x', role_group, department: 'TONG_HOP', ...o });
const tvb = (u, o) => menuCuaVai(u, o).find((m) => m.id === 'navTheoVanBan');

test('Mọi vai có "Theo văn bản" ở nhóm Theo dõi; Trưởng phòng / chuyên viên không lên thanh dưới điện thoại', () => {
  for (const u of [tk('A0'), tk('A1', { is_chief: true }), tk('A1'), tk('A2'), tk('A3'), tk('A3', { quan_tri_he_thong: true })]) {
    const m = tvb(u); assert.ok(m, u.role_group); assert.equal(m.nhom, 'Theo dõi'); assert.equal(m.action, 'openTheoVanBan');
  }
  assert.ok(!tvb(tk('A2')).duoi); assert.ok(!tvb(tk('A3')).duoi);
  const xp = menuCuaVai(tk('A3'), { xemPhong: true }).map((m) => m.id);   // chuyên viên xem cả phòng (0086): vẫn một mục, không trùng
  assert.equal(xp.filter((id) => id === 'navTheoVanBan').length, 1);
  assert.deepEqual(menuCuaVai(tk('A3')).filter((m) => m.duoi).map((m) => m.id), ['navDieuHanh', 'navGiaoViec', 'navTheoDoi', 'dmBubbleLauncher']);
});

test('Chú thích phạm vi: Trưởng phòng = phòng mình; chuyên viên = việc mình (hoặc cả phòng khi bật xem cả phòng); lãnh đạo VP, Thường trực không ghi', () => {
  assert.equal(nhanPhamViTvb(tk('A2')), 'việc của phòng đồng chí');
  assert.equal(nhanPhamViTvb(tk('A3')), 'việc đồng chí chủ trì, theo dõi hoặc đã giao');
  assert.equal(nhanPhamViTvb(tk('A3'), true), 'việc của phòng đồng chí (việc người khác chỉ xem)');
  assert.equal(nhanPhamViTvb(tk('A3', { thu_ky_thuong_truc: true })), 'việc đồng chí chủ trì, theo dõi hoặc đã giao; việc có chỉ đạo Thường trực');
  assert.equal(nhanPhamViTvb(tk('A1', { is_chief: true })), ''); assert.equal(nhanPhamViTvb(tk('A0')), ''); assert.equal(nhanPhamViTvb(null), '');
});
