// PQ-5 — ca biên E3 (PCVP kiêm nhiệm ngành–lĩnh vực: thấy việc của phòng khác nhưng KHÔNG giao việc cho phòng đó — phu_trach() chỉ xét
// phân công phòng; test [hanh-vi-hien-tai], chờ xác nhận nghiệp vụ), E4 (thư ký Thường trực là A2 / A1 giữ cờ: đóng CHI_DAO_TT thay mặt
// được, không cờ bị chặn, thu cờ mất ngay; cờ không bớt quyền vai gốc), và A1/A2 giữ quan_tri_kl giao thẳng Owner đơn vị ngoài,
// không ghi thay_mat_cho (ghi → 22023). Khoá dữ liệu: "KL-PQ5"; phân công kiêm nhiệm ly_do "KL-PQ5 LV"; tự dọn, cờ khôi phục ở before lẫn after.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS } from './lib.mjs';
import { setupKlFixtures, klSchemaReady, linhVucReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) && (await linhVucReady()) ? false : 'Chưa có migration KL / dm_linh_vuc trên project này.';
const db = () => adminClient();
const KHOA = 'KL-PQ5';
const LY_DO = `${KHOA} LV`;
let fx; const id = {}; const tt = {};
const rpc = async (username, fn, args) => (await userClient(username)).rpc(fn, args);
const loi = (r) => r.error?.message || '';
const giao = (u, p) => rpc(u, 'giao_viec', { p: { van_ban_id: fx.hn, noi_dung: `${KHOA} giao ${u}`, san_pham_loai: 'TO_TRINH', han_xu_ly: '2026-12-31',
  nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_ma: 'LV08_TAI_CHINH', ...p } });
const them = async (row) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, noi_dung: `${KHOA} ${row.ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
    nganh_ma: 'KINH_TE_TONG_HOP', theo_1400: true, ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: IDS.cv1, tao_boi: IDS.cvp, ...row }).select('id').single();
  assertOk(r, row.ma); id[row.ma] = r.data.id;
};
const guiTT = async (ma, ghi) => { const r = await rpc('demo_a0', 'chi_dao_gui', { p: { nhiem_vu_id: id[ma], loai: 'CHI_DAO_TT', noi_dung: `${KHOA} ${ghi}` } }); assertOk(r, `A0 gửi ${ghi}`); return r.data; };
const dong = (u, cid) => rpc(u, 'chi_dao_dong', { p_id: cid });
const co = (uid, bat) => db().from('accounts').update({ thu_ky_thuong_truc: bat }).eq('id', uid);
// Khôi phục tài khoản dùng chung về giá trị gốc (cả trước lẫn sau).
const khoiPhucTaiKhoan = async () => {
  await db().from('accounts').update({ thu_ky_thuong_truc: false, quan_tri_kl: false }).in('id', [IDS.truongphong, IDS.pcvp2, IDS.cvp]);
};
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('phu_trach_phong').delete().like('ly_do', `${LY_DO}%`);
  await db().from('quyen_lich_su').delete().eq('tai_khoan', IDS.pcvp2).like('ly_do', `${LY_DO}%`); // vết bật/tắt kiêm nhiệm của chính test
  await khoiPhucTaiKhoan();
};

describe('PQ-5 — PCVP kiêm nhiệm ngành–lĩnh vực không giao việc; thư ký TT là A2/A1; A1/A2 giữ quan_tri_kl', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    await them({ ma: 'TT1' }); await them({ ma: 'TT2' }); await them({ ma: 'TT3' });
    tt.a = await guiTT('TT1', 'luồng A'); tt.b = await guiTT('TT2', 'luồng B'); tt.c = await guiTT('TT3', 'luồng C');
  });
  after(don);

  test('1. E3 [hanh-vi-hien-tai]: PCVP2 kiêm nhiệm (TONG_HOP, KINH_TE_TONG_HOP, LV08_TAI_CHINH) thấy việc của phòng Tổng hợp nhưng giao_viec cho phòng/cán bộ Tổng hợp bị chặn 42501; PCVP phụ trách phòng vẫn giao được', async () => {
    // Chờ xác nhận nghiệp vụ: PCVP kiêm nhiệm theo ngành–lĩnh vực có được GIAO việc cho phòng đó không? Mã hiện tại: phu_trach() chỉ xét dòng nganh_ma IS NULL → KHÔNG.
    const qtht = await userClient('demo_qtht');
    assertOk(await qtht.rpc('admin_kiem_nhiem_linh_vuc', { p_username: 'demo_pcvp2', p_phong: 'TONG_HOP', p_nganh_ma: 'KINH_TE_TONG_HOP', p_linh_vuc_ma: ['LV08_TAI_CHINH'], p_bat: true, p_ly_do: LY_DO, p_tu_ngay: '2026-09-01' }), 'bật kiêm nhiệm');
    const thay = await (await userClient('demo_pcvp2')).from('nhiem_vu').select('ma').eq('ma', 'NV-T01');
    assertOk(thay, 'pcvp2 đọc'); assert.equal(thay.data.length, 1, 'pcvp2 thấy NV-T01 (Tổng hợp, Tài chính) nhờ kiêm nhiệm');
    assertDenied(await giao('demo_pcvp2', { owner_don_vi_ma: 'TONG_HOP' }), 'pcvp2 kiêm nhiệm giao cho phòng Tổng hợp');
    assertDenied(await giao('demo_pcvp2', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 }), 'pcvp2 kiêm nhiệm giao cho cv1 (Tổng hợp)');
    assert.match(loi(await giao('demo_pcvp2', { owner_don_vi_ma: 'TONG_HOP' })), /được phân công phụ trách/);
    const ok = await giao('demo_pcvp', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 });
    assertOk(ok, 'PCVP phụ trách phòng Tổng hợp giao được');
    assertOk(await qtht.rpc('admin_kiem_nhiem_linh_vuc', { p_username: 'demo_pcvp2', p_phong: 'TONG_HOP', p_nganh_ma: 'KINH_TE_TONG_HOP', p_linh_vuc_ma: ['LV08_TAI_CHINH'], p_bat: false, p_ly_do: LY_DO }), 'tắt kiêm nhiệm');
    await db().from('phu_trach_phong').delete().like('ly_do', `${LY_DO}%`);
  });

  test('2. E4: Trưởng phòng (A2) không cờ → không đóng CHI_DAO_TT; cấp cờ → đóng thay mặt được (dong_boi, vết "Đóng thay mặt Thường trực — Demo Trưởng phòng"); vẫn không gửi CHI_DAO_TT; vẫn giao việc được (cờ không bớt quyền)', async () => {
    assertDenied(await dong('demo_truongphong', tt.a), 'A2 không cờ đóng CHI_DAO_TT');
    assertOk(await co(IDS.truongphong, true), 'cấp cờ A2');
    assertOk(await dong('demo_truongphong', tt.a), 'A2 giữ cờ đóng thay mặt');
    const c = (await db().from('chi_dao').select('trang_thai, dong_boi').eq('id', tt.a).single()).data;
    assert.deepEqual(c, { trang_thai: 'DA_DONG', dong_boi: IDS.truongphong });
    const ls = await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', id['TT1']).eq('cot', 'chi_dao').like('gia_tri_moi', 'Đóng thay mặt%');
    assert.equal(ls.data.length, 1); assert.match(ls.data[0].gia_tri_moi, /^Đóng thay mặt Thường trực — Demo Trưởng phòng/);
    assertDenied(await rpc('demo_truongphong', 'chi_dao_gui', { p: { nhiem_vu_id: id['TT1'], loai: 'CHI_DAO_TT', noi_dung: 'x' } }), 'A2 giữ cờ gửi CHI_DAO_TT');
    const g = await giao('demo_truongphong', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 });
    assertOk(g, 'A2 giữ cờ thư ký vẫn giao việc cho chuyên viên phòng mình');
    assertOk(await co(IDS.truongphong, false), 'thu cờ A2');
  });

  test('3. E4: PCVP2 (A1, không phụ trách phòng của việc) không cờ → không đóng; có cờ → đóng thay mặt luồng B; thu cờ → không đóng luồng C; CVP không cờ không đóng', async () => {
    assertDenied(await dong('demo_pcvp2', tt.b), 'A1 không cờ');
    assertDenied(await dong('demo_cvp', tt.b), 'CVP không cờ');
    assertOk(await co(IDS.pcvp2, true), 'cấp cờ PCVP2');
    assertOk(await dong('demo_pcvp2', tt.b), 'PCVP2 giữ cờ đóng thay mặt');
    assert.equal((await db().from('chi_dao').select('dong_boi').eq('id', tt.b).single()).data.dong_boi, IDS.pcvp2);
    assertOk(await co(IDS.pcvp2, false), 'thu cờ PCVP2');
    assertDenied(await dong('demo_pcvp2', tt.c), 'thu cờ → mất quyền ngay');
    assert.equal((await db().from('chi_dao').select('trang_thai').eq('id', tt.c).single()).data.trang_thai, 'CHO_PHAN_HOI');
  });

  test('4. A2 / CVP giữ quan_tri_kl: giao thẳng Owner đơn vị ngoài (không thay_mat_cho) được; ghi thay_mat_cho → 22023 "không ghi thay mặt"', async () => {
    assertOk(await db().from('accounts').update({ quan_tri_kl: true }).in('id', [IDS.truongphong, IDS.cvp]), 'cấp quan_tri_kl');
    for (const u of ['demo_truongphong', 'demo_cvp']) {
      const r = await giao(u, { owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: IDS.cv1 });
      assertOk(r, `${u} giữ quan_tri_kl nhập việc đơn vị ngoài`);
      const n = (await db().from('nhiem_vu').select('giao_thay_mat_cho, tao_boi').eq('id', r.data.id).single()).data;
      assert.deepEqual(n, { giao_thay_mat_cho: null, tao_boi: IDS[u.replace('demo_', '')] });
      assert.match(loi(await giao(u, { owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: IDS.cv1, thay_mat_cho: IDS.pcvp })), /không ghi thay mặt/, `${u} ghi thay_mat_cho`);
    }
    await db().from('accounts').update({ quan_tri_kl: false }).in('id', [IDS.truongphong, IDS.cvp]);
    assertDenied(await giao('demo_truongphong', { owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: IDS.cv1 }), 'thu cờ → A2 không nhập đơn vị ngoài');
  });
});
