// B6 (Lượt 4) — Realtime postgres_changes lọc theo RLS SELECT của người nghe: cv1 (Owner + theo dõi việc Tổng hợp) nhận sự kiện của
// nhiem_vu (UPDATE), chi_dao (INSERT), minh_chung (INSERT — mới vào publication 0051); cv2 (phòng Quản trị, ngoài phạm vi) không nhận.
// Frontend chỉ nghe INSERT/UPDATE bốn bảng nhiem_vu / chi_dao / minh_chung / tu_choi (tu_choi: RLS riêng, 0037). Khoá "KL-RT"; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, IDS } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const KHOA = 'KL-RT';
const BANG = [['nhiem_vu', 'UPDATE'], ['chi_dao', 'INSERT'], ['minh_chung', 'INSERT']];
const cho = (ms) => new Promise((r) => { setTimeout(r, ms); });
let fx; let nvId; const kenh = []; const nhan = { cv1: [], cv2: [] };
const don = () => db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);

async function nghe(ai, username) {
  const c = await userClient(username);
  const ch = BANG.reduce((k, [table, event]) => k.on('postgres_changes', { event, schema: 'public', table }, (p) => {
    const id = p.new?.nhiem_vu_id ?? p.new?.id;
    if (id === nvId) nhan[ai].push(p.table);
  }), c.channel(`kl-rt-${ai}`));
  kenh.push([c, ch]);
  await new Promise((ok, loi) => {
    const h = setTimeout(() => loi(new Error(`${username}: kênh chưa SUBSCRIBED sau 15 giây`)), 15_000);
    ch.subscribe((s) => { if (s === 'SUBSCRIBED') { clearTimeout(h); ok(); } });
  });
}

describe('Realtime — sự kiện tới đúng người theo RLS (nhiem_vu, chi_dao, minh_chung)', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, noi_dung: `${KHOA} việc`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
      nganh_ma: 'KINH_TE_TONG_HOP', theo_1400: true, ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, owner_don_vi_ma: 'TONG_HOP',
      owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, tao_boi: IDS.cvp }).select('id').single();
    assertOk(r, 'tạo việc'); nvId = r.data.id;
    await Promise.all([nghe('cv1', 'demo_cv1'), nghe('cv2', 'demo_cv2')]);
    // Mồi: ngay sau `supabase start`/reset, SUBSCRIBED có thể tới trước khi Realtime đọc được WAL (lượt 5: cv1 nhận 0 sự kiện dù kênh đã
    // SUBSCRIBED). Sửa việc tới khi cv1 nhận sự kiện đầu (tối đa 20 giây) rồi mới đo; mảng nhận được làm trống trước test.
    for (let i = 0; i < 20 && !nhan.cv1.length; i += 1) {
      assertOk(await db().from('nhiem_vu').update({ ghi_chu: `${KHOA} mồi ${i}` }).eq('id', nvId), 'mồi realtime');
      for (let j = 0; j < 5 && !nhan.cv1.length; j += 1) await cho(200);
    }
    assert.ok(nhan.cv1.length, 'Realtime chưa phát sự kiện cho cv1 sau 20 giây mồi');
    await cho(1000);
    nhan.cv1.length = 0; nhan.cv2.length = 0;
  });
  after(async () => {
    await Promise.all(kenh.map(([c, ch]) => c.removeChannel(ch)));
    kenh.forEach(([c]) => c.realtime.disconnect());   // socket mở giữ tiến trình node thêm ~60 giây
    await don();
  });

  test('1. cv1 nhận đủ ba sự kiện; cv2 (ngoài phạm vi) không nhận sự kiện nào', async () => {
    assertOk(await db().from('nhiem_vu').update({ ghi_chu: `${KHOA} sửa` }).eq('id', nvId), 'UPDATE nhiem_vu');
    assertOk(await (await userClient('demo_truongphong')).rpc('chi_dao_gui', { p: { nhiem_vu_id: nvId, loai: 'DON_DOC', noi_dung: `${KHOA} đôn đốc` } }), 'A2 gửi chỉ đạo');
    assertOk(await db().from('minh_chung').insert({ nhiem_vu_id: nvId, loai: 'so_hieu', so_hieu: '1/KL-RT', ngay_van_ban: '2026-08-10', cap_nhan: 'CHANH_VAN_PHONG',
      trich_yeu: `${KHOA} trích yếu`, mo_ta_ket_qua: `${KHOA} kết quả`, nop_boi: IDS.cv1 }), 'INSERT minh_chung');
    for (let i = 0; i < 75 && new Set(nhan.cv1).size < BANG.length; i += 1) await cho(200);
    await cho(2000);   // sau khi cv1 đủ, chờ thêm để sự kiện (nếu lọt) tới cv2
    assert.deepEqual([...new Set(nhan.cv1)].sort(), BANG.map(([t]) => t).sort(), 'cv1 nhận đủ nhiem_vu, chi_dao, minh_chung');
    assert.deepEqual(nhan.cv2, [], 'cv2 không nhận sự kiện của việc ngoài phạm vi');
  });
});
