// Rà soát phân loại bằng tệp Excel (v3.26 — 0116 ra_soat_phan_loai) ở màn Rà soát: "Xuất tệp rà soát" (danh sách đang lọc — cột Ngành, Lĩnh vực, Mục
// tiêu then chốt, Lý do rà soát; sheet Danh mục có ô chọn) → cán bộ / trợ lý điền → "Chọn tệp đã rà soát" → XEM TRƯỚC do máy chủ tính (cũ → mới, Đổi /
// Không đổi / Lỗi, cảnh báo đổi lãnh đạo kiêm nhiệm phụ trách; không ghi gì) → lý do chung → "Áp dụng" (từng phần 200 dòng). Sửa được cả việc đã
// hoàn thành; không gửi tin. Quyền từng dòng ở DB (như gắn mục tiêu); màn này chỉ hiện nút. Đọc / ghi tệp nạp động (lib/xlsx-doc.js, lib/xlsx.js).
import { $, escapeHtml, setText } from '../../../lib/dom.js';
import { registerActions } from '../../../lib/actions.js';
import { notifyError, notifySuccess } from '../../../components/toast.js';
import { danhMucKl, coMucTieu } from '../../../lib/kl/du-lieu.js';
import { homNayVN, formatNgay } from '../../../lib/kl/ngay.js';
import { boSoThuTu } from '../../../lib/kl/nhan.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { raSoatPhanLoai } from '../../../lib/kl/muc-tieu-db.js';
import { bangRaSoat, docBangRaSoat, khopBang, thamSo, tomTat, TOI_DA_DONG } from '../../../lib/kl/ra-soat-tep.js';

const esc = escapeHtml;
const tp = { gui: [], loiTep: [], trung: 0, kq: [], tenTep: '', dang: false, daAp: null };
const tenNganh = (ma) => boSoThuTu(danhMucKl().nganh?.find((n) => n.ma === ma)?.ten || '') || (ma ? ma : '(chưa phân loại)');
const tenLv = (ma) => danhMucKl().linhVuc?.find((l) => l.ma === ma)?.ten || (ma ? ma : '(chưa có)');
const tenMt = (ds) => ((ds || []).length ? ds.map((m) => danhMucKl().mucTieu?.find((x) => x.ma === m)?.ten_ngan || m).join('; ') : '(chưa phân loại)');
const lyDoMacDinh = () => `Rà soát phân loại ngành, lĩnh vực${coMucTieu() ? ', mục tiêu then chốt' : ''} (${formatNgay(homNayVN())})`;

export const tepHtml = () => `<details class="rs-tep" id="rsTep"><summary>Rà soát phân loại bằng tệp Excel — ngành, lĩnh vực${coMucTieu() ? ', mục tiêu then chốt' : ''} (cả việc đã hoàn thành)</summary>
  <div class="rs-tep-than"><p class="chu-phu">1. Bấm "Xuất tệp rà soát" (theo bộ lọc đang chọn). 2. Điền / sửa các cột Ngành, Lĩnh vực${coMucTieu() ? `, Mục tiêu then chốt (nhiều mục cách nhau bằng dấu ;
    việc không phục vụ mục tiêu nào ghi "Không thuộc mục tiêu then chốt")` : ''}, Lý do rà soát; ô để trống giữ nguyên. 3. "Chọn tệp đã rà soát": hệ thống cho xem trước,
    đồng chí kiểm tra rồi bấm Áp dụng. Không gửi tin cho cán bộ; mỗi việc ghi diễn biến kèm lý do.</p>
    <div class="rs-tep-nut"><button type="button" class="nut nho" data-action="rsTepXuat">Xuất tệp rà soát</button>
      <button type="button" class="nut nho chinh" data-action="rsTepChon">Chọn tệp đã rà soát…</button><input type="file" id="rsTepFile" accept=".xlsx" hidden>
      <span class="chu-phu" id="rsTepTt" aria-live="polite"></span></div>
    <div id="rsTepKq" class="rs-tep-kq"></div></div></details>`;

function dongHtml(x) {
  const cu = x.cu || {}; const moi = x.moi || {}; const khong = '<span class="chu-phu">—</span>';   // dòng lỗi (mã không có, lỗi ở tệp): không có phân loại hiện tại để so
  const ng = !x.cu ? khong : (x.doi || []).some((c) => c !== 'muc_tieu') ? `${esc(tenNganh(cu.nganh))} — ${esc(tenLv(cu.linh_vuc))} <b>→ ${esc(tenNganh(moi.nganh))} — ${esc(tenLv(moi.linh_vuc))}</b>`
    : `<span class="chu-phu">${esc(tenNganh(cu.nganh))} — ${esc(tenLv(cu.linh_vuc))}</span>`;
  const mt = !x.cu ? khong : (x.doi || []).includes('muc_tieu') ? `${esc(tenMt(cu.muc_tieu))} <b>→ ${esc(tenMt(moi.muc_tieu))}</b>` : `<span class="chu-phu">${esc(tenMt(cu.muc_tieu))}</span>`;
  const ghi = [x.loi ? `<span class="rs-tep-loi">${esc(loiDeHieu({ message: x.loi }))}</span>` : '', x.canh_bao ? `<span class="rs-tep-canh">${esc(x.canh_bao)}</span>` : '',
    x.da_xong ? '<span class="chu-phu">việc đã hoàn thành</span>' : ''].filter(Boolean).join(' ');
  return `<tr data-ma="${esc(x.ma || '')}"><td class="c-ma">${esc(x.ma || '—')}</td><td class="c-nd">${esc(x.noi_dung || '')}</td><td class="c-pl" data-n="Ngành — lĩnh vực">${ng}</td>
    ${coMucTieu() ? `<td class="c-pl" data-n="Mục tiêu then chốt">${mt}</td>` : ''}<td class="c-ghi" data-n="Ghi chú">${ghi}</td></tr>`;
}
function ve() {
  const el = $('rsTepKq'); if (!el) return;
  if (!tp.kq.length && !tp.loiTep.length) { el.innerHTML = ''; return; }
  const t = tomTat(tp.kq); const loiTep = tp.loiTep.map((k) => ({ ma: k.ma || `dòng ${k.so}`, loi: `Dòng ${k.so}: ${k.loi.join('; ')}`, doi: [] }));
  const dsDoi = tp.kq.filter((x) => x.ket_qua === 'DOI'); const dsLoi = [...loiTep, ...tp.kq.filter((x) => x.ket_qua === 'LOI')];
  const da = tp.daAp;
  const dau = da ? `<p class="rs-tep-tom" role="status"><b>Đã áp dụng: ${da.doi} việc đổi phân loại</b>${da.loi ? ` · <b class="rs-tep-loi">${da.loi} việc chưa ghi được</b> (xem bên dưới)` : ''}.</p>`
    : `<p class="rs-tep-tom"><b>Tệp "${esc(tp.tenTep)}": ${t.doi} việc sẽ đổi</b> (ngành – lĩnh vực ${t.nganh}${coMucTieu() ? `, mục tiêu ${t.mucTieu}` : ''}${t.daXong ? `; ${t.daXong} việc đã hoàn thành` : ''})
      · ${t.giu} không đổi · ${dsLoi.length} lỗi${tp.trung ? ` (${tp.trung} mã trùng)` : ''}${t.canhBao ? ` · <b class="rs-tep-canh">${t.canhBao} việc đổi lãnh đạo phụ trách theo kiêm nhiệm</b>` : ''}. Chưa ghi gì.</p>
      ${t.doi ? `<label class="gv-truong rs-tep-ly"><span class="nhan">Lý do rà soát<b class="gv-bb" aria-hidden="true">*</b></span><input type="text" id="rsTepLyDo" class="o-nhap" maxlength="500" value="${esc(lyDoMacDinh())}"></label>
      <div class="rs-tep-nut"><button type="button" class="nut chinh" data-action="rsTepApDung" data-bo="0">Áp dụng ${t.doi} thay đổi</button>
        ${t.canhBao ? `<button type="button" class="nut" data-action="rsTepApDung" data-bo="1">Áp dụng, bỏ qua ${t.canhBao} việc có cảnh báo</button>` : ''}
        <button type="button" class="nut" data-action="rsTepHuy">Huỷ</button></div>` : '<div class="rs-tep-nut"><button type="button" class="nut" data-action="rsTepHuy">Đóng</button></div>'}`;
  const bang = (ds, tieu) => (ds.length ? `<h3 class="rs-tep-h">${tieu} (${ds.length})</h3><div class="cuon-ngang"><table class="bang-tq rs-tep-bang"><thead><tr><th>Mã</th><th>Nội dung</th>
    <th>Ngành — lĩnh vực</th>${coMucTieu() ? '<th>Mục tiêu then chốt</th>' : ''}<th>Ghi chú</th></tr></thead><tbody>${ds.map(dongHtml).join('')}</tbody></table></div>` : '');
  el.innerHTML = `${dau}${bang(dsLoi, da ? 'Chưa ghi được' : 'Lỗi — không ghi')}${bang(dsDoi, da ? 'Đã đổi' : 'Sẽ đổi')}`;
}
async function goi(ds, lyDo, ap) {
  const kq = [];
  for (let i = 0; i < ds.length; i += TOI_DA_DONG) {
    setText('rsTepTt', `${ap ? 'Đang ghi' : 'Đang xem trước'} ${Math.min(ds.length, i + TOI_DA_DONG)}/${ds.length} dòng…`);
    kq.push(...await raSoatPhanLoai(ds.slice(i, i + TOI_DA_DONG).map(thamSo), lyDo, ap));
  }
  setText('rsTepTt', ''); return kq;
}
async function docTep(f) {
  if (!f || tp.dang) return;
  tp.dang = true; Object.assign(tp, { gui: [], loiTep: [], trung: 0, kq: [], tenTep: f.name, daAp: null }); ve(); setText('rsTepTt', 'Đang đọc tệp…');
  try {
    const { docXlsx } = await import('../../../lib/xlsx-doc.js');
    const b = docBangRaSoat(await docXlsx(await f.arrayBuffer()), coMucTieu());
    const k = khopBang(b.dong, danhMucKl());
    Object.assign(tp, { gui: k.gui, loiTep: k.loi, trung: k.trung });
    if (!k.gui.length && !k.loi.length) throw new Error('Tệp không có dòng nào ghi ngành, lĩnh vực hoặc mục tiêu then chốt.');
    tp.kq = k.gui.length ? await goi(k.gui, '', false) : [];
  } catch (e) { notifyError(`Chưa đọc được tệp rà soát: ${loiDeHieu(e)}`); setText('rsTepTt', ''); }
  tp.dang = false; ve();
}
async function apDung(bo, sauApDung) {
  if (tp.dang) return;
  const lyDo = String($('rsTepLyDo')?.value || '').trim();
  if (!lyDo) { notifyError('Ghi lý do rà soát (lưu vào diễn biến của từng việc).'); $('rsTepLyDo')?.focus(); return; }
  const doi = new Map(tp.kq.filter((x) => x.ket_qua === 'DOI' && !(bo && x.canh_bao)).map((x) => [x.ma, x]));
  const ds = tp.gui.filter((k) => doi.has(k.ma)); if (!ds.length) return;
  tp.dang = true; document.querySelectorAll('#rsTepKq [data-action="rsTepApDung"]').forEach((n) => { n.disabled = true; });
  try {
    const kq = await goi(ds, lyDo, true);
    tp.kq = kq; tp.loiTep = []; tp.daAp = { doi: kq.filter((x) => x.ket_qua === 'DOI').length, loi: kq.filter((x) => x.ket_qua === 'LOI').length };
    (tp.daAp.loi ? notifyError : notifySuccess)(`Đã cập nhật phân loại ${tp.daAp.doi} việc${tp.daAp.loi ? `; ${tp.daAp.loi} việc chưa ghi được` : ''}.`);
    await sauApDung();
  } catch (e) { notifyError(`Chưa áp dụng được: ${loiDeHieu(e)}`); }
  tp.dang = false; ve();
}

// dsLoc(): dòng đang lọc ở màn Rà soát; sauApDung(): đọc lại danh sách.
export function ganTep({ dsLoc, sauApDung }) {
  $('rsTepFile')?.addEventListener('change', (e) => { const f = e.target.files?.[0]; e.target.value = ''; docTep(f); });
  registerActions({
    rsTepXuat: async () => {
      const rows = dsLoc(); if (!rows.length) { notifyError('Danh sách đang lọc không có nhiệm vụ nào.'); return; }
      try {
        const { taoXlsx, taiXuong } = await import('../../../lib/xlsx.js');
        taiXuong(`vptu-ra-soat-phan-loai-${homNayVN().replace(/-/g, '')}.xlsx`, taoXlsx(bangRaSoat(rows, danhMucKl(), coMucTieu())));
        notifySuccess(`Đã xuất ${rows.length} nhiệm vụ để rà soát.`);
      } catch (e) { notifyError(`Chưa xuất được tệp: ${loiDeHieu(e)}`); }
    },
    rsTepChon: () => { if (!tp.dang) $('rsTepFile')?.click(); },
    rsTepApDung: ({ bo }) => apDung(bo === '1', sauApDung),
    rsTepHuy: () => { Object.assign(tp, { gui: [], loiTep: [], trung: 0, kq: [], daAp: null }); ve(); },
  });
}
