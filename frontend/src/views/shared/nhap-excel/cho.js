// Thẻ "Chờ hoàn thiện" (v9 đợt 2): các lô nhập gần đây (mã, tệp, lúc nhập, số dòng theo kết quả, Hoàn tác trong 24 giờ) và các dòng còn thiếu thông
// tin của từng lô — Hoàn thiện (biểu mẫu Giao việc điền sẵn; giao_viec gắn việc vào dòng) hoặc Bỏ (xác nhận tại chỗ, không dùng hộp thoại trình
// duyệt). Hoàn tác: xoá việc lô tạo mà chưa ai thao tác, trả giá trị cũ cho việc lô cập nhật; việc đã có thao tác giữ lại và được báo mã.
// Hoàn thiện cần biểu mẫu Giao việc (A1/A2/quản trị nhiệm vụ); quản trị hệ thống chỉ nhập: bỏ dòng hoặc sửa tệp rồi nhập lại.
import { $, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { nhanTruong } from '../../../lib/kl/nhap/truong.js';
import { docLoVaCho, boDongCho, hoanTacLo } from '../../../lib/kl/nhap/du-lieu.js';
import { datNapTab, datSoCho, duocGiao } from './tab.js';
import { KQ, xacNhanHoanTacHtml } from './ve.js';
import { openGiaoViec } from '../giao-viec/index.js';

let du = { lo: [], cho: [] };
const conHan = (lo) => !lo.hoan_tac_luc && Date.now() - new Date(lo.tao_luc).getTime() < 24 * 3600e3
  && (lo.tao_boi === state.user?.id || Boolean(state.user?.quan_tri_he_thong));
const tomTat = (d) => escapeHtml(String(d.du_lieu?.noi_dung || Object.values(d.du_lieu_goc || {}).find((v) => String(v).length > 20) || '(không có nội dung)').slice(0, 160));

function dongHtml(d) {
  return `<div class="nx-cho-dong the-con" id="nxCho-${d.id}" data-dong="${d.so_dong}"><p><b>Dòng ${d.so_dong}</b> ${tomTat(d)}
    <span class="chu-phu">${d.thieu?.length ? ` · thiếu: ${escapeHtml(d.thieu.map(nhanTruong).join(', ').toLowerCase())}` : ''}${d.ghi_chu ? ` · ${escapeHtml(d.ghi_chu)}` : ''}</span></p>
    <div class="hanh-dong">${duocGiao(state.user) ? `<button type="button" class="nut nho chinh" data-action="nxHoanThien" data-id="${d.id}">Hoàn thiện</button>`
      : '<span class="chu-phu">Hoàn thiện bằng biểu mẫu Giao việc: chuyên viên quản trị nhiệm vụ; hoặc sửa tệp rồi nhập lại.</span>'}
      <button type="button" class="nut nho" data-action="moO" data-o="oBo-${d.id}">Bỏ dòng</button></div>
    <form class="o" id="oBo-${d.id}" data-submit="nxBoDong" data-id="${d.id}"><span>Bỏ dòng ${d.so_dong} (không tạo việc)?</span>
      <button type="submit" class="nut chinh nho">Bỏ</button><button type="button" class="nut nho" data-action="dongO" data-o="oBo-${d.id}">Huỷ</button></form></div>`;
}
function loHtml(lo) {
  const dong = du.cho.filter((d) => d.lo_id === lo.id); const so = lo.so_lieu || {};
  return `<section class="tam nx-phan nx-lo" id="nxLo-${lo.id}"><div class="tam-dau"><h2>Lô ${escapeHtml(lo.ma)}</h2>
      <span class="chu-phu">${escapeHtml(lo.ten_tep)} · ${formatDateTime(lo.tao_luc)}${lo.hoan_tac_luc ? ` · đã hoàn tác ${formatDateTime(lo.hoan_tac_luc)}` : lo.xong_luc ? '' : ' · nhập dở'}</span></div>
    <div class="nx-loc">${Object.keys(KQ).filter((k) => so[k]).map((k) => `<span class="${KQ[k][1]}">${KQ[k][0]} <b>${so[k]}</b></span>`).join('')}
      ${conHan(lo) ? `<button type="button" class="nut nho" data-action="moO" data-o="oHtCho-${lo.id}">Hoàn tác lô</button>` : ''}</div>
    ${conHan(lo) ? xacNhanHoanTacHtml(lo, 'oHtCho') : ''}
    ${!lo.xong_luc && !lo.hoan_tac_luc ? '<p class="chu-phu nx-trong">Lô nhập dở: chọn lại đúng tệp ở thẻ "Nhập từ Excel" để gửi tiếp (dòng đã nhập không bị tạo lại), hoặc hoàn tác lô.</p>' : ''}
    ${dong.length ? `<div class="muc">${dong.map(dongHtml).join('')}</div>` : '<p class="chu-phu nx-trong">Không còn dòng nào chờ hoàn thiện.</p>'}</section>`;
}
function ve() {
  const lo = du.lo.filter((x) => du.cho.some((d) => d.lo_id === x.id) || conHan(x));
  $('gvKhuCho').innerHTML = lo.length ? lo.map(loHtml).join('')
    : '<section class="tam nx-phan"><p class="chu-phu nx-trong">Không có dòng nào chờ hoàn thiện, không có lô nào còn trong 24 giờ hoàn tác.</p></section>';
}
export async function napCho() {
  if (!$('gvKhuCho').innerHTML) $('gvKhuCho').innerHTML = '<p class="chu-phu">Đang tải…</p>';
  try { du = await docLoVaCho(); datSoCho(du.cho.length); ve(); } catch (e) { $('gvKhuCho').innerHTML = `<p class="nx-loi">${escapeHtml(e.message)}</p>`; }
}

// Gửi một lần: nút gửi của hộp xác nhận mờ trong lúc chờ (bấm đúp không gửi hai lần).
async function motLan(form, fn) {
  const nut = form?.querySelector('button[type="submit"]');
  if (nut?.disabled) return; if (nut) nut.disabled = true;
  try { await fn(); } finally { if (nut) nut.disabled = false; }
}
export const hoanTacLoAction = ({ id, ma }, form) => motLan(form, async () => {
  try {
    const kq = await hoanTacLo(id);
    notifySuccess(`Đã hoàn tác lô ${ma}: ${kq.hoan_tac} dòng.${kq.giu_lai?.length ? ` Giữ lại ${kq.giu_lai.length} việc đã có thao tác hoặc không trả lại được: ${kq.giu_lai.slice(0, 8).join(', ')}.` : ''}`);
    $(`oHtKq-${id}`)?.classList.remove('mo');
    await napCho();
  } catch (e) { notifyError(`Không hoàn tác được: ${e.message}`); }
});

export function mountChoHoanThien() {
  datNapTab('cho', napCho);
  registerActions({
    nxHoanThien: ({ id }) => {
      const d = du.cho.find((x) => x.id === id); const lo = du.lo.find((x) => x.id === d?.lo_id);
      if (d) openGiaoViec({ tab: 'giao', dienSan: { id: d.id, so_dong: d.so_dong, lo_ma: lo?.ma || '', ten_tep: lo?.ten_tep || '', du_lieu: d.du_lieu, thieu: d.thieu, ghi_chu: d.ghi_chu } });
    },
    nxBoDong: ({ id }, form) => motLan(form, async () => {
      try { await boDongCho(id); notifySuccess('Đã bỏ dòng.'); await napCho(); } catch (e) { notifyError(e.message); }
    }),
  });
}
