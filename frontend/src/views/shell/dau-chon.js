// Dấu chọn menu trượt (v3.36, CAU-HOI V-12; DESIGN mục 7): một phần tử nền .menu-dau nằm trong menu dọc (#mainNav), đặt vị trí và kích thước theo mục
// đang chọn; đổi mục thì trượt sang mục mới (chuyển tiếp ở styles/chuyen-dong.css). Chưa đặt được (menu đang ẩn trên điện thoại, không có mục đang
// chọn) thì gỡ lớp co-dau: mục đang chọn tự tô nền như trước. Thu / mở nhóm, đổi cỡ chữ, đổi bề rộng màn hình: đặt lại ngay, không trượt.
// Không phụ thuộc nghiệp vụ.
export const DAU_CHON_HTML = '<span class="menu-dau" id="menuDau" aria-hidden="true"></span>';

const nav = () => document.getElementById('mainNav');
let theoDoi = null; let dangXem = null;

// ngay: đặt thẳng vào vị trí mới (không trượt) — lần đầu, thu / mở nhóm, đổi kích thước.
export function datDauChon({ ngay = false } = {}) {
  const n = nav(); const dau = n?.querySelector('.menu-dau');
  if (!n || !dau) return;
  const muc = n.querySelector('[data-nav][aria-selected="true"]');
  if (!muc || !muc.offsetWidth) { n.classList.remove('co-dau'); return; }
  if (theoDoi && dangXem !== muc) { if (dangXem) theoDoi.unobserve(dangXem); theoDoi.observe(muc); dangXem = muc; }
  const rong = `${muc.offsetWidth}px`; const cao = `${muc.offsetHeight}px`; const cho = `translate(${muc.offsetLeft}px, ${muc.offsetTop}px)`;
  const daCo = n.classList.contains('co-dau');
  if (daCo && dau.style.width === rong && dau.style.height === cao && dau.style.transform === cho) return;   // không đổi: không đụng (đang trượt thì để trượt tiếp)
  const dat = () => { dau.style.width = rong; dau.style.height = cao; dau.style.transform = cho; };
  if (ngay || !daCo) {
    dau.classList.add('dat-ngay'); dat();
    void dau.offsetWidth;   // áp vị trí trước khi bật lại chuyển tiếp
    dau.classList.remove('dat-ngay');
  } else dat();
  n.classList.add('co-dau');
}

// Gọi một lần lúc khởi động: theo dõi kích thước menu và mục đang chọn (đổi cỡ chữ, nhãn xuống dòng, số đếm hiện / ẩn), bề rộng cửa sổ, phông chữ nạp xong.
export function mountDauChon() {
  const datNgay = () => datDauChon({ ngay: true });
  if (typeof ResizeObserver === 'function') { theoDoi = new ResizeObserver(datNgay); const n = nav(); if (n) theoDoi.observe(n); }
  window.addEventListener('resize', datNgay, { passive: true });
  document.fonts?.ready?.then(datNgay).catch(() => {});
}
