// 0142 (v3.36 — CAU-HOI V-1, V-10): thông báo hai mức. (1) Trigger đặt muc_tin theo nhãn đầu tin và vai của người nhận lúc gửi — kiểm bằng luồng
// thật: Chánh VP đôn đốc → chủ trì "cần xử lý", Trưởng phòng / PCVP "để biết"; chủ trì phản hồi → người ra chỉ đạo "cần xử lý", người khác "để
// biết"; đề nghị từ chối → cấp duyệt "cần xử lý"; không đồng ý → người đề nghị "cần xử lý". (2) Mức người gửi ghi bị trigger ghi đè; tin luôn để
// biết (điều chỉnh hạn); nhãn chưa phân loại là "cần xử lý". (3) kl_so_chua_xu_ly: thong_bao chỉ đếm tin cần xử lý chưa đọc, thong_bao_biet đếm
// tin để biết. (4) tin_he_thong_doc_het chỉ đánh dấu thẻ được chọn của chính mình; mức sai, chưa đăng nhập bị chặn. (5) kl_phan_muc_tin không
// gọi được từ người dùng. Logic thuần: chạy ở CI cục bộ (job supabase-db), không chạy trên staging. Mã NV-T16x, tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, anonClient, userClient, assertOk, assertDenied, IDS, CHI_CUC_BO, songSong } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = CHI_CUC_BO || ((await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.');
const db = () => adminClient();
let fx; const id = {};
const them = async (row) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, noi_dung: `KL-0142 ${row.ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
    nganh_ma: 'KINH_TE_TONG_HOP', theo_1400: true, ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1,
    nguoi_theo_doi: IDS.cv1, tao_boi: IDS.truongphong, ...row }).select('id').single();
  assertOk(r, row.ma); id[row.ma] = r.data.id;
};
const rpc = async (username, fn, args) => (await userClient(username)).rpc(fn, args);
// Mức của tin theo người nhận (một nhãn đầu tin trên một việc).
const mucTheoNguoi = async (ma, nhan) => {
  const r = await db().from('direct_messages').select('receiver_id, muc_tin').eq('nhiem_vu_id', id[ma]).eq('loai', 'he_thong').like('content', `${nhan}%`);
  assertOk(r, `tin ${nhan} ${ma}`);
  return Object.fromEntries(r.data.map((t) => [t.receiver_id, t.muc_tin]));
};
const chuaDoc = async (nguoi, muc) => (await db().from('direct_messages').select('id', { count: 'exact', head: true }).eq('receiver_id', nguoi)
  .eq('loai', 'he_thong').eq('is_read', false).eq('muc_tin', muc)).count;
const don = async () => {
  await db().from('direct_messages').delete().like('content', '%KL-0142%');
  await db().from('nhiem_vu').delete().like('ma', 'NV-T16%');
};

describe('0142 — thông báo hai mức: phân mức theo vai người nhận, số trên chuông, đánh dấu đã đọc theo thẻ', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    await songSong([() => them({ ma: 'NV-T160' }), () => them({ ma: 'NV-T161' })]);
  });
  after(don);

  test('1. đôn đốc: chủ trì cần xử lý, lãnh đạo được báo kèm để biết; phản hồi: người ra chỉ đạo cần xử lý', async () => {
    const r = await rpc('demo_cvp', 'chi_dao_gui', { p: { nhiem_vu_id: id['NV-T160'], loai: 'DON_DOC', noi_dung: 'KL-0142 khẩn trương hoàn thành', han_phan_hoi: '2026-12-30' } });
    assertOk(r, 'Chánh VP đôn đốc');
    assert.deepEqual(await mucTheoNguoi('NV-T160', 'Đôn đốc'), { [IDS.cv1]: 'XU_LY', [IDS.truongphong]: 'BIET', [IDS.pcvp]: 'BIET' });
    assertOk(await rpc('demo_cv1', 'chi_dao_phan_hoi', { p: { chi_dao_id: r.data, noi_dung: 'KL-0142 đã trình dự thảo' } }), 'chủ trì phản hồi');
    assert.deepEqual(await mucTheoNguoi('NV-T160', 'Phản hồi'), { [IDS.cvp]: 'XU_LY', [IDS.truongphong]: 'BIET', [IDS.pcvp]: 'BIET' });
  });

  test('2. đề nghị từ chối: cấp duyệt cần xử lý; không đồng ý thì người đề nghị cần xử lý', async () => {
    const tc = await rpc('demo_cv1', 'de_nghi_tu_choi', { p_nhiem_vu: id['NV-T161'], p_ly_do: 'KL-0142 không đúng chức năng' });
    assertOk(tc, 'chủ trì đề nghị từ chối');
    assert.equal((await mucTheoNguoi('NV-T161', 'Đề nghị từ chối'))[IDS.truongphong], 'XU_LY', 'Trưởng phòng (người giao, cấp duyệt)');
    assertOk(await rpc('demo_truongphong', 'duyet_tu_choi', { p_id: tc.data, p_dong_y: false, p_y_kien: 'KL-0142 làm tiếp' }), 'không đồng ý');
    assert.deepEqual(await mucTheoNguoi('NV-T161', 'Duyệt đề nghị từ chối'), { [IDS.cv1]: 'XU_LY' });
  });

  test('3. mức người gửi ghi bị ghi đè; tin luôn để biết; nhãn chưa phân loại cần xử lý; tin người với người không phân mức để biết', async () => {
    const r = await db().from('direct_messages').insert([
      { receiver_id: IDS.cv1, content: 'Điều chỉnh hạn · NV-T160: KL-0142 lùi hạn', loai: 'he_thong', nhiem_vu_id: id['NV-T160'], muc_tin: 'XU_LY' },
      { receiver_id: IDS.cv1, content: 'KL-0142 tin chưa phân loại', loai: 'he_thong', muc_tin: 'BIET' },
      { sender_id: IDS.cv2, receiver_id: IDS.cv1, content: 'Điều chỉnh hạn · KL-0142 tin người gửi người', loai: 'nguoi', muc_tin: 'BIET' }]).select('content, muc_tin');
    assertOk(r, 'chèn bằng service_role');
    assert.deepEqual(Object.fromEntries(r.data.map((t) => [t.content, t.muc_tin])), {
      'Điều chỉnh hạn · NV-T160: KL-0142 lùi hạn': 'BIET', 'KL-0142 tin chưa phân loại': 'XU_LY', 'Điều chỉnh hạn · KL-0142 tin người gửi người': 'XU_LY' });
  });

  test('4. số trên chuông: thong_bao chỉ tin cần xử lý chưa đọc, thong_bao_biet tin để biết', async () => {
    const [so, xl, bt] = await Promise.all([rpc('demo_cv1', 'kl_so_chua_xu_ly', {}), chuaDoc(IDS.cv1, 'XU_LY'), chuaDoc(IDS.cv1, 'BIET')]);
    assertOk(so, 'kl_so_chua_xu_ly');
    assert.ok(xl >= 2 && bt >= 1, `có tin của test: ${xl} / ${bt}`);
    assert.equal(Number(so.data.thong_bao), xl, 'thong_bao = tin cần xử lý chưa đọc');
    assert.equal(Number(so.data.thong_bao_biet), bt, 'thong_bao_biet = tin để biết chưa đọc');
  });

  test('5. đánh dấu đã đọc theo thẻ: chỉ mức được chọn, chỉ tin của mình; mức sai, chưa đăng nhập bị chặn', async () => {
    const xlTruoc = await chuaDoc(IDS.cv1, 'XU_LY'); const tpTruoc = await chuaDoc(IDS.truongphong, 'BIET');
    const r = await rpc('demo_cv1', 'tin_he_thong_doc_het', { p_muc: 'BIET' });
    assertOk(r, 'đọc hết thẻ Để biết');
    assert.ok(r.data >= 1, 'có tin để biết được đánh dấu');
    assert.equal(await chuaDoc(IDS.cv1, 'BIET'), 0, 'hết tin để biết chưa đọc');
    assert.equal(await chuaDoc(IDS.cv1, 'XU_LY'), xlTruoc, 'tin cần xử lý giữ nguyên');
    assert.equal(await chuaDoc(IDS.truongphong, 'BIET'), tpTruoc, 'tin của người khác giữ nguyên');
    const [sai, an] = await Promise.all([rpc('demo_cv1', 'tin_he_thong_doc_het', { p_muc: 'KHAC' }), anonClient().rpc('tin_he_thong_doc_het', { p_muc: 'BIET' })]);
    assert.ok(sai.error, 'mức sai bị chặn'); assertDenied(an, 'chưa đăng nhập');
  });

  test('6. hàm phân mức chỉ dùng nội bộ (người dùng, chưa đăng nhập không gọi được)', async () => {
    const ts = { p_noi_dung: 'Đôn đốc · NV-T160: x', p_nhan: IDS.cv1, p_nv: id['NV-T160'], p_nvq: null };
    const [u, an] = await Promise.all([rpc('demo_cvp', 'kl_phan_muc_tin', ts), anonClient().rpc('kl_phan_muc_tin', ts)]);
    assertDenied(u, 'Chánh VP'); assertDenied(an, 'chưa đăng nhập');
  });
});
