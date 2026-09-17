// GĐ19/20 (CH-16, 0032) — chỉ đạo Thường trực trên giao diện v7: A0 mở việc ở Toàn bộ nhiệm vụ, chọn "Chỉ đạo" trên ô nhập chung → luồng
// có dòng CHI_DAO_TT chờ phản hồi, người nhận tự tính → "Chỉ đạo đã gửi" có dòng chờ → PCVP phụ trách (người nhận) thấy thẻ ở khối đầu
// "Điều hành hôm nay", bấm "Phản hồi Thường trực" → gửi → A0 thấy "Đã phản hồi" ở Chỉ đạo đã gửi. Dữ liệu ở phòng Quản trị (Owner/theo dõi
// demo_cv2, người nhận = Chánh VP + demo_pcvp2) vì không spec nào khác ghi ở đó (2 worker); hội nghị 991, tự dọn. Bỏ qua khi thiếu demo_a0.
import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs, contextAs, nav, moViec, NAP } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { OPTIONAL_USERS, storageStatePath } from './lib/roles.mjs';
import { E2E_TAG } from './global-setup.mjs';
import { khoaRieng, taoVanBanRieng, donVanBan } from './lib/du-lieu.mjs';

const CV2_ID = '00000000-0000-4000-8000-000000000005'; // demo_cv2 — chuyên viên phòng Quản trị
const SO_HOI_NGHI = 991;
const RT = { timeout: 20_000 };   // realtime trên gói Free có thể trễ vài giây

test.describe.serial('Chỉ đạo Thường trực — A0 gửi → PCVP phụ trách phản hồi → A0 thấy trạng thái', () => {
  let hnKhoa;
  let db; let nvId; let ma; let a0; let pcvp;

  test.beforeAll(async ({ browser }, testInfo) => {
    test.skip(!existsSync(storageStatePath('A0')), 'Chưa có demo_a0 trên project này.');
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('v_chi_dao_tt').select('id').limit(1);
    test.skip(Boolean(co.error), 'Project chưa có migration 0032 (chỉ đạo Thường trực).');
    hnKhoa = khoaRieng('TT', testInfo); // khoá riêng theo project: chạy lại / chạy dở / 2 worker không đụng nhau
    const hn = { id: await taoVanBanRieng(db, hnKhoa, { so_hoi_nghi: SO_HOI_NGHI }) };
    const { data: nv, error: e2 } = await db.from('nhiem_vu').insert({
      van_ban_id: hn.id, nguoi_theo_doi: CV2_ID, owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: CV2_ID,
      noi_dung: `${E2E_TAG} chỉ đạo Thường trực ${testInfo.project.name} ${Date.now()}`,
      loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31', nganh_ma: 'KINH_TE_TONG_HOP',
    }).select('id, ma').single();
    if (e2) throw new Error(`Tạo nhiệm vụ mẫu thất bại: ${e2.message}`);
    nvId = nv.id; ma = nv.ma;
    a0 = await (await contextAs(browser, 'A0', testInfo)).newPage(); // A0 là tài khoản tuỳ chọn (không trong USERS)
    await a0.goto('./');
    await expect(a0.locator('#currentUserDisplay')).toContainText(OPTIONAL_USERS.A0.fullName);
    pcvp = await pageAs(browser, 'PCVP2', testInfo);
  });
  test.afterAll(async () => {
    for (const p of [a0, pcvp]) await p?.context().close();
    if (db) await donVanBan(db, hnKhoa);
  });

  test('A0: ô nhập chung có "Ý kiến" / "Chỉ đạo"; gửi Chỉ đạo → dòng CHI_DAO_TT chờ phản hồi, người nhận tự tính; Chỉ đạo đã gửi có dòng', async () => {
    await moViec(a0, nvId, ma);
    const form = a0.locator(`#klChiDao-${nvId} form.cd-form`);
    await expect(form.locator('input[name=noi_dung]')).toBeVisible();
    await expect(form.locator('input[name=noi_dung]')).toBeEditable();
    await expect(form.locator('select[name=loai] option')).toHaveText(['Ý kiến', 'Chỉ đạo']);
    await expect(form.locator('input[name=han_phan_hoi]')).toBeHidden();
    await form.locator('select[name=loai]').selectOption('CHI_DAO_TT');
    await expect(form.locator('input[name=han_phan_hoi]')).toBeVisible(); // để trống = 2 ngày làm việc
    await form.locator('input[name=noi_dung]').click();
    await form.locator('input[name=noi_dung]').fill('Báo cáo Thường trực tiến độ trước thứ Sáu (e2e)');
    await form.locator('button[type=submit]').click();
    const goc = a0.locator(`#klChiDao-${nvId} .cd-goc[data-loai=CHI_DAO_TT]`);
    await expect(goc).toHaveCount(1, RT);
    await expect(goc).toHaveAttribute('data-trang-thai', 'CHO_PHAN_HOI', NAP);
    await expect(goc).toContainText('Chỉ đạo Thường trực');
    await expect(goc).toContainText('Người nhận: Demo Chánh Văn phòng, Demo Phó Chánh Văn phòng Hai');
    await expect(goc).toContainText('Hạn phản hồi');
    await expect(goc.locator('[data-action=dongChiDao]')).toHaveCount(1); // A0 đóng được luồng TT của mình (0032)
    await expect(goc.locator('.cd-form-ph')).toHaveCount(0);            // A0 không phản hồi
    await nav(a0, 'navChiDaoDaGui');
    const dong = a0.locator('#cdgDanhSach [id^="cdg-"]', { hasText: ma });
    await expect(dong).toHaveAttribute('data-trang-thai', 'CHO_PHAN_HOI', RT);
    await expect(dong).toContainText('Chờ phản hồi');
  });

  test('PCVP2: thẻ chỉ đạo Thường trực ở ĐẦU "Điều hành hôm nay"; Phản hồi Thường trực ngay tại thẻ → thẻ rời khối chờ', async () => {
    await nav(pcvp, 'navDieuHanh');
    const the = pcvp.locator('#dhTT article.viec', { hasText: ma });
    await expect(the).toBeVisible(RT);
    await expect(pcvp.locator('#dhTT h2')).toContainText('chỉ đạo của Thường trực đang chờ Văn phòng');
    expect((await the.boundingBox()).y).toBeLessThan((await pcvp.locator('#dhKpi').boundingBox()).y); // đầu trang, trên 4 số-lọc
    await expect(the).toContainText('Báo cáo Thường trực tiến độ trước thứ Sáu (e2e)');
    await expect(the.locator('[data-action=dongChiDao]')).toHaveCount(0); // người nhận không đóng luồng TT
    await the.getByRole('button', { name: 'Phản hồi Thường trực' }).click();
    const o = the.locator('form.o[data-submit=phanHoiThe]');
    await expect(o).toHaveClass(/\bmo\b/);
    await o.locator('input[name=noi_dung]').fill('Đã giao phòng Quản trị hoàn thiện, trình ngày mai (e2e)');
    await o.locator('button[type=submit]').click();
    await expect(pcvp.locator('#toastContainer')).toContainText('Đã gửi phản hồi');
    await expect(pcvp.locator('#dhTT article.viec', { hasText: ma })).toHaveCount(0, RT);
  });

  test('A0: Chỉ đạo đã gửi thấy "Đã phản hồi" kèm nội dung và người phản hồi', async () => {
    await nav(a0, 'navChiDaoDaGui');
    const dong = a0.locator('#cdgDanhSach [id^="cdg-"]', { hasText: ma });
    await expect(dong).toHaveAttribute('data-trang-thai', 'DA_PHAN_HOI', RT);
    await expect(dong).toContainText('Đã phản hồi');
    await expect(dong).toContainText('Đã giao phòng Quản trị hoàn thiện');
    await expect(dong).toContainText('Demo Phó Chánh Văn phòng Hai');
  });
});

