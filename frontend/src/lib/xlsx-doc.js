// Đọc tệp .xlsx trong trình duyệt, không cần thư viện (v9 đợt 2 — nhập Excel): gói ZIP đọc theo thư mục trung tâm, phần nén DEFLATE giải bằng
// DecompressionStream('deflate-raw') có sẵn của trình duyệt (STORE đọc thẳng); XML SpreadsheetML đọc bằng biểu thức chính quy (định dạng máy sinh,
// ổn định; tiền tố không gian tên như "x:" bị bỏ trước khi đọc). Mỗi sheet → ma trận ô theo dòng/cột của Excel (chỉ số từ 0): chuỗi, số, hoặc ngày
// 'YYYY-MM-DD' (ô số có định dạng ngày — định dạng chỉ giờ không tính); ô gộp chép giá trị góc trên-trái XUỐNG các dòng của vùng (văn bản gộp nhiều
// dòng việc), không chép sang cột bên; ô công thức lấy giá trị đã tính sẵn trong tệp; ô lỗi (#N/A…) coi là trống; mã _xHHHH_ của Excel giải thành ký
// tự. Lỗi cấu trúc lạ → một thông báo tiếng Việt. Module chỉ nạp khi người dùng chọn tệp (import() động).

const dec = new TextDecoder();
export const TOI_DA_BYTE = 15 * 1024 * 1024;
const LOI_CHUNG = 'Không đọc được tệp .xlsx này — mở bằng Excel rồi "Lưu thành" Excel Workbook (.xlsx) và chọn lại.';
const loi = (m) => Object.assign(new Error(m), { cuaTa: true });

function docZip(buf) {
  const b = new Uint8Array(buf); const dv = new DataView(buf);
  let e = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw loi('Tệp không phải .xlsx hợp lệ (không đọc được cấu trúc nén). Mở bằng Excel rồi "Lưu thành" .xlsx.');
  const n = dv.getUint16(e + 10, true); let o = dv.getUint32(e + 16, true);
  const tep = new Map();
  for (let k = 0; k < n; k++) {
    if (o + 46 > b.length || dv.getUint32(o, true) !== 0x02014b50) throw loi('Tệp .xlsx bị hỏng (thư mục nén không đọc được).');
    const nTen = dv.getUint16(o + 28, true);
    tep.set(dec.decode(b.subarray(o + 46, o + 46 + nTen)), { kieu: dv.getUint16(o + 10, true), coNen: dv.getUint32(o + 20, true), viTri: dv.getUint32(o + 42, true) });
    o += 46 + nTen + dv.getUint16(o + 30, true) + dv.getUint16(o + 32, true);
  }
  return { b, dv, tep };
}
const boTienTo = (xml) => xml.replace(/<(\/?)[A-Za-z_][\w.-]*:(?=[A-Za-z_])/g, '<$1');   // <x:row> → <row>; thuộc tính (r:id) giữ nguyên
async function layTep(z, ten) {
  const t = z.tep.get(ten.replace(/^\//, ''));
  if (!t) return null;
  const dau = t.viTri + 30 + z.dv.getUint16(t.viTri + 26, true) + z.dv.getUint16(t.viTri + 28, true);
  const du = z.b.subarray(dau, dau + t.coNen);
  if (t.kieu === 0) return boTienTo(dec.decode(du));
  if (t.kieu !== 8) throw loi('Tệp .xlsx dùng kiểu nén lạ — mở bằng Excel rồi lưu lại.');
  const luong = new Blob([du]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return boTienTo(dec.decode(await new Response(luong).arrayBuffer()));
}

const THAY = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' };
export const boXml = (s) => String(s).replace(/&(lt|gt|quot|apos|amp|#x[0-9a-f]+|#\d+);/gi, (m, e) => THAY[e.toLowerCase()]
  ?? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)));
const boMaX = (s) => s.replace(/_x([0-9A-Fa-f]{4})_/g, (m, h) => String.fromCharCode(parseInt(h, 16)));   // _x000D_ → \r; _x005F_ → _
const thuocTinh = (s, ten) => { const m = new RegExp(`(?:^|\\s)${ten}="([^"]*)"`).exec(s); return m ? boXml(m[1]) : null; };
// Chữ của một <si> / <is>: nối mọi <t>, bỏ phần phiên âm <rPh>.
const chuCua = (xml) => boMaX([...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').replace(/<t\b[^>]*\/>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
  .map((m) => boXml(m[1])).join(''));   // <t/> rỗng bỏ trước khi ghép

// Mã định dạng số kiểu ngày: id có sẵn 14–17, 22, 27–36, 50–58 (18–21, 45–47 là giờ); mã tự đặt có d / y ngoài phần trong ngoặc kép / ngoặc vuông
// (h:mm, mm:ss, [h]:mm:ss, h:mm AM/PM là giờ — không đổi thành ngày).
const ID_NGAY = new Set([14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 50, 51, 52, 53, 54, 55, 56, 57, 58]);
function kieuNgay(stylesXml) {
  if (!stylesXml) return [];
  const tuDat = new Map([...stylesXml.matchAll(/<numFmt\b([^>]*)\/?>/g)].map((m) => [Number(thuocTinh(m[1], 'numFmtId')), thuocTinh(m[1], 'formatCode') || '']));
  const xfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] || '';
  return [...xfs.matchAll(/<xf\b([^>]*?)(?:\/>|>)/g)].map((m) => {
    const id = Number(thuocTinh(m[1], 'numFmtId') || 0);
    if (ID_NGAY.has(id)) return true;
    const ma = (tuDat.get(id) || '').replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
    return /[dy]/i.test(ma);
  });
}
const pad = (n) => String(n).padStart(2, '0');
export function ngayTuSo(n, he1904 = false) {
  const d = new Date(Math.round((Math.floor(n) + (he1904 ? 1462 : 0) - 25569) * 86400) * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
const cotSo = (chu) => [...chu].reduce((s, c) => s * 26 + c.charCodeAt(0) - 64, 0) - 1;
const oRef = (ref) => { const m = /^([A-Z]+)(\d+)$/.exec(ref || ''); return m ? [Number(m[2]) - 1, cotSo(m[1])] : null; };

function docSheet(xml, chuoi, ngay, he1904) {
  const dong = []; let r0 = -1;
  for (const r of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rn = Number(thuocTinh(r[1], 'r')); r0 = rn > 0 ? rn - 1 : r0 + 1;   // dòng thiếu thuộc tính r: dòng kế tiếp
    if (!r[2]) continue;
    let c0 = -1;
    for (const c of r[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const vt = oRef(thuocTinh(c[1], 'r')) || [r0, c0 + 1]; c0 = vt[1];   // ô thiếu thuộc tính r: cột kế tiếp
      if (!c[2]) continue;
      const t = thuocTinh(c[1], 't'); const v = /<v>([\s\S]*?)<\/v>/.exec(c[2])?.[1];
      let gt = null;
      if (t === 's') gt = chuoi[Number(v)] ?? null;
      else if (t === 'inlineStr') gt = chuCua(c[2]);
      else if (t === 'str' || t === 'd') gt = v === undefined ? null : boMaX(boXml(v));
      else if (t === 'b') gt = v === '1' ? 'TRUE' : 'FALSE';
      else if (t !== 'e' && v !== undefined && v !== '') {
        const so = Number(v);
        gt = ngay[Number(thuocTinh(c[1], 's') || 0)] && so >= 1 && so < 2958466 ? ngayTuSo(so, he1904) : so;   // 0 / số âm định dạng ngày: giữ số
      }
      if (gt === null || gt === '') continue;
      (dong[vt[0]] ||= [])[vt[1]] = gt;
    }
  }
  for (const m of xml.matchAll(/<mergeCell\b[^>]*\bref="([A-Z]+\d+):([A-Z]+\d+)"/g)) {   // ô gộp: chép giá trị góc trên-trái xuống các dòng, cùng cột
    const [a, b] = [oRef(m[1]), oRef(m[2])]; const gt = dong[a[0]]?.[a[1]];
    if (gt === undefined || b[0] - a[0] > 5000) continue;
    for (let i = a[0] + 1; i <= b[0]; i++) (dong[i] ||= [])[a[1]] = gt;
  }
  return Array.from(dong, (d) => Array.from(d || [], (x) => (x === undefined ? null : x)));
}

// buf: ArrayBuffer của tệp → [{ ten, an, dong: [[ô…]] }] theo thứ tự sheet trong tệp.
export async function docXlsx(buf) {
  if (buf.byteLength > TOI_DA_BYTE) throw loi('Tệp lớn hơn 15 MB — tách bớt sheet / dòng rồi nhập.');
  try {
    const z = docZip(buf);
    const wb = await layTep(z, 'xl/workbook.xml');
    if (!wb) throw loi('Tệp không có bảng tính Excel (thiếu xl/workbook.xml).');
    const rels = [...(await layTep(z, 'xl/_rels/workbook.xml.rels') || '').matchAll(/<Relationship\b([^>]*)\/?>/g)]
      .map((m) => ({ id: thuocTinh(m[1], 'Id'), loai: thuocTinh(m[1], 'Type') || '', dich: thuocTinh(m[1], 'Target') || '' }));
    const duong = (d) => (d.startsWith('/') ? d : `xl/${d}`);
    const theoLoai = (duoi, macDinh) => duong(rels.find((x) => x.loai.endsWith(duoi))?.dich || macDinh);
    const ss = await layTep(z, theoLoai('/sharedStrings', 'sharedStrings.xml'));
    const chuoi = ss ? [...ss.matchAll(/<si\b[^>]*\/>|<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => (m[1] ? chuCua(m[1]) : '')) : [];   // cả <si/>, <si />
    const ngay = kieuNgay(await layTep(z, theoLoai('/styles', 'styles.xml')));
    const he1904 = /<workbookPr\b[^>]*date1904="(1|true)"/.test(wb);
    const ds = [];
    for (const m of wb.matchAll(/<sheet\b([^>]*)\/?>/g)) {
      const dd = rels.find((x) => x.id === thuocTinh(m[1], 'r:id'))?.dich || '';
      const xml = dd ? await layTep(z, duong(dd)) : null;
      ds.push({ ten: thuocTinh(m[1], 'name') || `Sheet${ds.length + 1}`, an: ['hidden', 'veryHidden'].includes(thuocTinh(m[1], 'state')),
        dong: xml ? docSheet(xml, chuoi, ngay, he1904) : [] });
    }
    return ds;
  } catch (e) { throw e.cuaTa ? e : loi(LOI_CHUNG); }
}
