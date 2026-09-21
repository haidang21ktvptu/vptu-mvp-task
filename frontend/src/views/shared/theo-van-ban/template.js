// Màn hình "Theo văn bản" (v8 đợt 4, A0/A1): đầu trang + thanh lọc (tìm, trạng thái, mở/thu gọn tất cả, tóm tắt) + vùng cây #tvbCay
// (data-nap đặt khi nạp xong — e2e chờ). Cây do index.js vẽ: gốc .tvb-goc (văn bản + thanh tiến độ), nhánh .tvb-nhanh (nhiệm vụ, cấp 1..n theo
// nhiem_vu_cha), lá .tvb-la (minh chứng). Bộ lọc trạng thái gom theo nhom_dem của v_nhiem_vu (DB tính, frontend chỉ đặt tên).
export const LOC_TRANG_THAI = [['', 'Tất cả trạng thái'], ['QUA_HAN', 'Quá hạn'], ['SAP_DEN_HAN', 'Sắp đến hạn'], ['DANG_THUC_HIEN', 'Đang thực hiện'], ['HOAN_THANH', 'Hoàn thành']];

export const theoVanBanTemplate = `
  <div class="dau"><h1>Theo văn bản</h1><span>mỗi văn bản một cây: nhiệm vụ giao từ văn bản → việc giao tiếp xuống → minh chứng; bấm một nhánh để mở ngăn chi tiết</span></div>
  <div class="kl-loc tvb-loc">
    <label class="kl-tim"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input type="search" id="tvbTim" placeholder="Tìm số hiệu, trích yếu, mã hoặc nội dung việc" aria-label="Tìm trong cây" autocomplete="off"></label>
    <select id="tvbLoc" aria-label="Lọc theo trạng thái">${LOC_TRANG_THAI.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
    <button type="button" class="nut nho" data-action="tvbGapTatCa" data-mo="1">Mở rộng tất cả</button>
    <button type="button" class="nut nho" data-action="tvbGapTatCa" data-mo="0">Thu gọn tất cả</button>
    <span class="chu-phu" id="tvbTomTat"></span>
  </div>
  <p class="chu-phu tvb-ket-noi"><span id="tvbKetNoi" class="ket-noi" role="status"></span></p>
  <div id="tvbCay" class="tvb-cay" aria-live="polite"><p class="trong">Đang nạp cây văn bản…</p></div>
`;
