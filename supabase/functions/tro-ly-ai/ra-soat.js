// Rà soát kết quả tách nhiệm vụ ở máy chủ (v3.25 — đợt sửa gộp 18/10/2026, chủ dự án: "không chấp nhận việc dùng AI mà đọc hiểu văn bản mà các nhiệm
// vụ hiểu sai"): (1) câu / ý có dấu hiệu giao việc mà không nhiệm vụ nào phủ → "có thể còn sót" (tối đa 8, kèm số trang, NGUYÊN VĂN chữ của tệp — người
// giao xem lại, bấm thêm vào danh sách); (2) nhiệm vụ trùng (cùng đoạn văn bản, cùng đơn vị chủ trì, cùng hạn, cùng sản phẩm) → trung_voi (không điền khi
// "Điền tất cả"). Chỉ là cảnh báo cho người giao — không tự thêm, không tự bỏ nhiệm vụ. Thuần — unit test frontend/tests/tro-ly-ai-doi-chieu.test.mjs.
import { boDau, chuanTrich } from './chuan-hoa.js';
import { trangCua, viTriChuan, capCua } from './van-ban-goc.js';

// Dấu hiệu mạnh: "Giao <cơ quan>" (không tính "Tuyên giáo", "được giao", "bàn giao", "giao thông"…), "đề nghị / yêu cầu <cơ quan>", "chủ trì", "tham mưu",
// "chịu trách nhiệm" (không tính "đã / được chủ trì tham mưu" — câu đánh giá). Dấu hiệu yếu (thời hạn) chỉ tính khi không nằm ngay sau một nhiệm vụ đã tách.
const MANH = [/(?:^|[^\p{L}])(?<!(?:[Tt]uyen|[Tt]on|[Nn]goai|[Bb]an|[Cc]huyen|[Dd]uoc|[Dd]a|[Vv]ua|[Tt]ung|[Mm]oi) )[Gg]iao\s+(?:cho\s+)?(?:\p{Lu}|cac\s)/u,
  /(?:^|[^\p{L}])(?:[Dd]e nghi|[Yy]eu cau)\s+(?:\p{Lu}|cac\s)/u,
  /(?:^|[^\p{L}])(?<!(?:[Dd]a|[Dd]uoc|[Tt]ung)(?: \p{L}+){0,2} )(?:chu tri|tham muu|chiu trach nhiem)(?![\p{L}])/u];
const YEU = /(?:^|[^\p{L}])(?:[Tt]ruoc ngay|[Tt]hoi han|[Hh]oan thanh (?:truoc|trong|xong))(?![\p{L}])/u;
const DAN_GIAO = /(?:de nghi|yeu cau|giao|chi dao|thuc hien|trien khai|tap trung|nhiem vu|chu tri|tham muu)[^.;:]{0,80}:$/i;
// Câu kết chung: "… yêu cầu / đề nghị các cơ quan, đơn vị (nghiêm túc / quan tâm, phối hợp / biết,) thực hiện (kết luận này)." — giữa chỉ có từ chung chung.
const CHUNG = new Set('cac co quan don vi cap uy dia phuong to chuc so nganh lien quan nghiem tuc khan truong tam phoi hop trien khai biet kip thoi va de theo chuc nang nhiem vu doan the cung'.split(' '));
const laCauKet = (bd) => {
  const m = /(?:^|\s)(?:yeu cau|de nghi|de) cac (?:co quan|cap uy|don vi|dia phuong|to chuc|so|doan the)\b(.*?)\bthuc hien(?: (?:ket luan|thong bao|nghi quyet|van ban|chi thi|cong van) nay)?\.?$/
    .exec(bd.toLowerCase());
  return Boolean(m) && m[1].split(/[\s,]+/).filter(Boolean).every((w) => CHUNG.has(w));
};
// Câu dẫn hết phạm vi khi gặp ý cùng cấp hoặc cấp cao hơn chính nó (capCua: I. > 1. > 1.1. > a) > - > +).
const HU_TU = /\s(?:với|và|của|cho|tại|về|trong|các|những|để|theo|là|có|được)$/u;
const giao = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));
const tuCua = (s) => new Set(boDau(String(s || '')).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2));

// Đơn vị rà: một câu, hoặc một ý liệt kê — cắt sau . ! ? (không tính dấu chấm của ký hiệu "2.1."), sau ":" cuối dòng, trước mỗi ý mới (goc.muc).
function cacCau(goc) {
  const t = goc.text; const cat = new Set(goc.muc.map(([x]) => x)); const trongMuc = (k) => goc.muc.some(([x, y]) => k >= x && k < y);
  for (const m of t.matchAll(/[.!?](?=\s)/g)) if (!trongMuc(m.index)) cat.add(m.index + 1);
  for (const m of t.matchAll(/:(?=\n)/g)) cat.add(m.index + 1);
  const ds = []; let a = 0;
  for (const b of [...cat].sort((x, y) => x - y)) { if (b > a) ds.push([a, b]); a = Math.max(a, b); }
  if (a < t.length) ds.push([a, t.length]);
  return ds;
}

// tim[j]: kết quả timNhiemVu (null = chưa định vị được), ke[j]: khoảng của nhiệm vụ j (van-ban-goc.js khoang); nv[j]: nhiệm vụ đã xác minh;
// dauVb: docDau (phần đầu trang 1 — bỏ qua khi rà sót).
export function raSoat(goc, tim, ke, nv, dauVb) {
  const phu = tim.flatMap((k) => (k ? k.phan.map((d) => [d.s, d.e]) : []));
  const sau = ke.flatMap((ks) => (ks ? [ks[ks.length - 1]] : []));
  const chuaDinhVi = nv.filter((_, j) => !tim[j]).map((n) => tuCua(n.noi_dung?.gia_tri)).filter((x) => x.size >= 6);
  const t = goc.text; const nn = /(?:^|\n)\s*N[ơo]i\s*nh[ậa]n\b/u.exec(t); const het = nn ? nn.index : t.length;
  const pl = nn ? /\nPH[ỤU] ?L[ỤU]C\b/u.exec(t.slice(het)) : null; const lai = pl ? het + pl.index : t.length;   // phụ lục sau "Nơi nhận" vẫn rà
  const dau = dauVb?.hetDau || 0; const mucTai = new Map(goc.muc.map(([x, y]) => [x, t.slice(x, y)]));
  const sot = []; const dan = [];   // dan: các câu dẫn đang mở { cap, giao, chu }
  if (goc.co) {
    for (let [a, b] of cacCau(goc)) {
      if (b <= dau || (a >= het && b <= lai)) continue;
      if (a < dau) a = dau;   // câu dính phần đầu: chỉ lấy phần sau
      const lech = t.slice(a, b).length - t.slice(a, b).trimStart().length; const mk = mucTai.get(a + lech);
      const cap = mk === undefined ? null : capCua(mk);
      const chu = t.slice(a, b).replace(/\s+/g, ' ').trim(); const bd = boDau(chu);
      if (cap !== null) while (dan.length && dan[dan.length - 1].cap >= cap) dan.pop();
      if (chu.endsWith(':')) {   // câu dẫn: không rà chính nó; các ý liệt kê sau nó thừa hưởng dấu hiệu giao việc
        if (cap === null) dan.length = 0;
        dan.push({ cap: cap ?? -1, giao: MANH.some((r) => r.test(bd)) || DAN_GIAO.test(bd), chu: mk ? chu.slice(mk.length).trim() : chu });
        continue;
      }
      const s = viTriChuan(goc, a); const e = viTriChuan(goc, b);
      if (e - s < 25) continue;
      const rieng = MANH.some((r) => r.test(bd));   // ý tự có dấu hiệu giao việc → không ghép câu dẫn
      const dg = cap !== null && !rieng ? [...dan].reverse().find((x) => x.giao) : null;   // câu dẫn giao việc gần nhất của ý này
      if (!(rieng || dg) && !(YEU.test(bd) && !sau.some(([x, y]) => giao(s, e, x, y) > 0))) continue;
      if (laCauKet(bd)) continue;
      if (phu.reduce((n, [x, y]) => n + giao(s, e, x, y), 0) >= 0.4 * (e - s)) continue;
      const tu = tuCua(chu); if (chuaDinhVi.some((x) => [...x].filter((w) => tu.has(w)).length >= 0.7 * x.size)) continue;   // AI đã tách (chép chưa khớp)
      // Nguyên văn ý (như đề bài quy tắc 4c: câu dẫn + ý); bỏ dòng tiêu đề mục ngắn dính ở đầu ("3. Tổ chức thực hiện"), dấu ; cuối ý.
      let tho = t.slice(a, b).trimStart(); if (mk) tho = tho.slice(mk.length);
      const td = /^ ?([^\n]{1,60})\n(?=\p{Lu})/u.exec(tho);
      if (mk && td && td[1].trim().split(/\s+/).length <= 6 && !/[.,;:]\s*$/.test(td[1]) && !HU_TU.test(` ${td[1].trim()}`) && !MANH.some((r) => r.test(boDau(td[1])))) tho = tho.slice(td[0].length);
      const y = tho.replace(/\s+/g, ' ').trim().replace(/\s*[;,]$/, '');
      sot.push({ trang: trangCua(goc, a), chu: (dg && dg.chu.length <= 300 ? `${dg.chu} ${y}` : y).slice(0, 1500) });
    }
  }
  // Trùng: cùng đơn vị chủ trì, cùng hạn, cùng sản phẩm (hoặc một bên để trống) và phần chính phủ nhau ≥ 80% đoạn ngắn hơn; chưa định vị được thì so chữ.
  const k = (n, f) => chuanTrich(f(n)); const cung = (x, y) => !x || !y || x === y;
  const ct = nv.map((n) => k(n, (x) => x.don_vi_chu_tri?.gia_tri)); const nd = nv.map((n) => k(n, (x) => x.noi_dung?.gia_tri));
  nv.forEach((n, j) => {
    for (let i = 0; i < j; i++) {
      if (!cung(ct[i], ct[j]) || !cung(nv[i].han?.gia_tri, n.han?.gia_tri) || !cung(nv[i].san_pham?.gia_tri, n.san_pham?.gia_tri)) continue;
      const p = tim[i]?.phan.at(-1); const q = tim[j]?.phan.at(-1);
      const trung = p && q ? giao(p.s, p.e, q.s, q.e) >= 0.8 * Math.min(p.e - p.s, q.e - q.s)
        : nd[i].length >= 30 && nd[j].length >= 30 && (nd[i].includes(nd[j]) || nd[j].includes(nd[i]));
      if (trung) { n.trung_voi = i; break; }
    }
  });
  return { nghi_bo_sot: sot.slice(0, 8), tong_bo_sot: sot.length };
}
