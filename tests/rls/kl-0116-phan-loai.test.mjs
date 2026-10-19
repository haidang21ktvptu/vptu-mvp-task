// 0116 (v3.26 — chủ dự án 19/10/2026: phân loại đúng cho Tổng quan khối 2–3). Kiểm:
// (A) quyền (chạy cả staging): Thường trực không rà soát; chuyên viên ngoài tầng giao / mã không có → cùng một lỗi, không lộ nội dung; Trưởng phòng
//     (lãnh đạo phụ trách) xem trước được; quản trị không sửa được mục "Không thuộc" của danh mục; Kết luận BTV không nhận ngành "Không thuộc";
// (B) logic (CI cục bộ): danh mục giữ chỗ + kl_danh_muc; "Không thuộc" đứng riêng (việc, văn bản); ra_soat_phan_loai — xem trước không ghi, áp dụng
//     được việc đã hoàn thành (ngành, lĩnh vực, mục tiêu nguồn RA_SOAT), diễn biến có lý do, không gửi tin, chạy lại → GIU, lỗi từng dòng không làm
//     hỏng dòng khác, kiểm giá trị (lĩnh vực ngoài ngành, KL → "Không thuộc", mã lạ), ngành một lĩnh vực tự chọn, cảnh báo đổi lãnh đạo kiêm nhiệm,
//     giới hạn 200 dòng, áp dụng phải có lý do. Khoá dữ liệu "KL-0116"; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, IDS, CHI_CUC_BO } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0116';
const MA_XONG = 'NV-T116';
const coHam = async () => ((await db().from('dm_nganh').select('ma').eq('ma', 'KHONG_THUOC')).data || []).length === 1;   // mục giữ chỗ của 0116
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : !(await coHam()) ? 'Chưa có migration 0116 (ra_soat_phan_loai).' : false;
const goi = async (u, ham, thamSo) => (await userClient(u)).rpc(ham, thamSo);
const loi = (r) => r.error?.message || '';
let dem = 0;
const vanBan = (loai) => ({ loai, so_ket_luan: `${KHOA}/${loai}/${++dem}`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02', ...(loai === 'KL_BTV' ? { so_hoi_nghi: 998 } : {}) });
const giao = (u, loai, p = {}) => goi(u, 'giao_viec', { p: {
  van_ban_id: null, van_ban: vanBan(loai), noi_dung: `${KHOA} ${loai} ${u}`, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.truongphong,
  san_pham_loai: 'BAO_CAO', han_xu_ly: '2026-12-31', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_ma: 'LV08_TAI_CHINH', ...p } });
const rs = (u, p, ly = null, ap = false) => goi(u, 'ra_soat_phan_loai', { p, p_ly_do: ly, p_ap: ap });
const maCua = async (id) => (await db().from('nhiem_vu').select('ma').eq('id', id).single()).data.ma;
const mtCua = async (id) => ((await db().from('nhiem_vu_muc_tieu').select('muc_tieu_ma, nguon').eq('nhiem_vu_id', id).order('muc_tieu_ma')).data || []);
const don = async () => {
  await db().from('phu_trach_phong').delete().eq('ly_do', KHOA);
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
};

describe('0116 — quyền rà soát phân loại, mục "Không thuộc"', { skip: SKIP }, () => {
  let kl;
  before(async () => {
    await don();
    const r = await giao('demo_cvp', 'KL_BTV'); assertOk(r, 'giao KL'); kl = await maCua(r.data.id);
  });
  after(don);

  test('A1. Thường trực không gọi được; chuyên viên ngoài tầng giao và mã không có → cùng câu lỗi, không lộ nội dung', async () => {
    assert.equal((await rs('demo_a0', [{ ma: kl, nganh: 'VAN_HOA_XA_HOI' }])).error?.code, '42501');
    const r = await rs('demo_cv2', [{ ma: kl, muc_tieu: ['NQ_57'] }, { ma: 'NV-KL0116-KHONG-CO' }]); assertOk(r, 'cv2');
    r.data.forEach((x) => { assert.equal(x.ket_qua, 'LOI'); assert.match(x.loi, /trong phạm vi đồng chí phân loại được/); assert.equal(x.noi_dung, null); assert.equal(x.cu, null); });
    assert.equal((await rs('demo_cv1', [{ ma: kl, muc_tieu: ['NQ_57'] }])).data?.[0]?.ket_qua, 'LOI', 'chủ trì (không phải người giao)');
  });

  test('A2. Trưởng phòng (lãnh đạo phụ trách) và CVP xem trước được; xem trước không ghi', async () => {
    for (const u of ['demo_truongphong', 'demo_cvp']) {
      const r = await rs(u, [{ ma: kl, muc_tieu: ['NQ_57'] }]); assertOk(r, u);
      assert.equal(r.data[0].ket_qua, 'DOI', u); assert.deepEqual(r.data[0].doi, ['muc_tieu']);
    }
    const id = (await db().from('nhiem_vu').select('id').eq('ma', kl).single()).data.id;
    assert.deepEqual(await mtCua(id), [], 'xem trước không gắn gì');
  });

  test('A3. Kết luận BTV không nhận ngành "Không thuộc" (giao việc, sửa thông tin giao); Công văn nhận được', async () => {
    const kt = { nganh_ma: 'KHONG_THUOC', linh_vuc_ma: 'LV99_KHONG_THUOC' };
    assert.match(loi(await giao('demo_cvp', 'KL_BTV', kt)), /không chọn "Không thuộc"/);
    assert.match(loi(await giao('demo_cvp', 'TB_THUONG_TRUC', kt)), /không chọn "Không thuộc"/);
    assertOk(await giao('demo_cvp', 'CONG_VAN', kt), 'Công văn "Không thuộc"');
    const id = (await db().from('nhiem_vu').select('id').eq('ma', kl).single()).data.id;
    assert.match(loi(await goi('demo_cvp', 'sua_thong_tin_giao', { p_id: id, p_thay_doi: kt, p_ly_do: KHOA })), /không chọn "Không thuộc"/);
  });

  test('A4. Quản trị không sửa, không ngừng dùng, không gộp vào mục "Không thuộc"; không đưa lĩnh vực khác vào khối "Không thuộc"', async () => {
    const ca = [['sua_khoi_linh_vuc', { p_ma: 'KHONG_THUOC', p: { ten: 'Khác' }, p_ly_do: KHOA }], ['sua_nhom_muc_tieu', { p_ma: 'KHONG_THUOC', p: { ten: 'Khác' }, p_ly_do: KHOA }],
      ['dat_khoi_linh_vuc', { p_bang: 'dm_nganh', p_ma: 'KHONG_THUOC', p_khoi: 'KINH_TE', p_ly_do: KHOA }],
      ['dat_trang_thai_muc_tieu', { p_ma: 'KHONG_THUOC', p_hanh_dong: 'mo_khoa', p_ly_do: KHOA }], ['gop_muc_tieu', { p_tu: 'KHONG_THUOC', p_vao: 'NQ_79', p_ly_do: KHOA }]];
    for (const [ham, ts] of ca) assert.match(loi(await goi('demo_qtht', ham, ts)), /cố định/, ham);
    assert.match(loi(await goi('demo_qtht', 'dat_khoi_linh_vuc', { p_bang: 'dm_linh_vuc', p_ma: 'LV08_TAI_CHINH', p_khoi: 'KHONG_THUOC', p_ly_do: KHOA })), /nhóm "Không thuộc"/);
    assert.ok(loi(await goi('demo_qtht', 'them_quy_tac', { p_ma: 'KHONG_THUOC', p_loai: 'TU_KHOA', p_gia_tri: 'kl0116 thử', p_muc: 'GOI_Y', p_ly_do: KHOA })), 'quy tắc cho "Không thuộc"');
  });
});

describe('0116 — logic phân loại, rà soát từ tệp', { skip: SKIP || CHI_CUC_BO }, () => {
  let tp; let xong; let vbXong;
  before(async () => {
    await don();
    const r = await giao('demo_truongphong', 'CONG_VAN'); assertOk(r, 'giao TP'); tp = r.data.id;
    const vb = await db().from('van_ban_giao_viec').insert({ loai: 'CONG_VAN', so_ket_luan: `${KHOA}/XONG`, ngay_ban_hanh: '2026-09-01' }).select('id').single();
    assertOk(vb, 'văn bản việc xong'); vbXong = vb.data.id;
    const n = await db().from('nhiem_vu').insert({ van_ban_id: vbXong, ma: MA_XONG, noi_dung: `${KHOA} việc đã hoàn thành`, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1,
      nguoi_theo_doi: IDS.truongphong, nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_ma: 'LV08_TAI_CHINH', loai_thoi_han_ma: 'CO_HAN_CU_THE', tien_do_ma: 'HOAN_THANH', nguon: 'excel',
      tao_boi: IDS.cvp, san_pham_loai: 'BAO_CAO' }, { defaultToNull: false }).select('id').single();
    assertOk(n, 'việc đã hoàn thành'); xong = n.data.id;
  });
  after(don);

  test('B1. Danh mục: đủ mục giữ chỗ, kl_danh_muc trả về; bộ tự học bỏ mục "Không thuộc"', async () => {
    const dm = await goi('demo_cv1', 'kl_danh_muc', {}); assertOk(dm, 'kl_danh_muc');
    assert.equal(dm.data.nganh.find((x) => x.ma === 'KHONG_THUOC')?.khoi_ma, 'KHONG_THUOC');
    assert.equal(dm.data.linhVuc.find((x) => x.ma === 'LV99_KHONG_THUOC')?.nganh_ma, 'KHONG_THUOC');
    assert.equal(dm.data.mucTieu.find((x) => x.ma === 'KHONG_THUOC')?.nhom, 'KHONG_THUOC');
    assert.ok(dm.data.khoi.some((x) => x.ma === 'KHONG_THUOC')); assert.ok(dm.data.nhomMucTieu.some((x) => x.ma === 'KHONG_THUOC'));
    const hoc = await db().rpc('ai_can_hoc', { p_gioi_han: 50 }); assertOk(hoc, 'ai_can_hoc'); assert.ok(!hoc.data.includes('KHONG_THUOC'));
  });

  test('B2. "Không thuộc" đứng riêng ở việc và văn bản', async () => {
    assert.match(loi(await goi('demo_truongphong', 'gan_muc_tieu', { p_id: tp, p_ma: ['KHONG_THUOC', 'NQ_57'] })), /không chọn cùng/);
    assertOk(await goi('demo_truongphong', 'gan_muc_tieu', { p_id: tp, p_ma: ['KHONG_THUOC'] }), 'gắn riêng "Không thuộc"');
    assertOk(await goi('demo_truongphong', 'gan_muc_tieu', { p_id: tp, p_ma: ['NQ_57'] }), 'đổi sang mục thật');
    assert.deepEqual((await mtCua(tp)).map((x) => x.muc_tieu_ma), ['NQ_57']);
    const vb = (await db().from('nhiem_vu').select('van_ban_id').eq('id', tp).single()).data.van_ban_id;
    assert.match(loi(await goi('demo_truongphong', 'gan_muc_tieu_van_ban', { p_van_ban: vb, p_ma: ['KHONG_THUOC', 'NQ_57'] })), /không chọn cùng/);
  });

  test('B3. Xem trước không ghi; áp dụng ghi được việc đã hoàn thành, diễn biến có lý do, không gửi tin; chạy lại → GIU', async () => {
    const dong = [{ ma: MA_XONG, nganh: 'VAN_HOA_XA_HOI', linh_vuc: 'LV10_VAN_HOA', muc_tieu: ['NQ_80'], ly_do: 'chủ đề văn hóa' }];
    const xt = await rs('demo_cvp', dong); assertOk(xt, 'xem trước');
    assert.deepEqual([xt.data[0].ket_qua, xt.data[0].doi, xt.data[0].da_xong], ['DOI', ['linh_vuc_ma', 'nganh_ma', 'muc_tieu'], true]);
    assert.deepEqual([xt.data[0].cu.nganh, xt.data[0].moi.linh_vuc, xt.data[0].moi.muc_tieu], ['KINH_TE_TONG_HOP', 'LV10_VAN_HOA', ['NQ_80']]);
    assert.equal((await db().from('nhiem_vu').select('nganh_ma').eq('id', xong).single()).data.nganh_ma, 'KINH_TE_TONG_HOP', 'xem trước không ghi');
    assert.equal((await rs('demo_cvp', dong, ' ', true)).error?.code, '22023', 'áp dụng phải có lý do');
    const tin = async () => (await db().from('direct_messages').select('id', { count: 'exact', head: true }).eq('nhiem_vu_id', xong)).count;
    const tinTruoc = await tin();
    const ap = await rs('demo_cvp', dong, `${KHOA} lý do chung`, true); assertOk(ap, 'áp dụng'); assert.equal(ap.data[0].ket_qua, 'DOI');
    const n = (await db().from('nhiem_vu').select('nganh_ma, linh_vuc_ma, tien_do_ma').eq('id', xong).single()).data;
    assert.deepEqual(n, { nganh_ma: 'VAN_HOA_XA_HOI', linh_vuc_ma: 'LV10_VAN_HOA', tien_do_ma: 'HOAN_THANH' });
    assert.deepEqual(await mtCua(xong), [{ muc_tieu_ma: 'NQ_80', nguon: 'RA_SOAT' }]);
    const ls = (await db().from('lich_su').select('cot, gia_tri_moi').eq('nhiem_vu_id', xong).eq('cot', 'ra_soat_phan_loai')).data;
    assert.equal(ls.length, 1); assert.match(ls[0].gia_tri_moi, /lý do: KL-0116 lý do chung · chủ đề văn hóa/);
    assert.equal(await tin(), tinTruoc, 'không gửi tin');
    assert.equal((await rs('demo_cvp', dong, 'lại', true)).data[0].ket_qua, 'GIU');
  });

  test('B4. Kiểm giá trị từng dòng; dòng lỗi không làm hỏng dòng khác; ngành một lĩnh vực tự chọn; giới hạn 200 dòng', async () => {
    const ma = await maCua(tp);
    const r = await rs('demo_cvp', [{ ma, nganh: 'NOI_CHINH', linh_vuc: 'LV08_TAI_CHINH' }, { ma, muc_tieu: ['KHONG_THUOC', 'NQ_57'] }, { ma, muc_tieu: ['MA_LA_0116'] },
      { ma, nganh: 'NOI_CHINH' }, { ma, nganh: 'MTTQ_DOAN_THE' }, { ma, nganh: 'KHONG_THUOC', muc_tieu: ['KHONG_THUOC'] }]);
    assertOk(r, 'xem trước');
    assert.match(r.data[0].loi, /Lĩnh vực không thuộc ngành/); assert.match(r.data[1].loi, /không chọn cùng/); assert.match(r.data[2].loi, /MA_LA_0116/);
    assert.equal(r.data[3].ket_qua, 'LOI', 'ngành nhiều lĩnh vực, lĩnh vực cũ khác ngành');
    assert.equal(r.data[4].moi.linh_vuc, 'LV07_MTTQ_DOAN_THE', 'ngành chỉ có một lĩnh vực → tự chọn');
    assert.deepEqual([r.data[5].ket_qua, r.data[5].moi.linh_vuc], ['DOI', 'LV99_KHONG_THUOC'], 'Công văn: "Không thuộc"');
    const hai = await rs('demo_cvp', [{ ma: 'NV-KL0116-KHONG-CO' }, { ma, muc_tieu: ['NQ_70'] }], KHOA, true); assertOk(hai, 'áp dụng 2 dòng');
    assert.deepEqual(hai.data.map((x) => x.ket_qua), ['LOI', 'DOI']); assert.deepEqual((await mtCua(tp)).map((x) => x.muc_tieu_ma), ['NQ_70']);
    assert.match(loi(await rs('demo_cvp', Array.from({ length: 201 }, (_, i) => ({ ma: `NV-X${i}` })))), /tối đa 200/);
    assert.match(loi(await rs('demo_cvp', [])), /Chưa có dòng/);
  });

  test('B5. Đổi sang (ngành, lĩnh vực) có lãnh đạo kiêm nhiệm khác → cảnh báo; không đổi ngành → không cảnh báo', async () => {
    assertOk(await db().from('phu_trach_phong').insert({ lanh_dao_id: IDS.pcvp2, phong: 'TONG_HOP', nganh_ma: 'VAN_HOA_XA_HOI', linh_vuc_ma: 'LV10_KHCN', tu_ngay: '2026-01-01', ly_do: KHOA }), 'kiêm nhiệm thử');
    const ma = await maCua(tp);
    const r = await rs('demo_cvp', [{ ma, nganh: 'VAN_HOA_XA_HOI', linh_vuc: 'LV10_KHCN' }, { ma, muc_tieu: ['NQ_80'] }]); assertOk(r, 'xem trước');
    assert.match(r.data[0].canh_bao || '', /lãnh đạo phụ trách cả phòng → Đ\/c Demo Phó Chánh Văn phòng Hai/);
    assert.equal(r.data[1].canh_bao, null);
  });
});
