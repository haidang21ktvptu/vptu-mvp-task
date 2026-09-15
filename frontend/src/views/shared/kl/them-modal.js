// Modal thêm nhiệm vụ KL mới (GĐ10 PR 10F, thiết kế 6.8 ngăn lỗi ngay trên form; DB là chốt qua CHECK/trigger/policy).
// Nút "Thêm nhiệm vụ" chỉ hiện với quan_tri_kl. "Lưu, nhập tiếp" giữ hội nghị/ngành/cơ quan trình cho kết luận có nhiều việc.
import { $, show, setText, escapeHtml } from '../../../lib/dom.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { danhMucKl, linhVucCuaNganh, cauHinhKl, homNayTheoDb, loadHoiNghi, themHoiNghi, themNhiemVu } from '../../../lib/kl/du-lieu.js';
import { homNayVN, formatNgay, ghiChuHan, congNgay } from '../../../lib/kl/ngay.js';
import { klThemTemplate } from './them-template.js';

let afterSave = () => {};
let hoiNghi = [];
let homNay = homNayVN();
const MOI = '__moi__';
const opt = (v, t, chon = false) => `<option value="${escapeHtml(v)}"${chon ? ' selected' : ''}>${escapeHtml(t)}</option>`;

const hoiNghiChon = () => hoiNghi.find((h) => h.id === $('klThHoiNghi').value);
const ngayBH = () => ($('klThHoiNghi').value === MOI ? $('klThNgayBH').value : hoiNghiChon()?.ngay_ban_hanh) || '';

function capNhatHienThi() {
  const loai = $('klThLoai').value;
  const bh = ngayBH();
  show('klThHoiNghiMoi', $('klThHoiNghi').value === MOI);
  show('klThChuaCoHanWrap', loai === 'CO_HAN_CU_THE');
  show('klThLyDoWrap', loai === 'CO_HAN_CU_THE' && $('klThChuaCoHan').checked);
  $('klThHan').min = bh;
  if (loai === 'KY_BAN_HANH') {
    $('klThHan').value = bh ? congNgay(bh, cauHinhKl('ky_ban_hanh_ngay', 10)) : '';
    $('klThHan').disabled = true;
    setText('klThHanLoai', `(tự tính = ngày ban hành + ${cauHinhKl('ky_ban_hanh_ngay', 10)})`);
  } else {
    $('klThHan').disabled = loai === 'CO_HAN_CU_THE' && $('klThChuaCoHan').checked;
    setText('klThHanLoai', loai === 'CO_HAN_CU_THE' ? '' : '(không bắt buộc với loại này)');
  }
  setText('klThHanGhiChu', $('klThHan').value ? ghiChuHan($('klThHan').value, homNay) : '');
}

function dienLinhVuc() {
  const ds = linhVucCuaNganh($('klThNganh').value);
  $('klThLinhVuc').innerHTML = opt('', 'Chọn lĩnh vực') + ds.map((l) => opt(l.ma, l.ten)).join('');
}

async function openKlThem() {
  if (!state.user?.quan_tri_kl) return;
  try { hoiNghi = await loadHoiNghi(); } catch (e) { notifyError(e.message); return; }
  homNay = (await homNayTheoDb()) || homNayVN();
  const dm = danhMucKl();
  $('klThHoiNghi').innerHTML = opt(MOI, 'Hội nghị / kết luận mới…') + hoiNghi.map((h) => opt(h.id, `Hội nghị ${h.so_hoi_nghi} · ${h.so_ket_luan} · BH ${formatNgay(h.ngay_ban_hanh)}`)).join('');
  if (hoiNghi.length) $('klThHoiNghi').value = hoiNghi[0].id;
  $('klThNgayBH').max = homNay;
  const canBo = state.accounts.filter((a) => !a.is_system).sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
  $('klThChuTri').innerHTML = opt('', 'Chọn chủ trì') + canBo.map((a) => opt(a.id, `${a.full_name} — ${DEPT_NAMES[a.department] || a.department || ''}`)).join('');
  $('klThCoQuan').innerHTML = opt('', 'Chọn cơ quan trình') + dm.coQuanTrinh.map((c) => opt(c.ma, c.ten)).join('');
  $('klThNganh').innerHTML = opt('', 'Chọn ngành') + dm.nganh.map((n) => opt(n.ma, n.ten)).join('');
  $('klThLoai').innerHTML = dm.loaiThoiHan.map((l) => opt(l.ma, l.ten, l.ma === 'CO_HAN_CU_THE')).join('');
  ['klThNoiDung', 'klThHan', 'klThLyDo', 'klThVanBan', 'klThGhiChu', 'klThSoHN', 'klThSoKL', 'klThNgayBH'].forEach((id) => { $(id).value = ''; });
  $('klThChuaCoHan').checked = false;
  dienLinhVuc();
  capNhatHienThi();
  show('klThemModal', true);
  $('klThNoiDung').focus();
}

function closeKlThem() { show('klThemModal', false); }

// Kiểm tra phía form theo 6.8 (cùng quy tắc với DB); trả về chuỗi lỗi hoặc null.
function kiemTra(nv, hnMoi) {
  if (hnMoi) {
    if (!hnMoi.so_hoi_nghi || !hnMoi.so_ket_luan || !hnMoi.ngay_ban_hanh) return 'Hội nghị mới phải có số hội nghị, số kết luận và ngày ban hành.';
    if (hnMoi.ngay_ban_hanh > homNay) return 'Ngày ban hành ở tương lai — kiểm tra lại năm.';
  } else if (!$('klThHoiNghi').value || $('klThHoiNghi').value === MOI) return 'Chọn hội nghị hoặc nhập hội nghị mới.';
  if (!nv.noi_dung) return 'Nhập nội dung nhiệm vụ.';
  if (!nv.chu_tri_id) return 'Chọn chủ trì theo dõi — không được để trống.';
  if (!nv.nganh_ma) return 'Chọn ngành.';
  if (!nv.linh_vuc_ma) return 'Chọn lĩnh vực thuộc ngành đã chọn (bắt buộc với nhiệm vụ nhập mới).';
  if (nv.han_xu_ly && ngayBH() && nv.han_xu_ly < ngayBH()) return `Hạn xử lý không được trước ngày ban hành (${formatNgay(ngayBH())}). Chọn lại ngày.`;
  if (nv.loai_thoi_han_ma === 'CO_HAN_CU_THE' && !nv.han_xu_ly && !nv.ly_do_chua_co_han) return 'Loại "Có hạn cụ thể" phải có hạn xử lý, hoặc tích "Chưa xác định được hạn" và ghi lý do.';
  return null;
}

async function luu(nhapTiep) {
  const chuaCoHan = $('klThLoai').value === 'CO_HAN_CU_THE' && $('klThChuaCoHan').checked;
  const hnMoi = $('klThHoiNghi').value === MOI
    ? { so_hoi_nghi: Number($('klThSoHN').value) || null, so_ket_luan: $('klThSoKL').value.trim(), ngay_ban_hanh: $('klThNgayBH').value } : null;
  const nv = {
    noi_dung: $('klThNoiDung').value.trim(), chu_tri_id: $('klThChuTri').value || null,
    nganh_ma: $('klThNganh').value || null, linh_vuc_ma: $('klThLinhVuc').value || null, co_quan_trinh_ma: $('klThCoQuan').value || null,
    loai_thoi_han_ma: $('klThLoai').value,
    han_xu_ly: $('klThLoai').value === 'KY_BAN_HANH' || chuaCoHan ? null : $('klThHan').value || null,
    ly_do_chua_co_han: chuaCoHan ? $('klThLyDo').value.trim() || null : null,
    van_ban_trien_khai: $('klThVanBan').value.trim() || null, linh_vuc_chi_tiet: $('klThGhiChu').value.trim() || null,
  };
  const loiForm = kiemTra(nv, hnMoi);
  if (loiForm) { notifyError(loiForm); return; }
  $('klThLuu').disabled = true;
  try {
    let hn = hoiNghiChon();
    if (hnMoi) { hn = await themHoiNghi(hnMoi); hoiNghi.unshift(hn); $('klThHoiNghi').insertAdjacentHTML('afterbegin', opt(hn.id, `Hội nghị ${hn.so_hoi_nghi} · ${hn.so_ket_luan} · BH ${formatNgay(hn.ngay_ban_hanh)}`)); }
    const kq = await themNhiemVu({ ...nv, hoi_nghi_id: hn.id });
    notifySuccess(`Đã thêm ${kq.ma}.`);
    afterSave();
    if (!nhapTiep) { closeKlThem(); return; }
    // Nhập tiếp: giữ hội nghị, ngành, lĩnh vực, cơ quan trình, loại hạn; xoá phần riêng của từng việc.
    $('klThHoiNghi').value = hn.id;
    ['klThNoiDung', 'klThHan', 'klThLyDo', 'klThVanBan', 'klThGhiChu'].forEach((id) => { $(id).value = ''; });
    $('klThChuTri').value = ''; $('klThChuaCoHan').checked = false;
    capNhatHienThi(); $('klThNoiDung').focus();
  } catch (e) {
    notifyError('Không lưu được: ' + e.message);
  } finally {
    $('klThLuu').disabled = false;
  }
}

export function mountKlThemModal(onSave) {
  afterSave = onSave;
  $('modalRoot').insertAdjacentHTML('beforeend', klThemTemplate);
  ['klThHoiNghi', 'klThLoai', 'klThChuaCoHan', 'klThNgayBH'].forEach((id) => $(id).addEventListener('change', capNhatHienThi));
  $('klThHan').addEventListener('input', capNhatHienThi);
  $('klThNganh').addEventListener('change', dienLinhVuc);
  registerActions({ openKlThem, closeKlThem, luuKlThem: () => luu(false), luuKlThemTiep: () => luu(true) });
}
