// PR-2a B6: dòng ngoại lệ dựng ở client (thay truy vấn v_ngoai_le) — cột ghép/đổi tên và thứ tự dòng khớp định nghĩa view 0051;
// lỗi DB → câu tiếng Việt (Q7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dongNgoaiLe, ngoaiLeTu } from '../src/lib/kl/ngoai-le.js';
import { loiDeHieu } from '../src/lib/kl/loi.js';

const r = (o) => ({ id: o.ma, thu_tu_do_khan: 4, uu_tien: null, bi_tu_choi: false, muc_canh_bao: 'DO', so_ngay_qua: 1, nhom_ngoai_le: 'DO', ...o });

test('dongNgoaiLe: bỏ dòng không thuộc ngoại lệ; nhom, owner_ten, san_pham_ten, cap_quyet_dinh_ten như v_ngoai_le', () => {
  assert.equal(dongNgoaiLe({ nhom_ngoai_le: null }), null);
  const d = dongNgoaiLe(r({ ma: 'A', owner_tai_khoan_ten: null, owner_don_vi_ten: 'Phòng X', san_pham_ten: 'Báo cáo', san_pham_mo_ta: 'quý', cap_quyet_dinh_ten: null }));
  assert.deepEqual([d.nhom, d.owner_ten, d.san_pham_ten, d.cap_quyet_dinh_ten], ['DO', 'Phòng X', 'Báo cáo: quý', 'chưa xác định']);
  assert.equal(dongNgoaiLe(r({ ma: 'B', san_pham_ten: null, san_pham_mo_ta: 'x' })).san_pham_ten, 'chưa định nghĩa');
  assert.equal(dongNgoaiLe(r({ ma: 'C', san_pham_ten: 'Tờ trình', san_pham_mo_ta: null })).san_pham_ten, 'Tờ trình');
});

test('ngoaiLeTu: ORDER BY thu_tu_do_khan, Thường trực, bị từ chối, Đỏ đặc biệt, so_ngay_qua DESC (NULL trước), ma', () => {
  const ds = ngoaiLeTu([
    r({ ma: 'NV-9', so_ngay_qua: 5 }), r({ ma: 'NV-8', so_ngay_qua: null, bi_tu_choi: true }), r({ ma: 'NV-7', so_ngay_qua: 9 }),
    r({ ma: 'NV-6', muc_canh_bao: 'DO_DAC_BIET' }), r({ ma: 'NV-5', uu_tien: 'THUONG_TRUC' }), r({ ma: 'NV-4', thu_tu_do_khan: 1 }),
    r({ ma: 'NV-3', so_ngay_qua: null }), r({ ma: 'NV-2', so_ngay_qua: 5 }), r({ ma: 'NV-1', nhom_ngoai_le: null }),
  ]);
  assert.deepEqual(ds.map((x) => x.ma), ['NV-4', 'NV-5', 'NV-8', 'NV-6', 'NV-3', 'NV-7', 'NV-2', 'NV-9']);
});

test('loiDeHieu: giữ lỗi tiếng Việt của DB; đổi lỗi kỹ thuật sang câu hướng dẫn', () => {
  assert.equal(loiDeHieu(new Error('Việc đã có hạn xử lý: muốn đổi hạn phải đề nghị gia hạn.')), 'Việc đã có hạn xử lý: muốn đổi hạn phải đề nghị gia hạn.');
  assert.match(loiDeHieu(new Error('new row violates row-level security policy for table "nhiem_vu"')), /không có quyền/);
  assert.match(loiDeHieu(new Error('canceling statement due to statement timeout')), /đang bận/);
  assert.match(loiDeHieu(new Error('TypeError: Failed to fetch')), /Mất kết nối/);
  assert.match(loiDeHieu(new Error('something odd')), /lỗi hệ thống/);
});
