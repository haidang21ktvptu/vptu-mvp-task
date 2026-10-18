// Edge Function tro-ly-ai (v3.25, migration 0112): trợ lý AI — khoá API chỉ nằm trong secrets của function (AI_KEY_ANTHROPIC / AI_KEY_OPENAI /
// AI_KEY_GEMINI / AI_KEY_KHAC theo nhà cung cấp đang chọn ở cau_hinh_ai), không bao giờ tới trình duyệt. POST { hanh_dong, ... }:
//   - trang_thai: mọi tài khoản đăng nhập → { bat, nha_cung_cap, ten, mo_hinh, co_khoa, gui_noi_dung } (giao diện ẩn / hiện nút "Đọc văn bản").
//   - doc_van_ban { ten_tep, chu, anh?: [{ media, data }], so_trang }: tài khoản đang hoạt động (cả Thường trực khi giao việc) — chữ PDF đọc ở trình duyệt
//     (hoặc ảnh trang khi PDF scan) → AI tách thông tin theo lược đồ → XÁC MINH Ở ĐÂY (xac-minh.js: câu trích nguyên văn, mã danh mục) → trả về; KHÔNG lưu
//     tệp, chữ hay kết quả (nhat_ky_ai chỉ ghi số trang, số ký tự, token, thời gian).
//   - soan_quy_tac { ma }: quản trị hệ thống — AI soạn từ khoá, từ loại trừ cho một mục tiêu → ai_ghi_quy_tac (tự kiểm trên dữ liệu đã có).
//   - kiem_tra: quản trị hệ thống — một lời gọi rất ngắn để thử khoá, mô hình, địa chỉ.
//   - hoc_dem: chỉ service_role (workflow hoc-quy-tac.yml mỗi đêm) — học lại các mục tiêu ai_can_hoc; không bắt đầu lượt mới khi còn dưới 35 giây
//     của giới hạn 150 giây (mỗi lượt có hạn riêng), phần còn lại học đêm sau.
// Giới hạn lượt / ngày theo cau_hinh_ai: ai_giu_luot giữ lượt TRƯỚC khi gọi AI (khoá tư vấn — yêu cầu đồng thời không vượt), ai_xong_luot ghi kết quả
// (cả token của lượt lỗi đã tính phí — kết quả bị cắt, bị từ chối, không đọc được, lỗi đối chiếu; đợt sửa gộp 18/10/2026).
// Giả lập (gia_lap) chỉ khi secret AI_CHO_PHEP_GIA_LAP = 1 (Supabase cục bộ, CI).
// Trần độ dài kết quả (max_tokens) để rộng: Claude 5.x suy nghĩ thích ứng (Opus 5.5 luôn bật), phần suy nghĩ tính vào trần — trần hẹp làm văn bản nhiều
// nhiệm vụ bị cắt. Hạn đọc văn bản 140 giây tính từ lúc nhận yêu cầu: Supabase trả 504 khi function chưa trả lời sau 150 giây (request idle timeout — mọi gói,
// kể cả gói trả phí cho function chạy tới 400 giây), nên chờ lâu hơn không có ích. Đo trên staging 17/10/2026: Opus 5.5 mức cao đọc 28 trang hết 87 giây.
// Deploy: supabase functions deploy tro-ly-ai --project-ref <ref> (deploy-staging.yml / deploy-prod.yml).
import { taoCsdl, napDanhMuc } from './csdl.js';
import { NHA_CUNG_CAP, goiAi, LoiAi } from './nha-cung-cap.js';
import { LOAI_VAN_BAN, TOI_DA_KY_TU, luocDoDocVanBan, HE_THONG_DOC, noiDungDoc, luocDoQuyTac, HE_THONG_QUY_TAC, noiDungQuyTac, dsQuyTac } from './de-bai.js';
import { xacMinhKetQua } from './xac-minh.js';
import { giaLap } from './gia-lap.js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const loi = (message: string, status = 400, ma = 'LOI') => json({ ok: false, error: message, ma }, status);
const HANH_DONG: Record<string, string> = { doc_van_ban: 'DOC_VAN_BAN', soan_quy_tac: 'SOAN_QUY_TAC', kiem_tra: 'KIEM_TRA', hoc_dem: 'HOC_DEM' };
const MA_MT = /^[A-Z0-9_]{2,40}$/;
type CauHinh = Record<string, any>;

const url = Deno.env.get('SUPABASE_URL') || '';
const anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const csdl = taoCsdl({ url, anon, service });
const choGiaLap = Deno.env.get('AI_CHO_PHEP_GIA_LAP') === '1';
// Hạn đọc văn bản tính từ lúc nhận yêu cầu (gồm tải tệp ảnh lên, đọc CSDL): 140 giây — còn chỗ ghi nhật ký lượt và trả lỗi tiếng Việt trước mốc 150 giây.
const hetGioDoc = (batDau: number) => Math.max(5000, 140000 - (Date.now() - batDau));

const giuLuot = (nguoi: string | null, hanhDong: string, p: Record<string, unknown> = {}) => csdl.rpc('ai_giu_luot', { p_nguoi: nguoi, p_hanh_dong: hanhDong, p });
function xongLuot(id: number | null | undefined, p: Record<string, unknown>) {
  return id ? csdl.rpc('ai_xong_luot', { p_id: id, p }).catch(() => null) : Promise.resolve(null);   // nhật ký lỗi không làm hỏng kết quả
}

async function docVanBan(body: any, ch: CauHinh, khoa: string | null, batDau: number) {
  if (!ch.gui_noi_dung) throw new LoiAi('Cấu hình hiện không cho gửi nội dung văn bản tới dịch vụ AI.', { status: 403, ma: 'KHONG_GUI' });
  const chu = String(body.chu || '').slice(0, TOI_DA_KY_TU);
  const anh = Array.isArray(body.anh) ? body.anh.slice(0, 12).filter((a: any) => /^image\/(jpeg|png|webp)$/.test(a?.media) && typeof a?.data === 'string' && a.data.length < 3_000_000) : [];
  if (!chu.trim() && !anh.length) throw new LoiAi('Không đọc được chữ hay ảnh nào từ tệp.', { status: 400, ma: 'TRONG' });
  const dm = await napDanhMuc(csdl, LOAI_VAN_BAN);
  const r = await goiAi(ch, khoa, { heThong: HE_THONG_DOC, noiDung: noiDungDoc(dm.day, chu, String(body.ten_tep || 'van-ban.pdf').slice(0, 120), anh.length > 0),
    anh: chu.trim() ? [] : anh, schema: luocDoDocVanBan(dm.ma), tenSchema: 'doc_van_ban', toiDa: 32000 }, { giaLap: choGiaLap ? giaLap : null, hetGio: hetGioDoc(batDau) });
  try {
    return { ket_qua: xacMinhKetQua(r.json, chu, dm.xacMinh), vao: r.vao, ra: r.ra };
  } catch (e) {   // lỗi đối chiếu ở máy chủ: lượt AI đã tính phí — vẫn ghi token vào nhật ký; nhật ký function ghi ngăn xếp lỗi (không ghi nội dung văn bản)
    console.error('tro-ly-ai doi_chieu:', (e as Error)?.stack || String(e));
    throw new LoiAi('Chưa đối chiếu được kết quả của trợ lý AI với văn bản — đồng chí thử lại hoặc nhập tay.', { status: 500, ma: 'DOI_CHIEU', vao: r.vao, ra: r.ra });
  }
}

async function soanQuyTac(ma: string, ch: CauHinh, khoa: string | null, hetGio = 60000) {
  if (!MA_MT.test(ma)) throw new LoiAi('Mã mục tiêu không hợp lệ.', { status: 400, ma: 'MA' });
  const dl = await csdl.rpc('ai_du_lieu_hoc', { p_ma: ma, p_gioi_han: 30 });
  const r = await goiAi(ch, khoa, { heThong: HE_THONG_QUY_TAC, noiDung: noiDungQuyTac(dl), schema: luocDoQuyTac(), tenSchema: 'quy_tac', toiDa: 8000, mucSuyNghi: 'low' },
    { giaLap: choGiaLap ? giaLap : null, hetGio });
  const ghi = await csdl.rpc('ai_ghi_quy_tac', { p_ma: ma, p_ds: dsQuyTac(r.json) });
  return { ket_qua: ghi, vao: r.vao, ra: r.ra };
}

async function hocDem(ch: CauHinh, khoa: string | null) {
  const ds: string[] = await csdl.rpc('ai_can_hoc', { p_gioi_han: 20 });
  const bd = Date.now(); const xong: unknown[] = [];
  for (const ma of ds) {
    const conLai = 140000 - (Date.now() - bd);   // giới hạn 150 giây của Edge Function (chừa 10 giây trả kết quả)
    if (conLai < 35000) break;
    const luot = await giuLuot(null, 'HOC_DEM');
    if (!luot?.duoc) break;   // hết lượt toàn hệ thống trong ngày
    const t = Date.now();
    try {
      const r = await soanQuyTac(ma, ch, khoa, Math.min(60000, conLai - 5000));
      xong.push({ ma, them: (r.ket_qua as any)?.them ?? 0 });
      await xongLuot(luot.id, { ket_qua: 'OK', token_vao: r.vao, token_ra: r.ra, thoi_gian_ms: Date.now() - t });
    } catch (e) {
      const m = String((e as Error).message).slice(0, 300);
      xong.push({ ma, loi: m.slice(0, 120) });
      await xongLuot(luot.id, { ket_qua: 'LOI', token_vao: (e as any)?.vao ?? null, token_ra: (e as any)?.ra ?? null, thoi_gian_ms: Date.now() - t, loi: m });
      if (e instanceof LoiAi && ['CHUA_KHOA', 'KHOA', 'CAU_HINH'].includes(e.ma)) break;
    }
  }
  return { da_hoc: xong, con_lai: Math.max(0, ds.length - xong.length) };
}

Deno.serve(async (req) => {
  const batDau = Date.now();
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return loi('Chỉ nhận POST.', 405);
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  let body: any;
  try { body = await req.json(); } catch { return loi('Nội dung yêu cầu không phải JSON.'); }
  const hd = String(body?.hanh_dong || '');
  try {
    const ch: CauHinh | undefined = (await csdl.chon('cau_hinh_ai', 'select=*&id=eq.1'))?.[0];
    if (!ch) return loi('Chưa có cấu hình trợ lý AI (migration 0112).', 500, 'CAU_HINH');
    const ncc = NHA_CUNG_CAP[ch.nha_cung_cap as keyof typeof NHA_CUNG_CAP];
    const khoa = ncc?.khoa ? Deno.env.get(ncc.khoa) || null : null;
    if (ch.nha_cung_cap === 'gia_lap' && !choGiaLap) return loi('Nhà cung cấp giả lập chỉ dùng khi kiểm thử cục bộ.', 400, 'CAU_HINH');
    if (hd === 'hoc_dem') {
      if (!service || token !== service) return loi('Chỉ tác vụ hệ thống được gọi học đêm.', 403, 'QUYEN');
      if (!ch.bat) return json({ ok: true, bo_qua: 'Trợ lý AI đang tắt.' });
      if (ch.nha_cung_cap !== 'gia_lap' && !khoa) return json({ ok: true, bo_qua: `Chưa có khoá API (secret ${ncc?.khoa || '?'}).` });
      return json({ ok: true, ...(await hocDem(ch, khoa)) });
    }
    const toi = token ? await csdl.rpc('ai_toi', {}, token).catch(() => null) : null;
    if (!toi?.id || !toi.hoat_dong) return loi('Phiên đăng nhập không hợp lệ hoặc tài khoản không hoạt động.', 401, 'QUYEN');
    if (hd === 'trang_thai') {
      return json({ ok: true, bat: ch.bat, nha_cung_cap: ch.nha_cung_cap, ten: ncc?.ten || ch.nha_cung_cap, mo_hinh: ch.mo_hinh,
        co_khoa: ch.nha_cung_cap === 'gia_lap' ? choGiaLap : Boolean(khoa), gui_noi_dung: ch.gui_noi_dung });
    }
    if (!HANH_DONG[hd]) return loi('Hành động không hợp lệ.');
    if (hd === 'kiem_tra' && toi.quyen_muc_tieu !== 'QUAN_TRI') return loi('Chỉ quản trị hệ thống kiểm tra kết nối AI.', 403, 'QUYEN');
    if (hd === 'soan_quy_tac' && toi.quyen_muc_tieu !== 'QUAN_TRI') return loi('Chỉ quản trị hệ thống cho trợ lý AI soạn quy tắc.', 403, 'QUYEN');
    if (!ch.bat) return loi('Trợ lý AI đang tắt (Quản trị › Cấu hình AI).', 503, 'TAT');
    const luot = await giuLuot(toi.id, HANH_DONG[hd], { so_trang: Number.isInteger(body.so_trang) ? body.so_trang : null,
      so_ky_tu: typeof body.chu === 'string' ? body.chu.length : null });
    if (!luot?.duoc) {
      const nguoi = luot?.nguoi >= luot?.gioi_han_nguoi;
      return loi(`Đã dùng hết lượt trợ lý AI hôm nay (${nguoi ? `${luot.gioi_han_nguoi} lượt mỗi người` : `${luot?.gioi_han_ngay} lượt toàn hệ thống`}).`, 429, 'HET_LUOT');
    }
    const bd = Date.now();
    try {
      let kq: any;
      if (hd === 'doc_van_ban') kq = await docVanBan(body, ch, khoa, batDau);
      else if (hd === 'soan_quy_tac') kq = await soanQuyTac(String(body.ma || ''), ch, khoa);
      else {
        const r = await goiAi(ch, khoa, { heThong: 'Trả lời bằng tiếng Việt, rất ngắn.', noiDung: 'Kiểm tra kết nối: chào một câu.', schema: { type: 'object', additionalProperties: false,
          required: ['tra_loi'], properties: { tra_loi: { type: 'string' } } }, tenSchema: 'kiem_tra', toiDa: 2000, mucSuyNghi: 'low' }, { giaLap: choGiaLap ? giaLap : null, hetGio: 30000 });
        kq = { ket_qua: { tra_loi: String(r.json?.tra_loi || '').slice(0, 200) }, vao: r.vao, ra: r.ra };
      }
      await xongLuot(luot.id, { ket_qua: 'OK', token_vao: kq.vao, token_ra: kq.ra, thoi_gian_ms: Date.now() - bd });
      return json({ ok: true, ket_qua: kq.ket_qua, mo_hinh: ch.mo_hinh, nha_cung_cap: ncc?.ten, thoi_gian_ms: Date.now() - bd });
    } catch (e) {
      const m = e instanceof LoiAi ? e.message : 'Lỗi khi xử lý yêu cầu trợ lý AI.';
      await xongLuot(luot.id, { ket_qua: 'LOI', token_vao: (e as any)?.vao ?? null, token_ra: (e as any)?.ra ?? null, thoi_gian_ms: Date.now() - bd, loi: m.slice(0, 300) });
      return loi(m, e instanceof LoiAi ? e.status : 500, e instanceof LoiAi ? e.ma : 'LOI');
    }
  } catch (e) {
    return loi(`Lỗi máy chủ trợ lý AI: ${String((e as Error).message || e).slice(0, 160)}`, 500);
  }
});
