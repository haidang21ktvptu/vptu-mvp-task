// View A0 — Thường trực Tỉnh ủy (v9: mở đầu bằng Tổng quan; "Cần xử lý" — trước là "Trung tâm điều hành Thường trực", mockup bản 5): ba câu hỏi
// (lọc danh sách), thanh trái khâu/đơn vị, thẻ việc với vòng khép kín và ô chỉ đạo một dòng (v3.36: bỏ dải ô số trùng Tổng quan); "Chỉ đạo đã gửi"; "Toàn bộ
// nhiệm vụ" (màn hình dùng chung, chỉ đọc + Ý kiến/Chỉ đạo). Quyền thật: hàm 0030/0032 từ chối A0 ở mọi thao tác ghi khác.
import { $, show } from '../../lib/dom.js';
import { registerView } from '../registry.js';
import { moManDau } from '../shell/duong-dan.js';
import { sectionDangHien } from '../shell/index.js';
import { openTongQuan } from '../shared/tong-quan/index.js';
import { khungHtml, datCauHinhDieuHanh, openDieuHanh, ngayDaiVN, dangKyDieuHanhVai } from '../shared/dieu-hanh/man-hinh.js';
import { canXuLyHtml, khoiBiTuChoiHtml } from '../shared/can-xu-ly.js';
import { baCauHtml } from '../shared/dieu-hanh/ba-cau.js';
import { registerChiDaoDaGui } from './chi-dao-da-gui.js';
import { registerCanBo } from '../shared/can-bo.js';
import { tenMuc } from '../../lib/kl/nhan.js';

// Đầu trang (GĐ22): dải "Cần xử lý ngay" + việc Thường trực giao bị từ chối / đang đề nghị từ chối (Văn phòng giao lại).
const DAU = '<div id="dhBaCau"></div><div id="dhCanXuLy"></div><section class="cau hidden" id="dhTC"></section>';
function veThem() {
  $('dhBaCau').innerHTML = baCauHtml();
  $('dhCanXuLy').innerHTML = canXuLyHtml();
  const b = khoiBiTuChoiHtml();
  $('dhTC').innerHTML = b; show('dhTC', Boolean(b));
}

export function registerA0View() {
  registerChiDaoDaGui();
  registerCanBo();
  registerView('A0', {
    init() {
      dangKyDieuHanhVai();
      $('viewDieuHanh').innerHTML = khungHtml('Cần xử lý hôm nay', `${ngayDaiVN()}, đang nạp số liệu…`, DAU);
      datCauHinhDieuHanh({
        phuDe: () => `xếp theo mức khẩn: độ khẩn, việc Thường trực giao, việc ${tenMuc('ddb')} trước, việc cần Thường trực quyết, rồi số ngày trễ`,
        veThem,
      });
      moManDau(openTongQuan);   // v3.29: mở chức năng theo đường dẫn (nếu thuộc vai), không thì trang đầu
    },
    reload() { if (sectionDangHien('viewTongQuan')) openTongQuan(); else openDieuHanh(); },
  });
}
