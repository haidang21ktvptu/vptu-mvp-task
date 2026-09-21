// GĐ16 (0028, PR 16A) — minh chứng có cấu trúc: ghi trực tiếp bảng bị chặn; nop_minh_chung (Owner/theo dõi, ba trường bắt buộc,
// khoảng ngày, danh mục cấp); phạm vi đọc theo kl_pham_vi; xac_nhan_minh_chung (theo dõi/A1/A2 trong phạm vi, không tự xác nhận);
// dong_nhiem_vu (chặn khi không có minh chứng hợp lệ, ngày mặc định = ngày văn bản mới nhất, lead time); việc theo_1400 không đóng
// bằng chữ; chữ cũ (chu_cu) hợp lệ; cờ thieu_minh_chung tính lại; tách số hiệu/ngày; kiểm ngày với cận dưới NULL; múi giờ. Mã NV-T6x, tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
let fx; const id = {}; const mc = {};
const them = async (row) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, nguoi_theo_doi: IDS.cv1, noi_dung: `KL-0028 ${row.ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE',
    han_xu_ly: '2026-08-15', nganh_ma: 'KINH_TE_TONG_HOP', theo_1400: true, ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, ...row }).select('id').single();
  assertOk(r, row.ma); id[row.ma] = r.data.id;
};
const rpc = async (username, fn, args) => (await userClient(username)).rpc(fn, args);
// 0046: minh chứng nộp mới bắt buộc thêm trích yếu + mô tả kết quả (≤ 600 ký tự); bản ghi cũ (chèn thẳng bằng service_role) giữ NULL vẫn hợp lệ.
const nop = (username, ma, p) => rpc(username, 'nop_minh_chung', { p: { nhiem_vu_id: id[ma], so_hieu: '12/CV-VPTU', ngay_van_ban: '2026-08-20', cap_nhan: 'CHANH_VAN_PHONG',
  trich_yeu: 'Báo cáo kết quả (RLS 0028)', mo_ta_ket_qua: 'Đã tổng hợp, gửi Chánh Văn phòng.', ...p } });
const xacNhan = (username, mcId, hopLe, lyDo) => rpc(username, 'xac_nhan_minh_chung', { p_id: mcId, p_hop_le: hopLe, p_ly_do: lyDo ?? null });
const dong = (username, ma, ngay) => rpc(username, 'dong_nhiem_vu', { p_id: id[ma], p_ngay_hoan_thanh: ngay ?? null });
const view = async (ma) => (await db().from('v_nhiem_vu').select('*').eq('id', id[ma]).single()).data;
const docMc = async (username, ma) => (await userClient(username)).from('minh_chung').select('id, loai, so_hieu, hop_le, nop_boi').eq('nhiem_vu_id', id[ma]);
const lichSu = async (ma, cot) => (await db().from('lich_su').select('nguoi_sua, gia_tri_moi').eq('nhiem_vu_id', id[ma]).eq('cot', cot)).data;
const tinCua = async (ma) => (await db().from('direct_messages').select('receiver_id, content').eq('nhiem_vu_id', id[ma]).eq('loai', 'he_thong')).data;
const assertLoi = (r, re, label) => assert.match(r.error?.message || '', re, `${label}: ${r.error?.message || 'không có lỗi'}`);
const don = async () => { await db().from('nhiem_vu').delete().like('ma', 'NV-T6%'); };

describe('0028 — minh chứng có cấu trúc, xác nhận, đóng nhiệm vụ', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();   // văn bản mẫu ban hành 01/08/2026, chưa có ngày nhận
    await don();
    await them({ ma: 'NV-T60', owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2 });         // Owner cv2 (QUAN_TRI), theo dõi cv1 (TONG_HOP)
    await them({ ma: 'NV-T61', owner_don_vi_ma: 'TONG_HOP' });                                   // theo dõi cv1, không minh chứng
    await them({ ma: 'NV-T62', owner_don_vi_ma: 'TONG_HOP', theo_1400: false, ngay_nhan_van_ban: '2026-08-03' }); // việc cũ, chữ cũ
    await them({ ma: 'NV-T63', owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: IDS.cv2 });      // theo dõi cv2 (QUAN_TRI) — ngoài phạm vi khối TH
  });
  after(don);

  test('1. ghi trực tiếp bảng minh_chung bị chặn với người dùng đăng nhập (INSERT/UPDATE/DELETE)', async () => {
    const cv1 = await userClient('demo_cv1');
    assertDenied(await cv1.from('minh_chung').insert({ nhiem_vu_id: id['NV-T60'], loai: 'so_hieu', so_hieu: '1/CV', ngay_van_ban: '2026-08-10', cap_nhan: 'CHANH_VAN_PHONG' }), 'INSERT');
    assertDenied(await cv1.from('minh_chung').update({ hop_le: true }).eq('nhiem_vu_id', id['NV-T60']), 'UPDATE');
    assertDenied(await cv1.from('minh_chung').delete().eq('nhiem_vu_id', id['NV-T60']), 'DELETE');
  });

  test('2. nop_minh_chung: người ngoài chặn; thiếu một trong ba trường, cấp sai, ngày ngoài khoảng bị chặn; Owner nộp được → dòng + lịch sử + tin', async () => {
    assertDenied(await nop('demo_cv2', 'NV-T61'), 'A3 không phải Owner/theo dõi');
    assertDenied(await nop('demo_truongphong', 'NV-T61'), 'A2 không phải Owner/theo dõi');
    assertDenied(await nop('demo_cvp', 'NV-T61'), 'Chánh VP không phải Owner/theo dõi');
    for (const thieu of [{ so_hieu: '' }, { ngay_van_ban: null }, { cap_nhan: '  ' }]) assertLoi(await nop('demo_cv2', 'NV-T60', thieu), /đủ ba trường/, `thiếu ${Object.keys(thieu)}`);
    for (const thieu of [{ trich_yeu: '' }, { mo_ta_ket_qua: '  ' }]) assertLoi(await nop('demo_cv2', 'NV-T60', thieu), /trích yếu văn bản và mô tả kết quả/, `thiếu ${Object.keys(thieu)} (0046)`);
    assertLoi(await nop('demo_cv2', 'NV-T60', { mo_ta_ket_qua: 'x'.repeat(601) }), /tối đa 600/, 'mô tả quá 600 ký tự (0046)');
    assertLoi(await nop('demo_cv2', 'NV-T60', { cap_nhan: 'KHONG_CO' }), /không có trong danh mục/, 'cấp sai');
    assertLoi(await nop('demo_cv2', 'NV-T60', { ngay_van_ban: '2026-07-31' }), /từ ngày ban hành\/ngày nhận \(01\/08\/2026\)/, 'trước ngày ban hành');
    assertLoi(await nop('demo_cv2', 'NV-T60', { ngay_van_ban: '2030-01-01' }), /sau hôm nay/, 'sau hôm nay');
    const r = await nop('demo_cv2', 'NV-T60');
    assertOk(r, 'Owner nộp'); mc.a = r.data;
    const row = (await db().from('minh_chung').select('*').eq('id', mc.a).single()).data;
    assert.deepEqual([row.loai, row.so_hieu, row.ngay_van_ban, row.cap_nhan, row.hop_le, row.nop_boi], ['so_hieu', '12/CV-VPTU', '2026-08-20', 'CHANH_VAN_PHONG', null, IDS.cv2]);
    const ls = await lichSu('NV-T60', 'minh_chung_nop');
    assert.equal(ls.length, 1); assert.equal(ls[0].nguoi_sua, IDS.cv2); assert.match(ls[0].gia_tri_moi, /Nộp minh chứng · NV-T60: số 12\/CV-VPTU · Báo cáo kết quả \(RLS 0028\) \(ngày 20\/08\/2026, Chánh Văn phòng\)/);
    const tin = await tinCua('NV-T60');
    assert.deepEqual(tin.map((t) => t.receiver_id).sort(), [IDS.cvp, IDS.pcvp, IDS.truongphong, IDS.cv1, IDS.pcvp2].sort(), 'người liên quan trừ người nộp');
  });

  test('3. phạm vi đọc minh_chung = kl_pham_vi: theo dõi/Owner/trưởng phòng/PCVP phụ trách thấy; A3 khác, A2 và PCVP ngoài phạm vi không thấy', async () => {
    const r63 = await nop('demo_cv2', 'NV-T63', { so_hieu: '7/BC-QT' }); assertOk(r63, 'cv2 nộp cho NV-T63'); mc.c = r63.data;
    for (const u of ['demo_cv1', 'demo_cv2', 'demo_truongphong', 'demo_pcvp', 'demo_pcvp2', 'demo_cvp']) {
      const r = await docMc(u, 'NV-T60'); assertOk(r, u); assert.equal(r.data.length, 1, `${u} thấy minh chứng NV-T60`);
    }
    for (const u of ['demo_cv1', 'demo_truongphong', 'demo_pcvp']) {
      const r = await docMc(u, 'NV-T63'); assertOk(r, u); assert.equal(r.data.length, 0, `${u} không thấy minh chứng NV-T63`);
    }
    for (const u of ['demo_pcvp2', 'demo_cvp']) { const r = await docMc(u, 'NV-T63'); assertOk(r, u); assert.equal(r.data.length, 1, `${u} thấy NV-T63`); }
    assert.equal((await (await userClient('demo_cv1')).from('v_nhiem_vu').select('so_minh_chung_hop_le').eq('id', id['NV-T63'])).data.length, 0, 'view lọc theo RLS');
  });

  test('4. v_nhiem_vu: so_minh_chung_hop_le đếm theo vị từ hop_le IS DISTINCT FROM false (chưa xác nhận = hợp lệ); minh_chung_moi_nhat', async () => {
    const v = await view('NV-T60');
    assert.equal(v.so_minh_chung_hop_le, 1); assert.equal(v.minh_chung_moi_nhat.so_hieu, '12/CV-VPTU'); assert.equal(v.minh_chung_moi_nhat.cap_nhan_ten, 'Chánh Văn phòng');
    const v61 = await view('NV-T61'); assert.equal(v61.so_minh_chung_hop_le, 0); assert.equal(v61.minh_chung_moi_nhat, null);
  });

  test('5. đóng không minh chứng bị chặn (hàm và cả UPDATE chữ trực tiếp với việc theo_1400); người ngoài bị chặn', async () => {
    assertLoi(await dong('demo_cv1', 'NV-T61'), /ít nhất một minh chứng hợp lệ/, 'dong_nhiem_vu không minh chứng');
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.from('nhiem_vu').update({ tien_do_ma: 'HOAN_THANH', minh_chung: 'CV 99', ngay_hoan_thanh: '2026-08-10' }).eq('id', id['NV-T61']);
    assertLoi(r, /phải có minh chứng \(số hiệu, ngày văn bản và cấp nhận/, 'việc theo_1400 không đóng bằng chữ');
    assertDenied(await dong('demo_cv2', 'NV-T61'), 'A3 ngoài nhiệm vụ');
    assertDenied(await dong('demo_pcvp2', 'NV-T61'), 'PCVP ngoài phạm vi');
  });

  test('6. xac_nhan_minh_chung: người nộp không tự xác nhận; A3/A2 ngoài phạm vi chặn; theo dõi xác nhận hợp lệ; PCVP bác phải có lý do → không còn đếm', async () => {
    const r2 = await nop('demo_cv2', 'NV-T60', { so_hieu: '13/CV-VPTU', ngay_van_ban: '2026-08-25' }); assertOk(r2, 'nộp thứ hai'); mc.b = r2.data;
    assertDenied(await xacNhan('demo_cv2', mc.a, true), 'Owner tài khoản (A3) không có quyền xác nhận');
    const r3 = await nop('demo_cv1', 'NV-T60', { so_hieu: '14/CV-VPTU', ngay_van_ban: '2026-08-18' }); assertOk(r3, 'người theo dõi nộp'); mc.d = r3.data;
    assertLoi(await xacNhan('demo_cv1', mc.d, true), /chính mình nộp/, 'người theo dõi tự xác nhận minh chứng mình nộp');
    assertDenied(await xacNhan('demo_cv1', mc.c, true), 'A3 ngoài nhiệm vụ');
    assertDenied(await xacNhan('demo_truongphong', mc.c, true), 'A2 ngoài phòng');
    assertDenied(await xacNhan('demo_pcvp', mc.c, true), 'PCVP ngoài khối');
    assertOk(await xacNhan('demo_cv1', mc.a, true), 'người theo dõi xác nhận hợp lệ');
    assertLoi(await xacNhan('demo_pcvp2', mc.b, false), /ghi lý do/, 'bác thiếu lý do');
    assertOk(await xacNhan('demo_pcvp2', mc.b, false, 'Sai số hiệu'), 'PCVP phụ trách Owner bác');
    assertOk(await xacNhan('demo_pcvp2', mc.d, false, 'Nộp trùng'), 'bác minh chứng thứ ba');
    const rows = (await db().from('minh_chung').select('id, hop_le, xac_nhan_boi, ly_do_khong_hop_le').eq('nhiem_vu_id', id['NV-T60']).order('nop_luc')).data;
    assert.deepEqual(rows.map((x) => [x.hop_le, x.xac_nhan_boi, x.ly_do_khong_hop_le]), [[true, IDS.cv1, null], [false, IDS.pcvp2, 'Sai số hiệu'], [false, IDS.pcvp2, 'Nộp trùng']]);
    const v = await view('NV-T60'); assert.equal(v.so_minh_chung_hop_le, 1); assert.equal(v.minh_chung_moi_nhat.hop_le, false);
    assert.equal((await lichSu('NV-T60', 'minh_chung_xac_nhan')).length, 3);
    assertOk(await xacNhan('demo_truongphong', mc.a, true), 'A2 cùng phòng người theo dõi được xác nhận');
  });

  test('7. dong_nhiem_vu: ngày mặc định = ngày văn bản minh chứng hợp lệ mới nhất; HOAN_THANH, dong_luc, lead time = 15; đóng lại bị chặn; bác hết → cờ thiếu', async () => {
    assertLoi(await dong('demo_cv1', 'NV-T60', '2026-07-01'), /từ ngày ban hành tới hôm nay/, 'ngày trước ban hành');
    assertOk(await dong('demo_cv1', 'NV-T60'), 'người theo dõi đóng');
    const v = await view('NV-T60');
    assert.deepEqual([v.tien_do_ma, v.ngay_hoan_thanh, v.thieu_minh_chung, v.lead_time_ngay, v.ket_qua, v.so_ngay_tre], ['HOAN_THANH', '2026-08-20', false, 15, 'TRE', 5]);
    assert.ok(v.dong_luc, 'dong_luc');
    assert.match((await lichSu('NV-T60', 'dong_nhiem_vu'))[0].gia_tri_moi, /Đóng nhiệm vụ · NV-T60: hoàn thành ngày 20\/08\/2026/);
    assertLoi(await dong('demo_cv1', 'NV-T60'), /đã đóng/, 'đóng lại');
    assertOk(await xacNhan('demo_pcvp2', mc.a, false, 'Văn bản bị thu hồi'), 'bác minh chứng còn lại sau khi đóng');
    const v2 = await view('NV-T60'); assert.deepEqual([v2.so_minh_chung_hop_le, v2.thieu_minh_chung, v2.tien_do_ma], [0, true, 'HOAN_THANH']);
    assert.equal(v2.cap_nhat_boi, IDS.cv1, 'tính lại cờ không ghi đè người cập nhật cuối (vẫn là người đóng)');
  });

  test('8. chữ cũ (chu_cu, chưa xác nhận) là hợp lệ: đếm được, đóng được việc cũ với ngày văn bản tách được; tách số hiệu/ngày', async () => {
    const ins = await db().from('minh_chung').insert({ nhiem_vu_id: id['NV-T62'], loai: 'chu_cu', noi_dung_chu: 'Công văn 12/CV-VPTU ngày 10/08/2026', so_hieu: '12/CV-VPTU', ngay_van_ban: '2026-08-10' });
    assertOk(ins, 'service_role chuyển chữ cũ');
    const v = await view('NV-T62'); assert.equal(v.so_minh_chung_hop_le, 1); assert.equal(v.minh_chung_moi_nhat.loai, 'chu_cu');
    assertOk(await dong('demo_cv1', 'NV-T62'), 'đóng việc cũ bằng chữ cũ');
    const v2 = await view('NV-T62'); assert.deepEqual([v2.tien_do_ma, v2.ngay_hoan_thanh, v2.thieu_minh_chung, v2.lead_time_ngay], ['HOAN_THANH', '2026-08-10', false, 7]);
    const tach = async (p_chu) => { const r = await db().rpc('minh_chung_tach', { p_chu }); assertOk(r, p_chu); return Array.isArray(r.data) ? r.data[0] : r.data; };
    assert.deepEqual(await tach('Công văn 12/CV-VPTU ngày 10/08/2026'), { so_hieu: '12/CV-VPTU', ngay_van_ban: '2026-08-10' });
    assert.deepEqual(await tach('Số 123-KL/TU'), { so_hieu: '123-KL/TU', ngay_van_ban: null });
    assert.deepEqual(await tach('Đã gửi bằng V-Office ngày 31/02/2026'), { so_hieu: null, ngay_van_ban: null });
  });

  test('9. minh_chung_kiem_ngay: cận dưới = ngày ban hành, không có thì ngày nhận, cả hai NULL chỉ kiểm ≤ hôm nay', async () => {
    const kiem = async (p_ngay, p_ngay_ban_hanh, p_ngay_nhan) => { const r = await db().rpc('minh_chung_kiem_ngay', { p_ngay, p_ngay_ban_hanh, p_ngay_nhan }); assertOk(r, 'kiem'); return r.data; };
    assert.equal(await kiem('2020-01-01', null, null), null, 'cả hai NULL: ngày cũ vẫn nhận');
    assert.match(await kiem('2026-01-01', null, '2026-02-01'), /\(01\/02\/2026\)/, 'không có ngày ban hành → ngày nhận');
    assert.match(await kiem('2026-01-15', '2026-02-01', '2026-01-01'), /\(01\/02\/2026\)/, 'ưu tiên ngày ban hành');
    assert.equal(await kiem('2026-02-01', '2026-02-01', null), null, 'bằng cận dưới');
    assert.match(await kiem('2999-01-01', null, null), /sau hôm nay/, 'cận trên vẫn kiểm');
  });

  test('10. múi giờ: ngày văn bản = kl_hom_nay() (giờ Việt Nam) được nhận ở mọi giờ chạy; hôm nay + 1 bị chặn', async () => {
    const homNay = (await db().rpc('kl_hom_nay')).data;
    const mai = new Date(`${homNay}T00:00:00Z`); mai.setUTCDate(mai.getUTCDate() + 1);
    assertLoi(await nop('demo_cv1', 'NV-T61', { ngay_van_ban: mai.toISOString().slice(0, 10) }), /sau hôm nay/, 'hôm nay + 1');
    const r = await nop('demo_cv1', 'NV-T61', { ngay_van_ban: homNay }); assertOk(r, 'ngày văn bản = hôm nay giờ VN');
    assertOk(await dong('demo_cv1', 'NV-T61'), 'đóng với ngày hoàn thành = hôm nay giờ VN');
    assert.equal((await view('NV-T61')).ngay_hoan_thanh, homNay);
  });
});
