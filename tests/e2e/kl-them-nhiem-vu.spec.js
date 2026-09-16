// Kịch bản 12 (GĐ10 PR 10F, viết lại GĐ14 PR 14C): người có quan_tri_kl giao việc trên form thống nhất — văn bản mới
// (loại, số hội nghị, số hiệu, ngày BH), chịu trách nhiệm (Owner) là cán bộ → cấp nhận tự điền, thiếu sản phẩm bị chặn ngay
// ở form, đủ Owner + Product + Deadline → dòng XANH, theo_1400. Cấp cờ quan_tri_kl tạm cho demo_qtht bằng service_role, thu lại sau.
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { getKeys } from './lib/keys.mjs';
import { OPTIONAL_USERS, storageStatePath } from './lib/roles.mjs';
import { E2E_TAG } from './global-setup.mjs';

const QTHT_ID = '00000000-0000-4000-8000-000000000008';
const CV1_ID = '00000000-0000-4000-8000-000000000004';
const SO_HOI_NGHI = 995;
const homNayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

test.describe.serial('Nhiệm vụ — giao việc thống nhất (quan_tri_kl)', () => {
  let db; let page;

  test.beforeAll(async ({ browser }, testInfo) => {
    test.skip(!existsSync(storageStatePath('QTHT')), 'Chưa có demo_qtht trên project này.');
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('nhiem_vu').select('id').limit(1);
    test.skip(Boolean(co.error), 'Project chưa có migration 0023+ (thực thể thống nhất).');
    // service_role gọi giao_viec({}) → 42501 (chưa đăng nhập) khi hàm có; PGRST202 khi staging chưa có 0025 (CI của PR trước merge).
    const rpc = await db.rpc('giao_viec', { p: {} });
    test.skip(rpc.error?.code === 'PGRST202', 'Project chưa có migration 0025 (giao_viec) — chạy lại sau khi merge.');
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
  test('form: thiếu sản phẩm bị chặn; văn bản mới + Owner cán bộ + sản phẩm + hạn → dòng XANH theo 1400, cấp nhận = Trưởng phòng', async ({}, testInfo) => {
    await page.locator('#navKl').click();
    await expect(page.locator('#klNutThem')).toBeVisible();
    await expect(page.locator('#klBody tr[id^="klRow-"]').first()).toBeVisible(); // dữ liệu đã nạp
    const tong = Number(await page.locator('#klSo-TONG').innerText());
    await page.locator('#klNutThem').click();
    await expect(page.locator('#klThemModal')).toBeVisible();
    await page.locator('#klThVanBan').selectOption('__moi__');
    await expect(page.locator('#klThSoHNWrap')).toBeVisible();   // KL_BTV mặc định → có số hội nghị
    await page.locator('#klThSoHN').fill(String(SO_HOI_NGHI));
    await page.locator('#klThSoKL').fill(`${E2E_TAG}-995`);
    await page.locator('#klThNgayBH').fill('2026-09-01');
    await page.locator('#klThNoiDung').fill(`${E2E_TAG} giao việc ${testInfo.project.name} ${Date.now()}`);
    await page.locator('#klThOwner').selectOption(`tk:${CV1_ID}`);          // demo_cv1 (A3, Tổng hợp)
    await expect(page.locator('#klThCapNhan')).toHaveValue('TRUONG_PHONG'); // cấp trên Owner tự điền
    await expect(page.locator('#klThNgayNhan')).toHaveValue(homNayVN());   // ngày nhận mặc định hôm nay VN
    await page.locator('#klThNganh').selectOption('KINH_TE_TONG_HOP');
    await page.locator('#klThLinhVuc').selectOption('LV08_TAI_CHINH');
    await page.locator('#klThHan').fill('2026-12-31');
    await page.locator('#klThLuu').click();
    await expect(page.locator('#toastContainer')).toContainText('sản phẩm đầu ra');
    await expect(page.locator('#klThemModal')).toBeVisible();
    await page.locator('#klThSanPham').selectOption('TO_TRINH');
    await page.locator('#klThSanPhamMoTa').fill('Tờ trình thử nghiệm e2e');
    await page.locator('#klThLuu').click();
    await expect(page.locator('#klThemModal')).toBeHidden();
    await expect(page.locator('#toastContainer')).toContainText('Đã giao việc NV-');
    await expect(page.locator('#klSo-TONG')).toHaveText(String(tong + 1));
    const { data } = await db.from('nhiem_vu').select('id, ma, nguon, theo_1400, owner_tai_khoan, owner_don_vi_ma, san_pham_loai, cap_nhan_san_pham, ngay_nhan_van_ban, ngay_nhan_uoc_tinh, nguoi_theo_doi, tao_boi')
      .like('noi_dung', `${E2E_TAG} giao việc%`).order('created_at', { ascending: false }).limit(1).single();
    expect(data).toMatchObject({ nguon: 'app', theo_1400: true, owner_tai_khoan: CV1_ID, owner_don_vi_ma: 'TONG_HOP', san_pham_loai: 'TO_TRINH',
      cap_nhan_san_pham: 'TRUONG_PHONG', ngay_nhan_van_ban: homNayVN(), ngay_nhan_uoc_tinh: false, nguoi_theo_doi: QTHT_ID, tao_boi: QTHT_ID });
    const row = page.locator(`#klRow-${data.id}`);
    await expect(row).toHaveAttribute('data-muc', 'XANH');
    await expect(row).toHaveAttribute('data-nhom', 'DANG_THUC_HIEN');
    await expect(row.locator('.cham-xanh')).toHaveCount(1);
    // Màu tính toán trên bản build (Tailwind cắt lớp không thấy nguyên văn) — chấm xanh phải có nền, không trong suốt.
    const nen = await row.locator('.cham-xanh').evaluate((el) => globalThis.getComputedStyle(el).backgroundColor);
    expect(nen).not.toBe('rgba(0, 0, 0, 0)');
    await expect(row).toContainText('Tờ trình');
  });

  test('Ký ban hành: hạn tự tính = ngày BH + 10, ô hạn khoá; văn bản vừa tạo có trong danh sách chọn', async () => {
    // demo_qtht là A3 và là người theo dõi của việc vừa giao → modal bắt buộc xác nhận (GĐ14) hiện; 'Để sau' rồi mở form.
    if (await page.locator('#mandatoryAcceptModal').isVisible()) await page.locator('#btnDeSau').click();
    await page.locator('#klNutThem').click();
    const vb = await db.from('van_ban_giao_viec').select('id').eq('so_hoi_nghi', SO_HOI_NGHI).single();
    await page.locator('#klThVanBan').selectOption(vb.data.id);
    await page.locator('#klThLoai').selectOption('KY_BAN_HANH');
    await expect(page.locator('#klThHan')).toBeDisabled();
    await expect(page.locator('#klThHan')).toHaveValue('2026-09-11');
    await page.locator('#klThemModal').getByRole('button', { name: 'Huỷ' }).click();
  });
});

async function don(db) {
  const { data } = await db.from('van_ban_giao_viec').select('id').eq('so_hoi_nghi', SO_HOI_NGHI);
  for (const h of data || []) {
    await db.from('nhiem_vu').delete().eq('van_ban_id', h.id);
    await db.from('van_ban_giao_viec').delete().eq('id', h.id);
  }
}
