// v3.35 (chủ dự án 13/11/2026): phân hệ Nhiệm vụ quý của Ban Thường vụ trên giao diện thật. Dữ liệu: Quý IV năm 2025 (quý đã qua — không đụng quý
// thật), Chánh Văn phòng (quản lý danh mục) tạo quý và nhập hai nhiệm vụ do demo_e2e_nv chủ trì theo dõi.
// 1. Chánh VP: nhóm menu "Nhiệm vụ quý BTV" đủ 5 mục; Tổng quan quý (ô số, 05 chỉ tiêu cơ bản, 6 trục); bấm ô số → Danh mục đúng 2 dòng; bấm dòng →
//    ngăn chi tiết, đường dẫn "/Danh-muc-quy/NQ-<số>"; gửi ý kiến chỉ đạo → chủ trì nhận tin.
// 2. Chủ trì theo dõi (demo_e2e_nv): không có "Quản lý danh mục quý"; "Cập nhật tuần" → mở biểu mẫu ngay trên thẻ → văn bản "Đã ban hành" kèm số, số
//    liệu chỉ tiêu, kết quả thực hiện → CSDL ghi đúng; Tổng quan quý hiện kết quả mới.
// Không chạy trên production (công tắc KIEM_THU_MOI_TRUONG): phân hệ này mọi cán bộ đều xem — không tạo quý thử trên dữ liệu thật.
import { test, expect } from '@playwright/test';
import { nav, NAP } from './lib/app.js';
import { ID, dbAdmin, voiPhien } from './lib/pr2b.mjs';
import { clientCuaVai } from './lib/du-lieu.mjs';

const NAM = 2025; const QUY = 4;
let db; const s = {};
const don = async () => { if (db) await db.from('nvq_ky').delete().eq('nam', NAM).eq('quy', QUY); };
// Màn của phân hệ đã vẽ; có nhiều quý (staging) → chọn đúng quý thử.
async function moMan(page, navId, tieuDe) {
  await nav(page, navId);
  const man = page.locator('#viewNvq');
  await expect(man.locator('h1')).toContainText(tieuDe, NAP);
  const chon = man.locator('[data-nq-chon-ky]');
  if (await chon.count()) { await chon.selectOption(s.ky); await expect(man.locator('.nq-ten-ky')).toHaveText('Quý IV năm 2025', NAP); }
  return man;
}

test.describe.serial('Nhiệm vụ quý của Ban Thường vụ (v3.35)', () => {
  test.beforeAll(async () => {
    test.skip(process.env.KIEM_THU_MOI_TRUONG === 'production', 'Không tạo quý thử trên production.');
    db = dbAdmin();
    const co = await db.from('nvq_ky').select('id').limit(1);
    test.skip(Boolean(co.error), 'Project chưa có migration 0132–0139.');
    await don();
    const cvp = clientCuaVai('A1');
    const k = await cvp.rpc('nvq_ky_luu', { p: { nam: NAM, quy: QUY } });
    if (k.error) throw new Error(`Tạo quý: ${k.error.message}`);
    s.ky = k.data;
    const r = await cvp.rpc('nvq_nhap_danh_muc', { p_ky: s.ky, p_ten_tep: 'e2e.docx', p_dong: [
      { truc_so: 1, nhom: 'TRONG_CT', stt: 1, noi_dung: 'E2E NQ chỉ đạo thực hiện chỉ tiêu tăng trưởng kinh tế', lanh_dao_text: 'Bí thư Tỉnh ủy', lanh_dao_ma: ['BI_THU'],
        don_vi_text: 'Đảng ủy UBND tỉnh', don_vi: [{ ma: 'DU_UBND', vai_tro: 'CHU_TRI' }], chu_tri_theo_doi: ID.e2eNv,
        san_pham: [{ thu_tu: 1, mo_ta: 'Văn bản chỉ đạo của Ban Thường vụ', loai: 'VAN_BAN', han: '2025-11-30' },
          { thu_tu: 2, mo_ta: 'Tốc độ tăng trưởng GRDP', loai: 'CHI_TIEU', chi_tieu_co_ban: 'GRDP', don_vi_tinh: '%', muc_tieu: 8, han: '2025-12-31' }] },
      { truc_so: 3, nhom: 'NGOAI_CT', stt: 2, noi_dung: 'E2E NQ tổ chức hội nghị chuyển đổi số', chu_tri_theo_doi: ID.e2eNv,
        san_pham: [{ mo_ta: 'Tổ chức hội nghị', loai: 'HOAT_DONG', han: '2025-12-15' }], cap_nhat_dau: { ket_qua_thuc_hien: 'Đã xây dựng dự thảo kế hoạch hội nghị' } },
    ] });
    if (r.error) throw new Error(`Nhập danh mục: ${r.error.message}`);
    const nv = (await db.from('nvq_nhiem_vu').select('id, ma, truc_so').eq('ky_id', s.ky)).data;
    s.t1 = nv.find((x) => x.truc_so === 1); s.t2 = nv.find((x) => x.truc_so === 3);
    const sp = (await db.from('nvq_san_pham').select('id, loai').eq('nhiem_vu_id', s.t1.id)).data;
    s.spVb = sp.find((x) => x.loai === 'VAN_BAN').id; s.spCt = sp.find((x) => x.loai === 'CHI_TIEU').id;
  });
  test.afterAll(don);

  test('1. Chánh Văn phòng: Tổng quan quý → Danh mục → ngăn chi tiết, đường dẫn NQ-, ý kiến chỉ đạo', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'A1', testInfo, async (page) => {
      for (const id of ['navNqTongQuan', 'navNqDanhMuc', 'navNqCapNhat', 'navNqBaoCao', 'navNqQuanLy']) await expect(page.locator(`#${id}`)).toHaveCount(1);
      const man = await moMan(page, 'navNqTongQuan', 'Tổng quan nhiệm vụ quý');
      await expect(man.locator('.nq-cau')).toBeVisible();
      const o = man.locator('.nq-o-so .nq-o').first();
      await expect(o.locator('b')).toHaveText('2');
      await expect(man.locator('.nq-ct-luoi')).toContainText('Tốc độ tăng trưởng GRDP');
      await expect(man.locator('.nq-truc')).toHaveCount(2);
      await o.click();
      await expect(man.locator('h1')).toContainText('Danh mục nhiệm vụ quý', NAP);
      await expect(man.locator('tr.nq-dong')).toHaveCount(2);
      await expect(man.locator('tr.nq-nhom-truc')).toHaveCount(2);
      await man.locator(`tr.nq-dong[data-id="${s.t1.id}"]`).click();
      const ngan = page.locator('#nqNgan');
      await expect(ngan).toBeVisible(NAP);
      await expect(page.locator('#nqNganTieuDe')).toContainText(s.t1.ma, NAP);
      await expect(page).toHaveURL(new RegExp(`/Danh-muc-quy/${s.t1.ma}$`));
      await expect(ngan.locator('.nq-sp')).toHaveCount(2);
      await ngan.locator('#nqYKienMoi').fill('E2E NQ đề nghị báo cáo số liệu tăng trưởng trước ngày 20');
      await ngan.locator('.nq-form-yk button[type="submit"]').click();
      await expect.poll(async () => (await db.from('nvq_y_kien').select('loai').eq('nhiem_vu_id', s.t1.id)).data?.map((x) => x.loai), NAP).toEqual(['CHI_DAO']);
      await expect.poll(async () => (await db.from('direct_messages').select('id').eq('nvq_nhiem_vu_id', s.t1.id).eq('receiver_id', ID.e2eNv)).data?.length, NAP).toBeGreaterThan(0);
      await expect(ngan.locator('.nq-yk.chi-dao')).toHaveCount(1, NAP);
      await ngan.locator('[data-action="nqDong"]').first().click();
      await expect(ngan).toBeHidden();
      await expect(page).toHaveURL(/\/Danh-muc-quy$/);
    });
  });

  test('2. Chủ trì theo dõi: Cập nhật tuần — văn bản đã ban hành kèm số, số liệu chỉ tiêu, kết quả thực hiện; Tổng quan hiện kết quả mới', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_NV', testInfo, async (page) => {
      await expect(page.locator('#navNqQuanLy')).toHaveCount(0);
      const man = await moMan(page, 'navNqCapNhat', 'Cập nhật tuần');
      const the = man.locator(`#nqThe-${s.t1.id}`);
      await expect(the).toBeVisible(NAP);
      await the.locator('[data-action="nqMoFormDong"]').click();
      const f = the.locator('form[data-submit="nqGuiCapNhatDong"]');
      await expect(f).toBeVisible();
      await f.locator('textarea[name="noi_dung"]').fill('Ban Thường vụ ban hành văn bản chỉ đạo; Sở Tài chính báo cáo ước tăng trưởng');
      await f.locator('textarea[name="ket_qua_thuc_hien"]').fill('E2E NQ đã ban hành Công văn 901-CV/TU; GRDP ước đạt 7,2%');
      await f.locator(`select[name="tt_${s.spVb}"]`).selectOption('HOAN_THANH');
      await f.locator(`input[name="kq_so_ky_hieu_${s.spVb}"]`).fill('901-CV/TU');
      await f.locator(`input[name="so_${s.spCt}"]`).fill('7.2');
      await f.locator('button[type="submit"]').click();
      await expect.poll(async () => (await db.from('nvq_san_pham').select('trang_thai, kq_so_ky_hieu').eq('id', s.spVb).single()).data, NAP)
        .toEqual({ trang_thai: 'HOAN_THANH', kq_so_ky_hieu: '901-CV/TU' });
      expect(Number((await db.from('nvq_san_pham').select('thuc_hien').eq('id', s.spCt).single()).data.thuc_hien)).toBe(7.2);
      expect((await db.from('nvq_nhiem_vu').select('ket_qua_thuc_hien').eq('id', s.t1.id).single()).data.ket_qua_thuc_hien).toBe('E2E NQ đã ban hành Công văn 901-CV/TU; GRDP ước đạt 7,2%');
      await expect(f).toHaveCount(0, NAP);   // ghi xong: biểu mẫu đóng, thẻ vẽ lại
      await expect(man.locator(`#nqThe-${s.t1.id} .nq-the-kq`)).toContainText('901-CV/TU', NAP);
      const tq = await moMan(page, 'navNqTongQuan', 'Tổng quan nhiệm vụ quý');
      await expect(tq.locator('.nq-ct-luoi')).toContainText('7,2', NAP);
    });
  });
});
