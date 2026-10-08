// Đợt D v3.20 (0089–0090): đoán số hiệu, ngày, trích yếu của văn bản kết quả từ chữ trang đầu (PDF có lớp chữ — lib/kl/doc-pdf.js) hoặc từ tên
// tệp — chỉ để GỢI Ý điền các ô còn trống của hộp Nộp minh chứng; người nộp kiểm tra, sửa trước khi nộp (hàm nop_minh_chung là chốt).
// Hàm thuần (không DOM, không mạng) — unit test frontend/tests/doc-van-ban.test.mjs. Nhận cả chữ không dấu (font PDF mất dấu).

// Viết tắt tên loại văn bản (Quy định 66-QĐ/TW, Nghị định 30) — chuẩn hoá chữ hoa / thường.
const LOAI = ['BC', 'CV', 'TTr', 'KH', 'TB', 'QĐ', 'NQ', 'KL', 'CT', 'HD', 'ĐA', 'CTr', 'BB', 'GM', 'QC', 'QyĐ', 'TT', 'HĐ', 'PA', 'TL'];
const CHUAN = new Map(LOAI.map((l) => [l.toUpperCase(), l]).concat([['QD', 'QĐ'], ['DA', 'ĐA'], ['QYD', 'QyĐ'], ['HDD', 'HĐ']]));
const LOAI_RE = '(?:TTr|CTr|QyĐ|QĐ|ĐA|HĐ|BC|CV|KH|TB|QD|NQ|KL|CT|HD|DA|BB|GM|QC|TT|PA|TL)';
const bo = (s) => String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim();
const chuanLoai = (l) => CHUAN.get(l.toUpperCase()) || l;

// "Số 15-BC/VPTU", "Số: 1400-CV/VPTU", "Số 12/BC-VPTU", "So 05-TTr/VPTU" → "15-BC/VPTU"…
export function tachSoHieu(chu) {
  const m = bo(chu).match(/\bS[ốôo]\s*[:.]?\s*(\d{1,5}\s*[-/]\s*[A-Za-zĐđ]{1,5}(?:\s*[-/]\s*[A-Za-zĐđ0-9]{1,12}){0,2})/u);
  return m ? m[1].replace(/\s+/g, '') : '';
}

// "Cao Bằng, ngày 05 tháng 10 năm 2026" (hoặc không dấu) → "2026-10-05"; ngày không có thật → ''.
export function tachNgay(chu) {
  const m = bo(chu).match(/ng[àa]y\s+(\d{1,2})\s+th[áa]ng\s+(\d{1,2})\s+n[ăa]m\s+(\d{4})/iu);
  if (!m) return '';
  const [d, th, n] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(n, th - 1, d));
  if (n < 2000 || dt.getUTCMonth() !== th - 1 || dt.getUTCDate() !== d) return '';
  return `${n}-${String(th).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const TEN_LOAI = ['BÁO CÁO', 'TỜ TRÌNH', 'KẾ HOẠCH', 'THÔNG BÁO', 'QUYẾT ĐỊNH', 'NGHỊ QUYẾT', 'KẾT LUẬN', 'CHỈ THỊ', 'HƯỚNG DẪN', 'CHƯƠNG TRÌNH',
  'ĐỀ ÁN', 'QUY CHẾ', 'QUY ĐỊNH', 'CÔNG VĂN', 'PHƯƠNG ÁN', 'BIÊN BẢN', 'BAO CAO', 'TO TRINH', 'KE HOACH', 'THONG BAO', 'QUYET DINH'];
const DUNG = /^(-{2,}|_{2,}|\*|Kính gửi|Kinh gui|Căn cứ|Can cu|Thực hiện|Thuc hien|Sau khi|Ngày|Số\s|Nơi nhận)/iu;
const hoaDau = (s) => (s ? s.charAt(0).toLocaleUpperCase('vi') + s.slice(1) : s);

// Trích yếu: dòng "V/v …" (công văn); hoặc dòng tên loại viết hoa (BÁO CÁO, TỜ TRÌNH…) + tối đa 3 dòng sau → "Báo cáo kết quả …".
export function tachTrichYeu(chu) {
  const dong = String(chu || '').normalize('NFC').split(/\r?\n/).map((s) => bo(s)).filter(Boolean);
  for (const d of dong) {
    const v = d.match(/^(?:V\/v|Về việc|Ve viec)\s*[:.]?\s*(.+)$/iu);
    if (v) return hoaDau(v[1]).slice(0, 300);
  }
  const i = dong.findIndex((d) => TEN_LOAI.includes(d.toLocaleUpperCase('vi')) && d === d.toLocaleUpperCase('vi'));
  if (i < 0) return '';
  const sau = [];
  for (const d of dong.slice(i + 1, i + 4)) { if (DUNG.test(d)) break; sau.push(d); }
  if (!sau.length) return '';
  const loai = dong[i].toLocaleLowerCase('vi');
  return hoaDau(`${loai} ${sau.join(' ')}`).replace(/\s+/g, ' ').slice(0, 300);
}

export const doanTuChu = (chu) => ({ so_hieu: tachSoHieu(chu), ngay_van_ban: tachNgay(chu), trich_yeu: tachTrichYeu(chu) });

// Tên tệp: "15-BC-VPTU.pdf", "BC_15_VPTU.docx", V-Office "A14_01-VBNB_2026-CV-1400-2026_daky.pdf" → số hiệu gợi ý ("15-BC/VPTU", "1400-CV").
export function doanTuTenTep(ten) {
  const g = String(ten || '').normalize('NFC').replace(/\.[A-Za-z0-9]{2,5}$/, '');
  let m = g.match(new RegExp(`(?:^|[^0-9])20\\d\\d[-_](${LOAI_RE})[-_](\\d{1,5})(?![0-9])`, 'u'));   // V-Office: <năm>-<loại>-<số>
  if (m) return { so_hieu: `${Number(m[2])}-${chuanLoai(m[1])}` };
  m = g.match(new RegExp(`(?:^|[^0-9])(?!20\\d\\d[-_ ])(\\d{1,5})[-_ ]?(${LOAI_RE})(?:[-_ ](VPTU|TU|BTV|BCĐ|BCD|UBND))?(?![A-Za-z])`, 'u'));
  if (m) return { so_hieu: `${Number(m[1])}-${chuanLoai(m[2])}${m[3] ? `/${m[3].toUpperCase()}` : ''}` };
  m = g.match(new RegExp(`(?:^|[^A-Za-z])(${LOAI_RE})[-_ ](\\d{1,5})(?![0-9])`, 'u'));
  if (m) return { so_hieu: `${Number(m[2])}-${chuanLoai(m[1])}` };
  return { so_hieu: '' };
}
