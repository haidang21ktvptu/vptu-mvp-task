// Hộp "Nhập kỳ số liệu" giải ngân (v3.28, 0119) — mở từ khối Giải ngân vốn của Tổng quan hoặc ngăn chi tiết của nhiệm vụ "Số liệu toàn tỉnh". Một kỳ =
// một báo cáo chính thức (UBND tỉnh / Sở Tài chính): số liệu đến ngày, văn bản căn cứ, ước tính hay thực hiện, kế hoạch vốn năm, lũy kế đã giải ngân
// (tỷ đồng) + bảng theo nguồn vốn / chủ đầu tư (giai-ngan-nhap-bang.js). Số tổng còn trống → điền từ dòng "Tổng cộng" của bảng vừa đọc. Cảnh báo ngay
// khi nhập (vẫn cho ghi): ngày đã có kỳ (ghi = thay kỳ đó), lệch tổng, lũy kế giảm / cao hơn kỳ sau, kế hoạch đổi, số lớn bất thường (sai đơn vị / dấu
// thập phân). Sửa kỳ: mở sẵn số và bảng đã lưu; đổi ngày = ghi kỳ mới rồi xoá kỳ cũ. Không dùng AI. gn_ghi_ky là chốt quyền và kiểm tra.
import { escapeHtml } from '../../../lib/dom.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { formatNgay, homNayVN, congNgay } from '../../../lib/kl/ngay.js';
import { soVN, ptVN, tyLe, kiemTraKy } from '../../../lib/kl/giai-ngan.js';
import { docSo, doanKieuSo } from '../../../lib/kl/giai-ngan-bang.js';
import { docNam, ghiKy, xoaKy } from '../../../lib/kl/giai-ngan-db.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { idDangMo } from './chi-tiet.js';   // vòng nhập chi-tiet ↔ giai-ngan-nhap: chỉ dùng khi lưu
import { LOAI_BANG, mountBang, datLaiBang, datTenTruoc, dongDaChon, dongTongBang, nhoCachChon, doiTab, boBang } from './giai-ngan-nhap-bang.js';

const $ = (id) => document.getElementById(id);
const nk = { nam: null, ky: [], cu: null, mo: null, tuDien: false };
let sauHanhDong = async () => {};
export const nhapKyTemplate = `
<div id="gnModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="gnTieuDe">
  <form class="modal modal-gn" data-submit="gnLuuKy" novalidate>
    <h2 id="gnTieuDe" class="modal-tieu-de">Nhập kỳ số liệu giải ngân</h2>
    <p class="chu-phu mt-1 mb-4">Một kỳ = một báo cáo chính thức của UBND tỉnh / Sở Tài chính. Số tiền tính bằng tỷ đồng, dấu phẩy là dấu thập phân (8.473,913). Nhập bù được các kỳ trước.</p>
    <div class="gn-nhap-luoi">
      <div><label for="gnNgay" class="nhan">Số liệu đến ngày</label><input type="date" id="gnNgay" class="o-nhap" required></div>
      <div class="gn-rong"><label for="gnCanCu" class="nhan">Văn bản căn cứ <span class="chu-phu">số hiệu, ngày, cơ quan báo cáo</span></label>
        <input id="gnCanCu" class="o-nhap" maxlength="300" required placeholder="Ví dụ: Báo cáo số …/BC-UBND ngày …/…/2026 của UBND tỉnh"></div>
      <div><label for="gnKh" class="nhan">Kế hoạch vốn năm (tỷ đồng)</label><input id="gnKh" class="o-nhap" inputmode="decimal" autocomplete="off" required><small id="gnKhDoc" class="chu-phu" aria-live="polite"></small></div>
      <div><label for="gnDa" class="nhan">Lũy kế đã giải ngân (tỷ đồng)</label><input id="gnDa" class="o-nhap" inputmode="decimal" autocomplete="off" required><small id="gnDaDoc" class="chu-phu" aria-live="polite"></small></div>
      <div class="gn-uoc"><label class="nhan-checkbox"><input type="checkbox" id="gnUoc"> Số ước tính (chưa phải số thực hiện)</label><p id="gnTyLe" class="gn-ty-le" aria-live="polite"></p></div>
    </div>
    <div class="gn-tab" role="tablist" aria-label="Bảng chi tiết của kỳ">
      <button type="button" role="tab" data-action="gnTab" data-loai="NGUON" aria-selected="true">Theo nguồn vốn <span id="gnDemNGUON"></span></button>
      <button type="button" role="tab" data-action="gnTab" data-loai="CHU_DAU_TU" aria-selected="false">Theo chủ đầu tư, đơn vị <span id="gnDemCHU_DAU_TU"></span></button>
    </div>
    <div id="gnBang" class="gn-bang" role="tabpanel"></div>
    <div class="mt-3"><label for="gnGhiChu" class="nhan">Ghi chú <span class="chu-phu">không bắt buộc, tối đa 500 ký tự</span></label><input id="gnGhiChu" class="o-nhap" maxlength="500"></div>
    <ul id="gnCanhBao" class="gn-canh-bao" role="note" aria-live="polite" hidden></ul>
    <div class="modal-chan"><button type="button" class="nut" data-action="gnDongNhap">Huỷ</button><button type="submit" id="gnLuu" class="nut chinh">Lưu kỳ số liệu</button></div>
  </form>
</div>`;

// Số nhập tay: kiểu Việt (8.473,913); một dấu chấm mà đọc kiểu Việt ra quá 100.000 tỷ → người dùng viết dấu chấm thập phân (8473.913).
function soNhap(v) {
  const s = String(v ?? '').trim(); if (!s) return null;
  const x = docSo(s, doanKieuSo([s]));
  return typeof x === 'number' && x > 1e5 && /^\d+\.\d+$/.test(s) ? docSo(s, 'en') : x;
}
const ngayMacDinh = (nam, homNay) => {   // cuối tháng trước, trong năm kế hoạch vốn (tới 31/1 năm sau), không quá hôm nay
  const c = congNgay(`${homNay.slice(0, 7)}-01`, -1); const tu = `${nam}-01-01`; const den = [homNay, `${nam + 1}-01-31`].sort()[0];
  return c < tu ? '' : c > den ? den : c;
};
// Tên các kỳ khác trong năm theo loại (tên của kỳ mới nhất thắng) — để khớp tên khi xem trước bảng.
const tenTheoLoai = (d, boKy) => { const ngay = new Map(d.ky.map((k) => [k.id, k.ngay_so_lieu])); const ds = d.dong.filter((x) => x.ky_id !== boKy).sort((a, b) => String(ngay.get(a.ky_id)).localeCompare(String(ngay.get(b.ky_id))));
  return Object.fromEntries(LOAI_BANG.map((l) => [l, [...new Map(ds.filter((x) => x.loai === l).map((x) => [x.ten_chuan, { ten: x.ten, ten_chuan: x.ten_chuan }])).values()]])); };

function capNhat({ moi = false, loai = null } = {}) {
  if (moi && loai && !$('gnKh').value.trim() && !$('gnDa').value.trim()) {   // số tổng trống → điền từ dòng "Tổng cộng" của bảng vừa đọc
    const t = dongTongBang(loai);
    if (t && t.kh !== null) { $('gnKh').value = soVN(t.kh); $('gnDa').value = t.da === null ? '' : soVN(t.da); nk.tuDien = true; }
  }
  const kh = soNhap($('gnKh').value); const da = soNhap($('gnDa').value); const ngay = $('gnNgay').value;
  const doc = (x) => (x === null ? '' : Number.isNaN(x) ? 'không đọc được số' : `= ${soVN(x)} tỷ đồng`);
  $('gnKhDoc').textContent = doc(kh); $('gnDaDoc').textContent = doc(da);
  $('gnTyLe').textContent = typeof kh === 'number' && kh > 0 && typeof da === 'number' && !Number.isNaN(da)
    ? `Tỷ lệ giải ngân: ${ptVN(tyLe(da, kh))}${nk.tuDien ? ' — số tổng điền từ dòng "Tổng cộng" của bảng, kiểm tra lại' : ''}` : '';
  const dong = LOAI_BANG.flatMap(dongDaChon); const khac = nk.ky.filter((k) => k.id !== nk.cu?.id);
  const cb = typeof kh === 'number' && typeof da === 'number' && ngay ? kiemTraKy({ ngay_so_lieu: ngay, ke_hoach: kh, da_giai_ngan: da }, dong, khac) : [];
  if (ngay && khac.some((k) => k.ngay_so_lieu === ngay)) cb.unshift(`Ngày ${formatNgay(ngay)} đã có kỳ số liệu — lưu sẽ thay kỳ đó.`);
  if (kh > 5e4) cb.push('Kế hoạch vốn năm lớn bất thường — kiểm tra đơn vị (tỷ đồng) và dấu thập phân (dấu phẩy).');
  for (const l of LOAI_BANG) { const ds = dongDaChon(l); const ten = ds.map((d) => d.ten_chuan); const tr = ds.find((d, i) => ten.indexOf(d.ten_chuan) !== i); if (tr) cb.push(`Bảng có hai dòng cùng tên "${tr.ten}" — bỏ tích một dòng.`); }
  $('gnCanhBao').innerHTML = cb.map((x) => `<li>${escapeHtml(x)}</li>`).join(''); $('gnCanhBao').hidden = !cb.length;
  $('gnLuu').textContent = ngay && khac.some((k) => k.ngay_so_lieu === ngay) ? `Ghi thay kỳ ${formatNgay(ngay)}` : nk.cu ? 'Lưu kỳ đã sửa' : 'Lưu kỳ số liệu';
}

async function gnMoNhap({ nam, ky }, el) {
  const n = Number(nam); if (!Number.isInteger(n)) return;
  Object.assign(nk, { nam: n, ky: [], cu: null, mo: el || document.activeElement, tuDien: false });
  const homNay = homNayVN(); const den = [homNay, `${n + 1}-01-31`].sort()[0];
  $('gnTieuDe').textContent = `${ky ? 'Sửa' : 'Nhập'} kỳ số liệu giải ngân năm ${n}`;
  Object.assign($('gnNgay'), { min: `${n}-01-01`, max: den, value: ky ? '' : ngayMacDinh(n, homNay) });
  ['gnCanCu', 'gnKh', 'gnDa', 'gnGhiChu'].forEach((id) => { $(id).value = ''; }); $('gnUoc').checked = false; $('gnLuu').disabled = false;
  datLaiBang(); capNhat(); $('gnModal').classList.remove('hidden'); $('gnNgay').focus();
  try {
    const d = await docNam(n, { moi: true });
    if (nk.nam !== n) return;
    nk.ky = d.ky; nk.cu = ky ? d.ky.find((k) => k.id === ky) || null : null;
    if (nk.cu) {
      const k = nk.cu; $('gnNgay').value = k.ngay_so_lieu; $('gnCanCu').value = k.can_cu; $('gnKh').value = soVN(k.ke_hoach); $('gnDa').value = soVN(k.da_giai_ngan);
      $('gnUoc').checked = k.uoc_tinh; $('gnGhiChu').value = k.ghi_chu || '';
      datLaiBang({ truoc: tenTheoLoai(d, k.id), cu: d.dong.filter((x) => x.ky_id === k.id) });
    } else datTenTruoc(tenTheoLoai(d, null));
    capNhat();
  } catch (e) { notifyError('Chưa đọc được các kỳ đã có (cảnh báo trùng ngày, khớp tên tạm thiếu): ' + loiDeHieu(e)); }
}
function gnDongNhap() { $('gnModal').classList.add('hidden'); nk.nam = null; nk.mo?.focus?.(); }

function layKy() {
  return { nam: nk.nam, ngay_so_lieu: $('gnNgay').value, can_cu: $('gnCanCu').value.trim(), uoc_tinh: $('gnUoc').checked, ke_hoach: soNhap($('gnKh').value),
    da_giai_ngan: soNhap($('gnDa').value), ghi_chu: $('gnGhiChu').value.trim() || null, dong: LOAI_BANG.flatMap(dongDaChon) };
}
function loiKy(p) {
  if (!p.ngay_so_lieu) return 'Chọn ngày số liệu (số liệu tính đến ngày nào).';
  if (p.ngay_so_lieu < $('gnNgay').min || p.ngay_so_lieu > $('gnNgay').max) return `Ngày số liệu phải từ ${formatNgay($('gnNgay').min)} đến ${formatNgay($('gnNgay').max)}.`;
  if (!p.can_cu) return 'Ghi văn bản căn cứ (số hiệu, ngày, cơ quan báo cáo).';
  if (typeof p.ke_hoach !== 'number' || Number.isNaN(p.ke_hoach) || p.ke_hoach <= 0) return 'Ghi kế hoạch vốn năm (tỷ đồng, lớn hơn 0).';
  if (typeof p.da_giai_ngan !== 'number' || Number.isNaN(p.da_giai_ngan) || p.da_giai_ngan < 0) return 'Ghi lũy kế đã giải ngân (tỷ đồng, không âm).';
  for (const l of LOAI_BANG) { const ten = p.dong.filter((d) => d.loai === l).map((d) => d.ten_chuan); if (new Set(ten).size !== ten.length) return 'Bảng có hai dòng cùng tên — bỏ tích một dòng rồi lưu.'; }
  return '';
}
async function gnLuuKy() {
  if (!nk.nam) return;
  const p = layKy(); const loi = loiKy(p);
  if (loi) { notifyError(loi); return; }
  $('gnLuu').disabled = true;
  try {
    const kq = await ghiKy(p);
    let them = '';
    if (nk.cu && nk.cu.ngay_so_lieu !== p.ngay_so_lieu) {
      try { await xoaKy(nk.cu.id); } catch (e) { them = ` Chưa xoá được kỳ cũ đến ${formatNgay(nk.cu.ngay_so_lieu)}: ${loiDeHieu(e)}`; }
    }
    nhoCachChon();
    notifySuccess(`Đã ${kq?.thay ? 'ghi thay' : 'lưu'} kỳ số liệu đến ${formatNgay(p.ngay_so_lieu)} (${ptVN(tyLe(p.da_giai_ngan, p.ke_hoach))}, ${p.dong.length} dòng chi tiết).${them}`);
    const nam = nk.nam; gnDongNhap();
    const id = idDangMo(); const ngan = Boolean(id && document.getElementById(`klGiaiNgan-${id}`));   // ngăn chi tiết đang mở: nạp lại cả ngăn (diễn biến mới)
    if (ngan) await sauHanhDong(id);
    document.dispatchEvent(new CustomEvent('giai-ngan-da-ghi', { detail: { nam, ngan } }));
  } catch (e) { notifyError('Không lưu được kỳ số liệu: ' + loiDeHieu(e)); $('gnLuu').disabled = false; }
}

export function mountGiaiNganNhap(registerActions, napLai) {
  sauHanhDong = napLai;
  $('modalRoot').insertAdjacentHTML('beforeend', nhapKyTemplate);
  mountBang((e) => capNhat(e));
  ['gnNgay', 'gnKh', 'gnDa'].forEach((id) => $(id).addEventListener('input', () => { if (id !== 'gnNgay') nk.tuDien = false; capNhat(); }));
  $('gnModal').addEventListener('keydown', (e) => { if (e.key === 'Escape') gnDongNhap(); });
  registerActions({ gnMoNhap, gnDongNhap, gnLuuKy, gnTab: ({ loai }) => doiTab(loai), gnBoBang: ({ loai }) => boBang(loai) });
}
