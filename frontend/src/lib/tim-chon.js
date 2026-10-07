// Tìm nhanh trong ô chọn người (v3.17, yêu cầu 7/10/2026 mục 9): gõ vào ô tìm cạnh <select> → ẩn lựa chọn không khớp (bỏ dấu, không phân biệt
// hoa thường, khớp cả tên lẫn phòng trong nhãn), tự chọn lựa chọn khớp đầu tiên và phát change để biểu mẫu cập nhật như người dùng chọn tay;
// xoá chữ → hiện lại tất cả, giữ lựa chọn đang có. <select> vẫn là ô giá trị thật (e2e selectOption, bàn phím) — ô tìm chỉ là lối tắt.
// Phần lọc (boDau, locLuaChon) thuần, có unit test frontend/tests/tim-chon.test.mjs.

export const boDau = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

// Ẩn/hiện lựa chọn theo chuỗi tìm; nhóm (optgroup) không còn lựa chọn nào thì ẩn. Trả về { hien, dau } — số lựa chọn khớp và lựa chọn khớp đầu.
export function locLuaChon(select, chuoi) {
  const q = boDau(chuoi).trim();
  let hien = 0; let dau = null;
  for (const o of select.options) {
    const khop = !q || !o.value ? true : boDau(o.text).includes(q);
    o.hidden = !khop;
    if (khop && o.value) { hien += 1; if (!dau) dau = o; }
  }
  for (const g of select.querySelectorAll('optgroup')) g.hidden = ![...g.children].some((o) => !o.hidden);
  return { hien, dau };
}

// Gắn ô tìm vào <select>: lọc khi gõ, tự chọn khớp đầu (phát change). Gọi apLai() sau khi <select> được vẽ lại (innerHTML) để giữ bộ lọc.
export function ganTimChon(input, select) {
  if (!input || !select) return { apLai: () => {} };
  const ap = () => {
    const { dau } = locLuaChon(select, input.value);
    if (input.value.trim() && dau && select.value !== dau.value) { select.value = dau.value; select.dispatchEvent(new Event('change', { bubbles: true })); }
  };
  input.addEventListener('input', ap);
  return { apLai: () => locLuaChon(select, input.value) };
}
