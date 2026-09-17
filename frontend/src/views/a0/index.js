// View A0 — Thường trực Tỉnh ủy (mockup bản 5 "Trung tâm điều hành Thường trực"): 4 số-lọc (cần quyết, quá hạn theo khâu, chỉ đạo
// chờ Văn phòng, hoàn thành), thanh trái khâu/đơn vị, thẻ việc với vòng khép kín và ô chỉ đạo một dòng; "Chỉ đạo đã gửi"; "Toàn bộ
// nhiệm vụ" (màn hình dùng chung, chỉ đọc + Ý kiến/Chỉ đạo). Quyền thật: hàm 0030/0032 từ chối A0 ở mọi thao tác ghi khác.
import { $, show } from '../../lib/dom.js';
import { registerView } from '../registry.js';
import { khungHtml, datCauHinhDieuHanh, openDieuHanh, ngayDaiVN, dangKyDieuHanhVai } from '../shared/dieu-hanh/man-hinh.js';
import { kpiCanQuyet, kpiQuaHan, kpiChiDaoTT, kpiTuChoi, kpiHoanThanh } from '../shared/dieu-hanh/kpi.js';
import { canXuLyHtml, khoiBiTuChoiHtml } from '../shared/can-xu-ly.js';
import { registerChiDaoDaGui } from './chi-dao-da-gui.js';
import { registerCanBo } from '../shared/can-bo.js';

// Đầu trang (GĐ22): dải "Cần xử lý ngay" + việc Thường trực giao bị từ chối / đang đề nghị từ chối (Văn phòng giao lại).
const DAU = '<div id="dhCanXuLy"></div><section class="cau hidden" id="dhTC"></section>';
function veThem() {
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
      $('viewDieuHanh').innerHTML = khungHtml('Trung tâm điều hành Thường trực', `${ngayDaiVN()}, đang nạp số liệu…`, DAU);
      datCauHinhDieuHanh({
        kpi: () => [kpiCanQuyet('việc cần Thường trực quyết hôm nay'), kpiQuaHan(), kpiChiDaoTT('chỉ đạo đã gửi, Văn phòng chưa trả lời'), kpiTuChoi(), kpiHoanThanh()],
        phuDe: () => 'xếp theo độ khẩn, việc Thường trực giao, rồi số ngày trễ; việc cần Thường trực quyết đứng đầu',
        veThem,
      });
      openDieuHanh();
    },
    reload() { openDieuHanh(); },
  });
}
