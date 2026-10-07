// 0079–0082 (Đợt B v3.18): thay mặt theo NHÓM (LANH_DAO_VP = Chánh + Phó Chánh VP; THUONG_TRUC = A0) — giao_thay_mat_cho = người đại diện, cả
// nhóm được báo, bất kỳ thành viên duyệt / thấy đề nghị từ chối, số đếm; thay mặt Thường trực = quy tắc Thường trực giao (owner lãnh đạo VP hoặc
// phòng, theo dõi tự suy, uu_tien THUONG_TRUC, Khẩn mặc định); Owner đơn vị ngoài Văn phòng bị chặn với MỌI vai; lãnh đạo không ghi nhóm;
// kl_pham_vi_giao(p_thay_mat_nhom). Khoá "KL-0079"; quan_tri_kl cấp tạm cho demo_cv2; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, IDS } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const KHOA = 'KL-0079';
let dem = 0;
const vb = () => ({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} #${++dem}`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02' });
const CHUNG = { san_pham_loai: 'TO_TRINH', han_xu_ly: '2026-12-31', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH' };
const giao = async (username, p = {}) => (await userClient(username)).rpc('giao_viec', { p: { van_ban_id: null, van_ban: vb(), noi_dung: `${KHOA} ${username} ${dem + 1}`, ...CHUNG, ...p } });
const loi = (r, re, label) => assert.match(r.error?.message || '', re, `${label}: ${r.error?.message || 'không có lỗi'}`);
const ma = (r, code, label) => assert.equal(r.error?.code, code, `${label}: ${r.error?.message || 'không bị chặn'}`);
const doc = async (id) => (await db().from('nhiem_vu').select('giao_thay_mat_cho, giao_thay_mat_nhom, uu_tien, nguoi_theo_doi, owner_tai_khoan, do_khan').eq('id', id).single()).data;
const nguoiNhanTin = async (id, loc = '') => (await db().from('direct_messages').select('receiver_id, content').eq('nhiem_vu_id', id).eq('loai', 'he_thong').like('content', `${loc}%`)).data.map((x) => x.receiver_id).sort();
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
  await db().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cv2);
};

describe('0079 — thay mặt theo nhóm, Owner luôn là phòng / cán bộ Văn phòng', { skip: SKIP }, () => {
  before(async () => { await don(); assertOk(await db().from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.cv2), 'cấp quan_tri_kl tạm cho cv2'); });
  after(don);
  let nvLdvp;

  test('1. quản trị KL giao thay mặt "Lãnh đạo Văn phòng": đại diện = Chánh VP, cột nhóm, không ưu tiên Thường trực; tin tới cả ba lãnh đạo + người theo dõi', async () => {
    const r = await giao('demo_cv2', { owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: IDS.cv1, thay_mat_nhom: 'LANH_DAO_VP' });
    assertOk(r, 'giao thay mặt nhóm'); nvLdvp = r.data.id;
    assert.deepEqual(await doc(nvLdvp), { giao_thay_mat_cho: IDS.cvp, giao_thay_mat_nhom: 'LANH_DAO_VP', uu_tien: null, nguoi_theo_doi: IDS.cv1, owner_tai_khoan: null, do_khan: 'THUONG' });
    const nhan = await nguoiNhanTin(nvLdvp, 'Giao việc thay mặt Lãnh đạo Văn phòng');
    for (const u of [IDS.cvp, IDS.pcvp, IDS.pcvp2, IDS.cv1]) assert.ok(nhan.includes(u), `tin giao tới ${u}`);   // staging có thể thêm lãnh đạo khác
    const ls = (await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', nvLdvp).eq('cot', 'giao_thay_mat').single()).data;
    assert.match(ls.gia_tri_moi, /giao thay mặt Lãnh đạo Văn phòng$/);
    const v = (await db().from('v_nhiem_vu').select('giao_thay_mat_nhom, giao_thay_mat_cho_ten').eq('id', nvLdvp).single()).data;
    assert.equal(v.giao_thay_mat_nhom, 'LANH_DAO_VP');
  });

  test('2. đề nghị từ chối: cấp duyệt = Chánh VP; Phó Chánh VP (thành viên nhóm) thấy, được đếm và duyệt; Trưởng phòng không duyệt được; tin đề nghị tới cả nhóm', async () => {
    const tc = await (await userClient('demo_cv1')).rpc('de_nghi_tu_choi', { p_nhiem_vu: nvLdvp, p_ly_do: `${KHOA} không đúng chức năng` });
    assertOk(tc, 'cv1 đề nghị từ chối');
    const t = (await db().from('tu_choi').select('cap_duyet').eq('id', tc.data).single()).data;
    assert.equal(t.cap_duyet, IDS.cvp, 'cấp duyệt ghi người đại diện');
    const nhanTc = await nguoiNhanTin(nvLdvp, 'Đề nghị từ chối');
    for (const u of [IDS.cvp, IDS.pcvp, IDS.pcvp2, IDS.cv2]) assert.ok(nhanTc.includes(u), `tin đề nghị từ chối tới ${u} (cả nhóm + người giao)`);
    const pcvp = await userClient('demo_pcvp');
    assert.equal((await pcvp.from('tu_choi').select('id').eq('id', tc.data)).data?.length, 1, 'PCVP thấy đề nghị');
    assert.ok(Number((await pcvp.rpc('kl_so_chua_xu_ly')).data?.de_nghi_cho_duyet) >= 1, 'PCVP có đề nghị chờ duyệt trong số đếm');
    ma(await (await userClient('demo_truongphong')).rpc('duyet_tu_choi', { p_id: tc.data, p_dong_y: true }), '42501', 'Trưởng phòng không duyệt được');
    assertOk(await pcvp.rpc('duyet_tu_choi', { p_id: tc.data, p_dong_y: true, p_y_kien: 'đồng ý' }), 'PCVP duyệt thay nhóm');
    assert.equal((await db().from('tu_choi').select('trang_thai').eq('id', tc.data).single()).data.trang_thai, 'DONG_Y');
  });

  test('3. thay mặt "Thường trực": Owner chuyên viên bị chặn; Owner phòng → theo dõi = Trưởng phòng, uu_tien THUONG_TRUC, Khẩn, đại diện = tài khoản A0', async () => {
    ma(await giao('demo_cv2', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, thay_mat_nhom: 'THUONG_TRUC' }), '42501', 'Thường trực không giao cho chuyên viên');
    const r = await giao('demo_cv2', { owner_don_vi_ma: 'TONG_HOP', thay_mat_nhom: 'THUONG_TRUC' });
    assertOk(r, 'thay mặt Thường trực giao cho phòng');
    assert.deepEqual(await doc(r.data.id), { giao_thay_mat_cho: IDS.a0, giao_thay_mat_nhom: 'THUONG_TRUC', uu_tien: 'THUONG_TRUC', nguoi_theo_doi: IDS.truongphong, owner_tai_khoan: null, do_khan: 'KHAN' });
    assert.ok((await nguoiNhanTin(r.data.id)).includes(IDS.cvp), 'Chánh VP được báo như việc Thường trực giao');
  });

  test('4. Owner đơn vị ngoài Văn phòng bị chặn với mọi vai (quản trị KL, Trưởng phòng, Chánh VP)', async () => {
    for (const [u, p] of [['demo_cv2', { thay_mat_cho: IDS.cvp, nguoi_theo_doi: IDS.cv1 }], ['demo_truongphong', {}], ['demo_cvp', {}]]) {
      const r = await giao(u, { owner_don_vi_ma: 'DANG_UY_UBND', ...p });
      ma(r, '42501', `${u} giao đơn vị ngoài`); loi(r, /phòng hoặc cán bộ Văn phòng/, u);
    }
  });

  test('5. lãnh đạo ghi thay_mat_nhom → 22023; nhóm lạ → 22023', async () => {
    ma(await giao('demo_truongphong', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, thay_mat_nhom: 'LANH_DAO_VP' }), '22023', 'Trưởng phòng ghi nhóm');
    ma(await giao('demo_cv2', { owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: IDS.cv1, thay_mat_nhom: 'BAN_GIAM_DOC' }), '22023', 'nhóm lạ');
  });

  test('6. kl_pham_vi_giao theo nhóm: Lãnh đạo VP = mọi phòng (có Quản trị); Thường trực = mọi phòng, không dòng NULL; không nhóm, không người = rỗng', async () => {
    const cv2 = await userClient('demo_cv2');
    const ldvp = (await cv2.rpc('kl_pham_vi_giao', { p_thay_mat_nhom: 'LANH_DAO_VP' })).data;
    assert.ok(ldvp.some((x) => x.phong === 'QUAN_TRI') && ldvp.some((x) => x.phong === null), 'LĐVP: phòng Quản trị và dòng Văn phòng');
    const tt = (await cv2.rpc('kl_pham_vi_giao', { p_thay_mat_nhom: 'THUONG_TRUC' })).data;
    assert.ok(tt.length > 0 && tt.every((x) => x.phong !== null), 'Thường trực: chỉ các phòng');
    assert.equal((await cv2.rpc('kl_pham_vi_giao', {})).data.length, 0, 'không thay mặt: rỗng (biểu mẫu chờ chọn lãnh đạo)');
  });
});
