// Phần bảng chi tiết của hộp "Nhập kỳ số liệu" giải ngân (v3.28): hai thẻ — theo nguồn vốn, theo chủ đầu tư / đơn vị. Mỗi thẻ: chọn tệp Excel (.xlsx —
// số gốc) hoặc dán bảng (Ctrl+V: bảng HTML của Excel / Word / web, chữ có tab, chữ chép từ PDF) → xem trước: chọn trang tính, cột tên / kế hoạch / đã
// giải ngân, dòng bắt đầu, đơn vị, kiểu số; tích từng dòng (dòng tổng, dòng lỗi, dòng trùng tên không tích sẵn); khớp tên với các kỳ trước ("gần
// giống" → mặc định dùng tên kỳ trước để giữ đúng đối tượng mà nhiệm vụ đã gắn). Máy nhớ cách chọn cột, đơn vị theo loại bảng (localStorage — lỗi thì
// bỏ qua; chỉ dùng khi bảng không có dòng tiêu đề nhận ra được). Hàm đọc bảng thuần: lib/kl/giai-ngan-bang.js.
import { escapeHtml } from '../../../lib/dom.js';
import { notifyError } from '../../../components/toast.js';
import { bangTuDan, doanCot, docBang, doanKieuSo, goiYDonVi, dongTong, khopTen, TEN_DON_VI } from '../../../lib/kl/giai-ngan-bang.js';
import { soVN, ptVN, tyLe } from '../../../lib/kl/giai-ngan.js';

export const LOAI_BANG = ['NGUON', 'CHU_DAU_TU'];
const TEN = { NGUON: 'nguồn vốn', CHU_DAU_TU: 'chủ đầu tư, đơn vị' };
const moi = () => ({ goc: null, nguon: '', sheets: null, sheet: 0, cot: { ten: 0, kh: 1, da: 2 }, tuDong: 0, kieu: 'vi', donVi: 'ty', chon: new Map(), tenCu: new Map(), ds: [] });
const st = { tab: 'NGUON', truoc: { NGUON: [], CHU_DAU_TU: [] }, b: { NGUON: moi(), CHU_DAU_TU: moi() }, onDoi: () => {} };
const khoaNho = (loai) => `vptu.gn.bang.${loai}`;
const docNho = (loai) => { try { return JSON.parse(localStorage.getItem(khoaNho(loai)) || 'null'); } catch { return null; } };
const $ = (id) => document.getElementById(id);

// truoc: tên các kỳ khác cùng năm theo loại ([{ ten, ten_chuan }]); cu: dòng của kỳ đang sửa (mở sẵn như một bảng đã đọc).
export function datLaiBang({ truoc = {}, cu = [] } = {}) {
  st.tab = 'NGUON'; st.truoc = { NGUON: truoc.NGUON || [], CHU_DAU_TU: truoc.CHU_DAU_TU || [] };
  for (const loai of LOAI_BANG) {
    st.b[loai] = moi();
    const ds = cu.filter((x) => x.loai === loai).sort((a, b) => a.thu_tu - b.thu_tu);
    if (ds.length) Object.assign(st.b[loai], { goc: [['Tên', 'Kế hoạch', 'Đã giải ngân'], ...ds.map((x) => [x.ten, x.ke_hoach ?? '', x.da_giai_ngan ?? ''])], nguon: 'kỳ đã lưu', tuDong: 1 });
    docLai(loai);
  }
  ve();
}
export const datTenTruoc = (truoc) => { st.truoc = { NGUON: truoc.NGUON || [], CHU_DAU_TU: truoc.CHU_DAU_TU || [] }; LOAI_BANG.forEach(docLai); ve(); };

function docLai(loai) {
  const b = st.b[loai];
  b.ds = b.goc ? docBang(b.goc, b).map((d) => ({ ...d, khop: d.loi || d.laTong ? null : khopTen(d.tenChuan, st.truoc[loai]) })) : [];
}
const laChon = (b, d) => (b.chon.has(d.dong) ? b.chon.get(d.dong) : d.chon) && !d.loi;
const tenLuu = (b, d) => (d.khop?.kieu === 'gan' && b.tenCu.get(d.dong) !== false ? { ten: d.khop.ten, ten_chuan: d.khop.tenChuan } : { ten: d.ten, ten_chuan: d.tenChuan });
// Dòng sẽ ghi (gn_ghi_ky): [{ loai, ten, ten_chuan, thu_tu, ke_hoach, da_giai_ngan }].
export const dongDaChon = (loai) => { const b = st.b[loai]; return b.ds.filter((d) => laChon(b, d)).map((d, i) => ({ loai, ...tenLuu(b, d), thu_tu: i + 1, ke_hoach: d.kh, da_giai_ngan: d.da })); };
export const dongTongBang = (loai) => dongTong(st.b[loai].ds);
export function nhoCachChon() {
  for (const loai of LOAI_BANG) { const b = st.b[loai]; if (b.goc && b.nguon !== 'kỳ đã lưu') try { localStorage.setItem(khoaNho(loai), JSON.stringify({ cot: b.cot, donVi: b.donVi })); } catch { /* bỏ qua */ } }
}

// Bảng mới (dán / tệp / đổi trang tính): đoán cột, dòng bắt đầu, kiểu số, đơn vị; bảng không có tiêu đề nhận ra được → cách chọn đã nhớ (nếu vừa).
function napBang(loai, goc, nguon) {
  if (!goc?.length) { notifyError('Không đọc được bảng — chép lại cả bảng (gồm dòng tiêu đề) từ Excel, Word hoặc PDF rồi dán.'); return; }
  const b = st.b[loai]; const c = doanCot(goc); const nho = docNho(loai); const rong = Math.max(...goc.map((d) => d.length));
  const cot = !c.coTieuDe && nho?.cot && Math.max(nho.cot.ten, nho.cot.kh, nho.cot.da) < rong ? nho.cot : { ten: c.ten, kh: c.kh, da: c.da };
  const kieu = doanKieuSo(goc.slice(c.tuDong).flatMap((d) => [d[cot.kh], d[cot.da]]));
  Object.assign(b, { goc, nguon, cot, tuDong: c.tuDong, kieu, donVi: goiYDonVi(goc, cot, c.tuDong, kieu), chon: new Map(), tenCu: new Map() });
  docLai(loai); ve(); st.onDoi({ loai, moi: true });
}

const sel = (k, nhan, ds, chon, loai) => `<label class="gn-chon"><span>${nhan}</span><select class="o-nhap" data-gn-o="${k}" data-loai="${loai}">${ds.map(([v, t]) => `<option value="${v}"${String(v) === String(chon) ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('')}</select></label>`;
const catChu = (s, n = 28) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
// Tên cột trong ô chọn: chữ của dòng tiêu đề (dòng ngay trên dòng dữ liệu đầu), không có thì ô đầu tiên có chữ của cột.
function dsCot(b) {
  const rong = Math.max(...b.goc.map((d) => d.length)); const tieu = b.goc[b.tuDong - 1] || [];
  return Array.from({ length: rong }, (_, j) => { const mau = catChu(tieu[j] || b.goc.find((d) => String(d[j] ?? '').trim())?.[j]); return [j, `Cột ${j + 1}${mau ? `: ${mau}` : ''}`]; });
}
function ghiChu(loai, b, d) {
  if (d.loi) return `<span class="gn-loi-chu">${escapeHtml(d.loi)}</span>`;
  if (d.laTong) return 'dòng tổng — dùng đối chiếu';
  if (d.khop?.kieu === 'khop') return '<span class="gn-khop">khớp kỳ trước</span>';
  if (d.khop?.kieu === 'gan') return `<label class="gn-ten-cu"><input type="checkbox" data-gn-ten-cu="${loai}" data-dong="${d.dong}"${b.tenCu.get(d.dong) !== false ? ' checked' : ''}> dùng tên kỳ trước: ${escapeHtml(d.khop.ten)}</label>`;
  return st.truoc[loai].length ? '<span class="gn-ten-moi">tên mới</span>' : '';
}
function tomTatHtml(loai) {
  const b = st.b[loai]; const ds = dongDaChon(loai); const kh = ds.reduce((t, d) => t + (d.ke_hoach || 0), 0); const da = ds.reduce((t, d) => t + (d.da_giai_ngan || 0), 0);
  const tg = dongTong(b.ds);
  return `Lấy <b>${ds.length}</b> trong ${b.ds.filter((d) => !d.laTong).length} dòng: kế hoạch ${soVN(kh)}, đã giải ngân ${soVN(da)} tỷ đồng (${ptVN(tyLe(da, kh))})${tg ? ` · dòng tổng của bảng: ${soVN(tg.kh)} / ${soVN(tg.da)}` : ''}.`;
}
function vungHtml(loai) {
  const b = st.b[loai];
  const nhap = `<div class="gn-nhap-bang"><label class="nut nho gn-tep"><input type="file" accept=".xlsx" data-gn-tep="${loai}" class="sr">Chọn tệp Excel (.xlsx)</label>
    <textarea class="o-nhap gn-dan" rows="2" data-gn-dan="${loai}" aria-label="Dán bảng theo ${TEN[loai]}" placeholder="hoặc dán bảng theo ${TEN[loai]} vào đây (Ctrl+V) — chép từ Excel, Word hoặc PDF của báo cáo"></textarea></div>`;
  if (!b.goc) return `${nhap}<p class="chu-phu gn-khong-bb">Không bắt buộc — có bảng này thì Tổng quan hiện tỷ lệ từng ${TEN[loai]} và nhiệm vụ gắn với ${TEN[loai]} có số.</p>`;
  const dong = b.goc.slice(0, 20).map((_, i) => [i, `dòng ${i + 1}`]);
  const ctl = `<div class="gn-cot">${b.sheets?.length > 1 ? sel('sheet', 'Trang tính', b.sheets.map((s, i) => [i, s.ten]), b.sheet, loai) : ''}
    ${sel('ten', 'Cột tên', dsCot(b), b.cot.ten, loai)}${sel('kh', 'Cột kế hoạch', dsCot(b), b.cot.kh, loai)}${sel('da', 'Cột đã giải ngân (lũy kế)', dsCot(b), b.cot.da, loai)}
    ${sel('tuDong', 'Dữ liệu từ', dong, b.tuDong, loai)}${sel('donVi', 'Đơn vị trong bảng', Object.entries(TEN_DON_VI), b.donVi, loai)}
    ${sel('kieu', 'Kiểu số', [['vi', '1.234,5 (Việt Nam)'], ['en', '1,234.5']], b.kieu, loai)}
    <button type="button" class="nut nho" data-action="gnBoBang" data-loai="${loai}">Bỏ bảng này</button></div>`;
  const hang = (d) => `<tr class="${d.loi ? 'gn-loi' : d.laTong ? 'gn-tong-dong' : ''}"><td><input type="checkbox" data-gn-chon="${loai}" data-dong="${d.dong}"${laChon(b, d) ? ' checked' : ''}${d.loi ? ' disabled' : ''} aria-label="Lấy dòng ${d.dong}: ${escapeHtml(d.ten)}"></td>
    <td class="so">${d.dong}</td><td>${escapeHtml(d.ten)}</td><td class="so">${soVN(d.kh)}</td><td class="so">${soVN(d.da)}</td><td class="so">${ptVN(tyLe(d.da, d.kh))}</td><td>${ghiChu(loai, b, d)}</td></tr>`;
  return `${nhap}<p class="chu-phu gn-nguon-bang">Đang dùng: ${escapeHtml(b.nguon)} · số đã đổi ra tỷ đồng</p>${ctl}
    <div class="gn-xem"><table class="gn-bang-xem"><thead><tr><th><span class="sr">Lấy</span></th><th class="so">Dòng</th><th>Tên</th><th class="so">Kế hoạch</th><th class="so">Đã giải ngân</th><th class="so">Tỷ lệ</th><th>Ghi chú</th></tr></thead>
    <tbody>${b.ds.map(hang).join('') || '<tr><td colspan="7" class="chu-phu">Không có dòng nào từ dòng đã chọn — chọn lại "Dữ liệu từ".</td></tr>'}</tbody></table></div>
    <p class="gn-cong" id="gnCong-${loai}" aria-live="polite">${tomTatHtml(loai)}</p>`;
}
function demTab() {
  for (const loai of LOAI_BANG) { const e = $(`gnDem${loai}`); if (e) e.textContent = st.b[loai].goc ? `(${dongDaChon(loai).length})` : ''; }
}
function ve(giuO = null) {
  document.querySelectorAll('#gnModal [data-action="gnTab"]').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.loai === st.tab)));
  const v = $('gnBang'); if (!v) return;
  v.innerHTML = vungHtml(st.tab); demTab();
  if (giuO) v.querySelector(`[data-gn-o="${giuO}"]`)?.focus();
}

async function docTep(loai, tep) {
  try {
    const { docXlsx, TOI_DA_BYTE } = await import('../../../lib/xlsx-doc.js');
    if (tep.size > TOI_DA_BYTE) { notifyError('Tệp lớn hơn 15 MB — lưu riêng bảng số liệu ra tệp nhỏ hơn.'); return; }
    const sheets = await docXlsx(await tep.arrayBuffer());
    const coSo = (s) => s.dong.some((d) => d.filter((o) => typeof o === 'number').length >= 2);
    const i = Math.max(0, sheets.findIndex((s) => !s.an && coSo(s)));
    Object.assign(st.b[loai], { sheets, sheet: i });
    napBang(loai, sheets[i]?.dong || [], `tệp ${tep.name} — trang ${sheets[i]?.ten || ''}`);
  } catch (e) { notifyError(e?.cuaTa ? e.message : 'Không đọc được tệp .xlsx — mở bằng Excel, "Lưu thành" Excel Workbook (.xlsx) rồi chọn lại.'); }
}
function onDoi(e) {
  const el = e.target; const loai = el.dataset?.loai || el.dataset?.gnChon || el.dataset?.gnTenCu || el.dataset?.gnTep;
  if (!loai || !st.b[loai]) return;
  const b = st.b[loai];
  if (el.dataset.gnTep !== undefined) { if (el.files?.[0]) docTep(loai, el.files[0]); return; }
  if (el.dataset.gnChon !== undefined) { b.chon.set(Number(el.dataset.dong), el.checked); $(`gnCong-${loai}`).innerHTML = tomTatHtml(loai); demTab(); st.onDoi({ loai }); return; }
  if (el.dataset.gnTenCu !== undefined) { b.tenCu.set(Number(el.dataset.dong), el.checked); st.onDoi({ loai }); return; }
  const k = el.dataset.gnO; const v = el.value;
  if (k === 'sheet') { b.sheet = Number(v); napBang(loai, b.sheets[b.sheet]?.dong || [], b.nguon.replace(/trang .*$/, `trang ${b.sheets[b.sheet]?.ten || ''}`)); ve('sheet'); return; }
  if (['ten', 'kh', 'da'].includes(k)) b.cot = { ...b.cot, [k]: Number(v) };
  else if (k === 'tuDong') b.tuDong = Number(v);
  else if (k === 'donVi' || k === 'kieu') b[k] = v;
  b.chon = new Map(); docLai(loai); ve(k); st.onDoi({ loai });
}
let henGo = null;
export function mountBang(onDoiKy) {
  st.onDoi = onDoiKy; const v = $('gnBang');
  v.addEventListener('change', onDoi);
  v.addEventListener('paste', (e) => {
    const loai = e.target.dataset?.gnDan; if (!loai) return;
    e.preventDefault(); napBang(loai, bangTuDan(e.clipboardData?.getData('text/plain') || '', e.clipboardData?.getData('text/html') || ''), 'bảng vừa dán');
  });
  v.addEventListener('input', (e) => {   // gõ / thả chữ vào ô dán (không qua sự kiện dán)
    const loai = e.target.dataset?.gnDan; if (!loai) return;
    clearTimeout(henGo); const t = e.target.value; henGo = setTimeout(() => { if (t.trim()) napBang(loai, bangTuDan(t), 'chữ vừa nhập'); }, 600);
  });
}
export const doiTab = (loai) => { if (st.b[loai]) { st.tab = loai; ve(); } };
export const boBang = (loai) => { if (st.b[loai]) { st.b[loai] = moi(); ve(); st.onDoi({ loai }); } };
