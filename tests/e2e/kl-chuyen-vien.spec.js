// Kịch bản 9 (GĐ10 PR 10B): chuyên viên mở "Kết luận BTVTU", ô số = số dòng, cập nhật nhanh: chuyển Hoàn thành thiếu
// minh chứng bị chặn ngay ở form, đủ minh chứng (có ngày → gợi ý ngày hoàn thành) thì lưu, dòng đổi nhóm, ô số đổi theo,
// ngăn chi tiết ghi "nhập bởi" chính chuyên viên. Nhiệm vụ mẫu tạo bằng service_role trong hội nghị 997 (E2E), tự dọn.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { E2E_TAG } from './global-setup.mjs';

const CV1_ID = '00000000-0000-4000-8000-000000000004';
const SO_HOI_NGHI = 997;

test.describe.serial('Nhiệm vụ — màn hình chuyên viên', () => {
  let db; let nvId; let nv2Id; let page; let coXacNhan = false;   // false khi staging chưa có 0025 (CI của PR trước merge)

  test.beforeAll(async ({ browser }, testInfo) => {
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('nhiem_vu').select('id').limit(1);
    test.skip(Boolean(co.error), 'Project chưa có module KL (0014+).');
    await donHoiNghi(db);
    const { data: hn, error: e1 } = await db.from('van_ban_giao_viec').insert({ so_hoi_nghi: SO_HOI_NGHI, so_ket_luan: `${E2E_TAG}-KL`, ngay_ban_hanh: '2026-08-01' }).select('id').single();
    if (e1) throw new Error(`Tạo hội nghị mẫu thất bại: ${e1.message}`);
    const { data: nv, error: e2 } = await db.from('nhiem_vu').insert({
      van_ban_id: hn.id, nguoi_theo_doi: CV1_ID, noi_dung: `${E2E_TAG} KL ${testInfo.project.name} ${Date.now()}`,
      loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31', nganh_ma: 'KINH_TE_TONG_HOP', owner_don_vi_ma: 'DANG_UY_UBND',
    }).select('id').single();
    if (e2) throw new Error(`Tạo nhiệm vụ mẫu thất bại: ${e2.message}`);
    nvId = nv.id;
    // Dòng "Cần điền hạn" (app, có lý do, không hạn): hoàn thành mà không điền hạn vẫn phải lưu được (CHECK 0014).
    const { data: nv2, error: e3 } = await db.from('nhiem_vu').insert({
      van_ban_id: hn.id, nguoi_theo_doi: CV1_ID, noi_dung: `${E2E_TAG} KL cần điền hạn ${Date.now()}`,
      loai_thoi_han_ma: 'CO_HAN_CU_THE', ly_do_chua_co_han: 'Phụ thuộc yếu tố bên ngoài (e2e)', nganh_ma: 'KINH_TE_TONG_HOP',
    }).select('id').single();
    if (e3) throw new Error(`Tạo nhiệm vụ mẫu 2 thất bại: ${e3.message}`);
    nv2Id = nv2.id;
    // service_role gọi xac_nhan_nhan_viec(uuid rỗng) → 42501 khi hàm có; PGRST202 khi chưa có 0025 → bỏ qua case xác nhận.
    coXacNhan = (await db.rpc('xac_nhan_nhan_viec', { p_id: '00000000-0000-0000-0000-000000000000' })).error?.code !== 'PGRST202';
    page = await pageAs(browser, 'A3', testInfo);
  });
  test.afterAll(async () => {
    await page?.context().close();
    if (db) await donHoiNghi(db);
  });

  test('mở màn hình: ô Tổng = số dòng bảng; dòng mẫu ở nhóm Đang thực hiện; bấm ô lọc đúng', async () => {
    await page.locator('#navKl').click();
    const row = page.locator(`#klRow-${nvId}`);
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute('data-nhom', 'DANG_THUC_HIEN');
    const tong = Number(await page.locator('#klSo-TONG').innerText());
    await expect(page.locator('#klBody tr[id^="klRow-"]')).toHaveCount(tong);
    await expect(page.locator('#klTinhDen')).toContainText('Số liệu tính đến');
    await expect(page.locator('#klNutThem')).toBeHidden(); // chuyên viên không có quan_tri_kl → không có nút Thêm
    await page.locator('#klStats [data-nhom="DANG_THUC_HIEN"]').click();
    const dth = Number(await page.locator('#klSo-DANG_THUC_HIEN').innerText());
    await expect(page.locator('#klBody tr[id^="klRow-"]')).toHaveCount(dth);
    await expect(row).toBeVisible();
    await page.locator('#klStats [data-nhom=""]').click();
  });

  test('xác nhận đã nhận việc (GĐ14): chỉ ghi lịch sử — hạn, tiến độ, cập nhật lần cuối không đổi; nút biến mất', async () => {
    test.skip(!coXacNhan, 'Project chưa có migration 0025 (xac_nhan_nhan_viec).');
    const row = page.locator(`#klRow-${nvId}`);
    const truoc = (await db.from('nhiem_vu').select('han_xu_ly, tien_do_ma, cap_nhat_luc').eq('id', nvId).single()).data;
    await row.getByRole('button', { name: 'Xác nhận đã nhận việc' }).click();
    await expect(page.locator('#toastContainer')).toContainText('xác nhận nhận việc');
    await expect(row.getByRole('button', { name: 'Xác nhận đã nhận việc' })).toHaveCount(0);
    await expect(row).toContainText('đã nhận việc');
    const sau = (await db.from('nhiem_vu').select('han_xu_ly, tien_do_ma, cap_nhat_luc').eq('id', nvId).single()).data;
    expect(sau).toEqual(truoc);
    const { data: ls } = await db.from('lich_su').select('id').eq('nhiem_vu_id', nvId).eq('cot', 'xac_nhan_nhan_viec');
    expect(ls).toHaveLength(1);
  });

  test('cập nhật: Hoàn thành thiếu minh chứng → chặn ở form; minh chứng có ngày → gợi ý ngày; lưu → dòng sang Hoàn thành', async () => {
    await page.locator(`#klRow-${nvId}`).getByRole('button', { name: 'Cập nhật' }).click();
    await expect(page.locator('#klCapNhatModal')).toBeVisible();
    await page.locator('#klCnTienDo').selectOption('HOAN_THANH');
    await expect(page.locator('#klCnHoanThanhWrap')).toBeVisible();
    await page.locator('#klCnLuu').click();
    await expect(page.locator('#toastContainer')).toContainText('phải có minh chứng');
    await expect(page.locator('#klCapNhatModal')).toBeVisible();

    await page.locator('#klCnMinhChung').fill(`Báo cáo số 15/BC-VPTU ngày 5/9/2026 (${E2E_TAG})`);
    await expect(page.locator('#klCnNgayHT')).toHaveValue('2026-09-05');
    const truoc = Number(await page.locator('#klSo-HOAN_THANH').innerText());
    await page.locator('#klCnLuu').click();
    await expect(page.locator('#klCapNhatModal')).toBeHidden();
    await expect(page.locator('#toastContainer')).toContainText('Đã cập nhật');
    const row = page.locator(`#klRow-${nvId}`);
    await expect(row).toHaveAttribute('data-nhom', 'HOAN_THANH');
    await expect(page.locator('#klSo-HOAN_THANH')).toHaveText(String(truoc + 1));
    const { data } = await db.from('nhiem_vu').select('tien_do_ma, ngay_hoan_thanh, thieu_minh_chung').eq('id', nvId).single();
    expect(data).toEqual({ tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2026-09-05', thieu_minh_chung: false });
  });

  test('việc "Cần điền hạn" hoàn thành không cần điền hạn: lưu được, lý do chưa có hạn giữ nguyên', async () => {
    const row = page.locator(`#klRow-${nv2Id}`);
    await expect(row).toHaveAttribute('data-nhom', 'CAN_DIEN_HAN');
    await row.getByRole('button', { name: 'Cập nhật' }).click();
    await page.locator('#klCnTienDo').selectOption('HOAN_THANH');
    await expect(page.locator('#klCnChuaCoHanWrap')).toBeHidden();
    await page.locator('#klCnMinhChung').fill(`Công văn 20/CV-VPTU ngày 10/9/2026 (${E2E_TAG})`);
    await page.locator('#klCnLuu').click();
    await expect(page.locator('#klCapNhatModal')).toBeHidden();
    await expect(row).toHaveAttribute('data-nhom', 'HOAN_THANH');
    const { data } = await db.from('nhiem_vu').select('tien_do_ma, han_xu_ly, ly_do_chua_co_han').eq('id', nv2Id).single();
    expect(data).toEqual({ tien_do_ma: 'HOAN_THANH', han_xu_ly: null, ly_do_chua_co_han: 'Phụ thuộc yếu tố bên ngoài (e2e)' });
  });

  test('ngăn chi tiết: tiến độ ghi "nhập bởi" chuyên viên, nguồn hệ thống, lịch sử có 4 thay đổi (kể cả xác nhận nhận việc)', async () => {
    await page.locator(`#klRow-${nvId}`).getByRole('button', { name: 'Chi tiết' }).click();
    const ct = page.locator(`#klChiTiet-${nvId}`);
    await expect(ct).toBeVisible();
    // 15E: nút "Chi tiết" mở sẵn bảng thông tin (khối chỉ đạo vẫn ở đầu ngăn, không đặt con trỏ).
    await expect(ct.locator('.chi-tiet-them')).toHaveAttribute('open', '');
    await expect(ct.locator('input[name=noi_dung]')).toHaveCount(0); // chưa có chỉ đạo → chưa có ô phản hồi; con trỏ không bị đặt đâu cả
    await expect(page.locator(`#klRow-${nvId}`).getByRole('button', { name: 'Phản hồi' })).toBeVisible(); // A3 là người theo dõi: nút chính Phản hồi
    await expect(ct).toContainText('nhập bởi Demo Chuyên viên Một');
    await expect(ct).toContainText('Nhập trên hệ thống');
    await expect(ct.locator('.lich-su-hop summary')).toContainText(`Lịch sử: ${coXacNhan ? 4 : 3} thay đổi`);
  });
});

async function donHoiNghi(db) {
  const { data } = await db.from('van_ban_giao_viec').select('id').eq('so_hoi_nghi', SO_HOI_NGHI);
  for (const h of data || []) {
    await db.from('nhiem_vu').delete().eq('van_ban_id', h.id);
    await db.from('van_ban_giao_viec').delete().eq('id', h.id);
  }
}
