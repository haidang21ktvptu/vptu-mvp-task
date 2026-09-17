// View A1 — Chánh Văn phòng / PCVP (mockup "Điều hành hôm nay"): khối chỉ đạo Thường trực chờ Văn phòng ở đầu trang (Phản hồi /
// Đôn đốc phòng tại thẻ), rồi cùng cấu trúc số-lọc + thanh trái + thẻ việc Đỏ như bản 5 trong phạm vi của mình; cuối trang minh chứng
// chờ xác nhận (một bấm). Menu: Giao việc, Nhiệm vụ, Cán bộ thuộc quyền, Báo cáo, Nhắn tin, Quản trị (cờ).
import { $, show } from '../../lib/dom.js';
import { registerView } from '../registry.js';
import { khungHtml, datCauHinhDieuHanh, openDieuHanh, ngayDaiVN, dangKyDieuHanhVai } from '../shared/dieu-hanh/man-hinh.js';
import { kpiQuaHan, kpiChiDaoTT, kpiMinhChung, kpiHoanThanh } from '../shared/dieu-hanh/kpi.js';
import { minhChungChoHtml } from '../shared/dieu-hanh/minh-chung-cho.js';
import { dh } from '../shared/dieu-hanh/du-lieu.js';
import { khoiChiDaoTTHtml } from './chi-dao-tt.js';
import { tuChoiChoHtml } from '../shared/dieu-hanh/tu-choi-cho.js';
import { canXuLyHtml, khoiThuongTrucHtml, khoiBiTuChoiHtml } from '../shared/can-xu-ly.js';
import { registerBaoCao } from './bao-cao.js';
import { registerCanBo } from '../shared/can-bo.js';

// Đầu trang: dải "Cần xử lý ngay" (GĐ22), việc Thường trực giao chờ xác nhận, đề nghị từ chối cần duyệt (0034), việc mình giao bị từ chối
// (chỉ hiện khi có) rồi chỉ đạo Thường trực chờ Văn phòng.
const DAU = '<div id="dhCanXuLy"></div><section class="cau hidden" id="dhTC"></section><section class="cau" id="dhTT"></section>';
const CUOI = '<section class="cau" id="dhMcKhoi"><h2><em class="lam" id="dhMcSo">0</em> minh chứng đã nộp, chờ xác nhận</h2><div id="dhMc"></div></section>';

function veThem() {
  $('dhCanXuLy').innerHTML = canXuLyHtml();
  const tc = khoiThuongTrucHtml() + tuChoiChoHtml() + khoiBiTuChoiHtml();
  $('dhTC').innerHTML = tc; show('dhTC', Boolean(tc));
  $('dhTT').innerHTML = khoiChiDaoTTHtml();
  $('dhMcSo').textContent = dh.mcCho.length;
  $('dhMc').innerHTML = minhChungChoHtml();
}

export function registerA1View() {
  registerBaoCao();
  registerCanBo();
  registerView('A1', {
    init() {
      dangKyDieuHanhVai();
      $('viewDieuHanh').innerHTML = khungHtml('Điều hành hôm nay', `${ngayDaiVN()}, đang nạp số liệu…`, DAU, CUOI);
      datCauHinhDieuHanh({
        kpi: () => [kpiQuaHan(), kpiChiDaoTT('chỉ đạo của Thường trực đang chờ Văn phòng'), kpiMinhChung(), kpiHoanThanh()],
        phuDe: () => 'mỗi thẻ đúng bốn điều: ai chậm, chậm bao nhiêu ngày, thiếu sản phẩm gì, cấp nào phải quyết — hành động ngay tại thẻ',
        veThem,
      });
      openDieuHanh();
    },
    reload() { openDieuHanh(); },
  });
}
