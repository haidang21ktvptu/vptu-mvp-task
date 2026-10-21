// Mục "Giải ngân vốn" của ngăn chi tiết nhiệm vụ (v3.28, 0119): việc đã gắn theo dõi giải ngân — đối tượng (số liệu toàn tỉnh / một nguồn vốn / một chủ
// đầu tư), mục tiêu riêng, % kỳ mới nhất có đối tượng đó, mức so với tiến độ đều, căn cứ, diễn biến qua các kỳ; việc "Số liệu toàn tỉnh": nhập, sửa,
// xoá kỳ số liệu (giai-ngan-nhap.js). Việc chưa gắn: chỉ hiện dòng mời gắn khi nội dung nói về giải ngân / vốn đầu tư (bớt nhiễu); việc khác gắn từ
// bảng "Xem chi tiết" (mục đã có nút thì bỏ dòng đó). Hộp "Theo dõi giải ngân" (modal ngoài ngăn — không mất khi ngăn vẽ lại): loại, năm, tên chọn từ
// bảng của các kỳ, mục tiêu (chỉ lãnh đạo trong phạm vi / người giao việc đổi; "Số liệu toàn tỉnh" chỉ lãnh đạo Văn phòng chọn); Enter = Lưu, bỏ theo
// dõi qua bước xác nhận. Nút chỉ ẩn / hiện cho đẹp; gn_gan_nhiem_vu (0120) là chốt.
import { escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { formatNgay, homNayVN } from '../../../lib/kl/ngay.js';
import { soVN, ptVN, moTaMuc, tongHopNam, mucCuaNhiemVu, soCuaNhiemVu, dienBienDoiTuong, namHienThi, nguoiNhap, duocNhapKy, mocMacDinh } from '../../../lib/kl/giai-ngan.js';
import { tenChuan, tenGon } from '../../../lib/kl/giai-ngan-bang.js';
import { docNam, docGanViec, ganNhiemVu, xoaKy, coGiaiNgan } from '../../../lib/kl/giai-ngan-db.js';
import { laTangGiao } from '../../../lib/kl/sua-tang.js';
import { chiXem } from '../../../lib/kl/pham-vi.js';
import { laToanQuyen } from '../../../lib/toan-quyen.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { chipMucHtml, doiTuongChu } from '../tong-quan/giai-ngan.js';
import { timKlRow } from './danh-sach.js';
import { idDangMo } from './chi-tiet.js';   // vòng nhập chi-tiet ↔ giai-ngan: chỉ dùng trong hàm xử lý sự kiện (sau khi mọi module đã nạp)

let sauHanhDong = async () => {};
const me = () => state.user;
const vai = () => state.user?.role_group;
const LIEN_QUAN = /giải\s*ngân|đầu\s*tư\s*công|vốn\s*đầu\s*tư|kế\s*hoạch\s*vốn|chủ\s*đầu\s*tư|nguồn\s*vốn/i;
// Gắn mới (như ghi vướng mắc 0103): chủ trì, người theo dõi, lãnh đạo trong phạm vi. Việc đã gắn nguồn vốn / chủ đầu tư (0120–0122): đổi, bỏ — lãnh đạo
// trong phạm vi hoặc người giao, không phải người chủ trì (tài khoản chủ trì — kể cả tự giao cho mình —, Trưởng phòng của việc giao cho phòng), trừ Chánh
// Văn phòng / toàn quyền; hoặc chính người đã gắn khi mục tiêu còn mặc định (100% trước 31/12). Mục tiêu riêng: như trên, không có ngoại lệ người tự gắn.
// Việc "Số liệu toàn tỉnh": chỉ lãnh đạo Văn phòng. Hàm DB là chốt; ở đây chỉ để ẩn nút.
const duocGan = (r) => Boolean(r) && !chiXem(r) && nguoiNhap(me()) && (r.owner_tai_khoan === me().id || r.nguoi_theo_doi === me().id || ['A1', 'A2'].includes(vai()));
const laChanh = () => (vai() === 'A1' && Boolean(me()?.is_chief)) || laToanQuyen(me());
const laChuTri = (r) => r.owner_tai_khoan === me().id || (!r.owner_tai_khoan && vai() === 'A2' && Boolean(r.owner_phong) && r.owner_phong === me().department);
const duocDoiMucTieu = (r) => !chiXem(r) && nguoiNhap(me()) && (!laChuTri(r) || laChanh()) && (['A1', 'A2'].includes(vai()) || laTangGiao(r));
const macDinh = (g) => g.muc_tieu_pt === 100 && g.muc_tieu_ngay === `${g.nam}-12-31`;
const duocSua = (r, g) => (!g ? duocGan(r) : g.loai === 'TOAN_TINH' ? vai() === 'A1' && !chiXem(r) && nguoiNhap(me())
  : duocGan(r) && (duocDoiMucTieu(r) || (g.gan_boi === me().id && macDinh(g))));
const KHONG_SUA = 'Việc này do lãnh đạo hoặc người giao gắn theo dõi giải ngân (hoặc đã đặt mục tiêu riêng) — chỉ lãnh đạo trong phạm vi hoặc người giao đổi được.';
const ganCua = new Map();   // id việc → việc theo dõi (lần đọc gần nhất; hộp Theo dõi mở ngay không chờ đọc)

// Chỗ giữ trong ngăn (chi-tiet.js) — nạp sau khi vẽ ngăn; dòng "Xem chi tiết" để gắn việc không nói tới giải ngân.
export const khoiGiaiNganHtml = (r) => `<div class="khoi-nho gn-ct" id="klGiaiNgan-${r.id}" hidden></div>`;
export const hangGiaiNganHtml = (r) => (coGiaiNgan() && duocGan(r) ? `<tr id="gnHang-${r.id}"><th scope="row">Giải ngân vốn</th><td>Gắn nhiệm vụ với số liệu giải ngân (toàn tỉnh, một nguồn vốn, một chủ đầu tư) để theo dõi theo mục tiêu riêng</td>
  <td><button type="button" class="nut nho" data-action="gnMoTheoDoi" data-id="${r.id}">Theo dõi giải ngân</button></td></tr>` : '');

function dongDb(x, r, nhap) {
  const k = x.ky; const xoa = `oGnXoa-${k.id}`;
  return `<tr><td>${formatNgay(k.ngay_so_lieu)}${k.uoc_tinh ? ' <small class="chu-phu">ước tính</small>' : ''}</td><td class="so">${soVN(x.da)}</td><td class="so">${soVN(x.kh)}</td><td class="so">${ptVN(x.pt)}</td><td class="so">${ptVN(x.canDat)}</td>
    ${nhap ? `<td class="c-nut"><button type="button" class="nut nho" data-action="gnMoNhap" data-nam="${k.nam}" data-ky="${k.id}" aria-label="Sửa kỳ đến ${formatNgay(k.ngay_so_lieu)}">Sửa</button>
      <button type="button" class="nut nho" data-action="moO" data-o="${xoa}" aria-controls="${xoa}" aria-label="Xoá kỳ đến ${formatNgay(k.ngay_so_lieu)}">Xoá</button></td></tr>
    <tr class="gn-ct-xoa"><td colspan="6"><form class="o" id="${xoa}" data-submit="gnXoaKy" data-id="${k.id}" data-nv="${r.id}"><small>Xoá kỳ số liệu đến ${formatNgay(k.ngay_so_lieu)} (căn cứ: ${escapeHtml(k.can_cu)})? Việc xoá được ghi vào diễn biến.</small>
      <button type="submit" class="nut nguy-hiem">Xoá kỳ</button><button type="button" class="nut" data-action="dongO" data-o="${xoa}">Huỷ</button></form></td>` : ''}</tr>`;
}

function daGanHtml(r, g, d, homNay) {
  const th = tongHopNam(d, homNay); const s = soCuaNhiemVu(g, th); const m = mucCuaNhiemVu(g, th, homNay);
  const laTt = g.loai === 'TOAN_TINH'; const nhap = laTt && duocNhapKy(me(), r) && !chiXem(r);
  const db = dienBienDoiTuong(g, th, d.dong).reverse();
  const so = s ? `<div class="gn-ct-so"><b>${ptVN(m.pt)}</b><span>đã giải ngân ${soVN(s.da)} / ${soVN(s.kh)} tỷ đồng</span>${chipMucHtml(m)}</div>
    <p class="chu-phu gn-ct-cc">${escapeHtml(moTaMuc(m))}${s.ky.uoc_tinh ? ' (số ước tính)' : ''} · căn cứ: ${escapeHtml(s.ky.can_cu)}${m.cu ? ` <span class="gn-cu">số liệu đã cũ ${m.soNgayCu} ngày — cần nhập kỳ mới</span>` : ''}</p>`
    : `<p class="chu-phu">${laTt ? `Chưa có kỳ số liệu năm ${g.nam}.` : `Chưa có số liệu của "${escapeHtml(g.ten)}" trong các kỳ năm ${g.nam} — tên phải trùng tên trong bảng của kỳ số liệu (chọn trong danh sách khi gắn).`}</p>`;
  const bang = db.length ? `<details class="gn-ct-db"${laTt ? ' open' : ''}><summary>Diễn biến qua ${db.length} kỳ số liệu</summary><div class="cuon-ngang"><table class="gn-ct-bang">
    <thead><tr><th>Số liệu đến</th><th class="so">Đã giải ngân</th><th class="so">Kế hoạch</th><th class="so">Tỷ lệ</th><th class="so">Tiến độ đều</th>${nhap ? '<th><span class="sr">Thao tác</span></th>' : ''}</tr></thead>
    <tbody>${db.map((x) => dongDb(x, r, nhap)).join('')}</tbody></table></div></details>` : '';
  const nut = (nhap ? `<button type="button" class="nut nho" data-action="gnMoNhap" data-nam="${g.nam}">Nhập kỳ số liệu</button>` : '')
    + (duocSua(r, g) ? `<button type="button" class="nut nho" data-action="gnMoTheoDoi" data-id="${r.id}">Sửa theo dõi</button>` : '');
  return `<h4>Giải ngân vốn <span class="chu-phu">${escapeHtml(doiTuongChu(g))} · năm ${g.nam} · mục tiêu ${ptVN(g.muc_tieu_pt)} kế hoạch vốn trước ${formatNgay(g.muc_tieu_ngay)}</span></h4>
    ${so}${bang}${nut ? `<div class="gn-ct-nut">${nut}</div>` : ''}`;
}

// Sau khi vẽ ngăn: đọc việc theo dõi (và số liệu năm đó) rồi vẽ mục; lỗi đọc → ẩn mục, không chặn ngăn.
export async function napGiaiNgan(r) {
  const o = document.getElementById(`klGiaiNgan-${r?.id}`);
  if (!o || !coGiaiNgan()) return;
  try {
    const g = await docGanViec(r.id);
    if (g) ganCua.set(r.id, g); else ganCua.delete(r.id);
    const moi = !g && duocGan(r) && LIEN_QUAN.test(`${r.noi_dung || ''} ${r.san_pham_mo_ta || ''}`);
    const d = g ? await docNam(g.nam) : null;
    if (!o.isConnected) return;
    if (g || moi) document.getElementById(`gnHang-${r.id}`)?.remove();   // một chỗ bấm: mục Giải ngân vốn đã có nút (Sửa theo dõi / Theo dõi giải ngân)
    if (g) o.innerHTML = daGanHtml(r, g, d, homNayVN());
    else if (moi) o.innerHTML = `<h4>Giải ngân vốn <span class="chu-phu">chưa theo dõi</span></h4><p class="chu-phu gn-ct-moi">Gắn việc với số liệu giải ngân toàn tỉnh, một nguồn vốn hoặc một chủ đầu tư để Tổng quan theo dõi theo mục tiêu riêng.
      <button type="button" class="nut nho" data-action="gnMoTheoDoi" data-id="${r.id}">Theo dõi giải ngân</button></p>`;
    o.hidden = !g && !moi;
  } catch { o.hidden = true; }
}

// ---- Hộp "Theo dõi giải ngân"
const td = { id: null, doiMt: false, ten: { NGUON: [], CHU_DAU_TU: [] } };
const opt = (v, t, chon) => `<option value="${v}"${chon ? ' selected' : ''}>${escapeHtml(t)}</option>`;
export const theoDoiTemplate = `
<div id="gnTdModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="gnTdTieuDe">
  <form class="modal" data-submit="gnLuuTheoDoi" novalidate>
    <h2 id="gnTdTieuDe" class="modal-tieu-de">Theo dõi giải ngân</h2>
    <p id="gnTdMoTa" class="chu-phu mt-1 mb-4"></p>
    <div class="cot-2"><div><label for="gnTdLoai" class="nhan">Theo dõi</label><select id="gnTdLoai" name="loai" class="o-nhap"></select></div>
      <div><label for="gnTdNam" class="nhan">Năm kế hoạch vốn</label><input type="number" id="gnTdNam" name="nam" class="o-nhap" min="2020" max="2100" step="1"></div></div>
    <div class="mt-3" id="gnTdTenWrap"><label for="gnTdTen" class="nhan">Tên nguồn vốn / chủ đầu tư <span class="chu-phu">chọn đúng tên trong bảng của kỳ số liệu</span></label>
      <input id="gnTdTen" name="ten" class="o-nhap" list="gnTdDs" maxlength="300" autocomplete="off"><datalist id="gnTdDs"></datalist></div>
    <div class="cot-2 mt-3"><div><label for="gnTdMt" class="nhan">Mục tiêu (% kế hoạch vốn)</label><input type="number" id="gnTdMt" name="muc_tieu_pt" class="o-nhap" min="1" max="100" step="0.1"></div>
      <div><label for="gnTdMoc" class="nhan">Mốc mục tiêu</label><input type="date" id="gnTdMoc" name="muc_tieu_ngay" class="o-nhap"></div></div>
    <p id="gnTdGoiY" class="chu-phu mt-2"></p>
    <div id="gnTdXacNhan" class="gn-td-xn" hidden><p id="gnTdXnChu"></p>
      <button type="button" class="nut nguy-hiem" id="gnTdBoThat" data-action="gnTdBoThat">Bỏ theo dõi</button><button type="button" class="nut" id="gnTdKhongBo" data-action="gnTdKhongBo">Không</button></div>
    <div class="modal-chan"><button type="button" class="nut hidden" id="gnTdBo" data-action="gnTdHoiBo" aria-controls="gnTdXacNhan">Bỏ theo dõi</button><button type="button" class="nut" data-action="gnDongTheoDoi">Huỷ</button>
      <button type="submit" id="gnTdLuu" class="nut chinh">Lưu theo dõi</button></div>
  </form>
</div>`;
const $ = (id) => document.getElementById(id);
// Tên đối tượng của các kỳ trong năm (tên của kỳ mới nhất thắng), xếp theo chữ cái — gợi ý khi gắn việc.
const dsTen = (d, loai) => { const ngay = new Map((d?.ky || []).map((k) => [k.id, k.ngay_so_lieu]));
  return [...new Map((d?.dong || []).filter((x) => x.loai === loai).sort((a, b) => String(ngay.get(a.ky_id)).localeCompare(String(ngay.get(b.ky_id)))).map((x) => [x.ten_chuan, x.ten])).values()]
    .sort((a, b) => a.localeCompare(b, 'vi')); };
function veTen() {
  const loai = $('gnTdLoai').value; const tt = loai === 'TOAN_TINH'; const doiMt = td.doiMt || (tt && vai() === 'A1');   // mục tiêu việc toàn tỉnh: lãnh đạo Văn phòng
  $('gnTdTenWrap').classList.toggle('hidden', tt); $('gnTdMt').disabled = !doiMt; $('gnTdMoc').disabled = !doiMt;
  $('gnTdDs').innerHTML = (td.ten[loai] || []).map((t) => `<option value="${escapeHtml(t)}"></option>`).join('');
}
async function napTen(nam) {
  try { const d = await docNam(nam); td.ten = { NGUON: dsTen(d, 'NGUON'), CHU_DAU_TU: dsTen(d, 'CHU_DAU_TU') }; } catch { td.ten = { NGUON: [], CHU_DAU_TU: [] }; }
  if (td.id) veTen();
}
async function gnMoTheoDoi({ id }) {
  const r = timKlRow(id); if (!r) return;
  const g = ganCua.get(id) || null;
  if (g && !duocSua(r, g)) { notifyError(g.loai === 'TOAN_TINH' ? 'Chỉ lãnh đạo Văn phòng đổi hoặc bỏ nhiệm vụ "Số liệu toàn tỉnh".' : KHONG_SUA); return; }
  td.id = id; td.doiMt = duocDoiMucTieu(r); const nam = g?.nam || namHienThi(homNayVN()); const doiMt = td.doiMt || (g?.loai === 'TOAN_TINH' && vai() === 'A1');
  $('gnTdMoTa').textContent = `${r.ma} — ${r.noi_dung}`;
  $('gnTdLoai').innerHTML = (vai() === 'A1' ? opt('TOAN_TINH', 'Số liệu toàn tỉnh (nhiệm vụ nhập kỳ số liệu)', g?.loai === 'TOAN_TINH') : '')
    + opt('CHU_DAU_TU', 'Một chủ đầu tư, đơn vị', !g || g.loai === 'CHU_DAU_TU') + opt('NGUON', 'Một nguồn vốn', g?.loai === 'NGUON');
  $('gnTdNam').value = nam; $('gnTdTen').value = g?.ten || ''; $('gnTdMt').value = g?.muc_tieu_pt ?? 100; $('gnTdMoc').value = g?.muc_tieu_ngay || mocMacDinh(nam);
  $('gnTdBo').classList.toggle('hidden', !g); $('gnTdXacNhan').hidden = true;
  $('gnTdLuu').disabled = false; $('gnTdBoThat').disabled = false;
  $('gnTdGoiY').textContent = `${doiMt ? 'Mặc định 100% kế hoạch vốn trước 31/12.' : 'Mục tiêu do lãnh đạo trong phạm vi hoặc người giao việc (không phải người chủ trì) đặt; mặc định 100% trước 31/12.'} Số của nhiệm vụ lấy từ kỳ số liệu mới nhất có tên này, không cộng dồn giữa các nhiệm vụ; mỗi năm chỉ một nhiệm vụ "Số liệu toàn tỉnh".`;
  veTen(); $('gnTdModal').classList.remove('hidden'); $('gnTdLoai').focus();
  napTen(nam);
}
const gnDongTheoDoi = () => { $('gnTdModal').classList.add('hidden'); td.id = null; };

// Lưu (nút submit duy nhất của hộp — Enter trong ô nhập là lưu); bỏ theo dõi đi qua bước xác nhận riêng (gnTdHoiBo → gnTdBoThat).
async function gnLuuTheoDoi() {
  const r = timKlRow(td.id); if (!r) { gnDongTheoDoi(); return; }
  const g = ganCua.get(r.id) || null; const loai = $('gnTdLoai').value; const nam = Number($('gnTdNam').value);
  const ten = tenGon($('gnTdTen').value); const doiNam = g && (g.nam !== nam || (g.loai === 'TOAN_TINH') !== (loai === 'TOAN_TINH'));   // đổi năm / kiểu: mục tiêu cũ không mang sang
  if (!Number.isInteger(nam) || nam < 2020 || nam > 2100) { notifyError('Năm kế hoạch vốn không hợp lệ.'); return; }
  if (loai !== 'TOAN_TINH' && !ten) { notifyError('Ghi tên nguồn vốn hoặc chủ đầu tư — chọn trong danh sách gợi ý của kỳ số liệu.'); return; }
  const mt = $('gnTdMt').disabled ? (doiNam ? { muc_tieu_pt: 100, muc_tieu_ngay: mocMacDinh(nam) } : {})
    : { muc_tieu_pt: Number($('gnTdMt').value) || 100, muc_tieu_ngay: $('gnTdMoc').value || mocMacDinh(nam) };
  await ghiTheoDoi(r, { loai, nam, ten: loai === 'TOAN_TINH' ? null : ten, ten_chuan: loai === 'TOAN_TINH' ? null : tenChuan(ten), ...mt });
}
async function ghiTheoDoi(r, p) {
  const bo = p.loai === null; const nut = [$('gnTdLuu'), $('gnTdBoThat')];
  nut.forEach((x) => { x.disabled = true; });
  try {
    const kq = await ganNhiemVu(r.id, p);
    notifySuccess(bo ? `Đã bỏ theo dõi giải ngân của ${r.ma}.` : kq?.doi ? `Đã lưu theo dõi giải ngân của ${r.ma}.` : 'Theo dõi giải ngân không đổi.');
    gnDongTheoDoi();
    await sauHanhDong(r.id);
    document.dispatchEvent(new CustomEvent('giai-ngan-da-ghi', { detail: { ngan: true } }));
  } catch (e) { notifyError(`Không ${bo ? 'bỏ' : 'lưu'} được theo dõi giải ngân: ${loiDeHieu(e)}`); nut.forEach((x) => { x.disabled = false; }); }
}
function gnTdHoiBo() {
  const g = ganCua.get(td.id); if (!g) return;
  $('gnTdXnChu').textContent = g.loai === 'TOAN_TINH'
    ? `Bỏ chọn nhiệm vụ này làm "Số liệu toàn tỉnh" năm ${g.nam}? Các kỳ số liệu đã nhập vẫn giữ; chưa chọn nhiệm vụ khác thì chưa nhập được kỳ mới.`
    : 'Bỏ theo dõi giải ngân của nhiệm vụ này? Nhiệm vụ không còn trong khối Giải ngân vốn của Tổng quan; việc bỏ được ghi vào diễn biến.';
  $('gnTdXacNhan').hidden = false; $('gnTdKhongBo').focus();
}
const gnTdKhongBo = () => { $('gnTdXacNhan').hidden = true; $('gnTdBo').focus(); };
function gnTdBoThat() { const r = timKlRow(td.id); if (r) ghiTheoDoi(r, { loai: null }); else gnDongTheoDoi(); }

async function gnXoaKy({ id, nv }, form) {
  const nut = form.querySelector('button[type="submit"]'); nut.disabled = true;
  try {
    await xoaKy(id);
    notifySuccess('Đã xoá kỳ số liệu giải ngân.');
    await sauHanhDong(nv);
    document.dispatchEvent(new CustomEvent('giai-ngan-da-ghi', { detail: { ngan: true } }));
  } catch (e) { notifyError('Không xoá được kỳ số liệu: ' + loiDeHieu(e)); nut.disabled = false; }
}

export function mountGiaiNgan(registerActions, napLai) {
  sauHanhDong = napLai;
  document.getElementById('modalRoot').insertAdjacentHTML('beforeend', theoDoiTemplate);
  $('gnTdLoai').addEventListener('change', veTen);
  $('gnTdNam').addEventListener('change', () => { const nam = Number($('gnTdNam').value); if (nam >= 2020 && nam <= 2100) { if ($('gnTdMoc').value.slice(0, 4) !== String(nam)) $('gnTdMoc').value = mocMacDinh(nam); napTen(nam); } });
  $('gnTdModal').addEventListener('keydown', (e) => { if (e.key === 'Escape') gnDongTheoDoi(); });
  // Ghi giải ngân mà ngăn chưa nạp lại (ngan: false) → mục Giải ngân của ngăn đang mở vẽ lại số mới.
  document.addEventListener('giai-ngan-da-ghi', (e) => {
    const id = idDangMo(); if (e.detail?.ngan || !id || !document.getElementById(`klGiaiNgan-${id}`)) return;
    const r = timKlRow(id); if (r) napGiaiNgan(r);
  });
  registerActions({ gnMoTheoDoi, gnDongTheoDoi, gnLuuTheoDoi, gnTdHoiBo, gnTdKhongBo, gnTdBoThat, gnXoaKy });
}
