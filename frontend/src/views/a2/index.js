// View A2 — Trưởng phòng (v8 đợt 2, mockup 04 "Phòng tôi hôm nay"): ba tầng — (1) tiêu đề + ngày; (2) dải "Cần xử lý ngay"; (3) tấm việc Thường trực
// giao / đề nghị từ chối cần duyệt (viền vàng, lý do kín) / việc mình giao bị từ chối, rồi hai cột: chính = chỉ đạo từ Văn phòng chờ phòng, việc Đỏ +
// sắp đến hạn (hàng có Đôn đốc / Nhắc tại chỗ), minh chứng chuyên viên vừa nộp; cột phụ 360px = tải việc từng cán bộ (đếm từ dòng RLS đã tải,
// không truy vấn thêm) + việc do chính Trưởng phòng chủ trì. Menu: Giao việc trong phòng, Nhiệm vụ của phòng, Cán bộ, Nhắn tin. Quyền thật ở hàm DB.
import { $, show, setText, escapeHtml, formatDateTime } from '../../lib/dom.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifyError } from '../../components/toast.js';
import { registerView } from '../registry.js';
import { batKlRealtime, hienKetNoi } from '../../features/kl-realtime.js';
import { setActiveNav, showSection, sectionDangHien } from '../shell/index.js';
import { formatNgay } from '../../lib/kl/ngay.js';
import { dh, napDieuHanh, viecDo } from '../shared/dieu-hanh/du-lieu.js';
import { datNapLai } from '../shared/dieu-hanh/hanh-dong.js';
import { ngayDaiVN } from '../shared/dieu-hanh/man-hinh.js';
import { minhChungChoHtml } from '../shared/dieu-hanh/minh-chung-cho.js';
import { mucChiDaoChoHtml, mucViecDoHtml, mucSapHanHtml } from './phong-toi.js';
import { tuChoiChoHtml } from '../shared/dieu-hanh/tu-choi-cho.js';
import { canXuLyHtml, khoiThuongTrucHtml, khoiBiTuChoiHtml } from '../shared/can-xu-ly.js';
import { registerCanBo } from '../shared/can-bo.js';

const mo = (r) => r.tien_do_ma !== 'HOAN_THANH';
const laDo = (r) => ['DO', 'DO_DAC_BIET'].includes(r.muc_canh_bao);

// Tải việc từng cán bộ trong phòng: đếm việc mở / Đỏ / Vàng theo chủ trì từ dòng đã tải; thanh tỉ lệ theo người nhiều việc nhất.
function taiViecHtml() {
  const me = state.user;
  const cb = state.accounts.filter((a) => a.department === me.department && !a.is_system && a.id !== me.id);
  const dem = cb.map((a) => {
    const ds = dh.rows.filter((r) => r.owner_tai_khoan === a.id && mo(r));
    return { a, n: ds.length, doN: ds.filter(laDo).length, vangN: ds.filter((r) => r.muc_canh_bao === 'VANG').length };
  }).sort((x, y) => y.n - x.n || x.a.full_name.localeCompare(y.a.full_name, 'vi'));
  if (!dem.length) return '<p class="trong">Phòng chưa có cán bộ nào khác trong danh bạ.</p>';
  const coViec = dem.filter((d) => d.n > 0); const chua = dem.length - coViec.length; // v8 đợt 3: chỉ hiện người có việc, gom người 0 việc
  const max = Math.max(1, ...dem.map((d) => d.n));
  const pc = (n) => `${Math.round((n / max) * 100)}%`;
  const dongChua = chua ? `<div class="tai-nguoi tai-chua"><span class="av">–</span><span><small>${coViec.length ? 'và ' : ''}${chua} cán bộ chưa có việc đang mở</small></span></div>` : '';
  return coViec.map(({ a, n, doN, vangN }) => `<div class="tai-nguoi" data-cb="${a.id}"><span class="av">${escapeHtml((a.full_name.trim().split(/\s+/).pop() || '?').charAt(0).toUpperCase())}</span>
      <span><b>${escapeHtml(a.full_name)}</b><small>${n} việc${doN ? ` · ${doN} Đỏ` : ''}${vangN ? ` · ${vangN} Vàng` : ''}</small></span>
      <span class="tai"><span class="t-do" style="width:${pc(doN)}"></span><span class="t-vang" style="width:${pc(vangN)}"></span><span class="t-lam" style="width:${pc(n - doN - vangN)}"></span></span></div>`).join('') + dongChua;
}

// Việc do chính Trưởng phòng chủ trì, đang mở, hạn gần nhất trước.
function viecCuaToiHtml() {
  const ds = dh.rows.filter((r) => r.owner_tai_khoan === state.user.id && mo(r)).sort((a, b) => ((a.han_xu_ly || '9') < (b.han_xu_ly || '9') ? -1 : 1));
  if (!ds.length) return '<p class="trong">Đồng chí không trực tiếp chủ trì việc nào đang mở.</p>';
  return ds.map((r) => `<div class="the-con ${laDo(r) ? 'do' : ''}" id="ptToi-${r.id}"><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(r.noi_dung)}<br><small class="chu-phu">hạn ${r.han_xu_ly ? formatNgay(r.han_xu_ly) : 'chưa có'}</small></p>
      <div class="hanh-dong"><button type="button" class="nut" data-action="xemDienBien" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">Xem</button></div></div>`).join('');
}

function ve() {
  const rows = dh.rows; const moN = rows.filter(mo).length;
  const doN = viecDo().length; const vangN = rows.filter((r) => r.muc_canh_bao === 'VANG').length;
  setText('ptTom', `${moN} việc mở · ${doN} Đỏ · ${vangN} Vàng`);
  $('dhCanXuLy').innerHTML = canXuLyHtml();
  const tc = khoiThuongTrucHtml() + tuChoiChoHtml() + khoiBiTuChoiHtml(); // việc Thường trực giao, đề nghị cần duyệt, việc mình giao bị từ chối
  $('dhTC').innerHTML = tc; show('dhTC', Boolean(tc));
  const cd = mucChiDaoChoHtml(); $('ptChiDao').innerHTML = cd; show('ptChiDao', Boolean(cd));
  $('ptDo').innerHTML = mucViecDoHtml();
  $('ptVang').innerHTML = mucSapHanHtml();
  $('ptMc').innerHTML = dh.mcCho.length ? `<div class="muc lam"><b>Minh chứng chuyên viên vừa nộp (${dh.mcCho.length})</b>${minhChungChoHtml()}</div>` : '';
  show('ptMc', dh.mcCho.length > 0);
  $('ptTai').innerHTML = taiViecHtml();
  $('ptCuaToi').innerHTML = viecCuaToiHtml();
  if (dh.luc) setText('dhTinhDen', `Trưởng phòng · ${ngayDaiVN(dh.luc)}, số liệu ${formatDateTime(dh.luc).split(' ')[1]}`);
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
        <div id="dhCanXuLy"></div>
        <section class="tam hidden" id="dhTC"></section>
        <div class="hai-cot" style="--rong-phu:360px">
          <div class="cot-chinh">
            <section class="tam hidden" id="ptChiDao"></section>
            <section class="tam"><div class="tam-dau"><h2>Việc Đỏ và sắp đến hạn trong phòng</h2><span id="ptTom"></span></div><div id="ptDo"></div><div id="ptVang"></div>
              <div class="them"><button type="button" class="nut nho" data-action="openKl">Xem đủ nhiệm vụ của phòng</button></div></section>
            <section class="tam hidden" id="ptMc"></section>
          </div>
          <aside class="cot-phu">
            <section class="tam"><div class="tam-dau"><h2>Tải việc từng cán bộ</h2><span>việc đang mở theo chủ trì</span></div><div id="ptTai"></div></section>
            <section class="tam"><div class="tam-dau"><h2>Việc của Trưởng phòng</h2></div><div class="muc" id="ptCuaToi"></div></section>
          </aside>
        </div>`;
      datNapLai(loadPhongToi);
      openDieuHanh();
    },
    reload() { openDieuHanh(); },
  });
}
