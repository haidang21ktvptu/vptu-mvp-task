// "Bổ sung dữ liệu chuyển đổi" (v3.27) ở cuối thẻ Nhập từ Excel — CHỈ tài khoản toàn quyền (ẩn với người khác; quyền thật ở hàm DB bo_sung_chuyen_doi,
// 0118). Chọn tệp JSON (Claude dựng từ hai tệp chủ dự án gửi 20/10/2026, chủ dự án đã duyệt bản xem trước) → Xem trước (máy chủ chạy thật rồi hoàn tác: số
// việc bổ sung / giữ nguyên / lỗi, từng ô cũ → mới) → lý do → Ghi. Gửi từng lượt 50 việc; lỗi giữa chừng: các lượt trước đã ghi — chọn lại tệp, ghi lại
// (ô đã điền giữ nguyên). Không gửi tin cho cán bộ. Dạng tệp, chia lượt, chữ kết quả: lib/kl/nhap/bo-sung.js.
import { $, show, escapeHtml } from '../../../lib/dom.js';
import { state, findAccount } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { laToanQuyen } from '../../../lib/toan-quyen.js';
import { danhMucKl, loadDanhMucKl } from '../../../lib/kl/du-lieu.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { LOAI_VB } from '../../../lib/kl/nhap/chuan-hoa.js';
import { boSungChuyenDoi } from '../../../lib/kl/nhap/du-lieu.js';
import { docDuLieuBoSung, chuanHoaChuTri, chiaLuot, gopKetQua, soGiu, chuDoi } from '../../../lib/kl/nhap/bo-sung.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { datNapTab } from './tab.js';

const esc = escapeHtml;
const bs = { du: null, tep: '', kq: null, dang: false };
const LY_DO = 'Bổ sung dữ liệu chuyển đổi theo tệp chủ dự án gửi ngày 20/10/2026';
const boSungHtml = () => `<details class="tam nx-phan nx-bo-sung hidden" id="nxBoSung"><summary><b>Bổ sung dữ liệu chuyển đổi</b> <span class="chu-phu">— chỉ tài khoản toàn quyền</span></summary>
  <p class="chu-phu">Điền ô còn trống của các việc đã có trên hệ thống (cơ quan trình, lĩnh vực chi tiết, hạn, văn bản triển khai, ghi chú; kết quả thành minh chứng chữ
    cho việc đã hoàn thành chưa có minh chứng), đổi loại văn bản, đổi chủ trì khi tệp ghi rõ. Ô đã có giá trị giữ nguyên; không gửi tin cho cán bộ; mỗi việc ghi diễn biến
    kèm lý do. Chỉ dùng cho tệp chuyển đổi đã duyệt.</p>
  <div class="nx-hang"><label class="nut" for="nxBsTep">Chọn tệp bổ sung (.json)</label><input type="file" id="nxBsTep" class="sr-only" accept=".json,application/json">
    <span id="nxBsTen" class="chu-phu" aria-live="polite"></span></div>
  <div class="nx-hang"><label class="nhan" for="nxBsLyDo">Lý do <b class="gv-bb" aria-hidden="true">*</b></label>
    <input id="nxBsLyDo" class="o-nhap" maxlength="500" value="${esc(LY_DO)}"></div>
  <div class="nx-hang"><button type="button" class="nut" data-action="nxBsXem" id="nxBsXemNut" disabled>Xem trước</button>
    <button type="button" class="nut chinh" data-action="nxBsGhi" id="nxBsGhiNut" disabled>Ghi vào hệ thống</button></div>
  <div id="nxBsKq"></div></details>`;

const tenLoai = (m) => LOAI_VB.find(([x]) => x === m)?.[1] || m || '';
const tenGt = (k, v) => (['co_quan_trinh', 'owner_don_vi_ma'].includes(k) ? (danhMucKl().donVi || []).find((d) => d.ma === v)?.ten || v
  : ['owner_tai_khoan', 'nguoi_theo_doi'].includes(k) ? findAccount(v)?.full_name || v : k === 'han_xu_ly' ? formatNgay(v) : v);
function ketQuaHtml(kq) {
  const doi = kq.viec.filter((x) => x.ket_qua === 'DOI'); const loi = kq.viec.filter((x) => x.ket_qua === 'LOI');
  const vb = kq.van_ban.map((v) => `<li>Văn bản ${esc(v.so_ket_luan || '')} ngày ${esc(formatNgay(v.ngay_ban_hanh) || '')}: ${v.ket_qua === 'LOI' ? `<b>lỗi</b> — ${esc(v.loi || '')}`
    : v.ket_qua === 'DOI' ? `loại ${esc(tenLoai(v.cu))} → ${esc(tenLoai(v.moi))} (${v.so_viec} việc)` : `giữ loại ${esc(tenLoai(v.cu))}`}</li>`);
  return `<p class="nx-bs-tom"><b>${kq.da_ghi ? 'Đã ghi' : 'Xem trước — chưa ghi gì'}:</b> ${kq.so_viec} việc · ${kq.so_doi} việc bổ sung · ${soGiu(kq)} giữ nguyên · ${kq.so_loi} lỗi</p>
    ${vb.length ? `<ul class="nx-ghi">${vb.join('')}</ul>` : ''}
    ${loi.length ? `<ul class="nx-ghi">${loi.map((x) => `<li><b>${esc(x.ma || '(không mã)')}</b>: ${esc(x.loi || '')}</li>`).join('')}</ul>` : ''}
    ${doi.length ? `<div class="bang-cuon"><table class="nx-bang"><thead><tr><th scope="col">Mã</th><th scope="col">Ô bổ sung (cũ → mới)</th></tr></thead>
      <tbody>${doi.map((x) => `<tr><td>${esc(x.ma)}${x.da_xong ? '<br><small class="chu-phu">đã hoàn thành</small>' : ''}</td><td>${chuDoi(x, tenGt).map(esc).join('<br>')}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
}
const tenTep = () => (bs.du ? `${bs.tep}: ${bs.du.viec.length} việc, ${bs.du.van_ban.length} văn bản` : '');
const capNhatNut = () => { $('nxBsXemNut').disabled = !bs.du || bs.dang; $('nxBsGhiNut').disabled = !bs.du || !bs.kq || bs.kq.da_ghi || bs.dang; };

async function chonTep(f) {
  if (!f || bs.dang) return;
  let loi = [];
  try {
    const [chu] = await Promise.all([f.text(), loadDanhMucKl()]);
    const ch = chuanHoaChuTri(docDuLieuBoSung(chu), { dm: danhMucKl(), accounts: state.accounts || [], tenPhong: (m) => DEPT_NAMES[m] || m || '' });
    ({ loi } = ch); bs.du = loi.length ? null : ch.du; bs.tep = f.name;
    if (loi.length) notifyError(`Tệp có ${loi.length} dòng chưa xác định được chủ trì — sửa tệp rồi chọn lại.`);
  } catch (e) { bs.du = null; notifyError(e.message); }
  bs.kq = null; $('nxBsTen').textContent = tenTep();
  $('nxBsKq').innerHTML = loi.length ? `<ul class="nx-ghi">${loi.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''; capNhatNut();
}
async function chay(ap) {
  const ly = $('nxBsLyDo').value.trim();
  if (!bs.du || bs.dang) return;
  if (!ly) { notifyError('Ghi lý do bổ sung.'); $('nxBsLyDo').focus(); return; }
  bs.dang = true; capNhatNut(); const ds = []; const luot = chiaLuot(bs.du);
  try {
    await loadDanhMucKl();
    for (let i = 0; i < luot.length; i++) { $('nxBsTen').textContent = `${ap ? 'Đang ghi' : 'Đang xem trước'} lượt ${i + 1}/${luot.length}…`; ds.push(await boSungChuyenDoi(luot[i], ly, ap)); }
    bs.kq = gopKetQua(ds);
    if (ap) notifySuccess(`Đã bổ sung dữ liệu chuyển đổi cho ${bs.kq.so_doi} việc${bs.kq.so_loi ? `; ${bs.kq.so_loi} dòng lỗi — xem danh sách` : ''}.`);
  } catch (e) {
    bs.kq = ds.length ? gopKetQua(ds) : null;
    notifyError(`${ap ? 'Ghi' : 'Xem trước'} dừng ở lượt ${ds.length + 1}/${luot.length}: ${e.message}${ap && ds.length ? ' — các lượt trước đã ghi; chọn lại tệp rồi ghi lại (ô đã điền giữ nguyên).' : ''}`);
  } finally {
    bs.dang = false; $('nxBsTen').textContent = tenTep(); $('nxBsKq').innerHTML = bs.kq ? ketQuaHtml(bs.kq) : ''; capNhatNut();
  }
}

export function mountBoSung() {
  $('gvKhuNhap').insertAdjacentHTML('beforeend', boSungHtml());
  $('nxBsTep').addEventListener('change', (e) => { e.stopPropagation(); const f = e.target.files?.[0]; e.target.value = ''; chonTep(f); });
  $('nxBsLyDo').addEventListener('change', (e) => e.stopPropagation());
  registerActions({ nxBsXem: () => chay(false), nxBsGhi: () => chay(true) });
  datNapTab('nhap', () => show('nxBoSung', laToanQuyen(state.user)));   // mỗi lần mở thẻ: chỉ tài khoản toàn quyền thấy
}
