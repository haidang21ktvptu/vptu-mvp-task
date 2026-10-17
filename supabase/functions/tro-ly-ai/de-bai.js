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

// dm: { loai: [mã], sanPham, loaiThoiHan, nganh, linhVuc: [mã], mucTieu: [mã] }
export function luocDoDocVanBan(dm) {
  const mt = { type: 'array', items: obj({ ma: e(dm.mucTieu), trich: s, ly_do: s }) };
  return obj({
    van_ban: obj({ loai: truong(e(dm.loai)), so_hieu: truong(), ngay_ban_hanh: truong(), trich_yeu: truong(), so_hoi_nghi: truong(), co_quan_ban_hanh: truong() }),
    nhiem_vu: { type: 'array', items: obj({ noi_dung: s, trich: s, don_vi_chu_tri: s, don_vi_phoi_hop: s, han: s, trich_han: s,
      loai_thoi_han: e(dm.loaiThoiHan), san_pham: e(dm.sanPham), mo_ta_san_pham: s, nganh: e(dm.nganh), linh_vuc: e(dm.linhVuc), muc_tieu: mt }) },
    muc_tieu_van_ban: mt,
    van_ban_nhac_toi: { type: 'array', items: obj({ so_hieu: s, ten: s, trich: s }) },
  });
}

export const HE_THONG_DOC = `Đồng chí là trợ lý đọc văn bản của Văn phòng Tỉnh ủy Cao Bằng. Việc cần làm: đọc văn bản giao việc (kết luận, thông báo, nghị quyết, công văn…) và tách thông tin để điền biểu mẫu giao nhiệm vụ. Quy tắc bắt buộc:
1. Chỉ dùng thông tin có trong văn bản; không suy đoán, không bổ sung. Không có thì để chuỗi rỗng "".
2. Mọi "trich" phải chép NGUYÊN VĂN một đoạn liền mạch có trong văn bản (giữ nguyên chữ và dấu), đủ để đối chiếu giá trị đi kèm.
3. "noi_dung" của mỗi nhiệm vụ: chép NGUYÊN VĂN câu, đoạn giao nhiệm vụ (được bỏ số thứ tự, gạch đầu dòng ở đầu), không viết lại, không tóm tắt. "trich" của nhiệm vụ = đoạn văn bản chứa nhiệm vụ đó.
4. Mỗi ý giao một cơ quan, đơn vị làm một việc cụ thể là một nhiệm vụ; không đưa phần nhận định, đánh giá chung, phần "nơi nhận" vào nhiệm vụ.
5. "don_vi_chu_tri": cơ quan, đơn vị được giao chủ trì đúng như văn bản ghi; "don_vi_phoi_hop": các đơn vị phối hợp (cách nhau bằng dấu ;). Không có thì "".
6. "han": chỉ khi văn bản nêu thời hạn cho chính nhiệm vụ đó; dạng YYYY-MM-DD (nêu quý / tháng / năm thì lấy ngày cuối quý / tháng / năm); "trich_han": chép nguyên văn cụm nêu thời hạn.
7. "ngay_ban_hanh": dạng YYYY-MM-DD theo dòng "…, ngày … tháng … năm …" của văn bản; "trich" là chính dòng đó.
8. Mã danh mục (loai, loai_thoi_han, san_pham, nganh, linh_vuc, muc_tieu) chỉ được chọn trong danh mục kèm theo; không chắc thì "".
9. "muc_tieu": chỉ chọn khi nội dung nhiệm vụ trực tiếp phục vụ mục tiêu đó; "trich" là cụm trong văn bản làm căn cứ; "ly_do" một câu ngắn. "muc_tieu_van_ban": mục tiêu mà toàn bộ văn bản phục vụ.
10. "van_ban_nhac_toi": các nghị quyết, chương trình, kết luận, chỉ thị được văn bản nhắc tới bằng số hiệu (ví dụ 57-NQ/TW), kèm tên hoặc nội dung đúng như văn bản ghi; không tính số hiệu của chính văn bản.`;

// dmDay: danh mục đầy đủ để AI chọn mã — { loai: [[ma, ten]], sanPham: [{ma, ten}], loaiThoiHan, nganh, linhVuc: [{ma, nganh_ma, ten}], mucTieu: [{ma, nhom, ten, mo_ta}] }
export function noiDungDoc(dmDay, chu, tenTep, coAnh) {
  const ds = (ten, rows) => `${ten}:\n${rows.join('\n')}`;
  const dong = (r) => `${r.ma} = ${r.ten}`;
  const danhMuc = [
    ds('Loại văn bản', dmDay.loai.map(([ma, ten]) => `${ma} = ${ten}`)),
    ds('Sản phẩm đầu ra', dmDay.sanPham.map(dong)), ds('Loại thời hạn', dmDay.loaiThoiHan.map(dong)), ds('Ngành', dmDay.nganh.map(dong)),
    ds('Lĩnh vực (mã = tên — ngành)', dmDay.linhVuc.map((l) => `${l.ma} = ${l.ten} — ${l.nganh_ma}`)),
    ds('Mục tiêu then chốt (mã = tên — nhóm — nội dung)', dmDay.mucTieu.map((m) => `${m.ma} = ${m.ten} — ${m.nhom}${m.mo_ta ? ` — ${m.mo_ta}` : ''}`)),
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
