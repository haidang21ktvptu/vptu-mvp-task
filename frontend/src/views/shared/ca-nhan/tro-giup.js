// Trang Trợ giúp: hướng dẫn ngắn theo vai (mở từ bánh răng). Nội dung tĩnh, tiếng Việt; phần chung cho mọi vai ở cuối.
const CHUNG = `
  <h3>Dải nhận diện</h3>
  <ul><li><b>Tìm</b> (kính lúp): gõ mã việc (NV-…) hoặc vài từ trong nội dung, Enter để mở danh sách nhiệm vụ đã lọc.</li>
  <li><b>Chuông</b>: số thông báo hệ thống chưa đọc (chỉ đạo, minh chứng, cảnh báo) gom theo từng việc; bấm một dòng để mở đúng việc, hoặc "Đánh dấu đã đọc".</li>
  <li><b>Bánh răng</b>: hồ sơ cá nhân (ảnh, điện thoại), đổi mật khẩu, tuỳ chọn thông báo, trợ giúp và Đăng xuất.</li></ul>
  <h3>Mật khẩu</h3>
  <p>Mật khẩu mới phải có tối thiểu 8 ký tự, gồm cả chữ và số, khác mật khẩu tạm. Quên mật khẩu: liên hệ quản trị hệ thống (Phòng Chuyển đổi số – Cơ yếu) để được cấp mật khẩu tạm mới.</p>`;

const THEO_VAI = {
  A0: `<h3>Thường trực Tỉnh ủy</h3>
    <ul><li><b>Trung tâm điều hành</b>: việc Đỏ cần quyết, chỉ đạo đang chờ Văn phòng phản hồi, đề nghị từ chối chờ duyệt.</li>
    <li><b>Giao việc</b>: giao thẳng cho Chánh Văn phòng (ưu tiên Thường trực, có thể Hỏa tốc).</li>
    <li><b>Chỉ đạo đã gửi</b>: theo dõi phản hồi từng chỉ đạo. <b>Bản gọn</b> (bánh răng): ẩn xu hướng và thanh trái để đọc nhanh trên điện thoại.</li></ul>`,
  A1: `<h3>Lãnh đạo Văn phòng</h3>
    <ul><li><b>Điều hành hôm nay</b>: việc Đỏ trong phạm vi phụ trách, chỉ đạo Thường trực chờ mình, đề nghị từ chối chờ duyệt.</li>
    <li><b>Giao việc</b> ba bước: văn bản → nội dung, Owner, hạn → xác nhận. Người nhận phải bấm "Đã nhận" (Hỏa tốc: trong 2 giờ làm việc).</li>
    <li><b>Phân công phụ trách</b> (Chánh Văn phòng, bánh răng): Phó Chánh Văn phòng phụ trách phòng nào, hiệu lực theo ngày. <b>Ngưỡng cảnh báo</b>: số ngày "sắp đến hạn", hạn phản hồi mặc định…</li></ul>`,
  A2: `<h3>Trưởng phòng</h3>
    <ul><li><b>Phòng tôi hôm nay</b>: việc của phòng theo khâu, việc Đỏ cần quyết, đề nghị từ chối của chuyên viên chờ duyệt.</li>
    <li><b>Giao việc trong phòng</b>: giao cho chuyên viên phòng mình; theo dõi xác nhận nhận việc và minh chứng.</li>
    <li><b>Ủy quyền giao việc</b> (bánh răng): khi đi vắng, cấp quyền nhập/sửa nhiệm vụ có hạn (tối đa 90 ngày) cho một chuyên viên trong phòng; thu lại bất cứ lúc nào.</li></ul>`,
  A3: `<h3>Chuyên viên</h3>
    <ul><li><b>Việc của tôi</b>: việc mới cần bấm "Đã nhận", việc sắp đến hạn / quá hạn, chỉ đạo cần phản hồi.</li>
    <li>Mở một việc → cập nhật tiến độ, nộp minh chứng (số hiệu văn bản hoặc tệp), phản hồi chỉ đạo; đề nghị từ chối khi không đúng phạm vi (Trưởng phòng duyệt).</li>
    <li><b>Việc tôi theo dõi</b>: việc mình là người theo dõi nhưng Owner là đơn vị khác.</li></ul>`,
};

export const troGiupHtml = (roleGroup) => (THEO_VAI[roleGroup] || '') + CHUNG;
