// Kịch bản 12 (GĐ15; giao diện v7 GĐ20): điều hành ngoại lệ — A1 mở "Điều hành hôm nay" → thẻ việc Đỏ (4 điều: ai chậm, trễ bao nhiêu, thiếu
// sản phẩm gì, cấp cần quyết; khâu "Chưa nhận việc") → Đôn đốc ngay tại thẻ → A3 (người theo dõi) nhận chuông + toast realtime → mở nhiệm
// vụ từ toast, phản hồi → A1 thấy phản hồi realtime trong ngăn chi tiết, đóng chỉ đạo → chọn cấp cần quyết định tại ngăn → lịch sử ghi.
// Kiểm màu/lớp trên bản build (Tailwind giữ lớp trong @layer components). Nhiệm vụ mẫu ở hội nghị 993 (E2E), Owner = phòng Tổng hợp, tự dọn.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs, nav, moViec } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { E2E_TAG } from './global-setup.mjs';
import { khoaRieng, taoVanBanRieng, donVanBan, kiemThayViec } from './lib/du-lieu.mjs';

const CV1_ID = '00000000-0000-4000-8000-000000000013'; // demo_e2e_dh — tài khoản riêng của spec (GĐ18)
const SO_HOI_NGHI = 993;
const RT = { timeout: 20_000 };   // realtime trên gói Free có thể trễ vài giây

test.describe.serial('Điều hành ngoại lệ — thẻ việc Đỏ, đôn đốc, phản hồi, chuông, cấp quyết định', () => {
  let hnKhoa;
  let db; let nvId; let ma; let a1; let a3;

  test.beforeAll(async ({ browser }, testInfo) => {
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('v_ngoai_le').select('khau').limit(1);
    test.skip(Boolean(co.error), 'Project chưa có migration 0033 (v_ngoai_le.khau).');
    await db.from('direct_messages').delete().eq('receiver_id', CV1_ID).eq('loai', 'he_thong'); // chuông A3 (tài khoản riêng) bắt đầu từ 0
    hnKhoa = khoaRieng('DH', testInfo); // khoá riêng theo project: chạy lại / chạy dở / 2 worker không đụng nhau
    const hn = { id: await taoVanBanRieng(db, hnKhoa, { so_hoi_nghi: SO_HOI_NGHI }) };
    const { data: nv, error: e2 } = await db.from('nhiem_vu').insert({
      van_ban_id: hn.id, nguoi_theo_doi: CV1_ID, noi_dung: `${E2E_TAG} ngoại lệ ${testInfo.project.name} ${Date.now()}`,
      loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-08-15', nganh_ma: 'KINH_TE_TONG_HOP', owner_don_vi_ma: 'TONG_HOP',
      theo_1400: true, ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, // 0033: khâu "Chưa nhận việc" chỉ với việc theo quy tắc 1400
    }).select('id, ma').single();
    if (e2) throw new Error(`Tạo nhiệm vụ mẫu thất bại: ${e2.message}`);
    nvId = nv.id; ma = nv.ma;
    // Việc mẫu phải nằm trong phạm vi vai sẽ xem — kiểm ngay bằng token của vai, lỗi rõ ở beforeAll (không chờ 10 giây ở #klRow).
    await kiemThayViec('A1', nvId, ma); await kiemThayViec('E2E_DH', nvId, ma);
    a1 = await pageAs(browser, 'A1', testInfo);
    a3 = await pageAs(browser, 'E2E_DH', testInfo);
  });
  test.afterAll(async () => {
    for (const p of [a1, a3]) await p?.context().close();
    if (db) await donVanBan(db, hnKhoa);
  });

  test('Điều hành hôm nay (A1): thẻ Đỏ đủ 4 điều, khâu "Chưa nhận việc", sản phẩm "chưa định nghĩa", cấp "chưa xác định"; màu đỏ trên bản build', async () => {
    const the = a1.locator(`#the-${nvId}`);
    await expect(the).toBeVisible();
    await expect(the).toHaveAttribute('data-muc', 'DO_DAC_BIET');
    await expect(the).toHaveAttribute('data-khau', 'CHUA_NHAN');
    await expect(the).toContainText('Phòng Tổng hợp');
    await expect(the).toContainText('Demo E2E Chuyên viên DH');
    await expect(the.locator('.khau')).toHaveText('Chưa nhận việc');
    await expect(the).toContainText('Chưa ai xác nhận đã nhận việc');
    await expect(the).toContainText('chưa xác định');
    expect(Number((await the.locator('.tre').innerText()).split('\n')[0])).toBeGreaterThan(3);
    await expect.poll(() => the.locator('.tre').evaluate((el) => globalThis.getComputedStyle(el).color)).toBe('rgb(212, 32, 24)'); // --do
    await expect.poll(() => the.evaluate((el) => globalThis.getComputedStyle(el).borderLeftColor)).toBe('rgb(168, 20, 15)');      // --do-dam: Đỏ đặc biệt
    await expect(a1.locator('#dhRay [data-khau="CHUA_NHAN"] b')).not.toHaveText('0');
    await expect(a3.locator('#chuongBadge')).toBeHidden();
    // GĐ22: Xem diễn biến mở dòng thời gian ngay dưới thẻ (v_dien_bien: có dòng tạo việc), không rời Điều hành; bấm lại để gập.
    await the.locator('[data-action=xemDienBien]').click();
    await expect(a1.locator('#viewDieuHanh')).toBeVisible();
    await expect(the.locator(`#db-${nvId} .dien-bien li`).first()).toBeVisible();
    await the.locator('[data-action=xemDienBien]').click();
    await expect(the.locator(`#db-${nvId}`)).toHaveCount(0);
    await expect(the).toBeVisible();
  });

  test('A1 Đôn đốc tại thẻ → A3 nhận chuông + toast realtime, mở nhiệm vụ từ toast và phản hồi', async () => {
    const the = a1.locator(`#the-${nvId}`);
    await the.getByRole('button', { name: 'Đôn đốc' }).click();
    const o = the.locator('form.o');
    await expect(o).toHaveClass(/\bmo\b/);
    await expect(o.locator('input[name=noi_dung]')).toBeFocused();
    await o.locator('input[name=noi_dung]').fill('Khẩn trương hoàn thành trong tuần (e2e)');
    await o.locator('button[type=submit]').click();
    await expect(a1.locator('#toastContainer')).toContainText('Đã gửi đôn đốc');
    await expect(a1.locator(`#the-${nvId} .vong`)).toContainText('1 chỉ đạo điều hành chờ phản hồi', RT);

    // A3: toast + huy hiệu chuông (tin hệ thống cho người theo dõi), chuông gom theo việc.
    await expect(a3.locator('#realtimeToast')).toBeVisible(RT);
    await expect(a3.locator('#toastSender')).toHaveText('Thông báo trên nhiệm vụ');
    await expect(a3.locator('#toastContent')).toContainText('Đôn đốc · NV-');
    await expect(a3.locator('#chuongBadge')).toHaveText('1');
    await expect(a3.locator(`#thongBaoList [data-nv="${nvId}"]`)).toHaveCount(1);
    await a3.locator('#toastActionBtn').click();
    const luongA3 = a3.locator(`#klChiDao-${nvId}`);
    await expect(luongA3.locator('.cd-goc')).toContainText('Khẩn trương hoàn thành trong tuần (e2e)');
    await expect(a3.locator('#chuongBadge')).toBeHidden();
    await expect(luongA3.locator('.cd-form')).toHaveCount(0); // A3 không có ô ra chỉ đạo
    await expect(luongA3.locator('.cd-form-ph')).toHaveClass(/cd-form-dau/); // ô phản hồi ở đầu khối
    await luongA3.locator('.cd-form-ph input[name=noi_dung]').fill('Đã trình dự thảo, chờ ký (e2e)');
    await luongA3.locator('.cd-form-ph button[type=submit]').click();
    await expect(luongA3.locator('.cd-ph')).toHaveCount(1, RT);
  });

  test('A1 thấy phản hồi realtime trong ngăn chi tiết, đóng chỉ đạo; chuông A1 gom theo việc', async () => {
    await moViec(a1, nvId, ma);
    const goc = a1.locator(`#klChiDao-${nvId} .cd-goc`);
    await expect(goc.locator('.cd-ph')).toContainText('Đã trình dự thảo, chờ ký (e2e)', RT);
    await expect(goc).toHaveAttribute('data-trang-thai', 'DA_PHAN_HOI');
    await expect.poll(() => goc.evaluate((el) => globalThis.getComputedStyle(el).borderLeftColor)).toBe('rgb(30, 142, 90)'); // --luc: đã phản hồi (bản build)
    await expect(a1.locator(`#thongBaoList [data-nv="${nvId}"]`)).toHaveCount(1, RT); // gom theo nhiệm vụ: spec chi-dao-tt (worker kia) cũng gửi tin cho demo_cvp
    await goc.locator('[data-action=dongChiDao]').click();
    await expect(a1.locator(`#klChiDao-${nvId} .cd-goc`)).toHaveAttribute('data-trang-thai', 'DA_DONG', RT);
    await expect(a1.locator(`#klChiDao-${nvId} .cd-form-ph`)).toHaveCount(0);
  });

  test('Chọn cấp cần quyết định tại ngăn chi tiết → thẻ điều hành không còn "chưa xác định", lịch sử ghi', async () => {
    const sel = a1.locator(`#klChiTiet-${nvId} select.nl-cap`);
    await expect(sel).toHaveValue('');
    await sel.selectOption('CHANH_VAN_PHONG');
    await expect(a1.locator('#toastContainer')).toContainText('Đã xác định cấp cần quyết định');
    await expect(a1.locator(`#klChiTiet-${nvId} select.nl-cap`)).toHaveValue('CHANH_VAN_PHONG', RT);
    await nav(a1, 'navDieuHanh');
    await expect(a1.locator(`#the-${nvId}`)).toContainText('Chánh Văn phòng', RT);
    await expect(a1.locator(`#the-${nvId} .ten b`)).toContainText('cần Văn phòng quyết');
    const { data: ls } = await db.from('lich_su').select('cot, gia_tri_moi').eq('nhiem_vu_id', nvId).eq('cot', 'cap_quyet_dinh');
    expect(ls.map((l) => l.gia_tri_moi)).toEqual(['CHANH_VAN_PHONG']);
  });
});

