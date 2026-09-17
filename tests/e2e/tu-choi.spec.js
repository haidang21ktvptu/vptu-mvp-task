// GĐ21 (0034): từ chối nhận việc có duyệt — A3 (demo_e2e_cv, phòng E2E_RT) mở "Việc của tôi" → việc mới giao có nút Từ chối → lý do
// bắt buộc → gửi → dòng chuyển "chờ duyệt"; A2 cùng phòng (demo_e2e_tp = lãnh đạo trực tiếp) mở "Phòng tôi hôm nay" → khối "Đề nghị từ chối"
// hiện lý do → Đồng ý → A3 tải lại: việc nằm ở nhóm "Bị từ chối, chờ lãnh đạo giao lại" với nhãn. Nhiệm vụ mẫu ở hội nghị 991, tự dọn.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { E2E_TAG } from './global-setup.mjs';

const CV_ID = '00000000-0000-4000-8000-000000000016'; // demo_e2e_cv (A3, E2E_RT)
const TP_ID = '00000000-0000-4000-8000-000000000015'; // demo_e2e_tp (A2, E2E_RT) — người giao và cấp duyệt
const SO_HOI_NGHI = 991;

test.describe.serial('Từ chối nhận việc — A3 đề nghị, Trưởng phòng duyệt, nhãn chờ giao lại', () => {
  let db; let nvId; let cv; let tp;

  test.beforeAll(async ({ browser }, testInfo) => {
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('tu_choi').select('id').limit(1);
    test.skip(Boolean(co.error), 'Project chưa có migration 0034.');
    await don(db);
    const { data: hn, error: e1 } = await db.from('van_ban_giao_viec').insert({ so_hoi_nghi: SO_HOI_NGHI, so_ket_luan: `${E2E_TAG}-TC`, ngay_ban_hanh: '2026-08-01' }).select('id').single();
    if (e1) throw new Error(`Tạo văn bản mẫu thất bại: ${e1.message}`);
    const { data: nv, error: e2 } = await db.from('nhiem_vu').insert({
      van_ban_id: hn.id, nguoi_theo_doi: CV_ID, tao_boi: TP_ID, noi_dung: `${E2E_TAG} từ chối ${Date.now()}`, theo_1400: true,
      loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31', nganh_ma: 'KINH_TE_TONG_HOP', owner_don_vi_ma: 'DANG_UY_UBND', ngay_nhan_van_ban: '2026-08-05',
    }).select('id').single();
    if (e2) throw new Error(`Tạo nhiệm vụ mẫu thất bại: ${e2.message}`);
    nvId = nv.id;
    cv = await pageAs(browser, 'E2E_CV', testInfo);
    tp = await pageAs(browser, 'E2E_TP', testInfo);
  });
  test.afterAll(async () => {
    await cv?.context().close(); await tp?.context().close();
    if (db) await don(db);
  });

  test('A3: việc mới giao có nút Từ chối; lý do bắt buộc; gửi xong dòng ghi "chờ duyệt", không còn nút xác nhận', async () => {
    const dong = cv.locator(`#vct-${nvId}`);
    await expect(dong).toBeVisible();
    await expect(dong.locator('[data-action=xacNhanNhanThe]')).toBeVisible();
    await dong.locator('[data-action=moO]').click();
    const form = cv.locator(`#oTc-${nvId}`);
    await expect(form).toBeVisible();
    await form.locator('button[type=submit]').click(); // input required → trình duyệt chặn, chưa gửi
    await expect(dong).not.toHaveAttribute('data-de-nghi', '1');
    await form.locator('input[name=noi_dung]').fill('E2E: việc thuộc chuyên môn phòng khác');
    await form.locator('button[type=submit]').click();
    await expect(cv.locator(`#vct-${nvId}`)).toHaveAttribute('data-de-nghi', '1');
    await expect(cv.locator(`#vct-${nvId}`)).toContainText('chờ Demo E2E Trưởng phòng RT duyệt');
    await expect(cv.locator(`#vct-${nvId} [data-action=xacNhanNhanThe]`)).toHaveCount(0);
  });

  test('A2: khối "Đề nghị từ chối" ở đầu Phòng tôi hôm nay có lý do; Đồng ý → khối biến mất', async () => {
    await tp.locator('[data-action=loadDieuHanh]').click();
    const khoi = tp.locator('#dhTC #dhTuChoi');
    await expect(khoi).toBeVisible();
    const the = khoi.locator(`.the-con[data-nhiem-vu="${nvId}"]`);
    await expect(the).toContainText('Demo E2E Chuyên viên RT');
    await expect(the).toContainText('Lý do: E2E: việc thuộc chuyên môn phòng khác');
    await the.locator('input[name=noi_dung]').fill('Đồng ý, sẽ giao người khác');
    await the.locator('button[data-dong-y="1"]').click();
    await expect(tp.locator('#dhTC #dhTuChoi')).toHaveCount(0);
    const { data } = await db.from('nhiem_vu').select('bi_tu_choi').eq('id', nvId).single();
    expect(data.bi_tu_choi).toBe(true);
  });

  test('A3 tải lại: việc ở nhóm "Bị từ chối, chờ lãnh đạo giao lại" với nhãn; không còn ở nhóm việc mới', async () => {
    await cv.locator('[data-action=loadDieuHanh]').click();
    const muc = cv.locator('#vctMuc-tu-choi');
    await expect(muc).toBeVisible();
    await expect(muc.locator(`#vct-${nvId} .nhan-tu-choi`)).toHaveText('Đã đồng ý từ chối, chờ giao lại');
    await expect(cv.locator(`#vctMuc-moi #vct-${nvId}`)).toHaveCount(0);
  });
});

async function don(db) {
  const { data: hns } = await db.from('van_ban_giao_viec').select('id').eq('so_hoi_nghi', SO_HOI_NGHI);
  for (const h of hns || []) { await db.from('nhiem_vu').delete().eq('van_ban_id', h.id); await db.from('van_ban_giao_viec').delete().eq('id', h.id); }
}
