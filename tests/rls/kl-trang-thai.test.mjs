// Hàm kl_trang_thai — nguồn duy nhất của trạng thái (thiết kế KL BTVTU Phần 2.2, 2.5, 6.2, 6.4).
// Gọi qua kl_tinh_trang_thai(id, ngày) bằng service_role với NGÀY CỐ ĐỊNH để kết quả không phụ thuộc hôm nay.
// Kèm ràng buộc/trigger của nhiem_vu (Phần 2.3) — những gì phải chặn ngay khi ghi. Hai dòng KL-TZ (múi giờ)
// không mang tiền tố RLS-TEST để rls-10 đếm phạm vi không đổi; dọn theo hội nghị 999 ở teardown.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, assertOk, IDS } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration 0014–0016 trên project này (chạy lại sau khi merge).';
let fx;
before(async () => { if (!SKIP) fx = await setupKlFixtures(); });

async function tt(id, ngay) {
  const r = await adminClient().rpc('kl_tinh_trang_thai', { p_id: id, p_ngay: ngay });
  assertOk(r, `kl_tinh_trang_thai ${ngay}`);
  return r.data;
}

describe('kl_trang_thai — quy tắc dẫn xuất theo thứ tự 2.2', { skip: SKIP }, () => {
  test('1. Hoàn thành thắng mọi quy tắc: hoàn thành sau hạn vẫn HOAN_THANH, ket_qua TRE đúng số ngày', async () => {
    const r = await tt(fx.n2, '2026-09-14');
    assert.equal(r.trang_thai, 'HOAN_THANH'); assert.equal(r.nhom_dem, 'HOAN_THANH');
    assert.equal(r.ket_qua, 'TRE'); assert.equal(r.so_ngay_tre, 5);
    assert.ok(r.do_tre_nhap_lieu >= 0, 'độ trễ nhập liệu = ngày ghi nhận − ngày hoàn thành thật');
    assert.equal(r.so_ngay_qua, null);
  });
  test('2. Thường xuyên dù có hạn đã qua → THUONG_XUYEN', async () => {
    const r = await tt(fx.n6, '2026-09-14');
    assert.equal(r.trang_thai, 'THUONG_XUYEN'); assert.equal(r.so_ngay_qua, null);
  });
  test('3. Có hạn cụ thể, chưa có hạn (có lý do) → CAN_DIEN_HAN; 3b. Chờ quyết định → CHO_DIEU_KIEN', async () => {
    assert.equal((await tt(fx.n4, '2026-09-14')).trang_thai, 'CAN_DIEN_HAN');
    assert.equal((await tt(fx.n5, '2026-09-14')).trang_thai, 'CHO_DIEU_KIEN');
  });
  test('4. Hạn = hôm qua → QUA_HAN 1 ngày; tại 14/09 → 30 ngày', async () => {
    const r1 = await tt(fx.n1, '2026-08-16');
    assert.equal(r1.trang_thai, 'QUA_HAN'); assert.equal(r1.so_ngay_qua, 1);
    const r2 = await tt(fx.n1, '2026-09-14');
    assert.equal(r2.so_ngay_qua, 30); assert.equal(r2.ket_qua, null);
  });
  test('5. Hạn = ngày tính → chưa quá, SAP_DEN_HAN; hạn = ngày + 7 → SAP_DEN_HAN; ngày + 8 → DANG_THUC_HIEN (ngưỡng 7 từ kl_cau_hinh)', async () => {
    assert.equal((await tt(fx.n1, '2026-08-15')).trang_thai, 'SAP_DEN_HAN');
    assert.equal((await tt(fx.n1, '2026-08-08')).trang_thai, 'SAP_DEN_HAN');
    assert.equal((await tt(fx.n1, '2026-08-07')).trang_thai, 'DANG_THUC_HIEN');
  });
  test('6. Ký ban hành: hạn nhập tay bị ghi đè = ngày ban hành + 10', async () => {
    const { data } = await adminClient().from('nhiem_vu').select('han_xu_ly').eq('id', fx.n3).single();
    assert.equal(data.han_xu_ly, '2026-08-11');
    assert.equal((await tt(fx.n3, '2026-08-11')).trang_thai, 'SAP_DEN_HAN');
    assert.equal((await tt(fx.n3, '2026-08-12')).trang_thai, 'QUA_HAN');
  });
  test('7. Excel Hoàn thành không ngày, không hạn → HOAN_THANH, ket_qua KHONG_DANH_GIA; giữ cap_nhat_luc từ Excel', async () => {
    const r = await tt(fx.n7, '2026-09-14');
    assert.equal(r.trang_thai, 'HOAN_THANH'); assert.equal(r.ket_qua, 'KHONG_DANH_GIA'); assert.equal(r.do_tre_nhap_lieu, null);
    const { data } = await adminClient().from('nhiem_vu').select('cap_nhat_luc, thieu_minh_chung').eq('id', fx.n7).single();
    assert.equal(new Date(data.cap_nhat_luc).toISOString(), '2026-09-01T11:03:00.000Z');
    assert.equal(data.thieu_minh_chung, true, 'cờ thiếu minh chứng của dữ liệu cũ (0021 không chặn ngược)');
  });
  test('8. do_tre_nhap_lieu lấy NGÀY theo giờ Việt Nam: ghi nhận 18:30 UTC (= 01:30 hôm sau giờ VN) tính đủ ngày', async () => {
    // Postgres trên Supabase chạy UTC; cast ::date trần sẽ cho 27/08 thay vì 28/08 → thiếu một ngày độ trễ.
    const db = adminClient();
    const base = { van_ban_id: fx.hn, nguoi_theo_doi: IDS.cv1, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-08-20',
      tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2026-08-25', minh_chung: 'CV', nguon: 'excel' };
    const r = await db.from('nhiem_vu').insert([
      { ...base, ma: 'NV-T08', noi_dung: 'KL-TZ N8 ghi 18:30 UTC', dong_luc: '2026-08-27T18:30:00Z' }, // 28/08 01:30 VN
      { ...base, ma: 'NV-T09', noi_dung: 'KL-TZ N9 ghi 16:59 UTC', dong_luc: '2026-08-27T16:59:00Z' }, // 27/08 23:59 VN
    ]).select('id, ma');
    assertOk(r, 'tạo dòng thử múi giờ');
    const id = (ma) => r.data.find((x) => x.ma === ma).id;
    assert.equal((await tt(id('NV-T08'), '2026-09-14')).do_tre_nhap_lieu, 3, '28/08 − 25/08 theo giờ VN');
    assert.equal((await tt(id('NV-T09'), '2026-09-14')).do_tre_nhap_lieu, 2, '27/08 − 25/08');
  });
  test('9. Bất biến: tổng nhom_dem của bộ mẫu = 7 dòng, đúng phân bố tại 14/09', async () => {
    const dem = {};
    for (const id of [fx.n1, fx.n2, fx.n3, fx.n4, fx.n5, fx.n6, fx.n7]) {
      const r = await tt(id, '2026-09-14');
      dem[r.nhom_dem] = (dem[r.nhom_dem] || 0) + 1;
    }
    assert.deepEqual(dem, { QUA_HAN: 2, HOAN_THANH: 2, CAN_DIEN_HAN: 1, CHO_DIEU_KIEN: 1, THUONG_XUYEN: 1 });
  });
});

describe('nhiem_vu — ràng buộc và trigger (Phần 2.3, 6.2)', { skip: SKIP }, () => {
  const db = () => adminClient();
  test('bị chặn: Có hạn cụ thể không hạn không lý do; chủ trì trống; hạn trước ngày ban hành; ngày ban hành tương lai', async () => {
    const base = { van_ban_id: fx.hn, nguoi_theo_doi: IDS.cv1, noi_dung: 'RLS-TEST lỗi', loai_thoi_han_ma: 'CO_HAN_CU_THE' };
    assert.ok((await db().from('nhiem_vu').insert(base).select('id')).error, 'thiếu hạn và lý do');
    assert.ok((await db().from('nhiem_vu').insert({ ...base, nguoi_theo_doi: null, han_xu_ly: '2026-09-01' }).select('id')).error, 'chủ trì NULL');
    assert.ok((await db().from('nhiem_vu').insert({ ...base, han_xu_ly: '2026-07-01' }).select('id')).error, 'hạn trước ngày BH');
    assert.ok((await db().from('van_ban_giao_viec').insert({ so_hoi_nghi: 998, so_ket_luan: 'RLS-TEST tương lai', ngay_ban_hanh: '2099-01-01' }).select('id')).error, 'ngày BH tương lai');
  });
  test('Hoàn thành bắt buộc ngày hoàn thành (và minh chứng từ 0021); ngày ngoài [ngày BH, hôm nay] bị chặn; quay lại đang làm thì xoá ngày', async () => {
    const mc = { minh_chung: 'RLS-TEST CV 01' };
    assert.ok((await db().from('nhiem_vu').update({ tien_do_ma: 'HOAN_THANH', ...mc }).eq('id', fx.n1).select('id')).error, 'thiếu ngày hoàn thành');
    assert.ok((await db().from('nhiem_vu').update({ tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2099-01-01', ...mc }).eq('id', fx.n1).select('id')).error, 'ngày tương lai');
    const ok = await db().from('nhiem_vu').update({ tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2026-09-01', ...mc }).eq('id', fx.n1).select('dong_luc');
    assertOk(ok, 'hoàn thành'); assert.ok(ok.data[0].dong_luc, 'ghi lúc chuyển sang Hoàn thành');
    const back = await db().from('nhiem_vu').update({ tien_do_ma: 'DANG_THUC_HIEN' }).eq('id', fx.n1).select('ngay_hoan_thanh, dong_luc');
    assertOk(back, 'quay lại'); assert.deepEqual(back.data[0], { ngay_hoan_thanh: null, dong_luc: null });
  });
  test('Điền hạn thì lý do chưa có hạn tự xoá; lịch sử ghi từng cột đổi với nguon = app', async () => {
    const r = await db().from('nhiem_vu').update({ han_xu_ly: '2026-10-01' }).eq('id', fx.n4).select('ly_do_chua_co_han');
    assertOk(r, 'điền hạn'); assert.equal(r.data[0].ly_do_chua_co_han, null);
    const { data: ls } = await db().from('lich_su').select('cot, gia_tri_cu, gia_tri_moi, nguon').eq('nhiem_vu_id', fx.n4).order('id');
    assert.equal(ls[0].cot, '*');
    assert.ok(ls.some((l) => l.cot === 'han_xu_ly' && l.gia_tri_moi === '2026-10-01' && l.nguon === 'app'));
    assert.ok(ls.some((l) => l.cot === 'ly_do_chua_co_han' && l.gia_tri_moi === null));
    await db().from('nhiem_vu').update({ han_xu_ly: null, ly_do_chua_co_han: 'Phụ thuộc yếu tố bên ngoài' }).eq('id', fx.n4);
  });
  test('Đổi ngày ban hành → hạn Ký ban hành tính lại', async () => {
    assertOk(await db().from('van_ban_giao_viec').update({ ngay_ban_hanh: '2026-08-05' }).eq('id', fx.hn), 'đổi ngày BH');
    const { data } = await db().from('nhiem_vu').select('han_xu_ly').eq('id', fx.n3).single();
    assert.equal(data.han_xu_ly, '2026-08-15');
    await db().from('van_ban_giao_viec').update({ ngay_ban_hanh: '2026-08-01' }).eq('id', fx.hn);
  });
});
