// 0078 (Đợt A v3.17) — giao_viec: lãnh đạo giao cho chính mình (A2, PCVP; cấp nhận = cấp trên, theo dõi = chính họ; vai khác vẫn chặn như 0025);
// giao_viec_nhieu: nhiều nhiệm vụ từ một văn bản trong một giao dịch (văn bản mới tạo một lần, dòng ghi đè phần chung, cấp nhận từng dòng), lỗi
// dòng nào báo "Dòng n: …" và hoàn tác cả lô (không việc, không văn bản), giới hạn 1–20 dòng, A3 giao cho phòng bị chặn (0085). Khoá "KL-0078"; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, IDS } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const KHOA = 'KL-0078';
const TP_RT = '00000000-0000-4000-8000-000000000015';   // demo_e2e_tp — A2 phòng E2E_RT (seed)
let dem = 0;
const vb = () => ({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} #${++dem}`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02' });
const CHUNG = { san_pham_loai: 'TO_TRINH', han_xu_ly: '2026-12-31', nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_ma: 'LV08_TAI_CHINH', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH' };
const giao = async (username, p = {}) => (await userClient(username)).rpc('giao_viec', { p: { van_ban_id: null, van_ban: vb(), noi_dung: `${KHOA} ${username} ${dem}`, ...CHUNG, ...p } });
const nhieu = async (username, chung, dong) => (await userClient(username)).rpc('giao_viec_nhieu', { p_chung: { van_ban_id: null, van_ban: vb(), ...CHUNG, ...chung }, p_dong: dong });
const doc = async (id) => (await db().from('nhiem_vu').select('owner_tai_khoan, owner_don_vi_ma, nguoi_theo_doi, cap_nhan_san_pham, noi_dung, han_xu_ly, san_pham_loai, van_ban_id, do_khan').eq('id', id).single()).data;
const loi = (r, re, label) => assert.match(r.error?.message || '', re, `${label}: ${r.error?.message || 'không có lỗi'}`);
const chan = (r, label) => assert.equal(r.error?.code, '42501', `${label}: ${r.error?.message || 'không bị chặn'}`);
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
};

describe('0078 — giao cho chính mình, giao nhiều nhiệm vụ từ một văn bản', { skip: SKIP }, () => {
  before(don);
  after(don);

  test('1. Trưởng phòng giao cho chính mình: được, theo dõi = chính mình, cấp nhận = Phó Chánh VP; giao cho Trưởng phòng khác vẫn 42501', async () => {
    const r = await giao('demo_truongphong', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.truongphong }); assertOk(r, 'A2 tự giao');
    const v = await doc(r.data.id);
    assert.deepEqual([v.owner_tai_khoan, v.nguoi_theo_doi, v.cap_nhan_san_pham], [IDS.truongphong, IDS.truongphong, 'PHO_CHANH_VAN_PHONG']);
    const k = await giao('demo_truongphong', { owner_don_vi_ma: 'E2E_RT', owner_tai_khoan: TP_RT });
    chan(k, 'A2 giao cho Trưởng phòng phòng khác'); loi(k, /chuyên viên phòng mình hoặc cho chính mình/, 'thông báo');
  });

  test('2. Phó Chánh VP giao cho chính mình: được, cấp nhận = Thường trực; giao cho Chánh VP vẫn 42501; Chánh VP tự giao: được', async () => {
    const r = await giao('demo_pcvp', { owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.pcvp }); assertOk(r, 'PCVP tự giao');
    const v = await doc(r.data.id);
    assert.deepEqual([v.owner_tai_khoan, v.nguoi_theo_doi, v.cap_nhan_san_pham], [IDS.pcvp, IDS.pcvp, 'THUONG_TRUC']);
    chan(await giao('demo_pcvp', { owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.cvp }), 'PCVP giao cho Chánh VP');
    assertOk(await giao('demo_cvp', { owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.cvp }), 'Chánh VP tự giao');
  });

  test('3. giao_viec_nhieu: 3 dòng (cv1, chính mình, cv1) — một văn bản mới, ba việc, dòng ghi đè phần chung, cấp nhận từng dòng, theo dõi chung', async () => {
    const r = await nhieu('demo_truongphong', { nguoi_theo_doi: IDS.cv1, do_khan: 'KHAN' }, [
      { noi_dung: `${KHOA} nhiều 1`, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, san_pham_loai: 'BAO_CAO', han_xu_ly: '2026-11-30' },
      { noi_dung: `${KHOA} nhiều 2 (tự)`, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.truongphong, cap_nhan_san_pham: 'PHO_CHANH_VAN_PHONG', han_xu_ly: '2026-12-15' },
      { noi_dung: `${KHOA} nhiều 3`, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, han_xu_ly: '2026-12-31' }]);
    assertOk(r, 'giao 3 việc');
    assert.equal(r.data.so, 3); assert.deepEqual(r.data.viec.map((x) => x.dong), [1, 2, 3]); assert.ok(r.data.viec.every((x) => /^NV-/.test(x.ma)));
    const vs = await Promise.all(r.data.viec.map((x) => doc(x.id)));
    assert.ok(vs.every((v) => v.van_ban_id === r.data.van_ban_id && v.nguoi_theo_doi === IDS.cv1 && v.do_khan === 'KHAN'), 'cùng văn bản, theo dõi và độ khẩn chung');
    assert.deepEqual(vs.map((v) => [v.owner_tai_khoan, v.san_pham_loai, v.han_xu_ly, v.cap_nhan_san_pham]),
      [[IDS.cv1, 'BAO_CAO', '2026-11-30', 'TRUONG_PHONG'], [IDS.truongphong, 'TO_TRINH', '2026-12-15', 'PHO_CHANH_VAN_PHONG'], [IDS.cv1, 'TO_TRINH', '2026-12-31', 'TRUONG_PHONG']]);
    const so = await db().from('van_ban_giao_viec').select('id').eq('so_ket_luan', `${KHOA} #${dem}`);
    assert.equal(so.data.length, 1, 'văn bản mới tạo đúng một lần');
  });

  test('4. Lỗi ở dòng 2 ⇒ "Dòng 2: …" cùng mã 42501, hoàn tác cả lô: không việc, không văn bản', async () => {
    const r = await nhieu('demo_truongphong', {}, [
      { noi_dung: `${KHOA} lô lỗi 1`, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 },
      { noi_dung: `${KHOA} lô lỗi 2`, owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2 },
      { noi_dung: `${KHOA} lô lỗi 3`, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 }]);
    chan(r, 'lô có dòng sai'); loi(r, /^Dòng 2: .*chuyên viên phòng mình/, 'tiền tố dòng');
    assert.equal((await db().from('nhiem_vu').select('id').like('noi_dung', `${KHOA} lô lỗi%`)).data.length, 0, 'không việc nào');
    assert.equal((await db().from('van_ban_giao_viec').select('id').eq('so_ket_luan', `${KHOA} #${dem}`)).data.length, 0, 'không văn bản');
  });

  test('5. Giới hạn: 0 dòng ⇒ 22023; 21 dòng ⇒ "tối đa 20"; văn bản có sẵn (van_ban_id) dùng cho mọi dòng; A3 giao cho phòng bị chặn ngay dòng 1 (0085)', async () => {
    loi(await nhieu('demo_truongphong', {}, []), /ít nhất một dòng/, '0 dòng');
    const dong = (n) => Array.from({ length: n }, (_, i) => ({ noi_dung: `${KHOA} giới hạn ${i + 1}`, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 }));
    loi(await nhieu('demo_truongphong', {}, dong(21)), /tối đa 20/, '21 dòng');
    const vbr = await db().from('van_ban_giao_viec').insert({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} có sẵn`, ngay_ban_hanh: '2026-09-01' }).select('id').single();
    const r = await (await userClient('demo_truongphong')).rpc('giao_viec_nhieu', { p_chung: { van_ban_id: vbr.data.id, ...CHUNG }, p_dong: dong(2) });
    assertOk(r, 'văn bản có sẵn'); assert.equal(r.data.van_ban_id, vbr.data.id);
    assert.ok((await Promise.all(r.data.viec.map((x) => doc(x.id)))).every((v) => v.van_ban_id === vbr.data.id));
    const a3 = await nhieu('demo_cv1', {}, [{ noi_dung: `${KHOA} giới hạn a3`, owner_don_vi_ma: 'TONG_HOP' }]);   // 0085: chuyên viên giao thẳng được cho chuyên viên; Owner phòng bị chặn ngay dòng 1
    chan(a3, 'A3 giao nhiều cho phòng'); loi(a3, /^Dòng 1: /, 'tiền tố dòng');
  });
});
