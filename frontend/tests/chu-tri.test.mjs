// v3.31 (0128, chủ dự án quyết 23/10/2026 — "Bỏ đi → chỉ còn Chủ trì theo dõi"): ghi chủ trì theo dõi một kiểu ở mọi nơi; Diễn biến ẩn dòng đổi
// người theo dõi (trường nội bộ) và làm gọn câu lịch sử cũ còn nhắc người theo dõi (lib/kl/chu-tri.js). Dữ liệu hư cấu. Chạy `npm test` trong frontend/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chuTriText, anDongDienBien, lamGonCauCu } from '../src/lib/kl/chu-tri.js';

test('Chủ trì theo dõi một kiểu: cán bộ "Họ tên (Phòng …)", lãnh đạo "(Văn phòng Tỉnh ủy)", phòng / Văn phòng: tên đơn vị bỏ số thứ tự', () => {
  assert.equal(chuTriText({ owner_tai_khoan_ten: 'Nông Văn A', owner_don_vi_ten: '1. Phòng Tổng hợp' }), 'Nông Văn A (Phòng Tổng hợp)');
  assert.equal(chuTriText({ owner_tai_khoan_ten: 'Hoàng Thị B', owner_don_vi_ten: 'Văn phòng Tỉnh ủy' }), 'Hoàng Thị B (Văn phòng Tỉnh ủy)');
  assert.equal(chuTriText({ owner_tai_khoan_ten: 'Lý Văn C' }), 'Lý Văn C', 'không rõ đơn vị: chỉ họ tên');
  assert.equal(chuTriText({ owner_tai_khoan_ten: null, owner_don_vi_ten: '2. Phòng Quản trị' }), 'Phòng Quản trị');
  assert.equal(chuTriText({}), 'chưa xác định'); assert.equal(chuTriText(null, '—'), '—'); assert.equal(chuTriText({}, ''), '');
});

test('Diễn biến: ẩn dòng đổi người theo dõi (máy tự ghi, căn dữ liệu 0128) và "Đổi chủ trì theo dõi" cũ chỉ đổi người theo dõi; dòng khác giữ', () => {
  assert.equal(anDongDienBien({ nguon: 'lich_su', loai: 'nguoi_theo_doi', noi_dung: 'x' }), true);
  assert.equal(anDongDienBien({ nguon: 'lich_su', loai: 'doi_chu_tri', noi_dung: 'người theo dõi: A → B — lý do: x' }), true);
  assert.equal(anDongDienBien({ nguon: 'lich_su', loai: 'doi_chu_tri', noi_dung: 'chủ trì: A → B · người theo dõi: C → D — lý do: x' }), false);
  assert.equal(anDongDienBien({ nguon: 'lich_su', loai: 'owner_tai_khoan' }), false);
  assert.equal(anDongDienBien({ nguon: 'chi_dao', loai: 'nguoi_theo_doi' }), false, 'chỉ dòng lịch sử');
  assert.equal(anDongDienBien(null), false);
});

test('Câu lịch sử cũ: bỏ phần người theo dõi (giao thẳng, giao lại, đổi chủ trì, bổ sung dữ liệu); "Chuyển người theo dõi" → "Chuyển theo dõi"', () => {
  assert.equal(lamGonCauCu('Chuyên viên Nông Văn A giao, người theo dõi là người giao'), 'Chuyên viên Nông Văn A giao');
  assert.equal(lamGonCauCu('Chuyển chủ trì từ Nông Văn A sang Lý Văn C · người theo dõi: Hoàng Thị B'), 'Chuyển chủ trì từ Nông Văn A sang Lý Văn C');
  assert.equal(lamGonCauCu('chủ trì: A → C · người theo dõi: B → D — lý do: chuyển công tác'), 'chủ trì: A → C — lý do: chuyển công tác');
  assert.equal(lamGonCauCu('Bổ sung hạn xử lý, người theo dõi, người chủ trì — lý do: rà soát'), 'Bổ sung hạn xử lý, người chủ trì — lý do: rà soát');
  assert.equal(lamGonCauCu('Bổ sung người chủ trì, người theo dõi — lý do: rà soát'), 'Bổ sung người chủ trì — lý do: rà soát');
  assert.equal(lamGonCauCu('Chuyển người theo dõi từ A sang B — lý do: nghỉ hưu'), 'Chuyển theo dõi từ A sang B — lý do: nghỉ hưu');
  assert.equal(lamGonCauCu('Chuyển chủ trì theo dõi từ A sang B — lý do: nghỉ hưu'), 'Chuyển chủ trì theo dõi từ A sang B — lý do: nghỉ hưu', 'câu mới giữ nguyên');
  assert.equal(lamGonCauCu('Hạn xử lý: 01/11/2026'), 'Hạn xử lý: 01/11/2026'); assert.equal(lamGonCauCu(null), null); assert.equal(lamGonCauCu(5), 5);
});
