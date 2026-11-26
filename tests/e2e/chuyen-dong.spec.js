// v3.36 (CAU-HOI V-12; DESIGN mục 7) — chuyển động giao diện. Cả bộ e2e chạy ở chế độ giảm chuyển động (lib/devices.mjs, lib/app.js); riêng kịch bản
// này bật chuyển động để kiểm TRẠNG THÁI CUỐI sau mỗi hiệu ứng: không còn lớp tạm (cho-phien, mo-dau, dang-vao, dang-doi, dang-ra), không còn kiểu
// nội tuyến trên mục đã rời, chữ và số đủ và nhìn thấy được, dấu chọn menu nằm đúng mục; mục "Hiệu ứng chuyển động" ở bánh răng tắt được và nhớ
// theo máy. Không kiểm khung hình giữa chừng (phụ thuộc tốc độ máy). Chỉ đọc — không tạo dữ liệu.
// Phần 2 (các màn khác): bản dựng thật giữ đủ khai báo @keyframes (Tailwind không cắt) và hiệu ứng thật sự chạy khi vào mục; Nhiệm vụ, Cần xử lý,
// Nhiệm vụ quý, ngăn chi tiết: vào lần đầu và vào lại (nội dung lượt trước đang hiện, số liệu mới về sau) đều kết thúc sạch — không còn lớp tạm,
// không còn nội dung bị giữ yên (cd-tinh), số là chữ số thật, số dòng khớp.
import { test, expect } from '@playwright/test';
import { pageAs, nav, NAP } from './lib/app.js';

const XONG = { timeout: 8_000 };   // cửa vào dài nhất 2,4 giây, chờ thêm tối đa 1,8 giây khi hiệu ứng còn chạy

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

  test('A1: bản dựng đủ hiệu ứng; Nhiệm vụ, Cần xử lý, Nhiệm vụ quý, ngăn chi tiết vào lần đầu và vào lại đều kết thúc sạch, số liệu đủ', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true, chuyenDong: true });
    const tq = page.locator('#viewTongQuan'); const kl = page.locator('#viewKl'); const dh = page.locator('#viewDieuHanh'); const nvq = page.locator('#viewNvq');
    await expect(tq).toHaveAttribute('data-nap', /./, NAP);
    await expect(tq).not.toHaveClass(/dang-vao/, XONG);
    const soTinh = () => page.evaluate(() => globalThis.document.querySelectorAll('.cd-tinh').length);
    const soHien = (vung) => vung.evaluate((el) => [...el.querySelectorAll('.so-lan')].filter((x) => x.getClientRects().length).map((x) => {
      const cs = x.querySelector('.cs'); const kieu = cs ? globalThis.getComputedStyle(cs) : null;
      return { chu: x.textContent, an: kieu ? kieu.webkitTextFillColor !== kieu.color : false };
    }));

    // Bản dựng thật giữ đủ khai báo hiệu ứng (kể cả khai báo nằm trong khối lồng)
    const khung = await page.evaluate(() => {
      const ra = new Set();
      const quet = (ds) => { for (const r of ds) { if (r.type === globalThis.CSSRule.KEYFRAMES_RULE) ra.add(r.name); else if (r.cssRules) quet(r.cssRules); } };
      for (const tep of globalThis.document.styleSheets) { try { quet(tep.cssRules); } catch { /* tệp kiểu khác nguồn */ } }
      return [...ra];
    });
    for (const ten of ['cd-hien', 'cd-len', 'cd-mo', 'cd-chu', 'cd-lan', 'cd-so-an', 'cd-so-hien', 'cd-quet', 'cd-ve', 'cd-roi', 'cd-tron', 'cd-noi', 'cd-ngan']) expect(khung, `@keyframes ${ten}`).toContain(ten);

    // Nhiệm vụ, lần đầu: cửa vào mở và hiệu ứng thật sự chạy; nạp xong thì đủ dòng, số của dải là chữ số thật, kết thúc sạch
    // (bấm và đọc trong cùng một lượt lệnh của trang: bộ điều phối hành động chạy đồng bộ nên kết quả không phụ thuộc tốc độ máy)
    const bamVaDoc = (id) => page.evaluate((i) => {
      globalThis.document.getElementById(i).click();
      const v = globalThis.document.getElementById('viewKl');
      return { lop: v.className, chay: v.getAnimations({ subtree: true }).length, dong: v.querySelectorAll('#klBody .hang-nv').length };
    }, id);
    const luc = await bamVaDoc('navKl');
    expect(luc.lop).toContain('dang-vao'); expect(luc.chay, 'có hiệu ứng đang chạy trong mục vừa vào').toBeGreaterThan(0);
    const dong = () => page.evaluate(() => { const b = globalThis.document.getElementById('klBody'); return { hien: Number(b.dataset.soHien), dong: b.querySelectorAll('.hang-nv').length }; });
    await expect(page.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP);
    await expect(kl).not.toHaveClass(/dang-vao/, XONG);
    let d = await dong(); expect(d.dong).toBe(d.hien);
    await expect(page.locator('#klSo-TONG')).toHaveText(/^\d+$/);
    for (const x of await soHien(kl)) { expect(x.chu).toMatch(/^\d+$/); expect(x.an, `số ${x.chu} không còn bị ẩn chữ`).toBe(false); }
    expect(await soTinh()).toBe(0);

    // Nhiệm vụ, vào lại: dòng của lượt trước hiện ngay với nhịp vào lại; lượt nạp nền vẽ lại sau khi hiệu ứng xong; kết thúc sạch, số dòng khớp
    await page.locator('#navTongQuan').click();
    await expect(tq).toBeVisible();
    const lai = await bamVaDoc('navKl');
    expect(lai.lop).toContain('vao-lai');
    if (d.dong) expect(lai.dong, 'dòng của lượt trước hiện ngay, không chờ nạp').toBeGreaterThan(0);
    await expect(page.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP);
    await expect(kl).not.toHaveClass(/dang-vao/, XONG);
    d = await dong(); expect(d.dong).toBe(d.hien);
    expect(await soTinh()).toBe(0);

    // Cần xử lý: lần đầu rồi vào lại; hai con số của ba câu hỏi là chữ số thật
    for (const lan of [1, 2]) {
      await page.locator('#navDieuHanh').click();
      await expect(dh.locator('#dhBaCau .ba-cau')).toBeVisible(NAP);
      await expect(dh.locator('#dhTinhDen')).toContainText('số liệu lúc', NAP);
      await expect(dh).not.toHaveClass(/dang-vao/, XONG);
      const so = await dh.locator('#dhBaCau .bc-chinh b').allTextContents();
      expect(so.length, `lần ${lan}: hai con số của ba câu hỏi`).toBe(2);
      for (const x of so) expect(x).toMatch(/^\d+$/);
      for (const x of await soHien(dh)) expect(x.an, `số ${x.chu} không còn bị ẩn chữ`).toBe(false);
      expect(await soTinh()).toBe(0);
      if (lan === 1) { await page.locator('#navTongQuan').click(); await expect(tq).toBeVisible(); }
    }

    // Nhiệm vụ quý: Tổng quan quý (lần nạp đầu) → Danh mục (vẽ ngay từ số liệu đang có) → Tổng quan quý (vào lại)
    await nav(page, 'navNqTongQuan');
    await expect(nvq.locator('.dau h1')).toContainText('Tổng quan nhiệm vụ quý', NAP);
    await expect(nvq).not.toHaveClass(/dang-vao/, XONG);
    await nav(page, 'navNqDanhMuc');
    await expect(nvq.locator('.dau h1')).toContainText('Danh mục nhiệm vụ quý');
    expect(await nvq.getAttribute('data-cd-tu'), 'màn chỉ xem đã có số liệu: cửa vào của khung, không tự mở').toBeNull();
    await expect(nvq).not.toHaveClass(/dang-vao/, XONG);
    await nav(page, 'navNqTongQuan');
    await expect(nvq.locator('.dau h1')).toContainText('Tổng quan nhiệm vụ quý');
    await expect(nvq).not.toHaveClass(/dang-vao/, XONG);
    for (const x of await soHien(nvq)) { expect(x.chu).toMatch(/^\d+%?$/); expect(x.an, `số ${x.chu} không còn bị ẩn chữ`).toBe(false); }
    expect(await soTinh()).toBe(0);

    // Ngăn chi tiết: mở danh sách từ thẻ "đang thực hiện" của Tổng quan — đủ dòng, cửa của ngăn đóng
    await page.locator('#navTongQuan').click();
    await expect(tq).not.toHaveClass(/dang-vao/, XONG);
    const the = tq.locator('#tqSo [data-so="th"]');
    if (Number(await the.locator('.gia').textContent()) > 0) {
      await the.click();
      const ngan = page.locator('#nganCT');
      await expect(ngan).toBeVisible();
      await expect(ngan.locator('.nct-ds li').first()).toBeVisible(NAP);
      await expect(ngan).not.toHaveClass(/dang-vao/, XONG);
      expect(await ngan.locator('.nct-ds li').count()).toBeGreaterThan(0);
    }
    expect(await soTinh()).toBe(0);
    await page.context().close();
  });
});
