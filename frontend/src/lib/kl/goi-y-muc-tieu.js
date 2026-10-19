// Bộ chọn mục tiêu then chốt có gợi ý (v3.25 — "tích sẵn khi căn cứ chắc, còn lại gợi ý một bấm; lãnh đạo không phải bấm"): trạng thái THUẦN của một
// ô chọn (thẻ nhiệm vụ ở Giao việc, mục tiêu văn bản ở khối 1, ngăn chi tiết, một dòng rà soát) — không DOM, không mạng; unit test
// frontend/tests/goi-y-muc-tieu.test.mjs. Trạng thái tt:
//  - chon: Map mã → { nguon, ly_do, tu: 'tich' | 'nguoi', quy_tac } — 'tich' = hệ thống tích sẵn, người dùng chưa đụng (gợi ý đổi theo ô nhập thì
//    bỏ / thêm theo); 'nguoi' = người dùng chọn, bấm gợi ý, hoặc đã gắn từ trước (giữ khi gợi ý đổi).
//  - vb: mục tiêu của văn bản (việc không gắn riêng thì tính theo) — hiện như đã tích, nguồn "theo văn bản"; boVb: mục của văn bản người dùng bỏ;
//    nguonVb: nguồn khai thay cho mục của văn bản khi văn bản CHƯA lưu được các mục đó (thường trống — gắn riêng thì máy chủ chép nguồn của văn bản).
//  - goiY: kết quả goi_y_muc_tieu (máy chủ, 0110) gần nhất — việc đã có: mục người dùng đã bỏ ở việc đó là gợi ý, cờ da_bo (0115); ai: gợi ý của trợ lý
//    AI khi đọc văn bản (chỉ gợi ý, không tự tích).
//  - moi: số hiệu chưa có trong danh mục — { so_hieu, nhom, ve, chon, nguon } (tích sẵn khi nhắc trong trích yếu / nội dung; khi lưu, hệ thống tự thêm
//    vào danh mục — them_muc_tieu_tu_dong 0108); bo: mã / 'SH:<số hiệu>' người dùng đã bỏ tích (lần gợi ý sau không tích lại).
//  - ban: tập mã hiệu lực lúc mở (ngăn chi tiết, rà soát) — gợi ý trùng mục đã có không tính là phản hồi cho quy tắc.
// v3.26 (0116): mục "Không thuộc mục tiêu then chốt" (KHONG_THUOC) là một lựa chọn riêng — chọn nó thì bỏ mọi mục khác; chọn một mục thật thì bỏ nó;
// tập hiệu lực có mục thật thì không kèm nó (văn bản "Không thuộc" mà việc có mục riêng). Người dùng / dữ liệu đã lưu chọn "Không thuộc" (tu 'nguoi'):
// gợi ý chỉ hiện để bấm, không tự tích; trợ lý AI đề xuất "Không thuộc" khi điền (tu 'tich'): mục tích sẵn có căn cứ chắc thay chỗ.
import { KHONG_THUOC } from './muc-tieu.js';

export const TOI_DA = 10;
export const NHAN_NGUON = { CHON: 'Người chọn', QUY_TAC: 'Tích sẵn theo quy tắc', GOI_Y: 'Gợi ý được chọn', AI: 'Trợ lý AI gợi ý', EXCEL: 'Nhập Excel',
  RA_SOAT: 'Chấp nhận khi rà soát', GOP: 'Gộp mục trùng', VAN_BAN: 'Theo văn bản' };
const O = { trich_yeu: 'trích yếu văn bản', noi_dung: 'nội dung', san_pham: 'mô tả sản phẩm', van_ban: 'văn bản' };
const giong = (a, b) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
const khoaSh = (s) => `SH:${String(s || '').toUpperCase()}`;

export function taoBoChon({ rieng = [], nguonRieng = {}, vb = [], nguonVb = {} } = {}) {
  const chon = new Map(rieng.map((ma) => [ma, { nguon: nguonRieng[ma]?.nguon || 'CHON', ly_do: nguonRieng[ma]?.ly_do || null, tu: 'nguoi', quy_tac: [] }]));
  const boVb = new Set(rieng.length ? vb.filter((ma) => !rieng.includes(ma)) : []);   // đã gắn riêng: mục của văn bản không nằm trong phần gắn riêng thì không áp
  const tt = { chon, vb: [...vb], boVb, nguonVb: { ...nguonVb }, goiY: [], ai: [], moi: [], bo: new Set(), ban: [] };
  tt.ban = hieuLuc(tt);
  return tt;
}
export const hieuLuc = (tt) => {
  const ds = [...new Set([...tt.vb.filter((ma) => !tt.boVb.has(ma)), ...tt.chon.keys()])];
  return ds.some((ma) => ma !== KHONG_THUOC) ? ds.filter((ma) => ma !== KHONG_THUOC) : ds;
};
// Đang chọn "Không thuộc" (riêng hoặc theo văn bản), không kèm mục nào.
export const laKhongThuoc = (tt) => { const h = hieuLuc(tt); return h.length === 1 && h[0] === KHONG_THUOC && !tt.moi.some((x) => x.chon); };
export const soDaChon = (tt) => hieuLuc(tt).length + tt.moi.filter((x) => x.chon).length;

// Lý do (máy chủ trả mảng { loai, gia_tri, o }) → câu ngắn. tenLv / tenNganh: (mã) → tên.
export function moTaLyDo(ds, { tenLv = (m) => m, tenNganh = (m) => m } = {}) {
  return (ds || []).map((x) => {
    if (x.loai === 'VAN_BAN') return 'mục tiêu của văn bản';
    if (x.loai === 'SO_HIEU') return `số hiệu ${x.gia_tri} trong ${O[x.o] || 'nội dung'}`;
    if (x.loai === 'LINH_VUC') return `lĩnh vực ${tenLv(x.gia_tri)}`;
    if (x.loai === 'NGANH') return `ngành ${tenNganh(x.gia_tri)}`;
    if (x.loai === 'TU_KHOA') return `“${x.gia_tri}” trong ${O[x.o] || 'nội dung'}`;
    return String(x.gia_tri || '');
  }).filter(Boolean).join('; ');
}
const chiVanBan = (g) => (g.ly_do || []).length > 0 && g.ly_do.every((x) => x.loai === 'VAN_BAN');

// Văn bản đổi (chọn văn bản khác, mục tiêu của văn bản mới ở khối 1 đổi): mục bỏ của văn bản cũ không còn nghĩa.
export function datVanBan(tt, vb = [], nguonVb = {}) {
  tt.vb = [...new Set(vb)]; tt.nguonVb = { ...nguonVb };
  tt.boVb = new Set([...tt.boVb].filter((ma) => tt.vb.includes(ma)));
  return tt;
}

// Kết quả goi_y_muc_tieu (0110): bỏ mục tích sẵn cũ không còn được gợi ý mức tích sẵn; tích mục tích sẵn mới (trừ mục người dùng đã bỏ, mục của văn bản
// — đã hiện theo văn bản); giữ mục người dùng chọn. Mục chỉ vì "mục tiêu của văn bản" bỏ qua (tt.vb lo phần này). Số hiệu mới: tích sẵn.
// moTa: hàm (ly_do[]) → chữ (moTaLyDo có tên lĩnh vực).
export function apGoiY(tt, kq, { moTa = moTaLyDo } = {}) {
  const ds = (kq?.goi_y || []).filter((g) => g?.ma && g.ma !== KHONG_THUOC && !chiVanBan(g));
  const tich = new Map(ds.filter((g) => g.muc === 'TU_TICH').map((g) => [g.ma, g]));
  const khongNguoi = tt.chon.get(KHONG_THUOC)?.tu === 'nguoi';   // người dùng / dữ liệu đã lưu chọn "Không thuộc": không tự tích
  [...tt.chon.entries()].forEach(([ma, x]) => { if (x.tu === 'tich' && x.nguon === 'QUY_TAC' && !tich.has(ma)) tt.chon.delete(ma); });
  tich.forEach((g, ma) => {
    const cu = tt.chon.get(ma);
    if (cu) { if (cu.tu === 'tich') Object.assign(cu, { ly_do: moTa(g.ly_do), quy_tac: g.quy_tac || [] }); return; }
    if (khongNguoi || tt.bo.has(ma) || (tt.vb.includes(ma) && !tt.boVb.has(ma)) || soDaChon(tt) >= TOI_DA) return;
    tt.chon.delete(KHONG_THUOC);   // "Không thuộc" do trợ lý AI đề xuất nhường chỗ mục có căn cứ chắc
    tt.chon.set(ma, { nguon: 'QUY_TAC', ly_do: moTa(g.ly_do), tu: 'tich', quy_tac: g.quy_tac || [] });
  });
  tt.goiY = ds;
  const moiCu = new Map(tt.moi.filter((x) => x.nguon !== 'QUY_TAC').map((x) => [khoaSh(x.so_hieu), x]));   // số hiệu mới do AI nhắc: giữ
  (kq?.so_hieu_moi || []).forEach((x) => { if (x?.so_hieu) moiCu.set(khoaSh(x.so_hieu), { ...x, nguon: 'QUY_TAC', chon: !tt.bo.has(khoaSh(x.so_hieu)) }); });
  tt.moi = [...moiCu.values()];
  return tt;
}
// Gợi ý của trợ lý AI (đọc văn bản): ds = [{ ma, trich, ly_do, xac_minh }] — chỉ hiện để bấm; nhac = số hiệu văn bản nhắc tới chưa có trong danh
// mục [{ so_hieu, nhom, ve }] — hiện như số hiệu mới CHƯA tích.
export function apGoiYAi(tt, ds = [], nhac = []) {
  tt.ai = (ds || []).filter((x) => x?.ma && x.ma !== KHONG_THUOC);
  nhac.forEach((x) => { const k = khoaSh(x.so_hieu); if (x?.so_hieu && !tt.moi.some((m) => khoaSh(m.so_hieu) === k)) tt.moi.push({ ...x, nguon: 'AI', chon: false }); });
  return tt;
}

// Bấm "Điền" từ kết quả trợ lý AI đọc văn bản (v3.26): mục AI đề xuất có câu trích đối chiếu được trong tệp → tích sẵn (nguồn AI, người giao kiểm tra);
// chưa đối chiếu được → chỉ gợi ý; AI không đề xuất mục nào và thẻ chưa có gì → tích sẵn "Không thuộc" (nguồn AI). Mục người dùng đã bỏ không tích lại.
export const LY_DO_AI_KHONG = 'Trợ lý AI đọc văn bản không thấy nhiệm vụ phục vụ mục tiêu then chốt nào';
export function apAiDien(tt, ds = []) {
  const hop = (ds || []).filter((x) => x?.ma && x.ma !== KHONG_THUOC);
  apGoiYAi(tt, hop);
  hop.filter((x) => x.xac_minh).forEach((x) => {
    if (tt.chon.has(x.ma) || tt.bo.has(x.ma) || (tt.vb.includes(x.ma) && !tt.boVb.has(x.ma)) || soDaChon(tt) >= TOI_DA) return;
    if (tt.chon.get(KHONG_THUOC)?.tu === 'nguoi') return;
    tt.chon.delete(KHONG_THUOC); tt.chon.set(x.ma, { nguon: 'AI', ly_do: x.ly_do || null, tu: 'tich', quy_tac: [] });
  });
  if (!hop.length && soDaChon(tt) === 0 && !tt.bo.has(KHONG_THUOC)) tt.chon.set(KHONG_THUOC, { nguon: 'AI', ly_do: LY_DO_AI_KHONG, tu: 'tich', quy_tac: [] });
  return tt;
}
// "Không thuộc mục tiêu then chốt": bỏ mọi mục đang tích (người dùng bỏ → ghi nhớ "đã bỏ", như bấm ×), mục của văn bản không áp; tu 'tich' = hệ thống đề xuất.
export function batKhongThuoc(tt, { nguon = 'CHON', ly_do = null, tu = 'nguoi' } = {}) {
  [...tt.chon.keys()].forEach((ma) => { if (ma !== KHONG_THUOC) { tt.chon.delete(ma); if (tu === 'nguoi') tt.bo.add(ma); } });
  tt.vb.forEach((ma) => { if (ma !== KHONG_THUOC) tt.boVb.add(ma); });
  tt.moi.forEach((x) => { if (x.chon) { x.chon = false; if (tu === 'nguoi') tt.bo.add(khoaSh(x.so_hieu)); } });
  tt.boVb.delete(KHONG_THUOC); tt.bo.delete(KHONG_THUOC);
  tt.chon.set(KHONG_THUOC, { nguon, ly_do, tu, quy_tac: [] });
  return tt;
}
// Người dùng tích một mục (bấm gợi ý: nguon GOI_Y / AI; chọn trong danh mục: CHON). → false khi đã đủ TOI_DA mục.
export function bat(tt, ma, { nguon = 'CHON', ly_do = null } = {}) {
  if (!ma) return false;
  if (ma === KHONG_THUOC) { batKhongThuoc(tt, { nguon, ly_do }); return true; }
  tt.chon.delete(KHONG_THUOC);
  if (tt.vb.includes(ma)) { tt.boVb.delete(ma); tt.bo.delete(ma); return true; }
  if (tt.chon.has(ma)) { Object.assign(tt.chon.get(ma), { tu: 'nguoi' }); return true; }
  if (soDaChon(tt) >= TOI_DA) return false;
  const g = tt.goiY.find((x) => x.ma === ma);
  tt.chon.set(ma, { nguon, ly_do, tu: 'nguoi', quy_tac: g?.quy_tac || [] });
  tt.bo.delete(ma);
  return true;
}
export function tat(tt, ma) {
  if (tt.chon.has(ma)) tt.chon.delete(ma);
  if (tt.vb.includes(ma)) tt.boVb.add(ma);
  tt.bo.add(ma);
  return tt;
}
export function batMoi(tt, soHieu, chon = true) {
  const x = tt.moi.find((m) => khoaSh(m.so_hieu) === khoaSh(soHieu));
  if (!x) return false;
  if (chon && !x.chon && soDaChon(tt) >= TOI_DA) return false;
  if (chon) tt.chon.delete(KHONG_THUOC);
  x.chon = chon;
  if (chon) tt.bo.delete(khoaSh(soHieu)); else tt.bo.add(khoaSh(soHieu));
  return true;
}

// Cho giao diện: mục đang tích (hiệu lực) kèm nguồn; số hiệu mới; gợi ý chưa tích (quy tắc trước, rồi AI).
export function dsHien(tt) {
  const daChon = hieuLuc(tt).map((ma) => { const x = tt.chon.get(ma); return x ? { ma, ...x, theoVb: false } : { ma, nguon: 'VAN_BAN', ly_do: 'mục tiêu của văn bản', tu: 'vb', theoVb: true }; });
  const co = new Set(daChon.map((x) => x.ma));
  const goiY = tt.goiY.filter((g) => !co.has(g.ma)).map((g) => ({ ma: g.ma, nguon: 'GOI_Y', muc: g.muc, ly_do: g.ly_do, quy_tac: g.quy_tac || [], da_bo: Boolean(g.da_bo) }));
  const ai = tt.ai.filter((g) => !co.has(g.ma) && !goiY.some((x) => x.ma === g.ma)).map((g) => ({ ma: g.ma, nguon: 'AI', ly_do: g.ly_do, trich: g.trich, xac_minh: g.xac_minh }));
  return { daChon, moi: tt.moi, goiY: [...goiY, ...ai] };
}

// Kết quả để lưu. maMoi: Map số hiệu → mã (sau them_muc_tieu_tu_dong); số hiệu mới chưa có mã thì chưa tính. theoVb = không cần gắn riêng (tập hiệu
// lực trùng mục tiêu văn bản, hoặc trống) — lưu thì bỏ gắn riêng / không gắn. nguon không có mục của văn bản (trừ tt.nguonVb): gắn riêng thì máy chủ
// chép nguồn, lý do của văn bản (gan_muc_tieu 0110).
export function ketQua(tt, maMoi = new Map()) {
  const nguon = {}; const ma = hieuLuc(tt);
  ma.forEach((m) => { const x = tt.chon.get(m) || tt.nguonVb?.[m]; if (x) nguon[m] = { nguon: x.nguon || 'CHON', ly_do: x.ly_do || null }; });
  tt.moi.filter((x) => x.chon).forEach((x) => {
    const m = maMoi.get(khoaSh(x.so_hieu)) || maMoi.get(x.so_hieu);
    if (m && !ma.includes(m) && ma.length < TOI_DA) { ma.push(m); nguon[m] = { nguon: x.nguon === 'AI' ? 'AI' : 'QUY_TAC', ly_do: `Số hiệu ${x.so_hieu}${x.ve ? ` ${x.ve}` : ''}`.slice(0, 300) }; }
  });
  if (ma.length > 1 && ma.includes(KHONG_THUOC)) { ma.splice(ma.indexOf(KHONG_THUOC), 1); delete nguon[KHONG_THUOC]; }
  const theoVb = ma.length === 0 || (tt.vb.length > 0 && giong(ma, tt.vb));
  return { ma, nguon, theoVb, moi: tt.moi.filter((x) => x.chon).map((x) => ({ so_hieu: x.so_hieu, ve: x.ve || null })) };
}
export const khoaSoHieu = khoaSh;

// Phản hồi cho bộ tự học (ghi_phan_hoi_goi_y, 0111): mỗi gợi ý theo quy tắc đã hiện → GIU (tích sẵn, giữ) | BO (tích sẵn, bỏ) | THEM (gợi ý, bấm thêm) |
// BO_QUA (gợi ý, không bấm). Mục đã có từ trước (tt.ban) giữ lại thì không tính; BỎ mục đã có mà quy tắc tích sẵn → ghi BO (kiểm tay 18/10: không ghi
// thì lần mở sau ở ngăn chi tiết / Rà soát tự tích lại mục vừa bỏ — goi_y_muc_tieu_viec chỉ hạ thành gợi ý khi quy tắc căn cứ đã bị bỏ ở việc đó).
// Gợi ý "đã bỏ ở việc này" (da_bo — 0115) vẫn không chọn → không gửi (BO_QUA ghi đè trí nhớ BO của máy chủ khi quy tắc đã đổi mức); chọn lại → THEM.
// BO chỉ khi người dùng bỏ (tt.bo): mục tích sẵn không được tích vì đã đủ TOI_DA mục thì không tính (người dùng chưa thấy nó được tích).
export function phanHoi(tt, maCuoi) {
  const cuoi = new Set(maCuoi || hieuLuc(tt));
  const khongGiu = (g) => g.muc === 'TU_TICH' && !cuoi.has(g.ma);
  return tt.goiY.filter((g) => (g.quy_tac || []).length && !(g.da_bo && !cuoi.has(g.ma)) && !(khongGiu(g) && !tt.bo.has(g.ma))
      && (!tt.ban.includes(g.ma) || khongGiu(g)))
    .map((g) => ({ quy_tac: g.quy_tac, ket_qua: g.muc === 'TU_TICH' ? (cuoi.has(g.ma) ? 'GIU' : 'BO') : (cuoi.has(g.ma) ? 'THEM' : 'BO_QUA') }));
}
// Kết quả nhận diện của việc sau khi lưu, như máy chủ sẽ trả (0115): mục tích sẵn có quy tắc mà không nằm trong tập đã lưu (đã gửi phản hồi "bỏ") thành
// gợi ý "đã bỏ ở việc này"; số hiệu mới vừa được thêm vào danh mục (daThem: Map khoá số hiệu → mã) không còn là "số hiệu mới" — màn Rà soát dùng lại kết
// quả cũ mà không tích lại, không coi là còn phải lưu.
export const sauKhiLuu = (kq, maCuoi = [], daThem = new Map()) => ({ ...kq,
  goi_y: (kq?.goi_y || []).map((g) => (g?.muc === 'TU_TICH' && (g.quy_tac || []).length && !maCuoi.includes(g.ma) ? { ...g, muc: 'GOI_Y', da_bo: true } : g)),
  so_hieu_moi: (kq?.so_hieu_moi || []).filter((x) => !daThem.has(khoaSh(x?.so_hieu))) });
