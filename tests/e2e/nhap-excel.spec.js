// Nhập Excel toàn trình (giao diện v9 đợt 2, 0072–0075). Chuyên viên tổng hợp (demo_e2e_tk, cấp tạm quan_tri_kl) chọn tệp "Phụ lục 2" HƯ CẤU tạo
// lúc chạy (tests/e2e/lib/xlsx-gia.mjs — không dữ liệu thật) có thêm cột "Cán bộ chủ trì": (1) nhận hồ sơ Phụ lục 2 ở dòng 3, cột chèn thêm tự
// ghép; xem trước: đơn vị chưa khớp → chọn mục (lưu từ điển), điền hàng loạt sản phẩm, chọn "Đã xong ngoài hệ thống" → Nhập → lô; DB: việc
// giao (thay mặt Trưởng phòng, lĩnh vực theo quy tắc ngành một lĩnh vực), việc đã xong (nguồn excel), một dòng chờ; (2) Chờ hoàn thiện → Hoàn
// thiện (biểu mẫu điền sẵn, chỉ chọn ngành / lĩnh vực) → việc mới, dòng DA_HOAN_THIEN; (3) chủ trì (demo_e2e_cv) mở việc → khối "Dữ liệu gốc";
// (4) Hoàn tác lô → việc đã xong (chưa ai đụng) bị xoá. Project chưa áp 0072 → skip. Chạy ở project riêng SAU v9-dot2 (tin tổng hợp tới
// demo_e2e_cv / demo_e2e_tp — realtime.spec đếm huy hiệu tin của các tài khoản này). Dữ liệu theo khoá riêng, tự dọn trước và sau.
import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { moViec, nav, NAP } from './lib/app.js';
import { storageStatePath } from './lib/roles.mjs';
import { khoaRieng, donVanBan } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong, datCo, voiPhien } from './lib/pr2b.mjs';
import { taoXlsx } from './lib/xlsx-gia.mjs';

const HN = 974;   // số hội nghị riêng của spec (RLS dùng 972; spec khác 627–663, 991–999)
const CB = 'Demo E2E Chuyên viên RT';   // demo_e2e_cv, phòng thử E2E_RT
const NGANH = '1. Tham mưu tổng hợp (sự kiện/vấn đề lớn, quan trọng của tỉnh)';   // ngành chỉ có một lĩnh vực
const TD = ['STT', 'Số hội nghị', 'Số TB/KL', 'Ngày ban hành', 'Chủ trì theo dõi', 'Ngành/lĩnh vực', 'Cơ quan/đơn vị trình', 'Lĩnh vực chi tiết',
  'Nội dung kết luận / Văn bản trình', 'Loại thời hạn', 'Hạn xử lý', 'Tiến độ', 'Kết quả thực hiện / Minh chứng', 'Văn bản triển khai', 'Mã nhiệm vụ',
  'Ngày cập nhật gần nhất', 'Cán bộ chủ trì'];
const toast = (page) => page.locator('#toastContainer');

test.describe.serial('Nhập Excel — Phụ lục 2 hư cấu: xem trước, nhập lô, hoàn thiện dòng chờ, dữ liệu gốc, hoàn tác', () => {
  let db; let khoa; let tep; let lo; let dong;
  const don = async () => {
    const ds = (await db.from('lo_nhap').select('id, ma').eq('ten_tep', tep)).data || [];
    for (const l of ds) await db.from('direct_messages').delete().like('content', `Nhập Excel · lô ${l.ma} %`);
    await db.from('lo_nhap').delete().eq('ten_tep', tep);
    await donVanBan(db, `${khoa}/KL`);
    await db.from('tu_dien_nhap').delete().like('goc', `${khoa.toLowerCase()}%`);
  };

  test.beforeAll(async ({}, testInfo) => { // eslint-disable-line no-empty-pattern
    test.skip(!existsSync(storageStatePath('E2E_TK')), 'Chưa có tài khoản E2E_TK trên project này (seed-demo.mjs).');
    db = dbAdmin();
    test.skip(Boolean((await db.from('lo_nhap').select('id').limit(1)).error), 'Project chưa có migration 0072 (nhập Excel).');
    khoa = khoaRieng('NX', testInfo); tep = `${khoa}.xlsx`;
    await don();
    await datCo(db, ID.e2eTk, { quan_tri_kl: true });
  });
  test.afterAll(async () => { if (db && khoa) { await don(); await datCo(db, ID.e2eTk, { quan_tri_kl: false }); } });

  test('1. chọn tệp → nhận hồ sơ, xem trước (khớp đơn vị, điền hàng loạt, chế độ việc đã xong) → Nhập lô; DB đúng từng đường đi', async ({ browser }, testInfo) => {
    const bh = cong(homNay(), -10); const han = cong(homNay(), 60); const dv = `${khoa} đơn vị`;
    const buffer = taoXlsx('Phụ lục 2', {
      1: ['PHỤ LỤC 2: THEO DÕI THỰC HIỆN KẾT LUẬN (dữ liệu hư cấu)'], 3: TD,
      4: [1, HN, `${khoa}/KL`, bh, CB, NGANH, dv, 'Tổ chức thực hiện', `${khoa} báo cáo tiến độ`, 'Có hạn cụ thể', han, 'Đang thực hiện', '', '', '', '01/10/2026', CB],
      5: [2, HN, `${khoa}/KL`, bh, CB, NGANH, dv, '', `${khoa} đã xong ngoài hệ thống`, 'Thường xuyên', '', 'Hoàn thành', 'Số 9/BC đã gửi Thường trực', '', '', '', ''],
      6: [3, HN, `${khoa}/KL`, bh, CB, '', dv, '', `${khoa} thiếu ngành`, 'Có hạn cụ thể', han, 'Đang thực hiện', '', '', '', '', CB],
    }, ['A1:Q1']);
    await voiPhien(browser, 'E2E_TK', testInfo, async (page) => {
      await nav(page, 'navGiaoViec');
      await expect(page.locator('#giaoViecForm')).toHaveAttribute('data-san-sang', '1', NAP);
      await page.locator('#gvTabNhap').click();
      await expect(page.locator('#gvKhuNhap')).toBeVisible();
      const tai = page.waitForEvent('download');
      await page.locator('[data-action="nxTaiMau"]').click();
      expect((await tai).suggestedFilename()).toBe('mau-nhap-chuan-vptu-task.xlsx');
      await page.locator('#nxTep').setInputFiles({ name: tep, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
      await expect(page.locator('#nxNhanDien')).toContainText('Phụ lục 2', NAP);
      await expect(page.locator('#nxNhanDien')).toContainText('tiêu đề ở dòng 3 · 3 dòng dữ liệu');
      await expect(page.locator('[data-nx-cot="16"]')).toHaveValue('can_bo');   // cột người dùng chèn thêm vào bảng Phụ lục 2
      const khop = page.locator('.nx-khop-dong').filter({ hasText: dv });
      await expect(khop).toContainText('3 dòng');
      await khop.locator('select').selectOption('E2E_RT');
      await expect(page.locator('.nx-khop-dong').filter({ hasText: dv })).toHaveCount(0);
      await page.locator('input[name="nxCheDo"][value="DA_XONG_NGOAI"]').check();
      await page.locator('#nxHlTruong').selectOption('san_pham');
      await page.locator('#nxHlGt').selectOption('BAO_CAO');
      await page.locator('[data-action="nxHangLoat"]').click();
      const loc = page.locator('#nxXem .nx-loc');
      await expect(loc).toContainText('Giao ngay 1'); await expect(loc).toContainText('Đã xong (ngoài hệ thống) 1'); await expect(loc).toContainText('Chờ hoàn thiện 1');
      await expect(page.locator('#nxXem tr[data-dong="6"]')).toContainText('thiếu ngành');
      await page.locator('#nxNhap').click();
      await expect(page.locator('#nxKetQua')).toBeVisible(NAP);
      await expect(toast(page)).toContainText('Đã nhập lô LO-');
      lo = (await db.from('lo_nhap').select('id, ma, mau, che_do_xong, xong_luc').eq('ten_tep', tep).single()).data;
      expect(lo).toMatchObject({ mau: 'PHU_LUC_2', che_do_xong: 'DA_XONG_NGOAI' }); expect(lo.xong_luc).toBeTruthy();
      await expect(page.locator('#nxKetQua h2')).toHaveText(`Đã nhập lô ${lo.ma}`);
      dong = (await db.from('dong_nhap').select('id, so_dong, ket_qua, nhiem_vu_id, thieu').eq('lo_id', lo.id).order('so_dong')).data;
      expect(dong.map((d) => [d.so_dong, d.ket_qua])).toEqual([[4, 'GIAO'], [5, 'DA_XONG'], [6, 'CHO_HOAN_THIEN']]);
      expect(dong[2].thieu).toEqual(['nganh', 'linh_vuc']);
      const g = (await db.from('nhiem_vu').select('owner_don_vi_ma, owner_tai_khoan, nguoi_theo_doi, giao_thay_mat_cho, san_pham_loai, nganh_ma, linh_vuc_ma, nguon, tao_boi, han_xu_ly')
        .eq('id', dong[0].nhiem_vu_id).single()).data;
      expect(g).toEqual({ owner_don_vi_ma: 'E2E_RT', owner_tai_khoan: ID.e2eCv, nguoi_theo_doi: ID.e2eCv, giao_thay_mat_cho: ID.e2eTp, san_pham_loai: 'BAO_CAO',
        nganh_ma: 'THAM_MUU_TONG_HOP', linh_vuc_ma: 'LV01_THAM_MUU_TONG_HOP', nguon: 'app', tao_boi: ID.e2eTk, han_xu_ly: han });
      const x = (await db.from('nhiem_vu').select('nguon, tien_do_ma, theo_1400').eq('id', dong[1].nhiem_vu_id).single()).data;
      expect(x).toEqual({ nguon: 'excel', tien_do_ma: 'HOAN_THANH', theo_1400: false });
      const td = (await db.from('tu_dien_nhap').select('ma').eq('loai', 'don_vi').eq('goc', `${khoa.toLowerCase()} don vi`)).data;
      expect(td).toEqual([{ ma: 'E2E_RT' }]);
    });
  });

  test('2. Chờ hoàn thiện → Hoàn thiện: biểu mẫu Giao việc điền sẵn, chọn ngành → giao; dòng gắn việc mới', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_TK', testInfo, async (page) => {
      await nav(page, 'navGiaoViec');
      await expect(page.locator('#giaoViecForm')).toHaveAttribute('data-san-sang', '1', NAP);
      await page.locator('#gvTabCho').click();
      const the = page.locator(`#nxCho-${dong[2].id}`);
      await expect(the).toContainText('thiếu: ngành, lĩnh vực', NAP);
      await expect(page.locator(`#nxLo-${lo.id}`)).toContainText(`Lô ${lo.ma}`);
      await the.getByRole('button', { name: 'Hoàn thiện' }).click();
      await expect(page.locator('#gvHoanThien')).toContainText(`Hoàn thiện dòng 6 của lô ${lo.ma}`, NAP);
      await expect(page.locator('#giaoViecForm')).toHaveAttribute('data-san-sang', '1', NAP);
      await expect(page.locator('#klThNoiDung')).toHaveValue(`${khoa} thiếu ngành`);
      await expect(page.locator('#klThOwner')).toHaveValue(`tk:${ID.e2eCv}`);
      await expect(page.locator('#klThThayMat')).toHaveValue(ID.e2eTp);
      await expect(page.locator('#klThSanPham')).toHaveValue('BAO_CAO');
      await page.locator('#klThNganh').selectOption('THAM_MUU_TONG_HOP');
      if (await page.locator('#klThLinhVuc').inputValue() !== 'LV01_THAM_MUU_TONG_HOP') await page.locator('#klThLinhVuc').selectOption('LV01_THAM_MUU_TONG_HOP');
      await expect(page.locator('#gvConThieu')).toHaveText('', NAP);
      await page.locator('#klThLuu').click();
      await expect(toast(page)).toContainText('Đã giao việc NV-', NAP);
      await expect.poll(async () => (await db.from('dong_nhap').select('ket_qua, nhiem_vu_id').eq('id', dong[2].id).single()).data?.ket_qua, NAP).toBe('DA_HOAN_THIEN');
      const v = (await db.from('dong_nhap').select('nhiem_vu_id').eq('id', dong[2].id).single()).data;
      const nv = (await db.from('nhiem_vu').select('noi_dung, nganh_ma, linh_vuc_ma, owner_tai_khoan').eq('id', v.nhiem_vu_id).single()).data;
      expect(nv).toEqual({ noi_dung: `${khoa} thiếu ngành`, nganh_ma: 'THAM_MUU_TONG_HOP', linh_vuc_ma: 'LV01_THAM_MUU_TONG_HOP', owner_tai_khoan: ID.e2eCv });
    });
  });

  test('3. chủ trì mở việc nhập từ Excel → khối "Dữ liệu gốc" có mọi cột của dòng trong tệp', async ({ browser }, testInfo) => {
    const ma = (await db.from('nhiem_vu').select('ma').eq('id', dong[0].nhiem_vu_id).single()).data.ma;
    await voiPhien(browser, 'E2E_CV', testInfo, async (page) => {
      await moViec(page, dong[0].nhiem_vu_id, ma);
      const goc = page.locator(`#klGoc-${dong[0].nhiem_vu_id}`);
      await expect(goc).toBeVisible(NAP);
      await goc.locator('summary').click();
      await expect(goc).toContainText(`Lô ${lo.ma} · tệp ${tep} · dòng 4`);
      await expect(goc.locator('dt', { hasText: 'Ngày cập nhật gần nhất' })).toBeVisible();
      await expect(goc).toContainText('Tổ chức thực hiện');
    });
  });

  test('4. Hoàn tác lô (trong 24 giờ, xác nhận tại chỗ) → việc đã xong chưa ai đụng bị xoá, lô ghi đã hoàn tác', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_TK', testInfo, async (page) => {
      await nav(page, 'navGiaoViec');
      await expect(page.locator('#giaoViecForm')).toHaveAttribute('data-san-sang', '1', NAP);
      await page.locator('#gvTabCho').click();
      const khoi = page.locator(`#nxLo-${lo.id}`);
      await expect(khoi).toBeVisible(NAP);
      await khoi.getByRole('button', { name: 'Hoàn tác lô' }).click();
      await page.locator(`#oHtCho-${lo.id}`).getByRole('button', { name: 'Xác nhận hoàn tác' }).click();
      await expect(toast(page)).toContainText(`Đã hoàn tác lô ${lo.ma}`, NAP);
      const sau = (await db.from('dong_nhap').select('so_dong, ket_qua').eq('lo_id', lo.id).order('so_dong')).data;
      expect(sau.find((d) => d.so_dong === 5).ket_qua).toBe('DA_HOAN_TAC');
      expect(sau.find((d) => d.so_dong === 6).ket_qua).toBe('DA_HOAN_THIEN');
      expect((await db.from('nhiem_vu').select('id').eq('id', dong[1].nhiem_vu_id)).data).toEqual([]);
      expect((await db.from('lo_nhap').select('hoan_tac_luc').eq('id', lo.id).single()).data.hoan_tac_luc).toBeTruthy();
    });
  });
});
