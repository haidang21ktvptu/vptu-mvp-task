// Kịch bản 4–6 (SPEC GĐ4): A2 giao việc → A3 tiếp nhận + nộp minh chứng → A2 duyệt hoàn thành.
// Chạy tuần tự trong một project; nhiệm vụ đặt tên E2E-TEST để global-setup dọn lần sau.
import { test, expect } from '@playwright/test';
import { loginAs, logout, openA2TrackingTab } from './lib/app.js';
import { E2E_TAG } from './global-setup.mjs';

function deadlineInDays(days) {
  const d = new Date(Date.now() + days * 86400000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

test.describe.serial('Luồng giao việc → tiếp nhận → nộp minh chứng → duyệt', () => {
  let title;

  test.beforeAll((_fixtures, testInfo) => {
    title = `${E2E_TAG} ${testInfo.project.name} ${Date.now()}`;
  });

  test('Kịch bản 4: A2 giao việc cho chuyên viên trong phòng', async ({ page }) => {
    await loginAs(page, 'A2');
    await page.locator('#tabBtnGiaoViec').click();
    await page.locator('#taskTitle').fill(title);
    await page.locator('#taskResCode').fill('NQ 57-NQ/TW');
    await page.locator('#taskAssignSelect').selectOption({ label: 'Demo Chuyên viên Một (Chuyên viên)' });
    await page.locator('#taskProduct').fill('Báo cáo tham mưu (e2e)');
    await page.locator('#taskDeadline').fill(deadlineInDays(3));
    await page.locator('#formGiaoViec button[type=submit]').click();

    await expect(page.locator('#toastContainer')).toContainText('Đã phát hành giao việc cho cán bộ thành công!');
    await expect(page.locator('#tabContentTheoDoi')).toBeVisible();
    const row = page.locator('#trackingTableBody tr', { hasText: title });
    await expect(row).toContainText('Chờ nhận việc');
    await expect(row).toContainText('Demo Chuyên viên Một');
    await logout(page);
  });

  test('Kịch bản 5: A3 bắt buộc tiếp nhận rồi nộp minh chứng', async ({ page }) => {
    await loginAs(page, 'A3');
    const modal = page.locator('#mandatoryAcceptModal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#mandatoryTaskTitle')).toHaveText(title);
    await expect(page.locator('#mandatoryTaskProduct')).toHaveText('Báo cáo tham mưu (e2e)');

    await page.locator('#btnAcceptTask').click();
    await expect(page.locator('#toastContainer')).toContainText('Đã tiếp nhận nhiệm vụ thành công!');
    await expect(modal).toBeHidden();

    const row = page.locator('#chuyenVienTableBody tr', { hasText: title });
    await expect(row).toContainText('Đang thực hiện');
    await row.getByRole('button', { name: 'Nộp Minh Chứng' }).click();
    await expect(page.locator('#evidenceModal')).toBeVisible();

    // TASK-7: đường dẫn phải là http/https — thử sai trước.
    await page.locator('#evidenceTitle').fill('Báo cáo số 15/BC-VPTU (e2e)');
    await page.locator('#evidenceLink').fill('ftp://khong-hop-le');
    await page.getByRole('button', { name: 'Gửi Duyệt' }).click();
    await expect(page.locator('#toastContainer')).toContainText('phải bắt đầu bằng http:// hoặc https://');

    await page.locator('#evidenceLink').fill('https://example.org/bao-cao-15.pdf');
    await page.getByRole('button', { name: 'Gửi Duyệt' }).click();
    await expect(page.locator('#toastContainer')).toContainText('Đã nộp minh chứng thành công!');
    await expect(page.locator('#evidenceModal')).toBeHidden();
    await expect(row).toContainText('Chờ duyệt');
    await logout(page);
  });

  test('Kịch bản 6: A2 duyệt minh chứng → nhiệm vụ hoàn thành', async ({ page }) => {
    await loginAs(page, 'A2');
    await openA2TrackingTab(page);
    const approvalRow = page.locator('#approvalTableBody tr', { hasText: title });
    await expect(approvalRow).toContainText('Demo Chuyên viên Một');
    await expect(approvalRow.locator('a')).toHaveAttribute('href', 'https://example.org/bao-cao-15.pdf');

    await approvalRow.getByRole('button', { name: 'Duyệt Đóng Việc' }).click();
    await expect(page.locator('#toastContainer')).toContainText('Nhiệm vụ đã HOÀN THÀNH!');
    await expect(page.locator('#approvalTableBody')).not.toContainText(title);
    await expect(page.locator('#trackingTableBody tr', { hasText: title })).toContainText('Đã Hoàn Thành');

    // Tab KPI phòng: cán bộ có ít nhất 1 việc hoàn thành.
    await page.locator('#tabBtnKPI').click();
    const kpiRow = page.locator('#a2KpiTableBody tr', { hasText: 'Demo Chuyên viên Một' }).first();
    await expect(kpiRow.locator('td').nth(6)).not.toHaveText('0');
    await logout(page);
  });
});
