// Khối "Chỉ đạo" trong ngăn chi tiết của MỌI nhiệm vụ (GĐ15, thiết kế luồng bình luận theo thời gian): dòng chỉ đạo gốc
// (loại, người, lúc, nội dung, hạn mới nếu gia hạn, người theo dõi mới nếu giao lại) → các phản hồi thụt vào → ô phản hồi /
// nút Đóng; cuối khối là ô nhập nhanh có chọn loại cho A1/A2. Nút chỉ ẩn/hiện cho đẹp — quyền thật trong hàm 0026/0030/0032.
// A0 (GĐ18/19): một ô nhập với hai lựa chọn "Ý kiến" (Y_KIEN) / "Chỉ đạo" (CHI_DAO_TT, CH-16: người nhận tự tính, hạn phản
// hồi mặc định 2 ngày làm việc, sửa được); A0 đóng được luồng CHI_DAO_TT của mình. Người nhận luồng TT (A1) phản hồi hoặc
// chuyển thành chỉ đạo con (ô "Chuyển thành chỉ đạo" gửi kèm tra_loi_cho). Chỉ đạo con là gốc riêng, có ghi "theo chỉ đạo TT".
// Cập nhật realtime: chi_dao trong kênh kl_feed → loadKl() vẽ lại và mở lại ngăn chi tiết đang mở (danh-sach.js).
import { $, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { state, findAccount } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { loadChiDao, chiDaoGui, chiDaoPhanHoi, chiDaoDong, chiDaoDanhDauDoc, TEN_LOAI_CHI_DAO, TEN_TRANG_THAI_CHI_DAO } from '../../../lib/kl/dieu-hanh.js';

// Tên lớp nguyên văn (Tailwind cắt lớp ghép chuỗi khỏi bản build).
const LOP_LOAI = { DON_DOC: 'cd-loai cd-loai-DON_DOC', GIA_HAN: 'cd-loai cd-loai-GIA_HAN', GIAO_LAI: 'cd-loai cd-loai-GIAO_LAI',
  YEU_CAU_MINH_CHUNG: 'cd-loai cd-loai-YEU_CAU_MINH_CHUNG', KIEM_TRA_SO_LIEU: 'cd-loai cd-loai-KIEM_TRA_SO_LIEU', Y_KIEN: 'cd-loai cd-loai-Y_KIEN',
  CHI_DAO_TT: 'cd-loai cd-loai-CHI_DAO_TT' };
const LOP_TRANG_THAI = { CHO_PHAN_HOI: 'muc muc-vang', DA_PHAN_HOI: 'muc muc-xanh', DA_DONG: 'muc' };
const LOAI_GUI = ['DON_DOC', 'GIA_HAN', 'GIAO_LAI', 'YEU_CAU_MINH_CHUNG', 'KIEM_TRA_SO_LIEU', 'Y_KIEN'];
const LOAI_CON = ['DON_DOC', 'GIA_HAN', 'GIAO_LAI', 'YEU_CAU_MINH_CHUNG', 'KIEM_TRA_SO_LIEU'];
const TEN_A0 = { Y_KIEN: 'Ý kiến', CHI_DAO_TT: 'Chỉ đạo' };

export const duocChiDao = () => ['A1', 'A2'].includes(state.user?.role_group);
export const laA0 = () => state.user?.role_group === 'A0';
const tenNguoi = (id) => findAccount(id)?.full_name || 'Cán bộ';
const laNguoiNhan = (g) => Boolean(state.user?.id) && (g.nguoi_nhan || []).includes(state.user.id);

function phanHoiHtml(p, daDoc) {
  return `<div class="cd-ph ${daDoc.has(p.id) ? '' : 'cd-chua-doc'}" id="cd-${p.id}">
    <b>${escapeHtml(tenNguoi(p.nguoi_gui))}</b> <span class="chu-phu">${formatDateTime(p.created_at)}</span>
    <p>${escapeHtml(p.noi_dung)}</p></div>`;
}

// Ai được phản hồi luồng g (ẩn/hiện): luồng TT chỉ người nhận; luồng thường: Owner, người theo dõi, người đã tham gia.
const trongLuong = (g, phanHoi, r) => {
  const me = state.user?.id;
  if (g.loai === 'CHI_DAO_TT') return laNguoiNhan(g);
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
    g.loai === 'CHI_DAO_TT' ? `Người nhận: ${(g.nguoi_nhan || []).map((u) => escapeHtml(tenNguoi(u))).join(', ')}` : '',
    g.han_phan_hoi ? `Hạn phản hồi: ${formatNgay(g.han_phan_hoi)}` : '',
    g.loai !== 'CHI_DAO_TT' && g.tra_loi_cho ? 'Theo chỉ đạo Thường trực' : '',
  ].filter(Boolean).join(' · ');
  const mo = g.trang_thai !== 'DA_DONG';
  const dongDuoc = mo && g.nguoi_gui === me && (g.loai === 'CHI_DAO_TT' ? laA0() : !laA0());
  const nut = dongDuoc ? `<button type="button" class="btn btn-phu btn-nho" data-action="dongChiDao" data-id="${g.id}" data-nv="${r.id}">Đóng</button>` : '';
  const formPh = mo && !laA0() && trongLuong(g, phanHoi, r) && g.id !== gocDau ? formPhHtml(g, r) : '';
  const formCon = mo && g.loai === 'CHI_DAO_TT' && duocChiDao() && laNguoiNhan(g) ? formGuiHtml(r, LOAI_CON, g.id) : '';
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
      ${g.loai === 'CHI_DAO_TT' && g.phan_hoi && g.phan_hoi.startsWith('Chuyển thành') ? `<p class="chu-phu cd-phu">${escapeHtml(g.phan_hoi)} (${escapeHtml(tenNguoi(g.phan_hoi_boi))})</p>` : ''}
      <div class="cd-cac-ph">${phanHoi.map((p) => phanHoiHtml(p, daDoc)).join('')}</div>
      ${formPh}${formCon}
    </div>`;
}

// traLoiCho: ô "Chuyển thành chỉ đạo" của người nhận luồng TT (chỉ đạo con gắn với luồng đó).
function formGuiHtml(r, loai = LOAI_GUI, traLoiCho = '') {
  const ds = (state.accounts || []).filter((a) => !a.is_system && a.id !== r.nguoi_theo_doi);
  const a0 = laA0();
  const ten = (l) => (a0 ? TEN_A0[l] : TEN_LOAI_CHI_DAO[l]) || TEN_LOAI_CHI_DAO[l];
  const nhan = traLoiCho ? 'Chuyển thành chỉ đạo' : a0 ? 'Gửi' : 'Gửi chỉ đạo';
  return `
    <form class="cd-form ${traLoiCho ? 'cd-form-con' : ''}" data-submit="guiChiDao" data-nv="${r.id}" data-tra-loi-cho="${traLoiCho}">
      <div class="cd-form-hang">
        <select name="loai" class="input input-nho" aria-label="Loại chỉ đạo">
          ${loai.map((l) => `<option value="${l}">${ten(l)}</option>`).join('')}
        </select>
        <input type="date" name="han_moi" class="input input-nho hidden" aria-label="Hạn mới" min="${r.han_xu_ly || ''}">
        <input type="date" name="han_phan_hoi" class="input input-nho hidden" aria-label="Hạn phản hồi (mặc định 2 ngày làm việc)" title="Hạn phản hồi — để trống = 2 ngày làm việc">
        <select name="nguoi_theo_doi_moi" class="input input-nho hidden" aria-label="Người theo dõi mới">
          <option value="">— Chọn người theo dõi mới —</option>
          ${ds.map((a) => `<option value="${a.id}">${escapeHtml(a.full_name)} · ${escapeHtml(DEPT_NAMES[a.department] || a.department || '')}</option>`).join('')}
        </select>
      </div>
      <div class="cd-form-hang">
        <input type="text" name="noi_dung" required class="input input-nho" placeholder="${traLoiCho ? 'Nội dung chỉ đạo điều hành theo chỉ đạo Thường trực' : a0 ? 'Nội dung ý kiến / chỉ đạo Thường trực' : 'Nội dung chỉ đạo (lý do nếu gia hạn/giao lại)'}" aria-label="Nội dung chỉ đạo">
        <button type="submit" class="btn btn-chinh btn-nho">${nhan}</button>
      </div>
    </form>`;
}

// Bố cục (15C): ô nhập ở ĐẦU khối — A1/A2: ô gửi chỉ đạo; A0: ô ý kiến/chỉ đạo TT; vai khác: ô phản hồi chỉ đạo mở mới nhất.
// Gốc = mọi dòng không phải PHAN_HOI (chỉ đạo con vẫn là gốc riêng); phản hồi = PHAN_HOI có tra_loi_cho = gốc.
export function chiDaoHtml(r, { rows, daDoc }) {
  const goc = rows.filter((c) => c.loai !== 'PHAN_HOI');
  const phanHoiCua = (g) => rows.filter((c) => c.loai === 'PHAN_HOI' && c.tra_loi_cho === g.id);
  const cho = goc.filter((g) => g.trang_thai === 'CHO_PHAN_HOI').length;
  const chuaDoc = rows.filter((c) => !daDoc.has(c.id)).length;
  const moMoiNhat = duocChiDao() || laA0() ? null : [...goc].reverse().find((g) => g.trang_thai !== 'DA_DONG' && trongLuong(g, phanHoiCua(g), r));
  const oNhap = duocChiDao() ? formGuiHtml(r) : laA0() ? formGuiHtml(r, ['Y_KIEN', 'CHI_DAO_TT']) : moMoiNhat ? formPhHtml(moMoiNhat, r, 'cd-form-dau') : '';
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
  if (p.loai === 'CHI_DAO_TT') p.han_phan_hoi = f.get('han_phan_hoi') || '';
  if (ds.traLoiCho) p.tra_loi_cho = ds.traLoiCho;
  try {
    await chiDaoGui(p);
    notifySuccess(p.loai === 'CHI_DAO_TT' ? 'Đã gửi chỉ đạo Thường trực. Chánh Văn phòng và PCVP phụ trách nhận thông báo trên hệ thống.'
      : `Đã gửi ${TEN_LOAI_CHI_DAO[p.loai].toLowerCase()}. Người liên quan nhận thông báo trên hệ thống.`);
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
// Chọn loại → hiện ô hạn mới (GIA_HAN) / người theo dõi mới (GIAO_LAI) / hạn phản hồi (CHI_DAO_TT). Uỷ quyền một lần cho cả trang.
function onDoiLoai(e) {
  const sel = e.target;
  if (!(sel instanceof HTMLSelectElement) || sel.name !== 'loai' || !sel.closest('.cd-form')) return;
  const form = sel.closest('.cd-form');
  form.querySelector('[name=han_moi]').classList.toggle('hidden', sel.value !== 'GIA_HAN');
  form.querySelector('[name=nguoi_theo_doi_moi]').classList.toggle('hidden', sel.value !== 'GIAO_LAI');
  form.querySelector('[name=han_phan_hoi]').classList.toggle('hidden', sel.value !== 'CHI_DAO_TT');
}
export function mountChiDao(registerActions, napLaiDanhSach) {
  sauHanhDong = napLaiDanhSach;
  document.body.addEventListener('change', onDoiLoai);
  registerActions({ guiChiDao, guiPhanHoi, dongChiDao });
}
