// "Việc của tôi" dạng bảng (v3.25, mẫu Main 16/10/2026): ô số (mặc định Cần xử lý), tìm, vai trò (Mọi vai trò / Tôi chủ trì / Tôi theo dõi),
// phạm vi (Phạm vi của tôi / Toàn Văn phòng khi bật cấu hình xem toàn bộ — 0103, đã duyệt 13/10; ở Toàn Văn phòng thay vai trò bằng ô Cán bộ chủ
// trì / Người theo dõi), sắp xếp, nhóm theo văn bản giao, MỘT khối thao tác mở dưới dòng (giữ qua lần vẽ lại), 50 dòng mỗi trang như màn Nhiệm vụ
// (đổi ô số / tìm / lọc / sắp xếp → trang 1; nạp lại giữ trang). Dữ liệu: dh.rows lọc việc tôi chủ trì / theo dõi; Toàn Văn phòng: dh.tatCa (việc
// ngoài phạm vi chỉ xem; chuyển sang thì ô "việc của tôi" — Cần xử lý / Chưa nhận / Chỉ đạo — đổi thành Tất cả). Ô số và bảng tính trên cùng mảng.
// Quyền thật ở DB.
import { $, setText, escapeHtml, show, formatDateTime, giuONhap } from '../../lib/dom.js';
import { state, findAccount } from '../../lib/state.js';
import { homNayVN } from '../../lib/kl/ngay.js';
import { locRows } from '../../lib/kl/tong-hop.js';
import { locCanBo, tuyChonCanBo } from '../../lib/kl/pham-vi.js';
import { O_SO, locO, demO, laCuaToi, sapXepViec, nhomGiuThuTu, vaiCua } from '../../lib/kl/viec-toi.js';
import { phanTrang, chuHienThi } from '../../lib/kl/bang-o.js';
import { dh, deNghiCuaToi } from '../shared/dieu-hanh/du-lieu.js';
import { oSoHtml, nutTrangHtml, giuTieuDiem } from '../shared/bang/khung.js';
import { chiDaoCua, nhomViecCuaToi } from './viec-cua-toi.js';
import { dongViecHtml, nhomHtml } from './dong-viec.js';

const macDinh = () => ({ loc: 'can', vai: 'tat', sx: 'moi', nhomVb: false, tuKhoa: '', pham: 'toi', canBo: { chuTri: '', theoDoi: '' }, khoi: null, vanBan: new Map(), dangHien: [], trang: 1, canBoHtml: '' });
export const vct = macDinh();
export const datLaiVct = () => Object.assign(vct, macDinh());
const O_CUA_TOI = ['can', 'nhan', 'chiDao'];   // ô chỉ đếm việc của tôi — vào Toàn Văn phòng thì chuyển sang Tất cả
const me = () => state.user?.id;
const ctx = () => ({ me: me(), chiDao: chiDaoCua, deNghi: deNghiCuaToi });
export const coToanVP = () => dh.tatCa.length > dh.rows.length;   // có việc ngoài phạm vi đọc được (cấu hình xem toàn bộ)
const toanVP = () => vct.pham === 'toan' && coToanVP();
const cuaToi = () => dh.rows.filter((r) => laCuaToi(r, me()));
const MAU = { sap: 'vang', qua: 'do', xong: 'luc' };
const VAI = [['tat', 'Mọi vai trò'], ['chu', 'Tôi chủ trì theo dõi'], ['theo', 'Tôi là người theo dõi']];
const ten = (id) => findAccount(id)?.full_name || '';

// Trước ô số: phạm vi → tìm → vai trò / cán bộ.
function daLoc() {
  let ds = toanVP() ? dh.tatCa : cuaToi();
  if (vct.tuKhoa) ds = locRows(ds, { tuKhoa: vct.tuKhoa });
  if (toanVP()) return locCanBo(ds, vct.canBo);
  return vct.vai === 'tat' ? ds : ds.filter((r) => vaiCua(r, me()) === (vct.vai === 'chu' ? 'Chủ trì theo dõi' : 'Người theo dõi'));
}
// Nhóm ưu tiên của từng việc của tôi (data-kieu): tu-choi | moi | chi-dao | minh-chung | dang-lam | theo-doi | xong; việc khác: xem.
function kieuCua() {
  const n = nhomViecCuaToi(); const m = new Map();
  [['tu-choi', n.tuChoi], ['moi', n.moi], ['chi-dao', n.chiDao], ['minh-chung', n.canMinhChung], ['dang-lam', n.dangLam], ['theo-doi', n.theoDoi], ['xong', n.xong]]
    .forEach(([k, ds]) => ds.forEach((r) => { if (!m.has(r.id)) m.set(r.id, k); }));
  return m;
}

function veLoc() {
  $('vctPhamVi').innerHTML = coToanVP() ? [['toi', 'Phạm vi của tôi'], ['toan', 'Toàn Văn phòng']].map(([k, t]) =>
    `<button type="button" data-action="vctPhamVi" data-pv="${k}" aria-pressed="${String(vct.pham === k || (k === 'toi' && !toanVP()))}">${t}</button>`).join('') : '';
  show('vctPhamVi', coToanVP());
  $('vctVai').innerHTML = VAI.map(([k, t]) => `<button type="button" data-action="vctVai" data-vai="${k}" aria-pressed="${String(vct.vai === k)}">${t}</button>`).join('');
  show('vctVai', !toanVP());
  // Ô chọn cán bộ chỉ dựng lại khi danh sách đổi (chọn bằng phím mũi tên không mất ô đang chọn); giá trị đặt sau.
  const tc = toanVP() ? tuyChonCanBo(dh.tatCa, { ten }) : null;
  const html = tc ? [['chuTri', 'Chủ trì theo dõi'], ['theoDoi', 'Người theo dõi']].map(([k, nhan]) => `<select data-vct-loc="${k}" aria-label="Lọc theo ${nhan.toLowerCase()}"><option value="">${nhan} (${tc[k].length})</option>${tc[k].map((o) =>
    `<option value="${escapeHtml(o.ma)}">${escapeHtml(o.ten)} (${o.n})</option>`).join('')}</select>`).join('') : '';
  if (html !== vct.canBoHtml) { $('vctCanBo').innerHTML = html; vct.canBoHtml = html; }
  $('vctCanBo').querySelectorAll('select[data-vct-loc]').forEach((o) => { o.value = vct.canBo[o.dataset.vctLoc] || ''; });
  show('vctCanBo', Boolean(tc));
}

// Vẽ ô số, thanh lọc, bảng, chân bảng, dòng tóm tắt; chữ đang gõ trong khối dưới dòng và nút đang focus giữ qua lần vẽ. Khối đang mở không còn áp
// dụng cho dòng (đã nhận / đã nộp…) hoặc dòng không còn hiện → bỏ. Nhóm theo văn bản: xếp nhóm trên cả danh sách rồi mới chia trang.
export function veBangViec() {
  if (!$('vctBang')) return;
  const vung = document.querySelector('#viewDieuHanh .vct-trang'); const traNhap = giuONhap(vung); const traTd = giuTieuDiem(vung);
  if (vct.pham === 'toan' && !coToanVP()) vct.pham = 'toi';
  const c = ctx(); const homNay = homNayVN(); const now = Date.now();
  const tom = demO(cuaToi(), c);
  setText('vctTom', `${tom.can} việc cần làm ngay · ${tom.mo} việc đang thực hiện của đồng chí`);
  const goc = daLoc(); const so = demO(goc, c);
  $('vctSo').innerHTML = oSoHtml(O_SO, so, vct.loc, 'vctLoc', MAU);
  veLoc();
  const sx = sapXepViec(locO(goc, vct.loc, c), vct.sx);
  const nhom = vct.nhomVb ? nhomGiuThuTu(sx) : null;
  const ds = nhom ? nhom.flatMap((g) => g.rows) : sx;
  vct.dangHien = ds;   // Xuất Excel: đủ danh sách đang lọc (mọi trang), đúng thứ tự đang hiện
  const p = phanTrang(ds.length, vct.trang); vct.trang = p.trang;
  const trang = ds.slice(p.tu, p.den);
  const kieu = kieuCua(); let stt = p.tu;
  const dong = (r) => dongViecHtml(r, { stt: ++stt, homNay, now, ctx: c, kieu: kieu.get(r.id) || 'xem', khoi: vct.khoi });
  const soNhom = new Map((nhom || []).map((g) => [g.khoa, g.rows.length]));   // số việc của cả nhóm (nhóm vắt sang trang sau vẫn đúng số)
  const html = nhom ? nhomGiuThuTu(trang).map((g) => nhomHtml(g, vct.vanBan.get(g.khoa)?.trich_yeu, soNhom.get(g.khoa)) + g.rows.map(dong).join('')).join('') : trang.map(dong).join('');
  $('vctBang').innerHTML = html || `<p class="bnv-trong">${goc.length ? 'Không có việc nào ở ô đang chọn. Chọn ô Tất cả để xem mọi việc của đồng chí.' : 'Không có việc nào phù hợp điều kiện lọc.'}</p>`;
  if (vct.khoi && !document.getElementById(`vctKhoi-${vct.khoi.id}`)?.classList.contains('mo')) vct.khoi = null;
  const tong = toanVP() ? dh.tatCa.length : cuaToi().length;
  setText('vctChan', `${chuHienThi(p, ds.length, tong, 'việc')}${toanVP() ? ' · toàn Văn phòng (việc ngoài phạm vi chỉ xem)' : ''}${dh.luc ? ` · số liệu tính đến ${formatDateTime(dh.luc)}` : ''}`);
  $('vctTrang').innerHTML = nutTrangHtml(p, 'vctTrang');
  $('vctBang').dataset.nap = String(Date.now());
  traNhap(); traTd();
}

// Mở / đóng khối dưới dòng tại chỗ (không vẽ lại): mỗi lúc một khối; mở → con trỏ vào ô đầu, cuộn tới; Huỷ → về nút đã mở.
function datKhoi(id, mo) {
  const k = document.getElementById(`vctKhoi-${id}`); if (!k) return null;
  k.classList.toggle('mo', mo);
  document.querySelectorAll(`#vct-${CSS.escape(id)} [data-action="vctMoKhoi"]`).forEach((b) => b.setAttribute('aria-expanded', String(mo && b.dataset.kieu === k.dataset.kieu)));
  return k;
}
export function vctMoKhoi({ id, kieu }) {
  const dangMo = vct.khoi?.id === id && vct.khoi?.kieu === kieu;
  if (vct.khoi) datKhoi(vct.khoi.id, false);
  vct.khoi = null;
  const k = document.getElementById(`vctKhoi-${id}`);
  if (dangMo || !k || k.dataset.kieu !== kieu) return;
  datKhoi(id, true);
  vct.khoi = { id, kieu };
  k.querySelector('input:not([type="hidden"]):not([type="file"]), textarea, select')?.focus({ preventScroll: true });
  k.scrollIntoView({ block: 'nearest' });
}
export function vctDongKhoi({ id }) {
  datKhoi(id, false);
  if (vct.khoi?.id === id) vct.khoi = null;
  document.querySelector(`#vct-${CSS.escape(id)} [data-action="vctMoKhoi"]`)?.focus({ preventScroll: true });
}
export const hanhDongBangViec = {
  vctLoc: ({ loc }) => { if (O_SO.some(([k]) => k === loc)) vct.loc = loc; vct.trang = 1; veBangViec(); },
  vctVai: ({ vai }) => { if (VAI.some(([k]) => k === vai)) vct.vai = vai; vct.trang = 1; veBangViec(); },
  vctPhamVi: ({ pv }) => {
    const toan = pv === 'toan';
    if (toan !== (vct.pham === 'toan')) { vct.pham = toan ? 'toan' : 'toi'; vct.trang = 1; if (toan && O_CUA_TOI.includes(vct.loc)) vct.loc = 'tat'; }
    veBangViec();
  },
  vctTrang: ({ trang }) => { vct.trang = Number(trang) || 1; veBangViec(); document.querySelector('#viewDieuHanh .cot-vct')?.scrollIntoView({ block: 'start' }); },
  vctMoKhoi, vctDongKhoi,
};
// Ô tìm / ô chọn / ô đánh dấu (sự kiện input / change gắn ở a3/index.js — bộ điều phối click chặn mặc định nên ô đánh dấu không dùng data-action).
export function doiLocViec(el) {
  if (el.id === 'vctTim') { if (vct.tuKhoa === el.value) return false; vct.tuKhoa = el.value; }
  else if (el.id === 'vctSapXep') vct.sx = el.value;
  else if (el.id === 'vctNhomVb') vct.nhomVb = el.checked;
  else if (el.matches?.('select[data-vct-loc]')) vct.canBo = { ...vct.canBo, [el.dataset.vctLoc]: el.value };
  else return false;
  vct.trang = 1;
  return true;
}
