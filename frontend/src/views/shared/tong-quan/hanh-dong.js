// Hành động tại chỗ của Tổng quan (v3.24): kỳ, phạm vi, lọc nhanh, bỏ từng chip, xoá bộ lọc, mở / gập bộ lọc chi tiết, cấp quyết định (khối 1), nhóm
// mục tiêu (khối 2), sắp xếp / mở khối lĩnh vực (khối 3), cách xếp hạng (khối 4), Văn bản / Loại văn bản (khối 6), mở / gập khối 9. Mọi hành động chỉ
// đổi trạng thái màn hình rồi vẽ lại (không đọc lại DB). Ghi nhớ theo máy (localStorage, lỗi thì bỏ qua): bộ lọc chi tiết mở / gập, khối 9 mở / gập.
import { LOC_TRONG } from '../../../lib/kl/tong-quan-them.js';
import { doiNhanh } from '../../../lib/kl/tq-bo-loc.js';
import { KY } from './template.js';

const KHOA_UI = 'vptu.tq.ui';
export function docUi() {
  try {
    const x = JSON.parse(localStorage.getItem(KHOA_UI) || 'null');
    return x && typeof x === 'object' ? { locMo: x.locMo === true, noiBo: typeof x.noiBo === 'boolean' ? x.noiBo : null } : {};
  } catch { return {}; }
}
function luuUi(ui) {
  try { localStorage.setItem(KHOA_UI, JSON.stringify({ locMo: ui.locMo, noiBo: ui.noiBo })); } catch { /* trình duyệt chặn lưu trữ: chỉ nhớ trong phiên */ }
}

// Phần tử đang có tiêu điểm trong vùng → bộ chọn để tìm lại sau khi vẽ lại innerHTML: id, không có thì data-action + các data-* nhận diện nút.
const KHOA_FOCUS = ['id', 'n', 'k', 'v', 'ma', 'tab', 'sap', 'cach', 'xem', 'cap', 'ky', 'tb', 'loai'];
export function viTriFocus(vung) {
  const a = document.activeElement;
  if (!a || !vung?.contains(a) || a === vung) return '';
  if (a.id) return `#${CSS.escape(a.id)}`;
  const khoa = KHOA_FOCUS.filter((k) => a.dataset[k] !== undefined);
  if (!a.dataset.action || !khoa.length) return '';   // nút chỉ có data-ct (bấm-xem) không phân biệt được → bỏ, như trước
  return `[data-action="${CSS.escape(a.dataset.action)}"]${khoa.map((k) => `[data-${k}="${CSS.escape(a.dataset[k])}"]`).join('')}`;
}

// tq: trạng thái màn hình (index.js); ve: vẽ lại; noiBoMo(): khối 9 đang mở (mặc định theo vai khi người xem chưa chọn).
export function taoHanhDong(tq, ve, noiBoMo) {
  const veLai = () => { if (tq.luc) ve(); };
  const dat = (loc) => { tq.loc = loc; veLai(); };
  return {
    tqKy: ({ ky }) => { if (KY.includes(ky)) { tq.ky = ky; dat({ ...tq.loc, tu: '', den: '' }); } },   // chọn kỳ có sẵn → bỏ kỳ tuỳ chọn
    tqLocDat: ({ k, v }) => { if (Object.hasOwn(LOC_TRONG, k)) dat({ ...tq.loc, [k]: v || '' }); },
    tqNhanh: ({ n }) => dat(doiNhanh(tq.loc, n)),
    tqChipBo: ({ k, v }) => dat(k === 'nhanh' ? doiNhanh(tq.loc, v) : k === 'ky' ? { ...tq.loc, tu: '', den: '' } : { ...tq.loc, [k]: '' }),
    tqLocBo: () => dat({ ...LOC_TRONG }),
    tqLocLoai: ({ loai }) => dat({ ...tq.loc, loai: tq.loc.loai === loai ? '' : loai }),
    tqToanBo: ({ tb }) => { tq.toanBo = tb === '1'; dat({ ...LOC_TRONG }); },   // 0103: đổi tập dòng → bỏ lọc cũ
    tqLocChiTiet: () => { tq.ui.locMo = !tq.ui.locMo; luuUi(tq.ui); veLai(); },
    tqCap: ({ cap }) => { tq.ui.cap = cap || ''; veLai(); },
    tqTabMt: ({ tab }) => { tq.ui.tabMt = tab || 'DOT_PHA'; veLai(); },
    tqLvSap: ({ sap }) => { tq.ui.lvSap = sap === 'dm' ? 'dm' : 'qh'; veLai(); },
    tqLvMo: ({ ma }) => { const s = tq.ui.lvMo; if (s.has(ma)) s.delete(ma); else s.add(ma); veLai(); },
    tqXh: ({ cach }) => { tq.ui.xh = cach === 'tt' ? 'tt' : 'dv'; veLai(); },
    tqVbXem: ({ xem }) => { tq.ui.vbXem = xem === 'loai' ? 'loai' : 'vb'; veLai(); },
    tqNoiBo: () => { tq.ui.noiBo = !noiBoMo(); luuUi(tq.ui); veLai(); },
  };
}
