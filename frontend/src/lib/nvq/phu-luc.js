// Phân hệ Nhiệm vụ quý BTV: bảng Phụ lục "Danh mục tổ chức thực hiện các chỉ tiêu, nhiệm vụ chính trị trong quý" (7 cột: Stt · Nhiệm vụ được giao ·
// Lãnh đạo phụ trách · Trục kết quả trọng tâm · Đơn vị tham mưu, chủ trì · Kết quả/sản phẩm cần đạt được · Tiến độ thực hiện/hoàn thành) → các dòng nhập
// (nvq_nhap_danh_muc, 0138). Quy ước của tệp theo dõi của Văn phòng (Phụ lục 2 kèm CV 888-CV/TU): chữ ĐỎ ở cột Stt là chủ trì theo dõi (nhiều người
// cách nhau ";" — người đầu chủ trì, người sau phối hợp — chủ dự án 13/11/2026; "PHÒNG …" là phòng); chữ đỏ ở cột Kết quả / Tiến độ là kết quả đã cập
// nhật ("HOÀN THÀNH" = mọi kết quả đã xong). Dòng "I. Các nhiệm vụ thuộc trục 1…" mở trục; dòng "1/2. Nhiệm vụ được phê duyệt theo / ngoài chương trình…"
// mở nhóm. Thuần — đầu vào: [[{ den, do, tat } | null, …] mỗi dòng] (lib/nvq/doc-word.js đọc từ .docx). Unit test frontend/tests/nvq-tach.test.mjs.
import { chuan, thuong, nhanLanhDao, nhanDonVi, tachSanPham, docVanBanKetQua, coHoanThanh, tachTenTheoDoi, khopTen, phongTuTen } from './tach.js';

const LA_MA = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
const chu = (o) => chuan(o?.tat || '');

export function dongTuPhuLuc(bang, { ky, dmLanhDao = [], dmDonVi = [], taiKhoan = [], tenPhong = {}, biDanh = {}, tenTep = '' } = {}) {
  const dong = []; const canhBao = []; const meta = [];
  let truc = null; let nhom = null; let sttTruoc = 0;
  bang.forEach((hang, i) => {
    const [cStt, cNd, cLd, cTruc, cDv, cKq, cTd] = hang || [];
    const nd = chu(cNd);
    if (!nd || /^nhiệm vụ được giao$/i.test(nd)) return;
    const mTruc = nd.match(/^([IVX]+)\s*[.-]\s*(các nhiệm vụ thuộc trục|.*trục\s*\d)/i);
    if (mTruc && !chu(cLd) && !chu(cDv)) { truc = LA_MA[mTruc[1].toUpperCase()] || null; nhom = null; sttTruoc = 0; return; }
    if (/^nhiệm vụ được (phê duyệt|giao)/i.test(nd) && !chu(cLd)) { nhom = /ngoài chương trình/i.test(nd) ? 'NGOAI_CT' : 'TRONG_CT'; sttTruoc = 0; return; }
    if (!truc || !nhom) { canhBao.push(`Dòng ${i + 1}: chưa xác định trục / nhóm — bỏ qua.`); return; }
    const sttChu = `${cStt?.den || ''} ${cStt?.do || ''}`;
    const mStt = sttChu.match(/\(?\s*(\d{1,3})\s*\)/) || sttChu.match(/^\s*(\d{1,3})\s*$/m);
    const stt = mStt ? Number(mStt[1]) : sttTruoc + 1;
    sttTruoc = stt;
    const trucGhi = (chu(cTruc).match(/(\d+)/) || [])[1];
    if (trucGhi && Number(trucGhi) !== truc) canhBao.push(`${truc}.${nhom === 'TRONG_CT' ? 1 : 2}.(${stt}): cột Trục ghi "Trục ${trucGhi}" khác mục đang đọc — theo mục.`);

    // Chủ trì theo dõi (chữ đỏ cột Stt).
    const ten = tachTenTheoDoi(cStt?.do || '');
    let phong = null; const khop = []; const ids = [];
    ten.forEach((t) => {
      const p = phongTuTen(t, tenPhong);
      if (p) { phong = phong || p; khop.push({ ten: t, phong: p }); return; }
      const kq = khopTen(t, taiKhoan, { biDanh });
      khop.push({ ten: t, ...kq });
      if (kq?.id && !ids.includes(kq.id)) ids.push(kq.id);
    });
    const chuTri = ids[0] || null; const phoiHop = ids.slice(1);

    // Kết quả cần đạt (chữ đen), kết quả đã cập nhật (chữ đỏ), tiến độ.
    const coChu = (x) => /[\p{L}\d]{2,}/u.test(x);   // "( ." còn lại sau khi chữ đỏ thay phần chữ đen → coi như trống
    const kqDen = coChu(cKq?.den || '') ? chuan(cKq.den) : ''; const kqDo = coChu(cKq?.do || '') ? chuan(cKq.do).replace(/\n[.\s]*$/, '').replace(/^[)\].,;\s]+/, '') : '';
    const tdTat = chu(cTd);
    const tdDen = chuan((cTd?.den || '')).replace(/hoàn thành/gi, '').trim() || chuan(tdTat.replace(/hoàn thành/gi, ''));
    const xong = coHoanThanh(cTd?.do || '') || coHoanThanh(cTd?.den || '');
    // Kết quả / sản phẩm tách từ TOÀN VĂN ô (chữ đỏ có thể chen giữa các phần "(1) … (2) …"); phần nêu số văn bản có trong chữ đỏ → đã ban hành.
    const kqTat = coChu(chu(cKq)) ? chu(cKq).replace(/^\(\(/, '(').replace(/\n[.\s]*$/, '') : '';
    const { tinhChat, sanPham } = tachSanPham(kqTat, tdDen, ky);
    sanPham.forEach((s) => {
      const vb = docVanBanKetQua(s.mo_ta);
      const coTrongDo = vb.so_ky_hieu && kqDo.replace(/\s/g, '').includes(vb.so_ky_hieu.slice(0, 6)) && !/hoàn thành\s+\d+\s*\/\s*\d+/i.test(s.mo_ta);
      if (xong || coTrongDo) {
        const vbChung = vb.so_ky_hieu ? vb : docVanBanKetQua(kqDo || kqTat);
        Object.assign(s, { trang_thai: 'HOAN_THANH', kq_so_ky_hieu: vbChung.so_ky_hieu, kq_ngay: vbChung.ngay, kq_mo_ta: (coTrongDo ? s.mo_ta : kqDo || null)?.slice(0, 2000) || null });
      }
    });
    const tdDo = chuan(cTd?.do || '').replace(/hoàn thành/gi, '').trim();   // tiến độ ghi đỏ chỉ là "Quý IV/2026", "Tháng 11/2026" → không phải kết quả
    const capNhat = [kqDo, coChu(tdDo) && !/^(quý|tháng|các tháng|định kỳ)\b/i.test(tdDo) ? tdDo : ''].filter(Boolean).join('\n');
    const d = {
      truc_so: truc, nhom, stt, noi_dung: nd, lanh_dao_text: chu(cLd).replace(/\n/g, ' '), lanh_dao_ma: nhanLanhDao(chu(cLd), dmLanhDao),
      don_vi_text: chu(cDv).replace(/\n(?=\s*\()/g, ' ').replace(/\n/g, '; '), don_vi: nhanDonVi(chu(cDv), dmDonVi),
      ket_qua_can_dat: kqDen || kqDo || null, tien_do_text: tdDen || null, tinh_chat: tinhChat,
      chu_tri_theo_doi: chuTri, phoi_hop_theo_doi: phoiHop, phong_theo_doi: phong, san_pham: sanPham,
      cap_nhat_dau: capNhat || xong ? { ket_qua_thuc_hien: capNhat || 'Hoàn thành (theo tệp danh mục cập nhật).', nguon_thong_tin: tenTep || null } : null,
      du_lieu_goc: { stt: chuan(sttChu), lanh_dao: chu(cLd), don_vi: chu(cDv), ket_qua: chu(cKq), tien_do: tdTat },
    };
    if (!ten.length) canhBao.push(`${truc}.${nhom === 'TRONG_CT' ? 1 : 2}.(${stt}): chưa có chủ trì theo dõi.`);
    khop.filter((x) => !x.phong && !x.id).forEach((x) => canhBao.push(`${truc}.${nhom === 'TRONG_CT' ? 1 : 2}.(${stt}): chưa khớp tên "${x.ten}" với tài khoản nào.`));
    dong.push(d); meta.push({ khop, xong, kqDo });
  });
  // Trùng vị trí (Stt ghi lặp) → báo, giữ dòng đầu.
  const thay = new Set();
  const ra = []; const raMeta = [];
  dong.forEach((d, i) => {
    const k = `${d.truc_so}|${d.nhom}|${d.stt}`;
    if (thay.has(k)) { canhBao.push(`${d.truc_so}.${d.nhom === 'TRONG_CT' ? 1 : 2}.(${d.stt}): Stt ghi trùng — bỏ dòng sau.`); return; }
    thay.add(k); ra.push(d); raMeta.push(meta[i]);
  });
  return { dong: ra, meta: raMeta, canhBao };
}
export const tomTatNhap = (dong) => ({
  tong: dong.length,
  theoTruc: dong.reduce((m, d) => ({ ...m, [d.truc_so]: (m[d.truc_so] || 0) + 1 }), {}),
  trongCt: dong.filter((d) => d.nhom === 'TRONG_CT').length,
  ngoaiCt: dong.filter((d) => d.nhom === 'NGOAI_CT').length,
  hoanThanh: dong.filter((d) => d.san_pham.every((s) => s.trang_thai === 'HOAN_THANH')).length,
  chuaPhanCong: dong.filter((d) => !d.chu_tri_theo_doi && !d.phong_theo_doi).length,
  sanPham: dong.reduce((n, d) => n + d.san_pham.length, 0),
});
export const tenViTri = (d) => `${['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][d.truc_so] || d.truc_so}.${d.nhom === 'TRONG_CT' ? 1 : 2}.(${d.stt})`;
export const laDongTieuDe = (s) => /^stt$/i.test(thuong(s));

// Trước khi gửi nvq_nhap_danh_muc: cắt chữ theo giới hạn cột (0132) và báo dòng sai (một câu mỗi dòng) — để không gặp lỗi ràng buộc của CSDL.
const cat = (s, n) => (s === null || s === undefined ? s : String(s).slice(0, n));
const GIOI_HAN_NV = { noi_dung: 4000, lanh_dao_text: 1000, don_vi_text: 1000, ket_qua_can_dat: 4000, tien_do_text: 300 };
const GIOI_HAN_SP = { mo_ta: 2000, han_text: 100, don_vi_tinh: 40, kq_so_ky_hieu: 100, kq_co_quan: 200, kq_trich_yeu: 1000, kq_mo_ta: 2000 };
export function kiemDongNhap(dong) {
  const loi = [];
  const ra = dong.map((d) => {
    const x = { ...d };
    Object.entries(GIOI_HAN_NV).forEach(([k, n]) => { x[k] = cat(x[k], n); });
    if (x.cap_nhat_dau) x.cap_nhat_dau = { ...x.cap_nhat_dau, ket_qua_thuc_hien: cat(x.cap_nhat_dau.ket_qua_thuc_hien, 6000), nguon_thong_tin: cat(x.cap_nhat_dau.nguon_thong_tin, 300) };
    x.san_pham = (x.san_pham || []).map((s) => { const y = { ...s }; Object.entries(GIOI_HAN_SP).forEach(([k, n]) => { y[k] = cat(y[k], n); }); return y; });
    const vt = tenViTri(x);
    if (!Number.isInteger(x.truc_so) || x.truc_so < 1 || x.truc_so > 6) loi.push(`${vt}: trục phải là số 1–6.`);
    if (!Number.isInteger(x.stt) || x.stt < 1 || x.stt > 999) loi.push(`${vt}: Stt phải là số 1–999.`);
    if (!String(x.noi_dung || '').trim()) loi.push(`${vt}: thiếu nội dung nhiệm vụ.`);
    x.san_pham.forEach((s, i) => {
      if (!String(s.mo_ta || '').trim()) loi.push(`${vt}: kết quả, sản phẩm ${i + 1} thiếu mô tả.`);
      if (s.loai === 'CHI_TIEU' && s.chi_tieu_co_ban && (s.muc_tieu === null || s.muc_tieu === undefined || Number.isNaN(Number(s.muc_tieu)))) loi.push(`${vt}: chỉ tiêu cơ bản "${s.mo_ta.slice(0, 60)}" cần ghi mục tiêu (số).`);
    });
    return x;
  });
  return { dong: ra, loi };
}
