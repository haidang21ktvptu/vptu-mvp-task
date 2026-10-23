// Đường dẫn trên thanh địa chỉ (v3.29 — chủ dự án 22/10/2026, CAU-HOI O-7): đổi màn → ghi đường dẫn của màn (history.pushState, gọi từ
// setActiveNav và khi đổi thẻ Quản trị / Giao việc); Quay lại / Tiến tới → mở đúng chức năng (popstate); vào app (đăng nhập xong, tải lại, mở đường dẫn
// được gửi) → moManDau mở chức năng theo đường dẫn nếu thuộc menu / quyền của người dùng, không thì trang đầu của vai kèm thông báo. Bảng đường dẫn và
// quy tắc chọn ở lib/tuyen.js (thuần). Đây chỉ chọn màn để vẽ — quyền thật vẫn ở RLS / hàm DB.
// Một lượt bấm có thể sáng nhiều mục liên tiếp (chuyên viên: "Việc tôi đã giao" mở danh sách rồi đổi mục) → các lần ghi trong cùng lượt gộp làm một
// (mục cuối, ghi ở microtask). Mở theo đường dẫn / Quay lại (đồng bộ, trước await đầu tiên của màn) → sửa bước lịch sử hiện tại, không thêm bước.
// Chưa có phiên (mở đường dẫn, hết phiên, đăng xuất): thanh địa chỉ ghi "/Dang-nhap" (chủ dự án 22/10/2026); chức năng đang mở giữ trong
// history.state.tiep — không ghi lên đường dẫn — để đăng nhập xong mở đúng chức năng, bước "/Dang-nhap" được thay bằng đường dẫn chức năng.
// Chi tiết một nhiệm vụ (chủ dự án 22/10/2026 17:02): "…/<chức năng>/NV-9601" — mở việc thêm một bước (đổi sang việc khác thì thay bước), người dùng
// đóng / Quay lại trong ngăn thì lùi đúng bước đó; Quay lại / Tiến tới của trình duyệt trong cùng màn chỉ đóng / mở việc (không vẽ lại màn); tải lại,
// đường dẫn được gửi → mở màn rồi mở việc theo mã (hành động moViecTheoMa — RLS quyết định thấy hay không).
import { state } from '../../lib/state.js';
import { goiHanhDong } from '../../lib/actions.js';
import { notify } from '../../components/toast.js';
import { tachDuong, tachViec, duongChucNang, chonMo, duongCua, laDangNhap, laMaViec, DUONG_DANG_NHAP } from '../../lib/tuyen.js';

// Gốc của app ("/vptu-mvp-task/", staging "/vptu-mvp-task/staging/") — Vite thay import.meta.env.BASE_URL lúc build; chạy trong Node (unit test): "/".
const goc = () => { try { return import.meta.env.BASE_URL || '/'; } catch { return '/'; } };
const BASE = goc();
const MAN_RIENG = ['viewRaSoatMucTieu', 'viewCaNhan', 'viewTroGiup'];   // màn ngoài menu có đường dẫn riêng (theo section đang hiện)
let menu = [];               // mục menu của người đang đăng nhập (renderNav)
let macDinhVai = null;       // mở trang đầu của vai (init của view)
let dangMoTheoDuong = false; // trong phần đồng bộ của lượt mở theo đường dẫn / Quay lại
let cho = null;              // lần ghi đang chờ của lượt hiện tại: { navId, thay }
let manDangHien = '';        // đường dẫn chức năng (không mã việc) app ghi gần nhất — Quay lại / Tiến tới so để biết chỉ đổi việc hay đổi màn
let maDangMo = '';           // mã việc đang mở ở chi tiết (đang trên thanh địa chỉ)
let thayViecToi = false;     // lần mở việc kế tiếp sửa bước hiện tại (mở việc theo đường dẫn / Quay lại / Tiến tới)
let choLui = '';             // đường dẫn bước trước mà history.back() của app sẽ tới (người dùng vừa đóng việc): popstate tới đó không vẽ lại gì
let luot = 0;                // lượt điều hướng: người dùng đổi màn / mở việc, mở theo đường dẫn → tăng; lượt mở việc theo đường dẫn còn chờ thì bỏ
let viecTrongMan = () => '';  // mã việc đang mở NGAY TRONG màn vừa hiện (màn Nhiệm vụ giữ ngăn của nó khi đổi màn rồi quay lại) — kl/chi-tiet.js đăng ký
const quyen = {};            // quyền mở màn ngoài menu: { quanTri, raSoat, nhapExcel } (u) => bool — màn tự đăng ký (tránh import vòng)
const theCua = {};           // thẻ đang chọn của màn có thẻ: { navQuanTri: () => 'qtKhuTaiKhoan', navGiaoViec: () => 'nhap' }

export const datMenuDuongDan = (ds) => { menu = ds || []; };
export const dangKyQuyenDuongDan = (ten, fn) => { quyen[ten] = fn; };
export const dangKyThe = (navId, fn) => { theCua[navId] = fn; };
export const dangKyViecTrongMan = (fn) => { viecTrongMan = fn; };
export const conLuot = (l) => !Number.isFinite(l) || l === luot;
// Thay bước: giữ dấu "bước do mở việc thêm" (chiTiet) — đóng việc ở bước đó vẫn lùi đúng một bước. Bước do pushState thêm dùng chung tài liệu với bước
// trước (chuẩn HTML) — kể cả sau tải lại, lùi vẫn trong trang, không nạp lại.
const giuDau = () => (history.state?.chiTiet ? { chiTiet: true } : null);
const manRiengDangHien = () => MAN_RIENG.find((id) => { const el = document.getElementById(id); return el && !el.classList.contains('hidden'); }) || '';

function ghiCho() {
  const c = cho; cho = null;
  if (!c || !state.user) return;
  const duong = duongCua({ nav: c.navId, man: manRiengDangHien(), vai: state.user.role_group, the: theCua[c.navId]?.() || '' });
  if (!duong) return;
  const cungMan = duong.toLowerCase() === manDangHien.toLowerCase();
  if (!cungMan) maDangMo = laMaViec(viecTrongMan()) ? viecTrongMan() : '';   // sang màn khác: ngăn dùng chung đã đóng
  manDangHien = duong;
  if (!c.thay) { luot += 1; thayViecToi = false; }   // người dùng đổi màn: bỏ lượt mở việc theo đường dẫn còn chờ
  const t = tachViec(tachDuong(location.pathname, BASE));
  if (cungMan && maDangMo && t?.ma && duongChucNang(t).toLowerCase() === duong.toLowerCase() && !location.search) return;   // màn vẽ lại khi đang mở việc
  const url = `${BASE}${duong}${maDangMo ? `/${maDangMo}` : ''}`;
  if (choLui && url === choLui) return;   // đang lùi bước mở việc: bước trước chính là đường dẫn này
  if (location.pathname === url && !location.search) return;
  if (c.thay) history.replaceState(giuDau(), '', `${url}${location.hash}`);
  else history.pushState(null, '', `${url}${location.hash}`);
}
// Ghi đường dẫn của màn đang hiện nếu khác thanh địa chỉ (bỏ cả ?p= còn lại). navId: mục menu vừa sáng ('' = màn ngoài menu); thay: sửa bước lịch sử
// hiện tại thay vì thêm bước (màn tự chọn lại thẻ khác thẻ trong đường dẫn).
export function ghiDuongDan(navId, { thay = false } = {}) {
  if (!state.user) return;
  const dau = !cho;
  cho = { navId, thay: Boolean(cho?.thay) || thay || dangMoTheoDuong };
  if (dau) queueMicrotask(ghiCho);
}

// Mở chi tiết một việc (toggleKlChiTiet): "…/<chức năng>/<mã>". Chưa mở việc nào → thêm bước (đánh dấu chiTiet để đóng thì lùi); đang mở việc khác,
// mở theo đường dẫn / Quay lại → thay bước.
export function ghiViec(ma) {
  if (!state.user || !manDangHien || !laMaViec(ma)) return;
  const thay = thayViecToi || dangMoTheoDuong || Boolean(maDangMo);
  if (!thayViecToi && !dangMoTheoDuong) luot += 1;   // người dùng mở việc: lượt mở theo đường dẫn còn chờ (nếu có) thôi
  thayViecToi = false;
  maDangMo = String(ma).toUpperCase();
  const url = `${BASE}${manDangHien}/${maDangMo}`;
  if (location.pathname === url) return;
  if (thay) history.replaceState(giuDau(), '', `${url}${location.hash}`);
  else history.pushState({ chiTiet: true }, '', `${url}${location.hash}`);
}
// Đóng chi tiết việc. nguoiDung (Đóng, Quay lại, Esc trong ngăn) và bước này do mở việc thêm vào → lùi đúng một bước (Tiến tới mở lại việc); còn lại
// (mở danh sách khác trong ngăn) → sửa bước hiện tại về đường dẫn chức năng. Đổi màn không gọi — màn mới tự ghi đường dẫn của nó.
export function boViec({ nguoiDung = false } = {}) {
  if (!maDangMo) return;
  maDangMo = '';
  if (!state.user || !manDangHien) return;
  if (nguoiDung && history.state?.chiTiet) { choLui = `${BASE}${manDangHien}`; history.back(); return; }
  history.replaceState(null, '', `${BASE}${manDangHien}${location.hash}`);
}
// Đổi màn (ngăn dùng chung tự đóng): quên việc đang mở, không đụng lịch sử — bước "…/<mã>" giữ lại để Quay lại mở lại việc; màn mới tự ghi đường dẫn.
export const quenViec = () => { maDangMo = ''; };
// Mã trên đường dẫn không mở được (không có / ngoài phạm vi): bỏ mã, giữ đường dẫn chức năng.
export function boMaTrenDuong() {
  thayViecToi = false; maDangMo = '';
  if (state.user && manDangHien) history.replaceState(null, '', `${BASE}${manDangHien}${location.hash}`);
}
// Tự đăng xuất vì hết phiên (nạp lại tại chỗ): bỏ mã việc khỏi đường dẫn — người đăng nhập sau (máy dùng chung) không mở thẳng việc của người trước;
// đường dẫn chức năng giữ như trước (đăng nhập lại vào đúng chức năng).
export function boMaTruocKhiThoat() {
  const t = tachViec(tachDuong(location.pathname, BASE));
  if (t?.ma) history.replaceState(null, '', `${BASE}${duongChucNang(t)}${location.hash}`);
}

// Màn đăng nhập: "/Dang-nhap" (giữ chức năng của đường dẫn đang mở — hoặc của lần trước — trong history.state.tiep).
export function ghiDangNhap() {
  const t = tachDuong(location.pathname, BASE);
  const tiep = t?.duong && !laDangNhap(t.duong) ? [t.duong, t.the].filter(Boolean).join('/') : String(history.state?.tiep || '');
  history.replaceState(tiep ? { tiep } : null, '', `${BASE}${DUONG_DANG_NHAP}${location.hash}`);
}
// Đường dẫn để chọn màn (kèm mã việc): đang ở "/Dang-nhap" (vừa đăng nhập) → chức năng đã mở trước khi đăng nhập, không có thì trang đầu.
function duongCanMo() {
  const t = tachViec(tachDuong(location.pathname, BASE));
  if (!t || !laDangNhap(t.duong)) return t;
  const tiep = String(history.state?.tiep || '');
  return tiep ? tachViec(tachDuong(`${BASE}${tiep}`, BASE)) : null;
}

function moTheoDuong(macDinh) {
  const u = state.user;
  const t = duongCanMo();
  const q = Object.fromEntries(['quanTri', 'raSoat', 'nhapExcel'].map((k) => [k, Boolean(quyen[k]?.(u))]));
  const kq = t?.duong ? chonMo(t, { vai: u?.role_group, menu, quyen: q }) : null;
  let p;
  const l = (luot += 1);
  dangMoTheoDuong = true; maDangMo = '';
  try {
    if (kq?.action) p = goiHanhDong(kq.action, kq.ds);
    else {
      if (kq?.tuChoi) notify('Đường dẫn không thuộc chức năng của tài khoản đồng chí — đã mở trang đầu.');
      p = macDinh?.();
    }
  } finally { dangMoTheoDuong = false; }
  if (t?.ma) {   // màn mở xong rồi mở việc — trừ khi người dùng đã chuyển đi trong lúc chờ
    thayViecToi = true;
    Promise.resolve(p).catch(() => null).then(() => { if (l === luot) goiHanhDong('moViecTheoMa', { ma: t.ma, luot: String(l) }); });
  }
  return p;
}

// Trang đầu khi vào app — thay cho gọi thẳng openTongQuan / openDieuHanh trong init của từng vai.
export function moManDau(macDinh) {
  macDinhVai = macDinh;
  return moTheoDuong(macDinh);
}

// Quay lại / Tiến tới: cùng màn đang hiện thì chỉ mở / đóng việc theo mã (không vẽ lại màn); khác màn thì mở màn (rồi việc nếu có).
export function khiLichSuDoi() {
  if (choLui) { const cua = location.pathname === choLui; choLui = ''; if (cua) { ghiLaiNeuLech(); return; } }   // bước lùi của chính app: giao diện đã đúng
  if (!state.user || !macDinhVai) return;
  const t = tachViec(tachDuong(location.pathname, BASE));
  if (t && !laDangNhap(t.duong) && manDangHien && duongChucNang(t).toLowerCase() === manDangHien.toLowerCase()) {
    if (t.ma && t.ma !== maDangMo) { thayViecToi = true; goiHanhDong('moViecTheoMa', { ma: t.ma, luot: String((luot += 1)) }); }
    else if (!t.ma && maDangMo) { maDangMo = ''; goiHanhDong('dongViecTheoDuong'); }
    return;
  }
  moTheoDuong(macDinhVai);
}
// Bước lùi của app xong mà thanh địa chỉ khác màn / việc đang hiện: người dùng đổi màn, mở việc ngay lúc trình duyệt còn đang lùi — Chromium bỏ lần
// ghi đó (bước lùi đè) → ghi lại. Bình thường bước lùi xong trước lần ghi kế tiếp: đường dẫn đã đúng, không ghi gì.
function ghiLaiNeuLech() {
  if (!state.user || !manDangHien) return;
  const url = `${BASE}${manDangHien}${maDangMo ? `/${maDangMo}` : ''}`;
  if (location.pathname !== url) history.pushState(maDangMo ? { chiTiet: true } : null, '', `${url}${location.hash}`);
}
if (typeof window !== 'undefined') window.addEventListener('popstate', khiLichSuDoi);

// 404.html của site (GitHub Pages) chuyển đường dẫn lạ / sai chữ hoa về app kèm ?p=<phần sau base>: đặt lại thanh địa chỉ trước khi chạy app.
export function khoiPhucTu404() {
  const p = new URLSearchParams(location.search).get('p');
  if (p === null) return;
  history.replaceState(null, '', `${BASE}${p.split(/[?#]/)[0].replace(/^\/+/, '')}${location.hash}`);
}
