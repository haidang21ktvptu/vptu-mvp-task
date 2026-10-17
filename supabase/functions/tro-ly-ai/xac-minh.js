// Xác minh kết quả đọc văn bản của AI ở MÁY CHỦ (v3.25 — "vẫn phải đảm bảo chính xác nội dung"): mỗi giá trị lấy từ văn bản phải có câu trích
// (trich) tìm thấy NGUYÊN VĂN trong chữ của tệp PDF (so khớp bỏ dấu câu, khoảng trắng, xuống dòng, hoa thường; chữ PDF mất dấu thì so không dấu —
// 'khong_dau'; câu vắt hai trang: bỏ qua số trang, dòng đầu / chân trang chạy suốt văn bản — boMepTrang) và giá trị phải khớp câu trích (số hiệu nằm trong câu, ngày đúng ngày / tháng / năm của câu, hạn đúng mốc / cuối quý / tháng / năm).
// Mã danh mục (loại văn bản, sản phẩm, loại thời hạn, ngành, lĩnh vực, mục tiêu) phải có trong danh mục — sai thì bỏ. Văn bản dạng ảnh (PDF scan) không
// có chữ để đối chiếu → mọi giá trị chỉ là gợi ý. Giao diện chỉ tự điền ô xac_minh ≠ false. Thuần — unit test frontend/tests/tro-ly-ai.test.mjs.

export const chuanTrich = (s) => String(s || '').normalize('NFC').toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}]+/gu, '');
export const boDau = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
// Chữ bỏ "mép trang" ở chỗ ngắt trang (chủ dự án duyệt 18/10/2026 sau kiểm tay): câu vắt qua hai trang có số trang, dòng đầu / chân trang chen giữa
// → so nguyên văn hỏng. Trình duyệt ghép các trang bằng một dòng trống, trong trang không có dòng trống (lib/kl/doc-pdf.js). Chỉ xét tối đa MEP dòng
// đầu và cuối mỗi trang; bỏ dòng chỉ có số trang ("2", "- 2 -", "Trang 2/28") hoặc dòng đầu / chân trang chạy suốt văn bản: (bỏ chữ số, còn ≥ 8 chữ)
// lặp lại ở mép của mọi trang hoặc mọi trang trừ một (tối thiểu 2) — dòng nội dung tình cờ trùng ở mép vài trang, dòng ngắn chỉ khác chữ số ("ngày
// 25/12/2026." / "ngày 30/11/2026.") không bị bỏ. Nội dung giữa trang không bao giờ bị bỏ; câu trích vẫn phải khớp nguyên văn từng chữ (coTrong so cả
// chữ gốc lẫn chữ đã bỏ mép).
const MEP = 2; const KHUNG_TOI_THIEU = 8;
const khungDong = (s) => boDau(chuanTrich(s)).replace(/\d+/g, '');
const laSoTrang = (s) => /^(trang|page)?\d{1,4}$/.test(boDau(chuanTrich(s)));
export function boMepTrang(chu) {
  const trang = String(chu || '').split(/\n{2,}/).map((t) => t.split('\n'));
  if (trang.length < 2) return String(chu || '');
  const mep = (ds) => [...ds.slice(0, MEP), ...ds.slice(-MEP)];
  const dem = new Map();
  trang.forEach((ds) => new Set(mep(ds).map(khungDong).filter((k) => k.length >= KHUNG_TOI_THIEU)).forEach((k) => dem.set(k, (dem.get(k) || 0) + 1)));
  const nguong = Math.max(2, trang.length - 1);
  const laMep = (s) => laSoTrang(s) || (dem.get(khungDong(s)) || 0) >= nguong;
  return trang.map((ds) => ds.filter((s, i) => !((i < MEP || i >= ds.length - MEP) && laMep(s))).join('\n')).join('\n');
}
export const taoBo = (chu) => {
  const c = chuanTrich(chu); const g = chuanTrich(boMepTrang(chu)); const khac = g !== c;
  return { chuan: c, khongDau: boDau(c), gon: khac ? g : '', gonKhongDau: khac ? boDau(g) : '', co: c.length > 0 };
};

// 'dung' | 'khong_dau' | false — câu trích có trong văn bản không (chữ gốc hoặc chữ đã bỏ mép trang).
export function coTrong(bo, trich, toiThieu = 4) {
  const t = chuanTrich(trich);
  if (!bo?.co || t.length < toiThieu) return false;
  if (bo.chuan.includes(t) || (bo.gon && bo.gon.includes(t))) return 'dung';
  const k = boDau(t);
  return bo.khongDau.includes(k) || (bo.gonKhongDau && bo.gonKhongDau.includes(k)) ? 'khong_dau' : false;
}

const NGAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ngayHopLe = (s) => { const m = NGAY.exec(String(s || '')); if (!m) return null; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
const cuoiThang = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const LA_MA = { i: 1, ii: 2, iii: 3, iv: 4, 1: 1, 2: 2, 3: 3, 4: 4 };

// Câu trích chứa đúng ngày / tháng / năm của giá trị (05/10/2026, 5-10-2026, "ngày 05 tháng 10 năm 2026").
export function kiemNgay(giaTri, trich) {
  const n = ngayHopLe(giaTri); if (!n) return false;
  const t = boDau(String(trich || '')).toLowerCase().replace(/\s+/g, ' ');
  return new RegExp(`(?:^|\\D)0?${n.d}\\D{1,12}0?${n.m}\\D{1,12}${n.y}(?!\\d)`).test(t);
}
// Hạn: ngày cụ thể, hoặc cuối quý / tháng / năm nêu trong câu trích.
export function kiemHan(giaTri, trich) {
  if (kiemNgay(giaTri, trich)) return true;
  const n = ngayHopLe(giaTri); if (!n) return false;
  const t = boDau(String(trich || '')).toLowerCase().replace(/\s+/g, ' ');
  const q = /quy\s*(iv|iii|ii|i|[1-4])\b\s*(?:\/|-|nam|năm)?\s*(\d{4})/.exec(t);
  if (q) { const qq = LA_MA[q[1]]; const y = +q[2]; return giaTri === iso(y, qq * 3, cuoiThang(y, qq * 3)); }
  const th = /thang\s*(\d{1,2})\s*(?:\/|-|nam)\s*(\d{4})/.exec(t);
  if (th) { const m = +th[1]; const y = +th[2]; return m >= 1 && m <= 12 && giaTri === iso(y, m, cuoiThang(y, m)); }
  const nm = /nam\s*(\d{4})/.exec(t);
  return Boolean(nm) && giaTri === iso(+nm[1], 12, 31);
}
// Số hiệu nằm trong câu trích, không dính số đứng trước ('99-KL/TU' không khớp '999-KL/TU').
export function kiemSoHieu(giaTri, trich) {
  const g = chuanTrich(giaTri); const t = chuanTrich(trich);
  if (!g) return false;
  for (let i = t.indexOf(g); i >= 0; i = t.indexOf(g, i + 1)) if (i === 0 || !/\p{N}/u.test(t[i - 1])) return true;
  return false;
}
const TU_LOAI = { KL_BTV: [['ket luan'], ['ban thuong vu', 'btv']], TB_THUONG_TRUC: [['thong bao']], KL_BCH: [['ket luan'], ['ban chap hanh']],
  NQ_BCH: [['nghi quyet'], ['ban chap hanh']], NQ_TW: [['nghi quyet'], ['trung uong', 'bo chinh tri', 'nq/tw', 'nqtw']], CONG_VAN: [['v/v', 'cong van', 've viec', '-cv']] };
export function kiemLoai(ma, trich) {
  const t = boDau(String(trich || '')).toLowerCase().replace(/\s+/g, ' ');
  const yc = TU_LOAI[ma];
  return Boolean(yc) && yc.every((nhom) => nhom.some((w) => t.includes(w)));
}
export const kiemSoHoiNghi = (giaTri, trich) => /^\d{1,4}$/.test(String(giaTri || '')) && /hoi nghi/.test(boDau(String(trich || '')).toLowerCase())
  && new RegExp(`(?:^|\\D)0?${Number(giaTri)}(?!\\d)`).test(String(trich || ''));

const cat = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const xm = (bo, trich, dieuKien) => { const c = coTrong(bo, trich); return c && dieuKien ? c : false; };

// kq: JSON của AI theo lược đồ (de-bai.js); chu: chữ của tệp (rỗng khi PDF scan); dm: { loai, sanPham, loaiThoiHan, nganh, linhVuc, mucTieu } — mảng mã
// (linhVuc: [{ ma, nganh_ma }]).
export function xacMinhKetQua(kq, chu, dm) {
  const bo = taoBo(chu);
  const coMa = (ds, v) => (ds || []).includes(v) ? v : '';
  const lv = new Map((dm.linhVuc || []).map((l) => [l.ma, l.nganh_ma]));
  const vb = kq?.van_ban || {};
  const truong = (k, kiem) => { const g = cat(vb[k]?.gia_tri, 300); const t = cat(vb[k]?.trich, 600); return { gia_tri: g, trich: t, xac_minh: g ? xm(bo, t, kiem(g, t)) : false }; };
  const loai = coMa(dm.loai, vb.loai?.gia_tri);
  const vanBan = {
    loai: { gia_tri: loai, trich: cat(vb.loai?.trich, 600), xac_minh: loai ? xm(bo, vb.loai?.trich, kiemLoai(loai, vb.loai?.trich)) : false },
    so_hieu: truong('so_hieu', kiemSoHieu),
    ngay_ban_hanh: truong('ngay_ban_hanh', (g, t) => kiemNgay(g, t)),
    trich_yeu: (() => { const g = cat(vb.trich_yeu?.gia_tri, 300); return { gia_tri: g, trich: g, xac_minh: g ? coTrong(bo, g, 8) : false }; })(),
    so_hoi_nghi: truong('so_hoi_nghi', kiemSoHoiNghi),
    co_quan_ban_hanh: truong('co_quan_ban_hanh', (g, t) => chuanTrich(t).includes(chuanTrich(g))),
  };
  const mt = (ds) => (Array.isArray(ds) ? ds : []).map((m) => ({ ma: coMa(dm.mucTieu, m?.ma), trich: cat(m?.trich, 400), ly_do: cat(m?.ly_do, 200) }))
    .filter((m) => m.ma).map((m) => ({ ...m, xac_minh: coTrong(bo, m.trich) })).slice(0, 10);
  const nhiemVu = (Array.isArray(kq?.nhiem_vu) ? kq.nhiem_vu : []).slice(0, 60).map((n) => {
    const nd = cat(n?.noi_dung, 3000); const han = ngayHopLe(n?.han) ? n.han : ''; const tHan = cat(n?.trich_han, 400);
    let nganh = coMa(dm.nganh, n?.nganh); let linhVuc = lv.has(n?.linh_vuc) ? n.linh_vuc : '';
    if (linhVuc && nganh && lv.get(linhVuc) !== nganh) linhVuc = '';
    if (linhVuc && !nganh) nganh = lv.get(linhVuc) || '';
    return {
      noi_dung: { gia_tri: nd, xac_minh: nd ? coTrong(bo, nd, 12) : false }, trich: cat(n?.trich, 3000),
      don_vi_chu_tri: { gia_tri: cat(n?.don_vi_chu_tri, 200) },
      don_vi_phoi_hop: { gia_tri: cat(n?.don_vi_phoi_hop, 300), xac_minh: n?.don_vi_phoi_hop ? coTrong(bo, n.don_vi_phoi_hop) : false },
      han: { gia_tri: han, trich: tHan, xac_minh: han ? xm(bo, tHan, kiemHan(han, tHan)) : false },
      loai_thoi_han: { gia_tri: coMa(dm.loaiThoiHan, n?.loai_thoi_han) },
      san_pham: { gia_tri: coMa(dm.sanPham, n?.san_pham) },
      mo_ta_san_pham: { gia_tri: cat(n?.mo_ta_san_pham, 200), xac_minh: n?.mo_ta_san_pham ? coTrong(bo, n.mo_ta_san_pham) : false },
      nganh: { gia_tri: nganh }, linh_vuc: { gia_tri: linhVuc },
      muc_tieu: mt(n?.muc_tieu),
    };
  }).filter((n) => n.noi_dung.gia_tri);
  const nhacToi = (Array.isArray(kq?.van_ban_nhac_toi) ? kq.van_ban_nhac_toi : []).slice(0, 20)
    .map((v) => ({ so_hieu: cat(v?.so_hieu, 40), ten: cat(v?.ten, 300), trich: cat(v?.trich, 600) }))
    .filter((v) => v.so_hieu).map((v) => ({ ...v, xac_minh: kiemSoHieu(v.so_hieu, v.trich) ? coTrong(bo, v.trich) : false }));
  const dem = [...Object.values(vanBan), ...nhiemVu.flatMap((n) => [n.noi_dung, n.han])].filter((x) => x.gia_tri);
  return { van_ban: vanBan, nhiem_vu: nhiemVu, muc_tieu_van_ban: mt(kq?.muc_tieu_van_ban), van_ban_nhac_toi: nhacToi,
    co_chu: bo.co, thong_ke: { co_gia_tri: dem.length, da_xac_minh: dem.filter((x) => x.xac_minh).length, so_nhiem_vu: nhiemVu.length } };
}
