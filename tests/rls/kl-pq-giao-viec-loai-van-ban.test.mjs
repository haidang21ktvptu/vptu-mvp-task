// PQ-1 (kiểm thử phân quyền, lưới an toàn trước khi viết lại RLS) — giao_viec với văn bản inline theo ĐỦ 5 loại
// (KL_BTV, TB_THUONG_TRUC, NQ_TW, CONG_VAN, KHAC) cho từng vai được giao (A0, CVP, PCVP, A2, A3 giữ quan_tri_kl giao thay mặt):
// trường bắt buộc theo loại (KL_BTV: số hội nghị + ngành + lĩnh vực; TB_THUONG_TRUC: ngành + lĩnh vực; ba loại còn lại ngành để mở);
// ca âm: A3 thường, "Phó trưởng phòng" (A3 chỉ khác position_title), thư ký Thường trực (cờ), quan_tri_he_thong không quan_tri_kl,
// anon — bị chặn với MỌI loại; A0 giao cho A3 / đơn vị ngoài bị chặn với mọi loại. Khoá dữ liệu: "KL-PQ1" trong noi_dung và so_ket_luan; tự dọn.
// Ma trận: docs kiểm thử giai đoạn 1 — B1/B2/B3 (hàng A0, A1-CVP, A1-PCVP, A2, A3, PTP, TK, QT × 5 cột loại văn bản).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, anonClient, userClient, assertOk, assertDenied, IDS, songSong } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const KHOA = 'KL-PQ1';
const LOAI = ['KL_BTV', 'TB_THUONG_TRUC', 'KL_BCH', 'NQ_BCH', 'NQ_TW', 'CONG_VAN', 'KHAC'];   // 0087: + KL / NQ Ban Chấp hành
const PTP = { username: 'demo_e2e_nv', id: '00000000-0000-4000-8000-000000000012', chuc_danh_goc: 'Chuyên viên' }; // A3 Tổng hợp (seed.sql)
const TK = { username: 'demo_e2e_tk', id: '00000000-0000-4000-8000-000000000018' };                                // A3 Tổng hợp, cấp cờ thư ký lúc chạy
let fx;
const loi = (r) => r.error?.message || '';
// Văn bản inline theo loại: KL_BTV có số hội nghị (998 — 999 là fixture), ngày ban hành/ngày nhận trong quá khứ; so_ket_luan duy nhất mỗi lần
// gọi (bảng có UNIQUE (loai, so_ket_luan, ngay_ban_hanh) và (so_hoi_nghi, so_ket_luan)).
let dem = 0;
const vanBan = (loai, vai, them = {}) => ({ loai, so_ket_luan: `${KHOA} ${loai} ${vai} #${++dem}`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02',
  ...(loai === 'KL_BTV' ? { so_hoi_nghi: 998 } : {}), ...them });
// Owner hợp lệ theo vai người giao (kiểm B2), người theo dõi mặc định cùng phòng.
const OWNER = {
  demo_a0: { owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.cvp },
  demo_cvp: { owner_don_vi_ma: 'TONG_HOP' },
  demo_pcvp: { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 },
  demo_truongphong: { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 },
  demo_cv2: { owner_don_vi_ma: 'VAN_PHONG_TINH_UY', nguoi_theo_doi: IDS.cv1, thay_mat_cho: IDS.cvp }, // A3 giữ quan_tri_kl, giao thay mặt CVP (0079: Owner không còn là đơn vị ngoài)
};
const giao = async (username, loai, p = {}) => (await userClient(username)).rpc('giao_viec', { p: {
  van_ban_id: null, van_ban: vanBan(loai, username), noi_dung: `${KHOA} ${loai} ${username}`, san_pham_loai: 'TO_TRINH', han_xu_ly: '2026-12-31',
  nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_ma: 'LV08_TAI_CHINH', ...OWNER[username], ...p } });
// Khôi phục tài khoản dùng chung về giá trị gốc ghi cứng (chạy ở cả đầu before lẫn after để không kẹt trạng thái sai).
const khoiPhucTaiKhoan = async () => {
  await db().from('accounts').update({ position_title: PTP.chuc_danh_goc }).eq('id', PTP.id);
  await db().from('accounts').update({ thu_ky_thuong_truc: false }).eq('id', TK.id);
  await db().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cv2);
};
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
  await khoiPhucTaiKhoan();
};

describe('PQ-1 — giao_viec theo 7 loại văn bản × vai: trường bắt buộc theo loại, vai không được giao bị chặn', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    assertOk(await db().from('accounts').update({ position_title: 'Phó trưởng phòng' }).eq('id', PTP.id), 'giả lập Phó trưởng phòng');
    assertOk(await db().from('accounts').update({ thu_ky_thuong_truc: true }).eq('id', TK.id), 'cấp cờ thư ký');
    assertOk(await db().from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.cv2), 'cấp tạm quan_tri_kl cho cv2');
  });
  after(don);

  const VAI_GIAO = ['demo_a0', 'demo_cvp', 'demo_pcvp', 'demo_truongphong', 'demo_cv2'];
  // Các lần giao độc lập (văn bản inline riêng, so_ket_luan duy nhất) chạy songSong giới hạn 4; đọc lại văn bản/việc bằng MỘT truy vấn in(id) (D3).
  const theoId = async (bang, cot, ids) => new Map((await db().from(bang).select(`id, ${cot}`).in('id', ids)).data.map((x) => [x.id, x]));

  for (const vai of VAI_GIAO) {
    test(`1. ${vai} giao được với đủ 7 loại văn bản inline; văn bản tạo bởi chính người giao, loại đúng, KL_BTV giữ số hội nghị`, async () => {
      const rs = await songSong(LOAI.map((loai) => () => giao(vai, loai)));
      rs.forEach((r, i) => assertOk(r, `${vai} giao ${LOAI[i]}`));
      const vbs = await theoId('van_ban_giao_viec', 'loai, so_hoi_nghi, tao_boi', rs.map((r) => r.data.van_ban_id));
      LOAI.forEach((loai, i) => {
        const v = vbs.get(rs[i].data.van_ban_id);
        assert.equal(v.loai, loai, `${vai} ${loai}: loại văn bản`);
        assert.equal(v.tao_boi, IDS[vai.replace('demo_', '')], `${vai} ${loai}: tao_boi = người giao`);
        assert.equal(v.so_hoi_nghi, loai === 'KL_BTV' ? 998 : null, `${vai} ${loai}: số hội nghị`);
      });
    });
  }

  test('2. KL_BTV: thiếu số hội nghị / thiếu ngành / thiếu lĩnh vực bị chặn với mọi vai được giao; văn bản không bị tạo rác', async () => {
    const soVanBan = async () => (await db().from('van_ban_giao_viec').select('id', { count: 'exact', head: true }).like('so_ket_luan', `${KHOA}%`)).count;
    const truoc = await soVanBan();
    const ca = VAI_GIAO.flatMap((vai) => [
      [/so_hoi_nghi/, `${vai}: KL_BTV thiếu số hội nghị`, async () => (await userClient(vai)).rpc('giao_viec', { p: { van_ban_id: null, van_ban: { ...vanBan('KL_BTV', vai), so_hoi_nghi: null },
        noi_dung: `${KHOA} thiếu số HN`, san_pham_loai: 'TO_TRINH', han_xu_ly: '2026-12-31', nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_ma: 'LV08_TAI_CHINH', ...OWNER[vai] } })],
      [/ngành và lĩnh vực/, `${vai}: KL_BTV thiếu ngành`, () => giao(vai, 'KL_BTV', { nganh_ma: null })],
      [/ngành và lĩnh vực/, `${vai}: KL_BTV thiếu lĩnh vực`, () => giao(vai, 'KL_BTV', { linh_vuc_ma: null })]]);
    (await songSong(ca.map((c) => c[2]))).forEach((r, i) => assert.match(loi(r), ca[i][0], ca[i][1]));
    assert.equal(await soVanBan(), truoc, 'lần giao bị chặn không để lại văn bản (cùng transaction)');
  });

  test('3. TB_THUONG_TRUC: bắt buộc ngành + lĩnh vực (không cần số hội nghị) với mọi vai được giao', async () => {
    const ca = VAI_GIAO.flatMap((vai) => [[`${vai}: TB thiếu ngành`, { nganh_ma: null }], [`${vai}: TB thiếu lĩnh vực`, { linh_vuc_ma: null }],
      [`${vai}: TB thiếu cả hai`, { nganh_ma: null, linh_vuc_ma: null }]].map(([nhan, p]) => [nhan, () => giao(vai, 'TB_THUONG_TRUC', p)]));
    (await songSong(ca.map((c) => c[1]))).forEach((r, i) => assert.match(loi(r), /ngành và lĩnh vực/, ca[i][0]));
  });

  test('4. KL_BCH / NQ_BCH / NQ_TW / CONG_VAN / KHAC: không đòi ngành, lĩnh vực, số hội nghị — mọi vai được giao giao được khi bỏ trống cả ba', async () => {
    const ca = VAI_GIAO.flatMap((vai) => ['KL_BCH', 'NQ_BCH', 'NQ_TW', 'CONG_VAN', 'KHAC'].map((loai) => [`${vai} ${loai}`, () => giao(vai, loai, { nganh_ma: null, linh_vuc_ma: null })]));
    const rs = await songSong(ca.map((c) => c[1]));
    rs.forEach((r, i) => assertOk(r, `${ca[i][0]} giao không ngành/lĩnh vực`));
    const nv = await theoId('nhiem_vu', 'nganh_ma, linh_vuc_ma', rs.map((r) => r.data.id));
    rs.forEach((r, i) => {
      const n = nv.get(r.data.id);
      assert.deepEqual([n.nganh_ma, n.linh_vuc_ma], [null, null], `${ca[i][0]}: ngành/lĩnh vực để trống`);
    });
  });

  test('5. Vai không giao được cho PHÒNG (0085: chuyên viên chỉ giao thẳng cho chuyên viên): A3 thường, Phó trưởng phòng (A3), thư ký Thường trực (cờ), QTHT không quan_tri_kl — bị chặn 42501 với cả 7 loại', async () => {
    const ca = ['demo_cv1', PTP.username, TK.username, 'demo_qtht'].flatMap((vai) => LOAI.map((loai) => [`${vai} giao ${loai}`,
      () => giao(vai, loai, { owner_don_vi_ma: 'TONG_HOP' })]));
    (await songSong(ca.map((c) => c[1]))).forEach((r, i) => assertDenied(r, ca[i][0]));
    // Không có văn bản nào do các vai này tạo (chặn trước khi ghi).
    const rac = await db().from('van_ban_giao_viec').select('id').in('tao_boi', [IDS.cv1, PTP.id, TK.id, IDS.qtht]).like('so_ket_luan', `${KHOA}%`);
    assert.equal(rac.data.length, 0, 'vai bị chặn không tạo văn bản');
  });

  test('6. anon gọi giao_viec bị chặn với cả 7 loại', async () => {
    const rs = await songSong(LOAI.map((loai) => () => anonClient().rpc('giao_viec', { p: { van_ban_id: null, van_ban: vanBan(loai, 'anon'), noi_dung: `${KHOA} anon`,
      san_pham_loai: 'TO_TRINH', han_xu_ly: '2026-12-31', owner_don_vi_ma: 'TONG_HOP' } })));
    rs.forEach((r, i) => assertDenied(r, `anon giao ${LOAI[i]}`));
  });

  test('7. A0 giao cho A3 / cho đơn vị ngoài bị chặn với cả 7 loại; A2 giao Owner khác phòng bị chặn với cả 7 loại', async () => {
    const ca = LOAI.flatMap((loai) => [
      [`A0 giao ${loai} cho A3`, () => giao('demo_a0', loai, { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 })],
      [`A0 giao ${loai} cho đơn vị ngoài`, () => giao('demo_a0', loai, { owner_don_vi_ma: 'DANG_UY_UBND', owner_tai_khoan: null })],
      [`A2 giao ${loai} khác phòng`, () => giao('demo_truongphong', loai, { owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2 })]]);
    (await songSong(ca.map((c) => c[1]))).forEach((r, i) => assertDenied(r, ca[i][0]));
  });

  test('8. Phó trưởng phòng (A3) không có thêm phạm vi đọc: chỉ thấy việc mình là Owner/theo dõi, không thấy việc của phòng', async () => {
    const me = await userClient(PTP.username);
    const [r, fxr] = await Promise.all([me.from('nhiem_vu').select('id').like('noi_dung', `${KHOA}%`), me.from('nhiem_vu').select('id').eq('van_ban_id', fx.hn)]);
    assertOk(r, 'PTP đọc'); assert.equal(r.data.length, 0, 'không là Owner/theo dõi việc nào của test → 0 dòng');
    assertOk(fxr, 'PTP đọc fixture'); assert.equal(fxr.data.length, 0, 'không thấy việc fixture của phòng Tổng hợp');
  });
});
