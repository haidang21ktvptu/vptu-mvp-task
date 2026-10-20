// v3.25 (0107–0112): Giao việc — đọc văn bản gốc (PDF) bằng trợ lý AI. Trưởng phòng (demo_truongphong) chọn một tệp PDF có lớp chữ (dựng tại chỗ,
// nội dung hư cấu); Edge Function tro-ly-ai GIẢ bằng route (không gọi dịch vụ AI thật) trả kết quả đã "đối chiếu": văn bản mới được điền (loại, số
// hiệu, ngày, trích yếu). Đợt sửa gộp 18/10/2026: việc trùng (trung_voi), việc chưa trọn câu (con_tiep), đoạn "có thể còn sót" (nghi_bo_sot).
// v3.26 (0116): trợ lý AI đề xuất ngành, lĩnh vực của từng nhiệm vụ → DB nhận đúng ngành, lĩnh vực.
// v3.27 (mục 5 yêu cầu 20/10/2026): BẢNG ĐỀ XUẤT SỬA ĐƯỢC — việc trùng bỏ sẵn (Lấy lại được); dòng 1: AI điền sẵn sản phẩm, hạn đã đối chiếu, cơ quan
// trình; người giao sửa nội dung, chọn chịu trách nhiệm ngay tại bảng; dòng 2: "Dùng trọn câu", "Dùng <ngày>" (hạn chưa đối chiếu), đổi sản phẩm, chọn
// cơ quan trình "Văn phòng Tỉnh ủy" (0117); đoạn còn sót thêm thành dòng 4 rồi "× Bỏ" riêng dòng đó; điền nhanh chịu trách nhiệm cho dòng còn trống →
// "Điền 2 nhiệm vụ vào các thẻ" dùng đúng giá trị đã sửa → Giao → DB. Mục tiêu then chốt tạm ẩn (HIEN_MUC_TIEU): phần mục tiêu chỉ kiểm khi bật lại.
// Dữ liệu theo khoá riêng, tự dọn (việc, văn bản, mục tiêu tự thêm). Tự bỏ qua khi project chưa có 0107–0112.
import { test, expect } from '@playwright/test';
import { contextAs, moGiaoViec, expectLoggedIn, NAP, HIEN_MUC_TIEU } from './lib/app.js';
import { khoaRieng, donVanBan, donNhiemVuTheoNoiDung } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong } from './lib/pr2b.mjs';

// PDF một trang, chữ ASCII (pdf.js đọc được lớp chữ — trên 200 ký tự nên không bị coi là bản chụp).
function pdfCo(dong) {
  const noi = `BT /F1 10 Tf 40 800 Td 13 TL ${dong.map((d) => `(${d.replace(/[()\\]/g, ' ')}) Tj T*`).join(' ')} ET`;
  const obj = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${noi.length} >>\nstream\n${noi}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let s = '%PDF-1.4\n'; const vt = [];
  obj.forEach((o, i) => { vt.push(s.length); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = s.length;
  s += `xref\n0 ${obj.length + 1}\n0000000000 65535 f \n${vt.map((v) => `${String(v).padStart(10, '0')} 00000 n \n`).join('')}`;
  return Buffer.from(`${s}trailer\n<< /Size ${obj.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`, 'latin1');
}
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const gt = (v, trich = v, xm = 'dung') => ({ gia_tri: v, trich, xac_minh: xm });

test.describe.serial('Giao việc: đọc văn bản bằng trợ lý AI, bảng đề xuất sửa được (v3.25 – v3.27)', () => {
  test.describe.configure({ timeout: 150_000 });
  let db; let khoa; let co = false;
  const soVb = () => `${khoa}-AI`;
  const SO_TU = `${20000 + (Date.now() % 79999)}-NQ/TU`;
  const don = async () => {
    await donNhiemVuTheoNoiDung(db, khoa); await donVanBan(db, soVb());
    const { data } = await db.from('dm_muc_tieu').select('ma').eq('so_hieu', SO_TU);
    for (const { ma } of data || []) { await db.from('dm_lich_su').delete().eq('bang', 'dm_muc_tieu').eq('ma', ma); await db.from('dm_muc_tieu').delete().eq('ma', ma); }
  };
  test.beforeAll(async ({}, testInfo) => { // eslint-disable-line no-empty-pattern
    db = dbAdmin(); khoa = khoaRieng('GVAI', testInfo);
    co = !(await db.from('quy_tac_muc_tieu').select('id').limit(1)).error;
    if (co) await don();
  });
  test.afterAll(async () => { if (db && co) await don(); });

  test('Trưởng phòng: đọc PDF → sửa tại bảng đề xuất (nội dung, chịu trách nhiệm, sản phẩm, hạn, cơ quan trình; bỏ từng dòng; điền nhanh) → điền 2 thẻ → giao → DB', async ({ browser }, testInfo) => {
    test.skip(!co, 'Chưa có migration 0107–0112 trên project này.');
    const han = cong(homNay(), 20); const han2 = cong(homNay(), 35); const ngay = cong(homNay(), -1);
    const nd1 = `${khoa} viec AI 1: Giao Van phong Tinh uy tham muu trien khai Nghi quyet so 57-NQ/TW ve chuyen doi so`; const nd1Sua = `${nd1} (sua tai bang de xuat)`;
    const nd2 = `${khoa} viec AI 2: Thuc hien Nghi quyet so ${SO_TU} ve phat trien du lich`; const tiep2 = ', bao cao ket qua (e2e).';
    const viecAi = (nd, them = {}, pl = {}) => ({ noi_dung: { gia_tri: nd, xac_minh: 'dung', ...them }, trich: nd, don_vi_chu_tri: { gia_tri: 'Van phong Tinh uy' },
      don_vi_phoi_hop: { gia_tri: '', xac_minh: false }, han: pl.han || gt(han, 'han hoan thanh'), loai_thoi_han: { gia_tri: 'CO_HAN_CU_THE' }, san_pham: { gia_tri: pl.sp ?? 'BAO_CAO' },
      mo_ta_san_pham: { gia_tri: '', xac_minh: false }, nganh: { gia_tri: pl.nganh || '' }, linh_vuc: { gia_tri: pl.lv || '' }, co_quan_trinh: { gia_tri: pl.cqt || '' }, muc_tieu: [] });
    const PL1 = { nganh: 'VAN_HOA_XA_HOI', lv: 'LV10_CHUYEN_DOI_SO', cqt: 'DANG_UY_UBND' };   // v3.26 ngành, lĩnh vực; v3.27 cơ quan trình
    const PL2 = { nganh: 'VAN_HOA_XA_HOI', lv: 'LV10_VAN_HOA', sp: '', han: gt(han2, 'trong thang toi', false) };   // hạn chưa đối chiếu → nút "Dùng <ngày>"
    const ketQua = {
      van_ban: { loai: gt('CONG_VAN', 'V/v trien khai'), so_hieu: gt(soVb(), `So: ${soVb()}`), ngay_ban_hanh: gt(ngay, 'ngay hom qua'),
        trich_yeu: gt('V/v trien khai nhiem vu (e2e)'), so_hoi_nghi: gt('', '', false), co_quan_ban_hanh: gt('Tinh uy Cao Bang') },
      nhiem_vu: [viecAi(nd1, {}, PL1), viecAi(nd2, { con_tiep: tiep2 }, PL2), { ...viecAi(nd1, {}, PL1), trung_voi: 0 }],
      nghi_bo_sot: [{ trang: 1, chu: `${khoa} doan con sot: Giao Van phong Tinh uy tong hop ket qua (e2e)` }], tong_bo_sot: 1,
      muc_tieu_van_ban: [{ ma: 'DP_CAN_BO', trich: 'can bo', ly_do: 'Văn bản phục vụ đột phá cán bộ (e2e)', xac_minh: 'dung' }],
      van_ban_nhac_toi: [], co_chu: true, thong_ke: { co_gia_tri: 8, da_xac_minh: 8, so_nhiem_vu: 3 } };
    const context = await contextAs(browser, 'A2', testInfo);
    await context.route('**/functions/v1/tro-ly-ai', async (route) => {
      if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 200, headers: CORS, body: 'ok' }); return; }
      const hd = JSON.parse(route.request().postData() || '{}').hanh_dong;
      const body = hd === 'doc_van_ban' ? { ok: true, ket_qua: ketQua, mo_hinh: 'claude-sonnet-5-5', nha_cung_cap: 'Claude (Anthropic)', thoi_gian_ms: 900 }
        : { ok: true, bat: true, nha_cung_cap: 'anthropic', ten: 'Claude (Anthropic)', mo_hinh: 'claude-sonnet-5-5', co_khoa: true, gui_noi_dung: true };
      await route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    });
    const p = await context.newPage();
    await p.goto('./'); await expectLoggedIn(p, 'A2');
    await moGiaoViec(p);
    await expect(p.locator('#gvDoc')).toBeVisible();
    await expect(p.locator('#gvDocChu')).toContainText('trợ lý AI', NAP);

    // Đọc tệp: văn bản mới được điền (đã đối chiếu); bảng đề xuất 3 dòng — việc trùng bỏ sẵn, việc 2 chưa trọn câu.
    const loiTrang = []; p.on('pageerror', (e) => loiTrang.push(e.message));
    await p.locator('#gvDocTep').setInputFiles({ name: 'van-ban-e2e.pdf', mimeType: 'application/pdf',
      buffer: pdfCo(['TINH UY CAO BANG', `So: ${soVb()}`, 'V/v trien khai nhiem vu (e2e)', ...Array.from({ length: 12 }, (_, i) => `Noi dung thu nghiem dong ${i + 1} cua van ban e2e.`)]) });
    const kq = p.locator('#gvDocKq'); const dong = (i) => kq.locator(`.gv-db[data-i="${i}"]`); const nv = (i) => kq.locator('.gv-doc-nv').nth(i);
    await expect(kq).toBeVisible(NAP);
    await expect(kq).toContainText('Văn bản giao 3 nhiệm vụ');
    await expect(kq.locator('[data-action="gvDocBo"]')).toHaveText('Bỏ tất cả');
    await expect(nv(2)).toContainText('đã bỏ (trùng nhiệm vụ 1)'); await expect(nv(2).locator('[data-action="gvDocLayLai"]')).toBeVisible();
    await expect(dong(1)).toContainText('chưa trọn câu');
    await expect(kq.locator('.gv-doc-sot')).toContainText('Có thể còn sót: 1 đoạn');
    expect(loiTrang, 'không lỗi khi đọc PDF').toEqual([]);
    await expect(p.locator('#klThVanBan')).toHaveValue('__moi__');
    await expect(p.locator('#klThSoKL')).toHaveValue(soVb());
    await expect(p.locator('#klThNgayBH')).toHaveValue(ngay);
    await expect(p.locator('#klThLoaiVB')).toHaveValue('CONG_VAN');
    if (HIEN_MUC_TIEU) {   // mục tiêu văn bản là gợi ý AI (chưa tích)
      const oVb = p.locator('#gvMtVb .mtg'); const goiYAi = oVb.locator('.mtg-gy[data-nguon="AI"][data-ma="DP_CAN_BO"]');
      await expect(goiYAi).toBeVisible(NAP); await goiYAi.click();
      await expect(oVb.locator('.mtg-chip[data-nguon="AI"]')).toContainText('Đột phá cán bộ');
    }

    // Dòng 1: AI đề xuất sẵn sản phẩm, hạn đã đối chiếu, cơ quan trình; người giao sửa nội dung, chọn chịu trách nhiệm ngay tại bảng.
    const o = (i, c) => dong(i).locator(`[data-sua="${c}"]`);
    await expect(o(0, 'san_pham')).toHaveValue('BAO_CAO'); await expect(o(0, 'han')).toHaveValue(han);
    await expect(o(0, 'co_quan_trinh')).toHaveValue(PL1.cqt); await expect(o(0, 'owner')).toHaveValue('');
    await o(0, 'noi_dung').fill(nd1Sua);
    await o(0, 'owner').selectOption(`tk:${ID.cv1}`);
    // Dòng 2: dùng trọn câu; hạn văn bản nêu chưa đối chiếu → bấm "Dùng <ngày>"; đổi sản phẩm; cơ quan trình Văn phòng Tỉnh ủy (0117).
    await dong(1).locator('[data-action="gvDocBangTron"]').click();
    await expect(o(1, 'noi_dung')).toHaveValue(`${nd2}${tiep2}`);
    await expect(o(1, 'han')).toHaveValue('');
    await dong(1).locator('[data-action="gvDocBangHan"]').click();
    await expect(o(1, 'han')).toHaveValue(han2);
    await o(1, 'san_pham').selectOption('KE_HOACH');
    await o(1, 'co_quan_trinh').selectOption('VAN_PHONG_TINH_UY');
    await expect(o(0, 'noi_dung'), 'vẽ lại bảng giữ giá trị đã sửa').toHaveValue(nd1Sua);
    // Đoạn còn sót → dòng 4 → bỏ riêng dòng đó (các dòng khác giữ nguyên).
    await kq.locator('[data-action="gvDocThemDoan"]').click();
    await expect(kq).toContainText('Văn bản giao 4 nhiệm vụ');
    await expect(dong(3)).toContainText('hệ thống rà thấy');
    await expect(kq.locator('.gv-doc-sot')).toHaveCount(0);
    await dong(3).locator('[data-action="gvDocBoDong"]').click();
    await expect(nv(3)).toContainText('đã bỏ'); await expect(kq).toContainText('2 nhiệm vụ đã bỏ');
    await expect(o(1, 'san_pham')).toHaveValue('KE_HOACH');
    // Điền nhanh chịu trách nhiệm cho dòng còn trống (dòng 1 đã chọn — giữ nguyên).
    await kq.locator('#gvDbOwner').selectOption(`tk:${ID.cv1}`);
    await kq.locator('[data-action="gvDocDienNhanh"]').click();
    await expect(p.locator('#toastContainer')).toContainText('Đã điền chung cho 1 nhiệm vụ còn trống', NAP);
    await expect(o(1, 'owner')).toHaveValue(`tk:${ID.cv1}`);

    // Điền vào thẻ: đúng giá trị đã sửa ở bảng; ngành, lĩnh vực theo đề xuất AI; dòng đã bỏ không điền.
    await expect(kq.locator('[data-action="gvDocDienTatCa"]')).toHaveText('Điền 2 nhiệm vụ vào các thẻ');
    await kq.locator('[data-action="gvDocDienTatCa"]').click();
    for (const [id, v] of [['klThNoiDung', nd1Sua], ['klThOwner', `tk:${ID.cv1}`], ['klThHan', han], ['klThSanPham', 'BAO_CAO'], ['klThCoQuanTrinh', PL1.cqt],
      ['klThNganh', PL1.nganh], ['klThLinhVuc', PL1.lv]]) await expect(p.locator(`#${id}`), id).toHaveValue(v);
    await expect(p.locator('#gvLuoiThan .gv-nv')).toHaveCount(1);
    const the2 = p.locator('#gvLuoiThan .gv-nv').first();
    for (const [c, v] of [['noi_dung', `${nd2}${tiep2}`], ['owner', `tk:${ID.cv1}`], ['han', han2], ['san_pham', 'KE_HOACH'], ['co_quan_trinh', 'VAN_PHONG_TINH_UY'],
      ['nganh', PL2.nganh], ['linh_vuc', PL2.lv]]) await expect(the2.locator(`[data-cot="${c}"]`), `thẻ 2: ${c}`).toHaveValue(v);
    await expect(nv(0)).toContainText('đã điền vào'); await expect(nv(1)).toContainText('đã điền vào');
    await expect(p.locator('#gvThe1 .gv-ai-ghi')).toContainText('Điền từ văn bản');
    if (HIEN_MUC_TIEU) {   // thẻ 1 tích sẵn NQ 57 (quy tắc 0113), mục của văn bản; thẻ 2 mời số hiệu Tỉnh ủy chưa có
      await expect(p.locator('#gvThe1 .mtg-chip[data-nguon="QUY_TAC"]').filter({ hasText: 'Nghị quyết 57-NQ/TW' })).toBeVisible(NAP);
      await expect(p.locator('#gvThe1 .mtg-chip[data-nguon="VAN_BAN"]')).toContainText('Đột phá cán bộ');
      await expect(the2.locator('.mtg-chip[data-nguon="MOI"]')).toContainText(SO_TU.replace(/^0+/, ''), NAP);
    }
    await expect(p.locator('#gvConThieu')).toHaveText('', NAP);
    await p.locator('#klThLuu').click();
    await expect(p.locator('#toastContainer')).toContainText('Đã giao 2 việc', NAP);

    // DB: hai việc (việc trùng, dòng đã bỏ không giao) mang đúng giá trị đã sửa ở bảng.
    const vb = (await db.from('van_ban_giao_viec').select('id').eq('so_ket_luan', soVb()).single()).data;
    const viec = (await db.from('nhiem_vu').select('id, noi_dung, owner_tai_khoan, han_xu_ly, san_pham_loai, co_quan_trinh, nganh_ma, linh_vuc_ma').eq('van_ban_id', vb.id)).data;
    expect(viec, 'việc trùng và dòng đã bỏ không được giao').toHaveLength(2);
    const v1 = viec.find((x) => x.noi_dung === nd1Sua); const v2 = viec.find((x) => x.noi_dung === `${nd2}${tiep2}`);
    expect(v1).toMatchObject({ owner_tai_khoan: ID.cv1, han_xu_ly: han, san_pham_loai: 'BAO_CAO', co_quan_trinh: PL1.cqt, nganh_ma: PL1.nganh, linh_vuc_ma: PL1.lv });
    expect(v2).toMatchObject({ owner_tai_khoan: ID.cv1, han_xu_ly: han2, san_pham_loai: 'KE_HOACH', co_quan_trinh: 'VAN_PHONG_TINH_UY', nganh_ma: PL2.nganh, linh_vuc_ma: PL2.lv });
    if (HIEN_MUC_TIEU) {   // văn bản mang mục tiêu AI; thẻ 1 có NQ_57 (tích sẵn); số hiệu mới vào danh mục (TU_DONG) và gắn cho thẻ 2
      await expect.poll(async () => (await db.from('van_ban_muc_tieu').select('muc_tieu_ma, nguon').eq('van_ban_id', vb.id)).data, NAP)
        .toEqual([{ muc_tieu_ma: 'DP_CAN_BO', nguon: 'AI' }]);
      const mt = async (id) => (await db.from('nhiem_vu_muc_tieu').select('muc_tieu_ma, nguon').eq('nhiem_vu_id', id)).data;
      await expect.poll(async () => (await mt(v1.id)).find((x) => x.muc_tieu_ma === 'NQ_57')?.nguon, NAP).toBe('QUY_TAC');
      expect((await mt(v1.id)).find((x) => x.muc_tieu_ma === 'DP_CAN_BO')?.nguon, 'mục của văn bản trong phần gắn riêng giữ nguồn của văn bản').toBe('AI');
      const moi = (await db.from('dm_muc_tieu').select('ma, nhom, nguon_them').eq('so_hieu', SO_TU)).data;
      expect(moi, 'số hiệu Tỉnh ủy mới được hệ thống thêm vào danh mục').toEqual([expect.objectContaining({ nhom: 'NQ_TU', nguon_them: 'TU_DONG' })]);
      expect((await mt(v2.id)).map((x) => x.muc_tieu_ma)).toEqual(expect.arrayContaining(['DP_CAN_BO', moi[0].ma]));
    }
    await context.close();
  });
});
