// Hội thoại (MSG-1/2): với một người = tin 1-1 (direct_messages loai = nguoi, gửi qua INSERT theo RLS, đọc qua mark_messages_read);
// với một việc = tin hệ thống về việc đó (gom, chỉ đọc, nút Mở việc). Toast báo tin mới (dùng bởi realtime).
import { supabase } from '../../lib/supabase.js';
import { $, show, setText, escapeHtml, formatTime, formatDateTime } from '../../lib/dom.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { state, findAccount } from '../../lib/state.js';
import { loadTinHeThong } from '../../lib/kl/dieu-hanh.js';
import { COT_TIN_NHAN } from '../../lib/kl/cot.js';
import { moNhiemVu } from '../../views/shared/kl/index.js';
import { sectionDangHien } from '../../views/shell/index.js';
import { loadDMUnreadMap, veDanhBa } from './index.js';

const TOAST_MS = 8000;
let viecDangMo = null; // { nv, ma }
const TIN_MOI_LAN = 50;   // B6: hội thoại 1-1 đọc 50 tin mới nhất, "Xem tin cũ hơn" thêm 50 mỗi lần
let soTinHien = TIN_MOI_LAN;

function bongHtml(m) {
  const toi = m.sender_id === state.user.id;
  return `<div class="bong ${toi ? 'toi' : ''}">${escapeHtml(m.content)}<small>${formatTime(m.created_at)}</small></div>`;
}
function bongViecHtml(t) {
  const [dau, ...con] = t.content.split(': ');
  return `<div class="bong viec"><b>${escapeHtml(dau)} · ${formatDateTime(t.created_at)}</b>${escapeHtml(con.join(': '))}</div>`;
}

export async function loadDirectMessages(peerId, markAsRead = false) {
  const me = state.user.id;
  const chatBox = $('dmChatBox');
  const { data } = await supabase.from('direct_messages').select(COT_TIN_NHAN).eq('loai', 'nguoi')
    .or(`and(sender_id.eq.${me},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${me})`)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).range(0, soTinHien);   // thêm 1 dòng để biết còn tin cũ hơn
  const conNua = (data || []).length > soTinHien;
  const tin = (data || []).slice(0, soTinHien).reverse();
  const xemThem = conNua ? '<p class="xem-them"><button type="button" class="nut nho" id="dmXemTinCu" data-action="xemTinCu">Xem tin cũ hơn</button></p>' : '';
  const giuTu = xemTinCuDangBam ? chatBox.scrollHeight - chatBox.scrollTop : 0;
  chatBox.innerHTML = tin.length === 0 ? '<p class="trong-nho">Chưa có tin nhắn nào giữa hai đồng chí.</p>' : xemThem + tin.map(bongHtml).join('');
  chatBox.scrollTop = xemTinCuDangBam ? chatBox.scrollHeight - giuTu : chatBox.scrollHeight;
  xemTinCuDangBam = false;
  if (markAsRead) {
    await supabase.rpc('mark_messages_read', { p_peer_id: peerId });
    state.dmUnread[peerId] = 0;
    loadDMUnreadMap();
  }
}

let xemTinCuDangBam = false;
export async function xemTinCu() {
  if (!state.currentDMPeerId) return;
  soTinHien += TIN_MOI_LAN; xemTinCuDangBam = true;   // giữ vị trí đọc: tin cũ chèn phía trên
  await loadDirectMessages(state.currentDMPeerId, false);
}

export async function openChatWith(peerId) {
  state.currentDMPeerId = peerId; viecDangMo = null; soTinHien = TIN_MOI_LAN;
  const peer = findAccount(peerId);
  setText('dmChatHeaderName', peer ? peer.full_name : 'Đồng chí');
  setText('dmChatHeaderRole', peer ? `${peer.position_title} · ${DEPT_NAMES[peer.department] || peer.department || ''}` : '');
  setText('dmChatHeaderPhu', '');
  show('dmGuiForm', true); show('dmMoViec', false);
  veDanhBa();
  await loadDirectMessages(peerId, true);
  $('dmInput').focus();
}
export const openDMChat = ({ peerId }) => openChatWith(peerId);

// Hội thoại của một việc: mọi tin hệ thống về việc đó (chuông đã có; ở đây đọc theo nhiệm vụ).
export async function openViecChat({ nv, ma }) {
  state.currentDMPeerId = null; viecDangMo = { nv, ma };
  setText('dmChatHeaderName', ma || 'Việc');
  setText('dmChatHeaderRole', 'hội thoại của việc: chỉ đạo, cảnh báo, phản hồi');
  show('dmGuiForm', false); show('dmMoViec', true);
  veDanhBa();
  const tin = (await loadTinHeThong(200)).filter((t) => t.nhiem_vu_id === nv).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const dau = tin[0]?.content.split(': ')[1] || '';
  setText('dmChatHeaderPhu', dau ? ` — ${dau.slice(0, 80)}` : '');
  $('dmChatBox').innerHTML = tin.length ? tin.map(bongViecHtml).join('') : '<p class="trong-nho">Chưa có diễn biến nào.</p>';
  $('dmChatBox').scrollTop = $('dmChatBox').scrollHeight;
}
export const moViecTuHoiThoai = () => { if (viecDangMo) moNhiemVu(viecDangMo.nv, viecDangMo.ma, 'chi-dao'); };

export function isChatOpenWith(peerId) {
  return state.currentDMPeerId === peerId && sectionDangHien('viewNhanTin');
}

export async function handleSendDM() {
  if (!state.currentDMPeerId) return;
  const input = $('dmInput');
  const text = input.value.trim();
  if (!text) return;
  const { error } = await supabase.from('direct_messages').insert([{ sender_id: state.user.id, receiver_id: state.currentDMPeerId, content: text, is_read: false }]);
  if (!error) { input.value = ''; await loadDirectMessages(state.currentDMPeerId, false); }
}

let toastTimer = null;
// onOpen/nhanNut: tin hệ thống dùng lại toast nhưng nút mở nhiệm vụ thay vì hội thoại.
export function showDMToast(senderName, content, senderId, onOpen = null, nhanNut = 'Mở hội thoại') {
  setText('toastSender', onOpen ? senderName : `Tin nhắn từ ${senderName}`);
  setText('toastContent', content);
  setText('toastActionBtn', nhanNut);
  $('toastActionBtn').onclick = () => { closeToast(); if (onOpen) onOpen(); else openNhanTinVoi(senderId); };
  show('realtimeToast', true);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(closeToast, TOAST_MS);
}
export function closeToast() { show('realtimeToast', false); }

// Mở màn hình Nhắn tin rồi hội thoại với một người (từ toast).
let moNhanTin = () => {};
export const datMoNhanTin = (fn) => { moNhanTin = fn; };
async function openNhanTinVoi(peerId) { await moNhanTin(); openChatWith(peerId); }
