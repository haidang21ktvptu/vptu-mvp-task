// GĐ22 — Thường trực (A0) giao việc trên biểu mẫu chung, bản rút gọn (ẩn người theo dõi, ngày nhận…; v8 đợt 4: khối văn bản hiện, để trống = mốc tự ghi; độ khẩn mặc định Khẩn) cho Chánh
// Văn phòng → DB: uu_tien THUONG_TRUC, do_khan KHAN, theo dõi = chính Chánh VP (0035) → Chánh VP thấy khối "Việc Thường trực giao" đầu Điều
// hành hôm nay với nhãn Thường trực giao + Khẩn, dải "Cần xử lý ngay" đếm việc mới → bấm Xác nhận đã nhận → khối biến mất, lich_su ghi vết.
// Bỏ qua khi thiếu demo_a0. Dữ liệu tự dọn (nhiệm vụ theo E2E_TAG, văn bản tự tạo của A0).
import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { contextAs, pageAs, nav, NAP } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { OPTIONAL_USERS, storageStatePath } from './lib/roles.mjs';
import { E2E_TAG } from './global-setup.mjs';

const CVP_ID = '00000000-0000-4000-8000-000000000001';
const A0_ID = '00000000-0000-4000-8000-000000000009';
const homNayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const congNgay = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

test.describe.serial('Thường trực giao việc → Chánh Văn phòng xác nhận đã nhận', () => {
  let db; let noiDung; let id; let duAn;

  test.beforeAll(async ({}, testInfo) => { // eslint-disable-line no-empty-pattern
    duAn = testInfo.project.name;
    test.skip(!existsSync(storageStatePath('A0')), 'Chưa có demo_a0 trên project này.');
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('kl_cau_hinh').select('khoa').eq('khoa', 'thuong_truc_han_nhan_ngay').maybeSingle();
    test.skip(!co.data, 'Project chưa có migration 0035+.');
    noiDung = `${E2E_TAG} TT giao ${duAn} ${Date.now()}`;
    await don(db, duAn);
  });
  test.afterAll(async () => { if (db) await don(db, duAn); });

  test('A0: biểu mẫu rút gọn, mặc định Khẩn; giao cho Chánh VP → uu_tien Thường trực, theo dõi = Chánh VP', async ({ browser }, testInfo) => {
    const context = await contextAs(browser, 'A0', testInfo);
    const page = await context.newPage();
    await page.goto('./');
    await expect(page.locator('#currentUserDisplay')).toContainText(OPTIONAL_USERS.A0.fullName);
    await nav(page, 'navGiaoViec');
    await expect(page.locator('#viewGiaoViec .gv-the')).toBeVisible();
    await expect(page.locator('#giaoViecForm')).toHaveAttribute('data-san-sang', '1', { timeout: 20_000 }); // biểu mẫu đã khởi tạo theo vai (mặc định Khẩn đặt sau khi phiên + danh mục sẵn sàng)
    await expect(page.locator('#klThVanBanWrap')).toBeVisible();         // v8 đợt 4: A0 nhập được văn bản; để trống số hiệu + ngày → DB ghi mốc "Thường trực giao …"
    await expect(page.locator('#klThVanBan')).toHaveValue('__moi__');
    await expect(page.locator('#gvVbA0')).toBeVisible();
    await expect(page.locator('#klThNguoiTheoDoiWrap')).toBeHidden();    // người theo dõi tự suy
    await expect(page.locator('#klThThayMatWrap')).toBeHidden();
    await expect(page.locator('#klThDoKhan')).toHaveValue('KHAN');
    await expect(page.locator('#giaoViecForm .dk-chon button[aria-pressed="true"]')).toHaveText(/Khẩn/);
    await expect(page.locator('#klThLuu')).toBeDisabled();
    await page.locator('#klThNoiDung').fill(noiDung);
    await page.locator('#klThOwner').selectOption(`tk:${CVP_ID}`);
    await page.locator('#klThSanPham').selectOption('BAO_CAO');
    await page.locator('#klThHan').fill(congNgay(homNayVN(), 10));
    await expect(page.locator('#gvTomTatChu')).toContainText('độ khẩn Khẩn');
    await expect(page.locator('#klThLuu')).toBeEnabled();
    await page.locator('#klThLuu').click();
    await expect(page.locator('#toastContainer')).toContainText('Đã giao việc NV-');
    const { data } = await db.from('nhiem_vu').select('id, uu_tien, do_khan, owner_tai_khoan, nguoi_theo_doi, tao_boi, theo_1400').eq('noi_dung', noiDung).single();
    expect(data).toMatchObject({ uu_tien: 'THUONG_TRUC', do_khan: 'KHAN', owner_tai_khoan: CVP_ID, nguoi_theo_doi: CVP_ID, tao_boi: A0_ID, theo_1400: true });
    id = data.id;
    await expect(page.locator(`#klRow-${id}`)).toContainText('Thường trực giao', NAP); // sang Nhiệm vụ: dòng có nhãn
    await context.close();
  });

  // v3.8.1: A0 giao từ Kết luận BTV → giao_viec bắt buộc ngành + lĩnh vực → biểu mẫu phải hiện Ngành/Lĩnh vực/Ngày nhận/Loại hạn và tính vào "Còn thiếu".
  test('A0 giao việc từ Kết luận BTV: thiếu ngành → nút mờ, "Còn thiếu" ghi ngành; chọn ngành + lĩnh vực → giao thành công', async ({ browser }, testInfo) => {
    const context = await contextAs(browser, 'A0', testInfo);
    const page = await context.newPage();
    const soKL = `E2E-TEST-TTKL-${duAn}`; const nd = `${E2E_TAG} TT giao ${duAn} từ KL ${Date.now()}`;
    await page.goto('./');
    await expect(page.locator('#currentUserDisplay')).toContainText(OPTIONAL_USERS.A0.fullName);
    await nav(page, 'navGiaoViec');
    await expect(page.locator('#giaoViecForm')).toHaveAttribute('data-san-sang', '1', { timeout: 20_000 });
    await expect(page.locator('#gvNganhWrap')).toBeHidden(); // chưa nhập văn bản → giao trực tiếp (văn bản KHAC), không đòi ngành
    await page.locator('#klThLoaiVB').selectOption('KL_BTV');
    await page.locator('#klThSoHN').fill('99'); await page.locator('#klThSoKL').fill(soKL); await page.locator('#klThNgayBH').fill(congNgay(homNayVN(), -3));
    await expect(page.locator('#gvNganhWrap')).toBeVisible();
    await expect(page.locator('#klThNgayNhanWrap')).toBeVisible();
    await expect(page.locator('#klThLoaiWrap')).toBeVisible();
    await page.locator('#klThNoiDung').fill(nd);
    await page.locator('#klThOwner').selectOption(`tk:${CVP_ID}`);
    await page.locator('#klThSanPham').selectOption('BAO_CAO');
    await page.locator('#klThHan').fill(congNgay(homNayVN(), 10));
    await expect(page.locator('#klThLuu')).toBeDisabled();
    await expect(page.locator('#gvConThieu')).toContainText('ngành');
    await page.locator('#klThNganh').selectOption('KINH_TE_TONG_HOP');
    await page.locator('#klThLinhVuc').selectOption('LV08_TAI_CHINH');
    await expect(page.locator('#gvConThieu')).toHaveText('');
    await expect(page.locator('#klThLuu')).toBeEnabled();
    await page.locator('#klThLuu').click();
    await expect(page.locator('#toastContainer')).toContainText('Đã giao việc NV-');
    const { data } = await db.from('nhiem_vu').select('nganh_ma, linh_vuc_ma, uu_tien, van_ban_giao_viec(loai, so_ket_luan)').eq('noi_dung', nd).single();
    expect(data).toMatchObject({ nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_ma: 'LV08_TAI_CHINH', uu_tien: 'THUONG_TRUC', van_ban_giao_viec: { loai: 'KL_BTV', so_ket_luan: soKL } });
    await context.close();
  });

  test('Chánh VP: khối "Việc Thường trực giao" đầu trang với nhãn Thường trực giao + Khẩn; dải Cần xử lý; Xác nhận đã nhận → khối biến mất', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A1', testInfo);
    const the = page.locator(`#tt-viec-${id}`);
    await expect(the).toBeVisible({ timeout: 15_000 });
    await expect(the).toContainText(noiDung, NAP);
    await expect(the.locator('.nhan-tt')).toHaveText('Thường trực giao');
    await expect(the.locator('.dk-khan')).toContainText('Khẩn');
    await expect(page.locator('#dhCanXuLy')).toContainText('việc mới chờ xác nhận');
    await expect(page.locator('#dhBadge')).toBeVisible();
    await the.getByRole('button', { name: 'Xác nhận đã nhận' }).click();
    await expect(page.locator('#toastContainer')).toContainText('Đã xác nhận nhận việc');
    await expect(page.locator(`#tt-viec-${id}`)).toHaveCount(0);
    const ls = await db.from('lich_su').select('id').eq('nhiem_vu_id', id).eq('cot', 'xac_nhan_nhan_viec').eq('nguoi_sua', CVP_ID);
    expect(ls.data.length).toBe(1);
    await page.context().close();
  });
});

// Việc của project này (nội dung có tên project); văn bản "Thường trực giao …" do app đặt tên (không gắn tag được) chỉ xoá khi không còn nhiệm vụ.
async function don(db, duAn) {
  await db.from('nhiem_vu').delete().like('noi_dung', `${E2E_TAG} TT giao ${duAn}%`);
  await db.from('van_ban_giao_viec').delete().eq('so_ket_luan', `E2E-TEST-TTKL-${duAn}`); // văn bản KL do A0 nhập trên biểu mẫu (v3.8.1)
  const { data } = await db.from('van_ban_giao_viec').select('id, nhiem_vu(id)').eq('tao_boi', A0_ID).like('so_ket_luan', 'Thường trực giao %');
  for (const vb of data || []) if (!vb.nhiem_vu?.length) await db.from('van_ban_giao_viec').delete().eq('id', vb.id);
}
