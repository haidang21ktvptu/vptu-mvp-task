// v3.17 (Đợt A, yêu cầu 7/10/2026 mục 1, 5, 9): Trưởng phòng (demo_truongphong, TONG_HOP) giao NHIỀU nhiệm vụ từ một văn bản mới bằng lưới
// (mở với 1 dòng → Thêm dòng → 3 dòng, xoá một dòng rồi thêm lại; dòng 2 giao cho chính mình), một giao dịch → 3 việc cùng văn bản, cấp nhận từng
// dòng; tìm nhanh ở ô Chịu trách nhiệm (gõ "chính tôi" / tên chuyên viên, bỏ dấu) tự chọn; nút chọn nhanh "Chính tôi". Dữ liệu theo khoá; tự dọn.
import { test, expect } from '@playwright/test';
import { NAP, moGiaoViec } from './lib/app.js';
import { khoaRieng, donVanBan, donNhiemVuTheoNoiDung } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong, voiPhien } from './lib/pr2b.mjs';

const H = cong(homNay(), 20);
let db; let khoa;
const dong = (p, i) => p.locator(`#gvLuoiThan tr[data-dong="${i}"]`);

test.describe.serial('Giao việc — nhiều nhiệm vụ từ một văn bản, giao cho chính mình, tìm nhanh người', () => {
  test.describe.configure({ timeout: 180_000 });
  test.beforeAll(async () => { db = dbAdmin(); khoa = khoaRieng('GN', test.info()); });
  test.afterAll(async () => { if (db) { await donNhiemVuTheoNoiDung(db, khoa); await donVanBan(db, `${khoa}-GV`); } });

  test('1. Lưới: 1 dòng → thêm / xoá → 3 dòng; dòng 2 giao cho chính mình; "Giao 3 việc" → ba việc cùng văn bản, cấp nhận theo từng dòng', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'A2', testInfo, async (p) => {
      await moGiaoViec(p);
      await p.locator('#gvCheDoNhieu').click();
      await expect(p.locator('#gvLuoiWrap')).toBeVisible(); await expect(p.locator('#klThNoiDungWrap')).toBeHidden(); await expect(p.locator('#klThHanWrap')).toBeHidden();
      await expect(p.locator('#gvLuoiThan tr')).toHaveCount(1); await expect(p.locator('#gvLuoiDem')).toHaveText('1 / 20 dòng');
      await expect(dong(p, 1).locator('.gvl-xoa')).toBeDisabled();   // không xoá dòng cuối cùng
      await p.locator('#gvThemDong').click(); await p.locator('#gvThemDong').click();
      await expect(p.locator('#gvLuoiThan tr')).toHaveCount(3);
      await dong(p, 2).locator('.gvl-xoa').click();
      await expect(p.locator('#gvLuoiThan tr')).toHaveCount(2); await expect(dong(p, 2).locator('.gvl-so')).toHaveText('2');   // đánh số lại
      await p.locator('#gvThemDong').click();
      await expect(p.locator('#klThLuu')).toHaveText('Giao 3 việc'); await expect(p.locator('#klThLuu')).toBeDisabled();
      await p.locator('#klThVanBan').selectOption('__moi__'); await p.locator('#klThLoaiVB').selectOption('CONG_VAN');
      await p.locator('#klThSoKL').fill(`${khoa}-GV`); await p.locator('#klThNgayBH').fill(cong(homNay(), -1));
      const owners = [`tk:${ID.cv1}`, `tk:${ID.tp}`, `tk:${ID.cv1}`];
      for (const i of [1, 2, 3]) {
        await dong(p, i).locator('[data-cot="noi_dung"]').fill(`${khoa} dòng ${i}`);
        await dong(p, i).locator('[data-cot="owner"]').selectOption(owners[i - 1]);
        await dong(p, i).locator('[data-cot="san_pham"]').selectOption('BAO_CAO');
        await dong(p, i).locator('[data-cot="han"]').fill(cong(H, i));
      }
      await expect(p.locator('#gvConThieu')).toHaveText('', NAP);
      await expect(p.locator('#gvTomTatChu')).toContainText('Giao 3 việc từ văn bản này');
      await expect(p.locator('#klThLuu')).toBeEnabled();
      await p.locator('#klThLuu').click();
      await expect(p.locator('#toastContainer')).toContainText('Đã giao 3 việc', NAP);
      await expect(p.locator('#giaoViecForm')).toHaveAttribute('data-che-do', 'mot', NAP);   // biểu mẫu mở lại sạch
    });
    const { data } = await db.from('nhiem_vu').select('noi_dung, owner_tai_khoan, nguoi_theo_doi, cap_nhan_san_pham, han_xu_ly, van_ban_id, san_pham_loai').like('noi_dung', `${khoa} dòng%`).order('noi_dung');
    expect(data.length).toBe(3);
    expect(new Set(data.map((x) => x.van_ban_id)).size).toBe(1);
    expect(data.map((x) => [x.owner_tai_khoan, x.cap_nhan_san_pham, x.han_xu_ly, x.san_pham_loai, x.nguoi_theo_doi]))
      .toEqual([[ID.cv1, 'TRUONG_PHONG', cong(H, 1), 'BAO_CAO', ID.tp], [ID.tp, 'PHO_CHANH_VAN_PHONG', cong(H, 2), 'BAO_CAO', ID.tp], [ID.cv1, 'TRUONG_PHONG', cong(H, 3), 'BAO_CAO', ID.tp]]);
  });

  test('2. Tìm nhanh ở ô Chịu trách nhiệm: gõ "chinh toi" (bỏ dấu) chọn chính mình, gõ tên chuyên viên chọn đúng người; nút chọn nhanh "Chính tôi"', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'A2', testInfo, async (p) => {
      await moGiaoViec(p);
      await expect(p.locator('#gvNhanhOwner button', { hasText: 'Chính tôi' })).toBeVisible();
      await p.locator('#klThOwnerTim').fill('chinh toi');
      await expect(p.locator('#klThOwner')).toHaveValue(`tk:${ID.tp}`);
      await expect(p.locator('#klThCapNhan')).toHaveValue('PHO_CHANH_VAN_PHONG');   // cấp nhận = cấp trên của chính mình
      await p.locator('#klThOwnerTim').fill('chuyen vien mot');
      await expect(p.locator('#klThOwner')).toHaveValue(`tk:${ID.cv1}`);
      await p.locator('#klThOwnerTim').fill('');
      await expect(p.locator('#klThOwner')).toHaveValue(`tk:${ID.cv1}`);   // xoá chữ tìm: giữ lựa chọn
      await p.locator('#gvNhanhOwner button', { hasText: 'Chính tôi' }).click();
      await expect(p.locator('#klThOwner')).toHaveValue(`tk:${ID.tp}`);
    });
  });
});
