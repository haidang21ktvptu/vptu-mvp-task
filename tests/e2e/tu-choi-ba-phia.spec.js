// GĐ22 — từ chối hiện rõ ba phía: A3 (demo_e2e_nv) đề nghị từ chối trên thẻ "Việc mới giao" → thẻ ghi "Đã đề nghị từ chối, chờ Demo Trưởng phòng
// duyệt"; A2 (người giao, cấp duyệt) thấy đề nghị ở khối cần duyệt và việc mình giao trong khối "đang đề nghị từ chối" → Đồng ý → khối "Việc đồng
// chí giao bị từ chối" có nút Giao lại; A3 quay lại thấy "Đã đồng ý từ chối, chờ giao lại", huy hiệu Nhắn tin (tin duyệt = tin hệ thống chưa đọc)
// có số, hội thoại của việc trong Nhắn tin có tin duyệt. Dữ liệu tạo bằng service_role, tự dọn.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs, nav, NAP } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { E2E_TAG } from './global-setup.mjs';
import { kiemThayViec } from './lib/du-lieu.mjs';

const NV_ID = '00000000-0000-4000-8000-000000000012';       // demo_e2e_nv (A3, Tổng hợp)
const TP_ID = '00000000-0000-4000-8000-000000000003';       // demo_truongphong (A2, Tổng hợp) — người giao và cấp duyệt
const homNayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const congNgay = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

test.describe.serial('Từ chối nhận việc — người đề nghị, người giao, tin duyệt', () => {
  let db; let id; let ma; let noiDung; let duAn;

  test.beforeAll(async ({}, testInfo) => { // eslint-disable-line no-empty-pattern
    duAn = testInfo.project.name;
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('kl_cau_hinh').select('khoa').eq('khoa', 'thuong_truc_han_nhan_ngay').maybeSingle();
    test.skip(!co.data, 'Project chưa có migration 0035+.');
    await don(db, duAn);
    noiDung = `${E2E_TAG} tu-choi ${duAn} ${Date.now()}`;
    const { data: vb, error: e1 } = await db.from('van_ban_giao_viec').insert({ so_ket_luan: `${E2E_TAG}-TC3-${duAn}-${Date.now()}`, loai: 'CONG_VAN', ngay_ban_hanh: '2026-09-01' }).select('id').single();
    if (e1) throw new Error(`Tạo văn bản mẫu thất bại: ${e1.message}`);
    const { data, error: e2 } = await db.from('nhiem_vu').insert({ van_ban_id: vb.id, noi_dung: noiDung, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: congNgay(homNayVN(), 12),
      owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: NV_ID, nguoi_theo_doi: TP_ID, tao_boi: TP_ID, theo_1400: true, san_pham_loai: 'BAO_CAO', ngay_nhan_van_ban: homNayVN(), do_khan: 'KHAN' }).select('id, ma').single();
    if (e2) throw new Error(`Tạo việc mẫu thất bại: ${e2.message}`);
    id = data.id; ma = data.ma;
    // Việc mẫu phải nằm trong phạm vi vai sẽ xem — kiểm ngay bằng token của vai, lỗi rõ ở beforeAll (không chờ 10 giây ở #klRow).
    await kiemThayViec('E2E_NV', id, ma); await kiemThayViec('A2', id, ma);
  });
  test.afterAll(async () => { if (db) await don(db, duAn); });

  test('A3: thẻ việc mới có nhãn Khẩn → Từ chối với lý do → thẻ ghi chờ Trưởng phòng duyệt', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'E2E_NV', testInfo);
    const the = page.locator(`#vctMuc-moi #vct-${id}`);
    await expect(the).toBeVisible({ timeout: 15_000 });
    await expect(the.locator('.dk-khan')).toContainText('Khẩn');
    await the.getByRole('button', { name: 'Từ chối' }).click();
    const o = page.locator(`#oTc-${id}`);
    await expect(o).toBeVisible();
    await o.locator('input[name=noi_dung]').fill('Đang đi công tác, không thể nhận (e2e)');
    await o.getByRole('button', { name: 'Gửi đề nghị' }).click();
    await expect(page.locator('#toastContainer')).toContainText('Đã gửi đề nghị từ chối');
    await expect(page.locator(`#vct-${id}`)).toContainText('Đã đề nghị từ chối', NAP);
    await expect(page.locator(`#vct-${id}`)).toContainText('chờ Demo Trưởng phòng duyệt', NAP);
    await page.context().close();
  });

  test('A2: đề nghị ở khối cần duyệt + việc mình giao "đang đề nghị từ chối" → Đồng ý → khối bị từ chối có nút Giao lại', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A2', testInfo);
    const btc = page.locator(`#btc-${id}`);
    await expect(btc).toBeVisible({ timeout: 15_000 });
    await expect(btc).toHaveAttribute('data-tu-choi', 'cho', NAP);
    await expect(btc).toContainText('đề nghị từ chối');
    const { data: tc } = await db.from('tu_choi').select('id').eq('nhiem_vu_id', id).eq('trang_thai', 'CHO_DUYET').single();
    const de = page.locator(`#tc-${tc.id}`);
    await expect(de).toBeVisible(NAP);
    await expect(de).toContainText('Lý do:');
    await de.getByRole('button', { name: 'Đồng ý từ chối' }).click();
    await expect(page.locator('#toastContainer')).toContainText('Đã đồng ý từ chối');
    await expect(page.locator(`#btc-${id}`)).toHaveAttribute('data-tu-choi', 'da', { timeout: 15_000 });
    await expect(page.locator(`#btc-${id} .nhan-tu-choi`)).toHaveText('Bị từ chối');
    await expect(page.locator(`#btc-${id}`).getByRole('button', { name: 'Giao lại' })).toBeVisible();
    await expect(page.locator('#dhCanXuLy')).toContainText('việc bị từ chối');
    await page.context().close();
  });

  test('A1: dải Cần xử lý → bấm "việc bị từ chối" → danh sách dưới dải có dòng mã việc và nút Giao lại', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A1', testInfo);
    const nutMuc = page.locator('#canXuLy button[data-muc="tuchoi"]');
    await expect(nutMuc).toContainText('việc bị từ chối', { timeout: 15_000 });
    await nutMuc.click();
    await expect(nutMuc).toHaveAttribute('aria-expanded', 'true');
    const dong = page.locator(`#cx-tuchoi-${id}`);
    await expect(dong).toBeVisible();
    await expect(dong.locator('.cx-ma')).toHaveText(ma);
    await expect(dong).toContainText('Bị từ chối');
    await expect(dong.getByRole('button', { name: 'Giao lại' })).toBeVisible();
    await dong.getByRole('button', { name: 'Giao lại' }).click();
    await expect(page.locator(`#cxGiaoLai-${id}`)).toBeVisible(); // ô giao lại mở ngay dưới dòng
    await page.context().close();
  });

  test('A3: thấy "Đã đồng ý từ chối, chờ giao lại"; huy hiệu Nhắn tin có số; hội thoại của việc có tin duyệt', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'E2E_NV', testInfo);
    await expect(page.locator('#vctThanhTuChoi')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`#vctThanhTuChoi p[data-nhiem-vu="${id}"]`)).toContainText('Đã đồng ý từ chối, chờ giao lại', NAP);
    await expect(page.locator(`#vctMuc-tu-choi #vct-${id}`)).toContainText('Đã đồng ý từ chối', NAP);
    await expect(page.locator('#dmBubbleBadge')).toBeVisible();
    await expect(page.locator('#dmBubbleBadge')).toHaveText(/^[1-9]\d*$/);
    await nav(page, 'dmBubbleLauncher');
    const viec = page.locator(`#dmViecList [data-nv="${id}"]`);
    await expect(viec).toBeVisible(NAP);
    await viec.click();
    await expect(page.locator('#dmChatBox')).toContainText(`Duyệt đề nghị từ chối · ${ma}`);
    await page.context().close();
  });
});

// Chỉ dọn dữ liệu của project này (khoá có tên project); khoá TC3 tách khỏi TC của tu-choi.spec.
async function don(db, duAn) {
  await db.from('nhiem_vu').delete().like('noi_dung', `${E2E_TAG} tu-choi ${duAn}%`);
  await db.from('van_ban_giao_viec').delete().like('so_ket_luan', `${E2E_TAG}-TC3-${duAn}-%`);
}
