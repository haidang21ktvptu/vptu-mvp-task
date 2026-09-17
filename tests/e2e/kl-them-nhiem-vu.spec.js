// Kịch bản 12 (GĐ10 PR 10F, viết lại GĐ14; giao diện v7 GĐ20): người có quan_tri_kl giao việc trên trang ba bước — văn bản mới (loại, số
// hội nghị, số hiệu, ngày BH), chịu trách nhiệm (Owner) là cán bộ → cấp nhận tự điền, thiếu sản phẩm bị chặn ngay ở form, đủ Owner + Product
// + Deadline → sang Nhiệm vụ với dòng XANH (mép trái lam), theo_1400. Cấp cờ quan_tri_kl tạm cho demo_qtht bằng service_role, thu lại sau.
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { getKeys } from './lib/keys.mjs';
import { OPTIONAL_USERS, storageStatePath } from './lib/roles.mjs';
import { contextAs, nav, NAP } from './lib/app.js';
import { E2E_TAG } from './global-setup.mjs';
import { khoaRieng, donVanBan } from './lib/du-lieu.mjs';

const QTHT_ID = '00000000-0000-4000-8000-000000000008';
const CV1_ID = '00000000-0000-4000-8000-000000000014'; // demo_e2e_owner — Owner dữ liệu dùng chung với kl-realtime (GĐ18)
const TRUONG_PHONG_ID = '00000000-0000-4000-8000-000000000003'; // demo_truongphong — lãnh đạo được giao thay mặt (GĐ22)
const SO_HOI_NGHI = 995;
// Việc mốc cố định cho tài khoản demo_qtht (mã E2E-TNV-MOC, văn bản HN 990): tạo idempotent, KHÔNG dọn ở afterAll để project mobile chạy sau
// desktop vẫn có dòng để nhận biết danh sách đã nạp (global-setup dọn E2E-TEST% ở đầu mỗi lần chạy; bộ "dữ liệu thử" cũng dọn).
const MOC_MA = 'E2E-TNV-MOC'; const MOC_HN = 990; // số hội nghị riêng, không spec nào dọn theo số này
async function taoViecMoc(db) {
  const co = await db.from('nhiem_vu').select('id').eq('ma', MOC_MA).maybeSingle();
  if (co.data) return co.data.id;
  let vb = (await db.from('van_ban_giao_viec').select('id').eq('so_hoi_nghi', MOC_HN).maybeSingle()).data;
  if (!vb) {
    const r = await db.from('van_ban_giao_viec').insert({ so_hoi_nghi: MOC_HN, so_ket_luan: `${E2E_TAG}-TNV-MOC`, ngay_ban_hanh: '2026-08-01' }).select('id').single();
    if (r.error) throw new Error(`Tạo văn bản mốc thất bại: ${r.error.message}`); vb = r.data;
  }
  const n = await db.from('nhiem_vu').insert({ ma: MOC_MA, van_ban_id: vb.id, nguoi_theo_doi: QTHT_ID, noi_dung: `${E2E_TAG} TNV-MOC việc mốc của demo_qtht`,
    loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31', nganh_ma: 'KINH_TE_TONG_HOP' }).select('id').single();
  if (n.error) throw new Error(`Tạo việc mốc thất bại: ${n.error.message}`);
  return n.data.id;
}
const homNayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

test.describe.serial('Giao việc ba bước một trang (quan_tri_kl)', () => {
  let db; let page; let mocId; let vbKhoa;

  test.beforeAll(async ({ browser }, testInfo) => {
    test.skip(!existsSync(storageStatePath('QTHT')), 'Chưa có demo_qtht trên project này.');
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('nhiem_vu').select('id').limit(1);
    test.skip(Boolean(co.error), 'Project chưa có migration 0023+ (thực thể thống nhất).');
    vbKhoa = khoaRieng('995', testInfo); // văn bản sẽ tạo qua giao diện ở test 1 — khoá riêng theo project
    await donVanBan(db, vbKhoa);         // dấu vết lần chạy dở trước của chính khoá này
    mocId = await taoViecMoc(db);
    await db.from('accounts').update({ quan_tri_kl: true }).eq('id', QTHT_ID);
    const context = await contextAs(browser, 'QTHT', testInfo); // phiên riêng của demo_qtht (CI-4)
    page = await context.newPage();
    await page.goto('./');
    await expect(page.locator('#currentUserDisplay')).toContainText(OPTIONAL_USERS.QTHT.fullName);
  });
  test.afterAll(async () => {
    await page?.context().close();
    if (db) { await donVanBan(db, vbKhoa); await db.from('accounts').update({ quan_tri_kl: false }).eq('id', QTHT_ID); }
  });

  // eslint-disable-next-line no-empty-pattern
  test('biểu mẫu một khối: thiếu sản phẩm → nút Giao mờ, chấm 3 chưa sáng; văn bản mới + Owner cán bộ + thay mặt + sản phẩm + hạn → dòng XANH theo 1400, cấp nhận = Trưởng phòng', async ({}, testInfo) => {
    await nav(page, 'navKl');
    await expect(page.locator('#klNutThem')).toBeVisible();
    await expect(page.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP); // danh sách đã nạp xong (không dựa vào "có dòng đầu")
    await expect(page.locator(`#klRow-${mocId}`)).toBeVisible(NAP);           // việc mốc của tài khoản này có mặt
    await page.locator('#klNutThem').click();
    await expect(page.locator('#viewGiaoViec')).toBeVisible();
    await expect(page.locator('#viewKl')).toBeHidden();
    await expect(page.locator('#viewGiaoViec .gv-the')).toHaveCount(1);          // GĐ22: một thẻ, ba phần nối tiếp
    await expect(page.locator('#viewGiaoViec .gv-phan')).toHaveCount(3);
    await expect(page.locator('#klThThayMatWrap')).toBeVisible();               // người giao không phải lãnh đạo → ô Thay mặt bắt buộc
    await expect(page.locator('#klThDoKhan')).toHaveValue('THUONG');
    await page.locator('#klThVanBan').selectOption('__moi__');
    await expect(page.locator('#klThSoHNWrap')).toBeVisible();   // KL_BTV mặc định → có số hội nghị
    await page.locator('#klThSoHN').fill(String(SO_HOI_NGHI));
    await page.locator('#klThSoKL').fill(vbKhoa);
    await page.locator('#klThNgayBH').fill('2026-09-01');
    const noiDung = `${E2E_TAG} giao việc ${testInfo.project.name} ${Date.now()}`;
    await page.locator('#klThNoiDung').fill(noiDung);
    await page.locator('#klThOwner').selectOption(`tk:${CV1_ID}`);          // demo_e2e_owner (A3, Tổng hợp)
    await expect(page.locator('#klThCapNhan')).toHaveValue('TRUONG_PHONG'); // cấp trên Owner tự điền
    await expect(page.locator('#klThNgayNhan')).toHaveValue(homNayVN());   // ngày nhận mặc định hôm nay VN
    await page.locator('#klThNganh').selectOption('KINH_TE_TONG_HOP');
    await page.locator('#klThLinhVuc').selectOption('LV08_TAI_CHINH');
    await page.locator('#klThHan').fill('2026-12-31');
    await page.locator('#klThThayMat').selectOption(TRUONG_PHONG_ID);          // thay mặt Trưởng phòng Tổng hợp (cùng phòng Owner)
    await expect(page.locator('#gvCham1')).toHaveClass(/\bxong\b/);
    await expect(page.locator('#gvCham2')).toHaveClass(/\bxong\b/);
    await expect(page.locator('#gvCham3')).not.toHaveClass(/\bxong\b/);        // thiếu sản phẩm
    await expect(page.locator('#klThLuu')).toBeDisabled();
    await expect(page.locator('#gvTomTatChu')).toContainText('sản phẩm …');
    await page.locator('#klThSanPham').selectOption('TO_TRINH');
    await page.locator('#klThSanPhamMoTa').fill('Tờ trình thử nghiệm e2e');
    await expect(page.locator('#gvCham3')).toHaveClass(/\bxong\b/);
    await expect(page.locator('#gvTomTatChu')).toContainText('sản phẩm Tờ trình, độ khẩn Thường');
    await expect(page.locator('#klThLuu')).toBeEnabled();
    await page.locator('#klThLuu').click();
    await expect(page.locator('#toastContainer')).toContainText('Đã giao việc NV-');
    await expect(page.locator('#viewKl')).toBeVisible(); // sau khi giao: sang Nhiệm vụ, lọc theo mã vừa giao
    const { data } = await db.from('nhiem_vu').select('id, ma, nguon, theo_1400, owner_tai_khoan, owner_don_vi_ma, san_pham_loai, cap_nhan_san_pham, ngay_nhan_van_ban, ngay_nhan_uoc_tinh, nguoi_theo_doi, tao_boi, do_khan, giao_thay_mat_cho')
      .eq('noi_dung', noiDung).single(); // đúng dòng vừa tạo, không lấy 'mới nhất' (2 worker)
    expect(data).toMatchObject({ nguon: 'app', theo_1400: true, owner_tai_khoan: CV1_ID, owner_don_vi_ma: 'TONG_HOP', san_pham_loai: 'TO_TRINH',
      cap_nhan_san_pham: 'TRUONG_PHONG', ngay_nhan_van_ban: homNayVN(), ngay_nhan_uoc_tinh: false, nguoi_theo_doi: QTHT_ID, tao_boi: QTHT_ID, do_khan: 'THUONG', giao_thay_mat_cho: TRUONG_PHONG_ID });
    const row = page.locator(`#klRow-${data.id}`);
    await expect(row).toBeVisible(NAP);
    await expect(page.locator('#klTimKiem')).toHaveValue(data.ma);
    await expect(row).toHaveAttribute('data-muc', 'XANH');
    await expect(row).toHaveAttribute('data-nhom', 'DANG_THUC_HIEN');
    await expect(row).toHaveClass(/\blam\b/);
    // Màu tính toán trên bản build (Tailwind cắt lớp không thấy nguyên văn) — mép trái lam của việc Xanh.
    await expect.poll(() => row.evaluate((el) => globalThis.getComputedStyle(el).borderLeftColor)).toBe('rgb(10, 98, 199)');
    await row.click();
    await expect(page.locator(`#klChiTiet-${data.id}`)).toContainText('Tờ trình', NAP); // sản phẩm ở ngăn chi tiết
  });

  test('Ký ban hành: hạn tự tính = ngày BH + 10, ô hạn khoá; văn bản vừa tạo có trong danh sách chọn; Huỷ về Nhiệm vụ', async () => {
    await nav(page, 'navGiaoViec');
    await expect(page.locator('#viewGiaoViec')).toBeVisible();
    const vb = await db.from('van_ban_giao_viec').select('id').eq('so_ket_luan', vbKhoa).single();
    await page.locator('#klThVanBan').selectOption(vb.data.id);
    await page.locator('#klThLoai').selectOption('KY_BAN_HANH');
    await expect(page.locator('#klThHan')).toBeDisabled();
    await expect(page.locator('#klThHan')).toHaveValue('2026-09-11');
    await page.locator('#viewGiaoViec').getByRole('button', { name: 'Huỷ' }).click();
    await expect(page.locator('#viewKl')).toBeVisible();
  });
});

