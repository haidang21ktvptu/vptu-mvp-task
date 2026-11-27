// Tổng quan — khối phân tích mở / gập (v3.36, CAU-HOI V-13, DESIGN mục 17 "số trước, chi tiết bấm mới mở"): mặc định mọi khối gập, mỗi khối một dòng
// (tên khối, số chính); bấm tiêu đề để mở / gập; "Mở tất cả" / "Thu gọn tất cả"; nhớ theo máy (localStorage, lỗi thì chỉ nhớ trong phiên). Khối vẫn
// dựng đủ trong DOM như trước (bản in "Báo cáo nhanh", các lần vẽ lại, e2e không phụ thuộc trạng thái gập) — gập bằng thuộc tính data-gap, CSS chỉ áp
// trên màn hình (tong-quan-khoi.css). apKhoi chạy ngay sau mỗi lần vẽ (index.js ve) nên không có nhịp nào khối hiện sai trạng thái.
import { tongHopNam, ptVN } from '../../../lib/kl/giai-ngan.js';

const KHOA = 'vptu.tq.khoi';
export function docKhoiMo() {
  try { const x = JSON.parse(localStorage.getItem(KHOA) || '[]'); return new Set(Array.isArray(x) ? x.filter((i) => typeof i === 'string') : []); } catch { return new Set(); }
}
function luu(mo) {
  try { localStorage.setItem(KHOA, JSON.stringify([...mo])); } catch { /* trình duyệt chặn lưu trữ: chỉ nhớ trong phiên */ }
}
const dsKhoi = (vung) => [...vung.querySelectorAll(':scope > .luoi-tq > .the-bd[id]')];

// mo: Set id khối đang mở; so: { id khối: số chính } (bỏ trống = giữ chữ đang có).
export function apKhoi(vung, mo, so = null) {
  if (!vung) return;
  const ds = dsKhoi(vung);
  ds.forEach((a) => {
    const nut = a.querySelector(':scope > .dau-bd .khoi-mo');
    if (!nut) return;
    const dangMo = mo.has(a.id);
    a.toggleAttribute('data-gap', !dangMo); nut.setAttribute('aria-expanded', String(dangMo));
    nut.id = `${a.id}Mo`;   // id theo khối: lần vẽ lại (realtime, nạp lại nền) trả tiêu điểm về đúng nút (hanh-dong.js viTriFocus)
    const goi = a.querySelector(':scope > .dau-bd > .nut-goi');
    if (goi) goi.id = `${a.id}Goi`;
    const o = nut.querySelector('.khoi-so');
    if (so && o) o.textContent = so[a.id] || '';
  });
  const het = vung.querySelector('#tqKhoiTatCa');
  if (het) { const tatCa = ds.length > 0 && ds.every((a) => mo.has(a.id)); het.textContent = tatCa ? 'Thu gọn tất cả' : 'Mở tất cả'; het.dataset.het = tatCa ? '1' : '0'; }
}

// Số chính ghi bên phải tên khối khi gập — lấy từ chính số liệu khối sẽ vẽ (index.js ve), mỗi khối một cụm ngắn (khối không có số phù hợp thì để
// trống). Ma trận: Trưởng phòng đếm cán bộ (bỏ dòng "Phòng, chưa giao cán bộ" và dòng đơn vị khác — khoaNhom), các vai khác đếm đơn vị (bỏ dòng
// "Chưa xác định"); xếp hạng theo Thường trực bỏ dòng việc không ghi đồng chí chỉ đạo.
export function soChinhKhoi({ mt, vn, nghen, xepHang, cachXh, chuTri, linhVuc, nam, soVanBan, chiDao, chatLuong, giaiNgan, homNay, soCanBo = 0 }) {
  const gn = giaiNgan ? tongHopNam(giaiNgan, homNay) : null;
  const soDong = mt.dong.filter((d) => (vn === 'A2' ? d.ma !== 'PHONG' && !String(d.ma).startsWith('DV:') : d.ma !== '')).length;
  return {
    tqMaTran: `${soDong} ${vn === 'A2' ? 'cán bộ' : 'đơn vị'}`,
    tqNghen: nghen.length ? `${nghen.length} việc` : 'không có',
    tqXepHang: cachXh === 'tt' ? `${xepHang.filter((d) => d.ma !== 'KHONG').length} đồng chí` : `${xepHang.length} cơ quan, đơn vị`,
    tqGiaiNgan: gn?.moi && Number.isFinite(gn.muc.pt) ? `${ptVN(gn.muc.pt)} đã giải ngân` : 'chưa có số liệu',
    tqChuTri: chuTri ? `${chuTri.length} chủ trì` : '',
    tqLinhVuc: `${linhVuc.khoi.length} khối`,
    tqThang: `năm ${nam}`,
    tqVanBan: `${soVanBan} văn bản`,
    tqChiDao: `${chiDao.dangCho} đang chờ`,
    tqChatLuong: chatLuong.tyLeTot === null ? '' : `${chatLuong.tyLeTot}% đạt tốt trở lên`,
    tqNoiBo: soCanBo ? `${soCanBo} cán bộ` : '',
  };
}

// Hành động tại chỗ (đăng ký ở index.js): bấm tiêu đề một khối; mở / thu gọn tất cả. Không vẽ lại màn hình — chỉ đổi thuộc tính của khối.
// Khối vừa mở chạy hiệu ứng hiện nội dung một lần (lớp vua-mo, chuyen-dong-man.css); vẽ lại sau đó không chạy lại.
export function hanhDongKhoi(tq, vung) {
  const ap = () => { luu(tq.ui.khoiMo); apKhoi(vung(), tq.ui.khoiMo); };
  return {
    tqKhoi: (_, el) => {
      const a = el?.closest('.the-bd[id]');
      if (!a) return;
      const mo = !tq.ui.khoiMo.has(a.id);
      if (mo) tq.ui.khoiMo.add(a.id); else tq.ui.khoiMo.delete(a.id);
      ap();
      a.classList.toggle('vua-mo', mo);
      if (mo) setTimeout(() => a.classList.remove('vua-mo'), 400);
    },
    tqKhoiTatCa: (d) => { tq.ui.khoiMo = d.het === '1' ? new Set() : new Set(dsKhoi(vung()).map((a) => a.id)); ap(); },
  };
}
