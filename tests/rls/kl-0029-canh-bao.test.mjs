// GĐ17 (0029, PR 17A) — cảnh báo tự động: canh_bao_quet() chỉ service_role gọi được (NF-13), mức từ trang_thai(nv, ngày
// cố định), đúng tập người nhận từng mức leo thang (CB-3), không gửi trùng khi chạy 2 lần (NF-11), nhắc lại sau N ngày,
// ghi lich_su không người sửa, tin he_thong sender_id NULL người nhận đọc được qua RLS, ngày mặc định theo giờ Việt Nam.
// Mã NV-T10x, tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, anonClient, userClient, assertOk, assertDenied, IDS, LA_PRODUCTION, BO_QUA_PRODUCTION } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = LA_PRODUCTION ? BO_QUA_PRODUCTION : (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const NGAY = '2026-08-20';
let fx; const id = {}; let t0;
const them = async (row) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, nguoi_theo_doi: IDS.cv1, noi_dung: `KL-0029 ${row.ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE',
    nganh_ma: 'KINH_TE_TONG_HOP', ...row }).select('id').single();
  assertOk(r, row.ma); id[row.ma] = r.data.id;
};
const quet = async (ngay) => { const r = await db().rpc('canh_bao_quet', ngay ? { p_ngay: ngay } : {}); assertOk(r, `canh_bao_quet ${ngay}`); return r.data; };
const soCanhBao = async (ma) => (await db().from('canh_bao').select('id, muc, ngay, nguoi_nhan').eq('nhiem_vu_id', id[ma]).order('id')).data;
const nguoiNhan = async (ma) => (await soCanhBao(ma)).at(-1).nguoi_nhan.sort();
const tinCua = async (ma) => (await db().from('direct_messages').select('receiver_id, sender_id, content').eq('nhiem_vu_id', id[ma]).eq('loai', 'he_thong')).data;
const don = async () => {
  // Dọn cả dấu vết job trên dữ liệu ngoài fixture (test 6 quét hôm nay trên toàn bộ nhiệm vụ mở của project) — theo mốc t0.
  if (t0) {
    await db().from('canh_bao').delete().gte('gui_luc', t0);
    await db().from('direct_messages').delete().eq('loai', 'he_thong').is('sender_id', null).gte('created_at', t0);
    await db().from('lich_su').delete().eq('cot', 'canh_bao').gte('luc', t0);
  }
  await db().from('nhiem_vu').delete().like('ma', 'NV-T10%');
  await db().from('dm_don_vi').update({ lanh_dao_phu_trach: null }).eq('ma', 'DANG_UY_UBND');
};

describe('0029 — cảnh báo tự động: quyền gọi, người nhận theo mức, chống trùng, lịch sử, tin hệ thống', { skip: SKIP }, () => {
  before(async () => {
    t0 = new Date().toISOString();
    fx = await setupKlFixtures();
    await don();
    await db().from('dm_don_vi').update({ lanh_dao_phu_trach: IDS.pcvp2 }).eq('ma', 'DANG_UY_UBND');   // CH-4b: lãnh đạo VP phụ trách đơn vị ngoài
    await them({ ma: 'NV-T100', owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, han_xu_ly: '2026-08-22' });   // VÀNG: còn 2 ngày, chưa minh chứng
    await them({ ma: 'NV-T101', owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, han_xu_ly: '2026-08-19' });   // ĐỎ: trễ 1 ngày
    await them({ ma: 'NV-T102', owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, han_xu_ly: '2026-08-15' });   // ĐỎ ĐẶC BIỆT: trễ 5 ≥ 3
    await them({ ma: 'NV-T103', owner_don_vi_ma: 'DANG_UY_UBND', han_xu_ly: '2026-08-18' });                        // ĐỎ, Owner đơn vị ngoài
    await them({ ma: 'NV-T104', owner_don_vi_ma: 'TONG_HOP', loai_thoi_han_ma: 'THUONG_XUYEN', han_xu_ly: null });  // KHONG_AP_DUNG
    await them({ ma: 'NV-T105', owner_don_vi_ma: 'TONG_HOP', han_xu_ly: '2026-09-30' });                            // XANH
    await them({ ma: 'NV-T106', owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, han_xu_ly: '2026-08-22', minh_chung: 'Đã có sản phẩm' }); // sắp hạn nhưng có minh chứng → XANH
  });
  after(don);

  test('1. authenticated (A3/A2/A1) và anon gọi canh_bao_quet bị chặn; service_role chạy được', async () => {
    for (const u of ['demo_cv1', 'demo_truongphong', 'demo_cvp']) {
      assertDenied(await (await userClient(u)).rpc('canh_bao_quet', { p_ngay: NGAY }), `${u} gọi canh_bao_quet`);
    }
    assertDenied(await anonClient().rpc('canh_bao_quet', { p_ngay: NGAY }), 'anon gọi canh_bao_quet');
    const kq = await quet(NGAY);
    assert.equal(kq.ngay, NGAY);
    assert.ok(kq.quet >= 4 && kq.bo_qua >= 0 && kq.tin >= 1, `thống kê: ${JSON.stringify(kq)}`);
    assert.ok(Array.isArray(kq.theo_nguoi_nhan) && kq.theo_nguoi_nhan.length > 0, 'theo_nguoi_nhan là mảng có phần tử');
    for (let i = 1; i < kq.theo_nguoi_nhan.length; i++) assert.ok(kq.theo_nguoi_nhan[i - 1].so_tin >= kq.theo_nguoi_nhan[i].so_tin, 'theo_nguoi_nhan giảm dần');
    assert.ok(kq.theo_nguoi_nhan.some((x) => x.tai_khoan === 'demo_cv1'), 'cv1 có trong theo_nguoi_nhan');
  });

  test('2. mức đúng theo trang_thai; việc Xanh / thường xuyên / có minh chứng không gửi', async () => {
    assert.deepEqual((await soCanhBao('NV-T100')).map((c) => c.muc), ['VANG']);
    assert.deepEqual((await soCanhBao('NV-T101')).map((c) => c.muc), ['DO']);
    assert.deepEqual((await soCanhBao('NV-T102')).map((c) => c.muc), ['DO_DAC_BIET']);
    assert.deepEqual((await soCanhBao('NV-T103')).map((c) => c.muc), ['DO']);
    for (const ma of ['NV-T104', 'NV-T105', 'NV-T106']) assert.equal((await soCanhBao(ma)).length, 0, `${ma} không có cảnh báo`);
  });

  test('3. người nhận leo thang: Vàng = Owner + theo dõi; Đỏ + A2 hai phòng (+ lãnh đạo VP phụ trách đơn vị ngoài); Đỏ đặc biệt + PCVP hai phòng + Chánh VP', async () => {
    assert.deepEqual(await nguoiNhan('NV-T100'), [IDS.cv1, IDS.cv2].sort(), 'Vàng');
    assert.deepEqual(await nguoiNhan('NV-T101'), [IDS.cv1, IDS.cv2, IDS.truongphong].sort(), 'Đỏ: + trưởng phòng TH (QUAN_TRI không có A2)');
    assert.deepEqual(await nguoiNhan('NV-T102'), [IDS.cv1, IDS.cv2, IDS.truongphong, IDS.pcvp, IDS.pcvp2, IDS.cvp].sort(), 'Đỏ đặc biệt: + PCVP TH, PCVP QT, Chánh VP');
    assert.deepEqual(await nguoiNhan('NV-T103'), [IDS.cv1, IDS.truongphong, IDS.pcvp2].sort(), 'Đỏ đơn vị ngoài: + lãnh đạo VP phụ trách');
  });

  test('4. mỗi người nhận một tin he_thong, sender_id NULL; người nhận đọc được qua RLS; ghi lich_su không người sửa', async () => {
    const tin = await tinCua('NV-T102');
    assert.equal(tin.length, 6);
    assert.ok(tin.every((t) => t.sender_id === null && /Đỏ đặc biệt · NV-T102: quá hạn 5 ngày/.test(t.content)), 'nội dung tin');
    const cv1 = await (await userClient('demo_cv1')).from('direct_messages').select('content, sender_id').eq('nhiem_vu_id', id['NV-T102']).eq('loai', 'he_thong');
    assertOk(cv1, 'cv1 đọc tin'); assert.equal(cv1.data.length, 1); assert.equal(cv1.data[0].sender_id, null);
    const cv2 = await (await userClient('demo_cv2')).from('direct_messages').select('content').eq('nhiem_vu_id', id['NV-T101']).eq('loai', 'he_thong');
    assertOk(cv2, 'cv2 đọc tin'); assert.equal(cv2.data.length, 1);
    const ls = (await db().from('lich_su').select('nguoi_sua, nguoi_sua_ghi_chu, gia_tri_moi').eq('nhiem_vu_id', id['NV-T100']).eq('cot', 'canh_bao')).data;
    assert.equal(ls.length, 1); assert.equal(ls[0].nguoi_sua, null); assert.match(ls[0].nguoi_sua_ghi_chu, /Hệ thống/); assert.match(ls[0].gia_tri_moi, /còn 2 ngày tới hạn 22\/08\/2026/);
  });

  test('5. chạy lại cùng ngày và ngày +1: không gửi trùng; ngày +N (3): nhắc lại cùng mức', async () => {
    const kq2 = await quet(NGAY);
    assert.equal((await tinCua('NV-T102')).length, 6, 'chạy lần 2 không thêm tin');
    assert.equal((await soCanhBao('NV-T102')).length, 1);
    assert.ok(kq2.bo_qua >= 4, `bỏ qua ≥ 4: ${JSON.stringify(kq2)}`);
    await quet('2026-08-21');
    assert.equal((await soCanhBao('NV-T102')).length, 1, 'ngày +1 vẫn bỏ qua');
    await quet('2026-08-23');
    const cb = await soCanhBao('NV-T102');
    assert.deepEqual(cb.map((c) => c.muc), ['DO_DAC_BIET', 'DO_DAC_BIET'], 'ngày +3 nhắc lại');
    assert.equal((await tinCua('NV-T102')).length, 12);
    // NV-T101 lên mức: 23/8 trễ 4 ngày ≥ 3 → ĐỎ ĐẶC BIỆT gửi ngay dù ĐỎ mới gửi 20/8.
    assert.deepEqual((await soCanhBao('NV-T101')).map((c) => c.muc), ['DO', 'DO_DAC_BIET']);
  });

  test('6. không truyền ngày: ngày tính = hôm nay theo giờ Việt Nam (kl_hom_nay)', async () => {
    const kq = await quet();
    const homNay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    assert.equal(kq.ngay, homNay);
  });
});
