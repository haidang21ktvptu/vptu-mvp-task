// Đếm hết phiên do không thao tác (v3.15.1): bật khi vào app, tắt khi đăng xuất. Mọi thao tác (chuột, phím, chạm, cuộn) ghi mốc vào
// localStorage (các tab cùng trình duyệt dùng chung); cứ 15 giây kiểm một lần, tab quay lại foreground kiểm ngay. Sắp hết → một toast
// nhắc; hết → signOut thiết bị này (scope local — phiên trên điện thoại của chính người đó không bị cắt), ghi lý do vào sessionStorage
// (chỉ một mã, không phải dữ liệu tài khoản) rồi tải lại trang để màn đăng nhập hiện câu giải thích.
import { supabase, sessionStorageKey } from '../lib/supabase.js';
import { notify } from '../components/toast.js';
import { KHOA_LAN_CUOI, KHOA_GHI_DE_PHUT, KHOA_LY_DO_THOAT, phutHetPhien, trangThaiPhien, CAU_HET_PHIEN, CAU_SAP_HET } from '../lib/het-phien.js';

const SU_KIEN = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'];
const CHU_KY_MS = 15_000;
let hen = null;
let daNhac = false;
let onLeave = () => {};
let dangThoat = false;

const doc = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const ghi = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage bị chặn: chỉ đếm trong tab */ } };
let lanCuoiTab = Date.now();   // dự phòng khi localStorage không dùng được

function ghiThaoTac() { lanCuoiTab = Date.now(); ghi(KHOA_LAN_CUOI, String(lanCuoiTab)); daNhac = false; }
const lanCuoi = () => Number(doc(KHOA_LAN_CUOI)) || lanCuoiTab;
export const soPhut = () => phutHetPhien(doc(KHOA_GHI_DE_PHUT));

// Lúc tải lại trang: phiên Supabase còn nhưng mốc thao tác cuối đã quá hạn (treo qua đêm) → coi như hết phiên, không vào app.
export function phienDaQuaHan() {
  const moc = Number(doc(KHOA_LAN_CUOI));
  return Boolean(moc) && trangThaiPhien(moc, Date.now(), { phut: soPhut() }).trangThai === 'het';
}

async function thoatVi(lyDo) {
  if (dangThoat) return;
  dangThoat = true;
  tatDemPhien();
  onLeave();
  try { sessionStorage.setItem(KHOA_LY_DO_THOAT, lyDo); } catch { /* bỏ qua */ }
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) { try { localStorage.removeItem(sessionStorageKey()); } catch { /* bỏ qua */ } }
  location.reload();
}

function kiemTra() {
  const { trangThai, conGiay } = trangThaiPhien(lanCuoi(), Date.now(), { phut: soPhut() });
  if (trangThai === 'het') { thoatVi('het_phien'); return; }
  if (trangThai === 'sap_het' && !daNhac) { daNhac = true; notify(CAU_SAP_HET(conGiay), 'error'); }
}
function khiHienLai() { if (document.visibilityState === 'visible') kiemTra(); }

export function batDemPhien(huyPhien) {
  onLeave = huyPhien || (() => {});
  tatDemPhien();
  dangThoat = false;
  ghiThaoTac();
  SU_KIEN.forEach((s) => document.addEventListener(s, ghiThaoTac, { passive: true, capture: true }));
  document.addEventListener('visibilitychange', khiHienLai);
  hen = setInterval(kiemTra, CHU_KY_MS);
}

export function tatDemPhien() {
  SU_KIEN.forEach((s) => document.removeEventListener(s, ghiThaoTac, { capture: true }));
  document.removeEventListener('visibilitychange', khiHienLai);
  if (hen) { clearInterval(hen); hen = null; }
  try { localStorage.removeItem(KHOA_LAN_CUOI); } catch { /* bỏ qua */ }
}

// Màn đăng nhập: nếu lần tải trước thoát vì hết phiên, hiện câu giải thích một lần.
export function cauLyDoThoat() {
  let ly = null;
  try { ly = sessionStorage.getItem(KHOA_LY_DO_THOAT); sessionStorage.removeItem(KHOA_LY_DO_THOAT); } catch { /* bỏ qua */ }
  return ly === 'het_phien' ? CAU_HET_PHIEN(soPhut()) : '';
}
