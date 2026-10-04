// Thư viện nhỏ dựng hướng dẫn sử dụng (.docx) bằng docx-js: tiêu đề, đoạn, bước đánh số, ảnh có chú thích, hộp lưu ý, bảng.
// Font Times New Roman 13pt (quy ước văn bản hành chính), màu nhấn navy của ứng dụng.
import fs from 'node:fs';
import path from 'node:path';
import {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType,
  WidthType, ShadingType, BorderStyle, LevelFormat, PageBreak, TableOfContents, PageNumber, Footer, Header,
  VerticalAlign, TabStopType, TabStopPosition, LeaderType,
} from 'docx';

export const NAVY = '1F3A5F';
export const RED = 'B42318';
export const GRAY = '667085';
const FONT = 'Times New Roman';
const SZ = 26; // 13pt
const PAGE_W = 11906, PAGE_H = 16838; // A4 (DXA)
const MARGIN = 1134; // 2 cm
export const CONTENT_W = PAGE_W - 2 * MARGIN; // 9638

const run = (text, opt = {}) => new TextRun({ text, font: FONT, size: SZ, ...opt });

// Chuỗi có **đậm** → nhiều TextRun.
export function runs(text, base = {}) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).filter(Boolean);
  return parts.map((p) => (p.startsWith('**') ? run(p.slice(2, -2), { bold: true, ...base })
    : p.startsWith('*') && p.endsWith('*') && p.length > 2 ? run(p.slice(1, -1), { italics: true, ...base }) : run(p, base)));
}

export const p = (text, opt = {}) => new Paragraph({ children: runs(text), spacing: { after: 120, line: 300 }, alignment: AlignmentType.JUSTIFIED, ...opt });
export const pCenter = (text, opt = {}) => new Paragraph({ children: runs(text, opt), alignment: AlignmentType.CENTER, spacing: { after: 120 } });
export const h1 = (text, { ngat = true } = {}) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run(text, { bold: true, size: 32, color: NAVY })], spacing: { before: 360, after: 200 }, pageBreakBefore: ngat });
export const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [run(text, { bold: true, size: 28, color: NAVY })], spacing: { before: 280, after: 140 }, keepNext: true });
export const h3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [run(text, { bold: true, size: SZ, color: NAVY })], spacing: { before: 200, after: 100 }, keepNext: true });

// Danh sách bước (đánh số) và gạch đầu dòng — dùng numbering config bên dưới.
let soDanhSach = 0;   // mỗi danh sách bước là một instance riêng → đánh số lại từ 1
export const steps = (items) => { const inst = ++soDanhSach; return items.map((t) => new Paragraph({ children: runs(t), numbering: { reference: 'buoc', level: 0, instance: inst }, spacing: { after: 80, line: 300 } })); };
export const bullets = (items) => items.map((t) => new Paragraph({ children: runs(t), numbering: { reference: 'cham', level: 0 }, spacing: { after: 60, line: 300 } }));

// Ảnh chụp màn hình: co theo chiều rộng vùng nội dung (tối đa 16,5 cm), chú thích in nghiêng bên dưới.
export const thieuAnh = [];
export function anh(file, chuThich, { widthCm = 16.5, heightCm = 11 } = {}) {
  if (!fs.existsSync(file)) {
    thieuAnh.push(path.basename(file));
    return [new Paragraph({ children: [run(`[THIẾU ẢNH: ${path.basename(file)} — ${chuThich}]`, { italics: true, color: RED })], alignment: AlignmentType.CENTER, spacing: { before: 120, after: 200 } })];
  }
  const buf = fs.readFileSync(file);
  const dim = kichThuoc(buf);
  let w = Math.round(widthCm * 37.8);
  let h = Math.round(w * dim.h / dim.w);
  const maxH = Math.round(heightCm * 37.8);
  if (h > maxH) { h = maxH; w = Math.round(h * dim.w / dim.h); }
  const ext = path.extname(file).slice(1).toLowerCase();
  return [
    new Paragraph({ children: [new ImageRun({ data: buf, type: ext === 'jpg' ? 'jpg' : ext, transformation: { width: w, height: h } })], alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 }, keepNext: true }),
    new Paragraph({ children: [run(chuThich, { italics: true, size: 22, color: GRAY })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
  ];
}

// Đọc kích thước JPEG/PNG.
function kichThuoc(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return { w: 1536, h: 738 };
}

const border = (color = 'D0D5DD') => ({ style: BorderStyle.SINGLE, size: 4, color });
const borders = (color) => ({ top: border(color), bottom: border(color), left: border(color), right: border(color) });

// Hộp lưu ý: bảng một ô nền nhạt.
export function luuY(text, { nhan = 'Lưu ý', mau = 'FFF4E5', vien = 'F5B041' } = {}) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [CONTENT_W],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: CONTENT_W, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: mau, color: 'auto' }, borders: borders(vien),
      margins: { top: 100, bottom: 100, left: 160, right: 160 },
      children: [new Paragraph({ children: [run(`${nhan}: `, { bold: true }), ...runs(text)], spacing: { after: 0, line: 300 } })],
    })] })],
  });
}
export const khoangTrong = () => new Paragraph({ children: [run('')], spacing: { after: 60 } });

// Bảng chung: header đậm nền navy nhạt; widths theo tỉ lệ.
export function bang(header, rows, tiLe) {
  const tong = tiLe.reduce((a, b) => a + b, 0);
  const ws = tiLe.map((t) => Math.round(CONTENT_W * t / tong));
  ws[ws.length - 1] += CONTENT_W - ws.reduce((a, b) => a + b, 0);
  const cell = (text, w, { dau = false, nen } = {}) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders: borders(), verticalAlign: VerticalAlign.CENTER,
    shading: nen ? { type: ShadingType.CLEAR, fill: nen, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: String(text).split('\n').map((d) => new Paragraph({ children: runs(d, dau ? { bold: true, color: 'FFFFFF' } : {}), spacing: { after: 40, line: 276 } })),
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: ws,
    rows: [
      new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, ws[i], { dau: true, nen: NAVY })) }),
      ...rows.map((r, ri) => new TableRow({ children: r.map((c, i) => cell(c, ws[i], { nen: ri % 2 ? 'F7F9FC' : undefined })) })),
    ],
  });
}

export const ngatTrang = () => new Paragraph({ children: [new PageBreak()] });

export function taiLieu({ tieuDe, phienBan, sections }) {
  const doc = new Document({
    creator: 'Văn phòng Tỉnh ủy Cao Bằng',
    title: tieuDe,
    styles: {
      default: { document: { run: { font: FONT, size: SZ } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 32, bold: true, color: NAVY }, paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 28, bold: true, color: NAVY }, paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: SZ, bold: true, color: NAVY }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
      ],
    },
    numbering: {
      config: [
        { reference: 'buoc', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: 'Bước %1.', alignment: AlignmentType.LEFT, style: { run: { bold: true }, paragraph: { indent: { left: 1000, hanging: 1000 } } } }] },
        { reference: 'cham', levels: [{ level: 0, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
      ],
    },
    sections: sections.map((s, i) => ({
      properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } }, ...(s.properties || {}) },
      headers: i === 0 ? undefined : { default: new Header({ children: [new Paragraph({ children: [run(`${tieuDe} · ${phienBan}`, { size: 20, color: GRAY })], alignment: AlignmentType.RIGHT, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D0D5DD', space: 4 } } })] }) },
      footers: i === 0 ? undefined : { default: new Footer({ children: [new Paragraph({ children: [run('Trang ', { size: 20, color: GRAY }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20, color: GRAY })], alignment: AlignmentType.CENTER })] }) },
      children: s.children,
    })),
  });
  return Packer.toBuffer(doc);
}

export const mucLuc = () => new TableOfContents('Mục lục', { hyperlink: true, headingStyleRange: '1-2' });

// Mục lục tĩnh: tiêu đề cấp 1/2 + số trang (đọc từ PDF lượt 1), chấm dẫn bằng tab phải.
export function mucLucTinh(entries, soTrang) {
  return entries.map(({ cap, ten }) => new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W, leader: LeaderType.DOT }],
    indent: cap === 1 ? { left: 0 } : { left: 500 },
    spacing: { after: cap === 1 ? 80 : 40, before: cap === 1 ? 120 : 0 },
    children: [run(ten, cap === 1 ? { bold: true } : {}), run(`\t${soTrang[ten] ?? ''}`, cap === 1 ? { bold: true } : {})],
  }));
}
