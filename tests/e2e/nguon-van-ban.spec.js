// Đợt C2 v3.19 (0087–0088): Trưởng phòng (demo_truongphong) giao 2 việc từ một Kết luận Ban Chấp hành mới (ô Số hội nghị hiện, không bắt buộc) với
// "Thông tin thêm": Mức quan trọng A, Cơ quan trình (đơn vị ngoài), Thường trực chỉ đạo → DB: cả hai việc mang ba ô nguồn, STT 1, 2 trong văn bản;
// ngăn chi tiết hiện mã theo nguồn KL-BCH·HN7·…·01 và nhãn Mức A; "Giao thêm nhiệm vụ từ văn bản này" mở Giao việc đúng văn bản → việc thứ 3 có
// STT 3; "Sửa thông tin giao" đổi Mức quan trọng (ô tầng giao mới). Một phiên mỗi lúc; dữ liệu theo khoá; tự dọn.
import { test, expect } from '@playwright/test';
import { NAP, moGiaoViec, nav } from './lib/app.js';
import { khoaRieng, donVanBan, donNhiemVuTheoNoiDung } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong, voiPhien } from './lib/pr2b.mjs';

const H = cong(homNay(), 20);
let db; let khoa; let viec = [];
const o = (p, cot) => p.locator(`#gvLuoiThan .gv-nv[data-dong="2"] [data-cot="${cot}"]`);
const docViec = async () => (await db.from('nhiem_vu').select('id, ma, noi_dung, stt_van_ban, muc_quan_trong, co_quan_trinh, thuong_truc_chi_dao, van_ban_id')
  .like('noi_dung', `${khoa} %`).order('stt_van_ban')).data;

test.describe.serial('Thông tin nguồn của nhiệm vụ, mã theo nguồn, giao thêm từ văn bản (v3.19 Đợt C2)', () => {
  test.describe.configure({ timeout: 150_000 });
  const don = async () => { await donNhiemVuTheoNoiDung(db, khoa); await donVanBan(db, `${khoa}-KB`); };
  test.beforeAll(async () => {
    db = dbAdmin(); khoa = khoaRieng('NG', test.info());
    const co = await db.from('nhiem_vu').select('stt_van_ban').limit(1);
    test.skip(Boolean(co.error), 'Project chưa có migration 0087.');
    await don();
  });
  test.afterAll(async () => { if (db) await don(); });

  test('1. Kết luận BCH mới, 2 việc, ba ô nguồn ở "Thông tin thêm" → DB đủ ô, STT 1–2; mã theo nguồn trong ngăn; giao thêm từ văn bản → STT 3', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'A2', testInfo, async (p) => {
      await moGiaoViec(p);
      await p.locator('#klThVanBan').selectOption('__moi__'); await p.locator('#klThLoaiVB').selectOption('KL_BCH');
      await expect(p.locator('#klThSoHNWrap')).toBeVisible(); await expect(p.locator('#klThSoHNBatBuoc')).toBeHidden();
      await p.locator('#klThSoHN').fill('7'); await p.locator('#klThSoKL').fill(`${khoa}-KB`); await p.locator('#klThNgayBH').fill(cong(homNay(), -1));
      await p.locator('#klThNoiDung').fill(`${khoa} việc 1`); await p.locator('#klThOwner').selectOption(`tk:${ID.cv1}`);
      await p.locator('#klThSanPham').selectOption('BAO_CAO'); await p.locator('#klThHan').fill(H);
      await p.locator('#gvThemWrap summary').click();
      await p.locator('#klThMucQT').selectOption('A'); await p.locator('#klThCoQuanTrinh').selectOption('DANG_UY_UBND'); await p.locator('#klThTTChiDao').selectOption(ID.a0);
      await expect(p.locator('#klThCoQuanTrinh option[value="TONG_HOP"]')).toHaveCount(0);   // chỉ đơn vị ngoài Văn phòng
      await p.locator('#gvThemDong').click();
      await o(p, 'noi_dung').fill(`${khoa} việc 2`); await o(p, 'owner').selectOption(`tk:${ID.cv1}`);
      await o(p, 'san_pham').selectOption('TO_TRINH'); await o(p, 'han').fill(cong(H, 1));
      await expect(p.locator('#gvConThieu')).toHaveText('', NAP);
      await p.locator('#klThLuu').click();
      await expect(p.locator('#toastContainer')).toContainText('Đã giao 2 việc', NAP);
      viec = await docViec();
      expect(viec.map((x) => [x.stt_van_ban, x.muc_quan_trong, x.co_quan_trinh, x.thuong_truc_chi_dao])).toEqual([[1, 'A', 'DANG_UY_UBND', ID.a0], [2, 'A', 'DANG_UY_UBND', ID.a0]]);
      const ngan = p.locator('#nganCT');   // ngăn chi tiết dùng chung mở việc đầu
      await expect(ngan.locator('.ma-nguon').first()).toHaveText('KL-BCH·HN7·01', NAP);
      await expect(ngan.locator('.muc-qt').first()).toHaveText('Mức A');
      await expect(ngan).toContainText('Đảng ủy Ủy ban nhân dân tỉnh');
      await ngan.getByRole('button', { name: 'Giao thêm nhiệm vụ từ văn bản này' }).click();
      await expect(p.locator('#giaoViecForm')).toHaveAttribute('data-san-sang', '1', NAP);
      await expect(p.locator('#klThVanBan')).toHaveValue(viec[0].van_ban_id);
      await expect(p.locator('#klThMucQT')).toHaveValue('');   // ô nguồn theo từng lượt, không mang sang
      await p.locator('#klThNoiDung').fill(`${khoa} việc 3`); await p.locator('#klThOwner').selectOption(`tk:${ID.cv1}`);
      await p.locator('#klThSanPham').selectOption('BAO_CAO'); await p.locator('#klThHan').fill(cong(H, 2));
      await p.locator('#klThLuu').click();
      await expect(p.locator('#toastContainer')).toContainText('Đã giao việc', NAP);
      await expect(p.locator('#nganCT .ma-nguon').first()).toHaveText('KL-BCH·HN7·03', NAP);
    });
    viec = await docViec();
    expect(viec.map((x) => [x.stt_van_ban, x.muc_quan_trong, x.co_quan_trinh])).toEqual([[1, 'A', 'DANG_UY_UBND'], [2, 'A', 'DANG_UY_UBND'], [3, null, null]]);
    expect(new Set(viec.map((x) => x.van_ban_id)).size).toBe(1);
  });

  test('2. Người giao sửa Mức quan trọng của việc 1 qua "Sửa thông tin giao" (ô tầng giao mới) → DB đổi, lịch sử ghi', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'A2', testInfo, async (p) => {
      await nav(p, 'navKl');
      await expect(p.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP);
      await p.locator('#klTimKiem').fill('KL-BCH·HN7·01');   // tìm nhanh theo mã theo nguồn
      const row = p.locator(`#klRow-${viec[0].id}`); await expect(row).toBeVisible(NAP); await expect(p.locator(`#klRow-${viec[1].id}`)).toHaveCount(0);
      await row.click();
      const ct = p.locator(`#klChiTiet-${viec[0].id}`); await expect(ct).toBeVisible(NAP);
      await ct.getByRole('button', { name: 'Sửa thông tin giao' }).click();
      await expect(p.locator('#stModal')).toBeVisible();
      await p.locator('#stCot').selectOption('muc_quan_trong'); await p.locator('#stMoi').selectOption('C');
      await p.locator('#stLyDo').fill('Điều chỉnh theo giao ban (e2e)'); await p.locator('#stLuu').click();
      await expect(p.locator('#toastContainer')).toContainText('Đã sửa mức quan trọng', NAP);
      await expect(p.locator(`#klChiTiet-${viec[0].id} .muc-qt`)).toHaveText('Mức C', NAP);
    });
    const { data } = await db.from('nhiem_vu').select('muc_quan_trong').eq('id', viec[0].id).single();
    expect(data.muc_quan_trong).toBe('C');
    const { data: ls } = await db.from('lich_su').select('gia_tri_cu, gia_tri_moi').eq('nhiem_vu_id', viec[0].id).eq('cot', 'muc_quan_trong');
    expect(ls).toEqual([{ gia_tri_cu: 'A', gia_tri_moi: 'C' }]);
  });
});
