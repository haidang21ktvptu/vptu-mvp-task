// 0115 (v3.25, kiểm tay staging 18/10/2026 — NV-8865): mục tiêu người dùng đã bỏ ở một việc không được tự tích lại ở việc đó. Kiểm:
// (1) mục có quy tắc tích sẵn + quy tắc gợi ý cùng khớp: phản hồi BO (chỉ quy tắc tích sẵn được ghi) → ở việc đó mục là gợi ý, da_bo; mục khác của
//     việc và việc khác cùng nội dung vẫn tích sẵn (trước 0115: mục như vậy không bao giờ được hạ);
// (2) quy tắc gợi ý của mục được nâng lên tích sẵn, quy tắc đã bỏ bị tắt → vẫn là gợi ý ở việc đó (trí nhớ theo mục tiêu, không theo quy tắc);
// (3) việc đã gắn riêng: mục tiêu của văn bản không làm mục thành tích sẵn (còn căn cứ khác thì là gợi ý); việc chưa gắn riêng vẫn tích sẵn theo văn bản.
// Quy tắc thử riêng (không đụng bộ đếm quy tắc thật); khoá "KL-0115"; tự dọn. Logic thuần — chỉ chạy ở CI cục bộ (CHI_CUC_BO).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, IDS, homNayVN, CHI_CUC_BO } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0115';
const coHam = async () => !(await db().rpc('goi_y_muc_tieu', { p: {} })).error;
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : !(await coHam()) ? 'Chưa có migration 0110 (goi_y_muc_tieu).' : false;
const goi = async (u, ham, thamSo) => (await userClient(u)).rpc(ham, thamSo);
const cong = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
let dem = 0;
const giao = (noiDung, p = {}) => goi('demo_cvp', 'giao_viec', { p: {
  van_ban_id: null, van_ban: { loai: 'CONG_VAN', so_ket_luan: `${KHOA}/${++dem}`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02' },
  noi_dung: `${KHOA} ${noiDung}`, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.truongphong, san_pham_loai: 'BAO_CAO',
  han_xu_ly: cong(homNayVN(), 30), nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', ...p } });
const goiY = (kq, viec, ma) => kq.data?.[viec]?.goi_y?.find((g) => g.ma === ma);
const tom = (g) => ({ muc: g?.muc, da_bo: g?.da_bo ?? false });
const qt = (gia_tri, muc_tieu_ma, muc) => ({ muc_tieu_ma, loai: 'TU_KHOA', gia_tri, muc, nguon: 'QUAN_TRI' });
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
  const q = (await db().from('quy_tac_muc_tieu').select('id').like('gia_tri', 'KL0115%')).data || [];
  if (q.length) { await db().from('dm_lich_su').delete().eq('bang', 'quy_tac_muc_tieu').in('ma', q.map((x) => x.id)); await db().from('quy_tac_muc_tieu').delete().in('id', q.map((x) => x.id)); }
};

describe('0115 — mục đã bỏ ở một việc không tự tích lại', { skip: SKIP || CHI_CUC_BO }, () => {
  let q1; let q2; let t1; let t2;
  before(async () => {
    await don();
    const q = await db().from('quy_tac_muc_tieu').insert([qt('KL0115 cụm tích sẵn', 'NQ_80', 'TU_TICH'), qt('KL0115 cụm gợi ý', 'NQ_80', 'GOI_Y'),
      qt('KL0115 cụm khác', 'NQ_79', 'TU_TICH'), qt('KL0115 cụm văn bản', 'NQ_72', 'GOI_Y')]).select('id, gia_tri');
    assertOk(q, 'quy tắc thử');
    q1 = q.data.find((x) => x.gia_tri === 'KL0115 cụm tích sẵn').id; q2 = q.data.find((x) => x.gia_tri === 'KL0115 cụm gợi ý').id;
  });
  after(don);

  test('1. Mục có quy tắc tích sẵn + gợi ý: bỏ ở việc → gợi ý (da_bo); mục khác, việc khác cùng nội dung vẫn tích sẵn', async () => {
    const nd = 'việc có KL0115 cụm tích sẵn, KL0115 cụm gợi ý và KL0115 cụm khác';
    const g1 = await giao(nd); assertOk(g1, 'giao 1'); t1 = g1.data.id;
    const g2 = await giao(nd); assertOk(g2, 'giao 2'); t2 = g2.data.id;
    const truoc = await goi('demo_cvp', 'goi_y_muc_tieu_viec', { p_ids: [t1, t2] }); assertOk(truoc, 'gợi ý trước');
    const m80 = goiY(truoc, t1, 'NQ_80');
    assert.equal(m80?.muc, 'TU_TICH'); assert.deepEqual([...m80.quy_tac].sort(), [q1, q2].sort(), 'hai quy tắc cùng khớp');
    const bo = await goi('demo_cvp', 'ghi_phan_hoi_goi_y', { p_viec: t1, p_ds: [{ quy_tac: m80.quy_tac, ket_qua: 'BO' }] });
    assertOk(bo, 'bỏ'); assert.equal(bo.data, 1, 'chỉ quy tắc mức tích sẵn nhận BO');
    const sau = await goi('demo_cvp', 'goi_y_muc_tieu_viec', { p_ids: [t1, t2] }); assertOk(sau, 'gợi ý sau');
    assert.deepEqual(tom(goiY(sau, t1, 'NQ_80')), { muc: 'GOI_Y', da_bo: true }, 'không tích lại mục người giao đã bỏ');
    assert.deepEqual(tom(goiY(sau, t1, 'NQ_79')), { muc: 'TU_TICH', da_bo: false }, 'mục khác của việc vẫn tích sẵn');
    assert.deepEqual(tom(goiY(sau, t2, 'NQ_80')), { muc: 'TU_TICH', da_bo: false }, 'việc khác cùng nội dung vẫn tích sẵn');
  });

  test('2. Quy tắc gợi ý được nâng mức, quy tắc đã bỏ bị tắt → vẫn là gợi ý ở việc đã bỏ', async () => {
    assertOk(await db().from('quy_tac_muc_tieu').update({ muc: 'TU_TICH' }).eq('id', q2), 'nâng quy tắc gợi ý');
    assertOk(await db().from('quy_tac_muc_tieu').update({ trang_thai: 'TAT' }).eq('id', q1), 'tắt quy tắc đã bỏ');
    const kq = await goi('demo_cvp', 'goi_y_muc_tieu_viec', { p_ids: [t1, t2] }); assertOk(kq, 'gợi ý');
    assert.deepEqual(goiY(kq, t1, 'NQ_80')?.quy_tac, [q2], 'chỉ còn quy tắc vừa nâng');
    assert.deepEqual(tom(goiY(kq, t1, 'NQ_80')), { muc: 'GOI_Y', da_bo: true });
    assert.deepEqual(tom(goiY(kq, t2, 'NQ_80')), { muc: 'TU_TICH', da_bo: false });
  });

  test('3. Việc đã gắn riêng: mục tiêu của văn bản không làm mục thành tích sẵn; việc chưa gắn riêng vẫn theo văn bản', async () => {
    const g3 = await giao('việc có KL0115 cụm văn bản'); assertOk(g3, 'giao 3'); const t3 = g3.data.id;
    const vb = (await db().from('nhiem_vu').select('van_ban_id').eq('id', t3).single()).data.van_ban_id;
    const g4 = await giao('việc khác có KL0115 cụm văn bản', { van_ban_id: vb, van_ban: undefined }); assertOk(g4, 'giao 4'); const t4 = g4.data.id;
    assertOk(await goi('demo_cvp', 'gan_muc_tieu_van_ban', { p_van_ban: vb, p_ma: ['NQ_72'] }), 'mục tiêu của văn bản');
    assertOk(await goi('demo_cvp', 'gan_muc_tieu', { p_id: t3, p_ma: ['NQ_57'] }), 'việc 3 gắn riêng, không có mục của văn bản');
    const kq = await goi('demo_cvp', 'goi_y_muc_tieu_viec', { p_ids: [t3, t4] }); assertOk(kq, 'gợi ý');
    const loai = (g) => (g?.ly_do || []).map((l) => l.loai).sort();
    assert.deepEqual([goiY(kq, t3, 'NQ_72')?.muc, loai(goiY(kq, t3, 'NQ_72'))], ['GOI_Y', ['TU_KHOA']], 'đã gắn riêng: chỉ còn căn cứ từ khoá, mức gợi ý');
    assert.deepEqual([goiY(kq, t4, 'NQ_72')?.muc, loai(goiY(kq, t4, 'NQ_72'))], ['TU_TICH', ['TU_KHOA', 'VAN_BAN']], 'chưa gắn riêng: theo văn bản');
  });
});
