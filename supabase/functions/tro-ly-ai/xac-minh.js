// Xác minh kết quả đọc văn bản của AI ở MÁY CHỦ (v3.25 — "vẫn phải đảm bảo chính xác nội dung"; đợt sửa gộp 18/10/2026: đối chiếu theo vị trí —
// van-ban-goc.js, rà soát sót / trùng — ra-soat.js). Mỗi giá trị lấy từ văn bản phải tìm thấy NGUYÊN VĂN trong chữ của tệp PDF (so khớp bỏ dấu câu,
// khoảng trắng, xuống dòng, hoa thường; chữ PDF mất dấu thì so không dấu — 'khong_dau'; câu vắt hai trang: bỏ số trang ở chỗ ngắt trang), và:
//  - số hiệu, ngày ban hành, loại, số hội nghị: chỉ theo phần đầu trang 1 (dòng "Số …", dòng "<địa danh>, ngày …", tên loại viết hoa + cơ quan ban
//    hành, "hội nghị … lần thứ N") — không lấy số hiệu, ngày của văn bản được nhắc tới; số hiệu phải đúng loại (-KL/, -TB/, -NQ/TU, -NQ/TW, -CV/);
//  - nội dung nhiệm vụ, trích yếu: điền NGUYÊN VĂN chữ của tệp (AI đổi "12%" thành "1,2%", đổi dấu — so bỏ dấu câu vẫn khớp); câu còn tiếp → con_tiep;
//  - hạn, đơn vị phối hợp, mô tả sản phẩm: phải nằm trong chính nhiệm vụ (hoặc ngay sau, trước nhiệm vụ kế tiếp); hạn đúng ngày nêu trong câu, hoặc
//    cuối quý / tháng / năm, "6 tháng đầu năm" → 30/6 ("trước tháng / quý / năm …", "đầu năm" không xác minh — có hai cách hiểu).
// Mã danh mục (loại văn bản, sản phẩm, loại thời hạn, ngành, lĩnh vực, mục tiêu) phải có trong danh mục — sai thì bỏ. Văn bản dạng ảnh (PDF scan) không
// có chữ để đối chiếu → mọi giá trị chỉ là gợi ý. Giao diện chỉ tự điền ô xac_minh ≠ false. Thuần — unit test frontend/tests/tro-ly-ai.test.mjs.
import { chuanTrich, boDau, boMepTrang, coDau, khongDauDeu } from './chuan-hoa.js';
import { taoGoc, timDoan, timNhiemVu, giaTriDien, conTiep, khoang, trongKhoang, chuDoan, trangCua } from './van-ban-goc.js';
import { docDau, hetTrichYeu, coQuanDau } from './dau-van-ban.js';
import { raSoat } from './ra-soat.js';

export { chuanTrich, boDau, boMepTrang };
export const taoBo = (chu) => {
  const c = chuanTrich(chu); const g = chuanTrich(boMepTrang(chu)); const khac = g !== c;
  return { chuan: c, khongDau: boDau(c), gon: khac ? g : '', gonKhongDau: khac ? boDau(g) : '', co: c.length > 0 };
};
// 'dung' | 'khong_dau' | false — câu trích có trong văn bản không (chữ gốc hoặc chữ đã bỏ số trang).
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
const CO_NGAY = /(?:^|\D)\d{1,2}\s*[/.-]\s*\d{1,2}\s*[/.-]\s*\d{4}(?!\d)|ngay\s*\d{1,2}\s*thang\s*\d{1,2}\s*nam\s*\d{4}/;
// Mốc mơ hồ — không xác minh: đầu / giữa tháng, quý; tuần; "10 ngày đầu", "trong 30 ngày"; nửa năm, giữa năm, đầu năm.
const MO_HO = /(?:dau|giua) (?:thang|quy)|tuan|ngay dau|\d+ ngay|thang (?:dau|cuoi|giua) nam|nua (?:dau|cuoi) nam|giua nam|dau nam/;
// Mốc số liệu "tính đến (hết) ngày …", "tính từ ngày … đến ngày …" không phải hạn (rà soát độc lập lần 2, 18/10) — so trên chữ CÓ DẤU ("tỉnh đến hết
// ngày 31/12" là hạn, lần 3).
const NGAY_SO = '(?:\\d{1,2}\\s*[/.-]\\s*\\d{1,2}\\s*[/.-]\\s*\\d{4}|\\d{1,2}\\s*tháng\\s*\\d{1,2}\\s*năm\\s*\\d{4})';
const MOC_SO_LIEU = new RegExp(`(?:^|[^\\p{L}\\p{N}])tính (?:từ (?:ngày )?${NGAY_SO} )?(?:đến|tới) (?:hết )?(?:ngày )?${NGAY_SO}`, 'gu');
const TU_DEN = /(?:^|[^\p{L}\p{N}])từ(?![\p{L}\p{N}])(?:[^.;]|\.(?=\d)){0,80}?[^\p{L}\p{N}](?:đến|tới)(?![\p{L}\p{N}])/u;   // "từ … đến …" (chữ có dấu: "đầu tư" không phải "từ")
// Hạn: câu nêu ngày cụ thể → phải đúng ngày đó; không thì cuối quý / tháng / năm, "N tháng đầu năm" → cuối tháng N, "N tháng cuối năm" → 31/12;
// "từ … đến …": hạn là mốc sau "đến". Đợt sửa gộp: máy chủ kiểm trên CHỮ CỦA TỆP ở chỗ khớp (không trên câu AI chép — "11/1" khác "1/11").
export function kiemHan(giaTri, trich) {
  if (!ngayHopLe(giaTri)) return false;
  const thuong = String(trich || '').normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g, ' ')
    .replace(MOC_SO_LIEU, (m) => ' '.repeat(m.length));   // giữ độ dài: vị trí trong chữ không dấu trùng chữ có dấu
  let t = khongDauDeu(thuong);
  const tuDen = TU_DEN.exec(thuong); if (tuDen) t = t.slice(tuDen.index + tuDen[0].length);
  if (CO_NGAY.test(t)) return kiemNgay(giaTri, t);
  if (/truoc (?:thang|quy|nam|\d{1,2} thang)/.test(t)) return false;   // "trước tháng 6/2026": hai cách hiểu — không xác minh
  const nt = /(\d{1,2}) thang (dau|cuoi) nam (\d{4})/.exec(t);
  if (nt) { const k = +nt[1]; const y = +nt[3]; const m = nt[2] === 'dau' ? k : 12; return k >= 1 && k <= 12 && giaTri === iso(y, m, cuoiThang(y, m)); }
  if (MO_HO.test(t)) return false;
  if ((t.match(/quy\s*(?:iv|iii|ii|i|[1-4])\b/g) || []).length > 1 || (t.match(/thang\s*\d{1,2}\s*(?:\/|-|nam)/g) || []).length > 1) return false;   // "quý I và quý II": hai mốc
  const q = /quy\s*(iv|iii|ii|i|[1-4])\b\s*(?:\/|-|nam)?\s*(\d{4})/.exec(t);
  if (q) { const qq = LA_MA[q[1]]; const y = +q[2]; return giaTri === iso(y, qq * 3, cuoiThang(y, qq * 3)); }
  const th = /thang\s*(\d{1,2})\s*(?:\/|-|nam)\s*(\d{4})/.exec(t);
  if (th) { const m = +th[1]; const y = +th[2]; return m >= 1 && m <= 12 && giaTri === iso(y, m, cuoiThang(y, m)); }
  if (/quy|thang|tuan/.test(t)) return false;
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
// Loại văn bản: tên loại viết hoa ở đầu khối (tu) + cơ quan ban hành = cơ quan nhắc tới ĐẦU TIÊN trong khối (dau-van-ban.js coQuanDau).
const TU_LOAI = { KL_BTV: { tu: 'ketluan', cq: 'BTV' }, KL_BCH: { tu: 'ketluan', cq: 'BCH' }, TB_THUONG_TRUC: { tu: 'thongbao', cq: 'TT' },
  NQ_BCH: { tu: 'nghiquyet', cq: 'BCH' }, NQ_TW: { tu: 'nghiquyet', cq: 'TW' }, CONG_VAN: { co: ['v/v', 'cong van', 've viec', '-cv'] } };
export function kiemLoai(ma, trich) {
  const t = boDau(String(trich || '')).toLowerCase().replace(/\s+/g, ' '); const y = TU_LOAI[ma];
  if (!y) return false;
  return y.tu ? t.replace(/\s+/g, '').startsWith(y.tu) && coQuanDau(t) === y.cq : y.co.some((w) => t.includes(w));
}
const SO_LOAI = { KL_BTV: /-KL\//i, KL_BCH: /-KL\//i, TB_THUONG_TRUC: /-TB\//i, NQ_BCH: /-NQ\/TU$/i, NQ_TW: /-NQ\/TW$/i, CONG_VAN: /-CV\//i };
// Loại theo phần đầu trang 1 (docDau): số hiệu của chính văn bản (nếu đọc được) phải đúng loại; công văn: số hiệu -CV/ hoặc không có tên loại, có "V/v".
export function kiemLoaiDau(ma, dau) {
  const sh = dau?.soHieu?.ma || '';
  if (sh && SO_LOAI[ma] && !SO_LOAI[ma].test(sh)) return false;
  if (ma === 'CONG_VAN') return /-CV\//i.test(sh) || (!dau?.tieuDe && Boolean(dau?.coVv));
  return Boolean(dau?.tieuDe && TU_LOAI[ma]?.tu) && kiemLoai(ma, dau.tieuDe.khoi);
}
export const kiemSoHoiNghi = (giaTri, trich) => {
  const m = /hoi nghi[^.;]{0,80}?(?:lan thu|thu)\s*(\d{1,4})(?!\d)/.exec(boDau(String(trich || '')).toLowerCase().replace(/\s+/g, ' '));
  return /^\d{1,4}$/.test(String(giaTri || '')) && Boolean(m) && Number(m[1]) === Number(giaTri);
};

const cat = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const cungSo = (a, b) => Boolean(a) && chuanTrich(boDau(a)) === chuanTrich(boDau(b));
// Dấu hiệu "ô khác của dòng bảng" (van-ban-goc.js noiDong): tên cơ quan chủ trì / phối hợp của MỌI nhiệm vụ AI tách (rà soát độc lập lần 4: ô chủ trì gồm
// hai cơ quan, mỗi nhiệm vụ một cơ quan) + câu thời hạn của chính nhiệm vụ. Không dùng mô tả sản phẩm (AI thường lấy từ chính nội dung).
const coQuanCua = (ds) => [...new Set(ds.flatMap((n) => [cat(n?.don_vi_chu_tri, 200), ...cat(n?.don_vi_phoi_hop, 300).split(';')]).map(chuanTrich))]
  .filter((x) => x.length >= 4).map((dau) => ({ dau }));
const ranhCua = (n, coQuan) => coQuan.concat(chuanTrich(n?.trich_han).length >= 6 ? [{ dau: chuanTrich(n.trich_han), han: true }] : []);
// Giá trị phải nằm trong khoảng của nhiệm vụ (nhieu: danh sách cách nhau bằng ";" — từng mục); điền chữ của tệp (trừ khi tệp mất dấu).
function trongNhiemVu(goc, ks, g, nhieu = false) {
  if (!g || !ks) return { gia_tri: g, xac_minh: false };
  const tim = (nhieu ? g.split(/\s*;\s*/).filter(Boolean) : [g]).map((p) => trongKhoang(goc, ks, p));
  if (!tim.length || tim.some((x) => !x)) return { gia_tri: g, xac_minh: false };
  const tep = tim.map((x) => chuDoan(goc, x.s, x.e));
  return tim.some((x) => x.xm === 'khong_dau') && !tep.some(coDau) ? { gia_tri: g, xac_minh: 'khong_dau' } : { gia_tri: tep.join('; '), xac_minh: 'dung' };
}

// kq: JSON của AI theo lược đồ (de-bai.js); chu: chữ của tệp (rỗng khi PDF scan); dm: { loai, sanPham, loaiThoiHan, nganh, linhVuc, mucTieu } — mảng mã
// (linhVuc: [{ ma, nganh_ma }]).
export function xacMinhKetQua(kq, chu, dm) {
  const bo = taoBo(chu); const goc = taoGoc(chu); const dau = docDau(goc);
  const coMa = (ds, v) => (ds || []).includes(v) ? v : '';
  const lv = new Map((dm.linhVuc || []).map((l) => [l.ma, l.nganh_ma]));
  const vb = kq?.van_ban || {};
  const gt = (k) => cat(vb[k]?.gia_tri, 300);
  const theoDau = (k, g, ok, trichTep) => ({ gia_tri: g, trich: ok && trichTep ? cat(trichTep, 600) : cat(vb[k]?.trich, 600), xac_minh: g && ok ? 'dung' : false });
  const loai = coMa(dm.loai, vb.loai?.gia_tri); const so = gt('so_hieu'); const ngay = ngayHopLe(gt('ngay_ban_hanh')) ? gt('ngay_ban_hanh') : '';
  const hn = gt('so_hoi_nghi');
  // Trích yếu: chỉ trong phần đầu (từ tên loại / dòng V/v tới hết phần đầu); AI chép thiếu đuôi → máy chủ lấy trọn trích yếu của tệp.
  const trichYeu = (() => {
    const g = gt('trich_yeu'); const d = g ? timDoan(goc, g, { toiThieu: 8 }) : null;
    if (!d || dau.dauTy === null || d.a < dau.dauTy || d.a >= dau.hetDau) return { gia_tri: g, trich: g, xac_minh: false };
    const het = hetTrichYeu(goc, dau, d.b);
    const v = het > d.b ? { gia_tri: goc.text.slice(d.a, het).replace(/\s+/g, ' ').trim(), xm: d.xm } : giaTriDien(goc, { xm: d.xm, phan: [d] }, g);
    return { gia_tri: cat(v.gia_tri, 300), trich: cat(v.gia_tri, 300), xac_minh: v.xm };
  })();
  const soOk = Boolean(dau.soHieu) && cungSo(so, dau.soHieu.ma);   // điền số hiệu theo chữ của tệp ("998/KL-TU" AI viết → "998-KL/TU")
  const vanBan = {
    loai: theoDau('loai', loai, Boolean(loai) && kiemLoaiDau(loai, dau), dau.tieuDe?.chu || dau.soHieu?.dong),
    so_hieu: theoDau('so_hieu', soOk ? dau.soHieu.goc : so, soOk, dau.soHieu?.dong),
    ngay_ban_hanh: theoDau('ngay_ban_hanh', gt('ngay_ban_hanh'), Boolean(ngay && dau.ngay) && ngay === iso(dau.ngay.y, dau.ngay.m, dau.ngay.d), dau.ngay?.dong),
    trich_yeu: trichYeu,
    so_hoi_nghi: theoDau('so_hoi_nghi', hn, /^\d{1,4}$/.test(hn) && dau.soHoiNghi === Number(hn), dau.soHoiNghiDong),
    co_quan_ban_hanh: (() => { const g = gt('co_quan_ban_hanh'); const t = cat(vb.co_quan_ban_hanh?.trich, 600); const c = g ? coTrong(bo, t) : false;
      return { gia_tri: g, trich: t, xac_minh: c && chuanTrich(t).includes(chuanTrich(g)) ? c : false }; })(),
  };
  const mt = (ds) => (Array.isArray(ds) ? ds : []).map((m) => ({ ma: coMa(dm.mucTieu, m?.ma), trich: cat(m?.trich, 400), ly_do: cat(m?.ly_do, 200) }))
    .filter((m) => m.ma).map((m) => ({ ...m, xac_minh: coTrong(bo, m.trich) })).slice(0, 10);
  // Nhiệm vụ: định vị theo thứ tự văn bản (nhiệm vụ sau tìm từ chỗ nhiệm vụ trước kết thúc); khoảng của mỗi việc dừng ở việc kế tiếp.
  const vao = (Array.isArray(kq?.nhiem_vu) ? kq.nhiem_vu : []).slice(0, 60).filter((n) => cat(n?.noi_dung, 3000));
  let tu = 0; const coQuan = coQuanCua(vao);
  const tim = vao.map((n) => { const k = goc.co ? timNhiemVu(goc, cat(n.noi_dung, 3000), tu) : null; if (k) tu = k.phan.at(-1).e; return k; });
  const dauChinh = tim.map((k) => (k ? k.phan.at(-1).s : null));
  const ke = tim.map((k, j) => {
    if (!k) return null;
    const e = k.phan.at(-1).e; let m = Infinity;
    dauChinh.forEach((s, i) => { if (i !== j && s !== null && s >= e && s < m) m = s; });
    return khoang(goc, k, m);
  });
  const nhiemVu = vao.map((n, j) => {
    const nd = cat(n.noi_dung, 3000); const k = tim[j]; const ks = ke[j];
    const v = k ? giaTriDien(goc, k, nd) : null; const tiep = k ? conTiep(goc, k.phan.at(-1), ranhCua(n, coQuan)) : null;
    const han = ngayHopLe(n?.han) ? n.han : ''; const tHan = cat(n?.trich_han, 400);
    const viTriHan = han && ks ? trongKhoang(goc, ks, tHan) : null;   // câu thời hạn trong chính nhiệm vụ → kiểm ngày trên CHỮ CỦA TỆP ở chỗ đó
    const hanTk = viTriHan && kiemHan(han, chuDoan(goc, viTriHan.s, viTriHan.e)) ? viTriHan : null;
    let nganh = coMa(dm.nganh, n?.nganh); let linhVuc = lv.has(n?.linh_vuc) ? n.linh_vuc : '';
    if (linhVuc && nganh && lv.get(linhVuc) !== nganh) linhVuc = '';
    if (linhVuc && !nganh) nganh = lv.get(linhVuc) || '';
    return {
      noi_dung: { gia_tri: v ? cat(v.gia_tri, 3000) : nd, xac_minh: v ? v.xm : false, ...(tiep ? { con_tiep: tiep.chu, cau_dan: tiep.dan } : {}) },
      trich: cat(n?.trich, 3000), trang: k ? trangCua(goc, k.phan.at(-1).a) : null,
      don_vi_chu_tri: { gia_tri: cat(n?.don_vi_chu_tri, 200) },
      don_vi_phoi_hop: trongNhiemVu(goc, ks, cat(n?.don_vi_phoi_hop, 300), true),
      han: { gia_tri: han, trich: tHan, xac_minh: hanTk ? hanTk.xm : false },
      loai_thoi_han: { gia_tri: coMa(dm.loaiThoiHan, n?.loai_thoi_han) },
      san_pham: { gia_tri: coMa(dm.sanPham, n?.san_pham) },
      mo_ta_san_pham: trongNhiemVu(goc, ks, cat(n?.mo_ta_san_pham, 200)),
      nganh: { gia_tri: nganh }, linh_vuc: { gia_tri: linhVuc },
      co_quan_trinh: { gia_tri: coMa(dm.coQuanTrinh || [], n?.co_quan_trinh) },   // v3.27: cột G bảng Phụ lục
      muc_tieu: mt(n?.muc_tieu),
    };
  });
  const soat = raSoat(goc, tim, ke, nhiemVu, dau);
  const nhacToi = (Array.isArray(kq?.van_ban_nhac_toi) ? kq.van_ban_nhac_toi : []).slice(0, 20)
    .map((v) => ({ so_hieu: cat(v?.so_hieu, 40), ten: cat(v?.ten, 300), trich: cat(v?.trich, 600) }))
    .filter((v) => v.so_hieu).map((v) => ({ ...v, xac_minh: kiemSoHieu(v.so_hieu, v.trich) ? coTrong(bo, v.trich) : false }));
  const dem = [...Object.values(vanBan), ...nhiemVu.flatMap((n) => [n.noi_dung, n.han])].filter((x) => x.gia_tri);
  return { van_ban: vanBan, nhiem_vu: nhiemVu, muc_tieu_van_ban: mt(kq?.muc_tieu_van_ban), van_ban_nhac_toi: nhacToi, ...soat,
    co_chu: bo.co, thong_ke: { co_gia_tri: dem.length, da_xac_minh: dem.filter((x) => x.xac_minh).length, so_nhiem_vu: nhiemVu.length } };
}
