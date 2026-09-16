// Kịch bản 10 (GĐ10 PR 10C; GĐ15 hàng 1 = bảng ngoại lệ, ô số nhóm gộp vào hàng 2): Dashboard của A1 — mọi con số bấm ra đúng danh sách (truy vết 6.3):
// ô Tổng → số dòng bảng; ô Quá hạn → chỉ dòng quá hạn; "Chưa phân loại" → số dòng bằng ô; tổng các ô nhóm hàng 2 = ô Tổng.
// Không tạo dữ liệu (dùng dữ liệu KL sẵn có trên project: bộ vàng ở staging); bỏ qua khi project chưa có module KL.
import { test, expect } from '@playwright/test';
import { pageAs } from './lib/app.js';

test.describe.serial('Kết luận BTVTU — dashboard lãnh đạo', () => {
  let page;
  test.beforeAll(async ({ browser }, testInfo) => {
    page = await pageAs(browser, 'A1', testInfo);
    await page.locator('#navKlDashboard').click();
    await expect(page.locator('#klDbTinhDen')).toContainText('Số liệu tính đến');
  });
  test.afterAll(async () => { await page?.context().close(); });

  const so = async (loc) => Number((await loc.innerText()).trim());
  const veTongQuan = async () => {
    await page.locator('#klChipLoc').getByRole('button', { name: 'Về tổng quan' }).click();
    await expect(page.locator('#klDbTinhDen')).toContainText('Số liệu tính đến');
  };

  test('tổng các ô nhóm hàng 2 = ô Tổng; ô Tổng mở danh sách có đúng số dòng', async () => {
    const tong = await so(page.locator('#klDbTinhHinh .o-so').first().locator('b'));
    const cac = page.locator('#klDbTinhHinh .o-so b');
    const n = await cac.count();
    const oTong = 0; // ô Tổng đứng đầu hàng 2
    let cong = 0;
    for (let i = 0; i < n; i++) if (i !== oTong) cong += await so(cac.nth(i));
    expect(cong).toBe(tong);
    await page.locator('#klDbTinhHinh .o-so').first().click();
    await expect(page.locator('#klBody tr[id^="klRow-"]')).toHaveCount(tong);
    await expect(page.locator('#klSo-TONG')).toHaveText(String(tong));
    await veTongQuan();
  });

  test('ô Quá hạn (nếu có) → danh sách chỉ dòng quá hạn, đúng số', async () => {
    const o = page.locator('#klDbTinhHinh .o-so.s-do').first();
    if (await o.count() === 0) return; // không có việc quá hạn trong phạm vi — ô không hiện
    const n = await so(o.locator('b'));
    await o.click();
    await expect(page.locator('#klBody tr[id^="klRow-"]')).toHaveCount(n);
    await expect(page.locator('#klBody tr[id^="klRow-"]:not([data-nhom="QUA_HAN"])')).toHaveCount(0);
    await veTongQuan();
  });

  test('"Chưa phân loại" của ngành đầu tiên → danh sách đúng số dòng, bộ lọc lĩnh vực = Chưa phân loại', async () => {
    const nut = page.locator('#klDbNganh tr.bd-chua-pl .bd-so').first();
    if (await nut.count() === 0) return;
    const n = await so(nut);
    await nut.click();
    await expect(page.locator('#klBody tr[id^="klRow-"]')).toHaveCount(n);
    await expect(page.locator('#klLocLinhVuc')).toHaveValue('CHUA_PHAN_LOAI');
    await veTongQuan();
  });

  test('sau truy vết, mục thanh bên "Kết luận BTVTU" đặt lại bộ lọc: đủ phạm vi, không còn nút Về tổng quan', async () => {
    const tong = await so(page.locator('#klDbTinhHinh .o-so').first().locator('b'));
    const o = page.locator('#klDbTinhHinh .o-so').nth(1); // một ô nhóm bất kỳ (không phải Tổng)
    if (await o.count() === 0) return;
    await o.click();
    await expect(page.locator('#klChipLoc')).toContainText('Về tổng quan');
    await page.locator('#navKl').click();
    await expect(page.locator('#klBody tr[id^="klRow-"]')).toHaveCount(tong);
    await expect(page.locator('#klChipLoc')).toBeHidden();
    await page.locator('#navKlDashboard').click();
    await expect(page.locator('#klDbTinhDen')).toContainText('Số liệu tính đến');
  });

  test('thanh theo người theo dõi: đoạn đầu tiên → danh sách đúng số dòng, có chip người theo dõi', async () => {
    const doan = page.locator('#klDbChuTri .doan').first();
    if (await doan.count() === 0) return;
    const n = await so(doan);
    await doan.click();
    await expect(page.locator('#klBody tr[id^="klRow-"]')).toHaveCount(n);
    await expect(page.locator('#klChipLoc')).toContainText('Người theo dõi:');
    await veTongQuan();
  });
});
