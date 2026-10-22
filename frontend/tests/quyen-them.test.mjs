// v3.29 (0123–0126, chủ dự án quyết 22/10/2026): ai thấy nút gì — điều chỉnh hạn (chủ trì theo dõi khi việc chưa quá hạn, thư ký Thường trực, tài
// khoản quản trị), thư ký ghi ở mọi việc chưa hoàn thành (kể cả ngoài phạm vi cũ — không còn "Chỉ xem"), quyền riêng của tài khoản quản trị; câu ghi
// chú dưới ô hạn mới. Chỉ là ẩn / hiện — hàm DB là chốt (test RLS kl-0123…kl-0126). Dữ liệu hư cấu. Chạy `npm test` trong frontend/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { laThuKyTT, thuKyGhi, chiXemVoi, chuTriTheoDoi, cheDoDieuChinhHan, duocDoiChuTri, duocSuaToanBo, duocMoLai, duocSuaVanBan, duocSuaMinhChung,
  ghiChuHanMoi } from '../src/lib/kl/quyen-them.js';
import { hoSoHieuDung } from '../src/lib/toan-quyen.js';

const HOM_NAY = '2026-10-22';
const CV = { id: 'cv', role_group: 'A3' };
const TD = { id: 'td', role_group: 'A2' };
const TK = { id: 'tk', role_group: 'A3', thu_ky_thuong_truc: true };
const QT = hoSoHieuDung({ id: 'qt', role_group: 'A3', toan_quyen: true });
const KHAC = { id: 'khac', role_group: 'A3' };
const viec = (them = {}) => ({ id: 'v1', van_ban_id: 'vb1', owner_tai_khoan: 'cv', nguoi_theo_doi: 'td', han_xu_ly: '2026-10-30', ngay_ban_hanh: '2026-09-01',
  tien_do_ma: 'DANG_THUC_HIEN', so_lan_gia_han: 1, trong_pham_vi: true, ...them });

test('Thư ký Thường trực: cờ + không phải Thường trực, tài khoản khoá, tài khoản hệ thống; ghi ở việc chưa hoàn thành', () => {
  assert.equal(laThuKyTT(TK), true);
  for (const u of [{ ...TK, role_group: 'A0' }, { ...TK, bi_khoa: true }, { ...TK, is_system: true }, CV, null]) assert.equal(laThuKyTT(u), false);
  assert.equal(thuKyGhi(viec(), TK), true);
  assert.equal(thuKyGhi(viec({ tien_do_ma: 'HOAN_THANH' }), TK), false);
  assert.equal(thuKyGhi(viec(), CV), false);
});

test('Chỉ xem: việc ngoài phạm vi — thư ký ghi được nếu chưa hoàn thành; người khác vẫn chỉ xem', () => {
  const ngoai = viec({ trong_pham_vi: false });
  assert.equal(chiXemVoi(ngoai, TK), false);
  assert.equal(chiXemVoi({ ...ngoai, tien_do_ma: 'HOAN_THANH' }, TK), true);
  assert.equal(chiXemVoi(ngoai, KHAC), true);
  assert.equal(chiXemVoi(viec(), KHAC), false, 'việc trong phạm vi: không phải chỉ xem');
});

test('Điều chỉnh hạn: chủ trì (việc giao cho phòng → người theo dõi) khi chưa quá hạn; quá hạn → câu nhắc; thư ký, quản trị', () => {
  assert.equal(chuTriTheoDoi(viec()), 'cv');
  assert.equal(chuTriTheoDoi(viec({ owner_tai_khoan: null })), 'td');
  assert.equal(cheDoDieuChinhHan(viec(), CV, HOM_NAY), 'duoc');
  assert.equal(cheDoDieuChinhHan(viec({ han_xu_ly: HOM_NAY }), CV, HOM_NAY), 'duoc', 'hạn đúng hôm nay: chưa quá hạn');
  assert.equal(cheDoDieuChinhHan(viec({ han_xu_ly: '2026-10-21' }), CV, HOM_NAY), 'qua-han');
  assert.equal(cheDoDieuChinhHan(viec(), TD, HOM_NAY), '', 'người theo dõi khi đã có cán bộ chủ trì');
  assert.equal(cheDoDieuChinhHan(viec({ owner_tai_khoan: null }), TD, HOM_NAY), 'duoc');
  assert.equal(cheDoDieuChinhHan(viec(), KHAC, HOM_NAY), '');
  assert.equal(cheDoDieuChinhHan(viec({ tien_do_ma: 'HOAN_THANH' }), CV, HOM_NAY), '');
  assert.equal(cheDoDieuChinhHan(viec({ han_xu_ly: null }), CV, HOM_NAY), '', 'chưa có hạn: điền ở Cập nhật');
  assert.equal(cheDoDieuChinhHan(viec({ han_xu_ly: '2026-10-01', trong_pham_vi: false }), TK, HOM_NAY), 'duoc', 'thư ký: cả việc quá hạn, ngoài phạm vi');
  assert.equal(cheDoDieuChinhHan(viec({ tien_do_ma: 'HOAN_THANH' }), TK, HOM_NAY), '');
  assert.equal(cheDoDieuChinhHan(viec({ tien_do_ma: 'HOAN_THANH', han_xu_ly: '2026-10-01' }), QT, HOM_NAY), 'duoc', 'quản trị: mọi việc');
});

test('Đổi chủ trì: thư ký (việc chưa hoàn thành), quản trị (mọi việc); quyền riêng của tài khoản quản trị', () => {
  const xong = viec({ tien_do_ma: 'HOAN_THANH' });
  assert.equal(duocDoiChuTri(viec(), TK), true); assert.equal(duocDoiChuTri(xong, TK), false);
  assert.equal(duocDoiChuTri(xong, QT), true); assert.equal(duocDoiChuTri(viec(), CV), false);
  assert.equal(duocSuaToanBo(xong, QT), true); assert.equal(duocSuaToanBo(viec(), TK), false);
  assert.equal(duocMoLai(xong, QT), true); assert.equal(duocMoLai(viec(), QT), false); assert.equal(duocMoLai(xong, TK), false);
  assert.equal(duocSuaVanBan(viec(), QT), true); assert.equal(duocSuaVanBan(viec({ van_ban_id: null }), QT), false); assert.equal(duocSuaVanBan(viec(), TK), false);
  assert.equal(duocSuaMinhChung(QT), true); assert.equal(duocSuaMinhChung(TK), false);
  const a0 = { id: 'a0', role_group: 'A0', toan_quyen: true };
  assert.equal(duocSuaToanBo(viec(), a0), false, 'Thường trực không bao giờ là toàn quyền');
});

test('Ghi chú hạn mới: lùi = gia hạn lần n + 1, rút ngắn không tính, trùng hạn, trước ngày ban hành, trước hôm nay (trừ tài khoản quản trị)', () => {
  const r = viec();
  assert.equal(ghiChuHanMoi(r, ''), '');
  assert.equal(ghiChuHanMoi(r, '2026-10-30'), 'Hạn mới trùng hạn hiện tại.');
  assert.equal(ghiChuHanMoi(r, '2026-11-15'), 'Lùi hạn: tính là gia hạn lần 2.');
  assert.equal(ghiChuHanMoi({ ...r, so_lan_gia_han: 0 }, '2026-11-15'), 'Lùi hạn: tính là gia hạn lần 1.');
  assert.equal(ghiChuHanMoi(r, '2026-10-25'), 'Rút ngắn hạn: không tính lần gia hạn.');
  assert.equal(ghiChuHanMoi(r, '2026-08-01'), 'Hạn mới không được trước ngày ban hành văn bản.');
  assert.equal(ghiChuHanMoi(r, '2026-10-20', { homNay: HOM_NAY }), 'Hạn mới không được trước hôm nay.');
  assert.equal(ghiChuHanMoi(r, HOM_NAY, { homNay: HOM_NAY }), 'Rút ngắn hạn: không tính lần gia hạn.', 'hạn mới đúng hôm nay: được');
  assert.equal(ghiChuHanMoi(r, '2026-10-20', { homNay: HOM_NAY, choQuaKhu: true }), 'Rút ngắn hạn: không tính lần gia hạn.', 'quản trị: đính chính hạn đã qua');
  assert.equal(ghiChuHanMoi(r, '2026-08-01', { homNay: HOM_NAY, choQuaKhu: true }), 'Hạn mới không được trước ngày ban hành văn bản.');
  assert.equal(ghiChuHanMoi({ ...r, han_xu_ly: null }, '2026-11-15', { homNay: HOM_NAY }), '', 'việc chưa có hạn: không ghi chú gia hạn');
});
