// v3.25 (0107–0112): Quản trị › Danh mục mục tiêu và Cấu hình AI. demo_qtht (quản trị hệ thống): danh mục theo nhóm, tìm không dấu, quy tắc nhận
// diện của NQ_57 (số hiệu — 0113, kiểm thử trên dữ liệu), thêm một mục tiêu E2E vào nhóm Nghị quyết Tỉnh ủy rồi khoá (đã đối chiếu) — lịch sử ghi
// cả hai; Cấu hình AI: trạng thái (Edge Function tro-ly-ai giả bằng route — không gọi dịch vụ thật), chuyển nhà cung cấp hiện đúng secret, lưu một
// thay đổi nhỏ có lý do (Nhật ký hệ thống ghi) rồi trả lại bằng service_role. Chuyên viên (demo_cv1) vào từ bánh răng: thêm được, không có Quản lý,
// quy tắc chỉ xem, không có tab Cấu hình AI. Mục tiêu E2E tự dọn. Tự bỏ qua khi project chưa có 0107–0112 hoặc chưa có demo_qtht.
import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs, contextAs, nav, NAP } from './lib/app.js';
import { OPTIONAL_USERS, storageStatePath } from './lib/roles.mjs';
import { getKeys } from './lib/keys.mjs';
import { E2E_TAG } from './global-setup.mjs';

const dbAdmin = () => { const k = getKeys(); return createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } }); };
const SO_HIEU = `${10000 + (Date.now() % 89999)}-NQ/TU`;
let cauHinhGoc = null;

async function pageAsQtht(browser, testInfo) {
  const context = await contextAs(browser, 'QTHT', testInfo);
  const page = await context.newPage();
  // Edge Function trợ lý AI giả: trạng thái (chưa có khoá) và kiểm tra kết nối — không gọi nhà cung cấp thật.
  await context.route('**/functions/v1/tro-ly-ai', async (route) => {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 200, headers: cors, body: 'ok' }); return; }
    const hd = JSON.parse(route.request().postData() || '{}').hanh_dong;
    const body = hd === 'kiem_tra' ? { ok: true, ket_qua: { tra_loi: 'Xin chào đồng chí.' }, mo_hinh: 'claude-sonnet-5-5', nha_cung_cap: 'Claude (Anthropic)', thoi_gian_ms: 1200 }
      : { ok: true, bat: true, nha_cung_cap: 'anthropic', ten: 'Claude (Anthropic)', mo_hinh: 'claude-sonnet-5-5', co_khoa: false, gui_noi_dung: true };
    await route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  });
  await page.goto('./');
  await expect(page.locator('#currentUserDisplay')).toContainText(OPTIONAL_USERS.QTHT.fullName);
  return page;
}
const lyDo = async (page, chu) => { await page.locator('#qtLyDo').fill(chu); await page.locator('#qtLyDoXacNhan').click(); };

test.describe.serial('Quản trị: danh mục mục tiêu then chốt, cấu hình trợ lý AI (v3.25)', () => {
  let co = false;
  test.beforeAll(async () => {
    const db = dbAdmin();
    const [q, c] = await Promise.all([db.from('quy_tac_muc_tieu').select('id').limit(1), db.from('cau_hinh_ai').select('*').eq('id', 1).maybeSingle()]);
    co = !q.error && !c.error && Boolean(c.data);
    cauHinhGoc = c.data || null;
  });
  test.beforeEach(() => {
    test.skip(!co, 'Chưa có migration 0107–0112 trên project này.');
  });
  test.afterAll(async () => {
    if (!co) return;
    const db = dbAdmin();
    const { data } = await db.from('dm_muc_tieu').select('ma').eq('so_hieu', SO_HIEU);
    for (const { ma } of data || []) {
      await db.from('dm_lich_su').delete().eq('bang', 'dm_muc_tieu').eq('ma', ma);
      await db.from('dm_muc_tieu').delete().eq('ma', ma);   // quy tắc số hiệu tự tạo xoá theo (ON DELETE CASCADE)
    }
    if (cauHinhGoc) await db.from('cau_hinh_ai').update({ gioi_han_nguoi: cauHinhGoc.gioi_han_nguoi }).eq('id', 1);
  });

  test('QTHT: danh mục, quy tắc NQ_57, thêm mục E2E rồi khoá, lịch sử', async ({ browser }, testInfo) => {
    test.skip(!existsSync(storageStatePath('QTHT')), 'Chưa có demo_qtht trên project này.');
    const page = await pageAsQtht(browser, testInfo);
    await nav(page, 'navQuanTri');
    await page.locator('#qtTabMucTieu').click();
    await expect(page.locator('#qtKhuMucTieu')).toBeVisible();
    await expect(page.locator('#qtMtBody')).toContainText('Nghị quyết 57-NQ/TW', NAP);
    await expect(page.locator('#qtMtNhomBody')).toContainText('NQ_TU');
    await expect(page.locator('#qtMtGanKhoi')).toContainText('Ngành thuộc khối');

    // Tìm (không phân biệt hoa thường; '/tw' loại các số hiệu …57-NQ/TU, kể cả mục E2E còn sót) → NQ_57 còn, NQ_59 lọc đi; quy tắc số hiệu
    // 57-NQ/TW, kiểm thử trên dữ liệu (không đổi gì).
    await page.locator('#qtMtTim').fill('57-nq/tw');
    await expect(page.locator('#qtMtBody button[data-action="qtMtMoCon"][data-phan="qt"][data-ma="NQ_57"]')).toBeVisible();
    await expect(page.locator('#qtMtBody button[data-action="qtMtMoCon"][data-phan="qt"][data-ma="NQ_59"]')).toHaveCount(0);
    await page.locator('#qtMtBody button[data-action="qtMtMoCon"][data-phan="qt"][data-ma="NQ_57"]').click();
    const qt = page.locator('#qtMtBody .qt-qt-bang');
    await expect(qt).toContainText('Số hiệu văn bản');
    await expect(qt).toContainText('57-NQ/TW');
    await qt.locator('button[data-action="qtQtKiem"]').first().click();
    await expect(page.locator('#qtMtBody .qt-qt-kq')).toContainText('Kiểm thử: Khớp', NAP);
    await page.locator('#qtMtTim').fill('');

    // Thêm mục tiêu E2E vào nhóm Nghị quyết Tỉnh ủy (số hiệu đúng dạng nhóm) → dùng được ngay, trạng thái Mới.
    const ten = `${E2E_TAG} Nghị quyết số ${SO_HIEU} (kiểm thử)`;
    await page.locator('#qtMtNutThem').click();
    await page.locator('#qtMtNhom').selectOption('NQ_TU');
    await page.locator('#qtMtSoHieu').fill(SO_HIEU);
    await page.locator('#qtMtTen').fill(ten);
    await page.locator('#qtMtLuuNut').click();
    await expect(page.locator('#toastContainer')).toContainText('vào danh mục', NAP);
    const { data } = await dbAdmin().from('dm_muc_tieu').select('ma, trang_thai, nguon_them').eq('so_hieu', SO_HIEU).single();
    expect(data).toMatchObject({ trang_thai: 'MOI', nguon_them: 'NGUOI_DUNG' });
    await page.locator('#qtMtLocTT').selectOption('MOI');
    const dong = page.locator('#qtMtBody > tr:not(.qt-mt-con)', { hasText: SO_HIEU });
    await expect(dong).toContainText('Mới');
    await expect(dong).toContainText('Cán bộ bổ sung');

    // Quản lý → Khoá (đã đối chiếu): lý do bắt buộc.
    await dong.locator('button[data-action="qtMtMoCon"][data-phan="ql"]').click();
    await page.locator(`#qtMtBody button[data-action="qtMtTrangThai"][data-hd="khoa"][data-ma="${data.ma}"]`).click();
    await expect(page.locator('#qtLyDoModal')).toBeVisible();
    await lyDo(page, `${E2E_TAG} đã đối chiếu ${testInfo.project.name}`);
    await expect(page.locator('#toastContainer')).toContainText('Khoá', NAP);
    await page.locator('#qtMtLocTT').selectOption('DA_DOI_CHIEU');
    await expect(page.locator('#qtMtBody > tr:not(.qt-mt-con)', { hasText: SO_HIEU })).toContainText('Đã đối chiếu');   // dòng chính (dòng mở rộng cũng chứa số hiệu)
    await page.locator(`#qtMtBody button[data-action="qtMtMoCon"][data-phan="ls"][data-ma="${data.ma}"]`).click();
    await expect(page.locator('#qtMtBody .qt-mt-ls')).toContainText('Khoá (đã đối chiếu)', NAP);
    await expect(page.locator('#qtMtBody .qt-mt-ls')).toContainText('Thêm');
    await page.context().close();
  });

  test('QTHT: Cấu hình AI — trạng thái khoá, đổi nhà cung cấp hiện secret, lưu có lý do, kiểm tra kết nối', async ({ browser }, testInfo) => {
    test.skip(!existsSync(storageStatePath('QTHT')), 'Chưa có demo_qtht trên project này.');
    const page = await pageAsQtht(browser, testInfo);
    await nav(page, 'navQuanTri');
    await page.locator('#qtTabAi').click();
    await expect(page.locator('#qtAiTrangThai')).toContainText('Khoá API', NAP);
    if (cauHinhGoc.nha_cung_cap !== 'gia_lap') await expect(page.locator('#qtAiTrangThai')).toContainText('chưa có');   // route giả: co_khoa = false
    await page.locator('#qtAiNccDs input[value="gemini"]').check();
    await expect(page.locator('#qtAiKhoa')).toContainText('AI_KEY_GEMINI');
    await expect(page.locator('#qtAiDoiChu')).toContainText('chưa lưu');
    test.skip(cauHinhGoc?.nha_cung_cap === 'gia_lap', 'Cấu hình đang ở giả lập (kiểm thử cục bộ) — bỏ phần lưu.');
    await page.locator(`#qtAiNccDs input[value="${cauHinhGoc.nha_cung_cap}"]`).check();
    await expect(page.locator('#qtAiMoHinh')).toHaveValue(cauHinhGoc.mo_hinh);
    await page.locator('#qtAiNguoi').fill(String(cauHinhGoc.gioi_han_nguoi + 1));
    await page.locator('#qtAiForm button[type="submit"]').click();
    await lyDo(page, `${E2E_TAG} thử lưu cấu hình AI ${testInfo.project.name}`);
    await expect(page.locator('#toastContainer')).toContainText('Đã lưu cấu hình trợ lý AI', NAP);
    expect((await dbAdmin().from('cau_hinh_ai').select('gioi_han_nguoi').eq('id', 1).single()).data.gioi_han_nguoi).toBe(cauHinhGoc.gioi_han_nguoi + 1);
    await page.locator('#qtAiKiemTraNut').click();
    await expect(page.locator('#toastContainer')).toContainText('Kết nối được', NAP);
    await page.locator('#qtTabNhatKyHeThong').click();
    await expect(page.locator('#qtNhatKyHeThongBody')).toContainText('Đổi cấu hình trợ lý AI', NAP);
    await page.context().close();
  });

  test('Chuyên viên: vào từ bánh răng, thêm được, không có Quản lý, quy tắc chỉ xem, không có Cấu hình AI', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A3', testInfo);
    await page.locator('#banhRangBtn').click();
    await page.locator('#banhRangMenu button[data-tab="qtKhuMucTieu"]').click();
    await expect(page.locator('#qtKhuMucTieu')).toBeVisible();
    await expect(page.locator('#qtMtBody')).toContainText('Nghị quyết 57-NQ/TW', NAP);
    await expect(page.locator('#qtMtNutThem')).toBeVisible();
    await expect(page.locator('#qtMtBody button[data-phan="ql"]')).toHaveCount(0);
    await expect(page.locator('#qtTabAi')).toBeHidden();
    await page.locator('#qtMtBody button[data-action="qtMtMoCon"][data-phan="qt"][data-ma="NQ_57"]').click();
    await expect(page.locator('#qtMtBody .qt-qt-bang')).toContainText('57-NQ/TW');
    await expect(page.locator('#qtMtBody [data-action="qtQtLuu"]')).toHaveCount(0);
    await page.context().close();
  });
});
