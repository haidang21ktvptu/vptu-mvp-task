// Đợt D v3.20 (0089–0093, định hướng 8/10/2026 — lãnh đạo theo dõi, chuyên viên nhập liệu): kho tệp riêng tư "minh-chung" (tải lên = ai được nộp
// minh chứng, đọc = ai thấy việc, xoá = người tải khi tệp chưa gắn; đường dẫn <id việc>/<tên>); nộp kèm tệp = hoàn thành; tệp dùng lại / sai việc
// bị chặn; cấu hình "Minh chứng phải kèm tệp"; gắn tệp sau; danh mục sản phẩm mở rộng; chuyên viên người giao đôn đốc / gia hạn / giao lại (0092);
// chuyển việc đang theo dõi (J-6, 0092); nhập Excel ba ô nguồn, hoàn tác lô "Hoàn thành" (0093); thư ký Thường trực mở tệp việc Thường trực giao Chánh
// VP; người nhập việc thay mặt giữ quyền người tạo (0096 — mọi chuyên viên). Khoá "KL-0089"; tài khoản tạm kl0089_td (mật khẩu ngẫu nhiên); tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { adminClient, anonClient, userClient, assertOk, assertDenied, IDS, EMAIL_DOMAIN, homNayVN } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const KHOA = 'KL-0089';
const BUCKET = 'minh-chung';
const TD = 'kl0089_td';
const E2E_KL = '00000000-0000-4000-8000-000000000010';   // demo_e2e_kl, A3 Tổng hợp
const db = () => adminClient();
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.'
  : (await db().storage.getBucket(BUCKET)).error ? 'Chưa có kho tệp minh-chung (migration 0089) trên project này.' : false;
const PDF = Buffer.from('%PDF-1.4\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF\n');
const pdf = () => new Blob([PDF], { type: 'application/pdf' });
const kho = (c) => c.storage.from(BUCKET);
const goi = async (u, ham, thamSo) => (await userClient(u)).rpc(ham, thamSo);
const loi = (r, re, label) => assert.match(r.error?.message || '', re, `${label}: ${r.error?.message || 'không có lỗi'}`);
const viec = async (id) => (await db().from('nhiem_vu').select('*').eq('id', id).single()).data;
const tonTai = async (path) => {
  const [thuMuc, ten] = path.split('/');
  return ((await kho(db()).list(thuMuc, { search: ten })).data || []).some((f) => f.name === ten);
};
const nv = {}; let vb; let vbTt = null; let tdId = null;
const TK = '00000000-0000-4000-8000-000000000018';   // demo_e2e_tk — cờ thư ký tạm
const nop = (u, ma, p = {}) => goi(u, 'nop_minh_chung', { p: { nhiem_vu_id: nv[ma], so_hieu: `${KHOA}/${ma}`, ngay_van_ban: homNayVN(), cap_nhan: 'TRUONG_PHONG', ...p } });

const don = async () => {
  for (const id of Object.values(nv)) {
    const { data } = await kho(db()).list(id);
    if (data?.length) await kho(db()).remove(data.map((f) => `${id}/${f.name}`));
  }
  const lo = (await db().from('lo_nhap').select('id').like('ten_tep', `${KHOA}%`)).data || [];
  const cua = (await db().from('nhiem_vu').select('id').like('noi_dung', `${KHOA}%`)).data || [];
  if (cua.length) await db().from('direct_messages').delete().in('nhiem_vu_id', cua.map((x) => x.id));
  if (lo.length) await db().from('lo_nhap').delete().in('id', lo.map((l) => l.id));
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
  if (vbTt) await db().from('van_ban_giao_viec').delete().eq('id', vbTt);
  await db().from('accounts').update({ thu_ky_thuong_truc: false }).eq('id', TK);
  await db().from('accounts').update({ quan_tri_kl: false, quan_tri_kl_het_han: null }).eq('id', IDS.cv2);
  await db().from('kl_cau_hinh').update({ gia_tri: '1' }).eq('khoa', 'minh_chung_bat_buoc_tep');
  const cu = (await db().from('accounts').select('id').eq('username', TD)).data || [];
  for (const a of cu) { await db().from('accounts').delete().eq('id', a.id); await db().auth.admin.deleteUser(a.id); }
};
const giaoTp = async (ma, p = {}) => {
  const r = await goi('demo_truongphong', 'giao_viec', { p: { ...(vb ? { van_ban_id: vb } : { van_ban: { loai: 'CONG_VAN', so_ket_luan: `${KHOA} #1`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02' } }),
    noi_dung: `${KHOA} ${ma}`, san_pham_loai: 'BAO_CAO', han_xu_ly: '2026-12-31', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, ...p } });
  assertOk(r, `Trưởng phòng giao ${ma}`); nv[ma] = r.data.id; vb = vb || r.data.van_ban_id;
};

describe('Đợt D (0089–0093) — tệp minh chứng, chuyên viên người giao, chuyển việc theo dõi, nhập Excel ba ô nguồn', { skip: SKIP }, () => {
  before(async () => {
    await don();
    for (const ma of ['A', 'B', 'C']) await giaoTp(ma);   // tuần tự: việc đầu tạo văn bản
  });
  after(don);

  test('1. Kho tệp: Owner tải <việc>/tệp.pdf được; người không liên quan, anon, đường dẫn sai mẫu, kiểu tệp lạ bị chặn; ai thấy việc tải về được', async () => {
    const cv1 = await userClient('demo_cv1');
    assertOk(await kho(cv1).upload(`${nv.A}/kl0089-a.pdf`, pdf(), { contentType: 'application/pdf' }), 'Owner tải lên');
    assert.ok(await tonTai(`${nv.A}/kl0089-a.pdf`));
    const [ngoai, an, khongThuMuc, baCap, kieuLa] = await Promise.all([
      kho(await userClient('demo_cv2')).upload(`${nv.A}/kl0089-cv2.pdf`, pdf(), { contentType: 'application/pdf' }),
      kho(anonClient()).upload(`${nv.A}/kl0089-anon.pdf`, pdf(), { contentType: 'application/pdf' }),
      kho(cv1).upload(`kl0089-goc-${nv.A}.pdf`, pdf(), { contentType: 'application/pdf' }),
      kho(cv1).upload(`${nv.A}/x/kl0089.pdf`, pdf(), { contentType: 'application/pdf' }),
      kho(cv1).upload(`${nv.A}/kl0089.txt`, new Blob(['x'], { type: 'text/plain' }), { contentType: 'text/plain' })]);
    [[ngoai, 'cv2 không liên quan'], [an, 'anon'], [khongThuMuc, 'không có thư mục việc'], [baCap, 'đường dẫn 3 cấp'], [kieuLa, 'tệp .txt']]
      .forEach(([r, nhan]) => assert.ok(r.error, `${nhan}: phải bị chặn`));
    assert.equal(await tonTai(`${nv.A}/kl0089-cv2.pdf`), false);
    const tp = await kho(await userClient('demo_truongphong')).download(`${nv.A}/kl0089-a.pdf`);
    assert.equal(tp.error, null, `Trưởng phòng (thấy việc) tải về: ${tp.error?.message}`);
    assert.ok((await kho(await userClient('demo_cv2')).download(`${nv.A}/kl0089-a.pdf`)).error, 'cv2 không thấy việc: không tải về');
  });

  test('2. Nộp kèm tệp = hoàn thành (hop_le, tep_path, tep_ten); tệp đã gắn / thư mục việc khác / chưa tải lên bị chặn; tệp đã gắn không xoá được, tệp rác xoá được', async () => {
    const r = await nop('demo_cv1', 'A', { tep_path: `${nv.A}/kl0089-a.pdf`, tep_ten: 'Báo cáo A.pdf' });
    assertOk(r, 'nộp kèm tệp');
    const mc = (await db().from('minh_chung').select('hop_le, xac_nhan_boi, tep_path, tep_ten').eq('id', r.data).single()).data;
    assert.deepEqual(mc, { hop_le: true, xac_nhan_boi: null, tep_path: `${nv.A}/kl0089-a.pdf`, tep_ten: 'Báo cáo A.pdf' });
    assert.equal((await viec(nv.A)).tien_do_ma, 'HOAN_THANH');
    const ls = (await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', nv.A).eq('cot', 'minh_chung_nop')).data;
    assert.match(ls[0].gia_tri_moi, / · kèm tệp — nhiệm vụ hoàn thành$/);
    loi(await nop('demo_cv1', 'B', { tep_path: `${nv.A}/kl0089-a.pdf` }), /đúng nhiệm vụ/, 'tệp thư mục việc khác');
    loi(await nop('demo_cv1', 'B', { tep_path: `${nv.B}/khong-co.pdf` }), /chưa được tải lên/, 'tệp chưa tải lên');
    const cv1 = await userClient('demo_cv1');
    assertOk(await kho(cv1).upload(`${nv.B}/kl0089-b.pdf`, pdf(), { contentType: 'application/pdf' }), 'tải tệp B');
    assertOk(await nop('demo_cv1', 'B', { tep_path: `${nv.B}/kl0089-b.pdf` }), 'nộp B');
    loi(await nop('demo_cv1', 'B', { so_hieu: `${KHOA}/B2`, tep_path: `${nv.B}/kl0089-b.pdf` }), /đã gắn với một minh chứng khác/, 'tệp dùng lại');
    await kho(cv1).remove([`${nv.A}/kl0089-a.pdf`]);
    assert.ok(await tonTai(`${nv.A}/kl0089-a.pdf`), 'tệp đã gắn vào minh chứng không bị xoá');
    assertOk(await kho(cv1).upload(`${nv.C}/kl0089-rac.pdf`, pdf(), { contentType: 'application/pdf' }), 'tải tệp rác');
    await kho(cv1).remove([`${nv.C}/kl0089-rac.pdf`]);
    assert.equal(await tonTai(`${nv.C}/kl0089-rac.pdf`), false, 'người tải xoá được tệp chưa gắn');
  });

  test('3. Cấu hình minh_chung_bat_buoc_tep = 2 ⇒ nộp không tệp bị chặn; = 1 ⇒ được; gắn tệp sau cho minh chứng chưa có tệp (người nộp), người ngoài bị chặn, gắn lần hai bị chặn', async () => {
    assertOk(await db().from('kl_cau_hinh').update({ gia_tri: '2' }).eq('khoa', 'minh_chung_bat_buoc_tep'), 'đặt cấu hình 2');
    try { loi(await nop('demo_cv1', 'C'), /phải kèm tệp/, 'cấu hình 2 không tệp'); } finally {
      await db().from('kl_cau_hinh').update({ gia_tri: '1' }).eq('khoa', 'minh_chung_bat_buoc_tep');
    }
    const r = await nop('demo_cv1', 'C'); assertOk(r, 'cấu hình 1: nộp không tệp');
    const cv1 = await userClient('demo_cv1');
    assertOk(await kho(cv1).upload(`${nv.C}/kl0089-c.pdf`, pdf(), { contentType: 'application/pdf' }), 'tải tệp C');
    assertDenied(await goi('demo_cv2', 'gan_tep_minh_chung', { p_id: r.data, p_tep_path: `${nv.C}/kl0089-c.pdf`, p_tep_ten: 'x.pdf' }), 'người ngoài gắn tệp');
    assertOk(await goi('demo_cv1', 'gan_tep_minh_chung', { p_id: r.data, p_tep_path: `${nv.C}/kl0089-c.pdf`, p_tep_ten: 'Kết quả C.pdf' }), 'người nộp gắn tệp');
    assert.deepEqual((await db().from('minh_chung').select('tep_path, tep_ten').eq('id', r.data).single()).data, { tep_path: `${nv.C}/kl0089-c.pdf`, tep_ten: 'Kết quả C.pdf' });
    assert.equal((await db().from('lich_su').select('id').eq('nhiem_vu_id', nv.C).eq('cot', 'tep_minh_chung')).data.length, 1, 'lịch sử gắn tệp');
    assertOk(await kho(cv1).upload(`${nv.C}/kl0089-c2.pdf`, pdf(), { contentType: 'application/pdf' }), 'tải tệp C2');
    loi(await goi('demo_cv1', 'gan_tep_minh_chung', { p_id: r.data, p_tep_path: `${nv.C}/kl0089-c2.pdf` }), /đã có tệp/, 'gắn lần hai');
  });

  test('4. Danh mục sản phẩm: thêm Đề án, Chương trình, Thông báo, Hướng dẫn, Quy chế / Quy định; "Khác" xuống cuối', async () => {
    const dm = (await db().from('dm_san_pham').select('ma, ten').order('thu_tu')).data;
    for (const ma of ['DE_AN', 'CHUONG_TRINH', 'THONG_BAO', 'HUONG_DAN', 'QUY_CHE']) assert.ok(dm.some((x) => x.ma === ma), ma);
    assert.equal(dm.find((x) => x.ma === 'QUY_CHE').ten, 'Quy chế / Quy định');
    assert.equal(dm.at(-1).ma, 'KHAC');
  });

  test('5. (0092) Chuyên viên là người giao: đôn đốc, gia hạn việc mình giao; giao lại chỉ cho chuyên viên; chuyên viên không phải người giao bị chặn', async () => {
    const r = await goi('demo_cv1', 'giao_viec', { p: { van_ban: { loai: 'CONG_VAN', so_ket_luan: `${KHOA} #cv1`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02' },
      noi_dung: `${KHOA} D cv1 giao`, san_pham_loai: 'BAO_CAO', han_xu_ly: '2026-12-31', owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2 } });
    assertOk(r, 'cv1 giao thẳng cho cv2'); nv.D = r.data.id;
    const gui = (u, p) => goi(u, 'chi_dao_gui', { p: { nhiem_vu_id: nv.D, ...p } });
    assertOk(await gui('demo_cv1', { loai: 'DON_DOC', noi_dung: `${KHOA} đôn đốc` }), 'người giao (chuyên viên) đôn đốc');
    assertOk(await gui('demo_cv1', { loai: 'GIA_HAN', noi_dung: `${KHOA} gia hạn`, han_moi: '2027-01-15' }), 'người giao gia hạn');
    assert.equal((await viec(nv.D)).han_xu_ly, '2027-01-15');
    assertDenied(await gui('demo_cv2', { loai: 'DON_DOC', noi_dung: 'x' }), 'Owner (không phải người giao) đôn đốc');
    loi(await gui('demo_cv1', { loai: 'GIAO_LAI', noi_dung: 'x', chu_tri_moi: IDS.truongphong }), /chuyên viên khác/, 'giao lại cho lãnh đạo');
    assertOk(await gui('demo_cv1', { loai: 'GIAO_LAI', noi_dung: `${KHOA} chuyển người`, chu_tri_moi: E2E_KL }), 'giao lại cho chuyên viên');
    assert.equal((await viec(nv.D)).owner_tai_khoan, E2E_KL);
  });

  test('6. (J-6) Chuyển việc đang theo dõi: chỉ QTHT / Chánh VP; xem trước không ghi; lý do bắt buộc; chỉ việc đang mở; lịch sử từng việc + một tin', async () => {
    const u = await db().auth.admin.createUser({ email: `${TD}@${EMAIL_DOMAIN}`, password: `T${randomUUID()}`, email_confirm: true, user_metadata: { username: TD, full_name: 'KL-0089 Theo dõi tạm' } });
    assert.equal(u.error, null, `tạo tài khoản tạm: ${u.error?.message}`); tdId = u.data.user.id;
    assertOk(await db().from('accounts').upsert({ id: tdId, username: TD, full_name: 'KL-0089 Theo dõi tạm', role_group: 'A3', position_title: 'Chuyên viên (test)',
      department: 'TONG_HOP', is_chief: false, must_change_password: false, is_system: false, quan_tri_he_thong: false }, { onConflict: 'id' }), 'hồ sơ tạm');
    const chen = (ma, row) => db().from('nhiem_vu').insert({ van_ban_id: vb, noi_dung: `${KHOA} ${ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
      nganh_ma: 'KINH_TE_TONG_HOP', owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: tdId, theo_1400: false, ...row }).select('id').single();
    const [mo, xong] = await Promise.all([chen('E mở', {}), chen('E xong', { tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2026-09-10', minh_chung: `${KHOA}/MC` })]);
    assertOk(mo, 'việc mở'); assertOk(xong, 'việc đã hoàn thành'); nv.E = mo.data.id; nv.F = xong.data.id;
    const goiCtd = (user, lyDo, thucHien) => goi(user, 'admin_chuyen_theo_doi', { p_tu: tdId, p_den: IDS.cv2, p_ly_do: lyDo, p_thuc_hien: thucHien });
    assertDenied(await goiCtd('demo_cv1', 'x', true), 'chuyên viên');
    assertDenied(await goiCtd('demo_truongphong', 'x', true), 'Trưởng phòng');
    const xem = await goiCtd('demo_cvp', null, false); assertOk(xem, 'Chánh VP xem trước');
    assert.equal(xem.data.so_viec, 1); assert.equal((await viec(nv.E)).nguoi_theo_doi, tdId, 'xem trước không ghi');
    loi(await goiCtd('demo_qtht', '  ', true), /Lý do bắt buộc/, 'thiếu lý do');
    const lam = await goiCtd('demo_qtht', `${KHOA} điều động cán bộ`, true); assertOk(lam, 'QTHT chuyển');
    assert.equal(lam.data.so_viec, 1);
    assert.deepEqual([(await viec(nv.E)).nguoi_theo_doi, (await viec(nv.F)).nguoi_theo_doi], [IDS.cv2, tdId], 'việc mở chuyển, việc đã hoàn thành giữ nguyên');
    const ls = (await db().from('lich_su').select('nguoi_sua, gia_tri_moi').eq('nhiem_vu_id', nv.E).eq('cot', 'chuyen_theo_doi')).data;
    assert.equal(ls.length, 1); assert.equal(ls[0].nguoi_sua, IDS.qtht); assert.match(ls[0].gia_tri_moi, /lý do: KL-0089 điều động cán bộ$/);
    const tin = (await db().from('direct_messages').select('content').eq('receiver_id', IDS.cv2).like('content', `%${KHOA} điều động cán bộ`)).data;
    assert.equal(tin.length, 1, 'một tin cho người nhận');
    await db().from('direct_messages').delete().like('content', `%${KHOA} điều động cán bộ`);
  });

  test('7. (0093) Nhập Excel nhận ba ô nguồn: Mức quan trọng, Cơ quan trình, Thường trực chỉ đạo', async () => {
    const tao = await goi('demo_qtht', 'nhap_excel_lo_tao', { p: { ten_tep: `${KHOA}-nguon.xlsx`, mau: 'CHUAN', che_do_xong: 'CHO_NGHIEM_THU', so_dong: 1 } });
    assertOk(tao, 'mở lô');
    const r = await goi('demo_qtht', 'nhap_excel_dong', { p_lo: tao.data.id, p_dong: [{ so_dong: 2, loai_van_ban: 'CONG_VAN', so_ket_luan: `${KHOA}/EX`, ngay_ban_hanh: '2026-09-01',
      noi_dung: `${KHOA} nhập ba ô nguồn`, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, thay_mat_cho: IDS.truongphong,
      loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31', san_pham_loai: 'DE_AN', cap_nhan_san_pham: 'TRUONG_PHONG', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH',
      nganh_ma: 'THAM_MUU_TONG_HOP', linh_vuc_ma: 'LV01_THAM_MUU_TONG_HOP', muc_quan_trong: 'A', co_quan_trinh: 'DANG_UY_UBND', thuong_truc_chi_dao: IDS.a0, du_lieu_goc: {} }] });
    assertOk(r, 'nhập dòng');
    assert.equal(r.data[0].ket_qua, 'GIAO', r.data[0].ghi_chu);
    const v = await viec(r.data[0].nhiem_vu_id);
    assert.deepEqual([v.muc_quan_trong, v.co_quan_trinh, v.thuong_truc_chi_dao, v.san_pham_loai], ['A', 'DANG_UY_UBND', IDS.a0, 'DE_AN']);
    // Lô cập nhật việc có sẵn "Hoàn thành" kèm kết quả (CHO_NGHIEM_THU): minh chứng hợp lệ ngay, việc hoàn thành; hoàn tác lô ⇒ xoá minh chứng, mở lại.
    {   // 0096: người nhập (demo_qtht, chuyên viên) cập nhật lại việc mình nhập — không cần cờ
      const lo2 = await goi('demo_qtht', 'nhap_excel_lo_tao', { p: { ten_tep: `${KHOA}-xong.xlsx`, mau: 'CHUAN', che_do_xong: 'CHO_NGHIEM_THU', so_dong: 1 } });
      assertOk(lo2, 'mở lô cập nhật');
      const r2 = await goi('demo_qtht', 'nhap_excel_dong', { p_lo: lo2.data.id, p_dong: [{ so_dong: 2, ma: r.data[0].ma, cap_nhat: true, tien_do_ma: 'HOAN_THANH',
        kq_so_hieu: `${KHOA}/KQ`, kq_ngay: homNayVN(), kq_trich_yeu: 'Báo cáo kết quả', kq_mo_ta: 'Đã gửi Trưởng phòng', du_lieu_goc: {} }] });
      assertOk(r2, 'nhập dòng cập nhật'); assert.equal(r2.data[0].ket_qua, 'CAP_NHAT', r2.data[0].ghi_chu);
      assert.equal((await viec(v.id)).tien_do_ma, 'HOAN_THANH', 'lô ghi minh chứng ⇒ hoàn thành');
      assertOk(await goi('demo_qtht', 'hoan_tac_lo', { p_lo: lo2.data.id }), 'hoàn tác lô cập nhật');
      assert.equal((await viec(v.id)).tien_do_ma, v.tien_do_ma, 'mở lại về tiến độ trước khi nhập');
      assert.equal((await db().from('minh_chung').select('id').eq('nhiem_vu_id', v.id)).data.length, 0, 'minh chứng lô ghi đã xoá');
    }
  });

  test('8. Thư ký Thường trực tải được tệp minh chứng của việc Thường trực giao Chánh VP (cùng phạm vi bảng minh_chung)', async () => {
    const r = await goi('demo_a0', 'giao_viec', { p: { noi_dung: `${KHOA} G Thường trực giao`, san_pham_loai: 'BAO_CAO', han_xu_ly: '2026-12-31',
      owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.cvp } });
    assertOk(r, 'Thường trực giao Chánh VP'); nv.G = r.data.id; vbTt = r.data.van_ban_id;
    assertOk(await kho(await userClient('demo_cvp')).upload(`${nv.G}/kl0089-g.pdf`, pdf(), { contentType: 'application/pdf' }), 'Chánh VP tải tệp');
    assertOk(await nop('demo_cvp', 'G', { cap_nhan: 'THUONG_TRUC', tep_path: `${nv.G}/kl0089-g.pdf` }), 'Chánh VP nộp kèm tệp');
    const tk = await userClient('demo_e2e_tk');
    assert.ok((await kho(tk).download(`${nv.G}/kl0089-g.pdf`)).error, 'chưa có cờ thư ký: không tải');
    assertOk(await db().from('accounts').update({ thu_ky_thuong_truc: true }).eq('id', TK), 'cấp cờ thư ký tạm');
    try {
      const t = await kho(tk).download(`${nv.G}/kl0089-g.pdf`);
      assert.equal(t.error, null, `thư ký tải tệp: ${t.error?.message}`);
    } finally { await db().from('accounts').update({ thu_ky_thuong_truc: false }).eq('id', TK); }
  });

  test('9. (0096) Người nhập việc thay mặt lãnh đạo (mọi chuyên viên, không cờ) giữ quyền người tạo: thấy việc, xử lý đề nghị từ chối, nộp minh chứng thay; không gia hạn (người giao là lãnh đạo)', async () => {
    const r = await goi('demo_cv2', 'giao_viec', { p: { van_ban_id: vb, noi_dung: `${KHOA} H gõ thay mặt`, san_pham_loai: 'BAO_CAO', han_xu_ly: '2026-12-31',
      owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, thay_mat_cho: IDS.truongphong } });
    assertOk(r, 'chuyên viên giao thay mặt Trưởng phòng'); nv.H = r.data.id;
    assert.equal((await (await userClient('demo_cv2')).from('v_nhiem_vu').select('id').eq('id', nv.H)).data?.length, 1, 'người nhập thấy việc mình nhập (khác phòng)');
    assertDenied(await goi('demo_cv2', 'chi_dao_gui', { p: { nhiem_vu_id: nv.H, loai: 'GIA_HAN', noi_dung: 'x', han_moi: '2027-02-01' } }), 'người nhập không gia hạn');
    const tc = await goi('demo_cv1', 'de_nghi_tu_choi', { p_nhiem_vu: nv.H, p_ly_do: `${KHOA} không đúng chức năng` });
    assertOk(tc, 'chủ trì đề nghị từ chối');
    assert.equal((await db().from('tu_choi').select('cap_duyet').eq('id', tc.data).single()).data.cap_duyet, IDS.cv2, 'cấp xử lý = người nhập (0091, 0096)');
    assertOk(await goi('demo_cv2', 'duyet_tu_choi', { p_id: tc.data, p_dong_y: false, p_y_kien: `${KHOA} đề nghị tiếp tục` }), 'người nhập không đồng ý');
    assertOk(await nop('demo_cv2', 'H'), 'người nhập nộp minh chứng thay');
    assert.equal((await viec(nv.H)).tien_do_ma, 'HOAN_THANH');
  });
});
