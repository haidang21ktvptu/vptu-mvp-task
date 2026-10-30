// v3.29 (0123–0126, chủ dự án quyết 22/10/2026 — CAU-HOI O-4…O-6): mỗi vai một luồng trên giao diện thật.
// 1. Chủ trì theo dõi (demo_e2e_nv): "Điều chỉnh hạn" việc còn hạn (mở bằng đường dẫn, ngăn dùng chung) — lùi hạn = gia hạn lần 1, lý do bắt buộc,
//    Diễn biến, tiêu đề ngăn theo hạn mới, chuông của chủ trì không có tin mình gửi; v3.34 (0131 — CAU-HOI T-1, T-2): việc do Trưởng phòng nhập
//    (chủ trì không phải người nhập — như người được chuyển sang làm chủ trì): nút "Sửa thông tin giao" (không còn "Đề nghị sửa"), sửa mô tả sản
//    phẩm ngay; việc đã quá hạn: chủ trì vẫn tự điều chỉnh hạn, lịch sử ghi lại.
// 2. Thư ký Thường trực (demo_e2e_tk, cờ tạm): việc ngoài phạm vi cũ không còn "Chỉ xem"; nộp minh chứng → hoàn thành; đổi chủ trì theo dõi.
// 3. Tài khoản quản trị (demo_e2e_tq, cờ toàn quyền tạm): việc đã hoàn thành — "Sửa văn bản giao" (trích yếu), "Sửa toàn bộ thông tin" (ghi chú),
//    "Sửa" minh chứng (trích yếu), "Mở lại nhiệm vụ" (minh chứng chuyển "Bị trả lại").
// 4. v3.32 (0130): chủ trì theo dõi (demo_e2e_nv) sửa minh chứng việc đã hoàn thành, đã có chất lượng — đổi số hiệu, gắn tệp qua ô "Chọn tệp mới…"
//    (đường thay tệp đã có, tệp cũ giữ: RLS kl-0130); không có nút "Gỡ".
// Dữ liệu riêng theo khoá E2E-TEST-Q329-<project>; cờ thu lại ở afterAll. Chạy MỘT MÌNH (project v329-quyen, nối cuối chuỗi): đổi cờ tài khoản dùng chung.
import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { moViec, NAP } from './lib/app.js';
import { storageStatePath } from './lib/roles.mjs';
import { khoaRieng, taoVanBanRieng, donVanBan } from './lib/du-lieu.mjs';
import { ID, dbAdmin, datCo, voiPhien, homNay, cong, taoMinhChung } from './lib/pr2b.mjs';

const TQ_ID = '00000000-0000-4000-8000-000000000020';   // demo_e2e_tq
let db; let khoa; let vbId; const v = {};
const viec = async (vbId, k, them = {}) => {
  const r = await db.from('nhiem_vu').insert({ van_ban_id: vbId, noi_dung: `${khoa} ${k}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: cong(homNay(), 20),
    owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: ID.e2eNv, nguoi_theo_doi: ID.e2eNv, tao_boi: ID.tp, nganh_ma: 'KINH_TE_TONG_HOP', theo_1400: true,
    ngay_nhan_van_ban: '2026-08-01', ngay_nhan_uoc_tinh: false, san_pham_loai: 'BAO_CAO', cap_nhan_san_pham: 'TRUONG_PHONG', ...them }).select('id, ma').single();
  if (r.error) throw new Error(`Tạo việc ${k}: ${r.error.message}`);
  v[k] = r.data;
};
const doc = async (k, cot) => (await db.from('nhiem_vu').select(cot).eq('id', v[k].id).single()).data;

test.describe.serial('Quyền sửa v3.29 — điều chỉnh hạn, thư ký Thường trực, tài khoản quản trị', () => {
  test.beforeAll(async ({}, testInfo) => { // eslint-disable-line no-empty-pattern
    db = dbAdmin();
    const co = await db.rpc('dieu_chinh_han', { p_id: ID.cvp, p_han_moi: homNay(), p_ly_do: 'x' });
    test.skip(co.error?.code === 'PGRST202', 'Project chưa có migration 0123.');
    khoa = khoaRieng('Q329', testInfo);
    vbId = await taoVanBanRieng(db, khoa, { loai: 'CONG_VAN', ngay_nhan: '2026-08-01' });
    await viec(vbId, 'CON_HAN');
    await viec(vbId, 'QUA_HAN', { han_xu_ly: cong(homNay(), -2) });
    await viec(vbId, 'NGOAI_PV', { owner_tai_khoan: ID.e2eKl, nguoi_theo_doi: ID.e2eKl });
    await viec(vbId, 'DOI_CT', { owner_tai_khoan: ID.e2eKl, nguoi_theo_doi: ID.e2eKl });
    await viec(vbId, 'XONG', { tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: cong(homNay(), -5), nguon: 'excel', chat_luong: 'DAT' });
    v.mcXong = await taoMinhChung(db, v.XONG.id, ID.e2eNv, `${khoa}/MC`);
    await viec(vbId, 'MC_CT', { tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: homNay(), nguon: 'excel', chat_luong: 'DAT' });
    v.mcCt = await taoMinhChung(db, v.MC_CT.id, ID.e2eNv, `${khoa}/MC-CT`);
  });
  test.afterAll(async () => {
    if (!db) return;
    await datCo(db, ID.e2eTk, { thu_ky_thuong_truc: false }); await datCo(db, TQ_ID, { toan_quyen: false });
    if (v.MC_CT) {   // tệp thay ở kịch bản 4
      const kho = db.storage.from('minh-chung'); const { data } = await kho.list(v.MC_CT.id);
      if (data?.length) await kho.remove(data.map((f) => `${v.MC_CT.id}/${f.name}`));
    }
    if (khoa) await donVanBan(db, khoa);
  });

  test('1. Chủ trì: điều chỉnh hạn việc còn hạn (gia hạn lần 1, lý do, Diễn biến); v3.34: sửa thông tin giao, điều chỉnh hạn việc quá hạn', async ({ browser }, testInfo) => {
    const moi = cong(homNay(), 35);
    await voiPhien(browser, 'E2E_NV', testInfo, async (p) => {
      await p.goto(`./Viec-cua-toi/${v.CON_HAN.ma}`);   // mở bằng đường dẫn → ngăn chi tiết dùng chung (dòng tiêu đề phụ phải theo hạn mới sau khi lưu)
      await expect(p.locator(`#nganCT #klChiTiet-${v.CON_HAN.id}`)).toBeVisible(NAP);
      await p.locator(`#klChiTiet-${v.CON_HAN.id} [data-action="moDieuChinhHan"]`).click();
      await expect(p.locator('#dchModal')).toBeVisible();
      await p.locator('#dchHan').fill(moi);
      await expect(p.locator('#dchGhiChu')).toHaveText('Lùi hạn: tính là gia hạn lần 1.');
      await p.locator('#dchLuu').click();
      await expect(p.locator('#toastContainer')).toContainText('lý do', NAP);   // lý do bắt buộc
      await p.locator('#dchLyDo').fill(`${khoa} chờ số liệu quý IV`);
      await p.locator('#dchLuu').click();
      await expect(p.locator('#dchModal')).toBeHidden(NAP);
      await expect.poll(async () => doc('CON_HAN', 'han_xu_ly, so_lan_gia_han'), NAP).toEqual({ han_xu_ly: moi, so_lan_gia_han: 1 });
      await expect(p.locator(`#klDienBien-${v.CON_HAN.id}`)).toContainText('Điều chỉnh hạn', NAP);
      await expect(p.locator(`#klChiTiet-${v.CON_HAN.id} [data-truong="so-lan-gia-han"]`)).toContainText('đã gia hạn 1 lần', NAP);
      const [y, m, d] = moi.split('-').map(Number);
      await expect(p.locator('#nganCTPhu')).toContainText(`hạn ${d}/${m}/${y}`, NAP);   // tiêu đề ngăn theo dòng vừa đọc lại (kiểm tay staging 22/10/2026)
      // Chuông của người vừa thao tác chỉ có tin gửi TỚI mình — các tin báo người giao việc, Trưởng phòng, lãnh đạo phụ trách không hiện (kiểm tay
      // staging 22/10/2026). Một tin tới chủ trì để nhóm của việc có mặt; chuông đọc lại với điều kiện người nhận, nhóm chỉ có đúng tin đó.
      await p.locator('#nganCT [data-action="nganDong"]').click();
      const tinToi = await db.from('direct_messages').insert({ sender_id: ID.tp, receiver_id: ID.e2eNv, content: `Đôn đốc · ${v.CON_HAN.ma}: ${khoa} thử chuông`,
        is_read: false, loai: 'he_thong', nhiem_vu_id: v.CON_HAN.id });
      expect(tinToi.error, tinToi.error?.message).toBeNull();
      const docChuong = p.waitForRequest((r) => r.url().includes('/rest/v1/direct_messages') && r.url().includes('loai=eq.he_thong'));
      await p.locator('#chuongBtn').click();
      const yc = await docChuong;
      expect(yc.url(), 'chuông chỉ đọc tin gửi tới mình').toContain(`receiver_id=eq.${ID.e2eNv}`);
      await (await yc.response())?.finished();
      const nhomTin = p.locator(`#thongBaoList [data-nv="${v.CON_HAN.id}"]`);
      await expect(nhomTin).toContainText(`${v.CON_HAN.ma} · mới`, NAP);   // trước bản sửa: "có 4 diễn biến, 4 mới" (1 tin nhận + 3 tin mình gửi)
      await expect(nhomTin).not.toContainText('diễn biến');
      await p.locator('#chuongBtn').click();
      await moViec(p, v.QUA_HAN.id, v.QUA_HAN.ma);
      const ctQh = p.locator(`#klChiTiet-${v.QUA_HAN.id}`);
      // v3.34: chủ trì (Trưởng phòng nhập việc) sửa ngay thông tin giao — không còn nút khoá "Đề nghị sửa"
      await expect(ctQh.locator('[data-action="moDeNghiSua"]')).toHaveCount(0);
      await ctQh.locator('.hanh-dong [data-action="moSuaTang"]').first().click();
      await expect(p.locator('#stModal')).toBeVisible();
      await expect(p.locator('#stMoTa')).toContainText('chủ trì theo dõi');
      await p.locator('#stCot').selectOption('san_pham_mo_ta'); await p.locator('#stMoi').fill(`${khoa} báo cáo kèm phụ lục`);
      await p.locator('#stLyDo').fill('Bổ sung theo yêu cầu của lãnh đạo phòng'); await p.locator('#stLuu').click();
      await expect(p.locator('#stModal')).toBeHidden(NAP);
      await expect.poll(async () => (await doc('QUA_HAN', 'san_pham_mo_ta')).san_pham_mo_ta, NAP).toBe(`${khoa} báo cáo kèm phụ lục`);
      // v3.34: việc đã quá hạn — chủ trì vẫn tự điều chỉnh hạn (không còn câu nhắc đề nghị gia hạn), lịch sử ghi lại
      await expect(ctQh.locator('[data-truong="nhac-gia-han"]')).toHaveCount(0);
      await ctQh.locator('[data-action="moDieuChinhHan"]').click();
      await expect(p.locator('#dchModal')).toBeVisible();
      const moiQh = cong(homNay(), 12);
      await p.locator('#dchHan').fill(moiQh); await p.locator('#dchLyDo').fill(`${khoa} chờ ý kiến Thường trực`);
      await p.locator('#dchLuu').click(); await expect(p.locator('#dchModal')).toBeHidden(NAP);
      await expect.poll(async () => (await doc('QUA_HAN', 'han_xu_ly')).han_xu_ly, NAP).toBe(moiQh);
      await expect(p.locator(`#klDienBien-${v.QUA_HAN.id}`)).toContainText('Điều chỉnh hạn', NAP);
      const lsQh = await db.from('lich_su').select('cot').eq('nhiem_vu_id', v.QUA_HAN.id).in('cot', ['sua_thong_tin_giao', 'dieu_chinh_han']);
      expect(lsQh.data.map((l) => l.cot).sort()).toEqual(['dieu_chinh_han', 'sua_thong_tin_giao']);
    });
  });

  test('2. Thư ký Thường trực: việc ngoài phạm vi cũ ghi được — nộp minh chứng (hoàn thành), đổi chủ trì theo dõi', async ({ browser }, testInfo) => {
    test.skip(!existsSync(storageStatePath('E2E_TK')), 'Chưa có demo_e2e_tk trên project này (seed-demo.mjs).');
    await datCo(db, ID.e2eTk, { thu_ky_thuong_truc: true });
    await voiPhien(browser, 'E2E_TK', testInfo, async (p) => {
      const row = await moViec(p, v.NGOAI_PV.id, v.NGOAI_PV.ma);
      await expect(row.locator('.nhan-chi-xem')).toHaveCount(0);
      const ngan = p.locator(`#klChiTiet-${v.NGOAI_PV.id}`);
      await ngan.getByRole('button', { name: 'Nộp minh chứng' }).click();
      await p.locator('#klMcSoHieu').fill(`${khoa}/TK`); await p.locator('#klMcNgay').fill(homNay());
      await p.locator('#klMcLuu').click(); await expect(p.locator('#klMcModal')).toBeHidden(NAP);
      await expect.poll(async () => (await doc('NGOAI_PV', 'tien_do_ma')).tien_do_ma, NAP).toBe('HOAN_THANH');
      await moViec(p, v.DOI_CT.id, v.DOI_CT.ma);
      await p.locator(`#klChiTiet-${v.DOI_CT.id} [data-action="moDoiChuTri"]`).click();
      await expect(p.locator('#dctModal')).toBeVisible();
      await p.locator('#dctChuTri').selectOption(ID.cv1);
      await expect(p.locator('#dctGhiChu')).toContainText('Tổng hợp');
      await p.locator('#dctLyDo').fill(`${khoa} chủ trì cũ nghỉ dài ngày`);
      await p.locator('#dctLuu').click(); await expect(p.locator('#dctModal')).toBeHidden(NAP);
      await expect.poll(async () => (await doc('DOI_CT', 'owner_tai_khoan')).owner_tai_khoan, NAP).toBe(ID.cv1);
      const ls = await db.from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', v.DOI_CT.id).eq('cot', 'doi_chu_tri');
      expect(ls.data[0]?.gia_tri_moi).toMatch(/^chủ trì: .* → Demo Chuyên viên Một — lý do: /);
    });
    await datCo(db, ID.e2eTk, { thu_ky_thuong_truc: false });
  });

  test('3. Tài khoản quản trị, việc đã hoàn thành: sửa văn bản giao, sửa toàn bộ thông tin (chỉ ô đổi), sửa minh chứng, mở lại (minh chứng "Bị trả lại")', async ({ browser }, testInfo) => {
    test.skip(!existsSync(storageStatePath('E2E_TQ')), 'Chưa có demo_e2e_tq trên project này (seed-demo.mjs).');
    await datCo(db, TQ_ID, { toan_quyen: true });
    await voiPhien(browser, 'E2E_TQ', testInfo, async (p) => {
      const ngan = p.locator(`#klChiTiet-${v.XONG.id}`);
      await moViec(p, v.XONG.id, v.XONG.ma);
      await ngan.locator('[data-action="moSuaVanBan"]').click();
      await expect(p.locator('#svbModal')).toBeVisible();
      await p.locator('#svbTrichYeu').fill(`${khoa} về việc thử quyền quản trị`);
      await expect(p.locator('#svbDoi')).toHaveText('Sẽ sửa: trích yếu.');
      await p.locator('#svbLyDo').fill('Bổ sung trích yếu theo văn bản gốc');
      await p.locator('#svbLuu').click(); await expect(p.locator('#svbModal')).toBeHidden(NAP);
      await expect.poll(async () => (await db.from('van_ban_giao_viec').select('trich_yeu').eq('id', vbId).single()).data.trich_yeu, NAP)
        .toBe(`${khoa} về việc thử quyền quản trị`);
      await moViec(p, v.XONG.id, v.XONG.ma);
      await ngan.locator('[data-action="moSuaToanBo"]').click();
      await expect(p.locator('#stbModal')).toBeVisible();
      await p.locator('#stb-ghi_chu').fill(`${khoa} đính chính`);
      await expect(p.locator('#stbDoi')).toHaveText('Sẽ sửa: Ghi chú.');
      await p.locator('#stbLyDo').fill('Đính chính theo văn bản gốc');
      await p.locator('#stbLuu').click(); await expect(p.locator('#stbModal')).toBeHidden(NAP);
      await expect.poll(async () => (await doc('XONG', 'ghi_chu')).ghi_chu, NAP).toBe(`${khoa} đính chính`);
      await moViec(p, v.XONG.id, v.XONG.ma);
      await ngan.locator(`[data-action="moSuaMinhChung"][data-id="${v.mcXong}"]`).click();
      await expect(p.locator('#smcModal')).toBeVisible();
      await p.locator('#smcTrichYeu').fill(`${khoa} báo cáo (sửa)`);
      await expect(p.locator('#smcDoi')).toHaveText('Sẽ sửa: trích yếu.');
      await p.locator('#smcLyDo').fill('Ghi nhầm trích yếu');
      await p.locator('#smcLuu').click(); await expect(p.locator('#smcModal')).toBeHidden(NAP);
      await expect.poll(async () => (await db.from('minh_chung').select('trich_yeu').eq('id', v.mcXong).single()).data.trich_yeu, NAP).toBe(`${khoa} báo cáo (sửa)`);
      await moViec(p, v.XONG.id, v.XONG.ma);
      await ngan.locator(`[data-action="moO"][data-o="oMoLai-${v.XONG.id}"]`).click();
      await p.locator(`#oMoLai-${v.XONG.id} input[name="ly_do"]`).fill('Kết quả chưa đạt yêu cầu');
      await p.locator(`#oMoLai-${v.XONG.id} button[type="submit"]`).click();
      await expect(p.locator('#toastContainer')).toContainText('1 minh chứng chuyển "Bị trả lại"', NAP);
      await expect.poll(async () => doc('XONG', 'tien_do_ma, ngay_hoan_thanh'), NAP).toEqual({ tien_do_ma: 'DANG_THUC_HIEN', ngay_hoan_thanh: null });
      expect((await db.from('minh_chung').select('hop_le').eq('id', v.mcXong).single()).data.hop_le).toBe(false);
    });
    await datCo(db, TQ_ID, { toan_quyen: false });
  });

  test('4. (v3.32 — 0130) Chủ trì sửa minh chứng việc đã hoàn thành, đã có chất lượng: đổi số hiệu, gắn tệp mới; không có nút Gỡ; chất lượng giữ nguyên', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_NV', testInfo, async (p) => {
      await p.goto(`./Viec-cua-toi/${v.MC_CT.ma}`);
      const ngan = p.locator(`#nganCT #klChiTiet-${v.MC_CT.id}`);
      await expect(ngan).toBeVisible(NAP);
      await expect(ngan.locator(`[data-action="moSuaMinhChung"][data-id="${v.mcCt}"]`)).toBeVisible(NAP);
      await expect(ngan.locator(`[data-o="mcGo-${v.mcCt}"]`)).toHaveCount(0);   // gỡ vẫn chỉ tài khoản quản trị
      await ngan.locator(`[data-action="moSuaMinhChung"][data-id="${v.mcCt}"]`).click();
      await expect(p.locator('#smcModal')).toBeVisible();
      await p.locator('#smcSoHieu').fill(`${khoa}/MC-CT (sửa)`);
      await p.locator('#smcTep').setInputFiles({ name: 'Bao cao ban ky.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') });
      await expect(p.locator('#smcDoi')).toHaveText('Sẽ sửa: số hiệu, tệp.');
      await p.locator('#smcLyDo').fill('Thay bản có chữ ký');
      await p.locator('#smcLuu').click(); await expect(p.locator('#smcModal')).toBeHidden(NAP);
      await expect.poll(async () => (await db.from('minh_chung').select('so_hieu, tep_ten').eq('id', v.mcCt).single()).data, NAP)
        .toEqual({ so_hieu: `${khoa}/MC-CT (sửa)`, tep_ten: 'Bao cao ban ky.pdf' });
      expect((await doc('MC_CT', 'chat_luong, tien_do_ma'))).toEqual({ chat_luong: 'DAT', tien_do_ma: 'HOAN_THANH' });
      await expect(p.locator(`#klDienBien-${v.MC_CT.id}`)).toContainText('Sửa minh chứng', NAP);
    });
  });
});
