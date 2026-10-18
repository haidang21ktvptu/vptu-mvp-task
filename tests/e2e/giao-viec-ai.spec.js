// v3.25 (0107–0112): Giao việc — đọc văn bản gốc (PDF) bằng trợ lý AI và mục tiêu then chốt theo từng thẻ. Trưởng phòng (demo_truongphong) chọn một
// tệp PDF có lớp chữ (dựng tại chỗ, nội dung hư cấu); Edge Function tro-ly-ai GIẢ bằng route (không gọi dịch vụ AI thật) trả kết quả đã "đối chiếu":
// văn bản mới được điền (loại, số hiệu, ngày, trích yếu), mục tiêu văn bản là gợi ý AI; "Điền 2 nhiệm vụ vào các thẻ" → hai thẻ có nội dung, hạn,
// sản phẩm; bộ nhận diện thật của DB (0110 + quy tắc 0113) tích sẵn Nghị quyết 57-NQ/TW ở thẻ 1 và mời thêm số hiệu Tỉnh ủy chưa có ở thẻ 2. Giao →
// DB: văn bản mang mục tiêu AI (nguồn AI), thẻ 1 gắn riêng có NQ_57 nguồn tích sẵn và mục của văn bản giữ nguồn của văn bản (AI — máy chủ chép), số
// hiệu mới tự thêm vào danh mục (TU_DONG) và gắn cho thẻ 2.
// Đợt sửa gộp 18/10/2026: việc thứ ba trùng việc 1 (trung_voi) → "Điền tất cả" bỏ qua; việc 2 chưa trọn câu (con_tiep) → không tự điền nội dung, bấm
// "Dùng trọn câu"; đoạn "có thể còn sót" (nghi_bo_sot) → "Thêm vào danh sách" thêm thành nhiệm vụ thứ tư (không điền, không giao).
// Dữ liệu theo khoá riêng, tự dọn (việc, văn bản, mục tiêu tự thêm). Tự bỏ qua khi project chưa có 0107–0112.
import { test, expect } from '@playwright/test';
import { contextAs, moGiaoViec, expectLoggedIn, NAP } from './lib/app.js';
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

test.describe.serial('Giao việc: đọc văn bản bằng trợ lý AI, mục tiêu then chốt theo thẻ (v3.25)', () => {
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

  test('Trưởng phòng: đọc PDF → điền văn bản và hai thẻ → mục tiêu tích sẵn / số hiệu mới → giao → DB có nguồn', async ({ browser }, testInfo) => {
    test.skip(!co, 'Chưa có migration 0107–0112 trên project này.');
    const han = cong(homNay(), 20); const ngay = cong(homNay(), -1);
    const nd1 = `${khoa} viec AI 1: Giao Van phong Tinh uy tham muu trien khai Nghi quyet so 57-NQ/TW ve chuyen doi so`;
    const nd2 = `${khoa} viec AI 2: Thuc hien Nghi quyet so ${SO_TU} ve phat trien du lich`; const tiep2 = ', bao cao ket qua (e2e).';
    const viecAi = (nd, them = {}) => ({ noi_dung: { gia_tri: nd, xac_minh: 'dung', ...them }, trich: nd, don_vi_chu_tri: { gia_tri: 'Van phong Tinh uy' },
      don_vi_phoi_hop: { gia_tri: '', xac_minh: false }, han: gt(han, 'han hoan thanh'), loai_thoi_han: { gia_tri: 'CO_HAN_CU_THE' }, san_pham: { gia_tri: 'BAO_CAO' },
      mo_ta_san_pham: { gia_tri: '', xac_minh: false }, nganh: { gia_tri: '' }, linh_vuc: { gia_tri: '' }, muc_tieu: [] });
    const ketQua = {
      van_ban: { loai: gt('CONG_VAN', 'V/v trien khai'), so_hieu: gt(soVb(), `So: ${soVb()}`), ngay_ban_hanh: gt(ngay, 'ngay hom qua'),
        trich_yeu: gt('V/v trien khai nhiem vu (e2e)'), so_hoi_nghi: gt('', '', false), co_quan_ban_hanh: gt('Tinh uy Cao Bang') },
      nhiem_vu: [viecAi(nd1), viecAi(nd2, { con_tiep: tiep2 }), { ...viecAi(nd1), trung_voi: 0 }],
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

    // Đọc tệp: văn bản mới được điền (đã đối chiếu), mục tiêu văn bản là gợi ý AI (chưa tích).
    const loiTrang = []; p.on('pageerror', (e) => loiTrang.push(e.message));
    await p.locator('#gvDocTep').setInputFiles({ name: 'van-ban-e2e.pdf', mimeType: 'application/pdf',
      buffer: pdfCo(['TINH UY CAO BANG', `So: ${soVb()}`, 'V/v trien khai nhiem vu (e2e)', ...Array.from({ length: 12 }, (_, i) => `Noi dung thu nghiem dong ${i + 1} cua van ban e2e.`)]) });
    const kq = p.locator('#gvDocKq');
    await expect(kq).toBeVisible(NAP);
    await expect(kq).toContainText('Văn bản giao 3 nhiệm vụ');
    await expect(kq.locator('.gv-doc-nv').nth(2)).toContainText('trùng nhiệm vụ 1');
    await expect(kq.locator('.gv-doc-nv').nth(1)).toContainText('chưa trọn câu');
    await expect(kq.locator('.gv-doc-sot')).toContainText('Có thể còn sót: 1 đoạn');
    expect(loiTrang, 'không lỗi khi đọc PDF').toEqual([]);
    await expect(p.locator('#klThVanBan')).toHaveValue('__moi__');
    await expect(p.locator('#klThSoKL')).toHaveValue(soVb());
    await expect(p.locator('#klThNgayBH')).toHaveValue(ngay);
    await expect(p.locator('#klThLoaiVB')).toHaveValue('CONG_VAN');
    const oVb = p.locator('#gvMtVb .mtg');
    const goiYAi = oVb.locator('.mtg-gy[data-nguon="AI"][data-ma="DP_CAN_BO"]');
    await expect(goiYAi).toBeVisible(NAP);
    await goiYAi.click();
    await expect(oVb.locator('.mtg-chip[data-nguon="AI"]')).toContainText('Đột phá cán bộ');

    // Điền hai thẻ (việc trùng bỏ qua): nội dung, hạn, sản phẩm; thẻ 2 chưa trọn câu → "Dùng trọn câu"; thẻ 1 tích sẵn NQ 57 (số hiệu trong nội dung —
    // quy tắc 0113), thẻ 2 mời số hiệu Tỉnh ủy chưa có. Đoạn còn sót → "Thêm vào danh sách" (nhiệm vụ thứ tư, không điền).
    await expect(kq.locator('[data-action="gvDocDienTatCa"]')).toHaveText('Điền 2 nhiệm vụ vào các thẻ');
    await kq.locator('[data-action="gvDocDienTatCa"]').click();
    await expect(p.locator('#klThNoiDung')).toHaveValue(nd1);
    await expect(p.locator('#klThHan')).toHaveValue(han);
    await expect(p.locator('#klThSanPham')).toHaveValue('BAO_CAO');
    const the2 = p.locator('#gvLuoiThan .gv-nv').first();
    await expect(p.locator('#gvLuoiThan .gv-nv')).toHaveCount(1);
    await expect(the2.locator('[data-cot="noi_dung"]')).toHaveValue('');
    await the2.locator('[data-action="gvDocDungTron"]').click();
    await expect(the2.locator('[data-cot="noi_dung"]')).toHaveValue(`${nd2}${tiep2}`);
    await kq.locator('[data-action="gvDocThemDoan"]').click();
    await expect(kq).toContainText('Văn bản giao 4 nhiệm vụ');
    await expect(kq.locator('.gv-doc-nv').nth(3)).toContainText('hệ thống rà thấy');
    await expect(kq.locator('.gv-doc-sot')).toHaveCount(0);
    await expect(p.locator('#gvThe1 .gv-ai-ghi')).toContainText('Điền từ văn bản');
    await expect(p.locator('#gvThe1 .mtg-chip[data-nguon="QUY_TAC"]').filter({ hasText: 'Nghị quyết 57-NQ/TW' })).toBeVisible(NAP);
    await expect(p.locator('#gvThe1 .mtg-chip[data-nguon="VAN_BAN"]')).toContainText('Đột phá cán bộ');   // mục của văn bản: thẻ tính theo
    await expect(the2.locator('.mtg-chip[data-nguon="MOI"]')).toContainText(SO_TU.replace(/^0+/, ''), NAP);
    await p.locator('#klThOwner').selectOption(`tk:${ID.cv1}`);
    await the2.locator('[data-cot="owner"]').selectOption(`tk:${ID.cv1}`);
    await expect(p.locator('#gvConThieu')).toHaveText('', NAP);
    await p.locator('#klThLuu').click();
    await expect(p.locator('#toastContainer')).toContainText('Đã giao 2 việc', NAP);

    // DB: văn bản mang mục tiêu AI; thẻ 1 gắn riêng có NQ_57 (tích sẵn); số hiệu mới vào danh mục (TU_DONG) và gắn cho thẻ 2.
    const vb = (await db.from('van_ban_giao_viec').select('id').eq('so_ket_luan', soVb()).single()).data;
    await expect.poll(async () => (await db.from('van_ban_muc_tieu').select('muc_tieu_ma, nguon').eq('van_ban_id', vb.id)).data, NAP)
      .toEqual([{ muc_tieu_ma: 'DP_CAN_BO', nguon: 'AI' }]);
    const viec = (await db.from('nhiem_vu').select('id, noi_dung').eq('van_ban_id', vb.id)).data;
    expect(viec, 'việc trùng và đoạn còn sót không được giao').toHaveLength(2);
    const v1 = viec.find((x) => x.noi_dung === nd1); const v2 = viec.find((x) => x.noi_dung === `${nd2}${tiep2}`);
    const mt = async (id) => (await db.from('nhiem_vu_muc_tieu').select('muc_tieu_ma, nguon').eq('nhiem_vu_id', id)).data;
    await expect.poll(async () => (await mt(v1.id)).find((x) => x.muc_tieu_ma === 'NQ_57')?.nguon, NAP).toBe('QUY_TAC');
    expect((await mt(v1.id)).find((x) => x.muc_tieu_ma === 'DP_CAN_BO')?.nguon, 'mục của văn bản trong phần gắn riêng giữ nguồn của văn bản').toBe('AI');
    const moi = (await db.from('dm_muc_tieu').select('ma, nhom, nguon_them').eq('so_hieu', SO_TU)).data;
    expect(moi, 'số hiệu Tỉnh ủy mới được hệ thống thêm vào danh mục').toEqual([expect.objectContaining({ nhom: 'NQ_TU', nguon_them: 'TU_DONG' })]);
    expect((await mt(v2.id)).map((x) => x.muc_tieu_ma)).toEqual(expect.arrayContaining(['DP_CAN_BO', moi[0].ma]));
    await context.close();
  });
});
