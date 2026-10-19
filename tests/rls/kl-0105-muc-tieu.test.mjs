// 0105–0106 (v3.24, đề xuất Tổng quan lãnh đạo duyệt 16/10/2026): mục tiêu then chốt, khối lĩnh vực, kết quả chỉ tiêu (bước C). Kiểm:
// (1) danh mục — 5 khối, đủ 12 ngành có khối, 25 mục tiêu (3 đột phá / 3 chương trình / 10 nghị quyết TW / 9 chỉ tiêu), kl_danh_muc trả mucTieu + khoi,
//     anon không đọc;
// (2) gan_muc_tieu — người giao (Chánh VP) gắn; Trưởng phòng trong phạm vi gắn được; chuyên viên chủ trì và Phó Chánh VP ngoài phạm vi bị chặn;
//     mã lạ / quá 10 mã → 22023; gắn lại y hệt không ghi lịch sử; mảng rỗng = bỏ gắn riêng; không ai ghi thẳng bảng; chuyên viên phòng khác không
//     đọc được dòng gắn của việc ngoài phạm vi;
// (3) gan_muc_tieu_van_ban — Chánh VP gắn, trả số việc chưa gắn riêng, lịch sử đúng các việc đó; Phó Chánh VP không thấy mọi việc của văn bản,
//     chuyên viên không phải người nhập, Thường trực bị chặn; chuyên viên phòng khác không đọc mặc định của văn bản ngoài phạm vi;
// (4) nhập Excel — dòng GIAO có muc_tieu_ma → việc gắn đúng mã có trong danh mục (mã lạ, trùng bị bỏ), lịch sử nguồn excel; dòng chờ không gắn;
// (5) chi_tieu_ket_qua — chỉ quản trị hệ thống / Chánh VP ghi, ghi lại cùng kỳ thay giá trị, kỳ sai / mã không phải chỉ tiêu → 22023, mọi tài khoản
//     đọc, xoá. Khoá dữ liệu "KL-0105", kỳ chỉ tiêu năm 1999 (không đụng số liệu thật); tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, anonClient, userClient, assertOk, assertDenied, homNayVN, IDS } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0105';
const coBang = async () => !(await db().from('nhiem_vu_muc_tieu').select('nhiem_vu_id').limit(1)).error;
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : !(await coBang()) ? 'Chưa có migration 0105 (nhiem_vu_muc_tieu).' : false;
const goi = async (u, ham, thamSo) => (await userClient(u)).rpc(ham, thamSo);
const cong = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const HOM = homNayVN(); const BH = cong(HOM, -10); const HAN = cong(HOM, 60);
let dem = 0;
const CHUNG = { san_pham_loai: 'BAO_CAO', han_xu_ly: HAN, nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH' };
const giao = (u, p) => goi(u, 'giao_viec', { p: { noi_dung: `${KHOA} ${u} ${++dem}`, ...CHUNG, ...p } });
const vb = () => ({ loai: 'CONG_VAN', so_ket_luan: `${KHOA}/${++dem}`, ngay_ban_hanh: BH, ngay_nhan: BH });
const ganCua = async (id) => ((await db().from('nhiem_vu_muc_tieu').select('muc_tieu_ma').eq('nhiem_vu_id', id).order('muc_tieu_ma')).data || []).map((x) => x.muc_tieu_ma);
const lsCua = async (id) => (await db().from('lich_su').select('gia_tri_cu, gia_tri_moi, nguon').eq('nhiem_vu_id', id).eq('cot', 'gan_muc_tieu').order('luc')).data || [];
const ma = (r, label) => { assert.ok(r.error, `${label}: phải bị chặn`); return r.error.code; };
const don = async () => {
  const lo = (await db().from('lo_nhap').select('id').like('ten_tep', `${KHOA}%`)).data || [];
  if (lo.length) await db().from('lo_nhap').delete().in('id', lo.map((l) => l.id));
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`).not('nhiem_vu_cha', 'is', null);
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
  await db().from('chi_tieu_ket_qua').delete().like('ky', '1999%');
  await db().from('ho_so_nhap').delete().like('ten', `${KHOA}%`);
};

describe('0105–0106 — mục tiêu then chốt, khối lĩnh vực, kết quả chỉ tiêu', { skip: SKIP }, () => {
  before(don);
  after(don);
  let t1; let t2; let vbTh; let vbHai;

  test('1. Danh mục: 5 khối, 12 ngành có khối, 25 mục tiêu theo 4 nhóm (+ mục "Không thuộc" của 0116); kl_danh_muc trả mucTieu, khoi; anon không đọc', async () => {
    const [k, n, m] = await Promise.all([db().from('dm_khoi_linh_vuc').select('ma'), db().from('dm_nganh').select('ma, khoi_ma'), db().from('dm_muc_tieu').select('nhom').eq('nguon_them', 'KHOI_TAO')]);   // 0107: danh mục mở rộng được — chỉ đếm mục khởi tạo
    assert.ok(k.data.length >= 5, 'ít nhất 5 khối (0107: quản trị thêm được)');
    assert.equal(n.data.length, 13, '12 ngành + "Không thuộc" (0116)'); assert.ok(n.data.every((x) => x.khoi_ma), 'mọi ngành có khối');
    const theo = m.data.reduce((s, x) => ({ ...s, [x.nhom]: (s[x.nhom] || 0) + 1 }), {});
    assert.deepEqual(theo, { DOT_PHA: 3, CHUONG_TRINH: 3, NQ_TW: 10, CHI_TIEU: 9, KHONG_THUOC: 1 });
    const dm = await goi('demo_cv1', 'kl_danh_muc', {}); assertOk(dm, 'kl_danh_muc');
    assert.equal(dm.data.mucTieu.filter((m) => m.nguon_them === 'KHOI_TAO' && m.nhom !== 'KHONG_THUOC').length, 25); assert.ok(dm.data.khoi.length >= 5); assert.ok(dm.data.nganh.every((x) => x.khoi_ma));
    assert.ok((await anonClient().from('dm_muc_tieu').select('ma')).error, 'anon không đọc danh mục');
  });

  test('2. gan_muc_tieu: người giao gắn, Trưởng phòng trong phạm vi gắn; chủ trì và lãnh đạo ngoài phạm vi bị chặn; mã sai → 22023; rỗng = bỏ gắn riêng', async () => {
    vbTh = vb();
    const r1 = await giao('demo_cvp', { van_ban: vbTh, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.truongphong });
    assertOk(r1, 'giao t1'); t1 = r1.data.id; vbTh = r1.data.van_ban_id;
    assertOk(await goi('demo_cvp', 'gan_muc_tieu', { p_id: t1, p_ma: ['NQ_57', 'DP_HA_TANG', 'NQ_57', ' '] }), 'Chánh VP gắn');
    assert.deepEqual(await ganCua(t1), ['DP_HA_TANG', 'NQ_57'], 'bỏ trùng, bỏ trống');
    assertOk(await goi('demo_cvp', 'gan_muc_tieu', { p_id: t1, p_ma: ['DP_HA_TANG', 'NQ_57'] }), 'gắn lại y hệt');
    assert.equal((await lsCua(t1)).length, 1, 'gắn lại y hệt không ghi thêm lịch sử');
    assertOk(await goi('demo_truongphong', 'gan_muc_tieu', { p_id: t1, p_ma: ['DP_HA_TANG'] }), 'Trưởng phòng trong phạm vi');
    assert.deepEqual(await ganCua(t1), ['DP_HA_TANG']);
    assert.equal(ma(await goi('demo_cv1', 'gan_muc_tieu', { p_id: t1, p_ma: ['NQ_57'] }), 'chuyên viên chủ trì'), '42501');
    assert.equal(ma(await goi('demo_pcvp2', 'gan_muc_tieu', { p_id: t1, p_ma: ['NQ_57'] }), 'Phó Chánh VP khối khác'), '42501');
    assert.equal(ma(await goi('demo_cvp', 'gan_muc_tieu', { p_id: t1, p_ma: ['KHONG_CO'] }), 'mã lạ'), '22023');
    const muoiMot = ['DP_CAN_BO', 'DP_HA_TANG', 'DP_KHCN_CDS', 'CTR_DU_LICH', 'CTR_KINH_TE_RUNG', 'CTR_CUA_KHAU', 'NQ_57', 'NQ_59', 'NQ_66', 'NQ_68', 'NQ_70'];
    assert.equal(ma(await goi('demo_cvp', 'gan_muc_tieu', { p_id: t1, p_ma: muoiMot }), 'quá 10 mã'), '22023');
    const ls = await lsCua(t1);
    assert.deepEqual(ls.map((l) => l.gia_tri_moi), ['Gắn mục tiêu then chốt: Đột phá hạ tầng giao thông, đô thị, môi trường; Nghị quyết 57-NQ/TW',
      'Gắn mục tiêu then chốt: Đột phá hạ tầng giao thông, đô thị, môi trường']);
    assert.equal(ls[1].gia_tri_cu, 'Đột phá hạ tầng giao thông, đô thị, môi trường; Nghị quyết 57-NQ/TW');
    const tt = await (await userClient('demo_cvp')).from('nhiem_vu_muc_tieu').insert({ nhiem_vu_id: t1, muc_tieu_ma: 'NQ_59' });
    assertDenied(tt, 'Chánh VP INSERT thẳng bảng');
    const [cv1, cv2] = await Promise.all([userClient('demo_cv1'), userClient('demo_cv2')]);
    assert.equal((await cv1.from('nhiem_vu_muc_tieu').select('muc_tieu_ma').eq('nhiem_vu_id', t1)).data.length, 1, 'chủ trì đọc được');
    assert.equal((await cv2.from('nhiem_vu_muc_tieu').select('muc_tieu_ma').eq('nhiem_vu_id', t1)).data.length, 0, 'phòng khác không đọc');
    assertOk(await goi('demo_cvp', 'gan_muc_tieu', { p_id: t1, p_ma: [] }), 'bỏ gắn riêng');
    assert.deepEqual(await ganCua(t1), []);
    assert.equal((await lsCua(t1)).at(-1).gia_tri_moi, 'Bỏ gắn riêng mục tiêu then chốt — tính theo văn bản');
  });

  test('3. gan_muc_tieu_van_ban: Chánh VP gắn — trả số việc chưa gắn riêng; Phó Chánh VP không thấy mọi việc, chuyên viên, Thường trực bị chặn', async () => {
    const r2 = await giao('demo_cvp', { van_ban: vb(), owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.truongphong });
    assertOk(r2, 'giao việc 1 của văn bản hai phòng'); vbHai = r2.data.van_ban_id;
    const r3 = await giao('demo_cvp', { van_ban_id: vbHai, owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, nguoi_theo_doi: IDS.cv2 });
    assertOk(r3, 'giao việc 2 (Quản trị)'); t2 = r3.data.id;
    assertOk(await goi('demo_cvp', 'gan_muc_tieu', { p_id: t2, p_ma: ['CTR_CUA_KHAU'] }), 'việc 2 gắn riêng');
    const g = await goi('demo_cvp', 'gan_muc_tieu_van_ban', { p_van_ban: vbHai, p_ma: ['DP_KHCN_CDS'] });
    assertOk(g, 'Chánh VP gắn văn bản'); assert.equal(g.data, 1, 'một việc chưa gắn riêng đổi theo');
    const vbm = (await db().from('van_ban_muc_tieu').select('muc_tieu_ma').eq('van_ban_id', vbHai)).data.map((x) => x.muc_tieu_ma);
    assert.deepEqual(vbm, ['DP_KHCN_CDS']);
    assert.match((await lsCua(r2.data.id)).at(-1).gia_tri_moi, /^Văn bản KL-0105\/\d+ gắn mục tiêu then chốt: Đột phá khoa học/);
    assert.equal((await lsCua(t2)).length, 1, 'việc đã gắn riêng không ghi lịch sử văn bản');
    assert.equal((await goi('demo_cvp', 'gan_muc_tieu_van_ban', { p_van_ban: vbHai, p_ma: ['DP_KHCN_CDS'] })).data, 0, 'y hệt: không đổi');
    for (const [u, label] of [['demo_pcvp', 'Phó Chánh VP chỉ thấy việc Tổng hợp'], ['demo_cv1', 'chuyên viên không nhập văn bản'], ['demo_a0', 'Thường trực']]) {
      assert.equal(ma(await goi(u, 'gan_muc_tieu_van_ban', { p_van_ban: vbHai, p_ma: ['NQ_57'] }), label), '42501');
    }
    assertOk(await goi('demo_cvp', 'gan_muc_tieu_van_ban', { p_van_ban: vbTh, p_ma: ['NQ_DH_XIV'] }), 'gắn văn bản chỉ có việc Tổng hợp');
    const cv2 = await userClient('demo_cv2');
    assert.equal((await cv2.from('van_ban_muc_tieu').select('muc_tieu_ma').eq('van_ban_id', vbTh)).data.length, 0, 'phòng khác không đọc mặc định văn bản');
    assert.equal((await cv2.from('van_ban_muc_tieu').select('muc_tieu_ma').eq('van_ban_id', vbHai)).data.length, 1, 'có việc của mình trong văn bản thì đọc được');
  });

  test('4. Nhập Excel: dòng GIAO có mục tiêu → việc gắn đúng mã có trong danh mục, lịch sử nguồn excel; dòng chờ không gắn', async () => {
    const tao = await goi('demo_cvp', 'nhap_excel_lo_tao', { p: { ten_tep: `${KHOA}-muc-tieu.xlsx`, mau: 'TU_GHEP', che_do_xong: 'DA_XONG_NGOAI', so_dong: 2 } });
    assertOk(tao, 'mở lô');
    const VB = { loai_van_ban: 'CONG_VAN', so_ket_luan: `${KHOA}/EXCEL`, ngay_ban_hanh: BH };
    const r = await goi('demo_cvp', 'nhap_excel_dong', { p_lo: tao.data.id, p_dong: [
      { so_dong: 2, ...VB, ...CHUNG, loai_thoi_han_ma: 'CO_HAN_CU_THE', noi_dung: `${KHOA} excel giao`, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1,
        nguoi_theo_doi: IDS.truongphong, tien_do_ma: 'DANG_THUC_HIEN', muc_tieu_ma: ['CTR_DU_LICH', 'KHONG_CO', 'CTR_DU_LICH'], du_lieu_goc: {} },
      { so_dong: 3, ...VB, noi_dung: `${KHOA} excel thiếu`, owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: IDS.truongphong, thieu: ['san_pham'],
        muc_tieu_ma: ['NQ_57'], du_lieu_goc: {} }] });
    assertOk(r, 'nhập 2 dòng');
    assert.deepEqual(r.data.map((x) => x.ket_qua), ['GIAO', 'CHO_HOAN_THIEN']);
    const id = r.data[0].nhiem_vu_id;
    assert.deepEqual(await ganCua(id), ['CTR_DU_LICH']);
    const ls = await lsCua(id);
    assert.equal(ls.length, 1); assert.equal(ls[0].nguon, 'excel'); assert.equal(ls[0].gia_tri_moi, 'Gắn mục tiêu then chốt (nhập Excel): Du lịch bền vững');
    const truong = await goi('demo_cvp', 'ho_so_nhap_luu', { p_ten: `${KHOA} hồ sơ`, p_ten_sheet: null, p_dong_tieu_de: 1, p_anh_xa: { 'muc tieu then chot': 'muc_tieu' } });
    assertOk(truong, 'hồ sơ ghép cột nhận trường muc_tieu');
  });

  test('5. Kết quả chỉ tiêu: quản trị hệ thống / Chánh VP ghi, ghi lại thay giá trị; người khác bị chặn; kỳ, mã sai → 22023; mọi tài khoản đọc; xoá', async () => {
    const ghi = (u, p) => goi(u, 'ghi_ket_qua_chi_tieu', { p_ma: 'CHT_GRDP', p_ky: '1999', p_gia_tri: '8,2%', p_danh_gia: 'DAT', p_nguon: 'Báo cáo UBND tỉnh', ...p });
    assert.equal(ma(await ghi('demo_cv1'), 'chuyên viên'), '42501');
    assert.equal(ma(await ghi('demo_pcvp'), 'Phó Chánh VP'), '42501');
    const a = await ghi('demo_qtht'); assertOk(a, 'quản trị hệ thống ghi');
    const b = await ghi('demo_cvp', { p_gia_tri: '8,5%', p_danh_gia: 'VUOT' }); assertOk(b, 'Chánh VP ghi lại cùng kỳ');
    assert.equal(b.data, a.data, 'cùng một dòng');
    assert.equal(ma(await ghi('demo_cvp', { p_ky: '1999-13' }), 'kỳ sai'), '22023');
    assert.equal(ma(await ghi('demo_cvp', { p_ma: 'DP_CAN_BO' }), 'không phải chỉ tiêu'), '22023');
    assert.equal(ma(await ghi('demo_cvp', { p_danh_gia: 'TOT' }), 'đánh giá sai'), '22023');
    const doc = await (await userClient('demo_cv1')).from('chi_tieu_ket_qua').select('gia_tri, danh_gia').eq('ky', '1999');
    assertOk(doc, 'chuyên viên đọc'); assert.deepEqual(doc.data, [{ gia_tri: '8,5%', danh_gia: 'VUOT' }]);
    assertDenied(await (await userClient('demo_cvp')).from('chi_tieu_ket_qua').insert({ muc_tieu_ma: 'CHT_GRDP', ky: '1999-Q1', gia_tri: '1' }), 'ghi thẳng bảng');
    assert.equal(ma(await goi('demo_cv1', 'xoa_ket_qua_chi_tieu', { p_id: a.data }), 'chuyên viên xoá'), '42501');
    assertOk(await goi('demo_cvp', 'xoa_ket_qua_chi_tieu', { p_id: a.data }), 'Chánh VP xoá');
    assert.equal((await db().from('chi_tieu_ket_qua').select('id').eq('ky', '1999')).data.length, 0);
  });
});
