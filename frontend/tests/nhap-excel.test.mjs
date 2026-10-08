// Nhập Excel toàn trình (v9 đợt 2): đọc .xlsx (ZIP DEFLATE / STORE, chuỗi dùng chung, ngày theo định dạng, ô gộp), tự nhận dòng tiêu đề và
// hồ sơ (mẫu chuẩn, Phụ lục 2), chuẩn hoá giá trị (ngày, danh mục, cán bộ, từ điển), đánh giá 3 mức + quy tắc mặc định, mẫu nhập chuẩn.
// Dữ liệu hư cấu. Chạy `npm test` trong frontend/ (node:test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync, crc32 } from 'node:zlib';
import { docXlsx, ngayTuSo } from '../src/lib/xlsx-doc.js';
import { timTieuDe, doanTruong, chuanTieuDe, TRUONG_MAU } from '../src/lib/kl/nhap/truong.js';
import { chuanGiaTri, docNgay } from '../src/lib/kl/nhap/chuan-hoa.js';
import { danhGia, doanLoaiVanBan } from '../src/lib/kl/nhap/danh-gia.js';
import { layDong, chuanDong } from '../src/lib/kl/nhap/bang.js';
import { taoMauNhap } from '../src/lib/kl/nhap/mau.js';

// ZIP nén DEFLATE như Excel ghi (phần đọc chỉ dựa vào thư mục trung tâm).
function zipNen(tep) {
  const enc = new TextEncoder(); const phan = []; const tt = []; let viTri = 0;
  for (const [ten, s] of tep) {
    const du = enc.encode(s); const nen = deflateRawSync(du); const tb = Buffer.from(enc.encode(ten)); const c = crc32(du);
    const dau = Buffer.alloc(30); dau.writeUInt32LE(0x04034b50, 0); dau.writeUInt16LE(20, 4); dau.writeUInt16LE(0x0800, 6); dau.writeUInt16LE(8, 8);
    dau.writeUInt32LE(c, 14); dau.writeUInt32LE(nen.length, 18); dau.writeUInt32LE(du.length, 22); dau.writeUInt16LE(tb.length, 26);
    const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x0800, 8); cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(c, 16); cd.writeUInt32LE(nen.length, 20); cd.writeUInt32LE(du.length, 24); cd.writeUInt16LE(tb.length, 28); cd.writeUInt32LE(viTri, 42);
    phan.push(dau, tb, nen); tt.push(cd, tb); viTri += 30 + tb.length + nen.length;
  }
  const ket = Buffer.alloc(22); ket.writeUInt32LE(0x06054b50, 0); ket.writeUInt16LE(tep.length, 8); ket.writeUInt16LE(tep.length, 10);
  ket.writeUInt32LE(tt.reduce((s, x) => s + x.length, 0), 12); ket.writeUInt32LE(viTri, 16);
  const b = Buffer.concat([...phan, ...tt, ket]); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}
const TD = ['STT', 'Số hội nghị', 'Số TB/KL', 'Ngày ban hành', 'Chủ trì theo dõi', 'Ngành/lĩnh vực', 'Cơ quan/đơn vị trình', 'Lĩnh vực chi tiết',
  'Nội dung kết luận / Văn bản trình', 'Loại thời hạn', 'Hạn xử lý', 'Tiến độ', 'Kết quả thực hiện / Minh chứng', 'Văn bản triển khai', 'Mã nhiệm vụ', 'Ngày cập nhật gần nhất'];
const SS = [...TD, 'PHỤ LỤC 2 &amp; theo dõi', '45-KL/TU', 'Lý Văn Phúc', '8. Kinh tế tổng hợp - Tài chính - Đầu tư - Ngân sách', 'UBND tỉnh', 'Báo cáo tình hình', 'Có hạn cụ thể', 'Đang thực hiện', 'Rà soát danh mục', 'Hoàn thành'];
const s = (t) => SS.indexOf(t);
const COT = 'ABCDEFGHIJKLMNOP';
const oS = (c, r, t) => `<c r="${c}${r}" t="s"><v>${s(t)}</v></c>`;
const TEP_PL2 = [
  ['[Content_Types].xml', '<Types/>'],
  ['xl/workbook.xml', '<workbook><workbookPr/><sheets><sheet name="Phụ lục 2" sheetId="1" r:id="rId1"/><sheet name="NhatKy" sheetId="2" state="hidden" r:id="rId2"/></sheets></workbook>'],
  ['xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="x" Target="/xl/worksheets/sheet2.xml"/></Relationships>'],
  ['xl/sharedStrings.xml', `<sst>${SS.map((t) => `<si><t xml:space="preserve">${t}</t></si>`).join('')}<si><r><t>Phú</t></r><r><t>c</t></r><rPh><t>x</t></rPh></si></sst>`],
  ['xl/styles.xml', '<styleSheet><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy;@"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"><alignment/></xf></cellXfs></styleSheet>'],
  ['xl/worksheets/sheet1.xml', `<worksheet><sheetData><row r="1">${oS('A', 1, 'PHỤ LỤC 2 &amp; theo dõi')}</row><row r="2"/>`
    + `<row r="3">${TD.map((t, i) => oS(COT[i], 3, t)).join('')}</row>`
    + `<row r="4"><c r="A4"><v>1</v></c><c r="B4"><v>45</v></c>${oS('C', 4, '45-KL/TU')}<c r="D4" s="1"><v>46235</v></c>${oS('E', 4, 'Lý Văn Phúc')}`
    + `${oS('F', 4, '8. Kinh tế tổng hợp - Tài chính - Đầu tư - Ngân sách')}${oS('G', 4, 'UBND tỉnh')}${oS('I', 4, 'Báo cáo tình hình')}${oS('J', 4, 'Có hạn cụ thể')}`
    + `<c r="K4" s="2"><v>46387</v></c>${oS('L', 4, 'Đang thực hiện')}<c r="O4" t="str"><f>"NV-"&amp;A4</f><v>NV-1</v></c><c r="P4" t="e"><v>#N/A</v></c></row>`
    + `<row r="5"><c r="A5"><v>2</v></c>${oS('I', 5, 'Rà soát danh mục')}${oS('L', 5, 'Hoàn thành')}<c r="M5" t="inlineStr"><is><t>Số 12/BC</t></is></c><c r="N5" t="b"><v>1</v></c></row>`
    + `<row r="6"><c r="A6"><v>3</v></c><c r="O6" t="str"><v>NV-3</v></c><c r="P6" t="s"><v>${SS.length}</v></c></row></sheetData>`
    + '<mergeCells count="4"><mergeCell ref="A1:P1"/><mergeCell ref="B4:B5"/><mergeCell ref="C4:C5"/><mergeCell ref="D4:D5"/></mergeCells></worksheet>'],
  ['xl/worksheets/sheet2.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Nhật ký</t></is></c></row></sheetData></worksheet>'],
];

test('docXlsx: ZIP DEFLATE, chuỗi dùng chung (cả rich text), ngày theo định dạng có sẵn / tự đặt, ô gộp chép giá trị, công thức lấy giá trị, ô lỗi trống', async () => {
  const ds = await docXlsx(zipNen(TEP_PL2));
  assert.deepEqual(ds.map((x) => [x.ten, x.an]), [['Phụ lục 2', false], ['NhatKy', true]]);
  const d = ds[0].dong;
  assert.equal(d[0][0], 'PHỤ LỤC 2 & theo dõi'); assert.equal(d[0][15] ?? null, null, 'ô gộp ngang A1:P1: không chép sang cột bên');
  assert.equal(d[5][15], 'Phúc', 'chuỗi dùng chung rich text, bỏ phiên âm');
  assert.equal(d[2][8], 'Nội dung kết luận / Văn bản trình');
  assert.equal(d[3][3], '2026-08-01', 'numFmtId 14'); assert.equal(d[3][10], '2026-12-31', 'mã tự đặt dd/mm/yyyy');
  assert.equal(d[3][1], 45); assert.equal(d[4][1], 45, 'gộp dọc B4:B5'); assert.equal(d[4][2], '45-KL/TU'); assert.equal(d[4][3], '2026-08-01', 'gộp D4:D5 giữ kiểu ngày');
  assert.equal(d[3][14], 'NV-1'); assert.equal(d[3][15] ?? null, null, '#N/A → trống'); assert.equal(d[4][12], 'Số 12/BC'); assert.equal(d[4][13], 'TRUE');
  assert.equal(ngayTuSo(46387), '2026-12-31'); assert.equal(ngayTuSo(46387 - 1462, true), '2026-12-31', 'hệ ngày 1904');
});

test('docXlsx: tệp từ công cụ khác — tiền tố x:, <si />, <t/> rỗng, ô / dòng thiếu r, mã _xHHHH_, định dạng giờ không thành ngày, hệ ngày 1904, ô ngày = 0 giữ số, đường dẫn theo rels', async () => {
  const ds = await docXlsx(zipNen([
    ['xl/workbook.xml', '<x:workbook xmlns:x="m"><x:workbookPr date1904="1"/><x:sheets><x:sheet name="Dữ liệu" sheetId="1" r:id="rIdA"/></x:sheets></x:workbook>'],
    ['xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rIdA" Type="http://x/officeDocument/2006/relationships/worksheet" Target="ws/a.xml"/>'
      + '<Relationship Id="rIdS" Type="http://x/officeDocument/2006/relationships/sharedStrings" Target="chuoi/ss.xml"/>'
      + '<Relationship Id="rIdT" Type="http://x/officeDocument/2006/relationships/styles" Target="kieu.xml"/></Relationships>'],
    ['xl/chuoi/ss.xml', '<x:sst><x:si><x:t>Nội dung</x:t></x:si><x:si /><x:si><x:r><x:t/></x:r><x:r><x:t>Hạn</x:t></x:r></x:si></x:sst>'],
    ['xl/kieu.xml', '<x:styleSheet><x:numFmts><x:numFmt numFmtId="164" formatCode="h:mm AM/PM"/><x:numFmt numFmtId="165" formatCode="[h]:mm:ss"/></x:numFmts>'
      + '<x:cellXfs><x:xf numFmtId="0"/><x:xf numFmtId="20"/><x:xf numFmtId="164"/><x:xf numFmtId="165"/><x:xf numFmtId="14"/></x:cellXfs></x:styleSheet>'],
    ['xl/ws/a.xml', '<x:worksheet><x:sheetData><x:row><x:c t="s"><x:v>0</x:v></x:c><x:c t="s"><x:v>2</x:v></x:c></x:row>'
      + `<x:row><x:c t="inlineStr"><x:is><x:t>Dòng 1_x000D_
Dòng 2 _x005F_x000D_</x:t></x:is></x:c><x:c s="4"><x:v>${46387 - 1462}</x:v></x:c><x:c s="1"><x:v>0.35</x:v></x:c>`
      + '<x:c s="2"><x:v>0.5</x:v></x:c><x:c s="3"><x:v>1.25</x:v></x:c><x:c s="4"><x:v>0</x:v></x:c></x:row></x:sheetData></x:worksheet>'],
  ]));
  assert.equal(ds[0].ten, 'Dữ liệu');
  assert.deepEqual(ds[0].dong, [['Nội dung', 'Hạn'], ['Dòng 1\r\nDòng 2 _x000D_', '2026-12-31', 0.35, 0.5, 1.25, 0]]);
  await assert.rejects(docXlsx(new ArrayBuffer(40)), /Không đọc được|không phải \.xlsx/);
});

test('Nhận tiêu đề: Phụ lục 2 ở dòng 3 theo hồ sơ dựng sẵn; tệp lạ ghép theo tên hay gặp; cột "Hạn nộp minh chứng" (đã bỏ từ 3.17) không ghép vào đâu', async () => {
  const ds = await docXlsx(zipNen(TEP_PL2));
  const t = timTieuDe(ds);
  assert.equal(t.sheet, 0); assert.equal(t.dongTieuDe, 2); assert.equal(t.hoSo?.mau, 'PHU_LUC_2');
  assert.equal(t.anhXa[8], 'noi_dung'); assert.equal(t.anhXa[4], 'theo_doi'); assert.equal(t.anhXa[6], 'don_vi'); assert.equal(t.anhXa[14], 'ma'); assert.equal(t.anhXa[0], undefined);
  const la = timTieuDe([{ ten: 'S', an: false, dong: [['Ghi chú'], ['Nội dung', 'Hạn nộp minh chứng', 'Hạn', 'Người theo dõi (*)', 'Cột lạ']] }]);
  assert.equal(la.hoSo, null); assert.equal(la.dongTieuDe, 1);
  assert.deepEqual(la.anhXa, { 0: 'noi_dung', 2: 'han_xu_ly', 3: 'theo_doi' });
  assert.equal(doanTruong('Số/ ký hiệu văn bản'), 'so_ket_luan'); assert.equal(chuanTieuDe('  Đơn vị chủ trì (*) '), 'don vi chu tri');
  const them = timTieuDe([{ ten: 'PL2', an: false, dong: [[...TD, 'Cán bộ chủ trì', 'Ghi chú (2)']] }]);
  assert.equal(them.hoSo?.mau, 'PHU_LUC_2'); assert.equal(them.anhXa[16], 'can_bo', 'hồ sơ dựng sẵn: cột người dùng chèn thêm vẫn được đoán');
  assert.equal(them.anhXa[15], undefined); assert.equal(them.anhXa[17], 'ghi_chu');
  const luu = timTieuDe([{ ten: 'S', an: false, dong: [['Nội dung', 'Hạn', 'Cán bộ chủ trì']] }], [{ ten: 'Bảng phòng', anh_xa: { 'noi dung': 'noi_dung', han: 'han_xu_ly' } }]);
  assert.equal(luu.hoSo?.ten, 'Bảng phòng'); assert.deepEqual(luu.anhXa, { 0: 'noi_dung', 1: 'han_xu_ly' }, 'hồ sơ đã lưu: giữ đúng cách ghép đã chọn');
});

test('layDong: bỏ dòng chỉ còn STT / mã công thức; dữ liệu gốc giữ mọi cột kể cả cột không ghép', async () => {
  const ds = await docXlsx(zipNen(TEP_PL2)); const t = timTieuDe(ds);
  const dong = layDong(ds[0], t.dongTieuDe, t.anhXa);
  assert.deepEqual(dong.map((x) => x.soDong), [4, 5]);
  assert.equal(dong[0].goc.STT, 1); assert.equal(dong[0].goc['Nội dung kết luận / Văn bản trình'], 'Báo cáo tình hình');
  assert.equal(dong[0].raw.so_hoi_nghi, 45); assert.equal(dong[1].raw.so_hoi_nghi, 45, 'ô gộp chép xuống dòng 5');
  assert.equal(dong[1].raw.kq_mo_ta, 'Số 12/BC');
});

const DM = {
  donVi: [{ ma: 'VAN_PHONG_TINH_UY', ten: '1. Văn phòng Tỉnh ủy', trong_van_phong: true, phong: null }, { ma: 'DANG_UY_UBND', ten: '6. Đảng ủy Ủy ban nhân dân tỉnh', trong_van_phong: false, phong: null },
    { ma: 'TONG_HOP', ten: 'Phòng Tổng hợp', trong_van_phong: true, phong: 'TONG_HOP' }, { ma: 'QUAN_TRI', ten: 'Phòng Quản trị', trong_van_phong: true, phong: 'QUAN_TRI' }],
  nganh: [{ ma: 'KTTH', ten: '8. Kinh tế tổng hợp - Tài chính - Đầu tư - Ngân sách' }, { ma: 'NOI_CHINH', ten: '3. Nội chính - ANQP - Tư pháp' }],
  linhVuc: [{ ma: 'LV_TC', ten: 'Tài chính', nganh_ma: 'KTTH' }, { ma: 'LV_DT', ten: 'Đầu tư công', nganh_ma: 'KTTH' }, { ma: 'LV_TP', ten: 'Tư pháp', nganh_ma: 'NOI_CHINH' }],
  sanPham: [{ ma: 'BAO_CAO', ten: 'Báo cáo' }, { ma: 'TO_TRINH', ten: 'Tờ trình' }],
  cap: [{ ma: 'TRUONG_PHONG', ten: 'Trưởng phòng' }, { ma: 'CHANH_VAN_PHONG', ten: 'Chánh Văn phòng' }],
  loaiThoiHan: [{ ma: 'CO_HAN_CU_THE', ten: 'Có hạn cụ thể', cho_phep_tao_moi: true }, { ma: 'KY_BAN_HANH', ten: 'Ký ban hành (trong 10 ngày)', cho_phep_tao_moi: true },
    { ma: 'THUONG_XUYEN', ten: 'Nhiệm vụ thường xuyên', cho_phep_tao_moi: false }],
  nguonNhiemVu: [{ ma: 'VAN_BAN_CAN_THEO_DOI', ten: 'Văn bản cần theo dõi', dang_dung: true }, { ma: 'NHIEM_VU_PHAT_SINH', ten: 'Nhiệm vụ phát sinh', dang_dung: true }],
};
const ACC = [
  { id: 'cvp', full_name: 'Hoàng Văn Bình', role_group: 'A1', is_chief: true, department: 'LANH_DAO_VAN_PHONG', username: 'binh.cvp' },
  { id: 'tp', full_name: 'Nông Thị Lan', role_group: 'A2', department: 'TONG_HOP', username: 'lan.tp' },
  { id: 'cv1', full_name: 'Lý Văn Phúc', role_group: 'A3', department: 'TONG_HOP', username: 'phuc' },
  { id: 'cv2', full_name: 'Lý Văn Phúc', role_group: 'A3', department: 'QUAN_TRI', username: 'phuc.qt' },
  { id: 'tpqt', full_name: 'Đàm Văn Sơn', role_group: 'A2', department: 'QUAN_TRI', username: 'son' },
  { id: 'sys', full_name: 'Hệ thống', is_system: true, role_group: 'A3', department: 'CDS_CY', username: 'he.thong' },
];
const TEN_PHONG = { TONG_HOP: 'Phòng Tổng hợp', QUAN_TRI: 'Phòng Quản trị', LANH_DAO_VAN_PHONG: 'Lãnh đạo Văn phòng' };
const CTX = { dm: DM, accounts: ACC, tenPhong: (m) => TEN_PHONG[m] || m,
  tuDien: new Map([['don_vi', new Map([['ubnd tinh', 'DANG_UY_UBND']])], ['can_bo', new Map([['vptu', 'tp']])]]) };

test('Chuẩn hoá: ngày, danh mục (mã, tên bỏ số thứ tự, gần đúng, nhiều khớp), cán bộ (trùng tên, kèm phòng, tên đăng nhập, chức danh), từ điển trước', () => {
  assert.equal(docNgay(46387), '2026-12-31'); assert.equal(docNgay('31/12/2026'), '2026-12-31'); assert.equal(docNgay('5.9.26'), '2026-09-05');
  assert.equal(docNgay('2026-09-05'), '2026-09-05'); assert.equal(docNgay('ngày 05 tháng 9 năm 2026'), '2026-09-05'); assert.equal(docNgay('31/02/2026'), null);
  assert.equal(chuanGiaTri('donVi', 'UBND tỉnh', CTX).ma, 'DANG_UY_UBND', 'từ điển'); assert.equal(chuanGiaTri('donVi', 'UBND tỉnh', CTX).gan, 'tu_dien');
  assert.equal(chuanGiaTri('donVi', 'văn phòng tỉnh ủy', CTX).ma, 'VAN_PHONG_TINH_UY');
  assert.equal(chuanGiaTri('nganh', 'Kinh tế tổng hợp - Tài chính - Đầu tư - Ngân sách', CTX).ma, 'KTTH');
  assert.equal(chuanGiaTri('linhVuc', 'đầu tư', CTX, { nganh: 'KTTH' }).gan, 'gan_dung');
  assert.equal(chuanGiaTri('sanPham', 'BAO_CAO', CTX).gan, 'ma');
  assert.ok(chuanGiaTri('donVi', 'Phòng', CTX).loi, 'khớp nhiều đơn vị');
  assert.ok(chuanGiaTri('canBo', 'Lý Văn Phúc', CTX).loi.includes('trùng tên'));
  assert.equal(chuanGiaTri('canBo', 'Lý Văn Phúc — Phòng Quản trị', CTX).ma, 'cv2');
  assert.equal(chuanGiaTri('canBo', 'ly van phuc (phong tong hop)', CTX).ma, 'cv1');
  assert.equal(chuanGiaTri('canBo', 'son', CTX).ma, 'tpqt'); assert.equal(chuanGiaTri('canBo', 'Chánh Văn phòng', CTX).ma, 'cvp');
  assert.equal(chuanGiaTri('canBo', 'Trưởng phòng Quản trị', CTX).ma, 'tpqt'); assert.equal(chuanGiaTri('canBo', 'VPTU', CTX).ma, 'tp');
  assert.equal(chuanGiaTri('canBo', 'Hệ thống', CTX).loi, 'không khớp cán bộ nào');
  assert.equal(chuanGiaTri('tienDo', 'Đã hoàn thành', CTX).ma, 'HOAN_THANH'); assert.equal(chuanGiaTri('chatLuong', 'Không đạt', CTX).ma, 'KHONG_DAT');
  assert.equal(chuanGiaTri('doKhan', 'Hoả tốc', CTX).ma, 'HOA_TOC'); assert.equal(chuanGiaTri('loaiThoiHan', 'Ký ban hành', CTX).ma, 'KY_BAN_HANH');
  assert.equal(chuanGiaTri('so', 'HN số 45', CTX).ma, 45); assert.equal(chuanGiaTri('noi_dung', '  ', CTX), null);
});

const dong = (raw, soDong = 7) => chuanDong({ soDong, raw, goc: { 'Cột lạ': 'x' } }, CTX);
const DG = { me: { id: 'qtkl', role_group: 'A3' }, dm: DM, accounts: ACC, cheDoXong: 'DA_XONG_NGOAI', homNay: '2026-10-02', maDaCo: new Set(['NV-9']) };
const DU = { so_hoi_nghi: 45, so_ket_luan: '45-KL/TU', ngay_ban_hanh: '01/08/2026', noi_dung: 'Báo cáo quý', don_vi: 'Phòng Tổng hợp', san_pham: 'Báo cáo',
  han_xu_ly: '31/12/2026', nganh: 'Kinh tế tổng hợp - Tài chính - Đầu tư - Ngân sách', linh_vuc: 'Tài chính' };

test('Đánh giá: mặc định (Kết luận BTV khi có số hội nghị, nguồn theo loại, theo dõi = Trưởng phòng, lãnh đạo giao), đủ mức 1 → GIAO', () => {
  const kq = danhGia(dong(DU), DG);
  assert.equal(kq.ket_qua, 'GIAO'); assert.deepEqual(kq.thieu, []);
  assert.equal(kq.gt.loai_van_ban, 'KL_BTV'); assert.equal(kq.gt.nguon, 'VAN_BAN_CAN_THEO_DOI'); assert.equal(kq.gt.do_khan, 'THUONG');
  assert.equal(kq.du_lieu.nguoi_theo_doi, 'tp'); assert.equal(kq.du_lieu.thay_mat_cho, 'tp'); assert.ok(kq.macDinh.has('lanh_dao_giao'));
  assert.equal(kq.du_lieu.ngay_ban_hanh, '2026-08-01'); assert.deepEqual(kq.du_lieu.du_lieu_goc, { 'Cột lạ': 'x' });
  assert.equal(doanLoaiVanBan(null, '12-TB/TU'), 'TB_THUONG_TRUC'); assert.equal(doanLoaiVanBan(null, '15/CV-VPTU'), 'CONG_VAN');
});

test('Đánh giá: thiếu mức 1 → CHO_HOAN_THIEN; điền hàng loạt lấp chỗ trống; Hoàn thành theo chế độ lô; cán bộ khác phòng chặn; ô tuỳ chọn sai bỏ qua', () => {
  const thieu = danhGia(dong({ ...DU, san_pham: undefined, nganh: undefined, linh_vuc: undefined }), DG);
  assert.equal(thieu.ket_qua, 'CHO_HOAN_THIEN'); assert.deepEqual(thieu.du_lieu.thieu, ['san_pham', 'nganh', 'linh_vuc']);
  const hl = danhGia(dong({ ...DU, san_pham: undefined }), { ...DG, hangLoat: { san_pham: 'TO_TRINH' } });
  assert.equal(hl.ket_qua, 'GIAO'); assert.equal(hl.du_lieu.san_pham_loai, 'TO_TRINH');
  const xong = { ...DU, tien_do: 'Hoàn thành', kq_so_hieu: '12/BC', kq_ngay: '20/09/2026', kq_trich_yeu: 'Báo cáo', kq_mo_ta: 'Đã gửi' };
  assert.equal(danhGia(dong(xong), DG).ket_qua, 'DA_XONG');
  assert.equal(danhGia(dong(xong), { ...DG, cheDoXong: 'CHO_NGHIEM_THU' }).ket_qua, 'CHO_NGHIEM_THU');
  const thieuMc = danhGia(dong({ ...xong, kq_mo_ta: undefined }), { ...DG, cheDoXong: 'CHO_NGHIEM_THU' });
  assert.equal(thieuMc.ket_qua, 'GIAO'); assert.ok(thieuMc.canhBao.some((c) => c.includes('4 yếu tố')));
  const lech = danhGia(dong({ ...DU, can_bo: 'Đàm Văn Sơn' }), DG);
  assert.equal(lech.ket_qua, 'CHO_HOAN_THIEN'); assert.ok(lech.thieu.includes('can_bo'));
  const tuyChon = danhGia(dong({ ...DU, chat_luong: 'Khá' }), DG);
  assert.equal(tuyChon.ket_qua, 'GIAO'); assert.ok(tuyChon.canhBao.some((c) => c.includes('Chất lượng')));
  assert.equal(danhGia(dong({ ...DU, loai_thoi_han: 'Nhiệm vụ thường xuyên' }), DG).ket_qua, 'CHO_HOAN_THIEN');
});

test('v3.18: cột "Lãnh đạo giao" nhận nhóm (Lãnh đạo Văn phòng / Thường trực, bí danh, đuôi "(cả nhóm)", từ điển) → thay_mat_nhom; chuyên viên không khớp; đơn vị chủ trì ngoài Văn phòng → chờ hoàn thiện', () => {
  assert.deepEqual(chuanGiaTri('lanhDao', 'Lãnh đạo Văn phòng', CTX), { ma: 'nhom:LANH_DAO_VP', hien: 'Lãnh đạo Văn phòng (cả nhóm)', gan: 'ten' });
  assert.equal(chuanGiaTri('lanhDao', 'Thường trực Tỉnh ủy (cả nhóm)', CTX).ma, 'nhom:THUONG_TRUC'); assert.equal(chuanGiaTri('lanhDao', 'TT Tỉnh ủy', CTX).ma, 'nhom:THUONG_TRUC');
  assert.equal(chuanGiaTri('lanhDao', 'LĐVP', CTX).ma, 'nhom:LANH_DAO_VP');
  assert.equal(chuanGiaTri('lanhDao', 'Nông Thị Lan', CTX).ma, 'tp', 'vẫn khớp một lãnh đạo');
  assert.ok(chuanGiaTri('lanhDao', 'Lý Văn Phúc — Phòng Quản trị', CTX).loi, 'chuyên viên không phải lãnh đạo giao');
  const ctxTd = { ...CTX, tuDien: new Map([['can_bo', new Map([['lanh dao', 'nhom:LANH_DAO_VP']])]]) };
  assert.deepEqual(chuanGiaTri('lanhDao', 'Lãnh đạo', ctxTd), { ma: 'nhom:LANH_DAO_VP', hien: 'Lãnh đạo Văn phòng (cả nhóm)', gan: 'tu_dien' });
  // đánh giá: nhóm → du_lieu.thay_mat_nhom, thay_mat_cho null; người theo dõi không lấy nhóm làm mặc định
  const nhom = danhGia(dong({ ...DU, lanh_dao_giao: 'Lãnh đạo Văn phòng', don_vi: undefined, can_bo: undefined, theo_doi: undefined, noi_dung: 'Việc của Văn phòng' }), DG);
  assert.equal(nhom.du_lieu.thay_mat_nhom, 'LANH_DAO_VP'); assert.equal(nhom.du_lieu.thay_mat_cho, null);
  assert.equal(nhom.du_lieu.nguoi_theo_doi, 'qtkl', 'không có đơn vị: theo dõi = người nhập, không phải chuỗi nhóm');
  const nguoi = danhGia(dong(DU), DG); assert.equal(nguoi.du_lieu.thay_mat_cho, 'tp'); assert.equal(nguoi.du_lieu.thay_mat_nhom, null);
  // đơn vị ngoài Văn phòng (0079): bỏ giá trị, dòng chờ hoàn thiện, cảnh báo nói rõ cách ghi
  const ngoai = danhGia(dong({ ...DU, don_vi: 'Đảng ủy Ủy ban nhân dân tỉnh' }), DG);
  assert.equal(ngoai.ket_qua, 'CHO_HOAN_THIEN'); assert.ok(ngoai.thieu.includes('don_vi') && ngoai.loi.includes('don_vi'));
  assert.ok(ngoai.canhBao.some((c) => c.includes('ngoài Văn phòng')), ngoai.canhBao.join('; '));
  assert.equal(ngoai.du_lieu.owner_don_vi_ma ?? null, null); assert.equal(ngoai.du_lieu.thay_mat_cho, 'cvp', 'không còn đơn vị → lãnh đạo giao mặc định Chánh VP');
  // dữ liệu cũ đã xong ngoài hệ thống: giữ đơn vị ngoài (kl_nhap_da_xong vẫn nhận)
  const cu = danhGia(dong({ ...DU, don_vi: 'Đảng ủy Ủy ban nhân dân tỉnh', tien_do: 'Hoàn thành', kq_so_hieu: '12/BC', kq_ngay: '20/09/2026', kq_trich_yeu: 'Báo cáo', kq_mo_ta: 'Đã gửi' }), DG);
  assert.equal(cu.ket_qua, 'DA_XONG'); assert.equal(cu.du_lieu.owner_don_vi_ma, 'DANG_UY_UBND');
  // thay mặt Thường trực: Khẩn mặc định; chủ trì phải là lãnh đạo Văn phòng hoặc một phòng
  const ttPhong = danhGia(dong({ ...DU, lanh_dao_giao: 'Thường trực Tỉnh ủy' }), DG);
  assert.equal(ttPhong.ket_qua, 'GIAO'); assert.equal(ttPhong.du_lieu.thay_mat_nhom, 'THUONG_TRUC'); assert.equal(ttPhong.du_lieu.do_khan, 'KHAN');
  const ttCv = danhGia(dong({ ...DU, lanh_dao_giao: 'Thường trực Tỉnh ủy', can_bo: 'Lý Văn Phúc — Phòng Tổng hợp' }), DG);
  assert.equal(ttCv.ket_qua, 'CHO_HOAN_THIEN'); assert.ok(ttCv.thieu.includes('can_bo') && ttCv.canhBao.some((c) => c.includes('thay mặt Thường trực')), ttCv.canhBao.join('; '));
  const ttVp = danhGia(dong({ ...DU, lanh_dao_giao: 'Thường trực Tỉnh ủy', don_vi: 'Văn phòng Tỉnh ủy' }), DG);
  assert.equal(ttVp.ket_qua, 'CHO_HOAN_THIEN'); assert.ok(ttVp.thieu.includes('don_vi'));
  const ttCvp = danhGia(dong({ ...DU, lanh_dao_giao: 'TTTU', don_vi: 'Văn phòng Tỉnh ủy', can_bo: 'Hoàng Văn Bình' }), DG);
  assert.equal(ttCvp.ket_qua, 'GIAO'); assert.equal(ttCvp.du_lieu.owner_tai_khoan, 'cvp');
});

test('Đánh giá: ngành ↔ lĩnh vực suy ra nhau khi xác định; điền hàng loạt lĩnh vực theo ngành của từng dòng', () => {
  const coLv = danhGia(dong({ ...DU, nganh: undefined, linh_vuc: 'Tư pháp' }), DG);
  assert.equal(coLv.gt.nganh, 'NOI_CHINH'); assert.ok(coLv.macDinh.has('nganh')); assert.equal(coLv.ket_qua, 'GIAO');
  const motLv = danhGia(dong({ ...DU, nganh: '3. Nội chính - ANQP - Tư pháp', linh_vuc: undefined }), DG);
  assert.equal(motLv.gt.linh_vuc, 'LV_TP', 'ngành chỉ có một lĩnh vực'); assert.ok(motLv.macDinh.has('linh_vuc'));
  const hl = { linh_vuc: ['LV_DT', 'LV_TP'] };
  const kt = danhGia(dong({ ...DU, linh_vuc: undefined }), { ...DG, hangLoat: hl });
  assert.equal(kt.gt.linh_vuc, 'LV_DT'); assert.ok(kt.dienHL.has('linh_vuc')); assert.ok(!kt.macDinh.has('linh_vuc')); assert.equal(kt.ket_qua, 'GIAO');
  const chuaNganh = danhGia(dong({ ...DU, nganh: undefined, linh_vuc: undefined }), { ...DG, hangLoat: hl });
  assert.equal(chuaNganh.ket_qua, 'CHO_HOAN_THIEN', 'chưa có ngành, chọn nhiều lĩnh vực → không đoán');
  const mot = danhGia(dong({ ...DU, nganh: undefined, linh_vuc: undefined }), { ...DG, hangLoat: { linh_vuc: ['LV_TC'] } });
  assert.equal(mot.gt.linh_vuc, 'LV_TC'); assert.equal(mot.gt.nganh, 'KTTH'); assert.equal(mot.ket_qua, 'GIAO');
  const cn = danhGia(dong({ ma: 'nv-9', nganh: '3. Nội chính - ANQP - Tư pháp' }), { ...DG, hangLoat: hl });
  assert.equal(cn.du_lieu.linh_vuc_ma, null, 'cập nhật theo mã: không suy, không điền hàng loạt');
});

test('Đánh giá: mã đã có → CAP_NHAT chỉ ô có trong tệp (không mặc định, không điền hàng loạt); mã chưa có → việc mới kèm cảnh báo', () => {
  const cn = danhGia(dong({ ma: 'nv-9', san_pham: 'Tờ trình' }), { ...DG, hangLoat: { do_khan: 'KHAN' } });
  assert.equal(cn.ket_qua, 'CAP_NHAT'); assert.equal(cn.du_lieu.san_pham_loai, 'TO_TRINH'); assert.equal(cn.du_lieu.do_khan, null); assert.equal(cn.du_lieu.thay_mat_cho, null);
  const moi = danhGia(dong({ ...DU, ma: 'NV-12' }), DG);
  assert.equal(moi.ket_qua, 'GIAO'); assert.ok(moi.canhBao[0].includes('chưa có trên hệ thống'));
});

test('Mẫu nhập chuẩn: 3 sheet, 25 cột đúng thứ tự, danh sách chọn trỏ sheet Danh mục, tiêu đề tô theo mức; đọc lại tự nhận hồ sơ mẫu', async () => {
  const b = taoMauNhap({ ...CTX, findAccount: (id) => ACC.find((a) => a.id === id) },
    [{ ma: 'NV-9', van_ban_loai: 'KL_BTV', so_hoi_nghi: 45, so_ket_luan: '45-KL/TU', ngay_ban_hanh: '2026-08-01', noi_dung: 'Báo cáo quý', owner_tai_khoan: 'cv1',
      nguoi_theo_doi: 'tp', tao_boi: 'tp', do_khan: 'KHAN', tien_do_ma: 'DANG_THUC_HIEN', han_xu_ly: '2026-12-31' }]);
  const ds = await docXlsx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  assert.deepEqual(ds.map((x) => x.ten), ['Nhập liệu', 'Danh mục', 'Hướng dẫn']);
  assert.equal(TRUONG_MAU.length, 25); assert.deepEqual(ds[0].dong[0], TRUONG_MAU.map((t) => t.nhan));
  const r = ds[0].dong[1];
  assert.equal(r[0], 'NV-9'); assert.equal(r[1], 'Kết luận Hội nghị Ban Thường vụ'); assert.equal(r[7], 'Lý Văn Phúc — Phòng Tổng hợp');
  assert.equal(r[9], 'Nông Thị Lan — Phòng Tổng hợp', 'lãnh đạo giao = người tạo A2'); assert.equal(r[14], 'Khẩn'); assert.equal(r[11], '2026-12-31');
  assert.ok(ds[1].dong[0].includes('Lĩnh vực')); assert.ok(ds[1].dong.some((d) => d[2] === 'Đàm Văn Sơn — Phòng Quản trị'));
  assert.ok(!ds[1].dong.some((d) => (d[2] || '').startsWith('Hệ thống')), 'không đưa tài khoản hệ thống');
  const xml = new TextDecoder().decode(b); assert.match(xml, /<dataValidation type="list"[^>]*sqref="B2:B1001"><formula1>&apos;Danh mục&apos;!\$A\$2:\$A\$8<\/formula1>/);   // 0087: 7 loại văn bản (+ KL / NQ Ban Chấp hành)
  assert.match(xml, /<fgColor rgb="FFFFF6D6"\/>/);
  const sTieuDe = (c) => new RegExp(`<c r="${c}1" t="inlineStr" s="(\\d+)"`).exec(xml)?.[1];
  assert.deepEqual(['A', 'B', 'R', 'S', 'T', 'U', 'Y'].map(sTieuDe), ['7', '4', '4', '5', '5', '6', '6'], 'tiêu đề tô theo mức: mã xám, mức 1 vàng, mức 2 lam, mức 3 lục');
  const t = timTieuDe(ds); assert.equal(t.hoSo?.mau, 'CHUAN'); assert.equal(t.anhXa[0], 'ma'); assert.equal(t.anhXa[24], 'chat_luong');
  const kq = danhGia(chuanDong(layDong(ds[0], 0, t.anhXa)[0], CTX), { ...DG, maDaCo: new Set(['NV-9']) });
  assert.equal(kq.ket_qua, 'CAP_NHAT'); assert.equal(kq.du_lieu.owner_tai_khoan, 'cv1'); assert.equal(kq.du_lieu.do_khan, 'KHAN');
});
