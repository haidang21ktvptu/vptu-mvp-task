// Thống kê sử dụng › Nhiệm vụ nhập mới (0104, v3.24): qt_thong_ke_nhap_moi (đếm theo kỳ × người nhập × cách nhập trên toàn hệ thống, chỉ quản
// trị hệ thống) → dải tổng, biểu đồ cột chồng (bấm cột = chọn kỳ), bảng theo kỳ, theo người nhập (bấm tên = lọc người nhập). Danh sách việc của
// kỳ đang chọn đọc v_nhiem_vu theo RLS (quy tắc 7 — không mở rộng phạm vi xem) + dong_nhap để biết việc do lô Excel tạo; vì vậy danh sách có
// thể ít hơn số thống kê, chân bảng nói rõ. Số liệu đọc theo trang (max_rows 1000 của PostgREST không cắt mất kỳ mới), khoảng xem có giới hạn
// theo đơn vị (KHOANG_TOI_DA); lượt nạp cũ về sau lượt mới bị bỏ (nm.lanNap). #tkNmCtBody[data-nap] = danh sách đã nạp xong (e2e chờ).
import { supabase } from '../../../lib/supabase.js';
import { $, setText, escapeHtml, showInlineError } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { notifyError } from '../../../components/toast.js';
import { homNayVN, congNgay, formatNgay } from '../../../lib/kl/ngay.js';
import { taiTheoTrang } from '../../../lib/kl/cot.js';
import { DON_VI, CACH_NHAP, KQ_LO_TAO_VIEC, KHOANG_TOI_DA, NHAN_KHOANG_TOI_DA, dauNgayVN, gioVN, dauKy, khoangMacDinh, khoangCuaKy, nhanKy,
  gomNhapMoi, cachNhapCua, trucDep } from '../../../lib/thong-ke.js';

const HIEN_TOI_DA = 300;
const nm = { donVi: 'ngay', tu: '', den: '', dong: [], homNay: [], gom: null, chon: '', ct: [], lan: 0, lanNap: 0 };
const tenCua = (id) => (id ? state.accounts.find((a) => a.id === id)?.full_name || 'Tài khoản đã xoá' : 'Bộ dữ liệu ban đầu');
const loc = () => ({ nguoi: $('tkNmNguoi').value, cach: $('tkNmCach').value });
const cat = (s, n = 140) => (s && s.length > n ? `${s.slice(0, n)}…` : s || '');

export async function renderThongKeNhapMoi() {
  if (!nm.tu) Object.assign(nm, khoangMacDinh(nm.donVi));
  document.querySelectorAll('[data-action="tkNmDonVi"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.donVi === nm.donVi)));
  $('tkNmTu').value = nm.tu; $('tkNmDen').value = nm.den; setText('tkNmDonViChu', DON_VI[nm.donVi][1]);
  $('tkNmCtBody').removeAttribute('data-nap');
  const lan = ++nm.lanNap; const homNay = homNayVN();
  const goi = (donVi, tu, den) => () => supabase.rpc('qt_thong_ke_nhap_moi', { p_don_vi: donVi, p_tu: tu, p_den: den }).order('ky').order('nguoi_nhap').order('cach');
  let dong; let hn;
  try {
    [dong, hn] = await Promise.all([taiTheoTrang(goi(DON_VI[nm.donVi][0], nm.tu, nm.den), 'đọc thống kê'),
      taiTheoTrang(goi('day', homNay, homNay), 'đọc thống kê hôm nay').catch(() => [])]);
  } catch (e) { if (lan === nm.lanNap) notifyError('Không đọc được thống kê nhiệm vụ nhập mới: ' + e.message); return; }
  if (lan !== nm.lanNap) return;   // đã đổi đơn vị / khoảng trong lúc đọc
  nm.dong = dong; nm.homNay = hn;
  napNguoiNhap();
  gom();
  const coSo = nm.gom.ky.filter((x) => x.tong);
  if (!nm.gom.ky.some((x) => x.ky === nm.chon)) nm.chon = (coSo[coSo.length - 1] || nm.gom.ky[nm.gom.ky.length - 1])?.ky || dauKy(nm.den, nm.donVi);
  ve();
  await napChiTiet();
}

// Ô chọn người nhập: những người có nhập trong khoảng (giữ lựa chọn đang có).
function napNguoiNhap() {
  const o = $('tkNmNguoi'); const dang = o.value;
  const ids = [...new Set(nm.dong.map((r) => r.nguoi_nhap).filter(Boolean))].sort((a, b) => tenCua(a).localeCompare(tenCua(b), 'vi'));
  if (dang && !ids.includes(dang)) ids.push(dang);
  o.innerHTML = `<option value="">Mọi người nhập</option>${ids.map((id) => `<option value="${id}">${escapeHtml(tenCua(id))}</option>`).join('')}`;
  o.value = dang;
}

function gom() { nm.gom = gomNhapMoi(nm.dong, { tu: nm.tu, den: nm.den, donVi: nm.donVi, ...loc() }); }

function ve() {
  const { tong, ky, nguoi } = nm.gom;
  ['tong', 'GIAO_VIEC', 'TIEP_XUONG', 'EXCEL', 'soNguoi'].forEach((k) => setText(`tkNmSo-${k}`, tong[k]));
  setText('tkNmSo-homNay', gomNhapMoi(nm.homNay, { tu: homNayVN(), den: homNayVN(), donVi: 'ngay', ...loc() }).tong.tong);
  $('tkNmBieu').innerHTML = bieuHtml(ky);
  const coSo = ky.filter((x) => x.tong).reverse();
  $('tkNmKyBody').innerHTML = coSo.length ? coSo.map((x) => {
    const [id, so] = Object.entries(x.nguoi).sort((a, b) => b[1] - a[1])[0];
    return `<tr${x.ky === nm.chon ? ' class="dang-chon"' : ''}><td data-nhan="Kỳ"><button type="button" class="tk-ten" data-action="tkNmChonKy" data-ky="${x.ky}">${nhanKy(x.ky, nm.donVi)}</button></td>
      <td data-nhan="Tổng" class="phai"><b>${x.tong}</b></td><td data-nhan="Giao việc" class="phai">${x.GIAO_VIEC}</td><td data-nhan="Giao tiếp xuống" class="phai">${x.TIEP_XUONG}</td>
      <td data-nhan="Nhập Excel" class="phai">${x.EXCEL}</td><td data-nhan="Người nhập nhiều nhất">${escapeHtml(tenCua(id))} (${so})</td></tr>`;
  }).join('') : '<tr><td colspan="6" class="trong">Chưa có nhiệm vụ nào được nhập trong khoảng này.</td></tr>';
  const dangLoc = loc().nguoi;
  $('tkNmNguoiBody').innerHTML = nguoi.length ? nguoi.map((g) => `<tr${g.nguoi === dangLoc ? ' class="dang-chon"' : ''}>
      <td data-nhan="Người nhập">${g.nguoi ? `<button type="button" class="tk-ten" data-action="tkNmChonNguoi" data-id="${g.nguoi}" aria-pressed="${g.nguoi === dangLoc}"
        title="${g.nguoi === dangLoc ? 'Bỏ lọc người nhập' : 'Chỉ xem việc do cán bộ này nhập'}">${escapeHtml(tenCua(g.nguoi))}</button>` : escapeHtml(tenCua(''))}</td>
      <td data-nhan="Tổng" class="phai"><b>${g.tong}</b></td><td data-nhan="Giao việc" class="phai">${g.GIAO_VIEC}</td>
      <td data-nhan="Giao tiếp xuống" class="phai">${g.TIEP_XUONG}</td><td data-nhan="Nhập Excel" class="phai">${g.EXCEL}</td></tr>`).join('')
    : '<tr><td colspan="5" class="trong">Chưa có người nhập nào trong khoảng này.</td></tr>';
}

function bieuHtml(ky) {
  const { dinh, vach } = trucDep(Math.max(0, ...ky.map((x) => x.tong)));
  const pt = (v) => `${(v / dinh) * 100}%`; const cot = `repeat(${ky.length}, minmax(0, 1fr))`;
  const buoc = Math.ceil(ky.length / 7);   // tối đa ~7 nhãn trục ngang (đọc được cả trên điện thoại), luôn có kỳ mới nhất
  const nhan = (x) => `${nhanKy(x.ky, nm.donVi)}: ${x.tong} nhiệm vụ (giao việc ${x.GIAO_VIEC}, giao tiếp xuống ${x.TIEP_XUONG}, nhập Excel ${x.EXCEL})`;
  return `<div class="bd-thang"><div class="truc-y">${vach.map((v) => `<span style="bottom:${pt(v)}">${v}</span>`).join('')}</div>
    <div class="ve-thang" style="grid-template-columns:${cot}">${vach.slice(1).map((v) => `<i class="luoi" style="bottom:${pt(v)}"></i>`).join('')}
      ${ky.map((x) => `<button type="button" class="nhom-cot" data-action="tkNmChonKy" data-ky="${x.ky}" aria-pressed="${x.ky === nm.chon}" title="${escapeHtml(nhan(x))}"
        aria-label="${escapeHtml(nhan(x))}"><span class="tk-cot" style="height:${pt(x.tong)}">${[['c-gv', x.GIAO_VIEC], ['c-tx', x.TIEP_XUONG], ['c-ex', x.EXCEL]]
    .filter(([, n]) => n).map(([lop, n]) => `<i class="${lop}" style="flex-grow:${n}"></i>`).join('')}</span></button>`).join('')}</div>
    <div class="truc-x" style="grid-template-columns:${cot}">${ky.map((x, i) => `<span>${(ky.length - 1 - i) % buoc === 0 ? nhanKy(x.ky, nm.donVi, true) : ''}</span>`).join('')}</div></div>`;
}

// Mọi việc nhập trong kỳ đang chọn mà người xem thấy (RLS) + việc nào do lô Excel tạo (dong_nhap, từng nhóm 100 mã).
async function napChiTiet() {
  const lan = ++nm.lan; const k = khoangCuaKy(nm.chon, nm.donVi);
  const tu = k.tu < nm.tu ? nm.tu : k.tu; const den = k.den > nm.den ? nm.den : k.den;   // kỳ đầu / cuối chỉ phần nằm trong khoảng đang xem
  $('tkNmCtBody').removeAttribute('data-nap');
  setText('tkNmCtTieuDe', `Nhiệm vụ nhập trong ${nhanKy(nm.chon, nm.donVi)}${tu !== k.tu || den !== k.den ? ` (${formatNgay(tu)} – ${formatNgay(den)})` : ''}`);
  let ct = [];
  try {
    const ds = await taiTheoTrang(() => supabase.from('v_nhiem_vu').select('id, ma, noi_dung, so_ket_luan, ngay_ban_hanh, tao_boi, created_at, nguon, nhiem_vu_cha')
      .gte('created_at', dauNgayVN(tu)).lt('created_at', dauNgayVN(congNgay(den, 1))).order('created_at', { ascending: false }).order('id'), 'đọc nhiệm vụ của kỳ');
    const id = ds.filter((r) => r.nguon !== 'excel').map((r) => r.id);
    const lo = await Promise.all(Array.from({ length: Math.ceil(id.length / 100) }, (_, i) => supabase.from('dong_nhap').select('nhiem_vu_id')
      .in('nhiem_vu_id', id.slice(i * 100, (i + 1) * 100)).in('ket_qua', KQ_LO_TAO_VIEC)));
    const loi = lo.find((x) => x.error); if (loi) throw new Error(loi.error.message);
    const idExcel = new Set(lo.flatMap((x) => x.data || []).map((x) => x.nhiem_vu_id));
    ct = ds.map((r) => ({ ...r, cach: cachNhapCua(r, idExcel) }));
  } catch (e) { if (lan === nm.lan) notifyError('Không đọc được danh sách nhiệm vụ của kỳ: ' + e.message); }
  if (lan !== nm.lan) return;   // đã chọn kỳ khác trong lúc đọc
  nm.ct = ct; veChiTiet();
}

const chiTietLoc = () => { const { nguoi, cach } = loc(); return nm.ct.filter((r) => (!nguoi || (r.tao_boi || '') === nguoi) && (!cach || r.cach === cach)); };
function veChiTiet() {
  const ds = chiTietLoc(); const soTk = nm.gom.ky.find((x) => x.ky === nm.chon)?.tong || 0;
  $('tkNmCtBody').innerHTML = ds.length ? ds.slice(0, HIEN_TOI_DA).map((r) => `<tr data-ma="${escapeHtml(r.ma)}"><td data-nhan="Thời gian nhập">${gioVN(r.created_at)}</td>
      <td data-nhan="Nhiệm vụ"><button type="button" class="tk-ten" data-action="nganMoViec" data-id="${r.id}"><b>${escapeHtml(r.ma)}</b> ${escapeHtml(cat(r.noi_dung))}</button></td>
      <td data-nhan="Văn bản giao">${escapeHtml(r.so_ket_luan || '')}${r.ngay_ban_hanh ? `<small class="chu-phu">ban hành ${formatNgay(r.ngay_ban_hanh)}</small>` : ''}</td>
      <td data-nhan="Cách nhập">${CACH_NHAP[r.cach]}</td><td data-nhan="Người nhập">${escapeHtml(tenCua(r.tao_boi))}</td></tr>`).join('')
    : `<tr><td colspan="5" class="trong">${soTk ? 'Các nhiệm vụ nhập trong kỳ này nằm ngoài phạm vi xem của đồng chí.' : 'Kỳ này chưa có nhiệm vụ nào được nhập.'}</td></tr>`;
  const chan = [`${ds.length} nhiệm vụ, mới nhập trước; bấm một dòng để xem chi tiết`];
  if (ds.length > HIEN_TOI_DA) chan.push(`đang hiện ${HIEN_TOI_DA} nhiệm vụ mới nhất, xuất Excel để có đủ danh sách`);
  if (ds.length < soTk) chan.push(`số thống kê của kỳ là ${soTk} (toàn hệ thống); danh sách chỉ gồm việc trong phạm vi xem của đồng chí`);
  setText('tkNmCtChan', chan.join(' · '));
  $('tkNmCtBody').dataset.nap = new Date().toISOString();
}

async function xuatExcel() {
  const { taoXlsx, taiXuong } = await import('../../../lib/xlsx.js');
  const so = (nhan) => ({ nhan, rong: 14 });
  const sheets = [
    { ten: 'Theo kỳ', cot: [{ nhan: 'Kỳ', rong: 26 }, so('Tổng'), so('Giao việc'), so('Giao tiếp xuống'), so('Nhập Excel')],
      dong: [...nm.gom.ky].reverse().map((x) => [nhanKy(x.ky, nm.donVi), x.tong, x.GIAO_VIEC, x.TIEP_XUONG, x.EXCEL]) },
    { ten: 'Theo người nhập', cot: [{ nhan: 'Người nhập', rong: 30 }, so('Tổng'), so('Giao việc'), so('Giao tiếp xuống'), so('Nhập Excel')],
      dong: nm.gom.nguoi.map((g) => [tenCua(g.nguoi), g.tong, g.GIAO_VIEC, g.TIEP_XUONG, g.EXCEL]) },
    { ten: 'Danh sách kỳ đang chọn', cot: [{ nhan: 'Thời gian nhập', rong: 18 }, { nhan: 'Mã', rong: 12 }, { nhan: 'Nội dung nhiệm vụ', rong: 60 },
      { nhan: 'Văn bản giao', rong: 24 }, { nhan: 'Ngày ban hành', rong: 14, kieu: 'ngay' }, { nhan: 'Cách nhập', rong: 22 }, { nhan: 'Người nhập', rong: 26 }],
    dong: chiTietLoc().map((r) => [gioVN(r.created_at), r.ma, r.noi_dung, r.so_ket_luan || '', r.ngay_ban_hanh || '', CACH_NHAP[r.cach], tenCua(r.tao_boi)]) },
  ];
  taiXuong(`nhiem-vu-nhap-moi-theo-${nm.donVi}-${nm.tu}-${nm.den}.xlsx`, taoXlsx(sheets));
}

function xemKhoang() {
  const tu = $('tkNmTu').value; const den = $('tkNmDen').value;
  const sai = !tu || !den || den < tu ? 'Khoảng ngày chưa đúng: chọn Từ ngày trước hoặc bằng Đến ngày.'
    : (Date.parse(den) - Date.parse(tu)) / 864e5 < KHOANG_TOI_DA[nm.donVi] ? ''
      : ['ngay', 'tuan'].includes(nm.donVi) ? `Xem theo ${DON_VI[nm.donVi][1]} tối đa ${NHAN_KHOANG_TOI_DA[nm.donVi]}; khoảng dài hơn đồng chí chọn xem theo tháng hoặc năm.`
        : 'Khoảng xem tối đa 10 năm.';
  showInlineError('tkNmLoi', sai);
  if (sai) return;
  Object.assign(nm, { tu, den }); renderThongKeNhapMoi();
}

export const hanhDongNhapMoi = {
  tkNmDonVi: ({ donVi }) => { showInlineError('tkNmLoi', ''); Object.assign(nm, { donVi, ...khoangMacDinh(donVi), chon: '' }); renderThongKeNhapMoi(); },
  tkNmXemKhoang: xemKhoang,
  tkNmChonKy: ({ ky }) => { nm.chon = ky; ve(); napChiTiet(); },
  tkNmChonNguoi: ({ id }) => { const o = $('tkNmNguoi'); o.value = o.value === id ? '' : id; doiLoc(); },
  tkNmXuat: () => xuatExcel().catch((e) => notifyError('Không xuất được tệp: ' + e.message)),
};
function doiLoc() { if (nm.gom) { gom(); ve(); veChiTiet(); } }   // chưa nạp lần nào: bỏ qua
export function ganLocNhapMoi() { ['tkNmNguoi', 'tkNmCach'].forEach((id) => $(id).addEventListener('change', doiLoc)); }
