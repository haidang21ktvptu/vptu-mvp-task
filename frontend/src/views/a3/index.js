// View A3 — Chuyên viên (GĐ14): "Nhiệm vụ của tôi" = màn hình Nhiệm vụ dùng chung với bộ lọc "việc của tôi" (Owner hoặc
// người theo dõi = tôi; RLS đã giới hạn A3 đúng phạm vi đó). Modal bắt buộc tiếp nhận (GV-5) chỉ với việc theo_1400 = true
// đang mở chưa xác nhận; 185 việc cũ chỉ có chip + nút xác nhận tuỳ chọn trên danh sách.
import { state } from '../../lib/state.js';
import { registerView } from '../registry.js';
import { openKl } from '../shared/kl/index.js';
import { setKlSauKhiNap } from '../shared/kl/danh-sach.js';
import { mountAcceptModal, kiemTraNhanViec } from './accept-modal.js';

const cuaToi = () => ({ cuaToi: state.user.id });

export function registerA3View() {
  mountAcceptModal();
  registerView('A3', {
    nav: [],
    init() {
      // Sau mỗi lần danh sách nạp (kể cả realtime): việc theo 1400 mới giao mà chưa xác nhận → modal bắt buộc.
      setKlSauKhiNap((rows) => { if (state.user?.role_group === 'A3') kiemTraNhanViec(rows); });
      openKl(cuaToi());
    },
    reload() { openKl(cuaToi()); },
  });
}
