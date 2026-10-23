// Bổ sung dữ liệu chuyển đổi (v3.27 — lib/kl/nhap/bo-sung.js, hàm DB bo_sung_chuyen_doi 0118): kiểm dạng tệp JSON, chia lượt (văn bản đi lượt đầu), gộp
// kết quả các lượt, chữ "ô: cũ → mới". Dữ liệu hư cấu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docDuLieuBoSung, chuanHoaChuTri, chiaLuot, gopKetQua, soGiu, chuDoi, LUOT } from '../src/lib/kl/nhap/bo-sung.js';
import { DM, ACC, TEN_PHONG } from './fixtures-nhap.mjs';

test('dạng tệp: JSON { viec, van_ban }; mỗi việc có mã; tối đa 20 văn bản; tệp rỗng báo lỗi', () => {
  const d = docDuLieuBoSung(JSON.stringify({ viec: [{ ma: 'NV-1', co_quan_trinh: 'DANG_UY_UBND' }], van_ban: [{ so_ket_luan: '06-TB/TU', ngay_ban_hanh: '2025-10-14', loai: 'TB_THUONG_TRUC' }] }));
  assert.deepEqual([d.viec.length, d.van_ban.length], [1, 1]);
  assert.deepEqual(docDuLieuBoSung('{"viec":[{"ma":"NV-2"}]}').van_ban, []);
  assert.throws(() => docDuLieuBoSung('không phải json'), /JSON hợp lệ/);
  assert.throws(() => docDuLieuBoSung('[]'), /dạng/);
  assert.throws(() => docDuLieuBoSung('{"viec":[],"van_ban":[]}'), /chưa có dòng/);
  assert.throws(() => docDuLieuBoSung('{"viec":[{"ma":"NV-1"},{"co_quan_trinh":"X"}]}'), /thứ 2 thiếu mã/);
  assert.throws(() => docDuLieuBoSung(JSON.stringify({ van_ban: Array.from({ length: 21 }, () => ({ so_ket_luan: 'x' })) })), /tối đa 20/);
});

test('chia lượt: mỗi lượt ≤ 50 việc, văn bản (đổi loại) đi cùng lượt đầu; chỉ có văn bản → một lượt', () => {
  const viec = Array.from({ length: 2 * LUOT + 3 }, (_, i) => ({ ma: `NV-${i}` })); const vb = [{ so_ket_luan: '06-TB/TU' }];
  const luot = chiaLuot({ viec, van_ban: vb });
  assert.deepEqual(luot.map((l) => [l.viec.length, l.van_ban.length]), [[50, 1], [50, 0], [3, 0]]);
  assert.deepEqual(chiaLuot({ viec: [], van_ban: vb }), [{ viec: [], van_ban: vb }]);
});

test('gộp kết quả các lượt; số giữ nguyên; chữ ô cũ → mới (tên hiển thị, ô trống, kết quả không có giá trị cũ)', () => {
  const kq = gopKetQua([{ so_viec: 2, so_doi: 1, so_loi: 1, van_ban: [{ ket_qua: 'DOI' }], viec: [{ ma: 'NV-1', ket_qua: 'DOI' }, { ma: 'NV-2', ket_qua: 'LOI' }], da_ghi: true },
    { so_viec: 1, so_doi: 0, so_loi: 0, van_ban: [], viec: [{ ma: 'NV-3', ket_qua: 'GIU' }], da_ghi: true }]);
  assert.deepEqual([kq.so_viec, kq.so_doi, kq.so_loi, kq.van_ban.length, kq.viec.length, kq.da_ghi, soGiu(kq)], [3, 1, 1, 1, 3, true, 1]);
  assert.equal(gopKetQua([{ da_ghi: true }, { da_ghi: false }]).da_ghi, false);
  const ten = (k, v) => ({ DANG_UY_UBND: '6. Đảng ủy Ủy ban nhân dân tỉnh' }[v] || v);
  assert.deepEqual(chuDoi({ cu: { co_quan_trinh: null, han_xu_ly: null }, moi: { co_quan_trinh: 'DANG_UY_UBND', han_xu_ly: '2026-11-20', ket_qua: '[Tự điền] Đã ban hành kế hoạch' } }, ten),
    ['Cơ quan/đơn vị trình: (trống) → 6. Đảng ủy Ủy ban nhân dân tỉnh', 'Hạn xử lý: (trống) → 2026-11-20', 'Kết quả thực hiện / Minh chứng: [Tự điền] Đã ban hành kế hoạch']);
});

test('cột chu_tri: cán bộ → chủ trì; "VPTU" → Văn phòng Tỉnh ủy; tên phòng → phòng (v3.31 — 0128: không gửi người theo dõi, trigger ghi); không rõ / trùng tên → lỗi', () => {
  const ctx = { dm: DM, accounts: ACC, tenPhong: (m) => TEN_PHONG[m] || m };
  const r = chuanHoaChuTri({ viec: [{ ma: 'NV-1', chu_tri: 'Đàm Văn Sơn', ket_qua: 'x' }, { ma: 'NV-2', chu_tri: 'VPTU' }, { ma: 'NV-3', chu_tri: 'Phòng Tổng hợp' }, { ma: 'NV-4' }], van_ban: [] }, ctx);
  assert.deepEqual(r.loi, []);
  assert.deepEqual(r.du.viec, [{ ma: 'NV-1', ket_qua: 'x', owner_tai_khoan: 'tpqt', ghi_de: ['owner_tai_khoan'] },
    { ma: 'NV-2', owner_tai_khoan: '', owner_don_vi_ma: 'VAN_PHONG_TINH_UY', ghi_de: ['owner_tai_khoan'] },
    { ma: 'NV-3', owner_tai_khoan: '', owner_don_vi_ma: 'TONG_HOP', ghi_de: ['owner_tai_khoan'] }, { ma: 'NV-4' }]);
  assert.deepEqual(chuDoi({ cu: { nguoi_theo_doi: 'a' }, moi: { nguoi_theo_doi: 'b' } }), [], 'trường nội bộ người theo dõi không hiện');
  const loi = chuanHoaChuTri({ viec: [{ ma: 'NV-5', chu_tri: 'Người Không Có' }, { ma: 'NV-6', chu_tri: 'Lý Văn Phúc' }], van_ban: [] }, ctx).loi;
  assert.equal(loi.length, 2); assert.match(loi[0], /NV-5.*không khớp/); assert.match(loi[1], /NV-6.*trùng tên/);
});

