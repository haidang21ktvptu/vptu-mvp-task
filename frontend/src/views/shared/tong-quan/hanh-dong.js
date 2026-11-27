// Hành động tại chỗ của Tổng quan (v3.24): kỳ, phạm vi, lọc nhanh, bỏ từng chip, xoá bộ lọc, mở / gập bộ lọc, cấp quyết định (điểm nghẽn), nhóm
// mục tiêu, sắp xếp / mở khối lĩnh vực, cách xếp hạng, Văn bản / Loại văn bản. Mọi hành động chỉ đổi trạng thái màn hình rồi vẽ lại (không đọc lại
// DB). v3.36 (CAU-HOI V-13): bộ lọc gập mỗi lần vào màn Tổng quan (openTongQuan đặt lại, không nhớ theo máy); mở / gập từng khối phân tích và ghi
// nhớ theo máy ở khoi-gap.js.
import { LOC_TRONG } from '../../../lib/kl/tong-quan-them.js';
import { doiNhanh } from '../../../lib/kl/tq-bo-loc.js';
import { KY } from './template.js';

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

// tq: trạng thái màn hình (index.js); ve: vẽ lại.
// v3.36 (CAU-HOI V-12): đổi kỳ / bộ lọc làm đổi số liệu → ve({ doi: true }) (số lăn, biểu đồ vẽ lại); đổi cách xem một khối thì vẽ lại ngay.
export function taoHanhDong(tq, ve) {
  const veLai = (doi = false) => { if (tq.luc) ve({ doi }); };
  const dat = (loc) => { tq.loc = loc; veLai(true); };
  return {
    tqKy: ({ ky }) => { if (KY.includes(ky)) { tq.ky = ky; dat({ ...tq.loc, tu: '', den: '' }); } },   // chọn kỳ có sẵn → bỏ kỳ tuỳ chọn
    tqLocDat: ({ k, v }) => { if (Object.hasOwn(LOC_TRONG, k)) dat({ ...tq.loc, [k]: v || '' }); },
    tqNhanh: ({ n }) => dat(doiNhanh(tq.loc, n)),
    tqChipBo: ({ k, v }) => dat(k === 'nhanh' ? doiNhanh(tq.loc, v) : k === 'ky' ? { ...tq.loc, tu: '', den: '' } : { ...tq.loc, [k]: '' }),
    tqLocBo: () => dat({ ...LOC_TRONG }),
    tqLocLoai: ({ loai }) => dat({ ...tq.loc, loai: tq.loc.loai === loai ? '' : loai }),
    tqToanBo: ({ tb }) => { tq.toanBo = tb === '1'; dat({ ...LOC_TRONG }); },   // 0103: đổi tập dòng → bỏ lọc cũ
    tqLocChiTiet: () => { tq.ui.locMo = !tq.ui.locMo; veLai(); },
    tqCap: ({ cap }) => { tq.ui.cap = cap || ''; veLai(); },
    tqTabMt: ({ tab }) => { tq.ui.tabMt = tab || 'DOT_PHA'; veLai(); },
    tqLvSap: ({ sap }) => { tq.ui.lvSap = sap === 'dm' ? 'dm' : 'qh'; veLai(); },
    tqLvMo: ({ ma }) => { const s = tq.ui.lvMo; if (s.has(ma)) s.delete(ma); else s.add(ma); veLai(); },
    tqXh: ({ cach }) => { tq.ui.xh = cach === 'tt' ? 'tt' : 'dv'; veLai(); },
    tqVbXem: ({ xem }) => { tq.ui.vbXem = xem === 'loai' ? 'loai' : 'vb'; veLai(); },
  };
}
