// Khối "Chỉ đạo" trong ngăn chi tiết của MỌI nhiệm vụ (GĐ15, thiết kế luồng bình luận theo thời gian): dòng chỉ đạo gốc
// (loại, người, lúc, nội dung, hạn mới nếu gia hạn, người theo dõi mới nếu giao lại) → các phản hồi thụt vào → ô phản hồi /
// nút Đóng; cuối khối là ô nhập nhanh có chọn loại cho A1/A2. Nút chỉ ẩn/hiện cho đẹp — quyền thật trong hàm 0026.
// Cập nhật realtime: chi_dao trong kênh kl_feed → loadKl() vẽ lại và mở lại ngăn chi tiết đang mở (danh-sach.js).
import { $, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { state, findAccount } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { loadChiDao, chiDaoGui, chiDaoPhanHoi, chiDaoDong, chiDaoDanhDauDoc, TEN_LOAI_CHI_DAO, TEN_TRANG_THAI_CHI_DAO } from '../../../lib/kl/dieu-hanh.js';

// Tên lớp nguyên văn (Tailwind cắt lớp ghép chuỗi khỏi bản build).
const LOP_LOAI = { DON_DOC: 'cd-loai cd-loai-DON_DOC', GIA_HAN: 'cd-loai cd-loai-GIA_HAN', GIAO_LAI: 'cd-loai cd-loai-GIAO_LAI',
  YEU_CAU_MINH_CHUNG: 'cd-loai cd-loai-YEU_CAU_MINH_CHUNG', KIEM_TRA_SO_LIEU: 'cd-loai cd-loai-KIEM_TRA_SO_LIEU', Y_KIEN: 'cd-loai cd-loai-Y_KIEN' };
const LOP_TRANG_THAI = { CHO_PHAN_HOI: 'muc muc-vang', DA_PHAN_HOI: 'muc muc-xanh', DA_DONG: 'muc' };
const LOAI_GUI = ['DON_DOC', 'GIA_HAN', 'GIAO_LAI', 'YEU_CAU_MINH_CHUNG', 'KIEM_TRA_SO_LIEU', 'Y_KIEN'];

export const duocChiDao = () => ['A1', 'A2'].includes(state.user?.role_group);
const tenNguoi = (id) => findAccount(id)?.full_name || 'Cán bộ';

function phanHoiHtml(p, daDoc) {
  return `<div class="cd-ph ${daDoc.has(p.id) ? '' : 'cd-chua-doc'}" id="cd-${p.id}">
    <b>${escapeHtml(tenNguoi(p.nguoi_gui))}</b> <span class="chu-phu">${formatDateTime(p.created_at)}</span>
    <p>${escapeHtml(p.noi_dung)}</p></div>`;
}

const trongLuong = (g, phanHoi, r) => {
  const me = state.user?.id;
  return me === r.nguoi_theo_doi || me === r.owner_tai_khoan || g.nguoi_gui === me || phanHoi.some((p) => p.nguoi_gui === me);
};
const formPhHtml = (g, r, them = '') => `
    <form class="cd-form-ph ${them}" data-submit="guiPhanHoi" data-id="${g.id}" data-nv="${r.id}">
      <input type="text" name="noi_dung" required class="input input-nho" placeholder="Phản hồi…" aria-label="Nội dung phản hồi">
      <button type="submit" class="btn btn-cham btn-nho">Phản hồi</button>
    </form>`;

// gocDau: chỉ đạo mở mới nhất — với vai không ra chỉ đạo, ô phản hồi của nó đặt ở ĐẦU khối (cùng vị trí ô gửi của A1/A2).
function gocHtml(g, phanHoi, daDoc, r, gocDau) {
  const me = state.user?.id;
  const phu = [
    g.loai === 'GIA_HAN' && g.han_moi ? `Hạn mới: ${formatNgay(g.han_moi)}` : '',
    g.loai === 'GIAO_LAI' && g.chu_tri_moi ? `Người theo dõi mới: ${escapeHtml(tenNguoi(g.chu_tri_moi))}` : '',
    g.han_phan_hoi ? `Hạn phản hồi: ${formatNgay(g.han_phan_hoi)}` : '',
  ].filter(Boolean).join(' · ');
  const mo = g.trang_thai !== 'DA_DONG';
  const nut = [
    mo && g.nguoi_gui === me ? `<button type="button" class="btn btn-phu btn-nho" data-action="dongChiDao" data-id="${g.id}" data-nv="${r.id}">Đóng</button>` : '',
  ].join('');
  const formPh = mo && trongLuong(g, phanHoi, r) && g.id !== gocDau ? formPhHtml(g, r) : '';
  return `
    <div class="cd-goc ${daDoc.has(g.id) ? '' : 'cd-chua-doc'}" id="cd-${g.id}" data-loai="${g.loai}" data-trang-thai="${g.trang_thai}">
      <div class="cd-dau">
        <span class="${LOP_LOAI[g.loai] || 'cd-loai'}">${TEN_LOAI_CHI_DAO[g.loai] || g.loai}</span>
        <b>${escapeHtml(tenNguoi(g.nguoi_gui))}</b> <span class="chu-phu">${formatDateTime(g.created_at)}</span>
        ${g.loai === 'Y_KIEN' ? '' : `<span class="${LOP_TRANG_THAI[g.trang_thai] || 'muc'}">${TEN_TRANG_THAI_CHI_DAO[g.trang_thai] || g.trang_thai}</span>`}
        <span class="cd-nut">${nut}</span>
      </div>
      <p class="cd-noi-dung">${escapeHtml(g.noi_dung)}</p>
      ${phu ? `<p class="chu-phu cd-phu">${phu}</p>` : ''}
      <div class="cd-cac-ph">${phanHoi.map((p) => phanHoiHtml(p, daDoc)).join('')}</div>
      ${formPh}
    </div>`;
}

function formGuiHtml(r) {
  const ds = (state.accounts || []).filter((a) => !a.is_system && a.id !== r.nguoi_theo_doi);
  return `
    <form class="cd-form" data-submit="guiChiDao" data-nv="${r.id}">
      <div class="cd-form-hang">
        <select name="loai" class="input input-nho" aria-label="Loại chỉ đạo">
          ${LOAI_GUI.map((l) => `<option value="${l}">${TEN_LOAI_CHI_DAO[l]}</option>`).join('')}
        </select>
        <input type="date" name="han_moi" class="input input-nho hidden" aria-label="Hạn mới" min="${r.han_xu_ly || ''}">
        <select name="nguoi_theo_doi_moi" class="input input-nho hidden" aria-label="Người theo dõi mới">
          <option value="">— Chọn người theo dõi mới —</option>
          ${ds.map((a) => `<option value="${a.id}">${escapeHtml(a.full_name)} · ${escapeHtml(DEPT_NAMES[a.department] || a.department || '')}</option>`).join('')}
        </select>
      </div>
      <div class="cd-form-hang">
        <input type="text" name="noi_dung" required class="input input-nho" placeholder="Nội dung chỉ đạo (lý do nếu gia hạn/giao lại)" aria-label="Nội dung chỉ đạo">
        <button type="submit" class="btn btn-chinh btn-nho">Gửi chỉ đạo</button>
      </div>
    </form>`;
}

// Bố cục (15C): ô nhập ở ĐẦU khối — A1/A2: ô gửi chỉ đạo; vai khác: ô phản hồi chỉ đạo mở mới nhất — rồi luồng theo thời gian.
export function chiDaoHtml(r, { rows, daDoc }) {
  const goc = rows.filter((c) => !c.tra_loi_cho);
  const phanHoiCua = (g) => rows.filter((c) => c.tra_loi_cho === g.id);
  const cho = goc.filter((g) => g.trang_thai === 'CHO_PHAN_HOI').length;
  const chuaDoc = rows.filter((c) => !daDoc.has(c.id)).length;
  const moMoiNhat = duocChiDao() ? null : [...goc].reverse().find((g) => g.trang_thai !== 'DA_DONG' && trongLuong(g, phanHoiCua(g), r));
  const oNhap = duocChiDao() ? formGuiHtml(r) : moMoiNhat ? formPhHtml(moMoiNhat, r, 'cd-form-dau') : '';
  return `
    <div class="luong-cd" id="klChiDao-${r.id}">
      <h4>Chỉ đạo <span class="chu-phu">${goc.length === 0 ? 'chưa có' : `${goc.length} · ${cho} chờ phản hồi`}${chuaDoc ? ` · <span class="chu-canh-bao-inline">${chuaDoc} chưa đọc</span>` : ''}</span></h4>
      ${oNhap}
      ${goc.map((g) => gocHtml(g, phanHoiCua(g), daDoc, r, moMoiNhat?.id)).join('')}
    </div>`;
}

// Đưa con trỏ vào ô nhập đầu khối (Dashboard bấm "Chỉ đạo", chuông bấm tin).
export function focusChiDao(nhiemVuId) {
  const o = $(`klChiDao-${nhiemVuId}`)?.querySelector('input[name=noi_dung]');
  if (o) { o.scrollIntoView({ block: 'center', behavior: 'smooth' }); o.focus({ preventScroll: true }); }
}

// Nạp và vẽ khối chỉ đạo vào ngăn chi tiết đang mở; ghi "đã đọc" sau khi hiện (không chờ, không chặn).
export async function napChiDao(r) {
  const o = $(`klChiDao-${r.id}`);
  if (!o) return;
  try {
    const d = await loadChiDao(r.id);
    o.outerHTML = chiDaoHtml(r, d);
    if (d.rows.some((c) => !d.daDoc.has(c.id))) chiDaoDanhDauDoc(r.id);
  } catch (e) {
    notifyError('Không đọc được chỉ đạo: ' + e.message);
  }
}

// Sau mỗi hành động: màn hình danh sách nạp lại (ô số, hạn, so_chi_dao_cho_phan_hoi) và mở lại ngăn chi tiết đang mở.
let sauHanhDong = () => {};

async function guiChiDao(ds, form) {
  const f = new FormData(form);
  const p = { nhiem_vu_id: ds.nv, loai: f.get('loai'), noi_dung: (f.get('noi_dung') || '').trim() };
  if (p.loai === 'GIA_HAN') p.han_moi = f.get('han_moi') || '';
  if (p.loai === 'GIAO_LAI') p.nguoi_theo_doi_moi = f.get('nguoi_theo_doi_moi') || '';
  try {
    await chiDaoGui(p);
    notifySuccess(`Đã gửi ${TEN_LOAI_CHI_DAO[p.loai].toLowerCase()}. Người liên quan nhận thông báo trên hệ thống.`);
    sauHanhDong();
  } catch (e) {
    notifyError(e.message);
  }
}

async function guiPhanHoi(ds, form) {
  const noiDung = (new FormData(form).get('noi_dung') || '').trim();
  try {
    await chiDaoPhanHoi({ chi_dao_id: ds.id, noi_dung: noiDung });
    notifySuccess('Đã gửi phản hồi.');
    sauHanhDong();
  } catch (e) {
    notifyError(e.message);
  }
}

async function dongChiDao(ds) {
  try {
    await chiDaoDong(ds.id);
    notifySuccess('Đã đóng chỉ đạo.');
    sauHanhDong();
  } catch (e) {
    notifyError(e.message);
  }
}

// Chọn loại → hiện ô hạn mới (GIA_HAN) / người theo dõi mới (GIAO_LAI). Uỷ quyền một lần cho cả trang.
function onDoiLoai(e) {
  const sel = e.target;
  if (!(sel instanceof HTMLSelectElement) || sel.name !== 'loai' || !sel.closest('.cd-form')) return;
  const form = sel.closest('.cd-form');
  form.querySelector('[name=han_moi]').classList.toggle('hidden', sel.value !== 'GIA_HAN');
  form.querySelector('[name=nguoi_theo_doi_moi]').classList.toggle('hidden', sel.value !== 'GIAO_LAI');
}

export function mountChiDao(registerActions, napLaiDanhSach) {
  sauHanhDong = napLaiDanhSach;
  document.body.addEventListener('change', onDoiLoai);
  registerActions({ guiChiDao, guiPhanHoi, dongChiDao });
}
