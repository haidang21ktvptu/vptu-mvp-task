// 0124 (v3.29, chủ dự án quyết 22/10/2026 — CAU-HOI O-5; CLAUDE.md quy tắc 7, ngoại lệ thứ tư): thư ký Thường trực (cờ thu_ky_thuong_truc) xem MỌI
// nhiệm vụ (v_nhiem_vu.trong_pham_vi = false ở việc ngoài phạm vi cũ; số liệu "Cần xử lý" theo phạm vi cũ) và làm với mọi việc chưa hoàn thành:
// cập nhật tiến độ / kết quả (chốt cột như chủ trì), nộp minh chứng + tải tệp, ghi vướng mắc, sửa thông tin giao, đổi chủ trì / người theo dõi
// (doi_chu_tri — cả tài khoản toàn quyền, kể cả việc đã hoàn thành). Vẫn không: chỉ đạo, trả lại minh chứng, tự đóng việc (ghi thẳng Hoàn thành),
// sửa việc đã hoàn thành. Chuẩn đối chiếu kl_tham_chieu_pham_vi: thư ký = mọi việc. Thư ký = demo_e2e_tk (A3 Tổng hợp); việc thử của cv2 (Quản trị). Khoá "KL-0124"; cờ khôi phục; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS, homNayVN } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0124';
const TK = '00000000-0000-4000-8000-000000000018';   // demo_e2e_tk
const TQ = '00000000-0000-4000-8000-000000000020';   // demo_e2e_tq
const coHam = async () => (await db().rpc('doi_chu_tri', { p_id: TK, p: {}, p_ly_do: 'x' })).error?.code !== 'PGRST202';
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : !(await coHam()) ? 'Chưa có migration 0124.' : false;
const cong = (n) => { const d = new Date(`${homNayVN()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
let vbId; const v = {};
const viec = async (k, them = {}) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: vbId, noi_dung: `${KHOA} ${k}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: cong(60), nganh_ma: 'KINH_TE_TONG_HOP',
    linh_vuc_ma: 'LV08_TAI_CHINH', theo_1400: true, owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, nguoi_theo_doi: IDS.cv2, tao_boi: IDS.pcvp2,
    san_pham_loai: 'BAO_CAO', cap_nhan_san_pham: 'TRUONG_PHONG', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', ...them }).select('id, ma').single();
  assertOk(r, `việc ${k}`); v[k] = r.data;
};
const goi = async (u, ham, p) => (await userClient(u)).rpc(ham, p);
const doc = async (k, cot) => (await db().from('nhiem_vu').select(cot).eq('id', v[k].id).single()).data;
const tin = async (k, mau) => ((await db().from('direct_messages').select('receiver_id').eq('nhiem_vu_id', v[k].id).like('content', mau)).data || []).map((x) => x.receiver_id);
const co = (id, cot, bat) => db().from('accounts').update({ [cot]: bat }).eq('id', id);
const don = async () => {
  await co(TK, 'thu_ky_thuong_truc', false); await co(TQ, 'toan_quyen', false);
  if (Object.keys(v).length) await db().storage.from('minh-chung').remove([`${v.Y?.id}/${KHOA}.pdf`]).catch(() => null);
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
};

describe('0124 — thư ký Thường trực trên mọi nhiệm vụ; đổi chủ trì theo dõi', { skip: SKIP }, () => {
  before(async () => {
    await don();
    const r = await db().from('van_ban_giao_viec').insert({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} vb`, ngay_ban_hanh: cong(-50), ngay_nhan: cong(-49) }).select('id').single();
    assertOk(r, 'văn bản'); vbId = r.data.id;
    await viec('X'); await viec('Y'); await viec('XONG', { tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: cong(-10), nguon: 'excel' });
    await viec('CD', { theo_1400: false });   // việc chuyển đổi: không có trigger bắt minh chứng hợp lệ — chốt "không tự đóng việc" là RLS
  });
  after(don);

  test('1. Đọc: chưa cờ không thấy; có cờ thấy mọi việc (kể cả đã hoàn thành), trong_pham_vi = false; số liệu các mốc (Cần xử lý) giữ phạm vi cũ', async () => {
    const ids = [v.X.id, v.Y.id, v.XONG.id];
    const doc1 = async () => ((await (await userClient('demo_e2e_tk')).from('v_nhiem_vu').select('id, trong_pham_vi').in('id', ids)).data || []);
    const moc = async () => (await goi('demo_e2e_tk', 'kl_so_lieu_cac_moc', { p_ngay: [homNayVN()] })).data?.[0]?.tong;
    assert.deepEqual(await doc1(), []);
    const truoc = await moc();
    assertOk(await co(TK, 'thu_ky_thuong_truc', true), 'cấp cờ');
    const thay = await doc1();
    assert.equal(thay.length, 3); assert.ok(thay.every((x) => x.trong_pham_vi === false), JSON.stringify(thay));
    assert.equal(await moc(), truoc, 'số liệu Cần xử lý không đổi khi bật cờ');
    const ls = await (await userClient('demo_e2e_tk')).from('lich_su').select('id').eq('nhiem_vu_id', v.X.id);
    assert.ok(ls.data.length >= 1, 'đọc được lịch sử');
  });

  test('2. Cập nhật thẳng: ô của người thực hiện được; ô cấp giao, hạn đã chốt, tự đóng việc bị chặn; việc đã hoàn thành 0 dòng', async () => {
    const c = await userClient('demo_e2e_tk');
    const r = await c.from('nhiem_vu').update({ ghi_chu: `${KHOA} thư ký ghi`, van_ban_trien_khai: 'Số 1/KH' }).eq('id', v.X.id).select('id');
    assertOk(r, 'ghi tiến độ'); assert.equal(r.data.length, 1);
    assertDenied(await c.from('nhiem_vu').update({ noi_dung: `${KHOA} đổi` }).eq('id', v.X.id).select('id'), 'sửa thẳng ô cấp giao');
    assertDenied(await c.from('nhiem_vu').update({ han_xu_ly: cong(90) }).eq('id', v.X.id).select('id'), 'sửa thẳng hạn đã chốt');
    const dong = await c.from('nhiem_vu').update({ tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: homNayVN(), minh_chung: `${KHOA} báo cáo` }).eq('id', v.CD.id).select('id');
    assertDenied(dong, 'thư ký tự đóng việc (ghi thẳng Hoàn thành)');
    assert.notEqual((await doc('CD', 'tien_do_ma')).tien_do_ma, 'HOAN_THANH');
    assertOk(await c.from('nhiem_vu').update({ ghi_chu: `${KHOA} thư ký ghi` }).eq('id', v.CD.id).select('id'), 'vẫn ghi tiến độ việc chuyển đổi');
    const xong = await c.from('nhiem_vu').update({ ghi_chu: 'x' }).eq('id', v.XONG.id).select('id');
    assertOk(xong, 'việc đã hoàn thành'); assert.equal(xong.data.length, 0);
  });

  test('3. Vướng mắc, sửa thông tin giao (tin tới chủ trì và người giao); việc đã hoàn thành: không sửa thông tin giao', async () => {
    assertOk(await goi('demo_e2e_tk', 'dat_vuong_mac', { p_id: v.X.id, p_noi_dung: `${KHOA} chờ ý kiến` }), 'vướng mắc');
    assertOk(await goi('demo_e2e_tk', 'sua_thong_tin_giao', { p_id: v.X.id, p_thay_doi: { noi_dung: `${KHOA} X (thư ký sửa)` }, p_ly_do: 'Theo ý kiến Thường trực' }), 'sửa thông tin giao');
    assert.deepEqual(await doc('X', 'noi_dung, vuong_mac'), { noi_dung: `${KHOA} X (thư ký sửa)`, vuong_mac: `${KHOA} chờ ý kiến` });
    const nhan = await tin('X', 'Sửa thông tin giao%');
    assert.ok(nhan.includes(IDS.cv2) && nhan.includes(IDS.pcvp2), JSON.stringify(nhan));
    assertDenied(await goi('demo_e2e_tk', 'sua_thong_tin_giao', { p_id: v.XONG.id, p_thay_doi: { noi_dung: 'x' }, p_ly_do: 'x' }), 'việc đã hoàn thành');
  });

  test('4. Tải tệp minh chứng, nộp minh chứng → việc hoàn thành; tin tới chủ trì', async () => {
    const c = await userClient('demo_e2e_tk');
    const tep = `${v.Y.id}/${KHOA}.pdf`;
    assertOk(await c.storage.from('minh-chung').upload(tep, new Blob(['%PDF-1.4 thu'], { type: 'application/pdf' })), 'tải tệp');
    assertOk(await goi('demo_e2e_tk', 'nop_minh_chung', { p: { nhiem_vu_id: v.Y.id, so_hieu: `12/BC-${KHOA}`, ngay_van_ban: cong(-1), trich_yeu: 'Báo cáo', tep_path: tep } }), 'nộp');
    assert.equal((await doc('Y', 'tien_do_ma')).tien_do_ma, 'HOAN_THANH');
    assert.ok((await tin('Y', 'Nộp minh chứng%')).includes(IDS.cv2), 'chủ trì được báo');
  });

  test('5. Đổi chủ trì: đơn vị, cấp nhận theo chủ trì mới, nhật ký, tin chủ trì cũ / mới / người giao; đổi người theo dõi riêng; các trường hợp bị chặn', async () => {
    const r = await goi('demo_e2e_tk', 'doi_chu_tri', { p_id: v.X.id, p: { chu_tri: IDS.cv1 }, p_ly_do: 'Thường trực giao lại cho Tổng hợp' });
    assertOk(r, 'đổi chủ trì');
    assert.deepEqual(await doc('X', 'owner_tai_khoan, owner_don_vi_ma, cap_nhan_san_pham, nguoi_theo_doi'),
      { owner_tai_khoan: IDS.cv1, owner_don_vi_ma: 'TONG_HOP', cap_nhan_san_pham: 'TRUONG_PHONG', nguoi_theo_doi: IDS.cv2 });
    const ls = (await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', v.X.id).eq('cot', 'doi_chu_tri')).data;
    assert.deepEqual(ls.map((l) => l.gia_tri_moi), ['chủ trì: Demo Chuyên viên Hai → Demo Chuyên viên Một — lý do: Thường trực giao lại cho Tổng hợp']);
    const nhan = await tin('X', 'Đổi chủ trì theo dõi%');
    for (const id of [IDS.cv1, IDS.cv2, IDS.pcvp2]) assert.ok(nhan.includes(id), `tin tới ${id}`);
    assertOk(await goi('demo_e2e_tk', 'doi_chu_tri', { p_id: v.X.id, p: { nguoi_theo_doi: IDS.truongphong }, p_ly_do: 'Trưởng phòng theo dõi' }), 'đổi người theo dõi');
    assert.equal((await doc('X', 'nguoi_theo_doi')).nguoi_theo_doi, IDS.truongphong);
    const r22 = [await goi('demo_e2e_tk', 'doi_chu_tri', { p_id: v.X.id, p: { chu_tri: IDS.cv1 }, p_ly_do: 'x' }),
      await goi('demo_e2e_tk', 'doi_chu_tri', { p_id: v.XONG.id, p: { chu_tri: IDS.cv1 }, p_ly_do: 'x' }),
      await goi('demo_e2e_tk', 'doi_chu_tri', { p_id: v.X.id, p: { chu_tri: IDS.a0 }, p_ly_do: 'x' })];
    r22.forEach((x, i) => { assert.ok(x.error, `ca ${i}`); assert.equal(x.error.code, '22023', x.error.message); });
    for (const u of ['demo_cv1', 'demo_cvp', 'demo_qtht']) assertDenied(await goi(u, 'doi_chu_tri', { p_id: v.X.id, p: { chu_tri: IDS.cv2 }, p_ly_do: 'x' }), `${u} đổi chủ trì`);
    assertOk(await co(TQ, 'toan_quyen', true), 'bật toàn quyền');
    assertOk(await goi('demo_e2e_tq', 'doi_chu_tri', { p_id: v.XONG.id, p: { chu_tri: IDS.cv1, nguoi_theo_doi: IDS.cv1 }, p_ly_do: 'Sửa chủ trì nhập sai' }), 'toàn quyền, việc đã hoàn thành');
    assertOk(await goi('demo_e2e_tq', 'sua_thong_tin_giao', { p_id: v.XONG.id, p_thay_doi: { noi_dung: `${KHOA} XONG (sửa)` }, p_ly_do: 'Sửa chính tả' }), 'toàn quyền sửa thông tin giao việc đã hoàn thành');
    assertOk(await co(TQ, 'toan_quyen', false), 'tắt toàn quyền');
  });

  test('6. Thư ký vẫn không chỉ đạo, không trả lại minh chứng; chuẩn đối chiếu: thư ký = mọi việc', async () => {
    assertDenied(await goi('demo_e2e_tk', 'chi_dao_gui', { p: { nhiem_vu_id: v.X.id, loai: 'DON_DOC', noi_dung: 'x' } }), 'chỉ đạo');
    const mc = (await db().from('minh_chung').select('id').eq('nhiem_vu_id', v.Y.id).single()).data;
    assertDenied(await goi('demo_e2e_tk', 'xac_nhan_minh_chung', { p_id: mc.id, p_hop_le: false, p_ly_do: 'x' }), 'trả lại minh chứng');
    const tc = await db().rpc('kl_tham_chieu_pham_vi', { p_nguoi: TK }); assertOk(tc, 'tham chiếu');
    const tong = (await db().from('nhiem_vu').select('id', { count: 'exact', head: true })).count;
    assert.equal(tc.data.find((x) => x.bang === 'nhiem_vu').ids.length, tong);
  });
});
