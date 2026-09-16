// Kịch bản 4–5 (viết lại GĐ14 PR 14D): A2 giao việc trên form thống nhất (Owner = chuyên viên phòng mình, sản phẩm, hạn)
// → A3 đăng nhập thấy modal bắt buộc xác nhận đã nhận việc (chỉ việc theo 1400), xác nhận không đổi hạn/trạng thái
// → A3 cập nhật Hoàn thành có minh chứng. Kịch bản 6 cũ "A2 duyệt minh chứng" bỏ: chức năng duyệt (approve_task) bỏ theo
// RA-SOAT, thay bằng xác nhận minh chứng có cấu trúc ở GĐ15. Kèm: việc cũ (theo_1400 = false) không hiện modal, chỉ có chip.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { E2E_TAG } from './global-setup.mjs';

const CV1_ID = '00000000-0000-4000-8000-000000000004';
const SO_HOI_NGHI = 994;
const homNayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const congNgay = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

test.describe.serial('Luồng giao việc thống nhất → xác nhận nhận việc → hoàn thành', () => {
  let db; let title; let cuId; let moiId;

  test.beforeAll(async ({}, testInfo) => { // eslint-disable-line no-empty-pattern
    title = `${E2E_TAG} giao ${testInfo.project.name} ${Date.now()}`;
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    await don(db);
    // Việc CŨ (theo_1400 = false, dữ liệu chuyển đổi) của demo_cv1: không được hiện modal bắt buộc.
    const { data: hn, error: e1 } = await db.from('van_ban_giao_viec').insert({ so_hoi_nghi: SO_HOI_NGHI, so_ket_luan: `${E2E_TAG}-KL994`, ngay_ban_hanh: '2026-08-01' }).select('id').single();
    if (e1) throw new Error(`Tạo văn bản mẫu thất bại: ${e1.message}`);
    const { data: cu, error: e2 } = await db.from('nhiem_vu').insert({ van_ban_id: hn.id, nguoi_theo_doi: CV1_ID, noi_dung: `${E2E_TAG} việc cũ ${Date.now()}`,
      loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31', nganh_ma: 'KINH_TE_TONG_HOP', owner_don_vi_ma: 'DANG_UY_UBND' }).select('id').single();
    if (e2) throw new Error(`Tạo việc cũ thất bại: ${e2.message}`);
    cuId = cu.id;
  });
  test.afterAll(async () => { if (db) await don(db); });

  test('Kịch bản 4a: A3 có việc cũ chưa xác nhận → KHÔNG hiện modal, chỉ có chip và nút xác nhận tuỳ chọn', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A3', testInfo);
    const row = page.locator(`#klRow-${cuId}`);
    await expect(row).toBeVisible();
    await expect(page.locator('#mandatoryAcceptModal')).toBeHidden();
    await expect(row).toContainText('chưa xác nhận nhận việc');
    await expect(row.getByRole('button', { name: 'Xác nhận đã nhận việc' })).toBeVisible();
    await expect(page.locator('#klChipLoc')).toContainText('Việc của tôi');
    await page.context().close();
  });

  test('Kịch bản 4: A2 giao việc trên form thống nhất cho chuyên viên phòng mình', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A2', testInfo);
    await expect(page.locator('#klNutThem')).toBeVisible();
    await page.locator('#klNutThem').click();
    await expect(page.locator('#klThemModal')).toBeVisible();
    await page.locator('#klThVanBan').selectOption('__moi__');
    await page.locator('#klThLoaiVB').selectOption('CONG_VAN');
    await expect(page.locator('#klThSoHNWrap')).toBeHidden();   // công văn không có số hội nghị
    await page.locator('#klThSoKL').fill(`${E2E_TAG}-CV-${Date.now()}`);
    await page.locator('#klThNgayBH').fill(homNayVN());
    await page.locator('#klThNoiDung').fill(title);
    await page.locator('#klThOwner').selectOption(`tk:${CV1_ID}`);
    await expect(page.locator('#klThCapNhan')).toHaveValue('TRUONG_PHONG');
    await page.locator('#klThSanPham').selectOption('BAO_CAO');
    await page.locator('#klThSanPhamMoTa').fill('Báo cáo tham mưu (e2e)');
    await page.locator('#klThHan').fill(congNgay(homNayVN(), 3));
    await page.locator('#klThLuu').click();
    await expect(page.locator('#klThemModal')).toBeHidden();
    await expect(page.locator('#toastContainer')).toContainText('Đã giao việc NV-');
    const { data } = await db.from('nhiem_vu').select('id, theo_1400, owner_tai_khoan, nguoi_theo_doi').eq('noi_dung', title).single();
    expect(data).toMatchObject({ theo_1400: true, owner_tai_khoan: CV1_ID, nguoi_theo_doi: '00000000-0000-4000-8000-000000000003' });
    moiId = data.id;
    const row = page.locator(`#klRow-${moiId}`);
    await expect(row).toContainText('Demo Chuyên viên Một');
    await expect(row).toHaveAttribute('data-muc', 'VANG'); // còn 3 ngày, chưa có minh chứng → VÀNG (CN-4.1)
    await page.context().close();
  });

  test('Kịch bản 5: A3 bắt buộc xác nhận đã nhận việc (hạn, trạng thái không đổi); việc theo 1400 không chọn Hoàn thành ở Cập nhật, nút Đóng mờ khi chưa có minh chứng', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A3', testInfo);
    const modal = page.locator('#mandatoryAcceptModal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#mandatoryTaskTitle')).toContainText(title);
    await expect(page.locator('#mandatoryTaskProduct')).toContainText('Báo cáo');
    const truoc = (await db.from('nhiem_vu').select('han_xu_ly, tien_do_ma').eq('id', moiId).single()).data;
    await page.locator('#btnAcceptTask').click();
    await expect(page.locator('#toastContainer')).toContainText('Đã xác nhận nhận việc');
    await expect(modal).toBeHidden();
    const row = page.locator(`#klRow-${moiId}`);
    await expect(row).toContainText('đã nhận việc');
    expect((await db.from('nhiem_vu').select('han_xu_ly, tien_do_ma').eq('id', moiId).single()).data).toEqual(truoc);

    // GĐ16 (16B): việc theo 1400 đóng bằng nút "Đóng nhiệm vụ" sau khi nộp minh chứng có cấu trúc (luồng đầy đủ ở kl-minh-chung.spec);
    // modal Cập nhật không còn lựa chọn Hoàn thành và ô chữ tự do; nút Đóng mờ khi chưa có minh chứng.
    await expect(row.getByRole('button', { name: 'Đóng nhiệm vụ' })).toBeDisabled();
    await row.getByRole('button', { name: 'Cập nhật' }).click();
    await expect(page.locator('#klCapNhatModal')).toBeVisible();
    await expect(page.locator('#klCnTienDo option[value="HOAN_THANH"]')).toHaveCount(0);
    await expect(page.locator('#klCnMinhChungWrap')).toBeHidden();
    await expect(page.locator('#klCnGhiChu1400')).toBeVisible();
    await page.locator('#klCapNhatModal').getByRole('button', { name: 'Huỷ' }).click();
    await expect(page.locator('#klCapNhatModal')).toBeHidden();
    await page.context().close();
  });
});

async function don(db) {
  await db.from('nhiem_vu').delete().like('noi_dung', `${E2E_TAG} giao%`);
  await db.from('nhiem_vu').delete().like('noi_dung', `${E2E_TAG} việc cũ%`);
  await db.from('van_ban_giao_viec').delete().like('so_ket_luan', `${E2E_TAG}-CV-%`);
  await db.from('van_ban_giao_viec').delete().eq('so_hoi_nghi', SO_HOI_NGHI);
}
