// 0110–0111 (v3.25): bộ nhận diện mục tiêu then chốt, gắn có nguồn, tự học từ thao tác, rà soát. Kiểm:
// (1) goi_y_muc_tieu — số hiệu nghị quyết trong trích yếu → tích sẵn (số hiệu của chính văn bản không tính, '57-NQ/TU' không phải '57-NQ/TW');
//     từ khoá khớp cả khi gõ không dấu / chữ hoa; lĩnh vực; loại trừ; số hiệu chưa có trong danh mục → so_hieu_moi đúng nhóm (số hiệu không thuộc
//     nhóm nào như KL/TW bỏ qua, không làm mất số hiệu khác — cả khi nhập Excel tự gắn);
// (2) mặc định của văn bản theo RLS — người thấy văn bản có căn cứ "theo văn bản", chuyên viên phòng khác không;
// (3) gan_muc_tieu có nguồn (GOP không khai được), lời gọi hai tham số cũ vẫn chạy; gan_muc_tieu_van_ban có nguồn;
// (4) ghi_phan_hoi_goi_y — chủ trì không phải tầng giao bị chặn; quy tắc không khớp việc / mức không khớp loại phản hồi không được ghi; ghi lại cùng
//     kết quả không đếm lại; đủ ngưỡng (đặt tạm 2 lần) → tự nâng thành tích sẵn, đếm lại từ 0, nhật ký người "tự động";
// (5) goi_y_muc_tieu_viec theo RLS; gan_muc_tieu_hang_loat (nguồn RA_SOAT, việc lỗi không chặn việc khác); kiem_thu_quy_tac chỉ quản trị;
// (6) goi_y_muc_tieu_ds — cùng thứ tự, nhiều số hiệu trong một câu đều nhận ra; anon bị chặn; quá 500 dòng → 22023; gắn hàng loạt giữ nguồn cũ;
// (7) nhập Excel — dòng không ghi mục tiêu + tu_gan_muc_tieu → gắn mục tích sẵn (nguồn QUY_TAC, lý do), số hiệu chưa có tự thêm vào danh mục;
//     không cờ / không khớp gì → không gắn;
// (8) goi_y_muc_tieu_viec — mục tích sẵn có quy tắc đã bị bỏ (phản hồi BO) ở chính việc đó hạ thành gợi ý (quy tắc thử riêng, không đụng bộ đếm quy tắc thật).
// Khoá dữ liệu "KL-0110" (số hiệu tự thêm 9927-NQ/TW); ngưỡng kl_cau_hinh trả lại giá trị cũ; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, anonClient, userClient, assertOk, homNayVN, IDS } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0110';
const coHam = async () => !(await db().rpc('goi_y_muc_tieu', { p: {} })).error;
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : !(await coHam()) ? 'Chưa có migration 0110 (goi_y_muc_tieu).' : false;
const goi = async (u, ham, thamSo) => (await userClient(u)).rpc(ham, thamSo);
const ma = (r, label) => { assert.ok(r.error, `${label}: phải lỗi`); return r.error.code; };
const cong = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const HOM = homNayVN();
const muc = (kq) => Object.fromEntries((kq.goi_y || []).map((g) => [g.ma, g.muc]));
const lyDo = (kq, m) => (kq.goi_y.find((g) => g.ma === m)?.ly_do || []).map((l) => l.loai);
let nguongCu = null; let dem = 0;
const giao = (p) => goi('demo_cvp', 'giao_viec', { p: { noi_dung: `${KHOA} việc ${++dem}`, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.truongphong,
  san_pham_loai: 'BAO_CAO', han_xu_ly: cong(HOM, 30), ...p } });
const SH_MOI = '9927-NQ/TW';
const don = async () => {
  const lo = (await db().from('lo_nhap').select('id').like('ten_tep', `${KHOA}%`)).data || [];
  if (lo.length) await db().from('lo_nhap').delete().in('id', lo.map((l) => l.id));
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  const moi = ((await db().from('dm_muc_tieu').select('ma').eq('so_hieu', SH_MOI)).data || []).map((x) => x.ma);
  if (moi.length) { await db().from('dm_lich_su').delete().eq('bang', 'dm_muc_tieu').in('ma', moi); await db().from('dm_muc_tieu').delete().in('ma', moi); }
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
  const q = (await db().from('quy_tac_muc_tieu').select('id').like('gia_tri', 'KL0110%')).data || [];
  if (q.length) { await db().from('dm_lich_su').delete().eq('bang', 'quy_tac_muc_tieu').in('ma', q.map((x) => x.id)); await db().from('quy_tac_muc_tieu').delete().in('id', q.map((x) => x.id)); }
  if (nguongCu !== null) await db().from('kl_cau_hinh').update({ gia_tri: nguongCu }).eq('khoa', 'goi_y_so_lan_xet');
};

describe('0110–0111 — gợi ý mục tiêu then chốt, gắn có nguồn, tự học, rà soát', { skip: SKIP }, () => {
  before(don);
  after(don);
  let vbId; let t1; let t2;

  test('1. Số hiệu, từ khoá không dấu, lĩnh vực, loại trừ, số hiệu mới', async () => {
    const r = await goi('demo_cv1', 'goi_y_muc_tieu', { p: { so_hieu_van_ban: '120-KL/TU', linh_vuc: 'LV05_NANG_LUONG',
      trich_yeu: 'Kết luận về thực hiện Nghị quyết số 57-NQ/TW của Bộ Chính trị và Nghị quyết số 9905-NQ/TU của Tỉnh ủy về thử nghiệm KL0110',
      noi_dung: 'Day manh CHUYEN DOI SO trong cac co quan dang' } });
    assertOk(r, 'gợi ý');
    assert.equal(muc(r.data).NQ_57, 'TU_TICH'); assert.deepEqual(lyDo(r.data, 'NQ_57'), ['SO_HIEU']);
    assert.equal(muc(r.data).DP_KHCN_CDS, 'TU_TICH', 'từ khoá khớp không dấu'); assert.equal(muc(r.data).NQ_70, 'TU_TICH', 'lĩnh vực Năng lượng');
    assert.ok(r.data.so_hieu_moi.some((s) => s.so_hieu === '9905-NQ/TU' && s.nhom === 'NQ_TU' && /^về thử nghiệm/.test(s.ve)), 'số hiệu mới');
    assert.ok(r.data.goi_y.every((g) => g.quy_tac.length > 0), 'mỗi gợi ý có quy tắc (ghi phản hồi)');
    const rieng = await goi('demo_cv1', 'goi_y_muc_tieu', { p: { so_hieu_van_ban: '57-NQ/TW', trich_yeu: 'Kế hoạch 57-NQ/TW', noi_dung: 'Triển khai 57-NQ/TU' } });
    assert.equal(muc(rieng.data).NQ_57, undefined, 'số hiệu của chính văn bản và /TU không tính là 57-NQ/TW');
    const tru = await goi('demo_cv1', 'goi_y_muc_tieu', { p: { noi_dung: 'Đào tạo, bồi dưỡng cán bộ là giáo viên trường học' } });
    assert.equal(muc(tru.data).NQ_71, undefined, 'loại trừ');
    const co = await goi('demo_cv1', 'goi_y_muc_tieu', { p: { noi_dung: 'Nâng cao chất lượng giáo viên trường học' } });
    assert.equal(muc(co.data).NQ_71, 'GOI_Y');
    const kl = await goi('demo_cv1', 'goi_y_muc_tieu', { p: { noi_dung: 'Thực hiện Kết luận số 21-KL/TW và Nghị quyết số 9906-NQ/TU về thử nghiệm KL0110' } });
    assert.deepEqual(kl.data.so_hieu_moi.map((s) => s.so_hieu), ['9906-NQ/TU'], 'số hiệu không thuộc nhóm nào (KL/TW) không làm mất số hiệu mới');
  });

  test('2. Mặc định của văn bản theo RLS; gan_muc_tieu_van_ban có nguồn', async () => {
    const g = await giao({ van_ban: { loai: 'CONG_VAN', so_ket_luan: `${KHOA}/1`, ngay_ban_hanh: cong(HOM, -5), ngay_nhan: cong(HOM, -5) } });
    assertOk(g, 'giao'); t1 = g.data.id; vbId = g.data.van_ban_id;
    const v = await goi('demo_cvp', 'gan_muc_tieu_van_ban', { p_van_ban: vbId, p_ma: ['CTR_DU_LICH'], p_nguon: { CTR_DU_LICH: { nguon: 'QUY_TAC', ly_do: 'từ khoá du lịch' } } });
    assertOk(v, 'gắn văn bản');
    const row = await db().from('van_ban_muc_tieu').select('nguon, ly_do').eq('van_ban_id', vbId).single();
    assert.deepEqual(row.data, { nguon: 'QUY_TAC', ly_do: 'từ khoá du lịch' });
    const thay = await goi('demo_cv1', 'goi_y_muc_tieu', { p: { van_ban_id: vbId } });
    assert.deepEqual(lyDo(thay.data, 'CTR_DU_LICH'), ['VAN_BAN']); assert.equal(muc(thay.data).CTR_DU_LICH, 'TU_TICH');
    const khac = await goi('demo_cv2', 'goi_y_muc_tieu', { p: { van_ban_id: vbId } });
    assert.equal(muc(khac.data).CTR_DU_LICH, undefined, 'chuyên viên phòng khác không đọc mặc định của văn bản');
  });

  test('3. gan_muc_tieu có nguồn; GOP không khai được; lời gọi hai tham số cũ vẫn chạy', async () => {
    assertOk(await goi('demo_cvp', 'gan_muc_tieu', { p_id: t1, p_ma: ['DP_KHCN_CDS', 'NQ_57'],
      p_nguon: { DP_KHCN_CDS: { nguon: 'QUY_TAC', ly_do: 'lĩnh vực Chuyển đổi số' }, NQ_57: { nguon: 'GOP' } } }), 'gắn có nguồn');
    const m = await db().from('nhiem_vu_muc_tieu').select('muc_tieu_ma, nguon, ly_do').eq('nhiem_vu_id', t1).order('muc_tieu_ma');
    assert.deepEqual(m.data, [{ muc_tieu_ma: 'DP_KHCN_CDS', nguon: 'QUY_TAC', ly_do: 'lĩnh vực Chuyển đổi số' }, { muc_tieu_ma: 'NQ_57', nguon: 'CHON', ly_do: null }]);
    assertOk(await goi('demo_cvp', 'gan_muc_tieu', { p_id: t1, p_ma: ['DP_KHCN_CDS', 'NQ_57'], p_nguon: { NQ_57: { nguon: 'AI', ly_do: 'trích dẫn' } } }), 'đổi nguồn');
    assert.equal((await db().from('nhiem_vu_muc_tieu').select('nguon').eq('nhiem_vu_id', t1).eq('muc_tieu_ma', 'NQ_57').single()).data.nguon, 'AI');
    assertOk(await goi('demo_cvp', 'gan_muc_tieu', { p_id: t1, p_ma: ['DP_KHCN_CDS'] }), 'hai tham số');
    assert.equal(ma(await goi('demo_cv1', 'gan_muc_tieu', { p_id: t1, p_ma: ['NQ_80'] }), 'chủ trì không gắn'), '42501');
  });

  test('4. ghi_phan_hoi_goi_y: quyền, không đếm lại, tự nâng khi đủ ngưỡng', async () => {
    nguongCu = (await db().from('kl_cau_hinh').select('gia_tri').eq('khoa', 'goi_y_so_lan_xet').single()).data.gia_tri;
    assertOk(await db().from('kl_cau_hinh').update({ gia_tri: '2' }).eq('khoa', 'goi_y_so_lan_xet'), 'ngưỡng tạm 2');
    const q = await db().from('quy_tac_muc_tieu').insert({ muc_tieu_ma: 'NQ_80', loai: 'TU_KHOA', gia_tri: 'KL0110 cụm thử', muc: 'GOI_Y', nguon: 'QUAN_TRI' }).select('id').single();
    assertOk(q, 'quy tắc thử'); const qid = q.data.id;
    const g2 = await giao({ van_ban_id: vbId, noi_dung: `${KHOA} việc có KL0110 cụm thử` }); assertOk(g2, 'giao 2'); t2 = g2.data.id;
    const g3 = await giao({ van_ban_id: vbId, noi_dung: `${KHOA} việc khác có KL0110 cụm thử` }); assertOk(g3, 'giao 3'); const t3 = g3.data.id;
    const ds = (kq) => [{ quy_tac: [qid], ket_qua: kq }];
    assert.equal(ma(await goi('demo_cv1', 'ghi_phan_hoi_goi_y', { p_viec: t3, p_ds: ds('THEM') }), 'chủ trì ghi phản hồi'), '42501');
    assert.equal((await goi('demo_cvp', 'ghi_phan_hoi_goi_y', { p_viec: t1, p_ds: ds('THEM') })).data, 0, 'việc không chứa cụm từ — quy tắc không khớp, không ghi');
    assert.equal((await goi('demo_cvp', 'ghi_phan_hoi_goi_y', { p_viec: t3, p_ds: ds('GIU') })).data, 0, 'GIU cho quy tắc mức gợi ý — không ghi');
    assert.equal((await goi('demo_cvp', 'ghi_phan_hoi_goi_y', { p_viec: t3, p_ds: ds('BO_QUA') })).data, 1, 'lần 1');
    assert.equal((await goi('demo_cvp', 'ghi_phan_hoi_goi_y', { p_viec: t3, p_ds: ds('BO_QUA') })).data, 0, 'lặp — không đếm');
    let r = (await db().from('quy_tac_muc_tieu').select('so_lan_hien, so_lan_nhan, muc').eq('id', qid).single()).data;
    assert.deepEqual(r, { so_lan_hien: 1, so_lan_nhan: 0, muc: 'GOI_Y' });
    assertOk(await goi('demo_cvp', 'ghi_phan_hoi_goi_y', { p_viec: t3, p_ds: ds('THEM') }), 'đổi kết quả việc 3');
    assertOk(await goi('demo_cvp', 'ghi_phan_hoi_goi_y', { p_viec: t2, p_ds: ds('THEM') }), 'việc 2');
    r = (await db().from('quy_tac_muc_tieu').select('so_lan_hien, so_lan_nhan, muc, ghi_chu').eq('id', qid).single()).data;
    assert.equal(r.muc, 'TU_TICH', 'tự nâng khi 2/2 được nhận'); assert.equal(r.so_lan_hien, 0); assert.match(r.ghi_chu, /Tự nâng/);
    const ls = await db().from('dm_lich_su').select('nguoi, nguoi_ghi_chu, hanh_dong').eq('bang', 'quy_tac_muc_tieu').eq('ma', qid);
    assert.deepEqual(ls.data, [{ nguoi: null, nguoi_ghi_chu: 'tự động', hanh_dong: 'doi_muc' }]);
  });

  test('5. goi_y_muc_tieu_viec theo RLS; gắn hàng loạt nguồn RA_SOAT; kiem_thu_quy_tac chỉ quản trị', async () => {
    const thay = await goi('demo_cv1', 'goi_y_muc_tieu_viec', { p_ids: [t2] });
    assertOk(thay, 'cv1'); assert.ok(thay.data[t2], 'thấy việc của mình');
    const khac = await goi('demo_cv2', 'goi_y_muc_tieu_viec', { p_ids: [t2] });
    assert.deepEqual(khac.data, {}, 'phòng khác không thấy');
    const hl = await goi('demo_cvp', 'gan_muc_tieu_hang_loat', { p: [{ id: t2, ma: ['NQ_80'] }, { id: t2, ma: ['KHONG_CO_MA'] }, { id: 'khong-phai-uuid', ma: ['NQ_80'] }] });
    assertOk(hl, 'hàng loạt'); assert.equal(hl.data.ok, 1); assert.equal(hl.data.loi.length, 2);
    assert.equal((await db().from('nhiem_vu_muc_tieu').select('nguon').eq('nhiem_vu_id', t2).single()).data.nguon, 'RA_SOAT');
    const id = (await db().from('quy_tac_muc_tieu').select('id').eq('muc_tieu_ma', 'NQ_57').eq('loai', 'SO_HIEU').single()).data.id;
    const kt = await goi('demo_qtht', 'kiem_thu_quy_tac', { p_id: id }); assertOk(kt, 'quản trị thử');
    assert.ok(Number.isInteger(kt.data.tong) && Number.isInteger(kt.data.khop));
    assert.equal(ma(await goi('demo_cvp', 'kiem_thu_quy_tac', { p_id: id }), 'Chánh VP thử'), '42501');
  });

  test('6. goi_y_muc_tieu_ds: cùng thứ tự, nhiều số hiệu một câu; anon bị chặn; quá 500 dòng; hàng loạt giữ nguồn cũ', async () => {
    const r = await goi('demo_cv1', 'goi_y_muc_tieu_ds', { p: [{ noi_dung: 'Thực hiện Nghị quyết 57-NQ/TW và Nghị quyết 59-NQ/TW' }, 'không phải đối tượng', { noi_dung: 'Đẩy mạnh chuyển đổi số' }] });
    assertOk(r, 'nhiều dòng'); assert.equal(r.data.length, 3);
    assert.equal(muc(r.data[0]).NQ_57, 'TU_TICH'); assert.equal(muc(r.data[0]).NQ_59, 'TU_TICH', 'số hiệu thứ hai trong cùng câu');
    assert.deepEqual(r.data[1].goi_y, []); assert.equal(muc(r.data[2]).DP_KHCN_CDS, 'TU_TICH');
    assert.ok((await anonClient().rpc('goi_y_muc_tieu_ds', { p: [{}] })).error, 'anon');
    assert.equal(ma(await goi('demo_cv1', 'goi_y_muc_tieu_ds', { p: Array.from({ length: 501 }, () => ({})) }), 'quá 500'), '22023');
    assertOk(await goi('demo_cvp', 'gan_muc_tieu', { p_id: t2, p_ma: ['NQ_80'], p_nguon: { NQ_80: { nguon: 'AI', ly_do: 'trích' } } }), 'gắn nguồn AI');
    assertOk(await goi('demo_cvp', 'gan_muc_tieu_hang_loat', { p: [{ id: t2, ma: ['NQ_80', 'NQ_59'] }] }), 'rà soát thêm một mục');
    const m = await db().from('nhiem_vu_muc_tieu').select('muc_tieu_ma, nguon').eq('nhiem_vu_id', t2).order('muc_tieu_ma');
    assert.deepEqual(m.data, [{ muc_tieu_ma: 'NQ_59', nguon: 'RA_SOAT' }, { muc_tieu_ma: 'NQ_80', nguon: 'AI' }], 'mục mới RA_SOAT, mục đã gắn giữ nguồn cũ');
  });

  test('7. Nhập Excel: dòng không ghi mục tiêu + tự gắn → mục tích sẵn, nguồn QUY_TAC; số hiệu mới tự thêm; không cờ / không khớp → không gắn', async () => {
    const tao = await goi('demo_cvp', 'nhap_excel_lo_tao', { p: { ten_tep: `${KHOA}-tu-gan.xlsx`, mau: 'TU_GHEP', che_do_xong: 'DA_XONG_NGOAI', so_dong: 4 } });
    assertOk(tao, 'mở lô');
    const dong = (so, noiDung, them) => ({ so_dong: so, loai_van_ban: 'CONG_VAN', so_ket_luan: `${KHOA}/EXCEL`, ngay_ban_hanh: cong(HOM, -5), noi_dung: `${KHOA} ${noiDung}`,
      owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.truongphong, san_pham_loai: 'BAO_CAO', han_xu_ly: cong(HOM, 40),
      nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', loai_thoi_han_ma: 'CO_HAN_CU_THE', tien_do_ma: 'DANG_THUC_HIEN', du_lieu_goc: {}, ...them });
    const r = await goi('demo_cvp', 'nhap_excel_dong', { p_lo: tao.data.id, p_dong: [
      dong(2, `đẩy mạnh chuyển đổi số, thực hiện Nghị quyết số 57-NQ/TW và Nghị quyết số ${SH_MOI} về thử nghiệm`, { tu_gan_muc_tieu: true }),
      dong(3, 'đẩy mạnh chuyển đổi số (không bật tự gắn)', {}), dong(4, 'việc không khớp quy tắc nào', { tu_gan_muc_tieu: true }),
      dong(5, 'tiếp tục thực hiện Kết luận số 21-KL/TW về chuyển đổi số', { tu_gan_muc_tieu: true })] });
    assertOk(r, 'nhập 4 dòng (số hiệu KL/TW không thuộc nhóm nào không làm hỏng lô)'); assert.deepEqual(r.data.map((x) => x.ket_qua), ['GIAO', 'GIAO', 'GIAO', 'GIAO']);
    const moi = (await db().from('dm_muc_tieu').select('ma, nhom, nguon_them').eq('so_hieu', SH_MOI).single()).data;
    assert.deepEqual([moi.nhom, moi.nguon_them], ['NQ_TW', 'TU_DONG'], 'số hiệu chưa có tự thêm vào danh mục');
    const m = await db().from('nhiem_vu_muc_tieu').select('muc_tieu_ma, nguon, ly_do').eq('nhiem_vu_id', r.data[0].nhiem_vu_id).order('muc_tieu_ma');
    assert.deepEqual(m.data.map((x) => x.muc_tieu_ma).sort(), ['DP_KHCN_CDS', 'NQ_57', moi.ma].sort());
    assert.ok(m.data.every((x) => x.nguon === 'QUY_TAC' && x.ly_do), 'nguồn tích sẵn, có lý do');
    assert.equal(m.data.find((x) => x.muc_tieu_ma === 'NQ_57').ly_do, 'số hiệu 57-NQ/TW trong nội dung');
    const ls = (await db().from('lich_su').select('gia_tri_moi, nguon').eq('nhiem_vu_id', r.data[0].nhiem_vu_id).eq('cot', 'gan_muc_tieu')).data;
    assert.equal(ls.length, 1); assert.equal(ls[0].nguon, 'excel'); assert.match(ls[0].gia_tri_moi, /^Gắn mục tiêu then chốt \(nhập Excel, tự nhận diện\): /);
    for (const x of r.data.slice(1, 3)) assert.equal((await db().from('nhiem_vu_muc_tieu').select('muc_tieu_ma').eq('nhiem_vu_id', x.nhiem_vu_id)).data.length, 0, `dòng ${x.so_dong} không gắn`);
    const m5 = (await db().from('nhiem_vu_muc_tieu').select('muc_tieu_ma').eq('nhiem_vu_id', r.data[3].nhiem_vu_id)).data.map((x) => x.muc_tieu_ma);
    assert.deepEqual(m5, ['DP_KHCN_CDS'], 'dòng có KL/TW vẫn tự gắn theo từ khoá');
  });

  test('8. Việc đã có: quy tắc tích sẵn đã bị bỏ ở việc → hạ thành gợi ý', async () => {
    const q = await db().from('quy_tac_muc_tieu').insert({ muc_tieu_ma: 'NQ_80', loai: 'TU_KHOA', gia_tri: 'KL0110 cụm tích sẵn', muc: 'TU_TICH', nguon: 'QUAN_TRI' }).select('id').single();
    assertOk(q, 'quy tắc thử');
    const g = await giao({ van_ban_id: vbId, noi_dung: `${KHOA} việc có KL0110 cụm tích sẵn` }); assertOk(g, 'giao');
    const truoc = await goi('demo_cvp', 'goi_y_muc_tieu_viec', { p_ids: [g.data.id] });
    assert.equal(muc(truoc.data[g.data.id]).NQ_80, 'TU_TICH');
    assertOk(await goi('demo_cvp', 'ghi_phan_hoi_goi_y', { p_viec: g.data.id, p_ds: [{ quy_tac: [q.data.id], ket_qua: 'BO' }] }), 'bỏ tích sẵn');
    const sau = await goi('demo_cvp', 'goi_y_muc_tieu_viec', { p_ids: [g.data.id] });
    assert.equal(muc(sau.data[g.data.id]).NQ_80, 'GOI_Y', 'không tích lại điều người giao đã bỏ');
    const moi = await goi('demo_cvp', 'goi_y_muc_tieu', { p: { noi_dung: 'KL0110 cụm tích sẵn' } });
    assert.equal(muc(moi.data).NQ_80, 'TU_TICH', 'việc mới vẫn tích sẵn');
  });
});
