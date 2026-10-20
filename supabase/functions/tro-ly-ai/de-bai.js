// Đề bài (lời dặn + lược đồ JSON) gửi trợ lý AI (v3.25): đọc văn bản giao việc → điền biểu mẫu Giao việc; soạn quy tắc nhận diện mục tiêu then chốt.
// Lược đồ hợp cả Claude (output_config.format) lẫn chuẩn OpenAI strict: mọi đối tượng additionalProperties false, mọi khoá bắt buộc, giá trị chưa biết
// = chuỗi rỗng, mã danh mục là enum (kèm ''). Không dùng ràng buộc độ dài / số (Claude không nhận). Thuần — unit test frontend/tests/tro-ly-ai.test.mjs.

export const LOAI_VAN_BAN = [['KL_BTV', 'Kết luận Hội nghị Ban Thường vụ'], ['TB_THUONG_TRUC', 'Thông báo của Thường trực Tỉnh ủy'],
  ['KL_BCH', 'Kết luận Ban Chấp hành Đảng bộ tỉnh'], ['NQ_BCH', 'Nghị quyết Ban Chấp hành Đảng bộ tỉnh'], ['NQ_TW', 'Nghị quyết Trung ương'],
  ['CONG_VAN', 'Công văn'], ['KHAC', 'Văn bản khác']];
export const TOI_DA_KY_TU = 120000;

const s = { type: 'string' };
const e = (ds) => ({ type: 'string', enum: ['', ...new Set(ds)] });
const obj = (props) => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });
const truong = (gt = s) => obj({ gia_tri: gt, trich: s });

// dm: { loai: [mã], sanPham, loaiThoiHan, nganh, linhVuc: [mã], coQuanTrinh: [mã], mucTieu: [mã] }. v3.27 (chủ dự án 20/10/2026): mục tiêu then chốt tạm
// ẩn — danh mục mục tiêu rỗng (csdl.js) thì lược đồ không có các khoá mục tiêu (lời nhắc ngắn hơn, ít token hơn); thêm cơ quan/đơn vị trình (cột G bảng Phụ lục).
export function luocDoDocVanBan(dm) {
  const coMt = (dm.mucTieu || []).length > 0;
  const mt = { type: 'array', items: obj({ ma: e(dm.mucTieu || []), trich: s, ly_do: s }) };
  return obj({
    van_ban: obj({ loai: truong(e(dm.loai)), so_hieu: truong(), ngay_ban_hanh: truong(), trich_yeu: truong(), so_hoi_nghi: truong(), co_quan_ban_hanh: truong() }),
    nhiem_vu: { type: 'array', items: obj({ noi_dung: s, trich: s, don_vi_chu_tri: s, don_vi_phoi_hop: s, han: s, trich_han: s,
      loai_thoi_han: e(dm.loaiThoiHan), san_pham: e(dm.sanPham), mo_ta_san_pham: s, nganh: e(dm.nganh), linh_vuc: e(dm.linhVuc), co_quan_trinh: e(dm.coQuanTrinh || []),
      ...(coMt ? { muc_tieu: mt } : {}) }) },
    ...(coMt ? { muc_tieu_van_ban: mt, van_ban_nhac_toi: { type: 'array', items: obj({ so_hieu: s, ten: s, trich: s }) } } : {}),
  });
}

// Đợt sửa gộp 18/10/2026 (chủ dự án: "dùng AI đọc văn bản để đề xuất nhiệm vụ cần phải hiểu văn bản và tách nhiệm vụ chính xác nhất có thể"): thêm quy
// tắc phần đầu văn bản (3), tách nhiệm vụ (4a–d), chép trọn câu kể cả thời hạn (5), quy đổi thời hạn (7) — máy chủ kiểm lại từng quy tắc (xac-minh.js).
export const heThongDoc = (coMt = true) => `Đồng chí là trợ lý đọc văn bản của Văn phòng Tỉnh ủy Cao Bằng. Việc cần làm: đọc văn bản giao việc (kết luận, thông báo, nghị quyết, công văn…) và tách thông tin để điền biểu mẫu giao nhiệm vụ. Hệ thống đối chiếu từng giá trị với chữ của tệp; giá trị không khớp nguyên văn phải nhập tay, nên chép chính xác quan trọng hơn viết gọn. Quy tắc bắt buộc:
1. Chỉ dùng thông tin có trong văn bản; không suy đoán, không bổ sung. Không có thì để chuỗi rỗng "".
2. Mọi "trich" chép NGUYÊN VĂN một đoạn liền mạch có trong văn bản: giữ nguyên chữ, dấu, số, ký hiệu (%, /, -); không sửa chính tả, không dùng "…" để lược bớt, không ghép hai đoạn cách xa nhau; chọn đoạn ngắn nhất đủ để đối chiếu.
3. Phần đầu văn bản (trang 1): "so_hieu" lấy ở dòng "Số …" của chính văn bản (không lấy số hiệu văn bản được nhắc tới); "ngay_ban_hanh" (YYYY-MM-DD) lấy ở dòng "<địa danh>, ngày … tháng … năm …" cạnh số hiệu, "trich" là chính dòng đó; "loai" theo tên loại viết hoa (KẾT LUẬN, THÔNG BÁO, NGHỊ QUYẾT…) và cơ quan ban hành ở dòng liền sau, "trich" = dòng tên loại và dòng liền sau; "trich_yeu" chép nguyên văn dòng trích yếu (dòng "về …" dưới tên loại, hoặc dòng "V/v …" của công văn); "so_hoi_nghi" là số sau "lần thứ" của hội nghị ban hành văn bản.
4. Tách nhiệm vụ: đọc hết văn bản, kể cả bảng, phụ lục, mục "tổ chức thực hiện", câu giao việc nằm giữa đoạn nhận định. Mỗi nhiệm vụ là một việc cụ thể giao cho một cơ quan, đơn vị chủ trì:
 a) Một câu giao nhiều việc có thời hạn hoặc sản phẩm khác nhau → mỗi việc một nhiệm vụ; các việc chung một thời hạn, một sản phẩm trong cùng một ý → một nhiệm vụ.
 b) Một việc giao cho nhiều cơ quan ngang nhau, không nêu ai chủ trì → mỗi cơ quan một nhiệm vụ (cùng "noi_dung"); có nêu chủ trì → một nhiệm vụ, các cơ quan còn lại là phối hợp.
 c) Câu dẫn giao việc kết thúc bằng dấu hai chấm rồi liệt kê các việc (a), b), -, 1., …) → mỗi việc là một nhiệm vụ: "noi_dung" = câu dẫn (chép nguyên văn, giữ dấu hai chấm) + một khoảng trắng + việc đó (chép nguyên văn, bỏ ký hiệu đầu dòng). Các ý chỉ là nội dung, yêu cầu của cùng một việc (ví dụ "…, trong đó tập trung:") → một nhiệm vụ gồm câu dẫn và các ý.
 d) Không đưa vào nhiệm vụ: phần đánh giá kết quả, chủ trương chung không giao cho ai, câu dẫn không kèm việc cụ thể, phần "nơi nhận".
5. "noi_dung": chép NGUYÊN VĂN trọn câu hoặc trọn ý giao nhiệm vụ, kể cả phần sản phẩm, báo cáo, thời hạn ở cuối câu; không cắt giữa câu, không viết lại, không tóm tắt (được bỏ số thứ tự, gạch đầu dòng ở đầu). "trich" của nhiệm vụ = câu hoặc đoạn ngắn nhất chứa trọn nhiệm vụ đó.
6. "don_vi_chu_tri": cơ quan, đơn vị được giao chủ trì đúng như văn bản ghi; "don_vi_phoi_hop": chép nguyên văn các đơn vị phối hợp nêu trong chính nhiệm vụ đó (cách nhau bằng dấu ;). Không có thì "".
7. "han" (YYYY-MM-DD) chỉ khi văn bản nêu thời hạn cho chính nhiệm vụ đó (trong câu giao việc hoặc dòng thời hạn ngay sau): nêu ngày cụ thể → đúng ngày đó; "quý I…IV/năm" → ngày cuối quý; "tháng M/năm" → ngày cuối tháng; "6 tháng đầu năm" → 30/6; "6 tháng cuối năm", "trong năm", "cuối năm" → 31/12; "trước tháng M/năm" → ngày cuối tháng liền trước, "trước quý …" → ngày cuối quý liền trước, "trước năm N" → 31/12 năm N-1 (hệ thống để người giao xác nhận); "thường xuyên", "hằng năm", "hằng quý" hoặc không nêu → "". "trich_han": chép nguyên văn cụm nêu thời hạn.
8. Mã danh mục (loai, loai_thoi_han, san_pham, nganh, linh_vuc, co_quan_trinh${coMt ? ', muc_tieu' : ''}) chỉ được chọn trong danh mục kèm theo; không chắc thì "". "co_quan_trinh": cơ quan, đơn vị đã trình nội dung dẫn tới nhiệm vụ (tờ trình, báo cáo, công văn, đề án "của …" nêu ngay trong nhiệm vụ đó); không nêu thì "".${coMt ? `
9. "muc_tieu": chỉ chọn khi nội dung nhiệm vụ trực tiếp phục vụ mục tiêu đó; "trich" là cụm trong văn bản làm căn cứ; "ly_do" một câu ngắn. "muc_tieu_van_ban": mục tiêu mà toàn bộ văn bản phục vụ.
10. "van_ban_nhac_toi": các nghị quyết, chương trình, kết luận, chỉ thị được văn bản nhắc tới bằng số hiệu (ví dụ 57-NQ/TW), kèm tên hoặc nội dung đúng như văn bản ghi; không tính số hiệu của chính văn bản.` : ''}`;
export const HE_THONG_DOC = heThongDoc(true);

// dmDay: danh mục đầy đủ để AI chọn mã — { loai: [[ma, ten]], sanPham: [{ma, ten}], loaiThoiHan, nganh, linhVuc: [{ma, nganh_ma, ten}], mucTieu: [{ma, nhom, ten, mo_ta}] }
export function noiDungDoc(dmDay, chu, tenTep, coAnh) {
  const ds = (ten, rows) => `${ten}:\n${rows.join('\n')}`;
  const dong = (r) => `${r.ma} = ${r.ten}`;
  const danhMuc = [
    ds('Loại văn bản', dmDay.loai.map(([ma, ten]) => `${ma} = ${ten}`)),
    ds('Sản phẩm đầu ra', dmDay.sanPham.map(dong)), ds('Loại thời hạn', dmDay.loaiThoiHan.map(dong)), ds('Ngành', dmDay.nganh.map(dong)),
    ds('Lĩnh vực (mã = tên — ngành)', dmDay.linhVuc.map((l) => `${l.ma} = ${l.ten} — ${l.nganh_ma}`)),
    ...((dmDay.coQuanTrinh || []).length ? [ds('Cơ quan/đơn vị trình', dmDay.coQuanTrinh.map(dong))] : []),
    ...((dmDay.mucTieu || []).length ? [ds('Mục tiêu then chốt (mã = tên — nhóm — nội dung)', dmDay.mucTieu.map((m) => `${m.ma} = ${m.ten} — ${m.nhom}${m.mo_ta ? ` — ${m.mo_ta}` : ''}`))] : []),
  ].join('\n\n');
  const than = chu ? `VĂN BẢN (tệp "${tenTep}"):\n${String(chu).slice(0, TOI_DA_KY_TU)}`
    : `VĂN BẢN (tệp "${tenTep}") là ảnh chụp các trang đính kèm${coAnh ? '' : ' (không có)'}; đọc chữ trên ảnh.`;
  return `DANH MỤC\n${danhMuc}\n\n${than}`;
}

export const luocDoQuyTac = () => obj({ tu_khoa: { type: 'array', items: obj({ gia_tri: s, ly_do: s }) }, loai_tru: { type: 'array', items: obj({ gia_tri: s, ly_do: s }) } });
export const HE_THONG_QUY_TAC = `Đồng chí giúp Văn phòng Tỉnh ủy Cao Bằng xây dựng quy tắc nhận diện để hệ thống tự gợi ý "mục tiêu then chốt" (nội dung đột phá, chương trình trọng tâm, nghị quyết, chỉ tiêu) cho từng nhiệm vụ. Hệ thống so khớp không dấu, theo nguyên cụm từ, trên trích yếu văn bản giao việc, nội dung nhiệm vụ và mô tả sản phẩm. Yêu cầu:
1. "tu_khoa": tối đa 12 cụm từ tiếng Việt có dấu, 2–6 từ, đặc trưng của mục tiêu và thường xuất hiện trong nội dung nhiệm vụ; mỗi cụm kèm "ly_do" ngắn.
2. Tránh cụm chung chung xuất hiện ở nhiều loại nhiệm vụ (triển khai, thực hiện, nâng cao, tăng cường, công tác, cán bộ, chỉ đạo, báo cáo, kế hoạch, nhiệm vụ, phát triển kinh tế – xã hội…).
3. "loai_tru": tối đa 5 cụm từ mà khi có mặt thì nhiệm vụ không thuộc mục tiêu dù khớp từ khoá (để tránh nhầm với mục tiêu gần nghĩa).
4. Không lặp lại quy tắc đã có; dựa vào tên, nội dung, căn cứ của mục tiêu và các ví dụ nhiệm vụ kèm theo (nếu có): nhiệm vụ đang tính mục tiêu này, nhiệm vụ người giao đã bỏ gợi ý.`;
export function noiDungQuyTac(dl) {
  const m = dl.muc_tieu || {};
  const q = (dl.quy_tac || []).map((x) => `- ${x.loai}: ${x.gia_tri} (${x.trang_thai}, ${x.muc}; hiện ${x.hien}, nhận ${x.nhan}, bỏ ${x.bo})`).join('\n') || '(chưa có)';
  const vd = (ds) => (ds || []).map((v) => `- ${[v.trich_yeu && `Văn bản: ${v.trich_yeu}`, v.noi_dung && `Nhiệm vụ: ${v.noi_dung}`, v.quy_tac && `(gợi ý theo "${v.quy_tac}" bị ${v.ket_qua === 'BO' ? 'bỏ' : 'không chọn'})`].filter(Boolean).join(' | ')}`).join('\n') || '(không có)';
  return `MỤC TIÊU: ${m.ten}${m.so_hieu ? ` (${m.so_hieu})` : ''}\nNhóm: ${m.nhom}\nNội dung: ${m.mo_ta || '(không ghi)'}\nCăn cứ: ${m.can_cu || '(không ghi)'}${m.chi_tieu ? `\nChỉ tiêu: ${m.chi_tieu}` : ''}\n\nQUY TẮC ĐÃ CÓ:\n${q}\n\nNHIỆM VỤ ĐANG TÍNH MỤC TIÊU NÀY:\n${vd(dl.viec_dung)}\n\nNHIỆM VỤ ĐÃ BỎ GỢI Ý:\n${vd(dl.viec_bo)}`;
}
// Kết quả soạn quy tắc → danh sách cho ai_ghi_quy_tac (CSDL kiểm giá trị, tự kiểm, bỏ trùng).
export const dsQuyTac = (kq) => [...(kq?.tu_khoa || []).slice(0, 12).map((x) => ({ loai: 'TU_KHOA', gia_tri: String(x?.gia_tri || '').trim() })),
  ...(kq?.loai_tru || []).slice(0, 5).map((x) => ({ loai: 'LOAI_TRU', gia_tri: String(x?.gia_tri || '').trim() }))].filter((x) => x.gia_tri && x.gia_tri.length <= 120);
