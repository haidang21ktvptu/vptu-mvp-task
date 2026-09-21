// View A3 — Chuyên viên (v8 đợt 2, mockup 05 "Việc của tôi": hai cột, hàng việc, cột phụ 340px hạn 7 ngày + hướng dẫn nhanh): thẻ theo mức khẩn, hành động tại chỗ — việc mới giao cần xác nhận đã nhận (thay modal
// bắt buộc), chỉ đạo cần trả lời (ô một dòng), sắp đến hạn / quá hạn chưa có minh chứng (nộp minh chứng 3 ô ngay trên thẻ), đang thực
// hiện (Cập nhật tiến độ). "Việc tôi theo dõi" = màn hình Nhiệm vụ lọc việc mình theo dõi. Quyền thật ở hàm DB / policy 0025, 0028.
import { $, setText, escapeHtml, formatDateTime } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifySuccess, notifyError } from '../../components/toast.js';
import { registerView } from '../registry.js';
import { batKlRealtime, hienKetNoi } from '../../features/kl-realtime.js';
import { xacNhanNhanViec } from '../../lib/kl/du-lieu.js';
import { nopMinhChung } from '../../lib/kl/minh-chung.js';
import { homNayVN, ghiChuHan } from '../../lib/kl/ngay.js';
import { setActiveNav, showSection, sectionDangHien } from '../shell/index.js';
import { dh, napDieuHanh } from '../shared/dieu-hanh/du-lieu.js';
import { datNapLai } from '../shared/dieu-hanh/hanh-dong.js';
import { ngayDaiVN, datCauHinhDieuHanh } from '../shared/dieu-hanh/man-hinh.js';
import { napLaiViec } from '../shared/kl/nap-lai-viec.js';
import { lamMoiHuyHieu } from '../../features/huy-hieu.js';
import { openKl } from '../shared/kl/index.js';
import { openKlCapNhat } from '../shared/kl/cap-nhat-modal.js';
import { nhomViecCuaToi, mucHtml, thanhTuChoiHtml } from './viec-cua-toi.js';
import { canXuLyHtml, khoiBiTuChoiHtml } from '../shared/can-xu-ly.js';
import { giuDienBien } from '../shared/dien-bien.js';

function ve() {
  const n = nhomViecCuaToi();
  const canLam = n.moi.length + n.chiDao.length + n.canMinhChung.length;
  setText('vctTom', `${canLam} việc cần làm, ${n.dangLam.length} đang thực hiện, ${n.theoDoi.length} đang theo dõi`);
  $('dhCanXuLy').innerHTML = canXuLyHtml();
  const traDienBien = giuDienBien($('vctMuc')); // khối Xem diễn biến đang mở giữ qua lần vẽ lại
  $('vctMuc').innerHTML = [
    thanhTuChoiHtml(),        // GĐ22: kết quả đề nghị từ chối của tôi (đã đồng ý / không đồng ý)
    khoiBiTuChoiHtml(),       // GĐ22: việc tôi giao thay mặt bị từ chối (chuyên viên giữ quan_tri_kl)
    mucHtml('do', 'Bị từ chối, chờ lãnh đạo giao lại', n.tuChoi, 'tu-choi'),
    mucHtml('lam', 'Việc mới giao — cần xác nhận đã nhận', n.moi, 'moi'),
    mucHtml('do', 'Chỉ đạo cần trả lời', n.chiDao, 'chi-dao'),
    mucHtml('vang', 'Sắp đến hạn hoặc quá hạn, chưa có minh chứng', n.canMinhChung, 'minh-chung'),
    mucHtml('luc', 'Đang thực hiện, còn thời gian', n.dangLam, 'dang-lam'),
  ].join('') || '<div class="muc"><b>Hôm nay đồng chí không có việc nào cần làm.</b></div>';
  traDienBien();
  $('vctTuan').innerHTML = hanTuanHtml();
  if (dh.luc) setText('dhTinhDen', `${ngayDaiVN(dh.luc)}, số liệu ${formatDateTime(dh.luc).split(' ')[1]}`);
}

// Cột phụ "Hạn trong 7 ngày tới" (thay "lịch tuần" của mockup 05 — hệ thống chưa có nguồn lịch): việc tôi chủ trì hoặc theo dõi đang mở, hạn từ
// quá hạn tới 7 ngày tới, tính từ dòng đã tải, không truy vấn thêm. Thứ lấy theo UTC vì han_xu_ly là chuỗi ngày (không lệch theo múi giờ máy); Đỏ = đã quá hạn, Vàng = trong 3 ngày.
const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
function hanTuanHtml() {
  const me = state.user?.id; const homNay = homNayVN();
  const ds = dh.rows.filter((r) => r.tien_do_ma !== 'HOAN_THANH' && r.han_xu_ly && (r.owner_tai_khoan === me || r.nguoi_theo_doi === me))
    .map((r) => ({ r, ngay: Math.round((new Date(r.han_xu_ly) - new Date(homNay)) / 864e5) })).filter((x) => x.ngay <= 7).sort((a, b) => a.ngay - b.ngay).slice(0, 8);
  if (!ds.length) return '<p class="trong">Không có hạn nào trong 7 ngày tới.</p>';
  return ds.map(({ r, ngay }) => `<div class="han-tuan"><b>${THU[new Date(r.han_xu_ly).getUTCDay()]}</b><span class="${ngay < 0 ? 'do' : ngay <= 3 ? 'vang' : ''}" title="${escapeHtml(r.noi_dung)}">${escapeHtml(r.ma)} · ${ghiChuHan(r.han_xu_ly, homNay).toLowerCase()}</span></div>`).join('')
    + '<p class="huong-dan" style="padding-top:8px">Theo hạn xử lý của việc đồng chí chủ trì hoặc theo dõi.</p>';
}

async function loadViecCuaToi() {
  try { await napDieuHanh(); ve(); } catch (e) { notifyError('Không đọc được việc của đồng chí: ' + e.message); }
}
function openDieuHanh() {
  showSection('viewDieuHanh');
  setActiveNav('navDieuHanh');
  datNapLai(loadViecCuaToi);
  loadViecCuaToi();
  batKlRealtime(() => { if (sectionDangHien('viewDieuHanh')) loadViecCuaToi(); }, (m) => hienKetNoi('dhKetNoi', m));
}
const openTheoDoi = () => { openKl({ theoDoiCuaToi: state.user.id }); setActiveNav('navTheoDoi'); };

// Xác nhận đã nhận việc (GV-5): chỉ ghi lịch sử, hạn/trạng thái không đổi (CN-2.2).
async function xacNhanNhanThe({ id }) {
  try {
    const moi = await xacNhanNhanViec(id);
    notifySuccess(moi ? 'Đã xác nhận nhận việc. Hạn và trạng thái không đổi — đồng hồ đã chạy từ ngày nhận văn bản.' : 'Đồng chí đã xác nhận nhận việc này trước đó.');
    await napLaiViec(id); await lamMoiHuyHieu(); await loadViecCuaToi(); // thẻ + số chưa xử lý đổi ngay, rồi nạp lại cả trang
  } catch (e) { notifyError('Không xác nhận được: ' + e.message); }
}
// Nộp minh chứng 3 ô ngay trên thẻ (MC-3): số hiệu, ngày văn bản, cấp nhận — DB là chốt (nop_minh_chung 0028).
async function nopMinhChungThe(ds, form) {
  const f = new FormData(form);
  const p = { nhiem_vu_id: ds.id, so_hieu: (f.get('so_hieu') || '').trim(), ngay_van_ban: f.get('ngay_van_ban'), cap_nhan: f.get('cap_nhan') };
  if (!p.so_hieu || !p.ngay_van_ban || !p.cap_nhan) { notifyError('Minh chứng phải đủ ba trường: số hiệu, ngày văn bản và cấp nhận.'); return; }
  try {
    await nopMinhChung(p);
    notifySuccess(`Đã nộp minh chứng số ${p.so_hieu}. Người liên quan nhận thông báo trên hệ thống.`);
    await napLaiViec(ds.id); await lamMoiHuyHieu(); await loadViecCuaToi();
  } catch (e) { notifyError(e.message); }
}
const capNhatThe = ({ id }) => openKlCapNhat({ id, rows: dh.rows });

export function registerA3View() {
  registerActions({ openTheoDoi, xacNhanNhanThe, nopMinhChungThe, capNhatThe });
  registerView('A3', {
    init() {
      registerActions({ openDieuHanh, loadDieuHanh: loadViecCuaToi }); // đăng ký lúc vào vai, không đè vai khác
      $('viewDieuHanh').innerHTML = `
        <div class="dau"><h1>Việc của tôi</h1><span id="dhTinhDen">${ngayDaiVN()}, đang nạp…</span>
          <div class="phai-dau"><span id="dhKetNoi" class="ket-noi" role="status"></span><button type="button" class="nut nho" data-action="loadDieuHanh">Tải lại</button></div></div>
        <div id="dhCanXuLy"></div>
        <div class="hai-cot" style="--rong-phu:340px">
          <section class="tam"><div class="tam-dau"><h2>Hôm nay của tôi</h2><span id="vctTom"></span></div><div id="vctMuc"></div>
            <div class="them"><button type="button" class="nut nho" data-action="openKl">Xem toàn bộ việc của tôi</button></div></section>
          <aside class="cot-phu">
            <section class="tam"><div class="tam-dau"><h2>Hạn trong 7 ngày tới</h2></div><div id="vctTuan"></div></section>
            <section class="tam"><div class="tam-dau"><h2>Hướng dẫn nhanh</h2></div><p class="huong-dan">Việc hoàn thành khi có minh chứng hợp lệ: số hiệu, ngày văn bản, cấp nhận — nộp ngay trên hàng việc. Sau khi nộp, lãnh đạo xác nhận thì việc mới đóng. Việc mới giao cần xác nhận đã nhận trong ngày làm việc.</p></section>
          </aside>
        </div>`;
      datNapLai(loadViecCuaToi);
      datCauHinhDieuHanh({ kpi: () => [], phuDe: () => '', veThem: ve }); // napLaiViec → veDieuHanh → vẽ lại thẻ A3 ngay sau mỗi hành động ghi
      openDieuHanh();
    },
    reload() { openDieuHanh(); },
  });
}
