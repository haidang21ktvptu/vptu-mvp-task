// View A2 — Trưởng phòng (mockup "Phòng tôi hôm nay"): khung bốn nhóm đầu trang — chỉ đạo từ Văn phòng chờ phòng phản hồi (Nhắc chuyên
// viên / Phản hồi thay), việc Đỏ của phòng (Đôn đốc tại chỗ; Giao lại / Gia hạn ở ngăn chi tiết), minh chứng chuyên viên vừa nộp (Hợp lệ /
// Không hợp lệ), sắp đến hạn trong phòng (Nhắc). Menu: Giao việc trong phòng, Nhiệm vụ của phòng, Cán bộ, Nhắn tin. Quyền thật ở hàm DB.
import { $, setText, formatDateTime } from '../../lib/dom.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifyError } from '../../components/toast.js';
import { registerView } from '../registry.js';
import { batKlRealtime, hienKetNoi } from '../../features/kl-realtime.js';
import { setActiveNav, showSection, sectionDangHien } from '../shell/index.js';
import { dh, napDieuHanh, viecDo } from '../shared/dieu-hanh/du-lieu.js';
import { datNapLai } from '../shared/dieu-hanh/hanh-dong.js';
import { ngayDaiVN } from '../shared/dieu-hanh/man-hinh.js';
import { minhChungChoHtml } from '../shared/dieu-hanh/minh-chung-cho.js';
import { mucChiDaoChoHtml, mucViecDoHtml, mucSapHanHtml } from './phong-toi.js';
import { tuChoiChoHtml } from '../shared/dieu-hanh/tu-choi-cho.js';
import { registerCanBo } from '../shared/can-bo.js';

function ve() {
  const rows = dh.rows; const mo = rows.filter((r) => r.tien_do_ma !== 'HOAN_THANH');
  const doN = viecDo().length; const vangN = rows.filter((r) => r.muc_canh_bao === 'VANG').length;
  setText('ptTom', `${mo.length} việc mở, ${doN} Đỏ, ${vangN} Vàng`);
  $('ptTuChoi').innerHTML = tuChoiChoHtml();
  $('ptChiDao').innerHTML = mucChiDaoChoHtml();
  $('ptDo').innerHTML = mucViecDoHtml();
  $('ptMc').innerHTML = dh.mcCho.length ? `<div class="muc lam"><b>Minh chứng chuyên viên vừa nộp</b>${minhChungChoHtml()}</div>` : '';
  $('ptVang').innerHTML = mucSapHanHtml();
  if (dh.luc) setText('dhTinhDen', `${ngayDaiVN(dh.luc)}, số liệu ${formatDateTime(dh.luc).split(' ')[1]}`);
}

async function loadPhongToi() {
  try { await napDieuHanh(); ve(); } catch (e) { notifyError('Không đọc được dữ liệu phòng: ' + e.message); }
}

function openDieuHanh() {
  showSection('viewDieuHanh');
  setActiveNav('navDieuHanh');
  datNapLai(loadPhongToi);
  loadPhongToi();
  batKlRealtime(() => { if (sectionDangHien('viewDieuHanh')) loadPhongToi(); }, (m) => hienKetNoi('dhKetNoi', m));
}

export function registerA2View() {
  registerCanBo();
  registerView('A2', {
    init() {
      registerActions({ openDieuHanh, loadDieuHanh: loadPhongToi }); // đăng ký lúc vào vai, không đè vai khác
      const phong = DEPT_NAMES[state.user.department] || state.user.department || 'Phòng';
      $('viewDieuHanh').innerHTML = `
        <div class="dau"><h1>${phong} hôm nay</h1><span id="dhTinhDen">${ngayDaiVN()}, đang nạp số liệu…</span>
          <div class="phai-dau"><span id="dhKetNoi" class="ket-noi" role="status"></span><button type="button" class="nut nho" data-action="loadDieuHanh">Tải lại</button></div></div>
        <div class="khung"><div class="tieu"><b>Ba việc của Trưởng phòng</b><span id="ptTom"></span></div>
          <div id="ptTuChoi"></div><div id="ptChiDao"></div><div id="ptDo"></div><div id="ptMc"></div><div id="ptVang"></div>
          <div class="them"><button type="button" class="nut nho" data-action="openKl">Xem đủ nhiệm vụ của phòng</button></div></div>`;
      datNapLai(loadPhongToi);
      openDieuHanh();
    },
    reload() { openDieuHanh(); },
  });
}
