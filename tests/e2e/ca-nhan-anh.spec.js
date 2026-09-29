// PR-2a C2 (0052): ảnh hồ sơ trên bucket riêng tư anh-ho-so — tải ảnh ở Cá nhân → accounts.anh_url là ĐƯỜNG DẪN <uid>/anh-<thời điểm>.png, ảnh hiện
// qua signed URL (Cá nhân + vỏ ứng dụng); tải lại trang vẫn hiện; đổi ảnh thì tệp cũ bị xoá; người khác đã đăng nhập tải được ảnh; người chưa
// đăng nhập (anon, URL công khai) thì không. Tài khoản demo_e2e_tk (demo_e2e_kl đã được gd22 dùng trong cùng lượt — chuỗi refresh token không dùng lại được);
// trước và sau: xoá mọi tệp trong thư mục của tài khoản, anh_url về NULL (gốc).
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { getKeys } from './lib/keys.mjs';
import { contextAs, NAP } from './lib/app.js';
import { clientCuaVai } from './lib/du-lieu.mjs';

const BUCKET = 'anh-ho-so';
// PNG 1x1 hợp lệ (ảnh thật để trình duyệt vẽ được — naturalWidth > 0).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const SIGN = /\/storage\/v1\/object\/sign\/anh-ho-so\//;

test.describe.serial('Ảnh hồ sơ riêng tư, hiện bằng signed URL (C2)', () => {
  let db; let uid; let page;
  const don = async () => {
    const { data } = await db.storage.from(BUCKET).list(uid);
    if (data?.length) await db.storage.from(BUCKET).remove(data.map((f) => `${uid}/${f.name}`));
    await db.from('accounts').update({ anh_url: null }).eq('id', uid);
  };
  const docAnh = async () => (await db.from('accounts').select('anh_url').eq('id', uid).single()).data.anh_url;
  // Tải một ảnh qua Cá nhân; chờ tới khi anh_url trong DB đổi khác giá trị trước (lưu xong) rồi trả đường dẫn mới.
  const taiAnh = async (ten) => {
    const cu = await docAnh();
    await page.locator('#banhRangBtn').click();
    await page.locator('[data-action="openCaNhan"]').first().click();
    await page.locator('#cnAnhFile').setInputFiles({ name: ten, mimeType: 'image/png', buffer: PNG });
    await page.locator('#cnLuuHoSo').click();
    await expect.poll(docAnh, NAP).not.toBe(cu);
    await expect(page.locator('#cnAvatar img')).toHaveAttribute('src', SIGN, NAP);
    return docAnh();
  };

  test.beforeAll(async ({ browser }, testInfo) => {
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    uid = (await db.from('accounts').select('id').eq('username', 'demo_e2e_tk').single()).data.id;
    await don();
    page = await (await contextAs(browser, 'E2E_TK', testInfo)).newPage();   // E2E_TK là tài khoản tuỳ chọn (OPTIONAL_USERS)
    await page.goto('./');
    await expect(page.locator('#mainHeader')).toBeVisible(NAP);
  });
  test.afterAll(async () => { await page?.context().close(); if (db) await don(); });

  test('tải ảnh → lưu đường dẫn, hiện qua signed URL; tải lại trang vẫn hiện; đổi ảnh thì tệp cũ bị xoá', async () => {
    const p1 = await taiAnh('anh-1.png');
    expect(p1).toMatch(new RegExp(`^${uid}/anh-\\d+\\.png$`));
    await expect(page.locator('#avatarNguoi img')).toHaveAttribute('src', SIGN);
    await page.reload();
    const img = page.locator('#avatarNguoi img');
    await expect(img).toHaveAttribute('src', SIGN, NAP);
    await expect.poll(() => img.evaluate((e) => e.complete && e.naturalWidth)).toBeGreaterThan(0);
    const p2 = await taiAnh('anh-2.png');
    expect(p2).not.toBe(p1);
    await expect.poll(async () => (await db.storage.from(BUCKET).list(uid)).data.map((f) => `${uid}/${f.name}`)).toEqual([p2]);
  });

  test('người khác đã đăng nhập tải được ảnh; người chưa đăng nhập (anon, URL công khai) thì không', async () => {
    const path = (await db.from('accounts').select('anh_url').eq('id', uid).single()).data.anh_url;
    const khac = clientCuaVai('E2E_MC');
    const tai = await khac.storage.from(BUCKET).download(path);
    expect(tai.error, 'demo_e2e_mc tải ảnh của demo_e2e_tk').toBeNull();
    const ky = await khac.storage.from(BUCKET).createSignedUrl(path, 60);
    expect((await fetch(ky.data.signedUrl)).status).toBe(200);
    const k = getKeys();
    const anon = createClient(k.url, k.anon, { auth: { persistSession: false, autoRefreshToken: false } });
    expect((await anon.storage.from(BUCKET).download(path)).error, 'anon tải ảnh').not.toBeNull();
    expect((await fetch(anon.storage.from(BUCKET).getPublicUrl(path).data.publicUrl)).status).not.toBe(200);
  });
});
