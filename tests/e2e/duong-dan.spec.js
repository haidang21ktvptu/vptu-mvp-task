// v3.29 (chủ dự án 22/10/2026 — CAU-HOI O-7): mỗi chức năng một đường dẫn. Chánh VP: vào app → "/Tong-quan"; bấm menu đổi đường dẫn; Quay lại /
// Tiến tới mở đúng chức năng; tải lại giữ chức năng; gõ chữ thường → tự sửa đúng chữ hoa; thẻ Quản trị có đường dẫn riêng. Chuyên viên: "/Viec-cua-toi";
// gõ đường dẫn không thuộc vai (Báo cáo) → về trang đầu kèm thông báo. Bản build có chính sách nội dung (CSP) và không lỗi console. Chỉ đọc.
import { test, expect } from '@playwright/test';
import { pageAs, nav, NAP } from './lib/app.js';

const duong = (page) => new URL(page.url()).pathname.replace(/^.*\/vptu-mvp-task\/(staging\/)?/, '/');

test.describe('Đường dẫn riêng từng chức năng (v3.29)', () => {
  test('Chánh VP: menu đổi đường dẫn; Quay lại / Tiến tới; tải lại giữ chức năng; chữ thường tự sửa; CSP, không lỗi console', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true });
    const loi = []; page.on('console', (m) => { if (m.type() === 'error') loi.push(m.text()); }); page.on('pageerror', (e) => loi.push(e.message));
    await expect(page.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
    await expect.poll(() => duong(page)).toBe('/Tong-quan');
    await nav(page, 'navBaoCao');
    await expect(page.locator('#viewBaoCao')).toBeVisible(); await expect.poll(() => duong(page)).toBe('/Bao-cao');
    await nav(page, 'navTheoVanBan');
    await expect.poll(() => duong(page)).toBe('/Theo-van-ban');
    await page.goBack();
    await expect(page.locator('#viewBaoCao')).toBeVisible(); await expect(page.locator('#navBaoCao')).toHaveAttribute('aria-selected', 'true');
    expect(duong(page)).toBe('/Bao-cao');
    await page.goBack();
    await expect(page.locator('#viewTongQuan')).toBeVisible(); expect(duong(page)).toBe('/Tong-quan');
    await page.goForward();
    await expect(page.locator('#viewBaoCao')).toBeVisible();
    await page.reload();
    await expect(page.locator('#viewBaoCao')).toBeVisible(NAP); expect(duong(page)).toBe('/Bao-cao');
    await page.goto('./can-bo');
    await expect(page.locator('#viewCanBo')).toBeVisible(NAP); await expect.poll(() => duong(page)).toBe('/Can-bo');
    await page.goto('./Quan-tri/Ngay-nghi');
    await expect(page.locator('#viewQuanTri')).toBeVisible(NAP);
    await expect(page.locator('#qtTabNgayNghi')).toHaveAttribute('aria-selected', 'true');
    await page.locator('#qtTabCauHinh').click();
    await expect.poll(() => duong(page)).toBe('/Quan-tri/Nguong-canh-bao');
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toMatch(/script-src 'self'(;|$)/); expect(csp).toMatch(/object-src 'none'/);
    expect(await page.locator('meta[name="referrer"]').getAttribute('content')).toBe('same-origin');
    expect(loi, 'không lỗi console (kể cả chặn nhầm của CSP)').toEqual([]);
    await page.context().close();
  });

  test('Chuyên viên: trang đầu "/Viec-cua-toi"; đường dẫn không thuộc vai → về trang đầu, có thông báo', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A3', testInfo);
    await expect.poll(() => duong(page)).toBe('/Viec-cua-toi');
    await page.goto('./Bao-cao');
    await expect(page.locator('#viewDieuHanh')).toBeVisible(NAP);
    await expect(page.locator('#viewBaoCao')).toBeHidden();
    await expect(page.locator('#toastContainer')).toContainText('không thuộc chức năng của tài khoản đồng chí');
    await expect.poll(() => duong(page)).toBe('/Viec-cua-toi');
    await page.goto('./khong-co-trang-nay');
    await expect(page.locator('#viewDieuHanh')).toBeVisible(NAP); await expect.poll(() => duong(page)).toBe('/Viec-cua-toi');
    await page.context().close();
  });
});
