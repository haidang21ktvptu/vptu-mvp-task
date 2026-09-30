// PR-2a Q7 (0052): Cập nhật nhanh của Owner / người theo dõi — việc ĐÃ có hạn không còn ô hạn (chỉ dòng "đã chốt… đề nghị gia hạn"); việc
// "Cần điền hạn" (Có hạn cụ thể, chưa có hạn) vẫn điền được hạn và lưu. Người quản trị KL không bị khoá (test RLS kl-pq-q7 phủ phía DB).
// Dữ liệu riêng: 2 việc của demo_e2e_nv theo khoá E2E-TEST-CNH-<project>; tự dọn trước và sau.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { getKeys } from './lib/keys.mjs';
import { pageAs, moViec, NAP } from './lib/app.js';
import { khoaRieng, taoVanBanRieng, donVanBan, kiemThayViec } from './lib/du-lieu.mjs';

test.describe.serial('Cập nhật nhanh: khoá hạn khi việc đã có hạn (Q7)', () => {
  let db; let khoa; let page; const v = {};

  test.beforeAll(async ({ browser }, testInfo) => {
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    khoa = khoaRieng('CNH', testInfo);
    const vb = await taoVanBanRieng(db, khoa, { loai: 'CONG_VAN', ngay_ban_hanh: '2026-08-01', ngay_nhan: '2026-08-01' });
    const { data: nv } = await db.from('accounts').select('id').eq('username', 'demo_e2e_nv').single();
    const goc = { van_ban_id: vb, loai_thoi_han_ma: 'CO_HAN_CU_THE', theo_1400: true, ngay_nhan_van_ban: '2026-08-01', ngay_nhan_uoc_tinh: false,
      owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: nv.id, nguoi_theo_doi: nv.id, san_pham_loai: 'BAO_CAO', tao_boi: nv.id };
    for (const [ten, them] of [['coHan', { han_xu_ly: '2026-12-31' }], ['canDien', { han_xu_ly: null, ly_do_chua_co_han: 'Chờ kế hoạch của tỉnh' }]]) {
      const r = await db.from('nhiem_vu').insert({ ...goc, ...them, noi_dung: `${khoa} ${ten}` }).select('id, ma').single();
      if (r.error) throw new Error(`Tạo việc mẫu: ${r.error.message}`);
      v[ten] = r.data;
      await kiemThayViec('E2E_NV', r.data.id, r.data.ma);
    }
    page = await pageAs(browser, 'E2E_NV', testInfo);
  });
  test.afterAll(async () => { await page?.context().close(); if (db) await donVanBan(db, khoa); });

  test('việc đã có hạn: không có ô hạn, chỉ dòng "đã chốt — đề nghị gia hạn"; lưu tiến độ không đổi hạn', async () => {
    await moViec(page, v.coHan.id, v.coHan.ma);
    await page.locator(`#klChiTiet-${v.coHan.id} [data-action="openKlCapNhat"]`).click();
    await expect(page.locator('#klCapNhatModal')).toBeVisible();
    await expect(page.locator('#klCnHanWrap')).toBeHidden();
    await expect(page.locator('#klCnChuaCoHanWrap')).toBeHidden();
    await expect(page.locator('#klCnHanKhoa')).toContainText('31/12/2026');
    await expect(page.locator('#klCnHanKhoa')).toContainText('đề nghị gia hạn');
    await page.locator('#klCnGhiChu').fill(`${khoa} ghi chú`);
    await page.locator('#klCnLuu').click();
    await expect(page.locator('#klCapNhatModal')).toBeHidden(NAP);
    const r = await db.from('nhiem_vu').select('han_xu_ly, ghi_chu').eq('id', v.coHan.id).single();
    expect(r.data).toEqual({ han_xu_ly: '2026-12-31', ghi_chu: `${khoa} ghi chú` });
  });

  test('việc "Cần điền hạn": ô hạn hiện, điền được và lưu', async () => {
    await moViec(page, v.canDien.id, v.canDien.ma);
    await page.locator(`#klChiTiet-${v.canDien.id} [data-action="openKlCapNhat"]`).click();
    await expect(page.locator('#klCnHanWrap')).toBeVisible();
    await expect(page.locator('#klCnHanKhoa')).toBeHidden();
    await page.locator('#klCnChuaCoHan').uncheck();
    await page.locator('#klCnHan').fill('2026-11-30');
    await page.locator('#klCnLuu').click();
    await expect(page.locator('#klCapNhatModal')).toBeHidden(NAP);
    await expect.poll(async () => (await db.from('nhiem_vu').select('han_xu_ly').eq('id', v.canDien.id).single()).data.han_xu_ly).toBe('2026-11-30');
  });
});
