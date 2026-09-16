// Mốc đối chiếu sau khi nhập dữ liệu (PR 8B), thiết kế KL BTVTU mục 1.5 và điều kiện xong GĐ8:
// 185 dòng nguon = 'excel' (file thật trên production; bộ dữ liệu vàng ẩn danh tests/rls/du-lieu-vang/kl-btvtu.json
// trên local/staging — cùng ngày, loại hạn, tiến độ nên cùng bộ số), tính tại ngày 14/9/2026 bằng trang_thai
// (qua nhom_dem) phải ra đúng bộ số chủ dự án chốt. Loại trừ fixture RLS-TEST (N7 cũng nguon = 'excel').
// Tự bỏ qua khi project chưa có đúng 185 dòng (chưa chạy scripts/nhap-kl-btvtu.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, assertOk } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

export const NGAY_MOC = '2026-09-14';
export const MOC = { HOAN_THANH: 146, THUONG_XUYEN: 16, QUA_HAN: 8, DANG_THUC_HIEN: 6, CHO_DIEU_KIEN: 6, CAN_DIEN_HAN: 3, SAP_DEN_HAN: 0 };
export const TONG = 185;

test(`mốc ${NGAY_MOC}: ${TONG} dòng Excel cho đúng bộ số đã chốt`, async (t) => {
  if (!(await klSchemaReady())) return t.skip('Chưa có migration 0014–0016 trên project này.');
  const db = adminClient();
  const { data: rows, error } = await db.from('nhiem_vu').select('id, nguoi_theo_doi').eq('nguon', 'excel').not('noi_dung', 'like', 'RLS-TEST%');
  assertOk({ error }, 'đọc dòng excel');
  if (rows.length !== TONG) return t.skip(`Project có ${rows.length}/${TONG} dòng nguon = excel — chạy scripts/nhap-kl-btvtu.mjs trước.`);

  const dem = Object.fromEntries(Object.keys(MOC).map((k) => [k, 0]));
  const theoChuTri = {};
  for (const { id, nguoi_theo_doi } of rows) {
    const r = await db.rpc('tinh_trang_thai', { p_id: id, p_ngay: NGAY_MOC });
    assertOk(r, `tinh_trang_thai ${id}`);
    dem[r.data.nhom_dem] = (dem[r.data.nhom_dem] || 0) + 1;
    theoChuTri[nguoi_theo_doi] = (theoChuTri[nguoi_theo_doi] || 0) + 1;
  }
  assert.deepEqual(dem, MOC, 'bộ số tại 14/9/2026 lệch mốc — giải thích từng dòng lệch trước khi đổi mốc');
  // Bất biến (mục 2.5): tổng các nhóm = tổng dòng; tổng theo chủ trì = tổng dòng.
  assert.equal(Object.values(dem).reduce((a, b) => a + b, 0), TONG, 'bất biến: tổng các nhóm = tổng dòng');
  assert.equal(Object.values(theoChuTri).reduce((a, b) => a + b, 0), TONG, 'bất biến: tổng theo chủ trì = tổng dòng');
});
