// 0100–0102 (v3.22, chủ dự án quyết 13/10/2026): tài khoản toàn quyền — như Chánh Văn phòng ở mọi kiểm tra quyền của người gọi; vai thật giữ
// nguyên. demo_qtht (A3, CDS_CY, quản trị hệ thống — giống qt_vptu trên production) được bật cờ tạm bằng service_role, khôi phục ở before/after.
// Kiểm: (1) chưa có cờ = chuyên viên như cũ; (2) có cờ: thấy mọi việc (khớp chuẩn đối chiếu kl_tham_chieu_pham_vi), giao trực tiếp cho phòng /
// lãnh đạo bất kỳ, không ghi thay mặt (việc này giao: Chánh VP thật sửa được thông tin giao, Phó Chánh VP thì không); gia hạn, sửa nguồn việc người khác giao; nhập Excel đi đường lãnh đạo (dòng đã xong ngoài hệ thống ở phòng
// khác nhận, cột Lãnh đạo giao bị bỏ qua); (3) không tự cấp cờ, không sửa thẳng accounts: UPDATE accounts và admin_dat_co('toan_quyen') bị chặn, hàm nội bộ
// kl_toi_hieu_dung không gọi được; (4) Thường trực có cờ vẫn là Thường trực. Khoá "KL-0100"; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS, songSong } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0100';
const coCot = async () => !(await db().from('accounts').select('toan_quyen').limit(1)).error;
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : !(await coCot()) ? 'Chưa có migration 0100 (accounts.toan_quyen).' : false;
let dem = 0;
const vb = () => ({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} #${++dem}`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02' });
const CHUNG = { san_pham_loai: 'BAO_CAO', han_xu_ly: '2026-12-31', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH' };
const goi = async (u, ham, thamSo) => (await userClient(u)).rpc(ham, thamSo);
const giao = (u, p = {}) => goi(u, 'giao_viec', { p: { van_ban_id: null, van_ban: vb(), noi_dung: `${KHOA} ${u} ${dem + 1}`, ...CHUNG, ...p } });
const datCo = (id, bat) => db().from('accounts').update({ toan_quyen: bat }).eq('id', id);
const tongViec = async () => (await db().from('nhiem_vu').select('id', { count: 'exact', head: true })).count;
const thayDuoc = async (u) => (await (await userClient(u)).from('v_nhiem_vu').select('id', { count: 'exact', head: true })).count;
const don = async () => {
  await db().from('lo_nhap').delete().like('ten_tep', `${KHOA}%`);
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
};
const BANG = ['nhiem_vu', 'v_nhiem_vu', 'v_ngoai_le', 'van_ban_giao_viec', 'lich_su', 'chi_dao', 'minh_chung', 'canh_bao', 'dinh_chinh', 'tu_choi'];
async function tatCa(taoTruyVan, label) {   // đọc đủ mọi trang (max_rows = 1000)
  const kq = [];
  for (let i = 0; ; i += 1000) { const r = await taoTruyVan().range(i, i + 999); assertOk(r, label); kq.push(...r.data); if (r.data.length < 1000) return kq; }
}
// Như kl-pq-tuong-duong-pham-vi: tập dòng policy (đọc bằng chính tài khoản) = chuẩn đối chiếu kl_tham_chieu_pham_vi, đủ 10 bảng / view.
async function doiChieu(username, uid) {
  const c = await userClient(username);
  const [r, ...doc] = await songSong([() => db().rpc('kl_tham_chieu_pham_vi', { p_nguoi: uid }), ...BANG.map((b) => () => tatCa(() => c.from(b).select('id'), `${username} ${b}`))]);
  assertOk(r, 'tham chiếu'); const goc = Object.fromEntries(r.data.map((x) => [x.bang, x.ids]));
  for (const [k, b] of BANG.entries()) {
    const moi = new Set(doc[k].map((x) => String(x.id))); const cu = new Set(goc[b] || []);
    assert.deepEqual([[...moi].filter((x) => !cu.has(x)).length, [...cu].filter((x) => !moi.has(x)).length], [0, 0], `${username} ${b}: policy ${moi.size}, gốc ${cu.size}`);
  }
}
const khoiPhuc = async () => { assertOk(await datCo(IDS.qtht, false), 'thu cờ demo_qtht'); assertOk(await datCo(IDS.a0, false), 'thu cờ demo_a0'); };

describe('0100–0102 — tài khoản toàn quyền (như Chánh Văn phòng, vai thật giữ nguyên)', { skip: SKIP }, () => {
  before(async () => { await khoiPhuc(); await don(); });
  after(async () => { await khoiPhuc(); await don(); });
  let nvCv1; let nvCvp;

  test('1. Chưa có cờ: demo_qtht là chuyên viên — không giao cho phòng, chỉ thấy việc của mình', async () => {
    const a = await giao('demo_cv1', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 }); assertOk(a, 'cv1 tự giao'); nvCv1 = a.data.id;
    const b = await giao('demo_cvp', { owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2 }); assertOk(b, 'CVP giao cv2'); nvCvp = b.data.id;
    assert.equal((await goi('demo_qtht', 'me_toan_quyen', {})).data, false);
    assertDenied(await giao('demo_qtht', { owner_don_vi_ma: 'QUAN_TRI' }), 'chuyên viên giao cho phòng');
    assert.equal((await (await userClient('demo_qtht')).from('v_nhiem_vu').select('id').in('id', [nvCv1, nvCvp])).data.length, 0, 'không thấy việc người khác');
  });

  test('2. Có cờ: thấy mọi việc (bằng tổng số việc, khớp kl_tham_chieu_pham_vi), giao trực tiếp cho phòng / lãnh đạo bất kỳ, không ghi thay mặt', async () => {
    assertOk(await datCo(IDS.qtht, true), 'bật cờ');
    assert.equal((await goi('demo_qtht', 'me_toan_quyen', {})).data, true);
    const tong = await tongViec();
    assert.equal(await thayDuoc('demo_qtht'), tong, 'thấy toàn bộ việc như Chánh VP');
    await doiChieu('demo_qtht', IDS.qtht);   // 10 bảng (kể cả tu_choi — kl_tu_choi_thay_duoc 0100)
    const [rp, rl, rtm] = [await giao('demo_qtht', { owner_don_vi_ma: 'QUAN_TRI', nguoi_theo_doi: IDS.truongphong }),
      await giao('demo_qtht', { owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.pcvp }),
      await giao('demo_qtht', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, thay_mat_cho: IDS.truongphong })];
    assertOk(rp, 'giao cho phòng Quản trị, theo dõi = Trưởng phòng Tổng hợp'); assertOk(rl, 'giao cho Phó Chánh VP');
    assert.equal(rtm.error?.code, '22023', 'thay mặt'); assert.match(rtm.error.message, /Lãnh đạo giao việc trực tiếp/);
    const n = (await db().from('nhiem_vu').select('tao_boi, giao_thay_mat_cho, nguoi_theo_doi').eq('id', rp.data.id).single()).data;
    assert.deepEqual(n, { tao_boi: IDS.qtht, giao_thay_mat_cho: null, nguoi_theo_doi: IDS.truongphong });
    // kl_cap_bac(toàn quyền) = 2: Chánh VP thật sửa được thông tin giao của việc tài khoản này giao; Phó Chánh VP chủ trì thì không.
    const sua = (u) => goi(u, 'dat_thong_tin_giao', { p_id: rl.data.id, p_nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', p_don_vi_phoi_hop: KHOA });
    assertDenied(await sua('demo_pcvp'), 'Phó Chánh VP (chủ trì) sửa thông tin giao'); assertOk(await sua('demo_cvp'), 'Chánh VP thật sửa thông tin giao');
  });

  test('3. Có cờ: gia hạn việc chuyên viên tự giao, sửa nguồn việc Chánh VP giao (tầng giao), xem lịch sử việc người khác', async () => {
    assertOk(await goi('demo_qtht', 'chi_dao_gui', { p: { nhiem_vu_id: nvCv1, loai: 'GIA_HAN', noi_dung: `${KHOA} gia hạn`, han_moi: '2027-01-31' } }), 'gia hạn');
    assert.equal((await db().from('nhiem_vu').select('han_xu_ly').eq('id', nvCv1).single()).data.han_xu_ly, '2027-01-31');
    assertOk(await goi('demo_qtht', 'dat_thong_tin_giao', { p_id: nvCvp, p_nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', p_don_vi_phoi_hop: 'Phòng Tổng hợp' }), 'sửa nguồn');
    assert.ok(((await (await userClient('demo_qtht')).from('lich_su').select('id').eq('nhiem_vu_id', nvCvp)).data || []).length >= 1, 'lịch sử');
  });

  test('4. Có cờ: nhập Excel đi đường lãnh đạo — dòng đã xong ngoài hệ thống ở phòng khác nhận, cột Lãnh đạo giao bị bỏ qua', async () => {
    const lo = await goi('demo_qtht', 'nhap_excel_lo_tao', { p: { ten_tep: `${KHOA}.xlsx`, mau: 'TU_GHEP', che_do_xong: 'DA_XONG_NGOAI', so_dong: 2 } }); assertOk(lo, 'mở lô');
    const VB = { loai_van_ban: 'CONG_VAN', so_ket_luan: `${KHOA}/EX`, ngay_ban_hanh: '2026-09-01' };
    const r = await goi('demo_qtht', 'nhap_excel_dong', { p_lo: lo.data.id, p_dong: [
      { so_dong: 1, ...VB, noi_dung: `${KHOA} xong ngoài`, tien_do_ma: 'HOAN_THANH', owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, nguoi_theo_doi: IDS.cv2, kq_so_hieu: '1/BC', kq_ngay: '2026-09-20' },
      { so_dong: 2, ...VB, noi_dung: `${KHOA} đang làm`, tien_do_ma: 'DANG_THUC_HIEN', owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.pcvp, nguoi_theo_doi: IDS.pcvp,
        thay_mat_cho: IDS.truongphong, ...CHUNG, loai_thoi_han_ma: 'CO_HAN_CU_THE', do_khan: 'THUONG' }] });
    assertOk(r, 'nhập dòng');
    assert.deepEqual(r.data.map((x) => x.ket_qua), ['DA_XONG', 'GIAO'], JSON.stringify(r.data));
    const ds = (await db().from('nhiem_vu').select('noi_dung, tao_boi, giao_thay_mat_cho').in('id', r.data.map((x) => x.nhiem_vu_id)).order('noi_dung')).data;
    assert.ok(ds.every((x) => x.tao_boi === IDS.qtht && x.giao_thay_mat_cho === null), JSON.stringify(ds));
  });

  test('5. Không tự cấp cờ: UPDATE accounts trực tiếp, admin_dat_co("toan_quyen") bị chặn; kl_toi_hieu_dung không gọi được', async () => {
    const qt = await userClient('demo_qtht');
    const u = await qt.from('accounts').update({ toan_quyen: true }).eq('id', IDS.cv1).select('id');
    assert.ok(u.error || (u.data || []).length === 0, `UPDATE accounts phải bị chặn: ${JSON.stringify(u.data)}`);
    assert.equal((await db().from('accounts').select('toan_quyen').eq('id', IDS.cv1).single()).data.toan_quyen, false);
    const ten = await qt.from('accounts').update({ full_name: `${KHOA} đổi tên` }).eq('id', IDS.cv1).select('id');   // accounts_update_a1 theo vai thật
    assert.ok(ten.error || (ten.data || []).length === 0, `sửa họ tên trực tiếp phải bị chặn: ${JSON.stringify(ten.data)}`);
    assert.notEqual((await db().from('accounts').select('full_name').eq('id', IDS.cv1).single()).data.full_name, `${KHOA} đổi tên`);
    const co = await goi('demo_qtht', 'admin_dat_co', { p_username: 'demo_cv1', p_co: 'toan_quyen', p_bat: true, p_ly_do: KHOA });
    assert.ok(co.error, 'admin_dat_co phải từ chối cờ toan_quyen'); assert.match(co.error.message, /không được cấp qua hàm này/);
    assert.ok((await goi('demo_qtht', 'kl_toi_hieu_dung', {})).error, 'hàm nội bộ');
  });

  test('6. Thường trực có cờ vẫn là Thường trực; thu cờ demo_qtht → về chuyên viên', async () => {
    assertOk(await datCo(IDS.a0, true), 'bật cờ A0');
    assert.equal((await goi('demo_a0', 'me_toan_quyen', {})).data, false, 'A0 không là toàn quyền');
    assertOk(await datCo(IDS.a0, false), 'thu cờ A0');
    assertOk(await datCo(IDS.qtht, false), 'thu cờ demo_qtht');
    assert.equal((await (await userClient('demo_qtht')).from('v_nhiem_vu').select('id').eq('id', nvCvp)).data.length, 0, 'không còn thấy việc của CVP');
  });
});
