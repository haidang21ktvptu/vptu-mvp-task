// Unit test phân loại nhiệm vụ (v3.26 — 0116): mục cố định "Không thuộc" ở ô chọn mục tiêu (lib/kl/goi-y-muc-tieu.js), các hàm trợ giúp mục tiêu
// (lib/kl/muc-tieu.js), khối 2–3 của Tổng quan (lib/kl/tong-quan-lanh-dao.js, tq-bo-loc.js) và đọc / đối chiếu tệp rà soát (lib/kl/ra-soat-tep.js).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { taoBoChon, apGoiY, apAiDien, bat, tat, batMoi, hieuLuc, ketQua, laKhongThuoc, soDaChon, dsHien, LY_DO_AI_KHONG } from '../src/lib/kl/goi-y-muc-tieu.js';
import { KHONG_THUOC, LV_KHONG_THUOC, mucTieuCua, mucTieuThat, khongThuocMucTieu, chuaGanMucTieu, khopMucTieu, nhanLocMucTieu, dsNhom, laTuDong, CHUA_GAN } from '../src/lib/kl/muc-tieu.js';
import { theoKhoi, coGanMucTieu, phanLoaiMucTieu, chatLuongDuLieu, dongCuaKhoi, thieuNganh, chuThieuNganh } from '../src/lib/kl/tong-quan-lanh-dao.js';
import { khoangKy } from '../src/lib/kl/tong-quan.js';
import { tuyChonMucTieu } from '../src/lib/kl/tq-bo-loc.js';
import { docBangRaSoat, khopDong, khopBang, bangRaSoat, thamSo, tomTat, chuan } from '../src/lib/kl/ra-soat-tep.js';

const TT = { goi_y: [{ ma: 'NQ_57', muc: 'TU_TICH', ly_do: [{ loai: 'SO_HIEU', gia_tri: '57-NQ/TW', o: 'noi_dung' }], quy_tac: ['q57'] }], so_hieu_moi: [] };

describe('Ô chọn mục tiêu: "Không thuộc"', () => {
  test('tích "Không thuộc" bỏ mọi mục đang chọn (ghi nhớ đã bỏ), mục của văn bản không áp; kết quả gắn riêng đúng một mã', () => {
    const tt = apGoiY(taoBoChon({ vb: ['DP_HA_TANG'] }), TT);
    assert.deepEqual(hieuLuc(tt).sort(), ['DP_HA_TANG', 'NQ_57']);
    bat(tt, KHONG_THUOC);
    assert.deepEqual(hieuLuc(tt), [KHONG_THUOC]); assert.ok(laKhongThuoc(tt)); assert.ok(tt.bo.has('NQ_57'));
    const k = ketQua(tt);
    assert.deepEqual(k.ma, [KHONG_THUOC]); assert.equal(k.theoVb, false); assert.equal(k.nguon[KHONG_THUOC].nguon, 'CHON');
    apGoiY(tt, TT);
    assert.deepEqual(hieuLuc(tt), [KHONG_THUOC], 'người dùng đã chọn "Không thuộc": gợi ý không tự tích');
    assert.deepEqual(dsHien(tt).goiY.map((g) => g.ma), ['NQ_57'], 'gợi ý vẫn hiện để bấm');
  });
  test('chọn một mục thật thì "Không thuộc" tự bỏ; bỏ hết thì chưa phân loại', () => {
    const tt = taoBoChon(); bat(tt, KHONG_THUOC); bat(tt, 'DP_CAN_BO');
    assert.deepEqual(hieuLuc(tt), ['DP_CAN_BO']); assert.equal(laKhongThuoc(tt), false);
    tat(tt, 'DP_CAN_BO'); assert.deepEqual(hieuLuc(tt), []); assert.equal(soDaChon(tt), 0);
    const t2 = taoBoChon(); bat(t2, KHONG_THUOC); tat(t2, KHONG_THUOC); assert.deepEqual(hieuLuc(t2), []);
  });
  test('văn bản "Không thuộc": thẻ tính theo (lưu = theo văn bản); thẻ có mục riêng thì không kèm "Không thuộc"', () => {
    const tt = taoBoChon({ vb: [KHONG_THUOC] });
    assert.ok(laKhongThuoc(tt)); assert.equal(ketQua(tt).theoVb, true);
    bat(tt, 'CTR_DU_LICH'); assert.deepEqual(hieuLuc(tt), ['CTR_DU_LICH']);
    const k = ketQua(tt); assert.deepEqual(k.ma, ['CTR_DU_LICH']); assert.equal(k.theoVb, false);
    tat(tt, 'CTR_DU_LICH'); assert.ok(laKhongThuoc(tt), 'bỏ mục riêng → lại theo văn bản "Không thuộc"');
  });
  test('quy tắc tích sẵn thay "Không thuộc" của văn bản (căn cứ chắc ở việc)', () => {
    const tt = apGoiY(taoBoChon({ vb: [KHONG_THUOC] }), TT);
    assert.deepEqual(hieuLuc(tt), ['NQ_57']);
  });
  test('việc đã lưu "Không thuộc" (gắn riêng): Rà soát / ngăn chi tiết không tự tích lại', () => {
    const tt = apGoiY(taoBoChon({ rieng: [KHONG_THUOC], nguonRieng: { [KHONG_THUOC]: { nguon: 'RA_SOAT' } } }), TT);
    assert.deepEqual(hieuLuc(tt), [KHONG_THUOC]);
  });
  test('số hiệu mới đang tích: bỏ "Không thuộc"; ketQua không trả cả hai', () => {
    const tt = taoBoChon(); bat(tt, KHONG_THUOC);
    apGoiY(tt, { goi_y: [], so_hieu_moi: [{ so_hieu: '99-NQ/TU', nhom: 'NQ_TU' }] });
    batMoi(tt, '99-NQ/TU', true);
    assert.equal(tt.chon.has(KHONG_THUOC), false);
    const k = ketQua(tt, new Map([['SH:99-NQ/TU', 'NQTU_99']])); assert.deepEqual(k.ma, ['NQTU_99']);
  });
});

describe('Trợ lý AI điền thẻ (apAiDien)', () => {
  test('mục AI đối chiếu được câu trích → tích sẵn nguồn AI; chưa đối chiếu được → chỉ gợi ý', () => {
    const tt = apAiDien(taoBoChon(), [{ ma: 'DP_KHCN_CDS', trich: 'chuyển đổi số', ly_do: 'nội dung về chuyển đổi số', xac_minh: 'dung' },
      { ma: 'NQ_57', trich: 'x', ly_do: 'y', xac_minh: false }]);
    assert.deepEqual(hieuLuc(tt), ['DP_KHCN_CDS']);
    assert.equal(tt.chon.get('DP_KHCN_CDS').nguon, 'AI'); assert.equal(tt.chon.get('DP_KHCN_CDS').tu, 'tich');
    assert.deepEqual(dsHien(tt).goiY.map((g) => g.ma), ['NQ_57']);
  });
  test('AI không đề xuất mục nào, thẻ chưa có gì → "Không thuộc" (AI); quy tắc chắc về sau thay chỗ', () => {
    const tt = apAiDien(taoBoChon(), []);
    assert.ok(laKhongThuoc(tt)); assert.equal(tt.chon.get(KHONG_THUOC).nguon, 'AI'); assert.equal(tt.chon.get(KHONG_THUOC).ly_do, LY_DO_AI_KHONG);
    apGoiY(tt, TT); assert.deepEqual(hieuLuc(tt), ['NQ_57']);
  });
  test('thẻ đã có mục (theo văn bản, tích sẵn) hoặc người dùng đã bỏ "Không thuộc" → không thêm "Không thuộc"', () => {
    assert.deepEqual(hieuLuc(apAiDien(taoBoChon({ vb: ['DP_HA_TANG'] }), [])), ['DP_HA_TANG']);
    assert.deepEqual(hieuLuc(apAiDien(apGoiY(taoBoChon(), TT), [])), ['NQ_57']);
    const t3 = taoBoChon(); bat(t3, KHONG_THUOC); tat(t3, KHONG_THUOC); apAiDien(t3, []);
    assert.deepEqual(hieuLuc(t3), [], 'người dùng đã bỏ "Không thuộc" ở thẻ này');
  });
  test('người dùng đã chọn "Không thuộc": AI không tích chồng; mục người dùng bỏ không tích lại; mã "Không thuộc" của AI bị bỏ qua', () => {
    const tt = taoBoChon(); bat(tt, KHONG_THUOC);
    apAiDien(tt, [{ ma: 'DP_CAN_BO', xac_minh: 'dung' }]); assert.deepEqual(hieuLuc(tt), [KHONG_THUOC]);
    const t2 = taoBoChon(); bat(t2, 'DP_CAN_BO'); tat(t2, 'DP_CAN_BO'); apAiDien(t2, [{ ma: 'DP_CAN_BO', xac_minh: 'dung' }, { ma: KHONG_THUOC, xac_minh: 'dung' }]);
    assert.deepEqual(hieuLuc(t2), []);
  });
});

describe('Mục tiêu của dòng, khối 2–3 Tổng quan', () => {
  const r = (o) => ({ nhom_dem: 'DANG_THUC_HIEN', muc_canh_bao: 'XANH', ngay_nhan_van_ban: '2026-09-10', muc_tieu: [], ...o });
  const ROWS = [r({ id: 1, nganh_ma: 'KTTH', linh_vuc_ma: 'LV8', muc_tieu: ['DP_A'] }), r({ id: 2, nganh_ma: KHONG_THUOC, linh_vuc_ma: LV_KHONG_THUOC, muc_tieu: [KHONG_THUOC] }),
    r({ id: 3, nganh_ma: null, muc_tieu: [] }), r({ id: 4, nganh_ma: 'KTTH', linh_vuc_ma: null, muc_tieu: [KHONG_THUOC], muc_tieu_nguon: { [KHONG_THUOC]: { nguon: 'AI' } } })];
  const KHOI = [{ ma: 'KT', ten: 'Kinh tế', thu_tu: 2 }, { ma: KHONG_THUOC, ten: 'Không thuộc lĩnh vực trọng tâm', thu_tu: 99 }];
  const NGANH = [{ ma: 'KTTH', ten: '8. Kinh tế tổng hợp', thu_tu: 8, khoi_ma: 'KT' }, { ma: KHONG_THUOC, ten: 'Không thuộc ngành, lĩnh vực nào', thu_tu: 99, khoi_ma: KHONG_THUOC }];
  test('mucTieuCua giữ "Không thuộc"; mucTieuThat bỏ; chưa gắn = rỗng hoàn toàn', () => {
    assert.deepEqual(mucTieuCua(ROWS[1]), [KHONG_THUOC]); assert.deepEqual(mucTieuThat(ROWS[1]), []);
    assert.deepEqual(ROWS.map(khongThuocMucTieu), [false, true, false, true]); assert.deepEqual(ROWS.map(chuaGanMucTieu), [false, false, true, false]);
    assert.ok(khopMucTieu(ROWS[1], KHONG_THUOC)); assert.ok(!khopMucTieu(ROWS[1], CHUA_GAN)); assert.ok(khopMucTieu(ROWS[2], CHUA_GAN));
    assert.equal(nhanLocMucTieu(KHONG_THUOC), 'Không thuộc mục tiêu then chốt');
    assert.equal(laTuDong(ROWS[3]), false, '"Không thuộc" do AI đề xuất không tính là gắn mục tiêu nhờ gợi ý');
    const theoVb = (ma) => r({ muc_tieu: [ma], muc_tieu_rieng: [], muc_tieu_vb: [ma], muc_tieu_nguon: { [ma]: { nguon: 'AI', theo: 'vb' } } });
    assert.equal(laTuDong(theoVb(KHONG_THUOC)), false, 'văn bản chỉ "Không thuộc" (AI) — không tính'); assert.equal(laTuDong(theoVb('DP_A')), true);
  });
  test('dsNhom không gồm nhóm "Không thuộc" (không là tab Tổng quan)', () => {
    const ds = dsNhom([{ ma: 'DOT_PHA', ten: 'Đột phá', tab: 'Đột phá', thu_tu: 1 }, { ma: KHONG_THUOC, ten: 'Không thuộc mục tiêu then chốt', tab: 'Không thuộc', thu_tu: 99 }]);
    assert.deepEqual(ds.map((n) => n.ma), ['DOT_PHA']);
  });
  test('khối 2: chỉ mục tiêu thật tính là "đã gắn"; tóm tắt gắn / không thuộc / chưa phân loại', () => {
    assert.equal(coGanMucTieu([ROWS[1], ROWS[2]]), false); assert.equal(coGanMucTieu(ROWS), true);
    assert.deepEqual(phanLoaiMucTieu(ROWS), { gan: 1, khong: 2, chua: 1 });
    const c = chatLuongDuLieu(ROWS);
    assert.deepEqual(c.chuaMucTieu.map((x) => x.id), [3], '"Không thuộc" là đã phân loại');
    assert.deepEqual(c.chuaNganh.map((x) => x.id), [3, 4]);
  });
  test('khối 3: dòng "Không thuộc lĩnh vực trọng tâm" riêng, không nằm trong 5 khối; chưa phân loại riêng; tổng đủ', () => {
    const k = khoangKy('nam', '2026-10-16');
    const t = theoKhoi(ROWS, k, { khoi: KHOI, nganh: NGANH, linhVuc: [] });
    assert.deepEqual(t.khoi.map((x) => x.ma), ['KT']);
    assert.equal(t.khoi[0].tong, 2); assert.equal(t.khongThuoc.tong, 1); assert.equal(t.chuaNganh.tong, 1); assert.equal(t.toan.tong, 4);
    assert.deepEqual(dongCuaKhoi(ROWS, KHONG_THUOC, { nganh: NGANH, linhVuc: [] }).map((x) => x.id), [2]);
    assert.equal(theoKhoi([ROWS[0]], k, { khoi: KHOI, nganh: NGANH }).khongThuoc, null);
  });
  test('kiểm staging 19/10: số "chưa có ngành, lĩnh vực" của khối 3 = Chất lượng dữ liệu; dòng Chưa phân loại = phần chưa có ngành', () => {
    const th = thieuNganh(ROWS); const k = khoangKy('nam', '2026-10-16');
    assert.deepEqual(th, { tong: 2, khongNganh: 1, thieuLv: 1 });
    assert.equal(th.tong, chatLuongDuLieu(ROWS).chuaNganh.length);
    assert.equal(th.khongNganh, theoKhoi(ROWS, k, { khoi: KHOI, nganh: NGANH, linhVuc: [] }).chuaNganh.tong);
    assert.equal(chuThieuNganh(th), '2 nhiệm vụ chưa có ngành, lĩnh vực (1 chưa có ngành, 1 chưa có lĩnh vực)');
    assert.equal(chuThieuNganh(thieuNganh([ROWS[2]])), '1 nhiệm vụ chưa có ngành, lĩnh vực');
    assert.equal(chuThieuNganh(thieuNganh([ROWS[3], ROWS[0]])), '1 nhiệm vụ đã có ngành nhưng chưa có lĩnh vực');
  });
  test('bộ lọc mục tiêu: có "Không thuộc" và "Chưa phân loại"', () => {
    const g = tuyChonMucTieu(ROWS, [{ ma: 'DP_A', nhom: 'DOT_PHA', ten_ngan: 'Đột phá A' }, { ma: KHONG_THUOC, nhom: KHONG_THUOC, ten_ngan: 'Không thuộc mục tiêu then chốt' }],
      [{ ma: 'DOT_PHA', ten: 'Đột phá', tab: 'Đột phá', thu_tu: 1 }]);
    const cuoi = g.at(-1).ds; assert.deepEqual(cuoi.map((x) => [x.ma, x.n]), [[KHONG_THUOC, 2], [CHUA_GAN, 1]]);
  });
});

describe('Tệp rà soát phân loại', () => {
  const DM = {
    nganh: [{ ma: 'KINH_TE_TONG_HOP', ten: '8. Kinh tế tổng hợp - Tài chính - Đầu tư - Ngân sách', thu_tu: 8 }, { ma: 'VAN_PHONG_TINH_UY', ten: '12. Văn phòng Tỉnh ủy', thu_tu: 12 },
      { ma: 'XAY_DUNG_GIAO_THONG', ten: '9. Xây dựng - Giao thông - Dự án giao thông trọng điểm', thu_tu: 9 }, { ma: KHONG_THUOC, ten: 'Không thuộc ngành, lĩnh vực nào', thu_tu: 99 }],
    linhVuc: [{ ma: 'LV08_DAU_TU', nganh_ma: 'KINH_TE_TONG_HOP', ten: 'Đầu tư' }, { ma: 'LV08_NGAN_SACH', nganh_ma: 'KINH_TE_TONG_HOP', ten: 'Ngân sách' },
      { ma: 'LV12_VAN_PHONG_TINH_UY', nganh_ma: 'VAN_PHONG_TINH_UY', ten: 'Văn phòng Tỉnh ủy' }, { ma: 'LV09_XAY_DUNG', nganh_ma: 'XAY_DUNG_GIAO_THONG', ten: 'Xây dựng' },
      { ma: LV_KHONG_THUOC, nganh_ma: KHONG_THUOC, ten: 'Không thuộc lĩnh vực nào' }],
    mucTieu: [{ ma: 'DP_HA_TANG', nhom: 'DOT_PHA', ten: 'Phát triển kết cấu hạ tầng giao thông, đô thị và môi trường', ten_ngan: 'Đột phá hạ tầng giao thông, đô thị, môi trường', dang_dung: true },
      { ma: 'NQ_57', nhom: 'NQ_TW', ten: 'Nghị quyết số 57-NQ/TW', ten_ngan: 'Nghị quyết 57-NQ/TW', so_hieu: '57-NQ/TW', dang_dung: true },
      { ma: KHONG_THUOC, nhom: KHONG_THUOC, ten: 'Không thuộc mục tiêu then chốt nào', ten_ngan: 'Không thuộc mục tiêu then chốt', dang_dung: true }],
    nhomMucTieu: [{ ma: 'DOT_PHA', ten: 'Đột phá', tab: 'Đột phá', thu_tu: 1 }, { ma: 'NQ_TW', ten: 'NQ TW', tab: 'NQ', thu_tu: 3 }],
  };
  test('tìm bảng theo tiêu đề (bỏ sheet ẩn); đọc được cả tệp "Xuất theo mẫu nhập"', () => {
    const b = docBangRaSoat([{ ten: 'Ẩn', an: true, dong: [['Mã nhiệm vụ', 'Ngành']] },
      { ten: 'Nhập liệu', dong: [['Mã nhiệm vụ', 'Loại văn bản', 'Ngành', 'Lĩnh vực', 'Mục tiêu then chốt'], ['nv-1', 'Công văn', '12. Văn phòng Tỉnh ủy', '', ''], [null, null, null, null, null]] }]);
    assert.equal(b.sheet, 'Nhập liệu'); assert.deepEqual(b.dong, [{ so: 2, ma: 'NV-1', nganh: '12. Văn phòng Tỉnh ủy', linhVuc: '', mucTieu: '', lyDo: '' }]);
    assert.throws(() => docBangRaSoat([{ ten: 'X', dong: [['Mã', 'Nội dung']] }]), /Mã nhiệm vụ/);
  });
  test('khớp đúng mã hoặc đúng tên (bỏ dấu, bỏ số thứ tự ngành); chỉ ghi lĩnh vực → ngành theo lĩnh vực; "Không thuộc"', () => {
    const k = khopDong({ so: 2, ma: 'NV-1', nganh: '8. Kinh tế tổng hợp - Tài chính - Đầu tư - Ngân sách', linhVuc: 'dau tu', mucTieu: 'Nghị quyết 57-NQ/TW; DP_HA_TANG', lyDo: 'x' }, DM);
    assert.deepEqual([k.nganh, k.linh_vuc, k.muc_tieu, k.loi], ['KINH_TE_TONG_HOP', 'LV08_DAU_TU', ['NQ_57', 'DP_HA_TANG'], []]);
    assert.equal(khopDong({ so: 3, ma: 'NV-2', nganh: 'VAN_PHONG_TINH_UY', linhVuc: '', mucTieu: '' }, DM).nganh, 'VAN_PHONG_TINH_UY');
    assert.equal(khopDong({ so: 4, ma: 'NV-3', nganh: '', linhVuc: 'Ngân sách', mucTieu: '' }, DM).nganh, 'KINH_TE_TONG_HOP');
    const kt = khopDong({ so: 5, ma: 'NV-4', nganh: 'Không thuộc', linhVuc: 'Không thuộc lĩnh vực nào', mucTieu: 'Không thuộc mục tiêu then chốt' }, DM);
    assert.deepEqual([kt.nganh, kt.linh_vuc, kt.muc_tieu], [KHONG_THUOC, LV_KHONG_THUOC, [KHONG_THUOC]]);
    assert.equal(khopDong({ so: 6, ma: 'NV-5', mucTieu: '57-NQ/TW' }, DM).muc_tieu[0], 'NQ_57', 'số hiệu nghị quyết');
  });
  test('giá trị không khớp, lĩnh vực khác ngành, "Không thuộc" kèm mục khác → lỗi của dòng; không đoán gần đúng', () => {
    assert.match(khopDong({ so: 2, ma: 'NV-1', nganh: 'Kinh tế' }, DM).loi[0], /không có trong danh mục/);
    assert.match(khopDong({ so: 2, ma: 'NV-1', nganh: 'VAN_PHONG_TINH_UY', linhVuc: 'Đầu tư' }, DM).loi[0], /lĩnh vực/);
    assert.match(khopDong({ so: 2, ma: 'NV-1', mucTieu: 'Không thuộc; NQ_57' }, DM).loi.join(' '), /không ghi cùng/);
    assert.match(khopDong({ so: 2, ma: 'NV-1', mucTieu: 'Nghị quyết 99' }, DM).loi[0], /không có trong danh mục/);
  });
  test('mục tiêu đã gộp → mục giữ lại; ưu tiên mục đang dùng; một tên khớp nhiều mục → lỗi của dòng', () => {
    const dm = { ...DM, mucTieu: [...DM.mucTieu, { ma: 'NQ_57_CU', nhom: 'NQ_TW', ten: 'Nghị quyết 57 (cũ)', ten_ngan: 'NQ 57 cũ', so_hieu: '57-NQ/TW', dang_dung: false, gop_vao: 'NQ_57' },
      { ma: 'CT_A', nhom: 'CT', ten: 'Chương trình chung', ten_ngan: 'Chương trình A', dang_dung: true }, { ma: 'CT_B', nhom: 'CT', ten: 'Chương trình chung', ten_ngan: 'Chương trình B', dang_dung: true },
      { ma: 'CT_NGUNG', nhom: 'CT', ten: 'Chương trình ngừng', ten_ngan: 'Chương trình C', dang_dung: false }] };
    const mt = (s) => khopDong({ so: 2, ma: 'NV-1', mucTieu: s }, dm);
    assert.deepEqual(mt('NQ 57 cũ').muc_tieu, ['NQ_57'], 'mục đã gộp → mục giữ lại'); assert.deepEqual(mt('57-NQ/TW').muc_tieu, ['NQ_57'], 'cùng số hiệu sau khi theo gộp');
    assert.match(mt('Chương trình chung').loi[0], /trùng tên nhiều mục/); assert.deepEqual(mt('Chương trình A').muc_tieu, ['CT_A']);
    assert.deepEqual(mt('Chương trình C').muc_tieu, ['CT_NGUNG'], 'chỉ có mục ngừng dùng: gửi máy chủ quyết (việc đang gắn mục đó vẫn giữ được)');
  });
  test('khopBang: mã trùng chỉ lấy dòng đầu; dòng không ghi gì bỏ qua; tham số gửi DB', () => {
    const b = khopBang([{ so: 2, ma: 'NV-1', nganh: 'VAN_PHONG_TINH_UY' }, { so: 3, ma: 'NV-1', nganh: 'KINH_TE_TONG_HOP' }, { so: 4, ma: 'NV-2' }, { so: 5, ma: '', nganh: 'X' }], DM);
    assert.deepEqual(b.gui.map((x) => x.ma), ['NV-1']); assert.equal(b.trung, 1); assert.equal(b.loi.length, 2);
    assert.deepEqual(thamSo(b.gui[0]), { ma: 'NV-1', nganh: 'VAN_PHONG_TINH_UY', linh_vuc: '', muc_tieu: [], ly_do: '' });
  });
  test('bảng xuất: cột cố định, giá trị tên (đọc lại khớp), sheet Danh mục có ô chọn ngành, lĩnh vực', () => {
    const [s, d] = bangRaSoat([{ ma: 'NV-9', noi_dung: 'Việc', so_ket_luan: '1-KL/TU', ngay_ban_hanh: '2026-01-02', nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_ma: 'LV08_DAU_TU',
      muc_tieu: ['NQ_57', 'DP_HA_TANG'], nhom_dem: 'HOAN_THANH' }], DM);
    assert.deepEqual(s.cot.map((c) => c.nhan), ['Mã nhiệm vụ', 'Nội dung nhiệm vụ', 'Văn bản', 'Chủ trì', 'Tiến độ', 'Ngành', 'Lĩnh vực', 'Mục tiêu then chốt', 'Lý do rà soát']);
    assert.equal(s.dong[0][2], '1-KL/TU ngày 02/01/2026');
    assert.equal(s.dong[0][7], 'Đột phá hạ tầng giao thông, đô thị, môi trường; Nghị quyết 57-NQ/TW');
    const k = khopDong({ so: 2, ma: s.dong[0][0], nganh: s.dong[0][5], linhVuc: s.dong[0][6], mucTieu: s.dong[0][7] }, DM);
    assert.deepEqual([k.nganh, k.linh_vuc, k.muc_tieu, k.loi], ['KINH_TE_TONG_HOP', 'LV08_DAU_TU', ['DP_HA_TANG', 'NQ_57'], []]);
    assert.equal(d.ten, 'Danh mục'); assert.ok(d.dong.some((x) => x[2] === 'Không thuộc mục tiêu then chốt'));
    assert.deepEqual(s.kiemTra.map((x) => x.cot), [5, 6]);
    // v3.27: mục tiêu tạm ẩn (coMt = false) — không cột mục tiêu; tệp đọc vào bỏ qua cột mục tiêu (kể cả tệp cũ còn cột)
    const [s2, d2] = bangRaSoat([{ ma: 'NV-9', nganh_ma: 'KINH_TE_TONG_HOP', muc_tieu: ['NQ_57'] }], DM, false);
    assert.ok(!s2.cot.some((c) => c.nhan === 'Mục tiêu then chốt')); assert.equal(s2.dong[0].length, 8); assert.equal(d2.cot.length, 2);
    const b2 = docBangRaSoat([{ ten: 'R', dong: [s.cot.map((c) => c.nhan), s.dong[0]] }], false);
    assert.deepEqual([b2.coCot.mucTieu, b2.dong[0].mucTieu, b2.dong[0].nganh !== ''], [false, '', true]);
  });
  test('tóm tắt kết quả máy chủ; chuẩn hoá chữ', () => {
    const t = tomTat([{ ket_qua: 'DOI', doi: ['nganh_ma', 'muc_tieu'], canh_bao: 'x', da_xong: true }, { ket_qua: 'DOI', doi: ['muc_tieu'] }, { ket_qua: 'GIU' }, { ket_qua: 'LOI' }]);
    assert.deepEqual(t, { doi: 2, giu: 1, loi: 1, canhBao: 1, nganh: 1, mucTieu: 2, daXong: 1 });
    assert.equal(chuan('  Đầu   TƯ '), 'dau tu');
  });
});
