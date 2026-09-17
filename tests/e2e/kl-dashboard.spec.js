// Kịch bản 10 (GĐ10; giao diện v7 GĐ20): PCVP mở Nhiệm vụ — dải tổng quan bấm là lọc (truy vết 6.3): ô Tổng = số dòng; tổng các ô nhóm = ô
// Tổng; ô Quá hạn → chỉ dòng quá hạn; Báo cáo: mỗi con số bấm ra đúng danh sách có chip "Chịu trách nhiệm"; mục menu Nhiệm vụ đặt lại bộ lọc;
// Cán bộ thuộc quyền: bức tranh tải việc theo phòng. Không tạo dữ liệu (bộ vàng trên staging); bỏ qua khi project chưa có module KL.
import { test, expect } from '@playwright/test';
import { pageAs, nav, NAP } from './lib/app.js';

test.describe.serial('Nhiệm vụ, Báo cáo, Cán bộ — Phó Chánh Văn phòng', () => {
  let page;
  test.beforeAll(async ({ browser }, testInfo) => {
    page = await pageAs(browser, 'PCVP2', testInfo); // PCVP khối Quản trị: không spec nào ghi dữ liệu ở đó → bộ số ổn định khi chạy 2 worker
    await nav(page, 'navKl');
    await expect(page.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP); // danh sách đã nạp xong
  });
  test.afterAll(async () => { await page?.context().close(); });

  const so = async (loc) => Number((await loc.innerText()).trim());

  test('dải tổng quan: tổng các ô nhóm = ô Tổng = số dòng danh sách', async () => {
    const tong = await so(page.locator('#klSo-TONG'));
    await expect(page.locator('#klBody [id^="klRow-"]')).toHaveCount(tong);
    let cong = 0;
    for (const o of await page.locator('#klStats .o-so[data-nhom]:not([data-nhom=""])').all()) cong += await so(o.locator('b'));
    expect(cong).toBe(tong);
  });

  test('ô Quá hạn (nếu có) → danh sách chỉ dòng quá hạn, đúng số, mép trái đỏ trên bản build', async () => {
    const o = page.locator('#klStats [data-nhom="QUA_HAN"]');
    if (!(await o.isVisible())) return; // không có việc quá hạn trong phạm vi — ô ẩn
    const n = await so(o.locator('b'));
    await o.click();
    await expect(o).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#klBody [id^="klRow-"]')).toHaveCount(n);
    await expect(page.locator('#klBody [id^="klRow-"]:not([data-nhom="QUA_HAN"])')).toHaveCount(0);
    await expect.poll(() => page.locator('#klBody [id^="klRow-"]').first().evaluate((el) => globalThis.getComputedStyle(el).borderLeftColor))
      .toMatch(/^rgb\((212, 32, 24|168, 20, 15)\)$/); // --do / --do-dam; poll: dòng có thể vừa vẽ lại (realtime)
    await page.locator('#klStats [data-nhom=""]').click();
    await expect(o).toHaveAttribute('aria-pressed', 'false');
  });

  test('Báo cáo: số Tổng của phòng đầu tiên → hàng mở rộng đúng số việc ngay dưới dòng; Xem chi tiết → ngăn phải; không rời mục (GĐ21)', async () => {
    await nav(page, 'navBaoCao');
    await expect(page.locator('#viewBaoCao .tq .o-so').first()).toContainText('việc trong phạm vi');
    const nut = page.locator('#viewBaoCao .bang').first().locator('tbody tr.bc-hang').first().locator('td.so').first().locator('button');
    if (await nut.count() === 0) return;
    const n = await so(nut);
    await nut.click();
    await expect(page.locator('#viewBaoCao #bcMoRong .nv-dong')).toHaveCount(n);
    await expect(page.locator('#viewKl')).toBeHidden();
    await page.locator('#viewBaoCao #bcMoRong [data-action=moNganViec]').first().click();
    await expect(page.locator('#bcNgan .ngan-noi')).toBeVisible();
    await expect(page.locator('#viewBaoCao')).toBeVisible();
    await page.locator('#bcNgan [data-action=dongNganBaoCao]').click();
    await expect(page.locator('#bcNgan')).toBeHidden();
    await nut.click(); // bấm lại cùng ô → gập
    await expect(page.locator('#viewBaoCao #bcMoRong')).toHaveCount(0);
  });

  test('Cán bộ thuộc quyền: mỗi phòng một khối, mỗi người một thanh tải việc; bấm tên mở ngăn bên phải ngay trong trang (GĐ21)', async () => {
    await nav(page, 'navCanBo');
    const khoi = page.locator('#viewCanBo .cb section');
    await expect(khoi.first()).toBeVisible();
    const nguoi = page.locator('#viewCanBo .nguoi-hang').first();
    if (await nguoi.count() === 0) return;
    await expect(nguoi.locator('.tai')).toBeVisible();
    const ten = await nguoi.locator('b').first().innerText();
    await nguoi.click();
    await expect(page.locator('#cbNgan .ngan-noi')).toBeVisible();
    await expect(page.locator('#cbNgan .ngan-dau')).toContainText(ten);
    await expect(page.locator('#viewCanBo')).toBeVisible();
    await expect(page.locator('#viewKl')).toBeHidden();
    await expect(nguoi).toHaveAttribute('aria-pressed', 'true');
  });

  test('Nhiệm vụ: thanh trạng thái một hàng, ô chọn Đơn vị có đếm cùng hàng ô tìm; chọn đơn vị → danh sách đúng số dòng (GĐ21)', async () => {
    await nav(page, 'navKl');
    await expect(page.locator('#klStats')).toBeVisible();
    const cao = (await page.locator('#klStats').boundingBox()).height;
    expect(cao, 'thanh trạng thái một hàng').toBeLessThan(60);
    const chon = page.locator('#klLocDonVi');
    if (!(await chon.isVisible())) return; // phạm vi chỉ một đơn vị → ô ẩn
    const opt = chon.locator('option').nth(1);
    const n = Number((await opt.innerText()).match(/\((\d+)\)\s*$/)?.[1] || 0); // "Phòng X (n)"
    await chon.selectOption({ index: 1 });
    await expect(page.locator('#klBody [id^="klRow-"]')).toHaveCount(n);
    await chon.selectOption('');
  });
});
