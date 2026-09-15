// Kịch bản 12 (GĐ10 PR 10F): người có quan_tri_kl thêm nhiệm vụ KL mới trên form — hội nghị mới (số, số KL, ngày BH),
// ngành → lĩnh vực khoá theo ngành và bắt buộc, chủ trì bắt buộc, hạn ≥ ngày BH; lưu → dòng xuất hiện với mã NV-xxx.
// Chuyên viên thường không thấy nút. Cấp cờ quan_tri_kl tạm cho demo_qtht bằng service_role (như tests/rls), thu lại sau.
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { getKeys } from './lib/keys.mjs';
import { OPTIONAL_USERS, storageStatePath } from './lib/roles.mjs';
import { E2E_TAG } from './global-setup.mjs';

const QTHT_ID = '00000000-0000-4000-8000-000000000008';
const SO_HOI_NGHI = 995;

test.describe.serial('Kết luận BTVTU — thêm nhiệm vụ mới (quan_tri_kl)', () => {
  let db; let page;

  test.beforeAll(async ({ browser }, testInfo) => {
    test.skip(!existsSync(storageStatePath('QTHT')), 'Chưa có demo_qtht trên project này.');
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('kl_nhiem_vu').select('id').limit(1);
    test.skip(Boolean(co.error), 'Project chưa có module KL (0014+).');
    await don(db);
    await db.from('accounts').update({ quan_tri_kl: true }).eq('id', QTHT_ID);
    const { viewport, isMobile, hasTouch, baseURL, locale } = testInfo.project.use;
    const context = await browser.newContext({ viewport, isMobile, hasTouch, baseURL, locale, storageState: storageStatePath('QTHT') });
    page = await context.newPage();
    await page.goto('./');
    await expect(page.locator('#currentUserDisplay')).toContainText(OPTIONAL_USERS.QTHT.fullName);
  });
  test.afterAll(async () => {
    await page?.context().close();
    if (db) { await don(db); await db.from('accounts').update({ quan_tri_kl: false }).eq('id', QTHT_ID); }
  });

  // eslint-disable-next-line no-empty-pattern
  test('form: thiếu lĩnh vực bị chặn; hội nghị mới + đủ trường → lưu, dòng NV mới xuất hiện, ô Tổng +1', async ({}, testInfo) => {
    await page.locator('#navKl').click();
    await expect(page.locator('#klNutThem')).toBeVisible();
    await expect(page.locator('#klBody tr[id^="klRow-"]').first()).toBeVisible(); // dữ liệu đã nạp
    const tong = Number(await page.locator('#klSo-TONG').innerText());
    await page.locator('#klNutThem').click();
    await expect(page.locator('#klThemModal')).toBeVisible();
    await page.locator('#klThHoiNghi').selectOption('__moi__');
    await page.locator('#klThSoHN').fill(String(SO_HOI_NGHI));
    await page.locator('#klThSoKL').fill(`${E2E_TAG}-995`);
    await page.locator('#klThNgayBH').fill('2026-09-01');
    await page.locator('#klThNoiDung').fill(`${E2E_TAG} thêm mới ${testInfo.project.name} ${Date.now()}`);
    await page.locator('#klThChuTri').selectOption('00000000-0000-4000-8000-000000000004'); // demo_cv1
    await page.locator('#klThNganh').selectOption('KINH_TE_TONG_HOP');
    await page.locator('#klThHan').fill('2026-12-31');
    await page.locator('#klThLuu').click();
    await expect(page.locator('#toastContainer')).toContainText('Chọn lĩnh vực');
    await page.locator('#klThLinhVuc').selectOption('LV08_TAI_CHINH');
    await page.locator('#klThLuu').click();
    await expect(page.locator('#klThemModal')).toBeHidden();
    await expect(page.locator('#toastContainer')).toContainText('Đã thêm NV-');
    await expect(page.locator('#klSo-TONG')).toHaveText(String(tong + 1));
    const { data } = await db.from('kl_nhiem_vu').select('ma, nguon, linh_vuc_ma, tao_boi').like('noi_dung', `${E2E_TAG} thêm mới%`).order('created_at', { ascending: false }).limit(1).single();
    expect(data.nguon).toBe('app'); expect(data.linh_vuc_ma).toBe('LV08_TAI_CHINH'); expect(data.tao_boi).toBe(QTHT_ID);
    await expect(page.locator('#klBody td.tieude').filter({ hasText: data.ma })).toHaveCount(1);
  });

  test('Ký ban hành: hạn tự tính = ngày BH + 10, ô hạn khoá', async () => {
    await page.locator('#klNutThem').click();
    const hn = await db.from('kl_hoi_nghi').select('id').eq('so_hoi_nghi', SO_HOI_NGHI).single();
    await page.locator('#klThHoiNghi').selectOption(hn.data.id);
    await page.locator('#klThLoai').selectOption('KY_BAN_HANH');
    await expect(page.locator('#klThHan')).toBeDisabled();
    await expect(page.locator('#klThHan')).toHaveValue('2026-09-11');
    await page.locator('#klThemModal').getByRole('button', { name: 'Huỷ' }).click();
  });
});

async function don(db) {
  const { data } = await db.from('kl_hoi_nghi').select('id').eq('so_hoi_nghi', SO_HOI_NGHI);
  for (const h of data || []) {
    await db.from('kl_nhiem_vu').delete().eq('hoi_nghi_id', h.id);
    await db.from('kl_hoi_nghi').delete().eq('id', h.id);
  }
}
