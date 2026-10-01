// 0068 — admin_sua_tai_khoan (PR-4): chỉ quan_tri_he_thong sửa vai trò / phòng / chức danh; lý do bắt buộc; mỗi cột đổi một dòng quyen_lich_su
// (co = sua:<cột>, gia_tri_cu → gia_tri_moi) + nhat_ky_he_thong; A0 ⇒ phòng NULL, A1 ⇒ LANH_DAO_VAN_PHONG; một A2 mỗi phòng; chặn tài khoản hệ thống,
// tự đổi vai, đổi vai Chánh VP, rời A1 còn phân công, sang A0 còn cờ. Tài khoản bị sửa: demo_e2e_dh, demo_e2e_mc (không file tests/rls nào khác dùng);
// khôi phục giá trị gốc ghi cứng ở cả before lẫn after. Khối cuối (chỉ cục bộ): tin_tom_tat_sang mỗi người một bản tin mỗi ngày (giờ Việt Nam).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS, LA_PRODUCTION, BO_QUA_PRODUCTION, CHI_CUC_BO, homNayVN } from './lib.mjs';

const db = () => adminClient();
const DH = '00000000-0000-4000-8000-000000000013'; // demo_e2e_dh
const MC = '00000000-0000-4000-8000-000000000011'; // demo_e2e_mc
const GOC = { role_group: 'A3', department: 'TONG_HOP', position_title: 'Chuyên viên', quan_tri_kl: false, thu_ky_thuong_truc: false, tuy_chon: {} };
let t0;
const sua = (u, username, vai, phong, chucDanh, lyDo = 'RLS 0068') =>
  userClient(u).then((c) => c.rpc('admin_sua_tai_khoan', { p_username: username, p_role_group: vai, p_department: phong, p_position_title: chucDanh, p_ly_do: lyDo }));
const tk = async (id) => (await db().from('accounts').select('role_group, department, position_title').eq('id', id).single()).data;
const loi = (r, mau, label) => { assert.ok(r.error, `${label}: phải bị chặn`); assert.match(r.error.message, mau, `${label}: ${r.error.message}`); };
const khoiPhuc = async () => {
  assertOk(await db().from('accounts').update(GOC).in('id', [DH, MC]), 'khôi phục tài khoản');
  if (t0) {
    await db().from('quyen_lich_su').delete().like('co', 'sua:%').in('tai_khoan', [DH, MC]).gte('luc', t0);
    await db().from('nhat_ky_he_thong').delete().eq('hanh_dong', 'sua_tai_khoan').in('doi_tuong', ['demo_e2e_dh', 'demo_e2e_mc']).gte('luc', t0);
    await db().from('direct_messages').delete().eq('receiver_id', MC).gte('created_at', t0);
    await db().from('direct_messages').delete().eq('receiver_id', MC).like('content', '%RLS 0068%');
  }
};

describe('0068 — quản trị hệ thống sửa vai trò / phòng / chức danh', { skip: LA_PRODUCTION ? BO_QUA_PRODUCTION : false }, () => {
  before(async () => { await khoiPhuc(); t0 = new Date().toISOString(); });
  after(khoiPhuc);

  test('QTHT sửa phòng + chức danh: mỗi cột một dòng nhật ký (cũ → mới); gọi lại cùng giá trị không ghi gì', async () => {
    assertOk(await sua('demo_qtht', 'demo_e2e_dh', 'A3', 'QUAN_TRI', '  Chuyên viên PR4 '), 'sửa');
    assert.deepEqual(await tk(DH), { role_group: 'A3', department: 'QUAN_TRI', position_title: 'Chuyên viên PR4' });
    const { data: ls } = await db().from('quyen_lich_su').select('co, bat, ly_do, gia_tri_cu, gia_tri_moi, cap_boi').eq('tai_khoan', DH).gte('luc', t0).order('co');
    assert.deepEqual(ls.map((r) => [r.co, r.gia_tri_cu, r.gia_tri_moi]), [['sua:department', 'TONG_HOP', 'QUAN_TRI'], ['sua:position_title', 'Chuyên viên', 'Chuyên viên PR4']]);
    assert.ok(ls.every((r) => r.ly_do === 'RLS 0068' && r.cap_boi === IDS.qtht));
    const { data: nk } = await db().from('nhat_ky_he_thong').select('chi_tiet').eq('hanh_dong', 'sua_tai_khoan').eq('doi_tuong', 'demo_e2e_dh').gte('luc', t0);
    assert.equal(nk.length, 1);
    assert.deepEqual(nk[0].chi_tiet.moi, { department: 'QUAN_TRI', position_title: 'Chuyên viên PR4' });
    assertOk(await sua('demo_qtht', 'demo_e2e_dh', 'A3', 'QUAN_TRI', 'Chuyên viên PR4'), 'gọi lại');
    const { count } = await db().from('quyen_lich_su').select('id', { count: 'exact', head: true }).eq('tai_khoan', DH).gte('luc', t0);
    assert.equal(count, 2, 'không cột nào đổi ⇒ không thêm dòng');
  });

  test('Đổi vai sang A2: phòng chưa có A2 thì được; phòng đã có A2 đang hoạt động thì bị chặn', async () => {
    assertOk(await sua('demo_qtht', 'demo_e2e_dh', 'A2', 'QUAN_TRI', 'Trưởng phòng'), 'A3 → A2 phòng Quản trị');
    assert.equal((await tk(DH)).role_group, 'A2');
    loi(await sua('demo_qtht', 'demo_e2e_mc', 'A2', 'QUAN_TRI', 'x'), /Phòng Quản trị đã có Trưởng phòng \(A2\) đang hoạt động: Demo E2E Chuyên viên DH/, 'A2 thứ hai phòng Quản trị');
    loi(await sua('demo_qtht', 'demo_e2e_mc', 'A2', 'TONG_HOP', 'x'), /đã có Trưởng phòng \(A2\)/, 'A2 thứ hai phòng Tổng hợp');
    assert.equal((await tk(MC)).role_group, 'A3');
  });

  test('A0 ⇒ phòng NULL; A1 ⇒ LANH_DAO_VAN_PHONG; trả về A3 được', async () => {
    assertOk(await sua('demo_qtht', 'demo_e2e_mc', 'A0', 'TONG_HOP', 'Thường trực'), 'sang A0');
    assert.deepEqual(await tk(MC), { role_group: 'A0', department: null, position_title: 'Thường trực' });
    assertOk(await sua('demo_qtht', 'demo_e2e_mc', 'A1', 'QUAN_TRI', 'Phó Chánh Văn phòng'), 'A0 → A1');
    assert.equal((await tk(MC)).department, 'LANH_DAO_VAN_PHONG');
    assertOk(await sua('demo_qtht', 'demo_e2e_mc', 'A3', 'TONG_HOP', ''), 'A1 → A3 (không phân công), chức danh trống');
    assert.deepEqual(await tk(MC), { role_group: 'A3', department: 'TONG_HOP', position_title: '' });
  });

  test('Không phải quản trị hệ thống bị chặn (A3, Chánh VP)', async () => {
    assertDenied(await sua('demo_cv1', 'demo_e2e_mc', 'A3', 'QUAN_TRI', 'x'), 'demo_cv1');
    assertDenied(await sua('demo_cvp', 'demo_e2e_mc', 'A3', 'QUAN_TRI', 'x'), 'demo_cvp');
    assert.equal((await tk(MC)).department, 'TONG_HOP');
  });

  test('Chặn: lý do trống, vai/phòng sai, tài khoản không có, tài khoản hệ thống, tự đổi vai, đổi vai Chánh VP, rời A1 còn phân công', async () => {
    loi(await sua('demo_qtht', 'demo_e2e_mc', 'A3', 'QUAN_TRI', 'x', '   '), /Phải ghi lý do/, 'lý do trống');
    loi(await sua('demo_qtht', 'demo_e2e_mc', 'A4', 'QUAN_TRI', 'x'), /Vai trò "A4" không hợp lệ/, 'vai A4');
    loi(await sua('demo_qtht', 'demo_e2e_mc', 'A3', 'LANH_DAO_VAN_PHONG', 'x'), /không thuộc danh sách phòng chuyên môn/, 'A3 ở khối lãnh đạo');
    loi(await sua('demo_qtht', 'demo_e2e_mc', 'A3', null, 'x'), /không thuộc danh sách phòng chuyên môn/, 'A3 không phòng');
    loi(await sua('demo_qtht', 'khong_co_tk_0068', 'A3', 'QUAN_TRI', 'x'), /Không có tài khoản/, 'không tồn tại');
    assertDenied(await sua('demo_qtht', 'smoke_test', 'A3', 'TONG_HOP', 'x'), 'tài khoản hệ thống');
    assertDenied(await sua('demo_qtht', 'demo_qtht', 'A2', 'CDS_CY', 'x'), 'tự đổi vai');
    loi(await sua('demo_qtht', 'demo_cvp', 'A2', 'TONG_HOP', 'x'), /Chánh Văn phòng/, 'đổi vai Chánh VP');
    loi(await sua('demo_qtht', 'demo_pcvp', 'A3', 'TONG_HOP', 'x'), /kết thúc ở bảng Phân công trước/, 'PCVP còn phân công');
    const { count } = await db().from('quyen_lich_su').select('id', { count: 'exact', head: true }).like('co', 'sua:%').in('tai_khoan', [IDS.qtht, IDS.cvp, IDS.pcvp]).gte('luc', t0);
    assert.equal(count, 0, 'bị chặn ⇒ không ghi nhật ký');
    assert.equal((await tk(IDS.pcvp)).role_group, 'A1');
  });

  test('Sang A0 khi còn cờ quản trị KL hoặc thư ký Thường trực bị chặn', async () => {
    for (const co of ['quan_tri_kl', 'thu_ky_thuong_truc']) {
      assertOk(await db().from('accounts').update({ [co]: true }).eq('id', MC), `bật ${co}`);
      loi(await sua('demo_qtht', 'demo_e2e_mc', 'A0', null, 'x'), /thu quyền trước khi chuyển sang Thường trực/, `A0 khi còn ${co}`);
      assertOk(await db().from('accounts').update({ [co]: false }).eq('id', MC), `tắt ${co}`);
    }
    assert.equal((await tk(MC)).role_group, 'A3');
  });
});

// Chốt idempotent (0068 §3): canh-bao.yml gọi lại tin_tom_tat_sang khi đứt mạng ⇒ người đã nhận bản tin HÔM NAY (giờ Việt Nam) không nhận thêm.
// Mốc 00:30 giờ Việt Nam = 17:30 UTC hôm trước: so ngày theo UTC sẽ coi bản tin đó là "hôm qua" và gửi trùng.
describe('0068 — bản tin 7h30 mỗi người mỗi ngày một lần', { skip: CHI_CUC_BO }, () => {
  const banTin = () => db().from('direct_messages').select('id', { count: 'exact', head: true }).eq('receiver_id', MC).like('content', 'Bản tin 7h30%').gte('created_at', t0);
  before(async () => {
    await khoiPhuc();
    t0 = new Date(Date.now() - 1000).toISOString();
    assertOk(await db().from('accounts').update({ tuy_chon: { gom_tin: true } }).eq('id', MC), 'bật gom tin');
    assertOk(await db().from('direct_messages').insert({ sender_id: null, receiver_id: MC, content: 'RLS 0068 tin chưa đọc', is_read: false, loai: 'he_thong' }), 'tin chưa đọc');
  });
  after(khoiPhuc);

  test('Đã có bản tin lúc 00:30 giờ Việt Nam hôm nay ⇒ bỏ qua; xoá đi thì gửi một bản, gọi lại không gửi thêm', async () => {
    const r = await db().from('direct_messages').insert({ sender_id: null, receiver_id: MC, content: 'Bản tin 7h30: RLS 0068 mốc 00:30', is_read: true, loai: 'he_thong',
      created_at: `${homNayVN()}T00:30:00+07:00` }).select('id').single();
    assertOk(r, 'bản tin 00:30');
    assertOk(await db().rpc('tin_tom_tat_sang'), 'lần 1');
    assert.equal((await banTin()).count, 0, 'đã có bản tin hôm nay ⇒ không gửi');
    assertOk(await db().from('direct_messages').delete().eq('id', r.data.id), 'xoá bản tin 00:30');
    assertOk(await db().rpc('tin_tom_tat_sang'), 'lần 2');
    assert.equal((await banTin()).count, 1, 'gửi đúng một bản');
    assertOk(await db().rpc('tin_tom_tat_sang'), 'lần 3 (curl --retry)');
    assert.equal((await banTin()).count, 1, 'gọi lại không gửi trùng');
  });
});
