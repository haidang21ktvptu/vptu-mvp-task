// GĐ15 (0026, PR 15A) — điều hành ngoại lệ: nguoi_lien_quan (4 kiểu Owner), chi_dao_gui (A3 chặn, A2/PCVP ngoài phạm vi chặn,
// GIA_HAN đổi hạn + so_lan_gia_han + lịch sử, GIAO_LAI trong phạm vi người ra chỉ đạo), chi_dao_phan_hoi (Owner/theo dõi/người
// trong luồng; người ngoài chặn), chi_dao_dong, tin hệ thống (mỗi người một tin, không cho người gửi), v_ngoai_le chỉ Đỏ và
// khớp ô Quá hạn, dat_cap_quyet_dinh, ghi trực tiếp chi_dao/tin hệ thống bị chặn, đã đọc. Mã NV-T9x, tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
let fx; const id = {}; const cd = {};
const them = async (row) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, nguoi_theo_doi: IDS.cv1, noi_dung: `KL-0026 ${row.ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE',
    han_xu_ly: '2026-08-15', nganh_ma: 'KINH_TE_TONG_HOP', ...row }).select('id').single();
  assertOk(r, row.ma); id[row.ma] = r.data.id;
};
const gui = async (username, p) => (await userClient(username)).rpc('chi_dao_gui', { p });
const phanHoi = async (username, p) => (await userClient(username)).rpc('chi_dao_phan_hoi', { p });
const lienQuan = async (ma) => { const r = await db().rpc('nguoi_lien_quan', { p_nhiem_vu: id[ma] }); assertOk(r, `nguoi_lien_quan ${ma}`); return r.data.sort(); };
const tinCua = async (ma) => { const r = await db().from('direct_messages').select('receiver_id, content, is_read').eq('nhiem_vu_id', id[ma]).eq('loai', 'he_thong'); assertOk(r, 'tin'); return r.data; };
const demTheoNguoi = (tin) => tin.reduce((m, t) => ({ ...m, [t.receiver_id]: (m[t.receiver_id] || 0) + 1 }), {});
const nv = async (ma) => (await db().from('nhiem_vu').select('*').eq('id', id[ma]).single()).data;
const lichSu = async (ma, cot) => (await db().from('lich_su').select('cot, gia_tri_cu, gia_tri_moi, nguoi_sua').eq('nhiem_vu_id', id[ma]).eq('cot', cot)).data;
const assertLoi = (r, label) => assert.ok(r.error, `${label}: phải bị chặn`);   // lỗi nghiệp vụ 22023
const don = async () => { await db().from('nhiem_vu').delete().like('ma', 'NV-T9%'); };

describe('0026 — điều hành ngoại lệ: chỉ đạo, phản hồi, tin hệ thống, v_ngoai_le', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    await them({ ma: 'NV-T90', owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2 });   // Owner cv2 (QUAN_TRI), theo dõi cv1 (TONG_HOP)
    await them({ ma: 'NV-T91', owner_don_vi_ma: 'TONG_HOP' });                             // Owner = phòng Tổng hợp, không tài khoản
    await them({ ma: 'NV-T92', owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.pcvp }); // Owner = Văn phòng, tài khoản A1
    await them({ ma: 'NV-T93', owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: IDS.cv2 }); // Owner đơn vị ngoài, theo dõi cv2 (QUAN_TRI)
    await them({ ma: 'NV-T94', owner_don_vi_ma: 'TONG_HOP', loai_thoi_han_ma: 'KY_BAN_HANH', han_xu_ly: null }); // hạn tự tính 11/08
  });
  after(don);

  test('1. nguoi_lien_quan đúng 4 kiểu Owner (tài khoản / phòng / Văn phòng / đơn vị ngoài), mỗi người một lần', async () => {
    assert.deepEqual(await lienQuan('NV-T90'), [IDS.cvp, IDS.pcvp, IDS.truongphong, IDS.cv1, IDS.cv2, IDS.pcvp2].sort(), 'Owner cv2: + trưởng phòng TH, PCVP TH và QT, Chánh VP');
    assert.deepEqual(await lienQuan('NV-T91'), [IDS.cvp, IDS.pcvp, IDS.truongphong, IDS.cv1].sort(), 'Owner phòng TH: PCVP phụ trách TH không lặp');
    assert.deepEqual(await lienQuan('NV-T92'), [IDS.cvp, IDS.pcvp, IDS.truongphong, IDS.cv1].sort(), 'Owner Văn phòng (pcvp): không có trưởng phòng/PCVP của Lãnh đạo VP');
    assert.deepEqual(await lienQuan('NV-T93'), [IDS.cvp, IDS.cv2, IDS.pcvp2].sort(), 'Đơn vị ngoài: chỉ theo người theo dõi (QUAN_TRI không có A2)');
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.rpc('nguoi_lien_quan', { p_nhiem_vu: id['NV-T90'] });
    assertOk(r, 'người theo dõi gọi'); assert.ok(!r.data.includes(IDS.cv1) && r.data.includes(IDS.cv2), 'trừ chính người gọi');
    const r2 = await cv1.rpc('nguoi_lien_quan', { p_nhiem_vu: id['NV-T93'] });
    assertOk(r2, 'ngoài phạm vi'); assert.equal(r2.data.length, 0);
  });

  test('2. chi_dao_gui: A3 bị chặn; A2/PCVP ngoài phạm vi bị chặn; ghi trực tiếp chi_dao bị chặn; Chánh VP đôn đốc → chỉ đạo + lịch sử + tin cho mọi người liên quan trừ người gửi', async () => {
    assertDenied(await gui('demo_cv1', { nhiem_vu_id: id['NV-T90'], loai: 'DON_DOC', noi_dung: 'A3 thử' }), 'A3 ra chỉ đạo');
    assertDenied(await gui('demo_truongphong', { nhiem_vu_id: id['NV-T93'], loai: 'DON_DOC', noi_dung: 'ngoài phòng' }), 'A2 ngoài phạm vi');
    assertDenied(await gui('demo_pcvp2', { nhiem_vu_id: id['NV-T91'], loai: 'DON_DOC', noi_dung: 'ngoài phụ trách' }), 'PCVP ngoài phạm vi');
    const tp = await userClient('demo_truongphong');
    assertDenied(await tp.from('chi_dao').insert({ nhiem_vu_id: id['NV-T90'], nguoi_gui: IDS.truongphong, loai: 'DON_DOC', noi_dung: 'trực tiếp' }).select('id'), 'INSERT trực tiếp');
    assertLoi(await gui('demo_cvp', { nhiem_vu_id: id['NV-T90'], loai: 'DON_DOC', noi_dung: '  ' }), 'thiếu nội dung');
    const r = await gui('demo_cvp', { nhiem_vu_id: id['NV-T90'], loai: 'DON_DOC', noi_dung: 'Khẩn trương hoàn thành trong tuần', han_phan_hoi: '2026-09-20' });
    assertOk(r, 'Chánh VP đôn đốc'); cd.d1 = r.data;
    const c = (await db().from('chi_dao').select('*').eq('id', cd.d1).single()).data;
    assert.equal(c.trang_thai, 'CHO_PHAN_HOI'); assert.equal(c.nguoi_gui, IDS.cvp); assert.equal(c.tra_loi_cho, null);
    const ls = await lichSu('NV-T90', 'chi_dao');
    assert.equal(ls.length, 1); assert.match(ls[0].gia_tri_moi, /^Đôn đốc · NV-T90: Khẩn trương/); assert.equal(ls[0].nguoi_sua, IDS.cvp);
    const tin = await tinCua('NV-T90');
    assert.deepEqual(demTheoNguoi(tin), { [IDS.cv1]: 1, [IDS.cv2]: 1, [IDS.truongphong]: 1, [IDS.pcvp]: 1, [IDS.pcvp2]: 1 }, 'mỗi người một tin, không có Chánh VP');
    assert.ok(tin.every((t) => t.content.startsWith('Đôn đốc · NV-T90: ') && !t.is_read));
    const v = (await (await userClient('demo_cv1')).from('v_nhiem_vu').select('so_chi_dao_cho_phan_hoi').eq('id', id['NV-T90']).single()).data;
    assert.equal(v.so_chi_dao_cho_phan_hoi, 1);
  });

  test('3. GIA_HAN (DL-5): bắt buộc hạn mới sau hạn cũ; đổi han_xu_ly, so_lan_gia_han + 1, hạn cũ trong lịch sử; Ký ban hành chuyển sang Có hạn cụ thể; việc ra khỏi v_ngoai_le', async () => {
    assertLoi(await gui('demo_pcvp', { nhiem_vu_id: id['NV-T90'], loai: 'GIA_HAN', noi_dung: 'thiếu hạn' }), 'không có han_moi');
    assertLoi(await gui('demo_pcvp', { nhiem_vu_id: id['NV-T90'], loai: 'GIA_HAN', noi_dung: 'lùi', han_moi: '2026-08-10' }), 'hạn mới trước hạn cũ');
    const cvp = await userClient('demo_cvp');
    assert.equal((await cvp.from('v_ngoai_le').select('ma').eq('id', id['NV-T90'])).data.length, 1, 'đang Đỏ');
    assertOk(await gui('demo_pcvp', { nhiem_vu_id: id['NV-T90'], loai: 'GIA_HAN', noi_dung: 'Chờ ý kiến Ban Thường vụ', han_moi: '2026-12-31' }), 'PCVP gia hạn');
    const n = await nv('NV-T90');
    assert.equal(n.han_xu_ly, '2026-12-31'); assert.equal(n.so_lan_gia_han, 1);
    const ls = await lichSu('NV-T90', 'han_xu_ly');
    assert.deepEqual(ls.map((l) => [l.gia_tri_cu, l.gia_tri_moi, l.nguoi_sua]), [['2026-08-15', '2026-12-31', IDS.pcvp]], 'hạn cũ giữ trong lịch sử, người sửa = người ra chỉ đạo');
    assert.equal((await cvp.from('v_ngoai_le').select('ma').eq('id', id['NV-T90'])).data.length, 0, 'hết Đỏ');
    assert.match((await tinCua('NV-T90')).find((t) => t.receiver_id === IDS.cv1 && t.content.startsWith('Gia hạn')).content, /hạn mới 31\/12\/2026/);
    assertOk(await gui('demo_cvp', { nhiem_vu_id: id['NV-T94'], loai: 'GIA_HAN', noi_dung: 'Ký ban hành gia hạn', han_moi: '2026-12-31' }), 'gia hạn việc Ký ban hành');
    const n94 = await nv('NV-T94');
    assert.equal(n94.loai_thoi_han_ma, 'CO_HAN_CU_THE'); assert.equal(n94.han_xu_ly, '2026-12-31');
  });

  test('4. chi_dao_phan_hoi: người theo dõi và Owner được; người ngoài luồng (kể cả PCVP thấy việc) bị chặn; gốc → DA_PHAN_HOI; người vừa theo dõi vừa đã phản hồi chỉ nhận MỘT tin cho hành động sau', async () => {
    assertDenied(await phanHoi('demo_pcvp2', { chi_dao_id: cd.d1, noi_dung: 'ngoài luồng' }), 'PCVP thấy việc nhưng không trong luồng');
    assertDenied(await phanHoi('demo_qtht', { chi_dao_id: cd.d1, noi_dung: 'ngoài phạm vi' }), 'người ngoài phạm vi');
    const r = await phanHoi('demo_cv1', { chi_dao_id: cd.d1, noi_dung: 'Đã trình dự thảo, chờ ký' });
    assertOk(r, 'người theo dõi phản hồi'); cd.p1 = r.data;
    const p = (await db().from('chi_dao').select('*').eq('id', cd.p1).single()).data;
    assert.equal(p.loai, 'PHAN_HOI'); assert.equal(p.tra_loi_cho, cd.d1); assert.equal(p.trang_thai, 'DA_DONG');
    const g = (await db().from('chi_dao').select('trang_thai, phan_hoi_boi').eq('id', cd.d1).single()).data;
    assert.equal(g.trang_thai, 'DA_PHAN_HOI'); assert.equal(g.phan_hoi_boi, IDS.cv1);
    assertOk(await phanHoi('demo_cv2', { chi_dao_id: cd.p1, noi_dung: 'Owner bổ sung' }), 'Owner trả lời qua id phản hồi → gắn vào gốc');
    assert.equal((await db().from('chi_dao').select('id').eq('tra_loi_cho', cd.d1)).data.length, 2);
    const truoc = demTheoNguoi(await tinCua('NV-T90'));
    assertOk(await gui('demo_cvp', { nhiem_vu_id: id['NV-T90'], loai: 'KIEM_TRA_SO_LIEU', noi_dung: 'Rà lại số liệu' }), 'Chánh VP (đã trong luồng) ra chỉ đạo tiếp');
    const sau = demTheoNguoi(await tinCua('NV-T90'));
    assert.equal(sau[IDS.cv1] - truoc[IDS.cv1], 1, 'cv1 vừa là người theo dõi vừa đã phản hồi: một tin');
    assert.equal(sau[IDS.cv2] - truoc[IDS.cv2], 1, 'cv2 vừa là Owner vừa đã phản hồi: một tin');
    assert.equal((sau[IDS.cvp] || 0) - (truoc[IDS.cvp] || 0), 0, 'người gửi không nhận tin');
    const soPhanHoi = (await (await userClient('demo_cvp')).from('v_nhiem_vu').select('so_chi_dao_cho_phan_hoi').eq('id', id['NV-T90']).single()).data.so_chi_dao_cho_phan_hoi;
    assert.equal(soPhanHoi, 2, 'gia hạn + kiểm tra số liệu chờ phản hồi; đôn đốc đã phản hồi và các phản hồi không đếm');
  });

  test('5. chi_dao_dong: người khác bị chặn; người ra chỉ đạo đóng; sau đó không phản hồi thêm; Y_KIEN không chờ phản hồi', async () => {
    assertDenied(await (await userClient('demo_cv1')).rpc('chi_dao_dong', { p_id: cd.d1 }), 'người theo dõi đóng');
    assertDenied(await (await userClient('demo_pcvp')).rpc('chi_dao_dong', { p_id: cd.d1 }), 'PCVP không phải người ra chỉ đạo');
    assertOk(await (await userClient('demo_cvp')).rpc('chi_dao_dong', { p_id: cd.d1 }), 'Chánh VP đóng');
    assert.equal((await db().from('chi_dao').select('trang_thai').eq('id', cd.d1).single()).data.trang_thai, 'DA_DONG');
    assertLoi(await phanHoi('demo_cv1', { chi_dao_id: cd.d1, noi_dung: 'muộn' }), 'phản hồi chỉ đạo đã đóng');
    assertLoi(await (await userClient('demo_cvp')).rpc('chi_dao_dong', { p_id: cd.d1 }), 'đóng lần hai');
    const y = await gui('demo_truongphong', { nhiem_vu_id: id['NV-T91'], loai: 'Y_KIEN', noi_dung: 'Lưu ý phối hợp với Ban Tổ chức' });
    assertOk(y, 'A2 ý kiến trong phòng');
    assert.equal((await db().from('chi_dao').select('trang_thai').eq('id', y.data).single()).data.trang_thai, 'DA_DONG');
    // Owner = phòng (owner_tai_khoan NULL): PCVP phụ trách phòng thấy việc nhưng không trong luồng → vẫn bị chặn (lỗi quyền, không phải "đã đóng").
    assertDenied(await phanHoi('demo_pcvp', { chi_dao_id: y.data, noi_dung: 'ngoài luồng' }), 'PCVP ngoài luồng trên việc Owner = phòng');
  });

  test('6. GIAO_LAI: người theo dõi mới phải trong phạm vi người ra chỉ đạo (A2 cùng phòng, PCVP phòng phụ trách); Chánh VP mọi phòng; người cũ nhận tin', async () => {
    assertDenied(await gui('demo_truongphong', { nhiem_vu_id: id['NV-T91'], loai: 'GIAO_LAI', noi_dung: 'sang QT', nguoi_theo_doi_moi: IDS.cv2 }), 'A2 giao sang phòng khác');
    assertDenied(await gui('demo_pcvp', { nhiem_vu_id: id['NV-T91'], loai: 'GIAO_LAI', noi_dung: 'sang QT', nguoi_theo_doi_moi: IDS.cv2 }), 'PCVP giao sang phòng không phụ trách');
    assertLoi(await gui('demo_cvp', { nhiem_vu_id: id['NV-T91'], loai: 'GIAO_LAI', noi_dung: 'trùng', nguoi_theo_doi_moi: IDS.cv1 }), 'giao lại chính người cũ');
    assertOk(await gui('demo_truongphong', { nhiem_vu_id: id['NV-T91'], loai: 'GIAO_LAI', noi_dung: 'Chuyển trưởng phòng theo dõi', nguoi_theo_doi_moi: IDS.truongphong }), 'A2 giao trong phòng');
    assert.equal((await nv('NV-T91')).nguoi_theo_doi, IDS.truongphong);
    assertOk(await gui('demo_cvp', { nhiem_vu_id: id['NV-T91'], loai: 'GIAO_LAI', noi_dung: 'Chuyển phòng Quản trị', nguoi_theo_doi_moi: IDS.cv2 }), 'Chánh VP giao sang phòng khác');
    const n = await nv('NV-T91');
    assert.equal(n.nguoi_theo_doi, IDS.cv2);
    assert.deepEqual((await lichSu('NV-T91', 'nguoi_theo_doi')).map((l) => [l.gia_tri_cu, l.gia_tri_moi]), [[IDS.cv1, IDS.truongphong], [IDS.truongphong, IDS.cv2]]);
    const tin = (await tinCua('NV-T91')).filter((t) => t.content.startsWith('Giao lại · NV-T91: Chuyển phòng'));
    assert.ok(tin.some((t) => t.receiver_id === IDS.truongphong) && tin.some((t) => t.receiver_id === IDS.cv2), 'người theo dõi cũ và mới đều nhận');
    assert.equal(tin.filter((t) => t.receiver_id === IDS.truongphong).length, 1, 'người cũ (cũng là trưởng phòng) một tin');
  });

  test('7. v_ngoai_le: chỉ DO/DO_DAC_BIET, tổng = ô Quá hạn + Đang đính chính, sắp số ngày trễ giảm dần, 4 trường bắt buộc có giá trị thay thế', async () => {
    for (const u of ['demo_cvp', 'demo_pcvp', 'demo_truongphong', 'demo_cv1']) {
      const c = await userClient(u);
      const [nl, tat] = await Promise.all([c.from('v_ngoai_le').select('*'), c.from('v_nhiem_vu').select('id, nhom_dem')]);
      assertOk(nl, u); assertOk(tat, u);
      assert.equal(nl.data.length, tat.data.filter((r) => ['QUA_HAN', 'DANG_DINH_CHINH'].includes(r.nhom_dem)).length, `${u}: tổng khớp ô Quá hạn`);
      assert.ok(nl.data.every((r) => ['DO', 'DO_DAC_BIET'].includes(r.muc_canh_bao) && r.so_ngay_qua > 0 && r.owner_ten && r.san_pham_ten && r.cap_quyet_dinh_ten), `${u}: chỉ Đỏ, đủ 4 trường`);
      assert.ok(nl.data.every((r, i) => i === 0 || nl.data[i - 1].so_ngay_qua >= r.so_ngay_qua), `${u}: giảm dần`);
    }
    const cvp = await userClient('demo_cvp');
    const r = (await cvp.from('v_ngoai_le').select('*').eq('id', id['NV-T93']).single()).data;
    assert.equal(r.san_pham_ten, 'chưa định nghĩa'); assert.equal(r.cap_quyet_dinh_ten, 'chưa xác định'); assert.equal(r.owner_ten, r.owner_don_vi_ten); assert.equal(r.nhom, 'DO');
    assertDenied(await (await userClient('demo_cv2')).rpc('dat_cap_quyet_dinh', { p_id: id['NV-T93'], p_cap: 'CHANH_VAN_PHONG' }), 'A3 (người theo dõi) không đặt cấp quyết định');
    assertLoi(await cvp.rpc('dat_cap_quyet_dinh', { p_id: id['NV-T93'], p_cap: 'KHONG_CO' }), 'cấp ngoài danh mục');
    assertOk(await cvp.rpc('dat_cap_quyet_dinh', { p_id: id['NV-T93'], p_cap: 'CHANH_VAN_PHONG' }), 'Chánh VP điền tại chỗ');
    assert.equal((await cvp.from('v_ngoai_le').select('cap_quyet_dinh_ten').eq('id', id['NV-T93']).single()).data.cap_quyet_dinh_ten, 'Chánh Văn phòng');
    assert.deepEqual((await lichSu('NV-T93', 'cap_quyet_dinh')).map((l) => [l.gia_tri_cu, l.gia_tri_moi, l.nguoi_sua]), [[null, 'CHANH_VAN_PHONG', IDS.cvp]]);
  });

  test('8. tin hệ thống chỉ hàm tạo; chat 1-1 không đánh dấu tin hệ thống; tin_he_thong_da_doc theo nhiệm vụ; chi_dao_da_doc riêng từng người', async () => {
    const cv1 = await userClient('demo_cv1');
    assertDenied(await cv1.from('direct_messages').insert({ sender_id: IDS.cv1, receiver_id: IDS.cv2, content: 'giả hệ thống', loai: 'he_thong' }).select('id'), 'INSERT he_thong');
    assertOk(await cv1.rpc('mark_messages_read', { p_peer_id: IDS.cvp }), 'mở chat với Chánh VP');
    const conChuaDoc = (await tinCua('NV-T90')).filter((t) => t.receiver_id === IDS.cv1 && !t.is_read).length;
    assert.ok(conChuaDoc >= 2, 'tin hệ thống từ Chánh VP không bị chat 1-1 đánh dấu');
    const r = await cv1.rpc('tin_he_thong_da_doc', { p_nhiem_vu: id['NV-T90'] });
    assertOk(r, 'đã đọc theo nhiệm vụ'); assert.equal(r.data, conChuaDoc);
    assert.equal((await tinCua('NV-T90')).filter((t) => t.receiver_id === IDS.cv1 && !t.is_read).length, 0);
    const d = await cv1.rpc('chi_dao_danh_dau_doc', { p_nhiem_vu: id['NV-T90'] });
    assertOk(d, 'đánh dấu đọc luồng'); assert.equal(d.data, 5, '3 chỉ đạo + 2 phản hồi');
    assert.equal((await cv1.rpc('chi_dao_danh_dau_doc', { p_nhiem_vu: id['NV-T90'] })).data, 0, 'gọi lại không ghi thêm');
    assert.equal((await cv1.from('chi_dao_da_doc').select('chi_dao_id')).data.length, 5);
    assert.equal((await (await userClient('demo_cv2')).from('chi_dao_da_doc').select('chi_dao_id')).data.length, 0, 'không thấy dòng đã đọc của người khác');
    assertDenied(await (await userClient('demo_qtht')).rpc('chi_dao_danh_dau_doc', { p_nhiem_vu: id['NV-T90'] }), 'ngoài phạm vi');
  });
});
