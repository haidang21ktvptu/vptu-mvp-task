// C3 (Lượt 4) — kl_pham_vi_giao() và giao_viec dùng CHUNG kl_duoc_giao_cho_phong: với mỗi vai (Chánh VP, PCVP phụ trách cả phòng,
// PCVP kiêm nhiệm, Trưởng phòng, người quản trị KL giao thay mặt), MỌI tổ hợp (phòng, ngành, lĩnh vực) hàm trả về thì giao_viec qua được bước
// kiểm quyền; tổ hợp ngoài danh sách bị chặn 42501 (thay mặt: 22023). Phòng NULL = Owner không thuộc phòng nào (thử bằng Văn phòng Tỉnh ủy). Không ghi gì: mọi lời gọi giao_viec cố ý thiếu sản phẩm đầu ra ⇒ qua bước quyền thì dừng ở 22023 "sản phẩm"
// (kiểm SAU quyền) và giao dịch hủy. Khoá dữ liệu: phân công kiêm nhiệm ly_do "KL-PVG"; demo_qtht được bật quan_tri_kl tạm, khôi phục
// về giá trị gốc (false) ở before lẫn after; tự dọn trước lẫn sau. Test 8: demo_truongphong / demo_qtht được bật quan_tri_kl kèm hạn ủy quyền tạm,
// khôi phục (quan_tri_kl false, quan_tri_kl_het_han NULL — giá trị seed) ở before lẫn after.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, IDS, songSong } from './lib.mjs';
import { setupKlFixtures, klSchemaReady, linhVucReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) && (await linhVucReady()) ? false : 'Chưa có migration KL / dm_linh_vuc trên project này.';
const db = () => adminClient();
const LY_DO = 'KL-PVG kiêm nhiệm';
const KN = { phong: 'TONG_HOP', nganh: 'KINH_TE_TONG_HOP', lv: 'LV08_TAI_CHINH' };
let fx; let donViCuaPhong; let ungVien;
const khoa = (r) => `${r.phong}|${r.nganh_ma ?? ''}|${r.linh_vuc_ma ?? ''}`;

const don = async () => {
  await db().from('accounts').update({ quan_tri_kl: false, quan_tri_kl_het_han: null }).in('id', [IDS.qtht, IDS.truongphong]);   // giá trị gốc trong seed
  await db().from('phu_trach_phong').delete().like('ly_do', `${LY_DO}%`);
  await db().from('quyen_lich_su').delete().eq('tai_khoan', IDS.pcvp2).like('ly_do', `${LY_DO}%`);
};
const phamVi = async (u, thayMat) => {
  const r = await (await userClient(u)).rpc('kl_pham_vi_giao', thayMat ? { p_thay_mat: thayMat } : {});
  assertOk(r, `${u} kl_pham_vi_giao`); return r.data;
};
// Thử giao (không ghi): owner = một đơn vị của phòng, hoặc cán bộ (A2 chỉ giao cho chuyên viên phòng mình).
const thuGiao = async (u, t, ownerTaiKhoan, thayMat) => (await userClient(u)).rpc('giao_viec', { p: { van_ban_id: fx.hn, noi_dung: 'KL-PVG thử quyền', han_xu_ly: '2026-12-31',
  owner_don_vi_ma: donViCuaPhong[t.phong], owner_tai_khoan: ownerTaiKhoan, nganh_ma: t.nganh_ma, linh_vuc_ma: t.linh_vuc_ma, thay_mat_cho: thayMat } });
const quaQuyen = (r, nhan) => { assert.equal(r.error?.code, '22023', `${nhan}: phải qua bước quyền (${r.error?.message})`); assert.match(r.error.message, /sản phẩm đầu ra/, nhan); };
const biChan = (r, nhan) => assert.equal(r.error?.code, '42501', `${nhan}: phải bị chặn (${r.error?.message || 'không lỗi'})`);

async function doiChieu(u, owner = () => undefined, thayMat = undefined) {
  const ds = await phamVi(u, thayMat);
  assert.ok(ds.length > 0, `${u} có ít nhất một tổ hợp`);
  const kq = await songSong(ds.map((t) => () => thuGiao(u, t, owner(t), thayMat)), 6);
  kq.forEach((r, i) => quaQuyen(r, `${u} ${khoa(ds[i])}`));
  return new Set(ds.map(khoa));
}
const ngoai = (co) => ungVien.find((t) => !co.has(khoa(t)));

describe('C3 — kl_pham_vi_giao ≡ quyền của giao_viec (một nguồn kl_duoc_giao_cho_phong)', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    const [dv, lv] = await Promise.all([db().from('dm_don_vi').select('ma, phong').eq('trong_van_phong', true).not('phong', 'is', null).order('thu_tu'),
      db().from('dm_linh_vuc').select('ma, nganh_ma')]);
    donViCuaPhong = {}; for (const d of dv.data) donViCuaPhong[d.phong] ??= d.ma;
    ungVien = [{ phong: null, nganh_ma: null, linh_vuc_ma: null }, ...Object.keys(donViCuaPhong).flatMap((phong) => [{ phong, nganh_ma: null, linh_vuc_ma: null },
      ...lv.data.map((l) => ({ phong, nganh_ma: l.nganh_ma, linh_vuc_ma: l.ma }))])];
    donViCuaPhong.null = 'VAN_PHONG_TINH_UY';   // Owner không thuộc phòng nào
    assertOk(await (await userClient('demo_qtht')).rpc('admin_kiem_nhiem_linh_vuc', { p_username: 'demo_pcvp2', p_phong: KN.phong, p_nganh_ma: KN.nganh,
      p_linh_vuc_ma: [KN.lv], p_bat: true, p_ly_do: LY_DO, p_tu_ngay: '2026-09-01' }), 'bật kiêm nhiệm pcvp2');
  });
  after(don);

  test('1. Chánh VP: mọi phòng của Văn phòng × mọi (ngành, lĩnh vực), việc không có lĩnh vực, Owner không thuộc phòng — mỗi tổ hợp qua được bước quyền', async () => {
    const co = await doiChieu('demo_cvp');
    assert.equal(co.size, ungVien.length, 'Chánh VP: đủ mọi ứng viên');
  });

  test('2. PCVP phụ trách cả Tổng hợp: mọi tổ hợp trả về qua quyền; (Tổng hợp, Tài chính) đang do PCVP2 kiêm nhiệm ⇒ không có trong danh sách và bị chặn', async () => {
    const co = await doiChieu('demo_pcvp');
    const kn = `${KN.phong}|${KN.nganh}|${KN.lv}`;
    assert.ok(!co.has(kn), 'không có tổ hợp người khác kiêm nhiệm');
    assert.ok(co.has(`${KN.phong}||`), 'việc không có ngành–lĩnh vực: quy tắc cả phòng');
    assert.ok(!co.has('null||'), 'PCVP không giao cho Owner không thuộc phòng nào');
    biChan(await thuGiao('demo_pcvp', { phong: null, nganh_ma: null, linh_vuc_ma: null }), 'pcvp giao cho Văn phòng Tỉnh ủy');
    biChan(await thuGiao('demo_pcvp', { phong: KN.phong, nganh_ma: KN.nganh, linh_vuc_ma: KN.lv }), 'pcvp giao lĩnh vực người khác kiêm nhiệm');
    const x = ngoai(co); biChan(await thuGiao('demo_pcvp', x), `pcvp ngoài danh sách ${khoa(x)}`);
  });

  test('3. PCVP2 (Quản trị, E2E_RT + kiêm nhiệm Tổng hợp/Tài chính): tổ hợp kiêm nhiệm có trong danh sách; Tổng hợp lĩnh vực khác và không lĩnh vực ⇒ không', async () => {
    const co = await doiChieu('demo_pcvp2');
    assert.ok(co.has(`${KN.phong}|${KN.nganh}|${KN.lv}`), 'có tổ hợp kiêm nhiệm');
    assert.ok(!co.has(`${KN.phong}||`), 'không giao việc không-lĩnh-vực cho phòng chỉ kiêm nhiệm');
    biChan(await thuGiao('demo_pcvp2', { phong: KN.phong, nganh_ma: KN.nganh, linh_vuc_ma: 'LV08_NGAN_SACH' }), 'pcvp2 lĩnh vực khác ở Tổng hợp');
    const x = ngoai(co); biChan(await thuGiao('demo_pcvp2', x), `pcvp2 ngoài danh sách ${khoa(x)}`);
  });

  test('4. Trưởng phòng Tổng hợp: chỉ phòng mình (giao cho chuyên viên phòng); phòng khác bị chặn', async () => {
    const co = await doiChieu('demo_truongphong', () => IDS.cv1);
    assert.deepEqual([...new Set([...co].map((k) => k.split('|')[0]))], ['TONG_HOP'], 'chỉ phòng Tổng hợp');
    const x = ngoai(co); biChan(await thuGiao('demo_truongphong', x, IDS.cv2), `A2 ngoài danh sách ${khoa(x)}`);
  });

  test('5. Chuyên viên không giữ quan_tri_kl: danh sách rỗng; truyền p_thay_mat cũng rỗng (chỉ quan_tri_kl xem thay mặt)', async () => {
    assert.equal((await phamVi('demo_cv1')).length, 0, 'A3 rỗng');
    assert.equal((await phamVi('demo_cv1', IDS.pcvp)).length, 0, 'A3 xem thay mặt PCVP: rỗng');
  });

  test('6. Người quản trị KL giao thay mặt PCVP (cả Tổng hợp) / Trưởng phòng: mọi tổ hợp trả về qua quyền; Owner không thuộc phòng được khi thay mặt PCVP; ngoài danh sách bị chặn', async () => {
    assertOk(await db().from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.qtht), 'bật quan_tri_kl tạm cho demo_qtht');
    const coPcvp = await doiChieu('demo_qtht', () => undefined, IDS.pcvp);
    assert.ok(coPcvp.has('null||') && !coPcvp.has(`${KN.phong}|${KN.nganh}|${KN.lv}`), 'thay mặt PCVP: có Owner không phòng, không có lĩnh vực người khác kiêm nhiệm');
    const loiTm = await thuGiao('demo_qtht', { phong: KN.phong, nganh_ma: KN.nganh, linh_vuc_ma: KN.lv }, undefined, IDS.pcvp);
    assert.equal(loiTm.error?.code, '22023', `thay mặt PCVP giao lĩnh vực người khác kiêm nhiệm: bị chặn (${loiTm.error?.message})`);
    assert.match(loiTm.error.message, /phải phụ trách phòng của Owner/);
    const coTp = await doiChieu('demo_qtht', () => undefined, IDS.truongphong);
    assert.deepEqual([...new Set([...coTp].map((k) => k.split('|')[0]))], ['TONG_HOP'], 'thay mặt Trưởng phòng Tổng hợp: chỉ phòng Tổng hợp');
    await db().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.qtht);
  });

  test('7. Quyết định 29/9: PCVP KHÔNG giao việc cho lãnh đạo Văn phòng (Chánh VP, PCVP khác) — Owner hay người theo dõi đều bị chặn; phòng lãnh đạo không có trong phạm vi; Chánh VP thì được', async () => {
    const PHONG_LD = (await db().from('accounts').select('department').eq('id', IDS.cvp).single()).data.department;
    assert.ok(!(await phamVi('demo_pcvp')).some((t) => t.phong === PHONG_LD), `phạm vi PCVP không có phòng lãnh đạo ${PHONG_LD}`);
    const th = { phong: KN.phong, nganh_ma: null, linh_vuc_ma: null };   // đơn vị Tổng hợp (PCVP phụ trách) không "mở" được Owner là lãnh đạo
    for (const [ld, ten] of [[IDS.cvp, 'Chánh VP'], [IDS.pcvp2, 'PCVP khác']]) {
      biChan(await thuGiao('demo_pcvp', th, ld), `pcvp giao Owner = ${ten}`);
      const r = await (await userClient('demo_pcvp')).rpc('giao_viec', { p: { van_ban_id: fx.hn, noi_dung: 'KL-PVG thử quyền', han_xu_ly: '2026-12-31',
        owner_don_vi_ma: donViCuaPhong[KN.phong], owner_tai_khoan: IDS.cv1, nguoi_theo_doi: ld } });
      biChan(r, `pcvp đặt người theo dõi = ${ten}`);
    }
    quaQuyen(await thuGiao('demo_cvp', th, IDS.pcvp), 'Chánh VP giao Owner = PCVP');
  });

  test('8. Hạn ủy quyền quan_tri_kl (như me_quan_tri_kl, 0041): hết hạn hôm qua mà cờ chưa thu hồi ⇒ giao_viec chặn, không có trong kl_pham_vi_giao; còn hạn ⇒ được', async () => {
    const ngay = (d) => new Date(Date.now() + 7 * 3600e3 + d * 86400e3).toISOString().slice(0, 10);   // ngày giờ Việt Nam ± d
    const qp = { phong: 'QUAN_TRI', nganh_ma: null, linh_vuc_ma: null };   // phòng khác của Trưởng phòng Tổng hợp: chỉ quyền quan_tri_kl mới giao được
    const dat = async (hetHan) => assertOk(await db().from('accounts').update({ quan_tri_kl: true, quan_tri_kl_het_han: hetHan }).in('id', [IDS.truongphong, IDS.qtht]), `đặt hạn ${hetHan}`);
    try {
      await dat(ngay(-1));
      assert.ok(!(await phamVi('demo_truongphong')).some((t) => t.phong === 'QUAN_TRI'), 'A2 hết hạn: không có phòng Quản trị');
      biChan(await thuGiao('demo_truongphong', qp), 'A2 hết hạn giao cho phòng Quản trị');
      assert.equal((await phamVi('demo_qtht', IDS.pcvp)).length, 0, 'A3 hết hạn: không còn tổ hợp giao thay mặt');
      biChan(await thuGiao('demo_qtht', { phong: KN.phong, nganh_ma: null, linh_vuc_ma: null }, undefined, IDS.pcvp), 'A3 hết hạn giao thay mặt PCVP');
      await dat(ngay(0));   // hạn = hôm nay: còn hiệu lực
      assert.ok((await phamVi('demo_truongphong')).some((t) => t.phong === 'QUAN_TRI'), 'A2 còn hạn: có phòng Quản trị');
      quaQuyen(await thuGiao('demo_truongphong', qp), 'A2 còn hạn giao cho phòng Quản trị');
      assert.ok((await phamVi('demo_qtht', IDS.pcvp)).length > 0, 'A3 còn hạn: có tổ hợp giao thay mặt');
      quaQuyen(await thuGiao('demo_qtht', { phong: KN.phong, nganh_ma: null, linh_vuc_ma: null }, undefined, IDS.pcvp), 'A3 còn hạn giao thay mặt PCVP');
    } finally { await don(); }
  });
});
