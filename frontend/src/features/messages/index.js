// Nhắn tin (MSG-1/2, mockup): màn hình riêng — danh bạ theo phạm vi vai trò (A0/A1 tất cả; A2 A1 + phòng mình; A3 phòng mình) xếp theo
// phòng, huy hiệu chưa đọc ở mục menu; hội thoại của việc (tin hệ thống gom theo nhiệm vụ) ở đầu danh bạ. Hội thoại ở ./chat.js.
import { supabase } from '../../lib/supabase.js';
import { $, escapeHtml } from '../../lib/dom.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { loadTinHeThong } from '../../lib/kl/dieu-hanh.js';
import { setActiveNav, showSection, setNavBadge } from '../../views/shell/index.js';
import { gomTheoViec } from '../thong-bao/index.js';
import { messagesTemplate, toastTinTemplate } from './template.js';
import { openDMChat, openViecChat, moViecTuHoiThoai, handleSendDM, closeToast, datMoNhanTin } from './chat.js';

let tuKhoa = '';
let nhomViec = [];

export async function loadDMUnreadMap() {
  const { data } = await supabase.from('direct_messages').select('sender_id').eq('receiver_id', state.user.id).eq('loai', 'nguoi').eq('is_read', false);
  state.dmUnread = {};
  let total = 0;
  (data || []).forEach((m) => { state.dmUnread[m.sender_id] = (state.dmUnread[m.sender_id] || 0) + 1; total++; });
  setNavBadge('dmBubbleBadge', total);
}

function canChatWith(a) {
  const me = state.user;
  if (a.id === me.id) return false;
  if (me.role_group === 'A0' || me.role_group === 'A1') return true; // A0 nhắn tới bất kỳ ai (0034)
  if (me.role_group === 'A2') return a.role_group === 'A1' || a.department === me.department;
  return a.department === me.department;
}
const chuCai = (ten) => (ten || '').split(' ').filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase();

function contactHtml(a) {
  const unread = state.dmUnread[a.id] || 0;
  const dang = state.currentDMPeerId === a.id;
  return `<button type="button" data-action="openDMChat" data-peer-id="${a.id}" class="ht ${dang ? 'dang' : ''}">
      <span class="av">${escapeHtml(chuCai(a.full_name))}</span>
      <span><b>${escapeHtml(a.full_name)}</b><small>${escapeHtml(a.position_title || '')} · ${escapeHtml(DEPT_NAMES[a.department] || a.department || '')}</small></span>
      ${unread > 0 ? `<span class="dem" aria-label="${unread} tin chưa đọc">${unread}</span>` : '<span></span>'}</button>`;
}
function viecHtml(g) {
  const [dau, ...con] = g.moiNhat.content.split(': ');
  return `<button type="button" data-action="openViecChat" data-nv="${g.nv}" data-ma="${escapeHtml(g.ma)}" class="ht ${state.currentDMPeerId === null && g.nv === viecDangChon ? 'dang' : ''}">
      <span class="av ht-he">NV</span><span><b>${escapeHtml(g.ma || dau)}</b><small>${escapeHtml(con.join(': ') || dau)}</small></span>
      ${g.chuaDoc ? `<span class="dem">${g.chuaDoc}</span>` : '<span></span>'}</button>`;
}
let viecDangChon = null;

export function veDanhBa() {
  const kw = tuKhoa.toLowerCase();
  const ds = state.accounts.filter((a) => canChatWith(a) && (!kw || `${a.full_name} ${DEPT_NAMES[a.department] || ''} ${a.position_title || ''}`.toLowerCase().includes(kw)))
    .sort((a, b) => (state.dmUnread[b.id] || 0) - (state.dmUnread[a.id] || 0) || (a.department || '').localeCompare(b.department || '') || a.full_name.localeCompare(b.full_name, 'vi'));
  $('dmContactList').innerHTML = ds.length ? ds.map(contactHtml).join('') : '<p class="trong-nho">Không có cán bộ phù hợp trong phạm vi liên lạc cho phép.</p>';
  const viec = nhomViec.filter((g) => g.nv && (!kw || (g.ma || '').toLowerCase().includes(kw) || g.moiNhat.content.toLowerCase().includes(kw)));
  $('dmViecList').innerHTML = viec.length ? viec.map(viecHtml).join('') : '<p class="trong-nho">Chưa có việc nào có diễn biến.</p>';
}

async function openNhanTin() {
  showSection('viewNhanTin');
  setActiveNav('dmBubbleLauncher');
  try { nhomViec = gomTheoViec(await loadTinHeThong(200)); } catch { nhomViec = []; }
  await loadDMUnreadMap();
  veDanhBa();
}

export function mountMessages() {
  $('viewNhanTin').innerHTML = messagesTemplate;
  document.body.insertAdjacentHTML('beforeend', toastTinTemplate);
  $('dmSearchContact').addEventListener('input', (e) => { tuKhoa = e.target.value.trim(); veDanhBa(); });
  datMoNhanTin(openNhanTin);
  registerActions({ openNhanTin, openDMChat, openViecChat: (ds) => { viecDangChon = ds.nv; return openViecChat(ds); }, moViecTuHoiThoai, handleSendDM, closeToast });
}
