// GĐ16 (PR 16B; giao diện v7 GĐ20; v8 đợt 4 = 4 yếu tố): minh chứng có cấu trúc. Chuyên viên (người theo dõi) mở ngăn chi tiết → nút "Đóng nhiệm vụ"
// mờ khi chưa có minh chứng → nộp thiếu ngày, rồi thiếu trích yếu/mô tả bị chặn ở form → nộp đủ → khối hiện đủ 4 yếu tố, nút Đóng sáng → đóng →
// HOAN_THANH, lead time = 15 ngày; việc cũ có minh chứng
// chữ hiện nhãn "Minh chứng cũ". Dữ liệu mẫu tạo bằng service_role trong hội nghị 992, tự dọn.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs, nav, NAP } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { E2E_TAG } from './global-setup.mjs';
import { khoaRieng, taoVanBanRieng, donVanBan, kiemThayViec } from './lib/du-lieu.mjs';

const CV1_ID = '00000000-0000-4000-8000-000000000011'; // demo_e2e_mc — tài khoản riêng của spec (GĐ18)
const SO_HOI_NGHI = 992;

test.describe.serial('Nhiệm vụ — minh chứng có cấu trúc và đóng nhiệm vụ', () => {
  let hnKhoa;
  let db; let nvId; let cuId; let page;

  test.beforeAll(async ({ browser }, testInfo) => {
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('minh_chung').select('id').limit(1);
    test.skip(Boolean(co.error), 'Project chưa có migration 0028 (minh_chung).');
    hnKhoa = khoaRieng('MC', testInfo); // khoá riêng theo project: chạy lại / chạy dở / 2 worker không đụng nhau
    const hn = { id: await taoVanBanRieng(db, hnKhoa, { so_hoi_nghi: SO_HOI_NGHI }) };
    const base = { van_ban_id: hn.id, nguoi_theo_doi: CV1_ID, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31', nganh_ma: 'KINH_TE_TONG_HOP', owner_don_vi_ma: 'DANG_UY_UBND' };
    const { data: nv, error: e2 } = await db.from('nhiem_vu').insert({ ...base, noi_dung: `${E2E_TAG} MC theo 1400 ${Date.now()}`, theo_1400: true,
      ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, cap_nhan_san_pham: 'CHANH_VAN_PHONG' }).select('id').single();
    if (e2) throw new Error(`Tạo nhiệm vụ mẫu thất bại: ${e2.message}`);
    nvId = nv.id;
    const { data: cu, error: e3 } = await db.from('nhiem_vu').insert({ ...base, noi_dung: `${E2E_TAG} MC việc cũ ${Date.now()}`, theo_1400: false }).select('id').single();
    if (e3) throw new Error(`Tạo nhiệm vụ cũ thất bại: ${e3.message}`);
    cuId = cu.id;
    // Việc mẫu phải nằm trong phạm vi vai sẽ xem — kiểm ngay bằng token của vai, lỗi rõ ở beforeAll (không chờ 10 giây ở #klRow).
    await kiemThayViec('E2E_MC', nvId, 'MC theo 1400'); await kiemThayViec('E2E_MC', cuId, 'MC việc cũ');
    const { error: e4 } = await db.from('minh_chung').insert({ nhiem_vu_id: cuId, loai: 'chu_cu', noi_dung_chu: `Công văn 12/CV-VPTU ngày 10/08/2026 (${E2E_TAG})`, so_hieu: '12/CV-VPTU', ngay_van_ban: '2026-08-10' });
    if (e4) throw new Error(`Tạo minh chứng cũ thất bại: ${e4.message}`);
    page = await pageAs(browser, 'E2E_MC', testInfo);
  });
  test.afterAll(async () => {
    await page?.context().close();
    if (db) await donVanBan(db, hnKhoa);
  });

  test('chưa có minh chứng: nút Đóng mờ; nộp thiếu ngày rồi thiếu trích yếu/mô tả bị chặn ở form; nộp đủ → khối hiện 4 yếu tố, nút Đóng sáng', async () => {
    await nav(page, 'navKl');
    await expect(page.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP); // danh sách đã nạp xong
    const row = page.locator(`#klRow-${nvId}`);
    await expect(row).toBeVisible(NAP);
    await row.click();
    const ngan = page.locator(`#klChiTiet-${nvId}`);
    await expect(ngan.getByRole('button', { name: 'Đóng nhiệm vụ' })).toBeDisabled();
    const khoi = page.locator(`#klMinhChung-${nvId}`);
    await expect(khoi).toContainText('chưa có', NAP);
    await ngan.getByRole('button', { name: 'Nộp minh chứng' }).click();
    await expect(page.locator('#klMcModal')).toBeVisible();
    await expect(page.locator('#klMcCap')).toHaveValue('CHANH_VAN_PHONG'); // cấp nhận gợi ý = cấp nhận sản phẩm của nhiệm vụ
    await page.locator('#klMcSoHieu').fill('15/BC-VPTU');
    await page.locator('#klMcLuu').click();
    await expect(page.locator('#toastContainer')).toContainText('đủ ba trường');
    await expect(page.locator('#klMcModal')).toBeVisible();
    await page.locator('#klMcNgay').fill('2026-08-20');
    await page.locator('#klMcLuu').click(); // 0046: đủ ba ô cũ nhưng thiếu trích yếu + mô tả → chặn ở form, hộp vẫn mở
    await expect(page.locator('#toastContainer')).toContainText('trích yếu văn bản và mô tả kết quả');
    await expect(page.locator('#klMcModal')).toBeVisible();
    await page.locator('#klMcTrichYeu').fill('Báo cáo kết quả rà soát (e2e MC)');
    await page.locator('#klMcMoTaKq').fill('Đã rà soát, tổng hợp và gửi Chánh Văn phòng.');
    await expect(page.locator('#klMcDem')).toHaveText('44'); // đếm ký tự theo ô mô tả
    await page.locator('#klMcLuu').click();
    await expect(page.locator('#klMcModal')).toBeHidden();
    await expect(page.locator('#toastContainer')).toContainText('Đã nộp minh chứng');
    await expect(page.locator(`#klMinhChung-${nvId}`)).toContainText('1 hợp lệ / 1 đã nộp');
    await expect(page.locator(`#klMinhChung-${nvId} .mc-dong`)).toContainText('15/BC-VPTU');
    await expect(page.locator(`#klMinhChung-${nvId} .mc-dong .mc-trich-yeu`)).toHaveText('Báo cáo kết quả rà soát (e2e MC)');
    await expect(page.locator(`#klMinhChung-${nvId} .mc-dong .mc-mo-ta`)).toContainText('gửi Chánh Văn phòng');
    await expect(page.locator(`#klDienBien-${nvId}`)).toContainText('Nộp minh chứng 15/BC-VPTU · Báo cáo kết quả rà soát (e2e MC)');
    await expect(page.locator(`#klMinhChung-${nvId} .mc-dong`)).toContainText('Chưa xác nhận');
    await expect(page.locator(`#klMinhChung-${nvId} .mc-dong`).getByRole('button', { name: 'Xác nhận hợp lệ' })).toHaveCount(0); // người nộp không tự xác nhận
    await expect(page.locator(`#klChiTiet-${nvId}`).getByRole('button', { name: 'Đóng nhiệm vụ' })).toBeEnabled();
  });

  test('đóng nhiệm vụ: ngày gợi ý = ngày văn bản → HOAN_THANH, lead time 15 ngày, lịch sử có dòng đóng', async () => {
    await page.locator(`#klChiTiet-${nvId}`).getByRole('button', { name: 'Đóng nhiệm vụ' }).click();
    await expect(page.locator('#klDongModal')).toBeVisible();
    await expect(page.locator('#klDongNgay')).toHaveValue('2026-08-20');
    await page.locator('#klDongLuu').click();
    await expect(page.locator('#klDongModal')).toBeHidden();
    await expect(page.locator('#toastContainer')).toContainText('Đã đóng nhiệm vụ');
    const row = page.locator(`#klRow-${nvId}`);
    await expect(row).toHaveAttribute('data-nhom', 'HOAN_THANH', NAP);
    await expect(page.locator(`#klChiTiet-${nvId}`).getByRole('button', { name: 'Đóng nhiệm vụ' })).toHaveCount(0);
    await expect(page.locator(`#klChiTiet-${nvId}`)).toContainText('lead time 15 ngày', NAP);
    const { data } = await db.from('v_nhiem_vu').select('tien_do_ma, ngay_hoan_thanh, thieu_minh_chung, lead_time_ngay, so_minh_chung_hop_le').eq('id', nvId).single();
    expect(data).toEqual({ tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2026-08-20', thieu_minh_chung: false, lead_time_ngay: 15, so_minh_chung_hop_le: 1 });
    const { data: ls } = await db.from('lich_su').select('cot').eq('nhiem_vu_id', nvId).in('cot', ['minh_chung_nop', 'dong_nhiem_vu']);
    expect(ls.map((l) => l.cot).sort()).toEqual(['dong_nhiem_vu', 'minh_chung_nop']);
  });

  test('việc cũ: khối minh chứng hiện nhãn "Minh chứng cũ" với nguyên văn; nút Đóng sáng (chữ cũ hợp lệ)', async () => {
    await page.locator(`#klRow-${cuId}`).click();
    const ngan = page.locator(`#klChiTiet-${cuId}`);
    await expect(ngan.getByRole('button', { name: 'Đóng nhiệm vụ' })).toBeEnabled();
    const dong = page.locator(`#klMinhChung-${cuId} .mc-dong`);
    await expect(dong).toHaveAttribute('data-loai', 'chu_cu');
    await expect(dong.locator('.mc-loai')).toHaveText('Minh chứng cũ');
    await expect(dong).toContainText('Công văn 12/CV-VPTU ngày 10/08/2026');
  });
});

