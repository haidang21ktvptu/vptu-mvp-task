// RLS-10 (GĐ8, 0016): phạm vi module KL BTVTU theo quyết định 7 — Chánh VP tất cả; A2 phòng mình; PCVP theo
// phu_trach_phong tại ngày hiện tại (đổi phòng giữa chừng có hiệu lực ngay); A3 chỉ việc mình chủ trì; quan_tri_kl
// thấy/sửa toàn bộ; ngoài phạm vi không thấy gì. Ghi: chủ trì chỉ vài cột (trigger guard), chỉ đạo chỉ A1/A2 trong
// phạm vi, lịch sử chỉ trigger ghi, đính chính qua hai hàm. Thứ tự file: chạy sau kl-trang-thai (cùng fixtures).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { userClient, anonClient, adminClient, assertDenied, assertNoRows, assertOk, IDS, datPcvp2E2ERT, songSong } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration 0014–0016 trên project này (chạy lại sau khi merge).';
const LY_DO = 'RLS-TEST KL';
let fx;
before(async () => { if (!SKIP) fx = await setupKlFixtures(); });
// Dọn ngay khi xong từng describe (hook after ở mức module chạy cuối CẢ tiến trình với --test-isolation=none,
// sẽ muộn hơn rls-9 chạy sau file này và làm EXCLUDE chống chồng kỳ chặn phân công của rls-9).
const donPhanCong = async () => { if (!SKIP) await adminClient().from('phu_trach_phong').delete().eq('lanh_dao_id', IDS.pcvp2).eq('phong', 'TONG_HOP'); };
const donCo = async () => { if (!SKIP) await adminClient().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cv2); };

// Kỳ vọng PCVP tính từ phu_trach_phong đang hiệu lực (seed có thể thêm phòng giả E2E_RT — D1 PR-2a): cộng số việc fixture
// RLS-TEST theo từng phòng cả-phòng mà PCVP đang phụ trách. Fixture chỉ đặt việc ở TONG_HOP (6) và QUAN_TRI (1).
const VIEC_FX = { TONG_HOP: 6, QUAN_TRI: 1 };
let homNay;
async function kyVongPcvp(id) {
  homNay ??= (await adminClient().rpc('kl_hom_nay')).data;
  const r = await adminClient().from('phu_trach_phong').select('phong').eq('lanh_dao_id', id).is('nganh_ma', null)
    .lte('tu_ngay', homNay).or(`den_ngay.is.null,den_ngay.gte.${homNay}`);
  assertOk(r, 'đọc phân công');
  return [...new Set(r.data.map((p) => p.phong))].reduce((a, p) => a + (VIEC_FX[p] || 0), 0);
}

async function soThay(username) {
  const c = await userClient(username);
  const r = await c.from('nhiem_vu').select('id').like('noi_dung', 'RLS-TEST%');
  assertOk(r, `${username} select`);
  return r.data.length;
}

describe('RLS-10 phạm vi đọc nhiem_vu (quyết định 7)', { skip: SKIP }, () => {
  after(donPhanCong);
  test('A3 chỉ việc mình chủ trì (cv1: 5, cv2: 1); A3 ngoài phạm vi (qtht) không thấy gì', async () => {
    assert.equal(await soThay('demo_cv1'), 5);
    assert.equal(await soThay('demo_cv2'), 1);
    assert.equal(await soThay('demo_qtht'), 0);
  });
  test('A2 Tổng hợp thấy cả phòng (6), không thấy việc chủ trì phòng khác; Chánh VP thấy tất cả (7)', async () => {
    assert.equal(await soThay('demo_truongphong'), 6);
    assert.equal(await soThay('demo_cvp'), 7);
  });
  test('PCVP theo phân công đang hiệu lực: pcvp (TONG_HOP) 6; pcvp2 (QUAN_TRI + phòng giả) 1', async () => {
    assert.equal(await soThay('demo_pcvp'), await kyVongPcvp(IDS.pcvp));
    assert.equal(await soThay('demo_pcvp2'), await kyVongPcvp(IDS.pcvp2));
    assert.equal(await kyVongPcvp(IDS.pcvp), 6, 'seed: pcvp phụ trách TONG_HOP');
  });
  test('PCVP đổi phòng giữa chừng: phân công pcvp2 ↔ TONG_HOP → thấy ngay thêm 6; kết thúc → về như cũ', async () => {
    await datPcvp2E2ERT();   // giá trị gốc (dọn lần chạy lỗi trước)
    const truoc = await kyVongPcvp(IDS.pcvp2);
    await datPcvp2E2ERT('2026-08-31');   // tạm kết thúc pcvp2 ↔ E2E_RT trước kỳ bật (giới hạn 2 phòng); finally trả giá trị gốc
    try {
      const qtht = await userClient('demo_qtht');
      assertOk(await qtht.rpc('admin_phan_cong_phong', { p_username: 'demo_pcvp2', p_phong: 'TONG_HOP', p_bat: true, p_ly_do: LY_DO, p_tu_ngay: '2026-09-01' }), 'bật');
      assert.equal(await soThay('demo_pcvp2'), await kyVongPcvp(IDS.pcvp2));
      assert.equal(await soThay('demo_pcvp2'), truoc + VIEC_FX.TONG_HOP, 'thấy ngay việc Tổng hợp');
      assertOk(await qtht.rpc('admin_phan_cong_phong', { p_username: 'demo_pcvp2', p_phong: 'TONG_HOP', p_bat: false, p_ly_do: LY_DO }), 'tắt');
      assert.equal(await soThay('demo_pcvp2'), truoc);
    } finally { await datPcvp2E2ERT(); }
  });
  test('Hội nghị: thấy khi có nhiệm vụ trong phạm vi; danh mục và cấu hình ai cũng đọc; v_nhiem_vu lọc theo RLS', async () => {
    const cv1 = await userClient('demo_cv1');
    const hn = await cv1.from('van_ban_giao_viec').select('id').eq('id', fx.hn);
    assertOk(hn, 'cv1 hội nghị'); assert.equal(hn.data.length, 1);
    const qtht = await userClient('demo_qtht');
    const hn0 = await qtht.from('van_ban_giao_viec').select('id').eq('id', fx.hn);
    assertOk(hn0, 'qtht hội nghị'); assert.equal(hn0.data.length, 0);
    const dm = await qtht.from('dm_nganh').select('ma');
    assertOk(dm, 'danh mục'); assert.equal(dm.data.length, 12);
    const ch = await qtht.from('kl_cau_hinh').select('khoa, gia_tri').eq('khoa', 'nguong_sap_den_han_ngay').single();
    assertOk(ch, 'cấu hình'); assert.equal(ch.data.gia_tri, '7');
    const v = await cv1.from('v_nhiem_vu').select('ma, trang_thai, nhom_dem, nguoi_theo_doi_ten').like('noi_dung', 'RLS-TEST%');
    assertOk(v, 'dashboard'); assert.equal(v.data.length, 5);
    assert.equal(v.data.find((r) => r.ma === 'NV-T05').trang_thai, 'CHO_DIEU_KIEN');
  });
  test('bị chặn: anon mọi bảng KL và view', async () => {
    const T = ['nhiem_vu', 'van_ban_giao_viec', 'lich_su', 'chi_dao', 'dinh_chinh', 'kl_cau_hinh', 'dm_nganh', 'v_nhiem_vu'];
    (await songSong(T.map((t) => () => anonClient().from(t).select('*').limit(1)))).forEach((r, i) => assertDenied(r, `anon ${T[i]}`));
  });
});

describe('RLS-10 ghi: chủ trì, quan_tri_kl, chỉ đạo, lịch sử, đính chính', { skip: SKIP }, () => {
  after(donCo);
  test('chủ trì sửa tiến độ/minh chứng việc mình được; sửa nội dung/chủ trì bị chặn (guard); việc người khác 0 dòng', async () => {
    const cv1 = await userClient('demo_cv1');
    const ok = await cv1.from('nhiem_vu').update({ minh_chung: 'RLS-TEST minh chứng', van_ban_trien_khai: 'KH 01' }).eq('id', fx.n1).select('id');
    assertOk(ok, 'sửa minh chứng'); assert.equal(ok.data.length, 1);
    const [a, b, c, d] = await Promise.all([cv1.from('nhiem_vu').update({ noi_dung: 'đổi' }).eq('id', fx.n1).select('id'),
      cv1.from('nhiem_vu').update({ nguoi_theo_doi: IDS.cv2 }).eq('id', fx.n1).select('id'), cv1.from('nhiem_vu').update({ minh_chung: 'x' }).eq('id', fx.n4).select('id'),
      cv1.from('nhiem_vu').delete().eq('id', fx.n1).select('id')]);   // bốn ca bị chặn độc lập — một lượt (D3)
    assertDenied(a, 'đổi nội dung'); assertDenied(b, 'đổi chủ trì'); assertNoRows(c, 'việc người khác'); assertDenied(d, 'xoá');
  });
  test('bị chặn: A3/A2/Chánh VP không có quan_tri_kl thêm nhiệm vụ, hội nghị; sửa cấu hình', async () => {
    // PR-3: dòng hợp lệ về nghiệp vụ (có nguồn — trigger BEFORE chạy trước WITH CHECK) ⇒ chỉ còn RLS chặn.
    const row = { van_ban_id: fx.hn, nguoi_theo_doi: IDS.cv1, noi_dung: 'RLS-TEST mới', loai_thoi_han_ma: 'CHO_QUYET_DINH', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH' };
    const U = ['demo_cv1', 'demo_truongphong', 'demo_cvp'];
    const kq = await songSong(U.flatMap((u) => [async () => (await userClient(u)).from('nhiem_vu').insert(row).select('id'),
      async () => (await userClient(u)).from('van_ban_giao_viec').insert({ so_hoi_nghi: 998, so_ket_luan: 'RLS-TEST', ngay_ban_hanh: '2026-08-01' }).select('id'),
      async () => (await userClient(u)).from('kl_cau_hinh').update({ gia_tri: '9' }).eq('khoa', 'nguong_sap_den_han_ngay').select('khoa')]));
    U.forEach((u, i) => {
      assertDenied(kq[3 * i], `${u} insert nhiệm vụ`); assertDenied(kq[3 * i + 1], `${u} insert hội nghị`); assertNoRows(kq[3 * i + 2], `${u} sửa cấu hình`);
    });
  });
  test('quan_tri_kl (cờ cũ đặt tạm cho cv2): thấy tất cả, thêm hội nghị + nhiệm vụ, sửa mọi cột; thu cờ → còn việc mình theo dõi + việc mình nhập (0096)', async () => {
    const qtht = await userClient('demo_qtht');
    assertOk(await adminClient().from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.cv2), 'cờ cũ tạm (service_role — 0096 không cấp qua admin_dat_co)');
    try { // thất bại giữa chừng vẫn thu cờ (nếu không, các test sau thấy cv2 còn quan_tri_kl → vỡ dây chuyền)
    const cv2 = await userClient('demo_cv2');
    assert.equal(await soThay('demo_cv2'), 7);
    const hn = await cv2.from('van_ban_giao_viec').insert({ so_hoi_nghi: 998, so_ket_luan: 'RLS-TEST', ngay_ban_hanh: '2026-08-01' }).select('id').single();
    assertOk(hn, 'quan_tri_kl thêm hội nghị');
    const nv = await cv2.from('nhiem_vu').insert({ van_ban_id: hn.data.id, nguoi_theo_doi: IDS.cv1, noi_dung: 'RLS-TEST N8 mới', loai_thoi_han_ma: 'CHO_QUYET_DINH', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH' }).select('id, ma, tao_boi').single();
    assertOk(nv, 'quan_tri_kl thêm nhiệm vụ'); assert.match(nv.data.ma, /^NV-\d{3,}$/); assert.equal(nv.data.tao_boi, IDS.cv2); // 0027: sequence > 999 không cắt số (staging đã qua NV-1000)
    assertOk(await cv2.from('nhiem_vu').update({ noi_dung: 'RLS-TEST N8 đã sửa', nganh_ma: 'NOI_CHINH' }).eq('id', nv.data.id).select('id'), 'sửa mọi cột');
    } finally {
      assertOk(await qtht.rpc('admin_dat_co', { p_username: 'demo_cv2', p_co: 'quan_tri_kl', p_bat: false, p_ly_do: LY_DO }), 'thu (0096 vẫn thu được)');
    }
    assert.equal(await soThay('demo_cv2'), 2, 'N4 (theo dõi) + N8 (mình nhập — 0096)');
  });
  test('chỉ đạo: A2 phòng mình thêm được; A3 chủ trì và PCVP ngoài phạm vi bị chặn; đọc theo phạm vi; sửa/xoá trực tiếp bị chặn', async () => {
    const tp = await userClient('demo_truongphong');
    // 0026: chỉ đạo chỉ qua hàm chi_dao_gui (INSERT trực tiếp bị thu quyền); quyền vẫn = kl_duoc_chi_dao.
    assertOk(await tp.rpc('chi_dao_gui', { p: { nhiem_vu_id: fx.n1, loai: 'YEU_CAU_MINH_CHUNG', noi_dung: 'RLS-TEST D2' } }), 'A2 chỉ đạo');
    assertDenied(await tp.from('chi_dao').insert({ nhiem_vu_id: fx.n1, nguoi_gui: IDS.truongphong, loai: 'DON_DOC', noi_dung: 'trực tiếp' }).select('id'), 'INSERT trực tiếp');
    const cv1 = await userClient('demo_cv1');
    assertDenied(await cv1.rpc('chi_dao_gui', { p: { nhiem_vu_id: fx.n1, loai: 'DON_DOC', noi_dung: 'x' } }), 'A3 chỉ đạo');
    const pcvp2 = await userClient('demo_pcvp2');
    assertDenied(await pcvp2.rpc('chi_dao_gui', { p: { nhiem_vu_id: fx.n1, loai: 'DON_DOC', noi_dung: 'x' } }), 'PCVP ngoài phạm vi');
    const r = await cv1.from('chi_dao').select('id').eq('nhiem_vu_id', fx.n1);
    assertOk(r, 'chủ trì đọc chỉ đạo'); assert.equal(r.data.length, 2);
    const r2 = await pcvp2.from('chi_dao').select('id').eq('nhiem_vu_id', fx.n1);
    assertOk(r2, 'ngoài phạm vi đọc'); assert.equal(r2.data.length, 0);
    assertDenied(await tp.from('chi_dao').update({ trang_thai: 'DA_DONG' }).eq('id', fx.d1).select('id'), 'update trực tiếp');
    assertDenied(await tp.from('chi_dao').delete().eq('id', fx.d1).select('id'), 'delete');
  });
  test('lịch sử: chủ trì/A2 đọc được dòng của việc trong phạm vi; ngoài phạm vi 0 dòng; ghi trực tiếp bị chặn', async () => {
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.from('lich_su').select('cot').eq('nhiem_vu_id', fx.n1);
    assertOk(r, 'cv1 lịch sử'); assert.ok(r.data.length >= 2 && r.data.some((l) => l.cot === 'minh_chung'));
    const cv2 = await userClient('demo_cv2');
    const r0 = await cv2.from('lich_su').select('cot').eq('nhiem_vu_id', fx.n1);
    assertOk(r0, 'cv2 lịch sử'); assert.equal(r0.data.length, 0);
    assertDenied(await cv1.from('lich_su').insert({ nhiem_vu_id: fx.n1, cot: 'x', gia_tri_moi: 'giả' }).select('id'), 'insert lịch sử');
    assertDenied(await cv1.from('lich_su').delete().eq('nhiem_vu_id', fx.n1).select('id'), 'delete lịch sử');
  });
  test('đính chính: chủ trì đề nghị → nhom_dem DANG_DINH_CHINH; người đề nghị tự duyệt bị chặn; quan_tri_kl duyệt → cột đổi, lịch sử nguon dinh_chinh', async () => {
    const cv1 = await userClient('demo_cv1');
    assertDenied(await cv1.from('dinh_chinh').insert({ nhiem_vu_id: fx.n1, de_nghi_boi: IDS.cv1, cot: 'han_xu_ly', gia_tri_moi: '2026-10-30', ly_do: 'x' }).select('id'), 'insert trực tiếp');
    const dn = await cv1.rpc('kl_de_nghi_dinh_chinh', { p_nhiem_vu: fx.n1, p_cot: 'han_xu_ly', p_gia_tri_moi: '2026-10-30', p_ly_do: 'RLS-TEST nhập sai hạn', p_can_cu: 'CV 99' });
    assertOk(dn, 'đề nghị'); assert.ok(dn.data);
    const cv2 = await userClient('demo_cv2');
    assertDenied(await cv2.rpc('kl_de_nghi_dinh_chinh', { p_nhiem_vu: fx.n1, p_cot: 'han_xu_ly', p_gia_tri_moi: '2026-10-30', p_ly_do: 'x' }), 'người ngoài đề nghị');
    const tt = await cv1.rpc('tinh_trang_thai', { p_id: fx.n1, p_ngay: '2026-09-14' });
    assertOk(tt, 'trạng thái'); assert.equal(tt.data.trang_thai, 'QUA_HAN'); assert.equal(tt.data.dang_dinh_chinh, true); assert.equal(tt.data.nhom_dem, 'DANG_DINH_CHINH');
    assertDenied(await cv1.rpc('kl_duyet_dinh_chinh', { p_id: dn.data, p_chap_nhan: true }), 'chủ trì tự duyệt');

    const qtht = await userClient('demo_qtht');
    assertOk(await adminClient().from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.cv2), 'cờ cũ tạm (service_role — 0096 không cấp qua admin_dat_co)');
    try {
    assert.ok((await cv2.rpc('kl_duyet_dinh_chinh', { p_id: dn.data, p_chap_nhan: false, p_ly_do: '' })).error, 'bác bỏ thiếu lý do');
    assertOk(await cv2.rpc('kl_duyet_dinh_chinh', { p_id: dn.data, p_chap_nhan: true }), 'quan_tri_kl duyệt');
    const { data: nv } = await adminClient().from('nhiem_vu').select('han_xu_ly').eq('id', fx.n1).single();
    assert.equal(nv.han_xu_ly, '2026-10-30');
    const { data: ls } = await adminClient().from('lich_su').select('cot, gia_tri_moi, nguon, dinh_chinh_id').eq('nhiem_vu_id', fx.n1).eq('nguon', 'dinh_chinh');
    assert.deepEqual(ls, [{ cot: 'han_xu_ly', gia_tri_moi: '2026-10-30', nguon: 'dinh_chinh', dinh_chinh_id: dn.data }]);
    const sau = await cv1.rpc('tinh_trang_thai', { p_id: fx.n1, p_ngay: '2026-09-14' });
    assert.equal(sau.data.trang_thai, 'DANG_THUC_HIEN'); assert.equal(sau.data.dang_dinh_chinh, false);
    assert.ok((await cv2.rpc('kl_duyet_dinh_chinh', { p_id: dn.data, p_chap_nhan: true })).error, 'duyệt lại đề nghị đã xử lý');
    } finally {
      assertOk(await qtht.rpc('admin_dat_co', { p_username: 'demo_cv2', p_co: 'quan_tri_kl', p_bat: false, p_ly_do: LY_DO }), 'thu (0096 vẫn thu được)');
    }
  });
});
