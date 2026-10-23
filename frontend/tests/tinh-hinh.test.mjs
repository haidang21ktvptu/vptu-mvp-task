// v3.25 — "Việc tôi theo dõi" (v3.31: "Việc tôi đã giao"; mẫu ViecTheoDoi) và "Theo văn bản" (mẫu TheoVanBan) dạng bảng: cột Tình hình, ô số; tổng hợp văn bản,
// rà soát, ô số văn bản, sắp xếp (lib/kl/tinh-hinh.js, lib/kl/van-ban-bang.js). Chạy `npm test` trong frontend/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tinhHinh, O_SO_TD, locOTd, demOTd } from '../src/lib/kl/tinh-hinh.js';
import * as tinhHinhMod from '../src/lib/kl/tinh-hinh.js';
import { tongHopVanBan, lopVanBan, raSoatVanBan, O_SO_VB, locOVb, demOVb, sapXepVanBan } from '../src/lib/kl/van-ban-bang.js';

const v = (id, o = {}) => ({ id, tien_do_ma: 'DANG_THUC_HIEN', nhom_dem: 'DANG_THUC_HIEN', muc_canh_bao: 'XANH', theo_1400: true, da_xac_nhan_nhan: true,
  so_minh_chung_hop_le: 0, so_chi_dao_cho_phan_hoi: 0, owner_tai_khoan: 'cv', nguoi_theo_doi: 'me', tao_boi: 'tp', ...o });

test('tình hình: thứ tự ưu tiên đỏ → vàng → lục → xám, kèm dòng phụ', () => {
  assert.deepEqual(tinhHinh(v('1', { bi_tu_choi: true, vuong_mac: 'x' })), { lop: 'th-vm', tieu: 'Bị từ chối', chu: 'chờ giao lại' });
  assert.deepEqual(tinhHinh(v('2', { so_chi_dao_cho_phan_hoi: 2, vuong_mac: 'x' })), { lop: 'th-vm', tieu: 'Có chỉ đạo chờ trả lời', chu: '2 chỉ đạo chờ phản hồi' });
  assert.equal(tinhHinh(v('3', { vuong_mac: 'Chờ số liệu của 2 đảng ủy xã' })).chu, 'Chờ số liệu của 2 đảng ủy xã');
  assert.equal(tinhHinh(v('3b', { vuong_mac: 'a'.repeat(200) })).chu.length, 90, 'vướng mắc dài được rút gọn');
  assert.deepEqual(tinhHinh(v('4', { tu_choi_cho: { id: 't' } })), { lop: 'th-canh', tieu: 'Đề nghị từ chối', chu: 'chờ duyệt' });
  assert.deepEqual(tinhHinh(v('5', { da_xac_nhan_nhan: false, created_at: '2026-10-02T03:00:00Z' })), { lop: 'th-canh', tieu: 'Chưa nhận việc', chu: 'giao 2/10' });
  assert.deepEqual(tinhHinh(v('6', { muc_canh_bao: 'DO', san_pham_ten: 'Báo cáo' })), { lop: 'th-canh', tieu: 'Chưa có sản phẩm', chu: 'chưa có báo cáo' });
  assert.equal(tinhHinh(v('7', { so_minh_chung_hop_le: 1 })).lop, 'th-ok');
  assert.deepEqual(tinhHinh(v('8', { nhom_dem: 'CHO_NGHIEM_THU' })), { lop: 'th-ok', tieu: 'Đã nộp minh chứng', chu: 'chờ xác nhận' });
  assert.deepEqual(tinhHinh(v('9', { cap_nhat_luc: '2026-10-14T09:40:00Z' })), { lop: 'th-thuong', tieu: 'Bình thường', chu: 'đã nhận việc, cập nhật 14/10' });
  assert.deepEqual(tinhHinh(v('10', { tien_do_ma: 'HOAN_THANH', nhom_dem: 'HOAN_THANH', ngay_hoan_thanh: '2026-10-14' })), { lop: 'th-ok', tieu: 'Đã nộp minh chứng', chu: 'hoàn thành 14/10' });
  assert.equal(tinhHinh(v('11', { tien_do_ma: 'HOAN_THANH', nhom_dem: 'HOAN_THANH', thieu_minh_chung: true })).lop, 'th-canh');
  assert.equal(tinhHinh(v('12', { theo_1400: false, da_xac_nhan_nhan: false })).tieu, 'Bình thường', 'việc cũ không theo 1400: không đôn đốc nhận việc');
});

test('ô số "Việc tôi đã giao" (mỗi ô = số dòng lọc); v3.31: không còn lọc quan hệ tôi đã giao / tôi theo dõi', () => {
  const ds = [v('a', { da_xac_nhan_nhan: false }), v('b', { vuong_mac: 'x' }), v('c', { muc_canh_bao: 'VANG' }), v('d'), v('e', { tien_do_ma: 'HOAN_THANH', nhom_dem: 'HOAN_THANH' }),
    v('f', { muc_canh_bao: 'DO_DAC_BIET', tao_boi: 'me', nguoi_theo_doi: 'tp' })];
  assert.deepEqual(locOTd(ds, 'don').map((r) => r.id), ['a', 'b', 'c', 'f']);
  const so = demOTd(ds); for (const [k] of O_SO_TD) assert.equal(so[k], locOTd(ds, k).length, `ô ${k}`);
  assert.deepEqual([so.nhan, so.vm, so.sap, so.qua, so.mo, so.xong, so.tat], [1, 1, 1, 1, 5, 1, 6]);
  assert.ok(!('khopQuanHe' in tinhHinhMod) && !('QUAN_HE' in tinhHinhMod), 'bỏ nút quan hệ (chỉ còn chủ trì theo dõi)');
});

test('văn bản: tổng hợp, lớp mức, rà soát, ô số đếm văn bản, sắp xếp mới nhập / ngày nhận', () => {
  const t = tongHopVanBan([v('1', { nhom_dem: 'QUA_HAN', muc_canh_bao: 'DO_DAC_BIET' }), v('2', { nhom_dem: 'QUA_HAN', muc_canh_bao: 'DO' }),
    v('3', { nhom_dem: 'SAP_DEN_HAN' }), v('4', { nhom_dem: 'HOAN_THANH', tien_do_ma: 'HOAN_THANH' })]);
  assert.deepEqual(t, { n: 4, xong: 1, qua: 2, ddb: 1, quaThuong: 1, sap: 1, mo: 3 });
  assert.equal(lopVanBan(t), 'dac-biet');
  assert.equal(lopVanBan({ n: 2, xong: 2, qua: 0, ddb: 0, sap: 0 }), 'luc'); assert.equal(lopVanBan({ n: 0, xong: 0, qua: 0, ddb: 0, sap: 0 }), 'lam');
  assert.deepEqual(raSoatVanBan(2, 2, true), { canhBao: false, chu: '', dong: 'đã nhập 2 / dự kiến 2 · đã rà soát toàn văn' });
  assert.deepEqual(raSoatVanBan(1, 3, false), { canhBao: true, chu: 'chưa nhập đủ, chưa rà soát', dong: 'đã nhập 1 / dự kiến 3 · chưa rà soát toàn văn' });
  assert.equal(raSoatVanBan(3, null, true).dong, 'đã nhập 3 · chưa khai số dự kiến · đã rà soát toàn văn');
  const d = (id, tt, rs, h, vb) => ({ id, t: tongHopVanBan(tt), rs: raSoatVanBan(1, 1, rs), h, vb });
  const ds = [d('A', [v('1', { nhom_dem: 'QUA_HAN', muc_canh_bao: 'DO' })], true, { created_at: '2026-10-01T00:00:00Z', ngay_nhan: '2026-10-05' }, { van_ban_id: 'A', so_ket_luan: '1' }),
    d('B', [v('2', { nhom_dem: 'HOAN_THANH', tien_do_ma: 'HOAN_THANH' })], false, { created_at: '2026-10-03T00:00:00Z', ngay_nhan: '2026-09-01' }, { van_ban_id: 'B', so_ket_luan: '2' }),
    d('C', [v('3', { nhom_dem: 'SAP_DEN_HAN' })], true, null, { van_ban_id: null })];
  const so = demOVb(ds); for (const [k] of O_SO_VB) assert.equal(so[k], locOVb(ds, k).length, `ô ${k}`);
  assert.deepEqual([so.tat, so.qua, so.sap, so.thieu, so.mo, so.xong], [3, 1, 1, 1, 2, 1]);
  assert.deepEqual(sapXepVanBan(ds, 'moi').map((x) => x.id), ['B', 'A', 'C'], 'mới nhập trước; không gắn văn bản cuối');
  assert.deepEqual(sapXepVanBan(ds, 'nhan').map((x) => x.id), ['A', 'B', 'C'], 'ngày nhận mới trước');
});
