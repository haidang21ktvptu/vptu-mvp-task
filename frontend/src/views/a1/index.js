// View A1 — Chánh Văn phòng / PCVP (v9: mở đầu bằng Tổng quan; màn hình "Cần xử lý" — trước là "Điều hành hôm nay"): khối chỉ đạo Thường trực chờ Văn phòng ở đầu trang (Phản hồi /
// Đôn đốc phòng tại thẻ), rồi cùng cấu trúc số-lọc + thanh trái + thẻ việc Đỏ như bản 5 trong phạm vi của mình; cuối trang minh chứng
// chờ xác nhận (một bấm). Menu: Giao việc, Nhiệm vụ, Cán bộ thuộc quyền, Báo cáo, Nhắn tin, Quản trị (cờ).
import { $, show } from '../../lib/dom.js';
import { registerView } from '../registry.js';
import { sectionDangHien } from '../shell/index.js';
import { openTongQuan } from '../shared/tong-quan/index.js';
import { khungHtml, datCauHinhDieuHanh, openDieuHanh, ngayDaiVN, dangKyDieuHanhVai } from '../shared/dieu-hanh/man-hinh.js';
import { kpiQuaHan, kpiChiDaoTT, kpiMinhChung, kpiSapHan, kpiHoanThanh } from '../shared/dieu-hanh/kpi.js';
import { minhChungChoHtml } from '../shared/dieu-hanh/minh-chung-cho.js';
import { dh, ttCho } from '../shared/dieu-hanh/du-lieu.js';
import { khoiChiDaoTTHtml } from './chi-dao-tt.js';
import { tuChoiChoHtml } from '../shared/dieu-hanh/tu-choi-cho.js';
import { canXuLyHtml, khoiThuongTrucHtml, khoiBiTuChoiHtml } from '../shared/can-xu-ly.js';
import { baCauHtml } from '../shared/dieu-hanh/ba-cau.js';
import { registerBaoCao } from './bao-cao.js';
import { registerCanBo } from '../shared/can-bo.js';

// v8 đợt 2 (mockup 03): tầng 2 dải "Cần xử lý ngay" + tấm việc Thường trực giao chờ nhận / đề nghị từ chối cần duyệt / việc mình giao bị từ chối;
// sau 5 ô số là hai cột: kết quả nộp trong 7 ngày (chính — Đợt D: không bắt buộc xử lý) và chỉ đạo Thường trực chờ trả lời (phụ 380px); rồi thanh trái + danh sách việc nghẽn.
const DAU = '<div id="dhBaCau"></div><div id="dhCanXuLy"></div><section class="tam hidden" id="dhTC"></section>';
const GIUA = `<div class="hai-cot"><section class="tam" id="dhMcKhoi"><div class="tam-dau"><h2><em class="lam" id="dhMcSo">0</em> kết quả nộp trong 7 ngày</h2><span>Nộp minh chứng là hoàn thành — đánh giá hoặc trả lại nếu chưa đạt (không bắt buộc)</span></div><div id="dhMc"></div></section>
  <aside class="tam cot-phu" id="dhTT"></aside></div>`;

function veThem() {
  $('dhBaCau').innerHTML = baCauHtml();
  $('dhCanXuLy').innerHTML = canXuLyHtml();
  const tc = khoiThuongTrucHtml() + tuChoiChoHtml() + khoiBiTuChoiHtml();
  $('dhTC').innerHTML = tc; show('dhTC', Boolean(tc));
  $('dhTT').innerHTML = khoiChiDaoTTHtml();
  $('dhTT').classList.toggle('mong', ttCho().length === 0); // 0 chỉ đạo Thường trực chờ → một dòng mảnh
  $('dhMcSo').textContent = dh.mcCho.length;
  $('dhMc').innerHTML = minhChungChoHtml();
  $('dhMcKhoi').classList.toggle('mong', dh.mcCho.length === 0);
}

export function registerA1View() {
  registerBaoCao();
  registerCanBo();
  registerView('A1', {
    init() {
      dangKyDieuHanhVai();
      $('viewDieuHanh').innerHTML = khungHtml('Cần xử lý hôm nay', `${ngayDaiVN()}, đang nạp số liệu…`, DAU, '', GIUA);
      datCauHinhDieuHanh({
        kpi: () => [kpiQuaHan(), kpiChiDaoTT('chỉ đạo của Thường trực đang chờ Văn phòng'), kpiMinhChung(), kpiSapHan(), kpiHoanThanh()],
        phuDe: () => 'mỗi thẻ đúng bốn điều: ai chậm, chậm bao nhiêu ngày, thiếu sản phẩm gì, cấp nào phải quyết — hành động ngay tại thẻ',
        veThem,
      });
      openTongQuan();
    },
    reload() { if (sectionDangHien('viewTongQuan')) openTongQuan(); else openDieuHanh(); },
  });
}
