// PR-3 G — bộ ghi .xlsx tự viết (lib/xlsx.js): gói ZIP STORE đọc lại được (CRC đúng), escape XML đủ, ký tự điều khiển bị bỏ, tên sheet hợp lệ;
// nhãn "Trước hạn n ngày / Đúng hạn / Trễ n ngày" (lib/kl/nhan.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoXlsx, xmlChu, tenSheet } from '../src/lib/xlsx.js';
import { tenTienDoHoanThanh, tenChatLuong } from '../src/lib/kl/nhan.js';

// Đọc ZIP STORE: duyệt đầu tệp cục bộ (PK\3\4), trả { tên: Uint8Array }.
function docZip(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); const ra = {}; let o = 0;
  while (dv.getUint32(o, true) === 0x04034b50) {
    assert.equal(dv.getUint16(o + 8, true), 0, 'phương thức STORE');
    const co = dv.getUint32(o + 18, true); const nTen = dv.getUint16(o + 26, true); const nThem = dv.getUint16(o + 28, true);
    const ten = new TextDecoder().decode(b.subarray(o + 30, o + 30 + nTen));
    ra[ten] = { du: b.subarray(o + 30 + nTen + nThem, o + 30 + nTen + nThem + co), crc: dv.getUint32(o + 14, true) };
    o += 30 + nTen + nThem + co;
  }
  return ra;
}
const crc32 = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; } return ~c >>> 0; };

test('ZIP đọc lại đủ phần, CRC đúng; ô có ngoặc kép / xuống dòng / ký tự điều khiển; ngày là số Excel', () => {
  const b = taoXlsx([{ ten: 'Nhiệm vụ', cot: [{ nhan: 'Mã' }, { nhan: 'Nội dung' }, { nhan: 'Hạn', kieu: 'ngay' }],
    dong: [['NV-1', 'Có "ngoặc kép" & <thẻ>\nxuống dòng\u0001', '2026-10-01'], ['NV-2', null, '']] }]);
  const z = docZip(b);
  assert.deepEqual(Object.keys(z).sort(), ['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']);
  Object.values(z).forEach((p) => assert.equal(crc32(p.du), p.crc));
  const s = new TextDecoder().decode(z['xl/worksheets/sheet1.xml'].du);
  assert.equal((s.match(/<row /g) || []).length, 3, 'tiêu đề + 2 dòng');
  assert.match(s, /Có &quot;ngoặc kép&quot; &amp; &lt;thẻ&gt;\nxuống dòng</);
  assert.ok(!s.includes('\u0001'));
  assert.match(s, /<c r="C2" s="2"><v>46296<\/v><\/c>/, '1/10/2026 = 46296');
  assert.ok(!/r="B3"|r="C3"/.test(s), 'ô rỗng bỏ qua');
});

test('xmlChu bỏ surrogate lẻ và ký tự điều khiển, giữ tab/xuống dòng/emoji; tenSheet ≤ 31 ký tự, bỏ [ ] : * ? / \\, không trùng', () => {
  assert.equal(xmlChu('a\uD800b\u{1F600}\t\n\u0008\'"'), 'ab\u{1F600}\t\n&apos;&quot;');
  const daCo = new Set();
  const a = tenSheet('Báo cáo [quý]: 3/2026 * tổng hợp ? rất dài vượt giới hạn', daCo); const b = tenSheet('Báo cáo [quý]: 3/2026 * tổng hợp ? rất dài vượt giới hạn', daCo);
  assert.ok(a.length <= 31 && b.length <= 31 && a !== b && !/[[\]:*?/\\]/.test(a + b));
});

test('Tiến độ hoàn thành: Trước hạn n ngày / Đúng hạn / Trễ n ngày; chất lượng có tên', () => {
  const r = (t, ht) => ({ tien_do_hoan_thanh: t, ngay_hoan_thanh: ht, han_xu_ly: '2026-09-20' });
  assert.deepEqual([r('TRUOC_HAN', '2026-09-15'), r('DUNG_HAN', '2026-09-20'), r('TRE', '2026-09-23'), r(null, null)].map(tenTienDoHoanThanh),
    ['Trước hạn 5 ngày', 'Đúng hạn', 'Trễ 3 ngày', '']);
  assert.deepEqual(['KHONG_DAT', 'DAT', 'DAT_TOT', 'DAT_XUAT_SAC', null].map(tenChatLuong), ['Không đạt', 'Đạt', 'Đạt tốt', 'Đạt xuất sắc', '']);
});
