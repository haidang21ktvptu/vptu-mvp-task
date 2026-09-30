// PR-2b (0053) — Ngày làm việc có danh mục ngày nghỉ (thiết kế A1–A2).
// Khối 1 (logic thuần, CHỈ cục bộ): T7/CN, NGHI_LE, NGHI_BU, LAM_BU; ngay_lam_viec_sau/truoc, kl_so_ngay_lam_viec, gio_lam_viec_sau qua ngày lễ;
//   hạn Ký ban hành qua lễ ⇒ "muộn nhất không cần lý do" lùi qua ngày nghỉ; khung hạn nộp lấy "hôm nay" giờ Việt Nam (đúng cả khung 17–24h UTC).
// Khối 2 (quyền, cả staging): qt_dat_ngay_nghi — QTHT, Chánh VP được; PCVP, A2, A3, A0, anon bị chặn 42501; thiếu lý do / làm bù ngày thường
//   22023; nhật ký hệ thống có dòng; ghi thẳng bảng bị chặn; người đăng nhập đọc được, anon không. Dữ liệu năm 2031 (không chạm ngày đang dùng),
//   tên "KL-0053 …", tự dọn ở before/after (nhật ký hệ thống giữ — vết quản trị).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, anonClient, assertOk, assertDenied, CHI_CUC_BO, homNayVN } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const TEN = 'KL-0053';
const don = () => db().from('dm_ngay_nghi').delete().like('ten', `${TEN}%`);
const dat = async (username, ngay, loai, bat = true, lyDo = 'Kiểm thử ngày nghỉ') =>
  (await userClient(username)).rpc('qt_dat_ngay_nghi', { p_ngay: ngay, p_loai: loai, p_ten: `${TEN} ${loai}`, p_bat: bat, p_ly_do: lyDo });
const goi = async (fn, args) => { const r = await db().rpc(fn, args); assertOk(r, fn); return r.data; };
const assertLoi = (r, re, label) => assert.match(r.error?.message || '', re, `${label}: ${r.error?.message || 'không có lỗi'}`);

describe('0053 — ngày làm việc theo danh mục ngày nghỉ (logic)', { skip: SKIP || CHI_CUC_BO }, () => {
  before(async () => {
    await don();
    // 01/01/2031 (T4) nghỉ lễ, 02/01 (T5) nghỉ bù, 04/01 (T7) làm bù.
    assertOk(await db().from('dm_ngay_nghi').insert([
      { ngay: '2031-01-01', loai: 'NGHI_LE', ten: `${TEN} Tết Dương lịch` },
      { ngay: '2031-01-02', loai: 'NGHI_BU', ten: `${TEN} nghỉ bù` },
      { ngay: '2031-01-04', loai: 'LAM_BU', ten: `${TEN} làm bù` }]), 'nạp ngày nghỉ');
  });
  after(don);

  test('1. la_ngay_lam_viec: lễ / bù nghỉ / làm bù / Chủ nhật; ngay_lam_viec_sau / truoc bỏ ngày nghỉ, tính ngày làm bù', async () => {
    const la = await Promise.all(['2031-01-01', '2031-01-02', '2031-01-03', '2031-01-04', '2031-01-05'].map((d) => goi('la_ngay_lam_viec', { p_ngay: d })));
    assert.deepEqual(la, [false, false, true, true, false]);
    const sau = await Promise.all([1, 2, 3, 0].map((n) => goi('ngay_lam_viec_sau', { p_tu: '2030-12-31', p_so: n })));
    assert.deepEqual(sau, ['2031-01-03', '2031-01-04', '2031-01-06', '2030-12-31']);
    const truoc = await Promise.all([1, 3].map((n) => goi('ngay_lam_viec_truoc', { p_den: '2031-01-06', p_so: n })));
    assert.deepEqual(truoc, ['2031-01-04', '2030-12-31']);
    assert.equal(await goi('kl_so_ngay_lam_viec', { p_tu: '2030-12-31', p_den: '2031-01-06' }), 3);
  });

  test('2. gio_lam_viec_sau: 16h ngày 31/12 + 2 giờ ⇒ 8h30 ngày 03/01 (bỏ lễ + nghỉ bù); Hỏa tốc dùng cùng hàm', async () => {
    const r = await goi('gio_lam_viec_sau', { p_tu: '2030-12-31T16:00:00+07:00', p_gio: 2 });
    assert.equal(new Date(r).toISOString(), '2031-01-03T01:30:00.000Z');
  });

  test('3. Ký ban hành qua lễ: BH 26/12/2030 + 10 = 05/01/2031 (CN) ⇒ muộn nhất không cần lý do = 04/01 (làm bù)', async () => {
    const k = await goi('kl_khung_han_nop', { p_han_xu_ly: null, p_ngay_ban_hanh: '2030-12-26', p_loai_thoi_han: 'KY_BAN_HANH' });
    assert.deepEqual([k.han_xu_ly, k.khong_ly_do_den, k.den, k.qua_han], ['2031-01-05', '2031-01-04', '2031-01-05', false]);
  });

  test('4. khung hạn nộp: "hôm nay" = ngày giờ Việt Nam (kl_hom_nay), không phải ngày UTC — đúng cả khi chạy 17–24h UTC', async () => {
    const k = await goi('kl_khung_han_nop', { p_han_xu_ly: '2031-06-30' });
    assert.equal(k.tu, homNayVN());
    const qua = await goi('kl_khung_han_nop', { p_han_xu_ly: '2026-01-05' });   // hạn đã qua ⇒ [hôm nay, ngày làm việc thứ 2]
    assert.deepEqual([qua.tu, qua.qua_han, qua.den], [homNayVN(), true, await goi('ngay_lam_viec_sau', { p_tu: homNayVN(), p_so: 2 })]);
  });
});

describe('0053 — qt_dat_ngay_nghi: allowlist, lý do, nhật ký', { skip: SKIP }, () => {
  before(don);
  after(don);

  test('1. QTHT và Chánh VP ghi được; PCVP, A2, A3, A0 bị chặn 42501; anon bị chặn', async () => {
    assertOk(await dat('demo_qtht', '2031-02-10', 'NGHI_LE'), 'QTHT');
    assertOk(await dat('demo_cvp', '2031-02-11', 'NGHI_BU'), 'Chánh VP');
    const bi = await Promise.all(['demo_pcvp', 'demo_truongphong', 'demo_cv1', 'demo_a0'].map((u) => dat(u, '2031-02-12', 'NGHI_LE')));
    bi.forEach((r, i) => assert.equal(r.error?.code, '42501', `vai ${i}: ${r.error?.message}`));
    assertDenied(await anonClient().rpc('qt_dat_ngay_nghi', { p_ngay: '2031-02-12', p_loai: 'NGHI_LE', p_ten: TEN, p_bat: true, p_ly_do: 'x' }), 'anon');
  });

  test('2. thiếu lý do / làm bù vào ngày thường ⇒ 22023; bỏ ngày; nhật ký hệ thống có dòng; ghi thẳng bảng bị chặn; đọc: đăng nhập được, anon không', async () => {
    assertLoi(await dat('demo_qtht', '2031-02-13', 'NGHI_LE', true, '  '), /lý do/, 'thiếu lý do');
    assertLoi(await dat('demo_qtht', '2031-02-13', 'LAM_BU'), /Thứ Bảy hoặc Chủ nhật/, 'làm bù ngày thường');
    assertOk(await dat('demo_qtht', '2031-02-11', 'NGHI_BU', false), 'bỏ ngày');
    const nk = await db().from('nhat_ky_he_thong').select('doi_tuong').eq('hanh_dong', 'ngay_nghi').in('doi_tuong', ['2031-02-10', '2031-02-11']);
    assert.ok(nk.data.length >= 3, `nhật ký ${nk.data.length} dòng`);
    assertDenied(await (await userClient('demo_cvp')).from('dm_ngay_nghi').insert({ ngay: '2031-02-14', loai: 'NGHI_LE', ten: `${TEN} ghi thẳng` }), 'ghi thẳng');
    const doc = await (await userClient('demo_cv1')).from('dm_ngay_nghi').select('ngay').like('ten', `${TEN}%`);
    assert.deepEqual(doc.data.map((x) => x.ngay), ['2031-02-10']);
    const an = await anonClient().from('dm_ngay_nghi').select('ngay');
    assert.ok(an.error || an.data.length === 0, 'anon không đọc được');
  });
});
