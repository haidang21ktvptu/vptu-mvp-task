// v3.24 (0104): Quản trị › Thống kê sử dụng — chỉ tài khoản quản trị hệ thống (Chánh VP không có tab); bảng đăng nhập có dòng của chính
// mình sau khi vào app (ghi_nhan_dang_nhap), lọc bằng dải số, mở từng lần đăng nhập, xem theo thời gian; nhiệm vụ nhập mới theo ngày / tháng,
// bấm cột mở danh sách của kỳ. Màn Nhiệm vụ: mặc định Mới nhập trước (data-tao giảm dần theo phút), Hạn gần trước (đang mở có hạn → chưa có
// hạn → đã xong), bộ lọc chi tiết "Nhập hôm nay" + Xoá bộ lọc. Không ghi dữ liệu nghiệp vụ. Tự bỏ qua khi thiếu demo_qtht / migration 0104.
import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs, contextAs, nav, NAP } from './lib/app.js';
import { OPTIONAL_USERS, storageStatePath } from './lib/roles.mjs';
import { getKeys } from './lib/keys.mjs';
import { homNayVN } from '../../frontend/src/lib/kl/ngay.js';

const dbAdmin = () => { const k = getKeys(); return createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } }); };

// Mở app bằng phiên demo_qtht và chờ lượt ghi nhật ký đăng nhập của lần vào này xong (để bảng thống kê chắc có dòng của mình).
async function pageAsQtht(browser, testInfo) {
  const page = await (await contextAs(browser, 'QTHT', testInfo)).newPage();
  const ghi = page.waitForResponse((r) => r.url().includes('/rest/v1/rpc/ghi_nhan_dang_nhap'), NAP);
  await page.goto('./');
  await expect(page.locator('#currentUserDisplay')).toContainText(OPTIONAL_USERS.QTHT.fullName);
  await ghi;
  return page;
}
// Chờ một lượt vẽ MỚI của bảng (data-nap đổi so với trước khi bấm).
async function choVeLai(loc, cu) {
  if (cu) await expect(loc).not.toHaveAttribute('data-nap', cu, NAP);
  await expect(loc).toHaveAttribute('data-nap', /./, NAP);
}

test.describe('Thống kê sử dụng — quản trị hệ thống', () => {
  let qthtId = null; let coBang = false;
  test.beforeAll(async () => {
    coBang = !(await dbAdmin().from('nhat_ky_dang_nhap').select('id').limit(1)).error;
    qthtId = (await dbAdmin().from('accounts').select('id').eq('username', 'demo_qtht').maybeSingle()).data?.id || null;
  });
  test.beforeEach(() => {
    test.skip(!coBang, 'Chưa có migration 0104 trên project này — chạy sau khi merge.');
    test.skip(!existsSync(storageStatePath('QTHT')) || !qthtId, 'Chưa có demo_qtht trên project này.');
  });

  test('Chánh Văn phòng (không giữ quyền quản trị hệ thống) không có tab, không có mục bánh răng Thống kê sử dụng', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A1', testInfo);   // Chánh VP vào Quản trị từ menu bánh răng (không có mục Quản trị trên menu)
    await page.locator('#banhRangBtn').click();
    await expect(page.locator('#banhRangMenu')).not.toContainText('Thống kê sử dụng');
    await page.locator('#banhRangMenu [data-action="openQuanTri"][data-tab="qtKhuPhuTrach"]').click();
    await expect(page.locator('#viewQuanTri')).toBeVisible();
    await expect(page.locator('#qtTabThongKe')).toBeHidden();
    await page.context().close();
  });

  test('Đăng nhập: có dòng của chính mình (≥ 1 lần), lọc "chưa đăng nhập", mở từng lần đăng nhập, xem theo thời gian', async ({ browser }, testInfo) => {
    const page = await pageAsQtht(browser, testInfo);
    await nav(page, 'navQuanTri');
    await page.locator('#qtTabThongKe').click();
    await expect(page.locator('#qtKhuThongKe')).toBeVisible();
    const body = page.locator('#tkDnBody');
    await expect(body).toHaveAttribute('data-nap', /./, NAP);
    const minh = body.locator(`tr[data-tai-khoan="${qthtId}"]`);
    await expect(minh.locator('.tk-so-lan')).toBeVisible();
    expect(Number(await minh.locator('.tk-so-lan').innerText())).toBeGreaterThanOrEqual(1);
    await expect(minh).toContainText('Chrome');   // thiết bị gần nhất đọc từ user-agent của trình duyệt kiểm thử

    await page.locator('[data-action="tkDnLoc"][data-loc="chua"]').click();
    await expect(page.locator('[data-action="tkDnLoc"][data-loc="chua"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(minh).toHaveCount(0);
    await page.locator('[data-action="tkDnLoc"][data-loc="tat"]').click();

    await minh.locator('button.tk-ten').click();
    await expect(body.locator('.tk-phien tbody tr').first()).toBeVisible(NAP);

    const cu = await body.getAttribute('data-nap');
    await page.locator('[data-action="tkDnXem"][data-xem="thoi-gian"]').click();
    await choVeLai(body, cu);
    await expect(body.locator(`tr[data-tai-khoan="${qthtId}"]`).first()).toBeVisible();
    await page.context().close();
  });

  test('Nhiệm vụ nhập mới: 14 ngày mặc định, đổi sang tháng (12 cột), bấm cột mở danh sách của kỳ', async ({ browser }, testInfo) => {
    const page = await pageAsQtht(browser, testInfo);
    await nav(page, 'navQuanTri');
    await page.locator('#qtTabThongKe').click();
    const ct = page.locator('#tkNmCtBody');
    await page.locator('#tkNutNhapMoi').click();
    await expect(page.locator('#tkPhanNhapMoi')).toBeVisible();
    await expect(ct).toHaveAttribute('data-nap', /./, NAP);
    await expect(page.locator('#tkNmBieu .nhom-cot')).toHaveCount(14);

    let cu = await ct.getAttribute('data-nap');
    await page.locator('[data-action="tkNmDonVi"][data-don-vi="thang"]').click();
    await choVeLai(ct, cu);
    await expect(page.locator('#tkNmBieu .nhom-cot')).toHaveCount(12);
    await expect(page.locator('#tkNmDonViChu')).toHaveText('tháng');

    cu = await ct.getAttribute('data-nap');
    await page.locator('#tkNmBieu .nhom-cot').last().click();
    await choVeLai(ct, cu);
    await expect(page.locator('#tkNmBieu .nhom-cot').last()).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tkNmCtTieuDe')).toContainText('tháng');
    await page.context().close();
  });
});

test.describe('Nhiệm vụ: thứ tự và bộ lọc chi tiết (v3.24)', () => {
  test('mặc định Mới nhập trước; Hạn gần trước; lọc Nhập hôm nay rồi Xoá bộ lọc', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A1', testInfo);   // Chánh Văn phòng: thấy mọi việc
    await nav(page, 'navKl');
    await expect(page.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP);
    await expect(page.locator('#klSapXep [data-sx="moi"]')).toHaveAttribute('aria-pressed', 'true');
    const phut = (await page.$$eval('#klBody .hang-nv', (ds) => ds.map((el) => el.dataset.tao))).map((t) => Math.floor(Date.parse(t) / 60000));
    for (let i = 1; i < phut.length; i++) expect(phut[i], `dòng ${i + 1} nhập sau dòng trên`).toBeLessThanOrEqual(phut[i - 1]);

    await page.locator('#klSapXep [data-sx="han"]').click();
    await expect(page.locator('#klSapXep [data-sx="han"]')).toHaveAttribute('aria-pressed', 'true');
    const khoa = (await page.$$eval('#klBody .hang-nv', (ds) => ds.map((el) => [el.dataset.nhom, el.dataset.han])))
      .map(([nhom, han]) => [['HOAN_THANH', 'THUONG_XUYEN'].includes(nhom) ? 1 : 0, han ? 0 : 1, han || '']);
    const truoc = (a, b) => a[0] - b[0] || a[1] - b[1] || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0);
    for (let i = 1; i < khoa.length; i++) expect(truoc(khoa[i - 1], khoa[i]), `dòng ${i + 1} theo hạn`).toBeLessThanOrEqual(0);

    await page.locator('.kl-them summary').click();
    await page.locator('#klLocNhap').selectOption('hom-nay');
    await expect(page.locator('#klSoLocThem')).toContainText('1 đang áp dụng');
    await expect(page.locator('#klXoaLoc')).toBeVisible();
    const homNay = homNayVN();
    const ngay = await page.$$eval('#klBody .hang-nv', (ds) => ds.map((el) => el.dataset.tao));
    for (const t of ngay) expect(homNayVN(new Date(t)), 'chỉ việc nhập hôm nay').toBe(homNay);
    await page.locator('#klXoaLoc').click();
    await expect(page.locator('#klLocNhap')).toHaveValue('');
    await expect(page.locator('#klXoaLoc')).toBeHidden();
    await page.context().close();
  });
});
