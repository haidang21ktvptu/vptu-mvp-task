// Nội dung Hướng dẫn sử dụng — tiếng Việt phổ thông, mỗi vai một phần, mỗi chức năng: vài bước + một ảnh.
// Ghép hai nửa (noi-dung-1.mjs, noi-dung-2.mjs) với cùng bộ đếm hình và danh sách tiêu đề cho mục lục.
import { phan1den4 } from './noi-dung-1.mjs';
import { phan5den9 } from './noi-dung-2.mjs';

export function noiDung({ A, anh, h1, h2, p, steps, bullets, luuY, bang, khoangTrong }) {
  const tieuDeMucLuc = [];
  const P1 = (ten) => { tieuDeMucLuc.push({ cap: 1, ten }); return h1(ten); };
  const P2 = (ten) => { tieuDeMucLuc.push({ cap: 2, ten }); return h2(ten); };
  let soHinh = 0;
  const hinh = (file, chu) => anh(A(file), `Hình ${++soHinh}. ${chu}`);
  const ctx = { P1, P2, hinh, p, steps, bullets, luuY, bang, khoangTrong };
  return { tieuDeMucLuc, phan: [...phan1den4(ctx), ...phan5den9(ctx)] };
}
