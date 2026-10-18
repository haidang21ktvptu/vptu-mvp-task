// Phần đầu trang 1 của văn bản (v3.25 — đợt sửa gộp 18/10/2026): thông tin văn bản chỉ lấy ở đây, không lấy của văn bản được nhắc tới trong nội dung.
//  - số hiệu: dòng "Số …" đầu tiên (kể cả dính địa danh của cột bên phải, "Số:" xuống dòng); giữ chữ GỐC để điền (AI viết "998/KL-TU" → điền "998-KL/TU");
//  - ngày ban hành: dòng "<Địa danh>, ngày … tháng … năm …" đầu tiên;
//  - tên loại: dòng viết hoa đầu tiên bắt đầu bằng tên loại (KẾT LUẬN, THÔNG BÁO, NGHỊ QUYẾT…) + 3 dòng sau; cơ quan ban hành = cơ quan nhắc tới ĐẦU TIÊN
//    trong khối đó (Ban Chấp hành Trung ương / Bộ Chính trị / Ban Bí thư, Ban Chấp hành, Ban Thường vụ, Thường trực);
//  - số hội nghị: "hội nghị … lần thứ N" trong khối tên loại hoặc câu đầu của nội dung, cơ quan (nếu có) phải là cơ quan ban hành ("chuẩn bị Hội nghị Ban
//    Chấp hành … lần thứ 15" trong kết luận của Ban Thường vụ không tính); công văn (không có tên loại) không đối chiếu số hội nghị;
//  - hetDau: hết phần đầu (số, ngày, tên loại + 2 dòng, V/v, "Kính gửi" tới hết câu) — rà soát sót bỏ qua; dauTy: chỗ trích yếu có thể bắt đầu.
// Thuần — unit test frontend/tests/tro-ly-ai-doi-chieu.test.mjs.
import { boDau } from './chuan-hoa.js';

export const DIA_DANH = /\p{Lu}\p{Ll}+(?:\s+\p{Lu}\p{Ll}+){0,3}\s*,\s*[Nn]gay\s*(\d{1,2})\s*thang\s*(\d{1,2})\s*nam\s*(\d{4})/u;
const SO = /(?:^|[^\p{Ll}\p{N}])S[oO]\s*[:.]?\s*(\d{1,5}(?:\s*[-–—/.]\s*[A-Za-z0-9]{1,16}){1,3})/du;
const TEN_LOAI = /^(KETLUAN|THONGBAO|NGHIQUYET|CHITHI|QUYETDINH|KEHOACH|CHUONGTRINH|BAOCAO|TOTRINH|HUONGDAN|QUYDINH|CONGVAN)/;
const CO_QUAN = [['TW', /ban chap hanh trung uong|bo chinh tri|ban bi thu/], ['BCH', /ban chap hanh/], ['BTV', /ban thuong vu|\bbtv\b/], ['TT', /thuong truc/]];
// Cơ quan nhắc tới đầu tiên trong chuỗi (bỏ dấu, chữ thường) → 'TW' | 'BCH' | 'BTV' | 'TT' | null.
export function coQuanDau(t) {
  let tot = null;
  for (const [ma, r] of CO_QUAN) { const m = r.exec(t); if (m && (!tot || m.index < tot.i)) tot = { ma, i: m.index }; }
  return tot?.ma || null;
}

export function docDau(goc) {
  const ds = goc.trang1.split('\n'); const bd = ds.map((d) => boDau(d)); let cuoiDau = -1;
  const ket = (k) => ds.slice(0, k + 1).join('\n').length; const dauDong = (k) => (k > 0 ? ket(k - 1) + 1 : 0);
  const kq = { soHieu: null, ngay: null, tieuDe: null, soHoiNghi: null, soHoiNghiDong: '', coVv: bd.some((d) => /^\s*V\/v\b|^\s*Kinh gui\b/i.test(d)), hetDau: 0, dauTy: null };
  for (let i = 0; i < ds.length && !kq.soHieu; i++) {
    const p = DIA_DANH.exec(bd[i]); let d = p ? bd[i].slice(0, p.index) : bd[i]; let g = ds[i].slice(0, d.length);
    let canh = bd[i].length === ds[i].length;   // chữ NFC bỏ dấu giữ độ dài → vị trí trong chữ bỏ dấu = vị trí trong chữ gốc
    if (/(?:^|[^\p{Ll}\p{N}])S[oO]\s*[:.]?\s*$/u.test(d) && i + 1 < ds.length) {
      d = `${d} ${bd[i + 1]}`; g = `${g} ${ds[i + 1]}`; canh = canh && bd[i + 1].length === ds[i + 1].length;
    }
    const m = SO.exec(d);
    if (m) {   // giữ chữ gốc (có Đ) để điền; lệch độ dài thì dùng chữ bỏ dấu
      const [s, e] = m.indices[1]; const sach = (x) => x.replace(/\s+/g, '').replace(/[–—]/g, '-');
      kq.soHieu = { ma: sach(m[1]), goc: sach(canh ? g.slice(s, e) : m[1]), dong: ds[i] }; cuoiDau = Math.max(cuoiDau, i);
    }
  }
  for (let i = 0; i < ds.length && !kq.ngay; i++) {
    let m = DIA_DANH.exec(bd[i]); let dong = ds[i];
    if (!m && i + 1 < ds.length && !DIA_DANH.exec(bd[i + 1])) { m = DIA_DANH.exec(`${bd[i]} ${bd[i + 1]}`); dong = `${ds[i]} ${ds[i + 1]}`; }
    if (m) { kq.ngay = { d: +m[1], m: +m[2], y: +m[3], dong }; cuoiDau = Math.max(cuoiDau, i); }
  }
  const i = ds.findIndex((d, k) => d === d.toLocaleUpperCase('vi') && TEN_LOAI.test(bd[k].replace(/\s+/g, '')));
  if (i >= 0) {
    const khoi = bd.slice(i, i + 4).join(' ').toLowerCase();
    kq.tieuDe = { tu: TEN_LOAI.exec(bd[i].replace(/\s+/g, ''))[1], chu: ds.slice(i, i + 4).join('\n'), khoi, coQuan: coQuanDau(khoi) };
    cuoiDau = Math.max(cuoiDau, i + 2); kq.dauTy = dauDong(i);
  }
  const vv = bd.findIndex((d) => /^\s*V\/v\b/i.test(d));
  if (vv >= 0) { cuoiDau = Math.max(cuoiDau, vv); if (kq.dauTy === null) kq.dauTy = dauDong(vv); }
  let kg = bd.findIndex((d) => /^\s*Kinh gui\b/i.test(d));
  if (kg >= 0) { while (kg + 1 < ds.length && !/[.;:]\s*$/.test(ds[kg])) kg += 1; cuoiDau = Math.max(cuoiDau, kg); }
  if (cuoiDau >= 0) kq.hetDau = ket(Math.min(cuoiDau, ds.length - 1));
  if (kq.tieuDe) {   // số hội nghị: khối tên loại, rồi câu đầu của nội dung
    const cauDau = bd.slice(cuoiDau + 1).join(' ').toLowerCase().split(/\.\s/)[0] || '';
    const m = hoiNghi(kq.tieuDe.khoi.replace(/\s+/g, ' '), kq.tieuDe.coQuan, false) || hoiNghi(cauDau.replace(/\s+/g, ' '), kq.tieuDe.coQuan, true);
    if (m) {
      kq.soHoiNghi = Number(m[2]);
      const k = bd.findIndex((d) => new RegExp(`(?:lan thu|thu)\\s*${m[2]}(?!\\d)`).test(d.toLowerCase()));
      kq.soHoiNghiDong = k >= 0 ? ds.slice(Math.max(0, k - 1), k + 1).join('\n') : kq.tieuDe.chu;
    }
  }
  return kq;
}
// "hội nghị … lần thứ N …": cơ quan nêu giữa "hội nghị" và số, hoặc ngay sau số (tới dấu phẩy), nếu có, phải là cơ quan ban hành ("chuẩn bị Hội nghị Ban
// Chấp hành … lần thứ 15", "Hội nghị lần thứ 10 Ban Chấp hành Trung ương" trong kết luận của Ban Thường vụ không tính); ở câu nội dung: bỏ hội nghị được
// nhắc tới ("Thực hiện Nghị quyết Hội nghị lần thứ 10 …").
const HN = /hoi nghi([^.;]{0,80}?)(?:lan thu|thu)\s*(\d{1,4})(?!\d)([^,.;]{0,40})/g;
const THAM_CHIEU = /(?:thuc hien|trien khai|chuan bi|nghi quyet|ket luan|chi thi|quy dinh|theo|tinh than)\s*$/;
function hoiNghi(vung, coQuan, laCau) {
  for (const m of vung.matchAll(HN)) {
    const cq = coQuanDau(m[1]) || coQuanDau(m[3]);
    if (cq && cq !== coQuan) continue;
    if (laCau && THAM_CHIEU.test(vung.slice(Math.max(0, m.index - 30), m.index))) continue;
    return m;
  }
  return null;
}

// Trích yếu AI chép thiếu phần cuối (cùng dòng, hoặc dòng sau bắt đầu bằng chữ thường / chữ số — câu trích yếu xuống dòng) → mở rộng tới hết trích yếu
// trong phần đầu (tối đa 2 dòng sau), cắt trước "<Địa danh>, ngày …" nếu dính. → vị trí kết thúc mới trong chữ gốc.
export function hetTrichYeu(goc, dau, b) {
  const t = goc.text;
  const cuoiDong = (x) => { const n = t.indexOf('\n', x); const h = n < 0 ? t.length : n; const p = DIA_DANH.exec(boDau(t.slice(x, h))); return p ? x + p.index : h; };
  let het = b; const conDong = t.slice(het, cuoiDong(het));
  if (/^ [\p{Ll}\p{N}]/u.test(conDong)) het += conDong.trimEnd().length;
  for (let n = 0; n < 2 && t[het] === '\n' && het + 1 < dau.hetDau && /^[\p{Ll}\p{N}]/u.test(t.slice(het + 1, het + 2)); n++) het = cuoiDong(het + 1);
  return het;
}
