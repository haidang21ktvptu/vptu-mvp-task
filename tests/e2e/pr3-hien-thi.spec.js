// PR-3 (A, D, F, G) — hiển thị: (1) Trưởng phòng xác nhận minh chứng cũ còn chờ (nộp trước v3.20) rồi đánh giá chất lượng ở ngăn chi tiết (Đợt D:
// tuỳ chọn — nút Lưu mờ tới khi chọn mức), DB lưu chat_luong, ngăn chi tiết hiện "Đạt tốt"; hàng việc đã đóng trước hạn hiện "Trước hạn 3 ngày" + chất lượng; Xuất Excel đúng danh sách đang lọc
// (bắt sự kiện tải, đọc tệp bằng lib/doc-xlsx.mjs: số dòng = số dòng danh sách + tiêu đề, có cột "Chất lượng"). (2) Chánh VP: Báo cáo có cột
// Trước hạn + chất lượng, bảng theo nguồn; Theo văn bản: "đã nhập 2 / dự kiến 3" nhãn vàng → sửa tại chỗ (dự kiến 2 + đã rà soát) → nhãn đổi.
// Tuần tự, mỗi lúc một phiên. Dữ liệu chèn bằng service_role theo khoá riêng; tự dọn.
import { test, expect } from '@playwright/test';
import { NAP, nav, moViec } from './lib/app.js';
import { khoaRieng, taoVanBanRieng, donVanBan, donNhiemVuTheoNoiDung } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong, taoViec, taoMinhChung, danhGiaMc, xacNhanMcCu, voiPhien } from './lib/pr2b.mjs';
import { docXlsx } from './lib/doc-xlsx.mjs';

let db; let khoa; let vbX; let T1; let T2; let mc;
const chung = () => ({ owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: ID.cv1, nguoi_theo_doi: ID.cv1, tao_boi: ID.tp });

test.describe.serial('PR-3 — chất lượng, Trước hạn, Báo cáo, Theo văn bản, Xuất Excel', () => {
  test.describe.configure({ timeout: 180_000 });
  test.beforeAll(async () => {
    db = dbAdmin(); khoa = khoaRieng('PR3H', test.info());
    await donNhiemVuTheoNoiDung(db, khoa);
    vbX = await taoVanBanRieng(db, khoa, { loai: 'CONG_VAN', ngay_ban_hanh: cong(homNay(), -30), ngay_nhan: cong(homNay(), -29), so_nhiem_vu_du_kien: 3, tao_boi: ID.tp });
    T1 = await taoViec(db, vbX, `${khoa} T1 đóng trước hạn`, { ...chung(), han_xu_ly: cong(homNay(), -5), tien_do_ma: 'HOAN_THANH',
      ngay_hoan_thanh: cong(homNay(), -8), chat_luong: 'DAT_TOT', minh_chung: `${khoa}/cũ`, theo_1400: false, ngay_nhan_van_ban: cong(homNay(), -29),
      nguon_nhiem_vu_ma: 'CHUONG_TRINH_CONG_TAC' });
    T2 = await taoViec(db, vbX, `${khoa} T2 minh chứng cũ chờ xác nhận`, { ...chung(), nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH' });
    mc = await taoMinhChung(db, T2.id, ID.cv1, `${khoa}/MC`);
  });
  test.afterAll(async () => { if (db) { await donNhiemVuTheoNoiDung(db, khoa); await donVanBan(db, khoa); } });

  test('1. Trưởng phòng: xác nhận minh chứng cũ → hoàn thành, đánh giá chất lượng (tuỳ chọn); Trước hạn trên hàng việc; Xuất Excel đúng danh sách', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'A2', testInfo, async (p) => {
      await moViec(p, T2.id, T2.ma);
      await xacNhanMcCu(p, mc);
      await expect.poll(async () => (await db.from('nhiem_vu').select('tien_do_ma').eq('id', T2.id).single()).data.tien_do_ma, NAP).toBe('HOAN_THANH');
      await moViec(p, T2.id, T2.ma);
      await danhGiaMc(p, mc, 'DAT_TOT');   // kiểm cả nút mờ khi chưa chọn
      expect((await db.from('nhiem_vu').select('tien_do_ma, chat_luong').eq('id', T2.id).single()).data).toEqual({ tien_do_ma: 'HOAN_THANH', chat_luong: 'DAT_TOT' });
      await moViec(p, T2.id, T2.ma);
      await expect(p.locator(`#klChiTiet-${T2.id} [data-truong="chat-luong"]`)).toHaveText('Đạt tốt');
      await moViec(p, T1.id, T1.ma);
      await expect(p.locator(`#klRow-${T1.id} .han`)).toContainText('Trước hạn 3 ngày');
      await expect(p.locator(`#klRow-${T1.id} [data-truong="chat-luong"]`)).toHaveText('Đạt tốt');
      // Xuất Excel: danh sách đang lọc theo khoá (2 việc của spec)
      await p.locator('#klTimKiem').fill(khoa);
      await expect(p.locator('#klBody .hang-nv')).toHaveCount(2, NAP);
      const [tai] = await Promise.all([p.waitForEvent('download'), p.locator('#klXuatExcel').click()]);
      expect(tai.suggestedFilename()).toMatch(/^vptu-nhiem-vu-\d{8}\.xlsx$/);
      const tep = testInfo.outputPath('xuat.xlsx'); await tai.saveAs(tep);
      const [sheet] = docXlsx(tep);
      expect(sheet.dong).toHaveLength(3);   // tiêu đề + 2 dòng
      expect(sheet.dong[0]).toEqual(expect.arrayContaining(['Mã', 'Nội dung', 'Nguồn nhiệm vụ', 'Chất lượng', 'Tiến độ hoàn thành', 'Vướng mắc']));
      expect(sheet.dong.slice(1).map((d) => d[0]).sort()).toEqual([T1.ma, T2.ma].sort());
    });
  });

  test('2. Chánh VP: Báo cáo có cột Trước hạn + chất lượng và bảng theo nguồn; Theo văn bản: dự kiến 3 nhập 2 → nhãn vàng → rà soát → nhãn đổi', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'A1', testInfo, async (p) => {
      await nav(p, 'navBaoCao');
      await expect(p.locator('#bcTheoPhong thead')).toContainText('Trước hạn', NAP);
      await expect(p.locator('#bcTheoPhong thead')).toContainText('Đạt tốt');
      await expect(p.locator('#bcTheoNguon')).toContainText('Chương trình công tác năm');
      await nav(p, 'navTheoVanBan');
      await expect(p.locator('#tvbCay')).toHaveAttribute('data-nap', /./, NAP);
      await p.locator('#tvbTim').fill(khoa);
      const nhan = p.locator(`#tvbVb-${vbX} .tvb-ra-soat`);
      await expect(nhan).toContainText('đã nhập 2 / dự kiến 3', NAP);
      await expect(nhan).toHaveAttribute('data-canh-bao', '1');
      await p.locator(`#tvbVb-${vbX} [data-action="moO"][data-o="oRs-${vbX}"]`).click();
      const f = p.locator(`#oRs-${vbX}`);
      await f.locator('input[name="so"]').fill('2'); await f.locator('input[name="ra_soat"]').check();
      await f.getByRole('button', { name: 'Lưu' }).click();
      await expect(p.locator(`#tvbVb-${vbX} .tvb-ra-soat`)).toHaveAttribute('data-canh-bao', '0', NAP);
      await expect(p.locator(`#tvbVb-${vbX} .tvb-ra-soat`)).toContainText('đã nhập 2 / dự kiến 2 · đã rà soát toàn văn');
    });
    const vb = (await db.from('van_ban_giao_viec').select('so_nhiem_vu_du_kien, da_ra_soat_toan_van, ra_soat_boi').eq('id', vbX).single()).data;
    expect(vb).toEqual({ so_nhiem_vu_du_kien: 2, da_ra_soat_toan_van: true, ra_soat_boi: ID.cvp });
  });
});
