// Kịch bản 4–5 (viết lại GĐ14; giao diện v7 GĐ20): A2 giao việc trên trang ba bước (Owner = chuyên viên phòng mình, sản phẩm, hạn) → A3 thấy
// thẻ "Việc mới giao — cần xác nhận đã nhận" ở đầu "Việc của tôi" (chỉ việc theo 1400; thay modal bắt buộc), xác nhận không đổi hạn/trạng
// thái → việc theo 1400 không chọn Hoàn thành ở Cập nhật, nút Đóng mờ khi chưa có minh chứng. Kèm: việc cũ (theo_1400 = false) không hiện thẻ
// cần xác nhận, chỉ có nút xác nhận tuỳ chọn ở ngăn chi tiết.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs, nav, moViec, NAP } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { E2E_TAG } from './global-setup.mjs';
import { khoaRieng, taoVanBanRieng, donVanBan, kiemThayViec } from './lib/du-lieu.mjs';

const CV1_ID = '00000000-0000-4000-8000-000000000012'; // demo_e2e_nv — tài khoản riêng của spec (GĐ18)
const SO_HOI_NGHI = 994;
const homNayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const congNgay = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

test.describe.serial('Luồng giao việc → xác nhận nhận việc trên thẻ → hoàn thành', () => {
  let db; let title; let cuId; let cuMa; let moiId; let moiMa; let hnKhoa; let duAn;

  test.beforeAll(async ({}, testInfo) => { // eslint-disable-line no-empty-pattern
    duAn = testInfo.project.name;
    title = `${E2E_TAG} giao-nhan ${duAn} ${Date.now()}`; // nhãn riêng: "giao%" từng khớp cả "giao việc" của kl-them-nhiem-vu (2 worker mobile → xoá nhầm)
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    await don(db, duAn);
    // Việc CŨ (theo_1400 = false, dữ liệu chuyển đổi) của demo_e2e_nv: không được hiện thẻ cần xác nhận.
    hnKhoa = khoaRieng('KL994', testInfo);
    const hn = { id: await taoVanBanRieng(db, hnKhoa, { so_hoi_nghi: SO_HOI_NGHI }) };
    const { data: cu, error: e2 } = await db.from('nhiem_vu').insert({ van_ban_id: hn.id, nguoi_theo_doi: CV1_ID, noi_dung: `${E2E_TAG} việc cũ ${Date.now()}`,
      loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31', nganh_ma: 'KINH_TE_TONG_HOP', owner_don_vi_ma: 'DANG_UY_UBND' }).select('id, ma').single();
    if (e2) throw new Error(`Tạo việc cũ thất bại: ${e2.message}`);
    cuId = cu.id; cuMa = cu.ma;
    // Việc mẫu phải nằm trong phạm vi vai sẽ xem — kiểm ngay bằng token của vai, lỗi rõ ở beforeAll (không chờ 10 giây ở #klRow).
    await kiemThayViec('E2E_NV', cuId, cuMa);
  });
  test.afterAll(async () => { if (db) { await don(db, duAn); await donVanBan(db, hnKhoa); } });

  test('Kịch bản 4a: A3 có việc cũ chưa xác nhận → KHÔNG có thẻ cần xác nhận, chỉ nút xác nhận tuỳ chọn ở ngăn chi tiết', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'E2E_NV', testInfo);
    await expect(page.locator('#vctTom')).toContainText('việc cần làm', NAP);
    await expect(page.locator('#vctMuc-moi')).toHaveCount(0);
    await moViec(page, cuId, cuMa);
    await expect(page.locator('#klChipLoc')).toContainText('Việc của tôi');
    const ngan = page.locator(`#klChiTiet-${cuId}`);
    await expect(ngan).toContainText('chưa xác nhận nhận việc', NAP);
    await expect(ngan.getByRole('button', { name: 'Xác nhận đã nhận việc' })).toBeVisible();
    await page.context().close();
  });

  test('Kịch bản 4: A2 giao việc trên trang ba bước cho chuyên viên phòng mình', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A2', testInfo);
    await nav(page, 'navGiaoViec');
    await expect(page.locator('#viewGiaoViec')).toBeVisible();
    await page.locator('#klThVanBan').selectOption('__moi__');
    await page.locator('#klThLoaiVB').selectOption('CONG_VAN');
    await expect(page.locator('#klThSoHNWrap')).toBeHidden();   // công văn không có số hội nghị
    await page.locator('#klThSoKL').fill(`${E2E_TAG}-CV-${duAn}-${Date.now()}`);
    await page.locator('#klThNgayBH').fill(homNayVN());
    await page.locator('#klThNoiDung').fill(title);
    await page.locator('#klThOwner').selectOption(`tk:${CV1_ID}`);
    await expect(page.locator('#klThCapNhan')).toHaveValue('TRUONG_PHONG');
    await page.locator('#klThSanPham').selectOption('BAO_CAO');
    await page.locator('#klThSanPhamMoTa').fill('Báo cáo tham mưu (e2e)');
    await page.locator('#klThHan').fill(congNgay(homNayVN(), 3));
    await page.locator('#klThLuu').click();
    await expect(page.locator('#toastContainer')).toContainText('Đã giao việc NV-');
    await expect(page.locator('#viewKl')).toBeVisible();
    const { data } = await db.from('nhiem_vu').select('id, ma, theo_1400, owner_tai_khoan, nguoi_theo_doi').eq('noi_dung', title).single();
    expect(data).toMatchObject({ theo_1400: true, owner_tai_khoan: CV1_ID, nguoi_theo_doi: '00000000-0000-4000-8000-000000000003' });
    moiId = data.id; moiMa = data.ma;
    const row = page.locator(`#klRow-${moiId}`);
    await expect(row).toBeVisible(NAP);
    await expect(row).toContainText('Demo E2E Chuyên viên NV');
    await expect(row).toHaveAttribute('data-muc', 'VANG'); // còn 3 ngày, chưa có minh chứng → VÀNG (CN-4.1)
    await expect(row).toHaveClass(/\bvang\b/);
    await page.context().close();
  });

  test('Kịch bản 5: A3 xác nhận đã nhận việc trên thẻ (hạn, trạng thái không đổi); việc theo 1400 không chọn Hoàn thành ở Cập nhật, nút Đóng mờ', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'E2E_NV', testInfo);
    const muc = page.locator('#vctMuc-moi');
    await expect(muc).toBeVisible(NAP);
    await expect(muc).toContainText('Việc mới giao — cần xác nhận đã nhận');
    const the = page.locator(`#vct-${moiId}`);
    await expect(the).toContainText(title, NAP);
    const truoc = (await db.from('nhiem_vu').select('han_xu_ly, tien_do_ma').eq('id', moiId).single()).data;
    await the.getByRole('button', { name: 'Xác nhận đã nhận việc' }).click();
    await expect(page.locator('#toastContainer')).toContainText('Đã xác nhận nhận việc');
    await expect(page.locator('#vctMuc-moi')).toHaveCount(0);
    expect((await db.from('nhiem_vu').select('han_xu_ly, tien_do_ma').eq('id', moiId).single()).data).toEqual(truoc);
    // Việc Vàng chưa có minh chứng → thẻ "Sắp đến hạn" có ô nộp 3 trường ngay trên thẻ.
    await expect(page.locator(`#vctMuc-minh-chung #vct-${moiId} form.mc-inline`)).toBeVisible(NAP);

    // GĐ16 (16B): việc theo 1400 đóng bằng "Đóng nhiệm vụ" sau khi nộp minh chứng có cấu trúc; modal Cập nhật không có Hoàn thành; nút Đóng mờ.
    await moViec(page, moiId, moiMa); // GĐ22: nút Xem trên thẻ mở diễn biến tại chỗ; ngăn chi tiết mở từ màn hình Nhiệm vụ
    const ngan = page.locator(`#klChiTiet-${moiId}`);
    await expect(ngan).toBeVisible(NAP);
    await expect(ngan).toContainText('đã nhận việc');
    await expect(ngan.getByRole('button', { name: 'Đóng nhiệm vụ' })).toBeDisabled();
    await ngan.getByRole('button', { name: 'Cập nhật' }).click();
    await expect(page.locator('#klCapNhatModal')).toBeVisible();
    await expect(page.locator('#klCnTienDo option[value="HOAN_THANH"]')).toHaveCount(0);
    await expect(page.locator('#klCnMinhChungWrap')).toBeHidden();
    await expect(page.locator('#klCnGhiChu1400')).toBeVisible();
    await page.locator('#klCapNhatModal').getByRole('button', { name: 'Huỷ' }).click();
    await expect(page.locator('#klCapNhatModal')).toBeHidden();
    await page.context().close();
  });
});

// Chỉ dọn dữ liệu của project này (việc giao qua giao diện + văn bản CV của nó); văn bản KL994 dọn theo khoá riêng (donVanBan).
async function don(db, duAn) {
  await db.from('nhiem_vu').delete().like('noi_dung', `${E2E_TAG} giao-nhan ${duAn}%`);
  await db.from('van_ban_giao_viec').delete().like('so_ket_luan', `${E2E_TAG}-CV-${duAn}-%`);
}
