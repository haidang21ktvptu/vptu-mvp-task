// Chuyển trang (v3.36, CAU-HOI V-12; DESIGN mục 7): đổi mục thì mục cũ nhòe rồi mờ hẳn tại chỗ trong 0,2 giây, khung (thanh đầu trang, menu) đứng yên,
// mục mới hiện lần lượt (cửa vào — lib/chuyen-dong.js). showSection (shell/index.js) vẫn đổi lớp .hidden ngay như trước nên mọi chỗ hỏi "mục nào đang
// hiện" không đổi: mục cũ đã mang .hidden nhưng được giữ hiển thị thêm 0,2 giây bằng lớp dang-ra (styles/chuyen-dong.css), đặt cố định đúng chỗ đang
// đứng trong khung nhìn — mục mới vào đúng vị trí thường lệ. Đổi mục liên tiếp: kết thúc ngay lần ra đang dở. Giảm chuyển động: không làm gì.
// Không phụ thuộc nghiệp vụ (chỉ lib/chuyen-dong.js).
import { coChuyenDong, moCuaVao, dongCuaVao, dangVao, MS_VAO } from '../../lib/chuyen-dong.js';

const MS_RA = 200;
const HS_VAO_LAI = 0.75;   // vào lại một mục đã xem trong lần mở ứng dụng: cửa vào ngắn hơn (nhịp nhanh hơn — lớp vao-lai)
let ra = null;   // { el, hen }: mục đang ra
const daVao = new WeakSet();

function ketThucRa() {
  if (!ra) return;
  clearTimeout(ra.hen);
  const { el } = ra; ra = null;
  el.classList.remove('dang-ra');
  ['left', 'top', 'width', '--cd-hien'].forEach((p) => el.style.removeProperty(p));
  el.inert = false;
}

// Gọi TRƯỚC khi gắn .hidden cho mục cũ: ghi vị trí đang đứng (theo khung nhìn) để giữ nguyên chỗ trong lúc ra.
export function batDauRa(cu) {
  ketThucRa();
  if (!cu || !coChuyenDong()) return;
  const r = cu.getBoundingClientRect();
  if (!r.width || r.bottom <= 0 || r.top >= window.innerHeight) return;   // không còn phần nào trong khung nhìn
  cu.style.setProperty('--cd-hien', getComputedStyle(cu).display);
  cu.style.left = `${r.left}px`; cu.style.top = `${r.top}px`; cu.style.width = `${r.width}px`;
  cu.classList.add('dang-ra');
  cu.inert = true;
  ra = { el: cu, hen: setTimeout(ketThucRa, MS_RA + 30) };
}

// Gọi SAU khi đã đổi .hidden: đóng cửa vào của mục cũ (việc chờ của nó tự bỏ qua vì mục đã ẩn), mở cửa vào của mục mới (quay lại đúng mục đang ra:
// batDauRa đã kết thúc lần ra đó). Mục khai báo thời lượng
// cửa vào riêng bằng data-cd-ms (index.html); mặc định MS_VAO.
export function batDauVao(cu, moi) {
  if (cu) dongCuaVao(cu);
  if (!moi) return;
  const lai = daVao.has(moi); daVao.add(moi);
  const ms = Number(moi.dataset.cdMs) || MS_VAO;
  moCuaVao(moi, { ms: lai ? Math.round(ms * HS_VAO_LAI) : ms, lai });
}

// Đổi mục menu nhưng vẫn trong cùng một mục nội dung (các trang của Nhiệm vụ quý, các khu Quản trị…): không có pha ra, chỉ mở cửa vào cho nội dung sắp
// vẽ. Gọi từ setActiveNav khi mục menu đổi; showSection vừa mở cửa vào (đổi mục nội dung thật) thì bỏ qua.
export function vaoCungMuc() {
  const moi = document.querySelector('main.trang > section:not(.hidden)');
  if (moi && !dangVao(moi)) batDauVao(null, moi);
}
