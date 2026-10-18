// Rà soát kết quả tách nhiệm vụ ở máy chủ (v3.25 — đợt sửa gộp 18/10/2026, chủ dự án: "không chấp nhận việc dùng AI mà đọc hiểu văn bản mà các nhiệm
// vụ hiểu sai"): (1) câu / ý có dấu hiệu giao việc mà không nhiệm vụ nào phủ → "có thể còn sót" (tối đa 8, kèm số trang, NGUYÊN VĂN chữ của tệp — người
// giao xem lại, bấm thêm vào danh sách); (2) nhiệm vụ trùng (cùng đoạn văn bản, cùng đơn vị chủ trì, cùng hạn, cùng sản phẩm) → trung_voi (không điền khi
// "Điền tất cả"). Chỉ là cảnh báo cho người giao — không tự thêm, không tự bỏ nhiệm vụ. Thuần — unit test frontend/tests/tro-ly-ai-doi-chieu.test.mjs.
import { boDau, chuanTrich } from './chuan-hoa.js';
import { trangCua, viTriChuan, capCua, treo, hetCauTai } from './van-ban-goc.js';

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
const giao = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));
const tuCua = (s) => new Set(boDau(String(s || '')).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2));
const soCua = (s) => new Set((String(s || '').match(/\d+/g) || []).map((x) => x.replace(/^0+(?=\d)/, '')));

// Đơn vị rà: một câu, hoặc một ý liệt kê — cắt sau . ! ? (không tính dấu chấm của ký hiệu "2.1.", "TP."), sau ":" / ";" cuối dòng, trước mỗi ý mới.
function cacCau(goc) {
  const t = goc.text; const cat = new Set(goc.muc.map(([x]) => x));
  for (const m of t.matchAll(/[.!?]/g)) { const h = hetCauTai(goc, m.index); if (h) cat.add(h); }
  for (const m of t.matchAll(/[:;](?=\n)/g)) cat.add(m.index + 1);
  const ds = []; let a = 0;
  for (const b of [...cat].sort((x, y) => x - y)) { if (b > a) ds.push([a, b]); a = Math.max(a, b); }
  if (a < t.length) ds.push([a, t.length]);
  return ds;
}
// Câu dẫn giao việc mà một ý thừa hưởng: lần lên các câu dẫn đang mở (bỏ qua câu dẫn không giao việc — "a) Về du lịch:"), dừng ở ý / tiêu đề mục không phải
// câu dẫn ("3. Kết quả thực hiện năm 2025": các ý dưới nó thuộc nó, không thuộc câu dẫn "… yêu cầu:" ở trước — rà soát độc lập lần 2).
const danGiao = (dan) => { for (let k = dan.length - 1; k >= 0; k--) { if (!dan[k].dan) return null; if (dan[k].giao) return dan[k]; } return null; };

// tim[j]: kết quả timNhiemVu (null = chưa định vị được), ke[j]: khoảng của nhiệm vụ j (van-ban-goc.js khoang); nv[j]: nhiệm vụ đã xác minh;
// dauVb: docDau (phần đầu trang 1 — không rà sót, chỉ ghi nhận câu dẫn ở đó).
export function raSoat(goc, tim, ke, nv, dauVb) {
  const phu = tim.flatMap((k) => (k ? k.phan.map((d) => [d.s, d.e]) : []));
  const sau = ke.flatMap((ks) => (ks ? [ks[ks.length - 1]] : []));
  const t = goc.text; const nn = /(?:^|\n)\s*N[ơo]i\s*nh[ậa]n\b/u.exec(t); const het = nn ? nn.index : t.length;
  const pl = nn ? /\nPH[ỤU] ?L[ỤU]C\b/u.exec(t.slice(het)) : null; const lai = pl ? het + pl.index : t.length;   // phụ lục sau "Nơi nhận" vẫn rà
  const dau = dauVb?.hetDau || 0;
  // ung: các câu có thể còn sót; dan: các ý / câu dẫn đang mở { cap (-1: câu dẫn không ký hiệu), L (cấp các ý của câu dẫn không ký hiệu), dan, giao, chu };
  // chuoi: câu dẫn không ký hiệu đang có các ý KHÔNG ký hiệu (mỗi ý kết thúc bằng ";", ý cuối bằng ".").
  const ung = []; const dan = []; let chuoi = null;
  if (goc.co) {
    for (let [a, b] of cacCau(goc)) {
      if (a >= het && b <= lai) continue;
      const trongDau = b <= dau; if (!trongDau && a < dau) a = dau;   // câu dính phần đầu: chỉ lấy phần sau
      const lech = t.slice(a, b).length - t.slice(a, b).trimStart().length; const mk = goc.mucTai.get(a + lech);
      const cap = mk === undefined ? null : capCua(mk);
      const chu = t.slice(a, b).replace(/\s+/g, ' ').trim(); const bd = boDau(chu); const laDan = chu.endsWith(':');
      const rieng = MANH.some((r) => r.test(bd));   // ý tự có dấu hiệu giao việc → không ghép câu dẫn
      let dg = null;
      if (cap !== null) {   // ý cùng cấp / cấp cao hơn đóng các ý đang mở; câu dẫn không ký hiệu hết phạm vi ở ý cấp cao hơn các ý của nó
        while (dan.length && (dan.at(-1).cap >= cap || (dan.at(-1).cap < 0 && dan.at(-1).L !== null && cap < dan.at(-1).L))) dan.pop();
        if (dan.length && dan.at(-1).cap < 0 && dan.at(-1).L === null) dan.at(-1).L = cap;
        dg = danGiao(dan); chuoi = null;
      } else if (laDan) dan.length = 0;
      else if (chuoi) {   // ý không ký hiệu: chỉ khi là danh sách ("…;" — câu văn xuôi ngay sau câu dẫn không tính)
        const y = chu.endsWith(';'); if (y || chuoi.ds) dg = chuoi.x.giao ? chuoi.x : null;
        chuoi = y ? { x: chuoi.x, ds: true } : null;
      }
      if (rieng) dg = null;
      if (laDan || cap !== null) {
        const x = { cap: cap ?? -1, L: null, dan: laDan, giao: laDan && (rieng || DAN_GIAO.test(bd)), chu: mk ? chu.slice(mk.length).trim() : chu };
        dan.push(x); if (laDan) chuoi = cap === null ? { x, ds: false } : null;
      }
      if (laDan || trongDau) continue;   // câu dẫn: không rà chính nó; phần đầu văn bản: không rà
      const s = viTriChuan(goc, a); const e = viTriChuan(goc, b);
      if (e - s < 25) continue;
      if (!(dg || rieng) && !(YEU.test(bd) && !sau.some(([x, y]) => giao(s, e, x, y) > 0))) continue;
      if (laCauKet(bd)) continue;
      if (phu.reduce((n, [x, y]) => n + giao(s, e, x, y), 0) >= 0.4 * (e - s)) continue;
      // Nguyên văn ý (như đề bài quy tắc 4c: câu dẫn + ý); bỏ dòng tiêu đề mục ngắn dính ở đầu ("3. Tổ chức thực hiện" — chỉ ký hiệu I., 1., 1.1., a); dòng
      // treo như "- Sở Nội vụ phối hợp" là đầu câu, không phải tiêu đề), dấu ; cuối ý.
      let tho = t.slice(a, b).trimStart(); if (mk) tho = tho.slice(mk.length);
      const td = /^ ?([^\n]{1,60})\n(?=\p{Lu})/u.exec(tho);
      if (cap !== null && cap <= 3 && td && td[1].trim().split(/\s+/).length <= 6 && !/[.,;:]\s*$/.test(td[1]) && !treo(td[1], tho.slice(td[0].length, td[0].length + 16))
        && !MANH.some((r) => r.test(boDau(td[1])))) tho = tho.slice(td[0].length);
      const y = tho.replace(/\s+/g, ' ').trim().replace(/\s*[;,]$/, '');
      const noi = (dg && dg.chu.length <= 300 ? `${dg.chu} ${y}` : y).slice(0, 1500);
      ung.push({ trang: trangCua(goc, a), chu: noi, tu: tuCua(noi), so: soCua(noi) });
    }
  }
  // Nhiệm vụ AI đã tách nhưng chép khác văn bản (không định vị được) che NHIỀU NHẤT MỘT câu — câu giống nhất: có đủ các số và tên đơn vị chủ trì của nhiệm vụ,
  // trùng ≥ 60% từ. Không che câu khác chỉ giống phần chữ chung chung (rà soát độc lập lần 2: một nhiệm vụ chép khác làm mất cảnh báo nhiệm vụ bị sót).
  const che = new Set();
  nv.forEach((n, j) => {
    const w = tuCua(n.noi_dung?.gia_tri);
    if (tim[j] || w.size < 6) return;
    const so = soCua(n.noi_dung?.gia_tri); const ct = tuCua(n.don_vi_chu_tri?.gia_tri); let tot = -1; let diem = 0.6;
    ung.forEach((u, k) => {
      if (che.has(k) || [...so].some((x) => !u.so.has(x)) || [...ct].some((x) => !u.tu.has(x))) return;
      const chung = [...w].filter((x) => u.tu.has(x)).length; const d = chung / (w.size + u.tu.size - chung);
      if (d >= diem) { diem = d; tot = k; }
    });
    if (tot >= 0) che.add(tot);
  });
  const sot = ung.filter((_, k) => !che.has(k)).map(({ trang, chu }) => ({ trang, chu }));
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
