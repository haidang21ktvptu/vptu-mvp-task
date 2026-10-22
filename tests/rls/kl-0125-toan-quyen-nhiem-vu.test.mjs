// 0125 (v3.29, chủ dự án quyết 22/10/2026 — CAU-HOI O-6): tài khoản toàn quyền sửa mọi thông tin nhiệm vụ (sua_toan_bo_nhiem_vu — ô thông tin giao +
// ô thực hiện; chỉ ô đổi; đổi hạn ở đây là đính chính, không tính gia hạn), kể cả việc đã hoàn thành, và mở lại việc đã hoàn thành (mo_lai_nhiem_vu
// — xoá ngày hoàn thành, lúc đóng, chất lượng; minh chứng giữ). Nhật ký có lý do, tin báo. Chánh VP thật, chủ trì, thư ký bị chặn; ô định danh,
// dữ liệu sai bị chặn; ma trận loại văn bản: Kết luận BTV / Thông báo TT vẫn phải có ngành, lĩnh vực. demo_e2e_tq bật cờ tạm. Khoá "KL-0125"; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS, homNayVN } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0125';
const TQ = '00000000-0000-4000-8000-000000000020';   // demo_e2e_tq
const TK = '00000000-0000-4000-8000-000000000018';   // demo_e2e_tk
const coHam = async () => (await db().rpc('mo_lai_nhiem_vu', { p_id: TQ, p_ly_do: 'x' })).error?.code !== 'PGRST202';
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : !(await coHam()) ? 'Chưa có migration 0125.' : false;
const cong = (n) => { const d = new Date(`${homNayVN()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const LOAI = ['KL_BTV', 'TB_THUONG_TRUC', 'NQ_TW', 'NQ_BCH', 'KL_BCH', 'CONG_VAN', 'KHAC'];
const vb = {}; const v = {};
const viec = async (k, loai, them = {}) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: vb[loai], noi_dung: `${KHOA} ${k}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: cong(60), nganh_ma: 'KINH_TE_TONG_HOP',
    linh_vuc_ma: 'LV08_TAI_CHINH', theo_1400: true, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.truongphong, tao_boi: IDS.pcvp,
    san_pham_loai: 'BAO_CAO', cap_nhan_san_pham: 'TRUONG_PHONG', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', ...them }).select('id, ma').single();
  assertOk(r, `việc ${k}`); v[k] = r.data;
};
const sua = async (u, k, p, lyDo = `${KHOA} đính chính`) => (await userClient(u)).rpc('sua_toan_bo_nhiem_vu', { p_id: v[k].id, p_thay_doi: p, p_ly_do: lyDo });
const doc = async (k, cot) => (await db().from('nhiem_vu').select(cot).eq('id', v[k].id).single()).data;
const co = (id, cot, bat) => db().from('accounts').update({ [cot]: bat }).eq('id', id);
const don = async () => {
  await co(TQ, 'toan_quyen', false); await co(TK, 'thu_ky_thuong_truc', false);
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
};

describe('0125 — toàn quyền sửa toàn bộ thông tin nhiệm vụ, mở lại việc đã hoàn thành', { skip: SKIP }, () => {
  before(async () => {
    await don();
    for (const [i, loai] of LOAI.entries()) {
      const r = await db().from('van_ban_giao_viec').insert({ loai, so_ket_luan: `${KHOA} ${loai}`, so_hoi_nghi: loai === 'KL_BTV' ? 125 : null, ngay_ban_hanh: cong(-50 - i),
        ngay_nhan: cong(-49 - i) }).select('id').single();
      assertOk(r, `văn bản ${loai}`); vb[loai] = r.data.id;
      await viec(loai, loai);
    }
    await viec('XONG', 'CONG_VAN', { tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: cong(-10), nguon: 'excel', chat_luong: 'DAT_TOT' });
    assertOk(await co(TQ, 'toan_quyen', true), 'bật toàn quyền');
  });
  after(don);

  test('1. Sửa nhiều ô một lần (ô không đổi bỏ qua); hạn đính chính không tính gia hạn; nhật ký có lý do; chủ trì được báo', async () => {
    const r = await sua('demo_e2e_tq', 'CONG_VAN', { noi_dung: `${KHOA} CONG_VAN (sửa)`, han_xu_ly: cong(90), ghi_chu: 'Ghi chú mới', cap_quyet_dinh: 'CHANH_VAN_PHONG', do_khan: 'THUONG' });
    assertOk(r, 'sửa'); assert.deepEqual(Object.keys(r.data).sort(), ['cap_quyet_dinh', 'ghi_chu', 'han_xu_ly', 'noi_dung']);
    assert.deepEqual(await doc('CONG_VAN', 'han_xu_ly, so_lan_gia_han, cap_quyet_dinh'), { han_xu_ly: cong(90), so_lan_gia_han: 0, cap_quyet_dinh: 'CHANH_VAN_PHONG' });
    const ls = (await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', v.CONG_VAN.id).eq('cot', 'sua_toan_bo')).data;
    assert.equal(ls.length, 1); assert.match(ls[0].gia_tri_moi, /^sửa .*Hạn xử lý.* — lý do: KL-0125 đính chính$/);
    const tin = (await db().from('direct_messages').select('receiver_id').eq('nhiem_vu_id', v.CONG_VAN.id).like('content', 'Tài khoản quản trị sửa%')).data.map((x) => x.receiver_id);
    assert.ok(tin.includes(IDS.cv1), 'chủ trì được báo');
  });

  test('2. Ma trận 7 loại văn bản: sửa được ô thông tin giao + thực hiện; Kết luận BTV / Thông báo TT vẫn không bỏ ngành, lĩnh vực', async () => {
    for (const loai of LOAI) assertOk(await sua('demo_e2e_tq', loai, { linh_vuc_chi_tiet: `Chi tiết ${loai}`, van_ban_trien_khai: `Số ${loai}` }), `sửa việc ${loai}`);
    for (const loai of ['KL_BTV', 'TB_THUONG_TRUC']) {
      const r = await sua('demo_e2e_tq', loai, { nganh_ma: 'KHONG_THUOC', linh_vuc_ma: null });
      assert.ok(r.error, `${loai} bỏ ngành`); assert.equal(r.error.code, '22023', r.error.message);
    }
    assertOk(await sua('demo_e2e_tq', 'CONG_VAN', { nganh_ma: 'KHONG_THUOC', linh_vuc_ma: 'LV99_KHONG_THUOC' }), 'Công văn: "Không thuộc" được');
  });

  test('3. Việc đã hoàn thành: sửa ngày hoàn thành được; bỏ trống ngày hoàn thành, ghi ngày cho việc chưa xong, ô định danh, ngày sai → 22023', async () => {
    assertOk(await sua('demo_e2e_tq', 'XONG', { ngay_hoan_thanh: cong(-8) }), 'ngày hoàn thành');
    assert.equal((await doc('XONG', 'ngay_hoan_thanh')).ngay_hoan_thanh, cong(-8));
    const LOI = [['XONG', { ngay_hoan_thanh: null }], ['CONG_VAN', { ngay_hoan_thanh: cong(-1) }], ['CONG_VAN', { tao_boi: null }], ['CONG_VAN', { ma: 'NV-0' }],
      ['CONG_VAN', { han_xu_ly: '2026-02-30' }], ['CONG_VAN', { han_xu_ly: cong(-200) }], ['CONG_VAN', { ghi_chu: 'Ghi chú mới' }], ['CONG_VAN', { loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: null }]];
    for (const [k, p] of LOI) { const r = await sua('demo_e2e_tq', k, p); assert.ok(r.error, JSON.stringify(p)); assert.equal(r.error.code, '22023', `${JSON.stringify(p)}: ${r.error.message}`); }
    const r = await sua('demo_e2e_tq', 'CONG_VAN', { ghi_chu: 'x' }, ' ');
    assert.equal(r.error?.code, '22023', 'thiếu lý do');
  });

  test('4. Chặn (42501): Chánh VP thật, chủ trì, thư ký Thường trực; tắt cờ toàn quyền', async () => {
    assertOk(await co(TK, 'thu_ky_thuong_truc', true), 'cấp cờ thư ký');
    for (const u of ['demo_cvp', 'demo_cv1', 'demo_e2e_tk']) {
      assertDenied(await sua(u, 'CONG_VAN', { ghi_chu: 'x' }), `${u} sửa toàn bộ`);
      assertDenied(await (await userClient(u)).rpc('mo_lai_nhiem_vu', { p_id: v.XONG.id, p_ly_do: 'x' }), `${u} mở lại`);
    }
    assertOk(await co(TK, 'thu_ky_thuong_truc', false), 'thu cờ thư ký');
  });

  test('5. Mở lại: việc chưa xong → 22023; việc đã hoàn thành → đang thực hiện, xoá ngày hoàn thành, chất lượng; nhật ký có lý do', async () => {
    const goi = async (k, lyDo) => (await userClient('demo_e2e_tq')).rpc('mo_lai_nhiem_vu', { p_id: v[k].id, p_ly_do: lyDo });
    assert.equal((await goi('CONG_VAN', 'x')).error?.code, '22023');
    assertOk(await goi('XONG', 'Kết quả chưa đạt yêu cầu'), 'mở lại');
    assert.deepEqual(await doc('XONG', 'tien_do_ma, ngay_hoan_thanh, dong_luc, chat_luong'), { tien_do_ma: 'DANG_THUC_HIEN', ngay_hoan_thanh: null, dong_luc: null, chat_luong: null });
    const ls = (await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', v.XONG.id).eq('cot', 'mo_lai')).data;
    assert.equal(ls.length, 1); assert.match(ls[0].gia_tri_moi, /^Mở lại nhiệm vụ \(đã hoàn thành ngày .*lý do: Kết quả chưa đạt yêu cầu$/);
    assertOk(await co(TQ, 'toan_quyen', false), 'tắt toàn quyền');
    assertDenied(await sua('demo_e2e_tq', 'CONG_VAN', { ghi_chu: 'x' }), 'hết cờ');
  });
});
