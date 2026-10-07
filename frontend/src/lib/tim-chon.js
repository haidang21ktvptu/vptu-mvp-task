// Tìm nhanh trong ô chọn người (v3.17, yêu cầu 7/10/2026 mục 9): gõ vào ô tìm cạnh <select> → ẩn lựa chọn không khớp (bỏ dấu, không phân biệt
// hoa thường, khớp cả tên lẫn phòng trong nhãn), tự chọn lựa chọn khớp đầu tiên và phát change để biểu mẫu cập nhật như người dùng chọn tay.
// v3.17.1 (góp ý 7/10): đang gõ thì ô chọn mở thành DANH SÁCH chỉ còn người khớp (size) và một dòng kết quả dưới ô nói rõ "n kết quả — đang
// chọn …" / "không có ai khớp"; xoá chữ (hoặc Esc) → ô chọn trở lại dạng thả xuống, giữ lựa chọn đang có. <select> vẫn là ô giá trị thật
// (e2e selectOption, bàn phím) — ô tìm chỉ là lối tắt. Phần thuần (boDau, locLuaChon, chuKetQua) có unit test frontend/tests/tim-chon.test.mjs.

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

export const GOI_Y_TIM = 'Gõ tên hoặc phòng, không cần dấu — danh sách chỉ còn người khớp, người đầu được chọn sẵn.';
// Dòng kết quả dưới ô chọn: rỗng khi chưa gõ (đang nhập thì hiện gợi ý cách dùng); có gõ → số người khớp và người đang chọn, hoặc báo không ai khớp.
export function chuKetQua(hien, chuoi, tenChon = '') {
  const q = String(chuoi || '').trim();
  if (!q) return '';
  if (!hien) return `Không ai khớp "${q}" — thử gõ ít chữ hơn.`;
  return `${hien} người khớp${tenChon ? ` — đang chọn: ${tenChon}` : ''}. Bấm tên khác để đổi, xoá chữ để xem đủ.`;
}

// Gắn ô tìm vào <select>: lọc khi gõ, tự chọn khớp đầu (phát change), mở danh sách + dòng kết quả. Gọi apLai() sau khi <select> được vẽ lại
// (innerHTML) để giữ bộ lọc và danh sách đang mở.
export function ganTimChon(input, select) {
  if (!input || !select) return { apLai: () => {} };
  const kq = document.createElement('small'); kq.className = 'gv-tim-kq'; kq.setAttribute('aria-live', 'polite');
  select.insertAdjacentElement('afterend', kq);
  const ve = () => {
    const { hien, dau } = locLuaChon(select, input.value);
    const q = input.value.trim();
    if (q && hien) { // danh sách mở: đủ chỗ cho lựa chọn trống + tên nhóm + người khớp, tối đa 7 dòng
      const nhom = [...select.querySelectorAll('optgroup')].filter((g) => !g.hidden).length;
      select.size = Math.min(Math.max(hien + nhom + (select.options[0]?.value ? 0 : 1), 2), 7);
    } else select.removeAttribute('size');
    const chon = select.selectedOptions[0];
    kq.textContent = chuKetQua(hien, q, chon?.value ? chon.text : '');
    return { hien, dau };
  };
  const ap = () => {
    const { dau } = locLuaChon(select, input.value);
    if (input.value.trim() && dau && select.value !== dau.value) { select.value = dau.value; select.dispatchEvent(new Event('change', { bubbles: true })); }
    ve();
  };
  input.addEventListener('input', ap);
  input.addEventListener('focus', () => { if (!input.value.trim()) kq.textContent = GOI_Y_TIM; });
  input.addEventListener('blur', () => { if (!input.value.trim()) kq.textContent = ''; });
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && input.value) { input.value = ''; ap(); } });
  select.addEventListener('change', () => { if (input.value.trim()) ve(); });   // chọn tay trong danh sách đang mở → dòng kết quả đổi theo
  return { apLai: ve };
}
