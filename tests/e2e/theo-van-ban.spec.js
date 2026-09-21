// v8 đợt 4 — màn hình cây "Theo văn bản" (A0/A1): Chánh Văn phòng tạo qua RPC giao_viec (token vai, RLS thật) một văn bản mới + việc cấp 1
// + việc giao tiếp xuống (nhiem_vu_cha) và đặt trích yếu (van_ban_dat_trich_yeu 0046) → mở menu "Theo văn bản" → thấy gốc (số hiệu, trích yếu,
// thanh tiến độ 0/2), nhánh cấp 1 chứa nhánh cấp 2, thu gọn/mở rộng, lọc trạng thái → bấm nhánh mở #klChiTiet ở màn Nhiệm vụ. Dữ liệu tự dọn theo khoá riêng.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs, nav, NAP } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { E2E_TAG } from './global-setup.mjs';
import { khoaRieng, donVanBan, clientCuaVai } from './lib/du-lieu.mjs';

const CVP_ID = '00000000-0000-4000-8000-000000000001'; // demo_cvp (A1, is_chief)
const KL_ID = '00000000-0000-4000-8000-000000000010';  // demo_e2e_kl (A3, TONG_HOP) — chủ trì
const homNayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const congNgay = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const TRICH_YEU = 'Về việc rà soát nhiệm vụ theo văn bản (e2e TVB)';

test.describe.serial('Theo văn bản — cây văn bản → nhiệm vụ → việc giao tiếp xuống → minh chứng', () => {
  let db; let khoa; let vbId; let cha; let con; let page;

  test.beforeAll(async ({ browser }, testInfo) => {
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('van_ban_giao_viec').select('trich_yeu').limit(1);
    test.skip(Boolean(co.error), 'Project chưa có migration 0046 (van_ban_giao_viec.trich_yeu).');
    khoa = khoaRieng('TVB', testInfo);
    await donVanBan(db, khoa); // dấu vết lần chạy dở trước của cùng khoá
    const a1 = clientCuaVai('A1'); const homNay = homNayVN();
    const chung = { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: KL_ID, nguoi_theo_doi: CVP_ID, san_pham_loai: 'BAO_CAO', loai_thoi_han_ma: 'CO_HAN_CU_THE',
      han_xu_ly: congNgay(homNay, 12), ngay_nhan_van_ban: homNay, theo_1400: true, do_khan: 'THUONG' };
    const r1 = await a1.rpc('giao_viec', { p: { ...chung, noi_dung: `${E2E_TAG} TVB việc cấp 1 ${testInfo.project.name}`,
      van_ban: { loai: 'CONG_VAN', so_ket_luan: khoa, ngay_ban_hanh: congNgay(homNay, -5), ngay_nhan: homNay } } });
    if (r1.error) throw new Error(`giao_viec (cấp 1) thất bại: ${r1.error.message}`);
    cha = r1.data; vbId = cha.van_ban_id;
    const r2 = await a1.rpc('giao_viec', { p: { ...chung, noi_dung: `${E2E_TAG} TVB việc giao tiếp xuống ${testInfo.project.name}`, van_ban_id: vbId, nhiem_vu_cha: cha.id } });
    if (r2.error) throw new Error(`giao_viec (giao tiếp xuống) thất bại: ${r2.error.message}`);
    con = r2.data;
    const r3 = await a1.rpc('van_ban_dat_trich_yeu', { p_id: vbId, p_trich_yeu: TRICH_YEU });
    if (r3.error) throw new Error(`van_ban_dat_trich_yeu thất bại: ${r3.error.message}`);
    page = await pageAs(browser, 'A1', testInfo);
  });
  test.afterAll(async () => {
    await page?.context().close();
    if (db && khoa) await donVanBan(db, khoa);
  });

  test('gốc văn bản có số hiệu, trích yếu, thanh tiến độ 0/2; nhánh cấp 1 chứa nhánh cấp 2; thu gọn / mở rộng; lọc Hoàn thành ẩn văn bản', async () => {
    await nav(page, 'navTheoVanBan');
    await expect(page.locator('#tvbCay')).toHaveAttribute('data-nap', /./, NAP);
    const goc = page.locator(`#tvbVb-${vbId}`);
    await expect(goc).toBeVisible();
    await expect(goc.locator('.tvb-vb')).toContainText(khoa);
    await expect(goc.locator('.tvb-trich-yeu')).toHaveText(TRICH_YEU);
    await expect(goc.locator('.tvb-tien-chu')).toHaveText('0/2 hoàn thành · 0 quá hạn · 0 sắp đến hạn');
    await expect(goc).toHaveAttribute('data-so', '2');
    const nhanhCha = page.locator(`#tvbNv-${cha.id}`); const nhanhCon = page.locator(`#tvbNv-${con.id}`);
    await expect(nhanhCha).toHaveAttribute('data-cap', '1');
    await expect(nhanhCon).toHaveAttribute('data-cap', '2');
    await expect(nhanhCha.locator(`.tvb-con #tvbNv-${con.id}`)).toHaveCount(1); // cấp 2 nằm trong cấp 1 (nhiem_vu_cha)
    await expect(nhanhCha.locator('.tvb-nut .chu-tri').first()).toContainText('Demo E2E Chuyên viên KL');
    await nhanhCha.locator(':scope > .tvb-hang .tvb-gap').click(); // thu gọn nhánh cha → nhánh con ẩn
    await expect(nhanhCha).toHaveAttribute('data-mo', '0');
    await expect(nhanhCon).toBeHidden();
    await page.locator('[data-action="tvbGapTatCa"][data-mo="1"]').click();
    await expect(nhanhCon).toBeVisible();
    await page.locator('#tvbLoc').selectOption('HOAN_THANH'); // cả hai việc đang thực hiện → văn bản này biến mất khỏi cây
    await expect(goc).toHaveCount(0);
    await page.locator('#tvbLoc').selectOption('DANG_THUC_HIEN');
    await expect(page.locator(`#tvbVb-${vbId}`)).toBeVisible();
  });

  test('bấm nhánh → mở ngăn chi tiết #klChiTiet của đúng việc ở màn Nhiệm vụ', async () => {
    await page.locator(`#tvbNv-${con.id} > .tvb-hang .tvb-nut`).click();
    await expect(page.locator('#viewKl')).toBeVisible();
    await expect(page.locator(`#klChiTiet-${con.id}`)).toBeVisible(NAP);
    await expect(page.locator(`#klChiTiet-${con.id} h3`)).toContainText('TVB việc giao tiếp xuống');
  });
});
