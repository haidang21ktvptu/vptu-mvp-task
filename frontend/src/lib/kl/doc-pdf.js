// Đợt D v3.20: đọc chữ trang đầu tệp PDF người nộp vừa chọn (máy người dùng, không gửi đi đâu) để gợi ý số hiệu / ngày / trích yếu
// (lib/kl/doc-van-ban.js). pdf.js (Mozilla, Apache-2.0) chép nguyên văn ở frontend/vendor/pdfjs — nạp khi cần, worker gói bằng Vite (?worker).
// PDF scan (không có lớp chữ) → chuỗi rỗng; lỗi đọc → ném lỗi, nơi gọi bỏ qua và đoán theo tên tệp.
// v3.25: docPdf — chữ mọi trang (tối đa toiDaTrang, toiDaKyTu) cho trợ lý AI đọc văn bản giao việc; anhCacTrang — ảnh JPEG các trang đầu khi tệp là
// bản chụp. Cả hai chỉ đọc trong trình duyệt; tệp không được tải lên đâu (Giao việc gửi chữ / ảnh tới Edge Function tro-ly-ai, không lưu).
let thuVien = null;

async function napPdfJs() {
  if (thuVien) return thuVien;
  const [lib, { default: PdfWorker }] = await Promise.all([import('../../../vendor/pdfjs/pdf.mjs'), import('../../../vendor/pdfjs/pdf.worker.mjs?worker')]);
  lib.GlobalWorkerOptions.workerPort = new PdfWorker();
  thuVien = lib;
  return lib;
}

// Ghép các mảnh chữ thành dòng: mảnh có hasEOL hoặc đổi toạ độ dọc (> 2 điểm) thì xuống dòng.
export function ghepDong(items) {
  const dong = []; let hien = ''; let y = null;
  for (const it of items || []) {
    const yi = Array.isArray(it.transform) ? it.transform[5] : null;
    if (hien && y !== null && yi !== null && Math.abs(yi - y) > 2) { dong.push(hien); hien = ''; }
    hien += it.str || '';
    if (it.hasEOL) { dong.push(hien); hien = ''; }
    if (yi !== null) y = yi;
  }
  if (hien) dong.push(hien);
  return dong.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

export async function chuTrangDau(file) {
  const lib = await napPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, disableFontFace: true, stopAtErrors: false }).promise;
  try {
    const trang = await doc.getPage(1);
    return ghepDong((await trang.getTextContent()).items);
  } finally {
    doc.destroy();
  }
}

const moTep = async (lib, file) => lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, disableFontFace: true, stopAtErrors: false }).promise;
export async function docPdf(file, { toiDaTrang = 40, toiDaKyTu = 120000 } = {}) {
  const lib = await napPdfJs(); const doc = await moTep(lib, file);
  try {
    const phan = []; let dai = 0;
    for (let i = 1; i <= Math.min(doc.numPages, toiDaTrang) && dai < toiDaKyTu; i++) {
      const t = ghepDong((await (await doc.getPage(i)).getTextContent()).items); phan.push(t); dai += t.length + 2;
    }
    return { chu: phan.join('\n\n').slice(0, toiDaKyTu), soTrang: doc.numPages, daDoc: phan.length };
  } finally { doc.destroy(); }
}
// → [{ media: 'image/jpeg', data: base64 }] — rộng ~rong điểm ảnh (chữ đủ rõ để đọc), mỗi ảnh dưới 3 MB (giới hạn của function).
export async function anhCacTrang(file, { toiDa = 8, rong = 1500, chatLuong = 0.72 } = {}) {
  const lib = await napPdfJs(); const doc = await moTep(lib, file);
  try {
    const ds = [];
    for (let i = 1; i <= Math.min(doc.numPages, toiDa); i++) {
      const trang = await doc.getPage(i); const goc = trang.getViewport({ scale: 1 }); const vp = trang.getViewport({ scale: Math.min(3, rong / goc.width) });
      const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
      const g = c.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c.width, c.height);   // nền trắng (PDF trong suốt → JPEG đen)
      await trang.render({ canvasContext: g, viewport: vp }).promise;
      let q = chatLuong; let data = c.toDataURL('image/jpeg', q).split(',')[1];
      while (data.length > 2_900_000 && q > 0.35) { q -= 0.15; data = c.toDataURL('image/jpeg', q).split(',')[1]; }
      ds.push({ media: 'image/jpeg', data }); c.width = 0; c.height = 0;
    }
    return ds;
  } finally { doc.destroy(); }
}
