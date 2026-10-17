// Giao việc — mục tiêu then chốt (v3.25, 0107–0111; thay khối dùng chung ở "Thông tin thêm" của v3.24): mỗi thẻ nhiệm vụ một ô chọn có gợi ý
// (views/shared/kl/chon-muc-tieu.js — khoá 'gv1' cho thẻ 1, 'gv-<khoá thẻ>' cho thẻ 2…20); khối 1 có ô "Mục tiêu then chốt của văn bản" khi nhập văn
// bản MỚI (không phải Thường trực — Thường trực luôn gắn từng việc) — mọi thẻ tính theo, từng thẻ thêm / bỏ được; văn bản có sẵn: một dòng chỉ xem
// mục tiêu đang gắn của văn bản. Bộ nhận diện (goi_y_muc_tieu — 0110) chạy lại ~0,6 giây sau khi đổi văn bản, số hiệu, trích yếu, nội dung, mô tả sản
// phẩm, ngành, lĩnh vực. Lưu (ganSauGiao, sau giao_viec / giao_viec_nhieu): số hiệu mới đang tích → hệ thống thêm vào danh mục (them_muc_tieu_tu_dong);
// văn bản TẠO MỚI trong lượt → gắn cho văn bản; từng việc khác mục tiêu của văn bản → gắn riêng đủ tập kèm nguồn; phản hồi cho bộ tự học chạy nền.
// Lỗi khi gắn không làm mất việc đã giao (báo rõ, gắn lại ở ngăn chi tiết). DB là chốt quyền.
import { $, escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { notifyError } from '../../../components/toast.js';
import { danhMucKl, loadDanhMucKl } from '../../../lib/kl/du-lieu.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { timMucTieu, sapTheoDanhMuc } from '../../../lib/kl/muc-tieu.js';
import { taoBoChon, apGoiY, apGoiYAi, datVanBan, hieuLuc, ketQua, phanHoi, bat, khoaSoHieu } from '../../../lib/kl/goi-y-muc-tieu.js';
import { goiYMucTieu, docMucTieuVanBan, ganMucTieu, ganMucTieuVanBan, vanBanTaoCungViec, themMucTieuTuDong, ghiPhanHoiGoiY } from '../../../lib/kl/muc-tieu-db.js';
import { dangKyO, boO, khungHtml, veO, layO, datTrangThai, lyDoChu } from '../kl/chon-muc-tieu.js';
import { MOI, timTrongDs } from './van-ban.js';

export const KHOA_VB = 'gvVb'; export const KHOA_1 = 'gv1';
const gv = { vbDb: [], luotVb: 0, hen: new Map(), luot: new Map(), coDm: false, khoa: new Set() };
const laA0 = () => state.user?.role_group === 'A0';
const laMoiVb = () => $('klThVanBan')?.value === MOI;
const vanBanCo = () => (laMoiVb() ? null : timTrongDs($('klThVanBan')?.value) || null);
export const hienVb = () => gv.coDm && laMoiVb() && !laA0();
export const khoaThe = (the) => (the?.id === 'gvThe1' ? KHOA_1 : `gv-${the?.dataset.khoa}`);
const theCua = (k) => (k === KHOA_1 ? $('gvThe1') : document.querySelector(`#gvLuoiThan .gv-nv[data-khoa="${CSS.escape(k.slice(3))}"]`));
// Khoá ô của mọi thẻ theo thứ tự hiện (dòng 1 = thẻ 1) — ghép kết quả giao_viec_nhieu (viec[].dong) với ô chọn của thẻ.
export const khoaCacThe = () => [KHOA_1, ...[...document.querySelectorAll('#gvLuoiThan .gv-nv')].map((t) => khoaThe(t))];
export const dsKhoaThe = () => [KHOA_1, ...[...document.querySelectorAll('#gvLuoiThan .gv-nv')].map((t) => `gv-${t.dataset.khoa}`)].filter((k) => layO(k));
const O1 = { noi_dung: 'klThNoiDung', san_pham_mo_ta: 'klThSanPhamMoTa', nganh: 'klThNganh', linh_vuc: 'klThLinhVuc' };
const giaTri = (k, cot) => String((k === KHOA_1 ? $(O1[cot]) : theCua(k)?.querySelector(`[data-cot="${cot}"]`))?.value || '').trim();
// Mục tiêu của văn bản mà các thẻ tính theo: văn bản mới → ô của khối 1; văn bản có sẵn → DB; Thường trực + văn bản mới → không có.
const vbCuaThe = () => (hienVb() ? hieuLuc(layO(KHOA_VB)?.tt || taoBoChon()) : laMoiVb() ? [] : gv.vbDb);
const CHU_THE = 'hệ thống tự nhận diện theo văn bản, nội dung, ngành, lĩnh vực — mục có căn cứ chắc được tích sẵn; bấm gợi ý để thêm (không bắt buộc)';

function dauVaoThe(k) {
  const v = vanBanCo();
  return { van_ban_id: v?.id || null, so_hieu_van_ban: (laMoiVb() ? $('klThSoKL').value.trim() : v?.so_ket_luan) || null,
    trich_yeu: (laMoiVb() ? $('klThTrichYeu').value.trim() : v?.trich_yeu) || null,
    noi_dung: giaTri(k, 'noi_dung'), san_pham_mo_ta: giaTri(k, 'san_pham_mo_ta'), nganh: giaTri(k, 'nganh') || null, linh_vuc: giaTri(k, 'linh_vuc') || null };
}
const dauVaoVb = () => ({ so_hieu_van_ban: $('klThSoKL').value.trim() || null, trich_yeu: $('klThTrichYeu').value.trim() || null });

export function henGoiY(k, ms = 600) { clearTimeout(gv.hen.get(k)); gv.hen.set(k, setTimeout(() => chayGoiY(k), ms)); }
async function chayGoiY(k) {
  const x = layO(k); if (!x) return;
  const p = k === KHOA_VB ? dauVaoVb() : dauVaoThe(k);
  const lan = (gv.luot.get(k) || 0) + 1; gv.luot.set(k, lan);
  if (!Object.values(p).some(Boolean)) { apGoiY(x.tt, { goi_y: [], so_hieu_moi: [] }); datTrangThai(k, ''); veO(k); if (k === KHOA_VB) truyenVanBan(); return; }
  datTrangThai(k, 'Đang nhận diện mục tiêu…');
  try {
    const kq = await goiYMucTieu(p);
    if (gv.luot.get(k) !== lan || layO(k) !== x) return;
    apGoiY(x.tt, kq, { moTa: lyDoChu }); datTrangThai(k, ''); veO(k);
    if (k === KHOA_VB) truyenVanBan();
  } catch { if (gv.luot.get(k) === lan) datTrangThai(k, 'Chưa nhận diện được — có thể chọn từ danh mục.'); }
}

// Mục tiêu văn bản đổi (ô khối 1, văn bản khác) → các thẻ: mục tính theo văn bản đổi theo; mục người dùng bỏ ở văn bản không tự tích lại ở thẻ.
function truyenVanBan() {
  const vb = vbCuaThe(); const bo = hienVb() ? layO(KHOA_VB)?.tt.bo || new Set() : new Set();
  dsKhoaThe().forEach((k) => {
    const x = layO(k); datVanBan(x.tt, vb);
    bo.forEach((m) => { if (vb.includes(m)) return; x.tt.bo.add(m); if (x.tt.chon.get(m)?.tu === 'tich') x.tt.chon.delete(m); });
    veO(k);
  });
}

function moO(k, el, opts) {
  if (!el) return;
  dangKyO(k, taoBoChon({ vb: k === KHOA_VB ? [] : vbCuaThe() }), { khiDoi: k === KHOA_VB ? truyenVanBan : () => {} }); gv.khoa.add(k);
  el.innerHTML = khungHtml(k, opts);
  veO(k);
}
// Thẻ 2…20 (nhieu-the.js taoThe / xoá thẻ).
export function ganTheMucTieu(the) { if (!gv.coDm) return; const k = khoaThe(the); moO(k, the.querySelector('[data-mtg-cho]'), { chuThich: CHU_THE }); henGoiY(k, 60); }
export function boTheMucTieu(the) { const k = khoaThe(the); clearTimeout(gv.hen.get(k)); boO(k); gv.khoa.delete(k); }

const chipXem = (ma) => { const m = timMucTieu(danhMucKl().mucTieu, ma); return `<span class="mtg-chip" data-nguon="VAN_BAN" title="${escapeHtml(m?.ten || ma)}"><span class="mtg-ten">${escapeHtml(m?.ten_ngan || ma)}</span></span>`; };
const xemVbHtml = (md) => (md.length ? `<div class="gv-mt-vb-xem"><span class="nhan">Mục tiêu then chốt của văn bản</span>${sapTheoDanhMuc(md, danhMucKl().mucTieu, danhMucKl().nhomMucTieu).map(chipXem).join('')}
    <small class="chu-phu">nhiệm vụ không chọn riêng thì tính theo; sửa mục tiêu của văn bản ở ngăn chi tiết của một việc thuộc văn bản.</small></div>`
  : '<p class="gv-mt-vb-xem chu-phu">Văn bản chưa gắn mục tiêu then chốt — chọn ở từng nhiệm vụ (hoặc gắn cho cả văn bản ở ngăn chi tiết của một việc).</p>');

// Văn bản đổi (chọn văn bản khác, "Văn bản mới" ↔ có sẵn): ô / dòng mục tiêu của văn bản ở khối 1, rồi truyền xuống các thẻ và nhận diện lại.
export async function vanBanDoiMucTieu() {
  if (!gv.coDm || !$('gvMtVb')) return;
  const el = $('gvMtVb'); const lan = ++gv.luotVb;
  if (hienVb()) {
    if (!layO(KHOA_VB)) moO(KHOA_VB, el, { nhan: 'Mục tiêu then chốt của văn bản', chuThich: 'mọi nhiệm vụ của văn bản tính theo; từng nhiệm vụ thêm / bỏ ở thẻ của mình' });
    gv.vbDb = []; henGoiY(KHOA_VB, 60);
  } else {
    if (layO(KHOA_VB)) { boO(KHOA_VB); gv.khoa.delete(KHOA_VB); }
    const v = vanBanCo(); let md = [];
    if (v) { el.innerHTML = '<p class="gv-mt-vb-xem chu-phu">Đang đọc mục tiêu của văn bản…</p>'; try { md = await docMucTieuVanBan(v.id); } catch { md = []; } }
    if (lan !== gv.luotVb) return;
    gv.vbDb = md; el.innerHTML = v ? xemVbHtml(md) : '';
  }
  truyenVanBan();
  dsKhoaThe().forEach((k) => henGoiY(k, 300));
}

// Mở biểu mẫu: bỏ mọi ô của lượt trước; danh mục trống (project chưa áp 0105) → không vẽ gì.
export function datLaiMucTieuGv() {
  gv.khoa.forEach((k) => { clearTimeout(gv.hen.get(k)); boO(k); }); gv.khoa.clear(); gv.vbDb = [];
  gv.coDm = (danhMucKl().mucTieu || []).length > 0;
  if ($('gvMtVb')) $('gvMtVb').innerHTML = '';
  if ($('gvMtg1')) $('gvMtg1').innerHTML = '';
  if (!gv.coDm) return;
  moO(KHOA_1, $('gvMtg1'), { chuThich: CHU_THE });
  vanBanDoiMucTieu();
}
// "Giao, nhập tiếp": thẻ 1 về trống (văn bản giữ nguyên — đọc lại mục tiêu của văn bản vừa tạo).
export function datLaiTheMot() { if (!gv.coDm) return; boO(KHOA_1); gv.khoa.delete(KHOA_1); moO(KHOA_1, $('gvMtg1'), { chuThich: CHU_THE }); vanBanDoiMucTieu(); }

// Ô nhập đổi (gắn một lần ở biểu mẫu): văn bản mới (số hiệu, trích yếu) → ô văn bản + mọi thẻ; ô của một thẻ → thẻ đó.
export function ganSuKienMucTieu() {
  const xu = (e) => {
    const t = e.target; if (!gv.coDm || !t || t.closest?.('.mtg')) return;
    if (t.id === 'klThSoKL' || t.id === 'klThTrichYeu') { if (hienVb()) henGoiY(KHOA_VB); dsKhoaThe().forEach((k) => henGoiY(k, 900)); return; }
    if (Object.values(O1).includes(t.id)) { henGoiY(KHOA_1); return; }
    if (['noi_dung', 'san_pham_mo_ta', 'nganh', 'linh_vuc'].includes(t.dataset?.cot)) { const the = t.closest('.gv-nv'); if (the) henGoiY(khoaThe(the)); }
  };
  ['input', 'change'].forEach((loai) => $('giaoViecForm').addEventListener(loai, xu));
}

// Hoàn thiện dòng nhập Excel: mục tiêu ghi trong tệp — người nhập đã chọn (nguồn CHON) cho thẻ 1.
export function datMucTieuGv(ma = []) {
  const x = layO(KHOA_1); if (!x) return;
  ma.forEach((m) => bat(x.tt, m, { nguon: 'CHON' })); veO(KHOA_1);
}
// Trợ lý AI đọc văn bản (doc-ai.js): gợi ý cho văn bản (ô khối 1, không có thì thẻ 1) và cho từng thẻ — chỉ hiện để bấm, không tự tích.
export function apAiVanBan(ds = [], nhac = []) {
  const k = hienVb() ? KHOA_VB : KHOA_1; const x = layO(k); if (!x) return;
  apGoiYAi(x.tt, [...x.tt.ai, ...ds].filter((g, i, a) => a.findIndex((y) => y.ma === g.ma) === i), nhac); veO(k);
}
export function apAiThe(the, ds = []) { const k = khoaThe(the); const x = layO(k); if (!x) return; apGoiYAi(x.tt, ds); veO(k); }

const giong = (a, b) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
let sauGiao = () => {};   // doc-ai.js: đánh dấu nhiệm vụ đọc từ văn bản đã giao
export const khiDaGiao = (fn) => { sauGiao = fn; };
// Sau khi giao thành công. viec: [{ id, khoa }] theo thứ tự thẻ; vbId: văn bản của lượt; vbMoi: lượt chọn "Văn bản mới".
export async function ganSauGiao({ vbId, vbMoi, viec = [] }) {
  try { sauGiao({ vbId, viec }); } catch { /* đánh dấu đọc văn bản không chặn gắn mục tiêu */ }
  if (!gv.coDm || !viec.length) return;
  const loi = []; const xVb = vbMoi && hienVb() ? layO(KHOA_VB) : null;
  const moi = new Map();
  [xVb, ...viec.map((v) => layO(v.khoa))].filter(Boolean).forEach((x) => x.tt.moi.filter((m) => m.chon).forEach((m) => moi.set(khoaSoHieu(m.so_hieu), m)));
  const maMoi = new Map();
  for (const [k, m] of moi) { try { const r = await themMucTieuTuDong(m.so_hieu, m.ve || null); if (r?.ma) maMoi.set(k, r.ma); } catch (e) { loi.push(`số hiệu ${m.so_hieu}: ${loiDeHieu(e)}`); } }
  if (maMoi.size) await loadDanhMucKl(true).catch(() => null);
  let vbThat = [];   // mục tiêu văn bản đang có trong DB sau bước này (việc trùng tập này thì tính theo văn bản)
  if (vbId && xVb) {
    const k = ketQua(xVb.tt, maMoi);
    const taoMoi = await vanBanTaoCungViec(vbId, viec[0].id).catch(() => false);
    if (taoMoi && k.ma.length) { try { await ganMucTieuVanBan(vbId, k.ma, k.nguon); vbThat = k.ma; } catch (e) { if (e.code !== '42501') loi.push(`văn bản: ${loiDeHieu(e)}`); } }
    else if (!taoMoi) vbThat = await docMucTieuVanBan(vbId, { tuoi: true }).catch(() => []);   // trùng khoá văn bản có sẵn: không đổi mục tiêu của văn bản người khác
    const nguonVb = giong(vbThat, k.ma) ? {} : k.nguon;   // văn bản chưa lưu được các mục này: thẻ gắn riêng khai nguồn của ô khối 1
    viec.forEach((v) => { const x = layO(v.khoa); if (x) datVanBan(x.tt, k.ma, nguonVb); });   // thẻ tính theo đúng tập đồng chí thấy ở khối 1 (kể cả số hiệu vừa thêm)
  } else if (vbId) vbThat = await docMucTieuVanBan(vbId, { tuoi: true }).catch(() => []);
  const phan = [];
  for (const v of viec) {
    const x = layO(v.khoa); if (!x) continue;
    const k = ketQua(x.tt, maMoi);
    if (k.ma.length && !giong(k.ma, vbThat)) { try { await ganMucTieu(v.id, k.ma, k.nguon); } catch (e) { loi.push(`${v.ma || 'việc'}: ${loiDeHieu(e)}`); } }   // tuần tự (≤ 20 việc)
    phan.push([v.id, phanHoi(x.tt, k.ma)]);   // theo tập đồng chí để lại trên thẻ (kể cả khi lưu thành "theo văn bản")
  }
  (async () => { for (const [id, ds] of phan) await ghiPhanHoiGoiY(id, ds); })();   // tự học: chạy nền, lỗi bỏ qua
  if (loi.length) notifyError(`Đã giao việc nhưng chưa gắn được mục tiêu then chốt (${loi[0]}${loi.length > 1 ? `; và ${loi.length - 1} lỗi khác` : ''}). Đồng chí gắn lại trong ngăn chi tiết của việc.`);
}
