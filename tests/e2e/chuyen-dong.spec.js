// v3.36 (CAU-HOI V-12; DESIGN mục 7) — chuyển động giao diện. Cả bộ e2e chạy ở chế độ giảm chuyển động (lib/devices.mjs, lib/app.js); riêng kịch bản
// này bật chuyển động để kiểm TRẠNG THÁI CUỐI sau mỗi hiệu ứng: không còn lớp tạm (cho-phien, mo-dau, dang-vao, dang-doi, dang-ra), không còn kiểu
// nội tuyến trên mục đã rời, chữ và số đủ và nhìn thấy được, dấu chọn menu nằm đúng mục; mục "Hiệu ứng chuyển động" ở bánh răng tắt được và nhớ
// theo máy. Không kiểm khung hình giữa chừng (phụ thuộc tốc độ máy). Chỉ đọc — không tạo dữ liệu.
import { test, expect } from '@playwright/test';
import { pageAs, NAP } from './lib/app.js';

const XONG = { timeout: 8_000 };   // cửa vào dài nhất 2,4 giây

test.describe('Chuyển động giao diện (v3.36)', () => {
  test('A1: mở đầu, vào trang, chuyển trang, đổi kỳ đều kết thúc sạch; tắt hiệu ứng ở bánh răng thì không còn lớp chuyển động, nhớ sau khi tải lại', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true, chuyenDong: true });
    const html = page.locator('html'); const tq = page.locator('#viewTongQuan');
    await expect(tq).toHaveAttribute('data-nap', /./, NAP);

    // Mở đầu: màn chờ và hình tròn đã xong, khung ứng dụng không còn bị cắt
    await expect(html).not.toHaveClass(/cho-phien|mo-dau/, XONG);
    await expect(page.locator('#manCho')).toBeHidden();
    expect(await page.locator('#appShell').evaluate((el) => globalThis.getComputedStyle(el).clipPath)).toBe('none');

    // Vào trang Tổng quan: cửa vào đóng; tiêu đề đủ chữ, có cụm nhấn, tên đọc được; số là chữ số thật và nhìn thấy
    await expect(tq).not.toHaveClass(/dang-vao|dang-doi/, XONG);
    const td = tq.locator('#tqTieuDe');
    await expect(td).toHaveText('Tổng quan thực hiện nhiệm vụ');
    await expect(td).toHaveAttribute('aria-label', 'Tổng quan thực hiện nhiệm vụ');
    await expect(td.locator('.nhan-td')).toHaveText('thực hiện nhiệm vụ');
    const so = await tq.evaluate((el) => [...el.querySelectorAll('#tqSo .gia')].map((g) => {
      const cs = g.querySelector('.so-lan .cs'); const kieu = cs ? globalThis.getComputedStyle(cs) : null;
      return { chu: g.textContent, hien: g.innerText, trong: kieu ? kieu.webkitTextFillColor !== kieu.color : false };
    }));
    expect(so.length, 'ba số của dải và bốn thẻ').toBe(7);
    for (const s of so) { expect(s.chu).toMatch(/^\d+$/); expect(s.hien).toBe(s.chu); expect(s.trong, `số ${s.chu} không còn bị ẩn chữ`).toBe(false); }

    // Dấu chọn menu nằm đúng mục đang chọn
    const lech = (id) => page.evaluate((i) => {
      const a = globalThis.document.getElementById('menuDau').getBoundingClientRect(); const b = globalThis.document.getElementById(i).getBoundingClientRect();
      return Math.abs(a.top - b.top) + Math.abs(a.left - b.left) + Math.abs(a.height - b.height);
    }, id);
    await expect(page.locator('#mainNav')).toHaveClass(/co-dau/);
    await expect.poll(() => lech('navTongQuan')).toBeLessThan(1.5);

    // Chuyển trang: mục cũ ẩn hẳn, không còn lớp và kiểu tạm; dấu chọn trượt tới mục mới
    await page.locator('#navKl').click();
    await expect(page.locator('#viewKl')).toBeVisible();
    await expect(tq).toBeHidden();
    await expect(tq).not.toHaveClass(/dang-ra|dang-vao/);
    expect(await tq.getAttribute('style') || '').toBe('');
    await expect(page.locator('#viewKl')).not.toHaveClass(/dang-vao/, XONG);
    await expect.poll(() => lech('navKl')).toBeLessThan(1.5);

    // Quay lại Tổng quan (vào lại: nhịp nhanh) rồi đổi kỳ: số lăn lại, kết thúc sạch
    await page.locator('#navTongQuan').click();
    await expect(tq).toBeVisible();
    await expect(tq).not.toHaveClass(/dang-vao|vao-lai/, XONG);
    await tq.locator('#tqKy [data-ky="quy"]').click();
    await expect(tq.locator('#tqKy [data-ky="quy"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(tq).not.toHaveClass(/dang-doi/, XONG);
    await expect(tq.locator('#tqSo [data-so="qh"] .gia')).toHaveText(/^\d+$/);

    // Tắt hiệu ứng ở bánh răng: không còn lớp chuyển động khi đổi mục; nhớ sau khi tải lại (không màn mở đầu hình tròn)
    await page.locator('#banhRangBtn').click();
    const muc = page.locator('#banhRangMenu [data-action="doiChuyenDong"]');
    await expect(muc).toHaveAttribute('aria-checked', 'true');
    await muc.click();
    await expect(html).toHaveAttribute('data-chuyen-dong', 'giam');
    await page.locator('#navKl').click();
    await expect(page.locator('#viewKl')).toBeVisible();
    expect(await tq.getAttribute('class'), 'mục cũ ẩn ngay, không qua lớp dang-ra').toBe('hidden');
    await expect(page.locator('#viewKl')).not.toHaveClass(/dang-/);
    await page.reload();
    await expect(page.locator('#mainHeader')).toBeVisible(NAP);
    await expect(html).toHaveAttribute('data-chuyen-dong', 'giam');
    await expect(html).not.toHaveClass(/cho-phien|mo-dau/);
    await page.locator('#banhRangBtn').click();
    await expect(page.locator('#banhRangMenu [data-action="doiChuyenDong"]')).toHaveAttribute('aria-checked', 'false');
    await page.context().close();
  });
});
