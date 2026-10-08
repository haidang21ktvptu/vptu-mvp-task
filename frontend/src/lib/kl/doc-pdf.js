// Đợt D v3.20: đọc chữ trang đầu tệp PDF người nộp vừa chọn (máy người dùng, không gửi đi đâu) để gợi ý số hiệu / ngày / trích yếu
// (lib/kl/doc-van-ban.js). pdf.js (Mozilla, Apache-2.0) chép nguyên văn ở frontend/vendor/pdfjs — nạp khi cần, worker gói bằng Vite (?worker).
// PDF scan (không có lớp chữ) → chuỗi rỗng; lỗi đọc → ném lỗi, nơi gọi bỏ qua và đoán theo tên tệp.
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
