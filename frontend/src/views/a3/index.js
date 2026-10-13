// View A3 — Chuyên viên (v8 đợt 2, mockup 05 "Việc của tôi": hai cột, hàng việc, cột phụ 340px hạn 7 ngày + hướng dẫn nhanh). v9 đợt 2: một thẻ
// mỗi việc, mọi thao tác trên thẻ (viec-cua-toi.js) — xác nhận đã nhận / từ chối, trả lời chỉ đạo ngay dưới lời chỉ đạo, nộp minh chứng, cập nhật
// tiến độ, ghi vướng mắc, đề nghị sửa ô do cấp giao điền. "Việc tôi theo dõi" = màn hình Nhiệm vụ lọc việc mình theo dõi. Quyền thật ở DB.
// v3.23: thẻ tối giản (the-viec-gon.js — "Chi tiết" mở đủ thông tin), dải số tổng mọi việc của tôi + lọc cán bộ + nhóm theo văn bản (tong-viec.js);
// nộp minh chứng trên thẻ có đính kèm tệp (tải lên trước, nộp sau — lỗi thì xoá tệp chưa gắn).
import { $, setText, escapeHtml, formatDateTime, giuONhap } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifySuccess, notifyError } from '../../components/toast.js';
import { registerView } from '../registry.js';
import { batKlRealtime, hienKetNoi } from '../../features/kl-realtime.js';
import { xacNhanNhanViec, loadPhanCongHieuLuc } from '../../lib/kl/du-lieu.js';
import { nopMinhChung, loiMinhChung } from '../../lib/kl/minh-chung.js';
import { batBuocTep, taiLenTep, xoaTepChuaGan } from '../../lib/kl/tep-minh-chung.js';
import { loiTep } from '../../lib/kl/tep-ten.js';
import { homNayVN, ghiChuHan } from '../../lib/kl/ngay.js';
import { setActiveNav, showSection, sectionDangHien } from '../shell/index.js';
import { dh, napDieuHanh } from '../shared/dieu-hanh/du-lieu.js';
import { dieuHanhTheoSuKien } from '../shared/dieu-hanh/su-kien.js';
import { datNapLai } from '../shared/dieu-hanh/hanh-dong.js';
import { ngayDaiVN, datCauHinhDieuHanh } from '../shared/dieu-hanh/man-hinh.js';
import { napLaiViec } from '../shared/kl/nap-lai-viec.js';
import { lamMoiHuyHieu, onSoChuaXuLy } from '../../features/huy-hieu.js';
import { openKl } from '../shared/kl/index.js';
import { openKlCapNhat } from '../shared/kl/cap-nhat-modal.js';
import { thanhTuChoiHtml, napDnsCuaToi } from './viec-cua-toi.js';
import { vctChiTiet } from './the-viec-gon.js';
import { vct, soLieuVct, tomTat, tongSoHtml, locHtml, danhSachHtml, datXem, boLocVct, doiLocVct, datLaiVct } from './tong-viec.js';
import { canXuLyHtml, khoiBiTuChoiHtml } from '../shared/can-xu-ly.js';
import { tuChoiChoHtml } from '../shared/dieu-hanh/tu-choi-cho.js';
import { giuDienBien } from '../shared/dien-bien.js';

function ve() {
  const s = soLieuVct();
  setText('vctTom', tomTat(s));
  const traNhap = giuONhap($('viewDieuHanh')); // ô đang mở / đang gõ giữ qua lần vẽ lại (nạp lại nền, realtime — PR-2a lỗi đua)
  $('dhCanXuLy').innerHTML = canXuLyHtml();
  $('vctTongSo').innerHTML = tongSoHtml(s);
  $('vctLocWrap').innerHTML = locHtml();
  const traDienBien = giuDienBien($('vctMuc')); // khối Xem diễn biến đang mở giữ qua lần vẽ lại
  const dau = vct.xem === 'dang-lam' || vct.xem === 'can-lam';
  $('vctMuc').innerHTML = [
    dau ? tuChoiChoHtml() : '',        // Đợt D (0091): đề nghị từ chối việc tôi đã nhập / giao — tôi xử lý (lãnh đạo không bắt buộc)
    dau ? thanhTuChoiHtml() : '',      // GĐ22: kết quả đề nghị từ chối của tôi (đã đồng ý / không đồng ý)
    dau ? khoiBiTuChoiHtml() : '',     // GĐ22: việc tôi giao bị từ chối (chuyên viên giao thẳng / nhập thay mặt) → Giao lại
    danhSachHtml(s),
  ].join('');
  traDienBien();
  $('vctTuan').innerHTML = hanTuanHtml();
  if (dh.luc) setText('dhTinhDen', `${ngayDaiVN(dh.luc)}, số liệu ${formatDateTime(dh.luc).split(' ')[1]}`);
  traNhap();
}

// Cột phụ "Hạn trong 7 ngày tới" (thay "lịch tuần" của mockup 05 — hệ thống chưa có nguồn lịch): việc tôi chủ trì hoặc theo dõi đang mở, hạn từ
// quá hạn tới 7 ngày tới, tính từ dòng đã tải, không truy vấn thêm; loại việc mà chính tôi đã được duyệt từ chối (đang chờ giao lại). Quá hạn ghi "Quá hạn" thay thứ. Thứ lấy theo UTC vì han_xu_ly là chuỗi ngày (không lệch theo múi giờ máy); Đỏ = đã quá hạn, Vàng = trong 3 ngày.
const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
function hanTuanHtml() {
  const me = state.user?.id; const homNay = homNayVN();
  const daTuChoi = (r) => r.bi_tu_choi && r.tu_choi_moi_nhat?.nguoi_de_nghi === me && r.tu_choi_moi_nhat?.trang_thai === 'DONG_Y'; // tôi đã được duyệt từ chối, chờ giao lại → không còn hạn của tôi
  const ds = dh.rows.filter((r) => r.tien_do_ma !== 'HOAN_THANH' && r.han_xu_ly && (r.owner_tai_khoan === me || r.nguoi_theo_doi === me) && !daTuChoi(r))
    .map((r) => ({ r, ngay: Math.round((new Date(r.han_xu_ly) - new Date(homNay)) / 864e5) })).filter((x) => x.ngay <= 7).sort((a, b) => a.ngay - b.ngay).slice(0, 8);
  if (!ds.length) return '<p class="trong">Không có hạn nào trong 7 ngày tới.</p>';
  return ds.map(({ r, ngay }) => `<div class="han-tuan"><b class="${ngay < 0 ? 'do' : ''}">${ngay < 0 ? 'Quá hạn' : THU[new Date(r.han_xu_ly).getUTCDay()]}</b><span class="${ngay < 0 ? 'do' : ngay <= 3 ? 'vang' : ''}" title="${escapeHtml(r.noi_dung)}">${escapeHtml(r.ma)} · ${ghiChuHan(r.han_xu_ly, homNay).toLowerCase()}</span></div>`).join('')
    + '<p class="huong-dan" style="padding-top:8px">Theo hạn xử lý của việc đồng chí chủ trì hoặc theo dõi.</p>';
}

async function loadViecCuaToi() {
  try {
    const [,, pc] = await Promise.all([napDieuHanh(), napDnsCuaToi(), loadPhanCongHieuLuc().catch(() => vct.phanCong)]);   // phân công: ô Lãnh đạo VP phụ trách
    vct.phanCong = pc; ve();
  } catch (e) { notifyError('Không đọc được việc của đồng chí: ' + e.message); }
}
// Đề nghị sửa của tôi (thẻ "chờ … duyệt"): đọc lại mỗi lần số chưa xử lý làm mới — sau mỗi lần ghi và theo tín hiệu realtime (tin báo kết quả duyệt).
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
const openTheoDoi = () => { openKl({ theoDoiCuaToi: state.user.id }); setActiveNav('navTheoDoi'); };

// Xác nhận đã nhận việc (GV-5): chỉ ghi lịch sử, hạn/trạng thái không đổi (CN-2.2).
async function xacNhanNhanThe({ id }) {
  try {
    const moi = await xacNhanNhanViec(id);
    notifySuccess(moi ? 'Đã xác nhận nhận việc. Hạn và trạng thái không đổi — đồng hồ đã chạy từ ngày giao nhiệm vụ.' : 'Đồng chí đã xác nhận nhận việc này trước đó.');
    await napLaiViec(id); await lamMoiHuyHieu(); await loadViecCuaToi(); // thẻ + số chưa xử lý đổi ngay, rồi nạp lại cả trang
  } catch (e) { notifyError('Không xác nhận được: ' + e.message); }
}
// Nộp minh chứng ngay trên thẻ (MC-3, 0046): số hiệu, ngày văn bản, cấp nhận + trích yếu + mô tả kết quả — DB là chốt (nop_minh_chung).
async function nopMinhChungThe(ds, form) {
  const f = new FormData(form);
  const p = { nhiem_vu_id: ds.id, so_hieu: (f.get('so_hieu') || '').trim(), ngay_van_ban: f.get('ngay_van_ban'), cap_nhan: f.get('cap_nhan'),
    trich_yeu: (f.get('trich_yeu') || '').trim(), mo_ta_ket_qua: (f.get('mo_ta_ket_qua') || '').trim() };
  const loiForm = loiMinhChung(p, dh.rows.find((r) => r.id === ds.id)?.cap_nhan_san_pham);
  if (loiForm) { notifyError(loiForm); return; }
  const tep = form.querySelector('input[name="tep"]')?.files?.[0] || null;   // v3.23: đính kèm tệp ngay trên thẻ
  if (tep && loiTep(tep)) { notifyError(loiTep(tep)); return; }
  if (batBuocTep() && !tep) { notifyError('Minh chứng phải kèm tệp — bấm "Đính kèm tệp…" để chọn văn bản kết quả.'); return; }   // 0089 cấu hình 2
  let path = null;
  try {
    if (tep) { path = await taiLenTep(ds.id, tep); Object.assign(p, { tep_path: path, tep_ten: tep.name }); }
    await nopMinhChung(p);
    notifySuccess(`Đã nộp minh chứng số ${p.so_hieu}${tep ? ` kèm tệp ${tep.name}` : ''} — nhiệm vụ hoàn thành. Người liên quan nhận thông báo trên hệ thống.`);
    await napLaiViec(ds.id); await lamMoiHuyHieu(); await loadViecCuaToi();
  } catch (e) { await xoaTepChuaGan(path); notifyError(e.message); }
}
// Dải lọc + ô tệp trên thẻ (gắn một lần vào #viewDieuHanh của A3).
function onDoiTrenTrang(e) {
  const el = e.target;
  if (doiLocVct(el)) { ve(); return; }
  if (el.matches?.('.mc-inline input[type="file"][name="tep"]')) {
    const f = el.files?.[0]; const l = f ? loiTep(f) : '';
    if (l) { notifyError(l); el.value = ''; }
    setText(`${el.id}-ten`, f && !l ? f.name : 'Chưa chọn tệp (PDF, Word, Excel, ảnh; tối đa 10 MB)');
  }
}
const capNhatThe = ({ id }) => openKlCapNhat({ id, rows: dh.rows });

export function registerA3View() {
  registerActions({ openTheoDoi, xacNhanNhanThe, nopMinhChungThe, capNhatThe, vctChiTiet,
    vctXem: ({ xem }) => { datXem(xem); ve(); }, vctBoLoc: () => { boLocVct(); ve(); } });
  registerView('A3', {
    init() {
      registerActions({ openDieuHanh, loadDieuHanh: loadViecCuaToi }); // đăng ký lúc vào vai, không đè vai khác
      $('viewDieuHanh').innerHTML = `
        <div class="dau"><h1>Việc của tôi</h1><span id="dhTinhDen">${ngayDaiVN()}, đang nạp…</span>
          <div class="phai-dau"><span id="dhKetNoi" class="ket-noi" role="status"></span><button type="button" class="nut nho" data-action="loadDieuHanh">Tải lại</button></div></div>
        <div id="dhCanXuLy"></div>
        <div class="hai-cot" style="--rong-phu:340px">
          <section class="tam"><div class="tam-dau"><h2>Việc của tôi</h2><span id="vctTom"></span></div>
            <div id="vctTongSo"></div><div id="vctLocWrap"></div><div id="vctMuc"></div>
            <div class="them"><button type="button" class="nut nho" data-action="openKl">Mở danh sách đầy đủ (lọc, xuất Excel)</button></div></section>
          <aside class="cot-phu">
            <section class="tam"><div class="tam-dau"><h2>Hạn trong 7 ngày tới</h2></div><div id="vctTuan"></div></section>
            <section class="tam"><div class="tam-dau"><h2>Hướng dẫn nhanh</h2></div><p class="huong-dan">Việc hoàn thành khi nộp minh chứng hợp lệ: số hiệu, ngày văn bản (kèm tệp nếu có) — nộp ngay trên hàng việc hoặc trong ngăn chi tiết. Người giao việc, lãnh đạo xem kết quả và có thể trả lại nếu chưa đạt. Việc mới giao cần xác nhận đã nhận trong ngày làm việc.</p></section>
          </aside>
        </div>`;
      datLaiVct();   // đăng nhập lại: mục, bộ lọc mặc định
      $('viewDieuHanh').querySelector('.hai-cot').addEventListener('change', onDoiTrenTrang);   // phần tử mới mỗi lần init — không gắn trùng
      datNapLai(loadViecCuaToi);
      datCauHinhDieuHanh({ kpi: () => [], phuDe: () => '', veThem: ve }); // napLaiViec → veDieuHanh → vẽ lại thẻ A3 ngay sau mỗi hành động ghi
      onSoChuaXuLy(lamMoiDnsThe);   // hàm cấp module: đăng nhập lại không đăng ký trùng (Set)
      openDieuHanh();
    },
    reload() { openDieuHanh(); },
  });
}
