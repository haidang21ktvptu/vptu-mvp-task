// Hàng 1 dashboard "Việc cần can thiệp hôm nay" (GĐ15, CN-5.1/5.2, phụ lục 1400 bước 5): bảng ngoại lệ từ v_ngoai_le —
// chỉ Đỏ/Đỏ đặc biệt, đúng 4 trường bắt buộc (Owner, số ngày trễ, sản phẩm còn thiếu, cấp cần quyết định) + mã/hạn/người
// theo dõi/chỉ đạo chờ; việc đang đính chính tách nhóm "đang tra soát". Mỗi dòng: nút "Chỉ đạo" (mở ngăn chi tiết của việc
// trên màn hình Nhiệm vụ) và ô chọn cấp cần quyết định tại chỗ (hàm dat_cap_quyet_dinh 0026). Con số đầu khối bấm ra danh sách.
// A0 (GĐ18, CB-5): mặc định chỉ dòng Đỏ đặc biệt, nút mở rộng sang mọi việc Đỏ; cấp quyết định chỉ đọc; nút "Ý kiến" thay "Chỉ đạo".
import { $, escapeHtml } from '../../../lib/dom.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { danhMucKl } from '../../../lib/kl/du-lieu.js';
import { datCapQuyetDinh } from '../../../lib/kl/dieu-hanh.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { boSoThuTu, chamMuc } from '../../../lib/kl/nhan.js';
import { openKl } from '../../shared/kl/index.js';
import { toggleKlChiTiet } from '../../shared/kl/chi-tiet.js';
import { duocChiDao, laA0 } from '../../shared/kl/chi-dao.js';
import { nutLoc } from './ve-o-so.js';

const SO_COT = 8;
let a0ChiDacBiet = true; // A0: bộ lọc mặc định Đỏ đặc biệt (CB-5)

function capSelectHtml(r) {
  if (!duocChiDao()) return r.cap_quyet_dinh ? escapeHtml(danhMucKl().cap.find((c) => c.ma === r.cap_quyet_dinh)?.ten || r.cap_quyet_dinh) : '<span class="chu-phu">chưa xác định</span>';
  const opt = (v, t, chon) => `<option value="${escapeHtml(v)}"${chon ? ' selected' : ''}>${escapeHtml(t)}</option>`;
  return `<select class="input input-nho nl-cap" data-id="${r.id}" aria-label="Cấp cần quyết định của ${escapeHtml(r.ma)}">
    ${opt('', 'chưa xác định', !r.cap_quyet_dinh)}${danhMucKl().cap.map((c) => opt(c.ma, c.ten, r.cap_quyet_dinh === c.ma)).join('')}</select>`;
}

function dongHtml(r) {
  const cham = chamMuc(r.muc_canh_bao);
  const owner = r.owner_tai_khoan_ten
    ? `${escapeHtml(r.owner_tai_khoan_ten)}<small>${escapeHtml(boSoThuTu(r.owner_don_vi_ten))}</small>`
    : `${escapeHtml(boSoThuTu(r.owner_don_vi_ten) || '(chưa xác định)')}<small>${r.owner_trong_van_phong ? 'Trong Văn phòng' : 'Đơn vị ngoài Văn phòng'}</small>`;
  const sanPham = r.san_pham_loai ? escapeHtml(r.san_pham_ten) : '<span class="chu-canh-bao-inline">chưa định nghĩa</span>';
  return `
    <tr id="nlRow-${r.id}" class="r-do" data-muc="${escapeHtml(r.muc_canh_bao)}" data-nhom="${escapeHtml(r.nhom)}">
      <td class="tieude"><span class="${cham.lop}" title="${escapeHtml(cham.ten)}"></span>${escapeHtml(r.ma)}<small>hạn ${formatNgay(r.han_xu_ly)}${r.so_lan_gia_han ? ` · gia hạn ${r.so_lan_gia_han} lần` : ''}</small></td>
      <td data-nhan="Owner" class="nguoi">${owner}</td>
      <td data-nhan="Trễ" class="so"><b class="nl-tre">${r.so_ngay_qua}</b><small>ngày</small></td>
      <td data-nhan="Sản phẩm còn thiếu">${sanPham}<small class="nl-noi-dung" title="${escapeHtml(r.noi_dung)}">${escapeHtml(r.noi_dung.length > 90 ? `${r.noi_dung.slice(0, 89)}…` : r.noi_dung)}</small></td>
      <td data-nhan="Cấp cần quyết định">${capSelectHtml(r)}</td>
      <td data-nhan="Người theo dõi" class="nguoi">${escapeHtml(r.nguoi_theo_doi_ten || '—')}<small>${escapeHtml(DEPT_NAMES[r.nguoi_theo_doi_phong] || r.nguoi_theo_doi_phong || '')}</small></td>
      <td data-nhan="Chỉ đạo" class="so">${r.so_chi_dao_cho_phan_hoi > 0 ? `<span class="muc muc-vang">${r.so_chi_dao_cho_phan_hoi} chờ phản hồi</span>` : '<span class="chu-phu">·</span>'}</td>
      <td><div class="thao-tac"><button type="button" class="btn btn-phu btn-nho" data-action="moChiTietNgoaiLe" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">Chi tiết</button><button type="button" class="btn btn-chinh btn-nho" data-action="moChiDaoNgoaiLe" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">${laA0() ? 'Ý kiến' : 'Chỉ đạo'}</button></div></td>
    </tr>`;
}

// Con số đầu khối: Đỏ / Đỏ đặc biệt / chưa có cấp quyết định / đang tra soát — mỗi số là nút mở danh sách (truy vết DB-5).
function tomTatHtml(rows) {
  const do_ = rows.filter((r) => r.nhom === 'DO');
  const so = (n, nhan, loc, cls = '') => `<button type="button" class="bd-so ${cls}" ${nutLoc(loc)}>${n}</button> ${nhan}`;
  return `<p class="nl-tom-tat">
    ${so(do_.length, 'việc Đỏ', { nhom: 'QUA_HAN' }, 'bd-do')} ·
    ${so(do_.filter((r) => r.muc_canh_bao === 'DO_DAC_BIET').length, 'Đỏ đặc biệt (≥ 3 ngày)', { nhom: 'QUA_HAN', muc: 'DO_DAC_BIET' }, 'bd-do')} ·
    ${so(do_.filter((r) => !r.cap_quyet_dinh).length, 'chưa có cấp quyết định', { nhom: 'QUA_HAN', chuaCapQuyetDinh: true }, 'bd-vang')} ·
    ${so(rows.length - do_.length, 'đang tra soát (đính chính)', { nhom: 'DANG_DINH_CHINH' })}
  </p>`;
}

export function ngoaiLeHtml(rows) {
  if (rows.length === 0) return '<p class="bd-trong">Hôm nay không có việc quá hạn trong phạm vi của đồng chí.</p>';
  const locA0 = laA0() && a0ChiDacBiet;
  const nhomDo = rows.filter((r) => r.nhom === 'DO' && (!locA0 || r.muc_canh_bao === 'DO_DAC_BIET'));
  const traSoat = locA0 ? [] : rows.filter((r) => r.nhom !== 'DO');
  const nutA0 = laA0() ? `<p class="nl-tom-tat"><button type="button" id="nlLocA0" class="btn btn-phu btn-nho" data-action="doiLocNgoaiLeA0">${a0ChiDacBiet ? 'Xem mọi việc Đỏ' : 'Chỉ Đỏ đặc biệt'}</button></p>` : '';
  return `${tomTatHtml(rows)}${nutA0}
    <div class="bang-cuon"><table class="nl-bang">
      <thead><tr><th>Mã · Hạn</th><th>Owner (chịu trách nhiệm)</th><th class="so">Trễ</th><th>Sản phẩm còn thiếu</th><th>Cấp cần quyết định</th><th>Người theo dõi</th><th class="so">Chỉ đạo</th><th class="phai">Thao tác</th></tr></thead>
      <tbody id="klDbNgoaiLeBody">
        ${nhomDo.map(dongHtml).join('')}
        ${traSoat.length ? `<tr class="nl-nhom"><td colspan="${SO_COT}">Đang tra soát — có đề nghị đính chính chờ duyệt (${traSoat.length})</td></tr>${traSoat.map(dongHtml).join('')}` : ''}
      </tbody>
    </table></div>`;
}

// Hai nút (15E): "Chi tiết" mở ngăn với bảng thông tin mở sẵn; "Chỉ đạo" mở ngăn (bảng gập), con trỏ vào thẳng ô nhập.
// Cả hai sang màn hình Nhiệm vụ lọc đúng mã.
export async function moNgoaiLe(id, ma, cheDo) {
  await openKl({ tuTongQuan: true, tuKhoa: ma });
  await toggleKlChiTiet({ id, cheDo });
  if (cheDo === 'chi-tiet') document.getElementById(`klRow-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
const moChiTietNgoaiLe = ({ id, ma }) => moNgoaiLe(id, ma, 'chi-tiet');
const moChiDaoNgoaiLe = ({ id, ma }) => moNgoaiLe(id, ma, 'chi-dao');
function doiLocNgoaiLeA0() { a0ChiDacBiet = !a0ChiDacBiet; napLai(); }

// Chọn cấp tại chỗ (uỷ quyền một lần cho khối hàng 1): ghi qua hàm, lịch sử do trigger; nạp lại dashboard ngay (không chờ realtime).
let napLai = () => {};
async function onDoiCap(e) {
  const sel = e.target;
  if (!(sel instanceof HTMLSelectElement) || !sel.classList.contains('nl-cap')) return;
  sel.disabled = true;
  try {
    await datCapQuyetDinh(sel.dataset.id, sel.value);
    notifySuccess(sel.value ? 'Đã xác định cấp cần quyết định.' : 'Đã bỏ cấp cần quyết định.');
    napLai();
  } catch (err) {
    notifyError(err.message);
    sel.disabled = false;
  }
}

export function mountNgoaiLe(registerActions, napLaiDashboard) {
  napLai = napLaiDashboard;
  $('klDbNgoaiLe').addEventListener('change', onDoiCap);
  registerActions({ moChiTietNgoaiLe, moChiDaoNgoaiLe, doiLocNgoaiLeA0 });
}
