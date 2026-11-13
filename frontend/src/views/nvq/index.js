// Phân hệ Nhiệm vụ quý của Ban Thường vụ (v3.35 — chủ dự án 13/11/2026; Kế hoạch 193-KH/TU, Phụ lục 2 kèm CV 888-CV/TU): tách riêng hoàn toàn khỏi nhiệm vụ
// theo kết luận / văn bản giao việc — bảng nvq_*, một section viewNvq, nhóm menu "Nhiệm vụ quý BTV", ngăn chi tiết riêng (#nqNgan), mã NQ-<số> trên đường
// dẫn. Năm màn: Tổng quan quý (lãnh đạo nắm ngay), Danh mục, Cập nhật tuần (chủ trì theo dõi — người cập nhật chính), Báo cáo (Word / Excel, chốt tuần),
// Quản lý danh mục quý (đầu mối). Ở đây: mở màn, nạp dữ liệu quý, gom hành động của các màn, uỷ quyền sự kiện change / input / Enter, thời gian thực.
import { $, show } from '../../lib/dom.js';
import { registerActions } from '../../lib/actions.js';
import { onSessionLeave } from '../../auth/session.js';
import { setActiveNav, showSection, sectionDangHien } from '../shell/index.js';
import { nq, napTatCa } from '../../lib/nvq/du-lieu.js';
import { batNvqRealtime, tatNvqRealtime } from '../../lib/nvq/thoi-gian-thuc.js';
import { e } from './khung.js';
import { veTongQuan } from './tong-quan.js';
import { veDanhMuc, doiLoc, dm, xuatExcel, inDanhMuc } from './danh-muc.js';
import { veCapNhatTuan, hanhDongTuan } from './cap-nhat-tuan.js';
import { veBaoCao, hanhDongBaoCao } from './bao-cao.js';
import { veQuanLy, hanhDongQuanLy } from './quan-ly.js';
import { hanhDongNhap, khiChonTepNhap, khiDoiXemTruoc } from './quan-ly-nhap.js';
import { hanhDongPhanCong, khiDoiPhanCong } from './quan-ly-phan-cong.js';
import { hanhDongCuoiQuy } from './quan-ly-cuoi-quy.js';
import { ct, mountNgan, moNhiemVuQuy, dongNgan, dangMo, napLaiNgan } from './chi-tiet.js';
import { HANH_DONG_NGAN, datNapLai, khiChonTep } from './chi-tiet-hanh-dong.js';
import { HANH_DONG_SUA, datNapLaiSua } from './sua-nhiem-vu.js';

const MAN = {
  'tong-quan': { nav: 'navNqTongQuan', ve: veTongQuan, chiXem: true },
  'danh-muc': { nav: 'navNqDanhMuc', ve: veDanhMuc, chiXem: true },
  'cap-nhat': { nav: 'navNqCapNhat', ve: veCapNhatTuan },
  'bao-cao': { nav: 'navNqBaoCao', ve: veBaoCao },
  'quan-ly': { nav: 'navNqQuanLy', ve: veQuanLy },
};
let man = 'tong-quan'; let luot = 0;
const el = () => $('viewNvq');
const veLai = (ds = {}) => MAN[man].ve(el(), { giu: true, ...ds });

async function mo(ten, ds = {}) {
  man = MAN[ten] ? ten : 'tong-quan';
  if (dangMo()) dongNgan({ doiMan: true });
  showSection('viewNvq'); setActiveNav(MAN[man].nav);
  if (!nq.daNap) el().innerHTML = '<p class="chu-phu nq-dang-tai">Đang tải nhiệm vụ quý…</p>';
  const l = ++luot;
  try {
    await napTatCa();
    if (l !== luot) return;
    await MAN[man].ve(el(), ds);
  } catch (err) { if (l === luot) el().innerHTML = `<p class="nq-chu-do">Không tải được dữ liệu nhiệm vụ quý: ${e(err.message)}</p>`; }
  batNvqRealtime(khiCoMoi);
}
// Sau mỗi lần ghi: nạp lại quý (và danh mục khi đổi đầu mối / danh mục), vẽ lại màn đang xem (ngăn chi tiết tự nạp lại — chi-tiet-hanh-dong.js).
let tuGhiLuc = 0;   // lúc vừa nạp lại sau thao tác ghi của chính mình — tín hiệu thời gian thực ngay sau đó chủ yếu là của mình: không hiện "Có cập nhật mới"
async function napLaiSauGhi(op = {}) {
  await napTatCa(op);
  if (!op.khongGhi) tuGhiLuc = Date.now();
  if (sectionDangHien('viewNvq')) await veLai();
}
// Sự kiện thời gian thực: màn chỉ xem (Tổng quan, Danh mục) không đang gõ → nạp lại ngay; màn có biểu mẫu → dải "Có cập nhật mới"; ngăn chi tiết đang
// xem đúng nhiệm vụ đó và không mở biểu mẫu → nạp lại ngăn.
let henRt = null;
function khiCoMoi(ids) {
  clearTimeout(henRt);
  henRt = setTimeout(async () => {
    if (dangMo() && (!ids.length || ids.includes(ct.id)) && !$('nqNganThan')?.querySelector('form')) napLaiNgan();
    if (!sectionDangHien('viewNvq')) return;   // mở lại màn nào của phân hệ cũng nạp lại quý
    const dangGo = el().contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (MAN[man].chiXem && !dangGo) { try { await napTatCa(); await veLai(); } catch { show('nqCoMoi', true); } }
    else if (!ids.length || Date.now() - tuGhiLuc > 4000) show('nqCoMoi', true);   // trong 4 giây sau khi mình ghi: tín hiệu của chính mình
  }, 300);
}

// Ô gõ tìm của thẻ Phân công: chờ 250 ms rồi vẽ lại, giữ tiêu điểm và con trỏ.
let henPc = null;
function veLaiGiuO(chon) {
  clearTimeout(henPc);
  henPc = setTimeout(async () => {
    const vt = document.activeElement?.selectionStart;
    await veLai();
    if (!chon) return;
    const o = el().querySelector(chon);
    if (o) { o.focus(); try { if (vt !== undefined && vt !== null) o.setSelectionRange(vt, vt); } catch { /* ô không hỗ trợ */ } }
  }, 250);
}
function khiDoi(ev) {
  const t = ev.target; const d = t.dataset || {};
  if (ev.type === 'input' && !(t.type === 'search' || t.type === 'text')) return;
  if (d.nqChonKy !== undefined && ev.type === 'change') { nq.kyChon = t.value; napLaiSauGhi({ khongGhi: true }); return; }
  if (d.nqLoc) { if (ev.type === 'change' && d.nqLoc === 'q') return; doiLoc(d.nqLoc, t.type === 'checkbox' ? t.checked : t.value, veLai); return; }
  if (d.nqPcLoc) { if (ev.type === 'change' && d.nqPcLoc === 'q') return; if (khiDoiPhanCong(t)) veLaiGiuO(d.nqPcLoc === 'q' ? '[data-nq-pc-loc="q"]' : ''); return; }
  if (ev.type !== 'change') return;
  if (d.nqChonTuan !== undefined) { hanhDongBaoCao(veLai, napLaiSauGhi).chonTuan(t.value); return; }
  if (d.nqTep !== undefined) { khiChonTep(t); return; }
  if (d.nqTepNhap !== undefined) { khiChonTepNhap(t).then((ok) => { if (ok) veLai(); }); return; }
  if (d.nqBiDanh !== undefined || d.nqCtNhap !== undefined || d.nqBoNhap !== undefined) { if (khiDoiXemTruoc(t)) veLai(); return; }
  if (d.nqChon !== undefined || d.nqChonHet !== undefined) { if (khiDoiPhanCong(t)) veLai(); }
}

export function registerNvq() {
  mountNgan();
  datNapLai(napLaiSauGhi); datNapLaiSua(napLaiSauGhi);
  const baoCao = hanhDongBaoCao(veLai, napLaiSauGhi);
  delete baoCao.chonTuan;   // gọi từ ô chọn tuần (khiDoi), không phải nút
  registerActions({
    openNqTongQuan: () => mo('tong-quan'),
    openNqDanhMuc: (ds) => mo('danh-muc', ds?.loc ? { loc: ds.loc } : {}),
    openNqCapNhat: () => mo('cap-nhat'),
    openNqBaoCao: () => mo('bao-cao'),
    openNqQuanLy: (ds) => mo('quan-ly', ds?.the ? { the: ds.the } : {}),
    nqMo: ({ id }) => moNhiemVuQuy(id),
    nqDong: () => dongNgan({ nguoiDung: true }),
    nqNapLai: () => { show('nqCoMoi', false); return napLaiSauGhi({ khongGhi: true }); },
    nqLocDanhMuc: ({ loc }) => mo('danh-muc', { loc }),
    nqLocTrangThai: ({ loc }) => doiLoc('trangThai', loc || '', veLai),
    nqBoLoc: () => { dm.loc = {}; return veLai(); },
    nqXuatExcel: () => xuatExcel(),
    nqIn: () => inDanhMuc(),
    ...HANH_DONG_NGAN, ...HANH_DONG_SUA,
    ...hanhDongTuan(veLai, napLaiSauGhi), ...baoCao,
    ...hanhDongQuanLy(veLai, napLaiSauGhi), ...hanhDongNhap(veLai, napLaiSauGhi), ...hanhDongPhanCong(veLai, napLaiSauGhi), ...hanhDongCuoiQuy(veLai, napLaiSauGhi),
  });
  ['change', 'input'].forEach((loai) => { el().addEventListener(loai, khiDoi); });
  document.addEventListener('change', (ev) => { if (ev.target?.dataset?.nqTep !== undefined && $('nqNgan')?.contains(ev.target)) khiChonTep(ev.target); });
  el().addEventListener('keydown', (ev) => {   // dòng bảng bấm mở được bằng bàn phím (tabindex 0)
    const tr = ev.target.closest?.('tr[data-action="nqMo"]');
    if (tr && ev.target === tr && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); moNhiemVuQuy(tr.dataset.id); }
  });
  onSessionLeave(() => { tatNvqRealtime(); if (dangMo()) dongNgan({ doiMan: true }); Object.assign(nq, { daNap: false, rows: [], sp: [], kys: [], ky: null }); });
}
