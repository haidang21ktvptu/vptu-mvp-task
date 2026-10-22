// View A3 — Chuyên viên. v3.25 (bảng theo cột, mẫu Main 16/10/2026; chủ dự án duyệt 18/10): "Việc của tôi" là MỘT bảng (bang-viec.js) — ô số,
// tìm, vai trò, sắp xếp, nhóm theo văn bản giao; mỗi dòng một "Việc cần làm" (xác nhận nhận việc / trả lời chỉ đạo / nộp minh chứng có đính kèm
// tệp / cập nhật tiến độ), biểu mẫu mở ngay dưới dòng (khoi-viec.js); bấm nội dung việc mở ngăn chi tiết dùng chung (vướng mắc, đề nghị sửa,
// diễn biến). Đầu trang giữ dải Cần xử lý ngay và các khối đề nghị từ chối. "Việc tôi theo dõi" = màn hình Nhiệm vụ chế độ theo dõi
// (shared/kl/theo-doi.js). Quyền thật ở DB.
import { $, setText, show, formatDateTime, giuONhap } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifySuccess, notifyError } from '../../components/toast.js';
import { registerView } from '../registry.js';
import { moManDau } from '../shell/duong-dan.js';
import { batKlRealtime, hienKetNoi } from '../../features/kl-realtime.js';
import { xacNhanNhanViec, loadVanBan } from '../../lib/kl/du-lieu.js';
import { nopMinhChung, loiMinhChung } from '../../lib/kl/minh-chung.js';
import { batBuocTep, taiLenTep, xoaTepChuaGan } from '../../lib/kl/tep-minh-chung.js';
import { loiTep } from '../../lib/kl/tep-ten.js';
import { setActiveNav, showSection, sectionDangHien } from '../shell/index.js';
import { dh, napDieuHanh } from '../shared/dieu-hanh/du-lieu.js';
import { dieuHanhTheoSuKien } from '../shared/dieu-hanh/su-kien.js';
import { datNapLai } from '../shared/dieu-hanh/hanh-dong.js';
import { ngayDaiVN, datCauHinhDieuHanh } from '../shared/dieu-hanh/man-hinh.js';
import { napLaiViec } from '../shared/kl/nap-lai-viec.js';
import { lamMoiHuyHieu, onSoChuaXuLy } from '../../features/huy-hieu.js';
import { openKl, duocGiaoViec } from '../shared/kl/index.js';
import { openKlCapNhat } from '../shared/kl/cap-nhat-modal.js';
import { thanhTuChoiHtml, napDnsCuaToi } from './viec-cua-toi.js';
import { vct, veBangViec, hanhDongBangViec, doiLocViec, datLaiVct } from './bang-viec.js';
import { vctTemplate } from './template.js';
import { canXuLyHtml, khoiBiTuChoiHtml } from '../shared/can-xu-ly.js';
import { tuChoiChoHtml } from '../shared/dieu-hanh/tu-choi-cho.js';
import { giuDienBien } from '../shared/dien-bien.js';
import { giuTieuDiem } from '../shared/bang/khung.js';

function ve() {
  const trang = $('viewDieuHanh');
  const traNhap = giuONhap(trang); const traTd = giuTieuDiem(trang);   // ô đang gõ, nút đang focus giữ qua lần vẽ lại (nạp lại nền, realtime)
  $('dhCanXuLy').innerHTML = canXuLyHtml();
  const traDienBien = giuDienBien($('vctKhoi'));   // khối Xem diễn biến đang mở trong các khối đề nghị từ chối
  const khoi = [
    tuChoiChoHtml(),          // Đợt D (0091): đề nghị từ chối việc tôi đã nhập / giao — tôi xử lý
    thanhTuChoiHtml(),        // GĐ22: kết quả đề nghị từ chối của tôi (đã đồng ý / không đồng ý)
    khoiBiTuChoiHtml(),       // GĐ22: việc tôi giao bị từ chối → Giao lại
  ].join('');
  $('vctKhoi').innerHTML = khoi; show('vctKhoi', Boolean(khoi));
  traDienBien();
  veBangViec();
  if (dh.luc) setText('dhTinhDen', `${ngayDaiVN(dh.luc)}, số liệu ${formatDateTime(dh.luc).split(' ')[1]}`);
  traNhap(); traTd();
}

// Trích yếu ở hàng nhóm "Nhóm theo văn bản giao": đọc danh sách văn bản khi đang nhóm và có văn bản chưa biết (không đọc lại mỗi lần nạp).
async function napVanBanNeuCan() {
  if (!vct.nhomVb || !dh.tatCa.some((r) => r.van_ban_id && !vct.vanBan.has(r.van_ban_id))) return;
  const vb = await loadVanBan().catch(() => null);
  if (vb) { vct.vanBan = new Map(vb.map((h) => [h.id, h])); veBangViec(); }
}
async function loadViecCuaToi() {
  try {
    await Promise.all([napDieuHanh(), napDnsCuaToi()]);
    ve();
    await napVanBanNeuCan();
  } catch (e) { notifyError('Không đọc được việc của đồng chí: ' + e.message); }
}
// Đề nghị sửa của tôi (ghi chú "chờ … duyệt" trên dòng): đọc lại mỗi lần số chưa xử lý làm mới — sau mỗi lần ghi và theo tín hiệu realtime.
async function lamMoiDnsThe() {
  if (state.user?.role_group === 'A3' && dh.luc && sectionDangHien('viewDieuHanh') && await napDnsCuaToi()) ve();
}
function openDieuHanh() {
  showSection('viewDieuHanh');
  setActiveNav('navDieuHanh');
  datNapLai(loadViecCuaToi);
  loadViecCuaToi();
  batKlRealtime((su) => { if (sectionDangHien('viewDieuHanh')) dieuHanhTheoSuKien(su, loadViecCuaToi, ve); }, (m) => hienKetNoi('dhKetNoi', m));
}
const openTheoDoi = () => { const p = openKl({ theoDoiCuaToi: state.user.id }); setActiveNav('navTheoDoi'); return p; };   // v3.29: trả lời hứa — mở việc theo đường dẫn chờ danh sách nạp xong

// Xác nhận đã nhận việc (GV-5): chỉ ghi lịch sử, hạn/trạng thái không đổi (CN-2.2).
async function xacNhanNhanThe({ id }) {
  try {
    const moi = await xacNhanNhanViec(id);
    notifySuccess(moi ? 'Đã xác nhận nhận việc. Hạn và trạng thái không đổi — đồng hồ đã chạy từ ngày giao nhiệm vụ.' : 'Đồng chí đã xác nhận nhận việc này trước đó.');
    await napLaiViec(id); await lamMoiHuyHieu(); await loadViecCuaToi(); // dòng + số chưa xử lý đổi ngay, rồi nạp lại cả trang
  } catch (e) { notifyError('Không xác nhận được: ' + e.message); }
}
// Nộp minh chứng ngay dưới dòng (MC-3, 0046): số hiệu, ngày văn bản, cấp nhận + trích yếu + mô tả kết quả, tệp — DB là chốt (nop_minh_chung).
async function nopMinhChungThe(ds, form) {
  const f = new FormData(form);
  const p = { nhiem_vu_id: ds.id, so_hieu: (f.get('so_hieu') || '').trim(), ngay_van_ban: f.get('ngay_van_ban'), cap_nhan: f.get('cap_nhan'),
    trich_yeu: (f.get('trich_yeu') || '').trim(), mo_ta_ket_qua: (f.get('mo_ta_ket_qua') || '').trim() };
  const loiForm = loiMinhChung(p, dh.rows.find((r) => r.id === ds.id)?.cap_nhan_san_pham);
  if (loiForm) { notifyError(loiForm); return; }
  const tep = form.querySelector('input[name="tep"]')?.files?.[0] || null;
  if (tep && loiTep(tep)) { notifyError(loiTep(tep)); return; }
  if (batBuocTep() && !tep) { notifyError('Minh chứng phải kèm tệp — bấm "Đính kèm tệp…" để chọn văn bản kết quả.'); return; }   // 0089 cấu hình 2
  let path = null;
  try {
    if (tep) { path = await taiLenTep(ds.id, tep); Object.assign(p, { tep_path: path, tep_ten: tep.name }); }
    await nopMinhChung(p);
    notifySuccess(`Đã nộp minh chứng số ${p.so_hieu}${tep ? ` kèm tệp ${tep.name}` : ''} — nhiệm vụ hoàn thành. Người liên quan nhận thông báo trên hệ thống.`);
    if (vct.khoi?.id === ds.id) vct.khoi = null;
    await napLaiViec(ds.id); await lamMoiHuyHieu(); await loadViecCuaToi();
  } catch (e) { await xoaTepChuaGan(path); notifyError(e.message); }
}
// Ô lọc / ô tìm / ô đánh dấu của bảng + ô tệp của khối nộp minh chứng (gắn một lần mỗi lần dựng khung).
function onDoiTrenTrang(e) {
  const el = e.target;
  if (doiLocViec(el)) { veBangViec(); if (el.id === 'vctNhomVb') napVanBanNeuCan(); return; }
  if (el.matches?.('.mc-inline input[type="file"][name="tep"]')) {
    const f = el.files?.[0]; const l = f ? loiTep(f) : '';
    if (l) { notifyError(l); el.value = ''; }
    setText(`${el.id}-ten`, f && !l ? f.name : 'Chưa chọn tệp (PDF, Word, Excel, ảnh; tối đa 10 MB)');
  }
}
const capNhatThe = ({ id }) => openKlCapNhat({ id, rows: dh.rows });
// Xuất Excel đúng danh sách đang hiện (sau ô số, tìm, vai trò) — nạp động lib/kl/xuat.js như màn Nhiệm vụ.
async function vctXuatExcel() {
  try { const { xuatNhiemVu } = await import('../../lib/kl/xuat.js'); notifySuccess(`Đã xuất ${vct.dangHien.length} việc ra tệp ${xuatNhiemVu(vct.dangHien)}.`); } catch (e) { notifyError('Không xuất được Excel: ' + e.message); }
}

export function registerA3View() {
  registerActions({ openTheoDoi, xacNhanNhanThe, nopMinhChungThe, capNhatThe, vctXuatExcel, ...hanhDongBangViec });
  registerView('A3', {
    init() {
      registerActions({ openDieuHanh, loadDieuHanh: loadViecCuaToi }); // đăng ký lúc vào vai, không đè vai khác
      datLaiVct();   // đăng nhập lại: ô số, bộ lọc mặc định
      $('viewDieuHanh').innerHTML = vctTemplate(ngayDaiVN(), duocGiaoViec());
      const trang = $('viewDieuHanh').querySelector('.vct-trang');   // phần tử mới mỗi lần init — không gắn trùng
      trang.addEventListener('change', onDoiTrenTrang); trang.addEventListener('input', (e) => { if (e.target.id === 'vctTim') onDoiTrenTrang(e); });
      datNapLai(loadViecCuaToi);
      datCauHinhDieuHanh({ kpi: () => [], phuDe: () => '', veThem: ve }); // napLaiViec → veDieuHanh → vẽ lại bảng ngay sau mỗi hành động ghi
      onSoChuaXuLy(lamMoiDnsThe);   // hàm cấp module: đăng nhập lại không đăng ký trùng (Set)
      moManDau(openDieuHanh);   // v3.29: mở chức năng theo đường dẫn (nếu thuộc vai), không thì trang đầu
    },
    reload() { openDieuHanh(); },
  });
}
