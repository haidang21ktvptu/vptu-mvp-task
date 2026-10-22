// v3.29 (chủ dự án 22/10/2026 — CAU-HOI O-7): mỗi chức năng một đường dẫn. Chánh VP: vào app → "/Tong-quan"; bấm menu đổi đường dẫn; Quay lại /
// Tiến tới mở đúng chức năng; tải lại giữ chức năng; gõ chữ thường → tự sửa đúng chữ hoa; thẻ Quản trị, thẻ "Nhập từ Excel" có đường dẫn riêng.
// Chuyên viên: "/Viec-cua-toi"; một lần bấm "Việc tôi theo dõi" chỉ thêm một bước lịch sử; gõ đường dẫn không thuộc vai (Báo cáo) → về trang đầu kèm
// thông báo. Bản build có chính sách nội dung (CSP) — không bị chặn nhầm (không thông báo vi phạm CSP, không lỗi chưa bắt). Chưa đăng nhập: thanh địa
// chỉ "/Dang-nhap" (gốc, chữ thường, đường dẫn chức năng), có phiên thì vào đúng chức năng đã mở (phiên đặt sẵn rồi tải lại — không tốn lượt đăng nhập,
// không đăng xuất: đăng xuất huỷ phiên dùng chung của vai). Đường dẫn tới một nhiệm vụ "…/<chức năng>/NV-…" (chủ dự án 22/10/2026 17:02): mở thẳng,
// tải lại, Đóng, Quay lại / Tiến tới, chưa đăng nhập; chuyên viên mở mã việc ngoài phạm vi → một câu chung, không mở gì (việc E2E-SEED của seed).
// Chỉ đọc.
import { test, expect } from '@playwright/test';
import { pageAs, nav, NAP, phienMoi, storageKey } from './lib/app.js';
import { dbAdmin } from './lib/pr2b.mjs';

const duong = (page) => new URL(page.url()).pathname.replace(/^.*\/vptu-mvp-task\/(staging\/)?/, '/');
const viecSeed = async (dau) => {
  const r = await dbAdmin().from('nhiem_vu').select('id, ma').like('noi_dung', `E2E-SEED ${dau}%`).limit(1).single();
  if (r.error) throw new Error(`Không thấy việc E2E-SEED "${dau}": ${r.error.message}`);
  return r.data;
};

test.describe('Đường dẫn riêng từng chức năng (v3.29)', () => {
  test('Chánh VP: menu đổi đường dẫn; Quay lại / Tiến tới; tải lại giữ chức năng; chữ thường tự sửa; CSP, không lỗi console', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true });
    // Vi phạm CSP (trình duyệt ghi "Refused to … Content Security Policy") + lỗi chưa bắt; lỗi tải tài nguyên 4xx của máy chủ dữ liệu không tính ở đây.
    const loi = []; page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) loi.push(m.text()); });
    page.on('pageerror', (e) => loi.push(e.message));
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
    await nav(page, 'navGiaoViec');
    await expect.poll(() => duong(page)).toBe('/Giao-viec');
    await page.locator('#gvTabNhap').click();
    await expect.poll(() => duong(page)).toBe('/Nhap-Excel');
    await page.reload();
    await expect(page.locator('#gvTabNhap')).toHaveAttribute('aria-selected', 'true', NAP);
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    const scriptSrc = csp.split(';').map((x) => x.trim()).find((x) => x.startsWith('script-src '));
    expect(scriptSrc, 'chỉ mã của hệ thống + mã băm đoạn nội tuyến').toMatch(/^script-src 'self'( 'sha256-[A-Za-z0-9+/=]+')*$/);
    expect(csp).toMatch(/object-src 'none'/);
    expect(await page.locator('meta[name="referrer"]').getAttribute('content')).toBe('same-origin');
    expect(loi, 'CSP không chặn nhầm, không lỗi chưa bắt').toEqual([]);
    await page.context().close();
  });

  test('Chưa đăng nhập: gốc, "/dang-nhap", "/Bao-cao" → "/Dang-nhap" (ô đăng nhập); có phiên → vào đúng "/Bao-cao" thay bước đăng nhập (không thêm bước)', async ({ browser }, testInfo) => {
    const { viewport, isMobile, hasTouch, baseURL, locale } = testInfo.project.use;
    const context = await browser.newContext({ viewport, isMobile, hasTouch, baseURL, locale });
    const page = await context.newPage();
    for (const d of ['./', './dang-nhap', './Bao-cao']) {
      await page.goto(d);
      await expect(page.locator('#loginSection')).toBeVisible();
      await expect.poll(() => duong(page), d).toBe('/Dang-nhap');
    }
    const session = await phienMoi('A1');
    await page.evaluate(([k, v]) => globalThis.localStorage.setItem(k, v), [storageKey(), JSON.stringify(session)]);
    const soBuoc = await page.evaluate(() => globalThis.history.length);
    await page.reload();   // như vừa đăng nhập: có phiên, đang ở "/Dang-nhap", chức năng đã mở nằm trong history.state
    await expect(page.locator('#viewBaoCao')).toBeVisible(NAP);
    await expect.poll(() => duong(page)).toBe('/Bao-cao');
    expect(await page.evaluate(() => globalThis.history.length), 'bước "/Dang-nhap" được thay, Quay lại không về trang đăng nhập').toBe(soBuoc);
    await nav(page, 'navTheoVanBan');
    await expect.poll(() => duong(page)).toBe('/Theo-van-ban');
    await page.goBack();
    await expect(page.locator('#viewBaoCao')).toBeVisible(NAP); expect(duong(page)).toBe('/Bao-cao');
    await context.close();
  });

  test('Đường dẫn tới một nhiệm vụ (Chánh VP): mở thẳng, Đóng, bấm dòng thêm bước, Quay lại / Tiến tới không đổi danh sách; "/Tong-quan/NV-…" mở ngăn, tải lại vẫn mở', async ({ browser }, testInfo) => {
    const v = await viecSeed('đang thực hiện, còn thời gian');
    const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true });
    const ct = page.locator(`#klChiTiet-${v.id}`);
    await page.goto(`./Nhiem-vu/${v.ma.toLowerCase()}`);
    await expect(ct).toBeVisible(NAP);
    await expect.poll(() => duong(page)).toBe(`/Nhiem-vu/${v.ma}`);
    await expect(page.locator('#klTimKiem')).toHaveValue('');   // mở theo đường dẫn: không lọc danh sách theo mã
    await ct.locator('[data-action="dongKlChiTiet"]').click();
    await expect(ct).toBeHidden(); await expect.poll(() => duong(page)).toBe('/Nhiem-vu');
    await page.locator('#klTimKiem').fill(v.ma);   // người dùng tìm rồi bấm dòng
    await page.locator(`#klRow-${v.id}`).click();
    await expect(ct).toBeVisible(NAP); await expect.poll(() => duong(page)).toBe(`/Nhiem-vu/${v.ma}`);
    await page.goBack();
    await expect(ct).toBeHidden(NAP); expect(duong(page)).toBe('/Nhiem-vu');
    await page.goForward();
    await expect(ct).toBeVisible(NAP); expect(duong(page)).toBe(`/Nhiem-vu/${v.ma}`);
    await expect(page.locator('#klTimKiem')).toHaveValue(v.ma);   // Quay lại / Tiến tới chỉ đóng / mở việc, danh sách giữ nguyên
    await expect(page.locator('#navKl')).toHaveAttribute('aria-selected', 'true');
    await page.reload();   // tải lại ở bước việc do bấm dòng: mở lại việc; Đóng lùi đúng một bước ngay trong trang (không nạp lại trang)
    await expect(ct).toBeVisible(NAP);
    await page.evaluate(() => { globalThis.vptuChuaNapLai = true; });
    await ct.locator('[data-action="dongKlChiTiet"]').click();
    await expect(ct).toBeHidden(); await expect.poll(() => duong(page)).toBe('/Nhiem-vu');
    expect(await page.evaluate(() => globalThis.vptuChuaNapLai), 'không nạp lại trang').toBe(true);
    await page.goto(`./Tong-quan/${v.ma}`);
    await expect(page.locator('#viewTongQuan')).toBeVisible(NAP);
    await expect(page.locator(`#nganCT #klChiTiet-${v.id}`)).toBeVisible(NAP);
    await page.reload();
    await expect(page.locator(`#nganCT #klChiTiet-${v.id}`)).toBeVisible(NAP); await expect.poll(() => duong(page)).toBe(`/Tong-quan/${v.ma}`);
    await page.locator('#nganCT [data-action="nganDong"]').click();
    await expect(page.locator('#nganCT')).toBeHidden(); await expect.poll(() => duong(page)).toBe('/Tong-quan');
    await page.context().close();
  });

  test('Chưa đăng nhập mở đường dẫn một việc → "/Dang-nhap"; có phiên → đúng màn và đúng việc', async ({ browser }, testInfo) => {
    const v = await viecSeed('đang thực hiện, còn thời gian');
    const { viewport, isMobile, hasTouch, baseURL, locale } = testInfo.project.use;
    const context = await browser.newContext({ viewport, isMobile, hasTouch, baseURL, locale });
    const page = await context.newPage();
    await page.goto(`./Theo-van-ban/${v.ma}`);
    await expect(page.locator('#loginSection')).toBeVisible(); await expect.poll(() => duong(page)).toBe('/Dang-nhap');
    const session = await phienMoi('A1');
    await page.evaluate(([k, val]) => globalThis.localStorage.setItem(k, val), [storageKey(), JSON.stringify(session)]);
    await page.reload();
    await expect(page.locator('#viewTheoVanBan')).toBeVisible(NAP);
    await expect(page.locator(`#nganCT #klChiTiet-${v.id}`)).toBeVisible(NAP);
    await expect.poll(() => duong(page)).toBe(`/Theo-van-ban/${v.ma}`);
    await context.close();
  });

  test('Chuyên viên mở đường dẫn một việc: việc của mình → ngăn chi tiết; việc ngoài phạm vi → một câu chung, không mở gì, bỏ mã khỏi đường dẫn', async ({ browser }, testInfo) => {
    const cuaMinh = await viecSeed('đang thực hiện, còn thời gian');
    const ngoai = await viecSeed('việc mới giao, chưa xác nhận nhận');   // chủ trì demo_e2e_kl — ngoài phạm vi của demo_cv1
    const page = await pageAs(browser, 'A3', testInfo);
    await page.goto(`./Viec-cua-toi/${ngoai.ma}`);
    await expect(page.locator('#toastContainer')).toContainText(`Không có nhiệm vụ ${ngoai.ma} trong phạm vi của đồng chí.`, NAP);
    await expect.poll(() => duong(page)).toBe('/Viec-cua-toi');
    await expect(page.locator('#nganCT')).toBeHidden();
    await expect(page.locator(`#klChiTiet-${ngoai.id}`)).toHaveCount(0);
    await page.goto(`./Viec-cua-toi/${cuaMinh.ma}`);
    await expect(page.locator(`#nganCT #klChiTiet-${cuaMinh.id}`)).toBeVisible(NAP);
    await expect.poll(() => duong(page)).toBe(`/Viec-cua-toi/${cuaMinh.ma}`);
    await page.locator('#nganCT [data-action="nganDong"]').click();
    await expect(page.locator('#nganCT')).toBeHidden(); await expect.poll(() => duong(page)).toBe('/Viec-cua-toi');
    await expect(page.locator('#viewDieuHanh')).toBeVisible();
    await page.context().close();
  });

  test('Chuyên viên: trang đầu "/Viec-cua-toi"; một bấm một bước lịch sử; đường dẫn không thuộc vai → về trang đầu, có thông báo', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A3', testInfo);
    await expect.poll(() => duong(page)).toBe('/Viec-cua-toi');
    await nav(page, 'navGiaoViec');
    await expect.poll(() => duong(page)).toBe('/Giao-viec');
    await nav(page, 'navTheoDoi');   // mở danh sách Nhiệm vụ (sáng "Việc của tôi") rồi đổi sang "Việc tôi theo dõi" — chỉ một bước
    await expect.poll(() => duong(page)).toBe('/Viec-toi-theo-doi');
    await page.goBack();
    await expect(page.locator('#viewGiaoViec')).toBeVisible(NAP); expect(duong(page)).toBe('/Giao-viec');
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
