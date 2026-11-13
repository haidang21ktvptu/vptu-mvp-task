// Phân hệ Nhiệm vụ quý BTV: ghi tệp Word .docx trong trình duyệt, không thư viện (gói ZIP của lib/xlsx.js) — đủ cho báo cáo của Văn phòng theo thể
// thức mẫu báo cáo (BC) của Văn phòng Tỉnh ủy Cao Bằng (đo từ VPTU_Template_BC.docx, 11/2026): A4, lề trên / dưới 20 mm, trái 30 mm, phải 15 mm; Times
// New Roman; phần đầu bảng không viền 97,5 / 80 mm lùi trái 12,5 mm; "BÁO CÁO" 15 đậm, trích yếu 14 đậm, "-----"; nội dung cỡ 15, căn đều, thụt 1 cm,
// giãn dòng chính xác 20pt, trước 6pt; một dòng trống trước khối ký (trước 6pt, chính xác 19pt); khối ký 82,4 / 87 mm, 06 dòng trống (chính xác 17pt)
// giữa chức vụ và họ tên; số trang giữa, trên, cỡ 14, từ trang 2. Phụ lục: mục mới khổ ngang, bảng có viền, cỡ 12. Đơn vị twip (1 mm ≈ 56,7; 1 pt = 20).
import { zip, xmlChu } from '../xlsx.js';

const enc = new TextEncoder();
const FONT = 'Times New Roman';
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
export const BC = {
  le: '<w:pgMar w:top="1134" w:right="851" w:bottom="1134" w:left="1701" w:header="567" w:footer="0" w:gutter="0"/>',
  leNgang: '<w:pgMar w:top="1134" w:right="851" w:bottom="1134" w:left="1134" w:header="567" w:footer="0" w:gutter="0"/>',
  than: { sz: 15, line: 400, before: 120, after: 0, firstLine: 567 },
};

// Một đoạn chữ: text là chuỗi hoặc [{ t, b, i, u, sz }]; xuống dòng trong chuỗi → ngắt dòng mềm.
export function runs(text, o = {}) {
  const ds = Array.isArray(text) ? text : [{ t: text }];
  return ds.map((s) => {
    const sz = 2 * (s.sz || o.sz || BC.than.sz);
    const pr = `<w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>${(s.b ?? o.b) ? '<w:b/>' : ''}${(s.i ?? o.i) ? '<w:i/>' : ''}`
      + `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${(s.u ?? o.u) ? '<w:u w:val="single"/>' : ''}</w:rPr>`;   // thứ tự phần tử theo lược đồ OOXML
    return String(s.t ?? '').split('\n').map((dong, k) => `<w:r>${pr}${k ? '<w:br/>' : ''}<w:t xml:space="preserve">${xmlChu(dong)}</w:t></w:r>`).join('');
  }).join('');
}
const giua = (line, rule) => `w:line="${line}" w:lineRule="${rule}"`;
const DON = giua(240, 'auto');
// Đoạn nội dung (thân báo cáo).
export function p(text, o = {}) {
  const al = o.align || 'both';
  const ind = o.noIndent ? '' : `<w:ind w:firstLine="${o.firstLine ?? BC.than.firstLine}"/>`;
  return `<w:p><w:pPr>${o.keepNext ? '<w:keepNext/>' : ''}${o.keepLines ? '<w:keepLines/>' : ''}<w:spacing w:before="${o.before ?? BC.than.before}" `
    + `w:after="${o.after ?? BC.than.after}" ${giua(o.line ?? BC.than.line, 'exact')}/>${ind}<w:jc w:val="${al}"/></w:pPr>${runs(text, o)}</w:p>`;
}
// Dòng căn giữa, giãn đơn (phần đầu, tiêu đề, khối ký).
export function c(text, o = {}) {
  return `<w:p><w:pPr>${o.keepNext ?? true ? '<w:keepNext/>' : ''}<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 0}" ${o.line ? giua(o.line, o.rule || 'exact') : DON}/>`
    + `<w:jc w:val="${o.align || 'center'}"/></w:pPr>${runs(text, { sz: 14, ...o })}</w:p>`;
}
export function dongTrong(o = {}) {
  return `<w:p><w:pPr>${o.keepNext ?? true ? '<w:keepNext/>' : ''}<w:spacing w:before="${o.before ?? 0}" w:after="0" ${giua(o.line ?? 240, o.rule ?? 'auto')}/></w:pPr>`
    + `<w:r><w:rPr><w:sz w:val="${2 * (o.sz || 14)}"/></w:rPr><w:t></w:t></w:r></w:p>`;
}
const VIEN0 = '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>';
const VIEN1 = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((k) => `<w:${k} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('') + '</w:tblBorders>';
// Ô bảng: children là chuỗi XML các đoạn; o: { span, nen (màu nền hex), le (lề trái / phải ô, twip) }.
export function o(children, w, op = {}) {
  const le = op.le ?? 108;
  return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${op.span > 1 ? `<w:gridSpan w:val="${op.span}"/>` : ''}${op.nen ? `<w:shd w:val="clear" w:color="auto" w:fill="${op.nen}"/>` : ''}`
    + `<w:tcMar><w:left w:w="${le}" w:type="dxa"/><w:right w:w="${le}" w:type="dxa"/></w:tcMar><w:vAlign w:val="${op.vAlign || 'top'}"/></w:tcPr>`
    + `${children || '<w:p/>'}</w:tc>`;
}
// Bảng: cot = độ rộng cột (twip), hang = [[ô XML]]; vien: có viền (phụ lục); lui: lùi trái; tieuDe: số hàng đầu lặp lại khi sang trang.
export function bang(cot, hang, { vien = false, lui = 0, tieuDe = 0 } = {}) {
  const rong = cot.reduce((a, b) => a + b, 0);
  return `<w:tbl><w:tblPr><w:tblW w:w="${rong}" w:type="dxa"/>${lui ? `<w:tblInd w:w="${lui}" w:type="dxa"/>` : ''}${vien ? VIEN1 : VIEN0}<w:tblLayout w:type="fixed"/>`
    + '<w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr>'
    + `<w:tblGrid>${cot.map((x) => `<w:gridCol w:w="${x}"/>`).join('')}</w:tblGrid>`
    + hang.map((h, i) => `<w:tr><w:trPr><w:cantSplit/>${i < tieuDe ? '<w:tblHeader/>' : ''}</w:trPr>${h.join('')}</w:tr>`).join('') + '</w:tbl>';
}

// Phần đầu báo cáo: TỈNH ỦY CAO BẰNG / VĂN PHÒNG / * / Số …-BC/VPTU — ĐẢNG CỘNG SẢN VIỆT NAM / ngày tháng.
export function phanDau({ capTren = 'TỈNH ỦY CAO BẰNG', coQuan = 'VĂN PHÒNG', so = 'Số        -BC/VPTU', ngay }) {
  const K = [5529, 4535];
  const trai = [c(capTren), c([{ t: coQuan, b: true }]), c('*'), c(so)].join('');
  const phai = [c([{ t: 'ĐẢNG CỘNG SẢN VIỆT NAM', b: true, u: true, sz: 15 }]), dongTrong({ line: 320, rule: 'exact' }), c([{ t: ngay, i: true }]), dongTrong()].join('');
  return bang(K, [[o(trai, K[0], { le: 0 }), o(phai, K[1], { le: 0 })]], { lui: -709 });
}
export function tieuDe(dongTrichYeu) {
  return [dongTrong({ before: 186 }), c([{ t: 'BÁO CÁO', b: true, sz: 15 }]), ...dongTrichYeu.map((t) => c([{ t, b: true }])), c('-----'), dongTrong()].join('');
}
export const khoangTruocKy = () => dongTrong({ before: 120, line: 380, rule: 'exact' });
export function phanKy({ noiNhan = [], quyenHan = '', chucVu = 'CHÁNH VĂN PHÒNG', hoTen = '' }) {
  const K = [4673, 4933];
  const trai = [`<w:p><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="0" ${DON}/></w:pPr>${runs([{ t: 'Nơi nhận:', u: true, sz: 14 }])}</w:p>`,
    ...noiNhan.map((x) => `<w:p><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="0" ${DON}/></w:pPr>${runs(x, { sz: 12 })}</w:p>`)].join('');
  const phai = [quyenHan ? c([{ t: quyenHan, b: true }]) : '', c([{ t: chucVu, b: !quyenHan }]),
    ...Array.from({ length: 6 }, () => dongTrong({ line: 340, rule: 'exact' })), c([{ t: hoTen || ' ', b: true }], { keepNext: false })].join('');
  return bang(K, [[o(trai, K[0]), o(phai, K[1])]]);
}

const sectDoc = (header) => `<w:sectPr>${header}<w:pgSz w:w="11906" w:h="16838"/>${BC.le}<w:titlePg/></w:sectPr>`;
const sectNgang = (header) => `<w:sectPr>${header}<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>${BC.leNgang}</w:sectPr>`;
// than, phuLuc: chuỗi XML các khối. Có phụ lục → mục khổ ngang sau thân (trang mới).
export function taoDocx({ than, phuLuc = '', tieuDe: ten = 'Báo cáo' }) {
  const hd = '<w:headerReference w:type="default" r:id="rIdH1"/><w:headerReference w:type="first" r:id="rIdH2"/>';
  const body = phuLuc
    ? `${than}<w:p><w:pPr>${sectDoc(hd)}</w:pPr></w:p>${phuLuc}${sectNgang('<w:headerReference w:type="default" r:id="rIdH1"/>')}`
    : `${than}${sectDoc(hd)}`;
  const tep = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
      + '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
      + '<Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
      + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'],
    ['docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
      + `xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xmlChu(ten)}</dc:title><dc:creator>Văn phòng Tỉnh ủy Cao Bằng</dc:creator></cp:coreProperties>`],
    ['word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      + '<Relationship Id="rIdH1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>'
      + '<Relationship Id="rIdH2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/></Relationships>'],
    ['word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr>`
      + `<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:eastAsia="${FONT}" w:cs="${FONT}"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault>`
      + '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
      + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>'],
    ['word/header1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${W}><w:p><w:pPr><w:jc w:val="center"/></w:pPr>`
      + `<w:r><w:rPr><w:sz w:val="28"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="28"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>`
      + '<w:r><w:rPr><w:sz w:val="28"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:sz w:val="28"/></w:rPr><w:t>2</w:t></w:r>'
      + '<w:r><w:rPr><w:sz w:val="28"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:hdr>'],
    ['word/header2.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${W}><w:p/></w:hdr>`],
    ['word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${W}><w:body>${body}</w:body></w:document>`],
  ];
  return zip(tep.map(([t, x]) => ({ ten: t, du: enc.encode(x) })));
}
export const KIEU_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
