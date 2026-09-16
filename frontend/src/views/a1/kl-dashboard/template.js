// Markup Dashboard của Lãnh đạo Văn phòng / Trưởng phòng (GĐ10 PR 10C; GĐ15 điều hành ngoại lệ): hàng 0 chỉ đạo Thường trực (GĐ19, CH-16), hàng 1 bảng ngoại lệ
// 4 trường (CN-5.2), hàng 2 tình hình chung (ô số), hàng 3 theo Owner (đơn vị) + hội nghị, hàng 3c theo người theo dõi (ghi
// riêng, CH-2), hàng 4 ngành → lĩnh vực, cuối trang chất lượng số liệu. Mọi con số là nút mở danh sách với bộ lọc tương ứng.
export const klDashboardTemplate = `
  <div class="dau-trang">
    <h1>Dashboard<small>Số liệu thời gian thực trong phạm vi phụ trách của đồng chí; bấm vào bất kỳ con số nào để xem danh sách tạo nên con số đó</small></h1>
    <div class="kl-dau-phai">
      <span id="klDbTinhDen" class="chu-phu text-sm" aria-live="polite"></span>
      <span id="klDbKetNoi" class="ket-noi" role="status"></span>
      <button type="button" data-action="loadKlDashboard" class="btn btn-phu">Tải lại</button>
    </div>
  </div>

  <section class="bd-khoi hidden" id="klDbChiDaoTTKhoi" aria-labelledby="klDbH0">
    <h2 id="klDbH0" class="bd-tieu-de">Chỉ đạo Thường trực chờ phản hồi<span class="chu-phu" id="klDbH0Phu"> — Chánh Văn phòng / PCVP phụ trách phản hồi hoặc chuyển thành chỉ đạo điều hành trong hạn</span></h2>
    <div id="klDbChiDaoTT" class="bang nl-khoi"></div>
  </section>

  <section class="bd-khoi" aria-labelledby="klDbH1">
    <h2 id="klDbH1" class="bd-tieu-de">Việc cần can thiệp hôm nay<span class="chu-phu"> — chỉ việc Đỏ / Đỏ đặc biệt: ai chậm, chậm bao nhiêu ngày, thiếu sản phẩm gì, cấp nào phải quyết</span></h2>
    <div id="klDbNgoaiLe" class="bang nl-khoi"></div>
  </section>

  <section class="bd-khoi" aria-labelledby="klDbH2">
    <h2 id="klDbH2" class="bd-tieu-de">Tình hình chung</h2>
    <div id="klDbTinhHinh" class="stats stats-kl"></div>
  </section>

  <div class="bd-hai-cot">
    <section class="bang" aria-labelledby="klDbH3a">
      <div class="bang-dau"><h2 id="klDbH3a">Theo Owner (đơn vị)<span class="chu-phu">chỉ việc đang mở — đơn vị/phòng nào đang chịu trách nhiệm</span></h2></div>
      <div id="klDbOwner" class="bd-thanh"></div>
    </section>
    <section class="bang" aria-labelledby="klDbH3b">
      <div class="bang-dau"><h2 id="klDbH3b">Theo hội nghị gần nhất<span class="chu-phu">tỷ lệ hoàn thành 8 hội nghị</span></h2></div>
      <div id="klDbHoiNghi" class="bd-thanh"></div>
    </section>
  </div>

  <section class="bang mb-6" aria-labelledby="klDbH3c">
    <div class="bang-dau"><h2 id="klDbH3c">Theo người theo dõi<span class="chu-phu">ghi riêng — theo dõi không phải chịu trách nhiệm; chỉ việc đang mở</span></h2></div>
    <div id="klDbChuTri" class="bd-thanh"></div>
  </section>

  <section class="bang mb-6" aria-labelledby="klDbH4">
    <div class="bang-dau"><h2 id="klDbH4">Theo ngành và lĩnh vực<span class="chu-phu">việc chưa gán lĩnh vực xếp vào "Chưa phân loại", không bị bỏ khỏi tổng</span></h2></div>
    <div class="bang-cuon">
      <table>
        <thead><tr><th>Ngành / lĩnh vực</th><th class="so">Tổng</th><th class="so">Quá hạn</th><th class="so">Sắp hạn</th><th class="so">Cần điền hạn</th><th class="so" title="Đang làm, chờ điều kiện, thường xuyên, đang đính chính">Khác</th><th class="so">Hoàn thành</th></tr></thead>
        <tbody id="klDbNganh"></tbody>
      </table>
    </div>
  </section>

  <section class="bang" aria-labelledby="klDbH5">
    <div class="bang-dau"><h2 id="klDbH5">Chất lượng số liệu<span class="chu-phu">đo phòng theo dõi, không đo đơn vị trình — để biết con số "quá hạn" đáng tin đến đâu</span></h2></div>
    <ul id="klDbChatLuong" class="bd-chat-luong"></ul>
  </section>
`;
