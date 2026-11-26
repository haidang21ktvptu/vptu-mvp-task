// v3.36 phần 4 (CAU-HOI V-1): Cần xử lý xếp theo mức khẩn (lib/kl/do-khan.js soSanhKhan, soSanhMuc); nội dung thẻ hai dòng (lib/kl/nd-gon.js) —
// thoát ký tự, nguyên văn ở title; menu bốn nhóm (views/shell/menu.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soSanhKhan, soSanhMuc } from '../src/lib/kl/do-khan.js';
import { ndGonHtml, ndPhuHtml } from '../src/lib/kl/nd-gon.js';
import { menuCuaVai, QUAN_TRI_NAV } from '../src/views/shell/menu.js';

const v = (ma, o = {}) => ({ ma, do_khan: 'THUONG', uu_tien: null, muc_canh_bao: 'DO', so_ngay_qua: 1, han_xu_ly: '2026-11-20', ...o });

test('mức khẩn: độ khẩn, Thường trực giao, Đỏ đặc biệt trước Đỏ trước Vàng, số ngày trễ, hạn gần', () => {
  const ds = [
    v('a', { so_ngay_qua: 30, muc_canh_bao: 'DO_DAC_BIET' }),
    v('b', { do_khan: 'HOA_TOC', so_ngay_qua: 1 }),
    v('c', { uu_tien: 'THUONG_TRUC', so_ngay_qua: 2 }),
    v('d', { so_ngay_qua: 5 }),
    v('e', { muc_canh_bao: 'VANG', so_ngay_qua: null, han_xu_ly: '2026-11-28' }),
    v('f', { muc_canh_bao: 'VANG', so_ngay_qua: null, han_xu_ly: '2026-11-27' }),
    v('g', { do_khan: 'KHAN', muc_canh_bao: 'VANG', so_ngay_qua: null }),
  ].sort(soSanhKhan);
  assert.deepEqual(ds.map((r) => r.ma), ['b', 'g', 'c', 'a', 'd', 'f', 'e']);
  assert.ok(soSanhMuc({ muc_canh_bao: 'DO_DAC_BIET' }, { muc_canh_bao: 'DO' }) < 0);
  assert.ok(soSanhMuc({ muc_canh_bao: 'XANH' }, { muc_canh_bao: 'VANG' }) > 0, 'mức khác xếp sau Vàng');
});

test('nội dung hai dòng: mã đứng đầu, thoát ký tự, nguyên văn ở title; dòng phụ rỗng thì không vẽ', () => {
  assert.equal(ndGonHtml('NV-1', 'Báo cáo <quý> & "năm"'),
    '<span class="nd-gon" title="Báo cáo &lt;quý&gt; &amp; &quot;năm&quot;"><b>NV-1</b> Báo cáo &lt;quý&gt; &amp; &quot;năm&quot;</span>');
  assert.equal(ndGonHtml('', 'Việc'), '<span class="nd-gon" title="Việc">Việc</span>');
  assert.match(ndGonHtml('NV-2', 'Việc', '<button>NV-2</button> '), /^<span class="nd-gon" title="Việc"><button>NV-2<\/button> Việc<\/span>$/);
  assert.equal(ndPhuHtml('  '), '');
  assert.equal(ndPhuHtml('hạn 30/11/2026'), '<span class="nd-phu">hạn 30/11/2026</span>');
});

test('menu bốn nhóm: Điều hành, Nhiệm vụ, Nhiệm vụ quý BTV, Quản trị (khi có cờ quản trị)', () => {
  const nhom = (u) => [...new Set(menuCuaVai(u, { nvq: {} }).map((m) => m.nhom))];
  assert.deepEqual(nhom({ role_group: 'A1' }), ['Điều hành', 'Nhiệm vụ', 'Nhiệm vụ quý BTV']);
  assert.deepEqual(nhom({ role_group: 'A1', quan_tri_he_thong: true }), ['Điều hành', 'Nhiệm vụ', 'Nhiệm vụ quý BTV', 'Quản trị']);
  assert.equal(QUAN_TRI_NAV.nhom, 'Quản trị');
});
