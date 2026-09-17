// Kịch bản 9 (GĐ10; giao diện v7 GĐ20): chuyên viên mở Nhiệm vụ (tổng quan → danh sách → ngăn chi tiết), ô số = số dòng, bấm dòng mở ngăn,
// xác nhận nhận việc tại ngăn, cập nhật nhanh: chuyển Hoàn thành thiếu minh chứng bị chặn ngay ở form, đủ minh chứng (có ngày → gợi ý ngày)
// thì lưu, dòng đổi nhóm, ô số đổi theo; ngăn chi tiết ghi "nhập bởi" chính chuyên viên. Nhiệm vụ mẫu ở hội nghị 997 (E2E), tự dọn.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs, nav, NAP } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { E2E_TAG } from './global-setup.mjs';
import { khoaRieng, taoVanBanRieng, donVanBan } from './lib/du-lieu.mjs';

const CV1_ID = '00000000-0000-4000-8000-000000000010'; // demo_e2e_kl — tài khoản riêng của spec (GĐ18)
const SO_HOI_NGHI = 997;

test.describe.serial('Nhiệm vụ — màn hình chuyên viên', () => {
  let hnKhoa;
  let db; let nvId; let nv2Id; let page;

  test.beforeAll(async ({ browser }, testInfo) => {
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('nhiem_vu').select('id').limit(1);
    test.skip(Boolean(co.error), 'Project chưa có module KL (0014+).');
    hnKhoa = khoaRieng('KL', testInfo); // khoá riêng theo project: chạy lại / chạy dở / 2 worker không đụng nhau
    const hn = { id: await taoVanBanRieng(db, hnKhoa, { so_hoi_nghi: SO_HOI_NGHI }) };
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
    page = await pageAs(browser, 'E2E_KL', testInfo);
  });
  test.afterAll(async () => {
    await page?.context().close();
    if (db) await donVanBan(db, hnKhoa);
  });

  test('mở màn hình: ô Tổng = số dòng; dòng mẫu ở nhóm Đang thực hiện; bấm ô lọc đúng; không có Giao việc', async () => {
    await nav(page, 'navKl');
    await expect(page.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP); // danh sách đã nạp xong
    const row = page.locator(`#klRow-${nvId}`);
    await expect(row).toBeVisible(NAP);
    await expect(row).toHaveAttribute('data-nhom', 'DANG_THUC_HIEN');
    await expect(row).toHaveClass(/\blam\b/); // mép trái lam: Xanh
    const tong = Number(await page.locator('#klSo-TONG').innerText());
    await expect(page.locator('#klBody [id^="klRow-"]')).toHaveCount(tong);
    await expect(page.locator('#klTinhDen')).toContainText('Số liệu tính đến');
    await expect(page.locator('#klNutThem')).toBeHidden(); // chuyên viên không có quan_tri_kl → không có nút Giao việc
    await page.locator('#klStats [data-nhom="DANG_THUC_HIEN"]').click();
    const dth = Number(await page.locator('#klSo-DANG_THUC_HIEN').innerText());
    await expect(page.locator('#klBody [id^="klRow-"]')).toHaveCount(dth);
    await expect(row).toBeVisible(NAP);
    await page.locator('#klStats [data-nhom=""]').click();
  });

  test('bấm dòng → ngăn chi tiết; xác nhận đã nhận việc chỉ ghi lịch sử — hạn, tiến độ, cập nhật lần cuối không đổi; nút biến mất', async () => {
    const row = page.locator(`#klRow-${nvId}`);
    await row.click();
    const ngan = page.locator(`#klChiTiet-${nvId}`);
    await expect(ngan).toBeVisible(NAP);
    await expect(row).toHaveClass(/\bdang\b/);
    await expect(ngan).toContainText('chưa xác nhận nhận việc');
    const truoc = (await db.from('nhiem_vu').select('han_xu_ly, tien_do_ma, cap_nhat_luc').eq('id', nvId).single()).data;
    await ngan.getByRole('button', { name: 'Xác nhận đã nhận việc' }).click();
    await expect(page.locator('#toastContainer')).toContainText('xác nhận nhận việc');
    await expect(page.locator(`#klChiTiet-${nvId}`).getByRole('button', { name: 'Xác nhận đã nhận việc' })).toHaveCount(0);
    await expect(page.locator(`#klChiTiet-${nvId}`)).toContainText('đã nhận việc', NAP);
    const sau = (await db.from('nhiem_vu').select('han_xu_ly, tien_do_ma, cap_nhat_luc').eq('id', nvId).single()).data;
    expect(sau).toEqual(truoc);
    const { data: ls } = await db.from('lich_su').select('id').eq('nhiem_vu_id', nvId).eq('cot', 'xac_nhan_nhan_viec');
    expect(ls).toHaveLength(1);
  });

  test('cập nhật: Hoàn thành thiếu minh chứng → chặn ở form; minh chứng có ngày → gợi ý ngày; lưu → dòng sang Hoàn thành', async () => {
    await page.locator(`#klChiTiet-${nvId}`).getByRole('button', { name: 'Cập nhật' }).click();
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
    await expect(row).toHaveAttribute('data-nhom', 'HOAN_THANH', NAP);
    await expect(row).toHaveClass(/\bluc\b/);
    await expect(page.locator('#klSo-HOAN_THANH')).toHaveText(String(truoc + 1));
    const { data } = await db.from('nhiem_vu').select('tien_do_ma, ngay_hoan_thanh, thieu_minh_chung').eq('id', nvId).single();
    expect(data).toEqual({ tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2026-09-05', thieu_minh_chung: false });
  });

  test('việc "Cần điền hạn" hoàn thành không cần điền hạn: lưu được, lý do chưa có hạn giữ nguyên', async () => {
    const row = page.locator(`#klRow-${nv2Id}`);
    await expect(row).toHaveAttribute('data-nhom', 'CAN_DIEN_HAN', NAP);
    await row.click();
    await page.locator(`#klChiTiet-${nv2Id}`).getByRole('button', { name: 'Cập nhật' }).click();
    await page.locator('#klCnTienDo').selectOption('HOAN_THANH');
    await expect(page.locator('#klCnChuaCoHanWrap')).toBeHidden();
    await page.locator('#klCnMinhChung').fill(`Công văn 20/CV-VPTU ngày 10/9/2026 (${E2E_TAG})`);
    await page.locator('#klCnLuu').click();
    await expect(page.locator('#klCapNhatModal')).toBeHidden();
    await expect(row).toHaveAttribute('data-nhom', 'HOAN_THANH', NAP);
    const { data } = await db.from('nhiem_vu').select('tien_do_ma, han_xu_ly, ly_do_chua_co_han').eq('id', nv2Id).single();
    expect(data).toEqual({ tien_do_ma: 'HOAN_THANH', han_xu_ly: null, ly_do_chua_co_han: 'Phụ thuộc yếu tố bên ngoài (e2e)' });
  });

  test('ngăn chi tiết: tiến độ ghi "nhập bởi" chuyên viên, nguồn hệ thống, lịch sử có 4 thay đổi (kể cả xác nhận nhận việc)', async () => {
    await page.locator(`#klRow-${nvId}`).click();
    const ct = page.locator(`#klChiTiet-${nvId}`);
    await expect(ct).toBeVisible(NAP);
    await expect(ct.locator('.chi-tiet-them')).not.toHaveAttribute('open', ''); // bấm dòng: bảng căn cứ gập, chỉ đạo/minh chứng ở đầu ngăn
    await ct.locator('.chi-tiet-them > summary').click();
    await expect(ct).toContainText('nhập bởi Demo E2E Chuyên viên KL');
    await expect(ct).toContainText('Nhập trên hệ thống');
    // GĐ22: lịch sử nằm trong dòng thời gian "Diễn biến" (v_dien_bien) ngay trong ngăn, mới nhất trên đầu; có dòng tạo việc và xác nhận nhận việc.
    await expect(ct.locator('.dien-bien li').first()).toBeVisible();
    await expect(ct.locator(`#klDienBien-${nvId}`)).toContainText('Xác nhận đã nhận việc');
    await expect(ct.locator(`#klDienBien-${nvId}`)).toContainText('Tạo dòng');
    await expect(ct.locator('.luong-cd')).toContainText('chưa có'); // chưa có chỉ đạo → không có ô phản hồi
    await expect(ct.locator('input[name=noi_dung]')).toHaveCount(0);
  });
});

