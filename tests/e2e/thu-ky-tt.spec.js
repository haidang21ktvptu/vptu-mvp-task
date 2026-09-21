// 0047 — thư ký Thường trực: QTHT cấp cờ cho demo_e2e_tk trên màn "Tài khoản và cờ" (lý do bắt buộc) → A0 gửi chỉ đạo Thường trực (RPC token A0)
// → thư ký thấy mục "Chỉ đạo Thường trực", bấm "Đóng thay mặt Thường trực" (xác nhận một bước) → luồng đóng, diễn biến của việc ghi
// "Đóng thay mặt Thường trực — Demo E2E Thư ký TT"; A0 "Chỉ đạo đã gửi" ghi "thay mặt: …". Dữ liệu tự dọn theo khoá riêng; thu cờ ở afterAll.
// Bỏ qua khi thiếu demo_a0 / demo_qtht / demo_e2e_tk (seed-demo.mjs).
import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { contextAs, nav, NAP } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { storageStatePath, OPTIONAL_USERS } from './lib/roles.mjs';
import { E2E_TAG } from './global-setup.mjs';
import { khoaRieng, taoVanBanRieng, donVanBan, clientCuaVai } from './lib/du-lieu.mjs';

const CVP_ID = '00000000-0000-4000-8000-000000000001';
const KL_ID = '00000000-0000-4000-8000-000000000010';
const TK_ID = '00000000-0000-4000-8000-000000000018'; // demo_e2e_tk
const homNayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const congNgay = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
// Tài khoản ngoài bộ chuẩn (OPTIONAL_USERS): mở phiên đã lưu và chờ đúng tên hiện ở đầu trang.
const pageAs = async (browser, role, testInfo) => { const page = await (await contextAs(browser, role, testInfo)).newPage(); await page.goto('./'); await expect(page.locator('#currentUserDisplay')).toContainText(OPTIONAL_USERS[role].fullName, { timeout: 20_000 }); return page; };

test.describe.serial('Thư ký Thường trực — cấp cờ, mục Chỉ đạo Thường trực, đóng thay mặt', () => {
  let db; let khoa; let nvId; let ma; let cdId;

  test.beforeAll(async ({}, testInfo) => { // eslint-disable-line no-empty-pattern
    for (const r of ['A0', 'QTHT', 'E2E_TK']) test.skip(!existsSync(storageStatePath(r)), `Chưa có tài khoản ${r} trên project này (seed-demo.mjs).`);
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('accounts').select('thu_ky_thuong_truc').limit(1);
    test.skip(Boolean(co.error), 'Project chưa có migration 0047.');
    khoa = khoaRieng('TKTT', testInfo);
    await db.from('accounts').update({ thu_ky_thuong_truc: false }).eq('id', TK_ID); // dấu vết lần chạy dở
    const vbId = await taoVanBanRieng(db, khoa, { loai: 'CONG_VAN' });
    const { data, error } = await db.from('nhiem_vu').insert({ van_ban_id: vbId, noi_dung: `${E2E_TAG} TKTT việc có chỉ đạo Thường trực ${testInfo.project.name}`,
      loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: congNgay(homNayVN(), 10), owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: KL_ID, nguoi_theo_doi: CVP_ID, tao_boi: CVP_ID,
      theo_1400: true, san_pham_loai: 'BAO_CAO', ngay_nhan_van_ban: homNayVN() }).select('id, ma').single();
    if (error) throw new Error(`Tạo việc mẫu thất bại: ${error.message}`);
    nvId = data.id; ma = data.ma;
    const r = await clientCuaVai('A0').rpc('chi_dao_gui', { p: { nhiem_vu_id: nvId, loai: 'CHI_DAO_TT', noi_dung: `Báo cáo Thường trực trước thứ Sáu (${E2E_TAG} TKTT)`, do_khan: 'KHAN' } });
    if (r.error) throw new Error(`A0 gửi chỉ đạo TT thất bại: ${r.error.message}`);
    cdId = r.data;
  });
  test.afterAll(async () => {
    if (!db) return;
    await db.from('accounts').update({ thu_ky_thuong_truc: false }).eq('id', TK_ID); // thu cờ dù test dừng giữa chừng
    await donVanBan(db, khoa);
  });

  test('QTHT cấp cờ thư ký TT cho demo_e2e_tk trên màn Tài khoản và cờ (lý do bắt buộc) → nhãn "Thư ký Thường trực"', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'QTHT', testInfo);
    await nav(page, 'navQuanTri');
    await page.locator('#qtTabTaiKhoan').click();
    const nut = page.locator('#qtTaiKhoanBody button[data-action="toggleThuKyTT"][data-username="demo_e2e_tk"]');
    await expect(nut).toHaveText('Cấp thư ký TT', NAP);
    await nut.click();
    await expect(page.locator('#qtLyDoModal')).toBeVisible();
    await page.locator('#qtLyDoXacNhan').click(); // thiếu lý do → chưa cấp
    await expect(page.locator('#qtLyDoModal')).toBeVisible();
    await page.locator('#qtLyDo').fill(`Phân công thư ký Thường trực (${E2E_TAG})`);
    await page.locator('#qtLyDoXacNhan').click();
    await expect(page.locator('#toastContainer')).toContainText('Đã cấp quyền thư ký Thường trực');
    await expect(page.locator('#qtTaiKhoanBody tr', { hasText: 'demo_e2e_tk' }).locator('.nhan-thu-ky-tt')).toHaveText('Thư ký Thường trực', NAP);
    await expect(page.locator('#qtTaiKhoanBody button[data-action="toggleThuKyTT"][data-username="demo_e2e_tk"]')).toHaveText('Thu thư ký TT');
    const acc = await db.from('accounts').select('thu_ky_thuong_truc').eq('id', TK_ID).single();
    expect(acc.data.thu_ky_thuong_truc).toBe(true);
    await page.context().close();
  });

  test('Thư ký: mục "Chỉ đạo Thường trực" có dòng của A0 (xác nhận một bước tại dòng); Mở việc → ngăn chỉ đọc có nút Đóng thay mặt → đóng → luồng + diễn biến ghi "Đóng thay mặt Thường trực — Demo E2E Thư ký TT"; dòng rời danh sách', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'E2E_TK', testInfo);
    await nav(page, 'navChiDaoTTThuKy');
    await expect(page.locator('#cdtkDanhSach')).toHaveAttribute('data-nap', /./, NAP);
    const dong = page.locator(`#cdtk-${cdId}`);
    await expect(dong).toBeVisible();
    await expect(dong).toContainText(ma);
    await expect(dong).toContainText('Demo Chánh Văn phòng'); // người nhận
    await expect(dong.locator('.dk-khan')).toContainText('Khẩn');
    await expect(dong).toHaveAttribute('data-trang-thai', 'CHO_PHAN_HOI');
    await expect(page.locator('#viewChiDaoTTThuKy form.cd-form')).toHaveCount(0); // thư ký không có ô gửi chỉ đạo
    await dong.locator('[data-action="hoiDongThayMatTT"]').click();   // xác nhận một bước tại dòng: hỏi → huỷ
    await expect(page.locator(`#tkXn-${cdId}`)).toBeVisible();
    await page.locator(`#tkXn-${cdId} [data-action="huyDongThayMatTT"]`).click();
    await expect(page.locator(`#tkXn-${cdId}`)).toBeHidden();
    // Mở việc → ngăn chi tiết (thư ký chỉ đọc): không ô gửi chỉ đạo / nộp minh chứng; luồng TT có nút Đóng thay mặt → đóng tại ngăn
    await dong.locator('[data-action="moChiDaoViec"]').click();
    const ngan = page.locator(`#klChiTiet-${nvId}`);
    await expect(ngan).toBeVisible(NAP);
    await expect(ngan.locator('form.cd-form')).toHaveCount(0);
    await expect(ngan.getByRole('button', { name: 'Nộp minh chứng' })).toHaveCount(0);
    const nutNgan = ngan.locator(`#cd-${cdId} [data-action="dongChiDao"][data-thay-mat="1"]`);
    await expect(nutNgan).toHaveText('Đóng thay mặt Thường trực', NAP);
    await nutNgan.click();
    await expect(page.locator('#toastContainer')).toContainText('Đã đóng chỉ đạo thay mặt Thường trực');
    await expect(ngan.locator(`#cd-${cdId}`)).toHaveAttribute('data-trang-thai', 'DA_DONG', NAP);
    await expect(ngan.locator(`#cd-${cdId}`)).toContainText('Đã đóng thay mặt Thường trực — Demo E2E Thư ký TT');
    await expect(ngan.locator(`#klDienBien-${nvId}`)).toContainText('Đóng thay mặt Thường trực — Demo E2E Thư ký TT', NAP);
    const cd = await db.from('chi_dao').select('trang_thai, dong_boi').eq('id', cdId).single();
    expect(cd.data).toEqual({ trang_thai: 'DA_DONG', dong_boi: TK_ID });
    await nav(page, 'navChiDaoTTThuKy');
    await expect(page.locator('#cdtkDanhSach')).toHaveAttribute('data-nap', /./, NAP);
    await expect(page.locator(`#cdtk-${cdId}`)).toHaveCount(0); // đã đóng → rời danh sách đang mở
    await page.context().close();
  });

  test('A0 "Chỉ đạo đã gửi": dòng ghi "Đã đóng — thay mặt: Demo E2E Thư ký TT"', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A0', testInfo);
    await nav(page, 'navChiDaoDaGui');
    const dong = page.locator(`#cdg-${cdId}`);
    await expect(dong).toHaveAttribute('data-trang-thai', 'DA_DONG', NAP);
    await expect(dong).toContainText('Đã đóng — thay mặt: Demo E2E Thư ký TT');
    await page.context().close();
  });
});
