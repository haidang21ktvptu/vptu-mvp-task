// Realtime trên màn hình điều hành (PR-2a B6; dùng chung A0/A1/A2/A3): sự kiện của việc ĐÃ có trên màn hình → nạp lại riêng việc đó
// (napLaiViec, 2 truy vấn) + khối phụ theo bảng (chi_dao: chỉ đạo chờ + chỉ đạo Thường trực; minh_chung: minh chứng chờ) + ô số (1 RPC),
// rồi vẽ lại. Việc lạ (mới giao, vừa vào phạm vi), quá nhiều việc một lượt, hoặc tín hiệu không kèm việc (dự phòng 60 giây, tab quay lại,
// có mạng lại) → nạp cả màn. Realtime chỉ là bổ sung: sau thao tác ghi và mỗi lần chuyển menu màn hình vẫn tự nạp lại (quy tắc 17/9).
import { dh, timRow, napSoLieu } from './du-lieu.js';
import { loadChiDaoTT, loadChiDaoCho, loadMinhChungCho } from '../../../lib/kl/dieu-hanh.js';
import { napLaiViec } from '../kl/nap-lai-viec.js';
import { locTheoViec, laNgoaiPhamVi } from '../../../lib/kl/pham-vi.js';

const TOI_DA_VIEC = 5;

export async function dieuHanhTheoSuKien(tatCaSuKien, napCa, ve) {
  const suKien = tatCaSuKien.filter((e) => !(e.bang !== 'nhiem_vu' && e.id && laNgoaiPhamVi(e.id)));   // 0103: chỉ đạo / minh chứng việc chỉ xem
  if (tatCaSuKien.length && !suKien.length) return undefined;
  const ids = [...new Set(suKien.map((e) => e.id))];
  // 0103: việc đã biết là ngoài phạm vi (cấu hình xem toàn bộ — sự kiện của mọi việc tới đây) → nạp lại riêng việc đó (vừa vào phạm vi thì thêm), không nạp cả màn.
  if (!suKien.length || ids.length > TOI_DA_VIEC || !ids.every((id) => id && (timRow(id) || laNgoaiPhamVi(id)))) return napCa();
  const bang = new Set(suKien.map((e) => e.bang));
  try {
    await Promise.all([
      ...ids.map((id) => napLaiViec(id, { nemLoi: true, veLai: false })),
      napSoLieu(),
      bang.has('chi_dao') ? Promise.all([loadChiDaoTT(), loadChiDaoCho()]).then(([tt, cd]) => { dh.chiDaoTT = tt; dh.chiDaoCho = locTheoViec(cd, dh.rows); }) : null,
      bang.has('minh_chung') ? loadMinhChungCho().then((mc) => { dh.mcCho = locTheoViec(mc, dh.rows); }) : null,
    ]);
    dh.luc = new Date();
    ve();
  } catch { return napCa(); }
  return undefined;
}
