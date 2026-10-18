// Bộ nối nhà cung cấp AI (v3.25 — chủ dự án chọn Claude, yêu cầu đổi sang dịch vụ khác nhanh): MỘT giao diện goiAi(cấu hình, khoá, yêu cầu) cho
// mọi nhà cung cấp; đổi nhà cung cấp = chọn lại ở Quản trị › Cấu hình AI (bảng cau_hinh_ai) + thêm secret của nhà cung cấp đó. Hai kiểu gọi:
//   - anthropic: Messages API (POST {dia_chi}/v1/messages, anthropic-version 2023-06-01), JSON theo lược đồ bằng output_config.format (json_schema),
//     mức suy nghĩ output_config.effort (mô hình Claude 4.6+ / 5.x); bỏ khối thinking, ghép khối text.
//   - openai: chuẩn Chat Completions (POST {dia_chi}/chat/completions, Bearer) — dùng cho OpenAI, Gemini (cổng tương thích OpenAI) và dịch vụ khác
//     theo chuẩn này (ví dụ dịch vụ trong nước); JSON bằng response_format json_schema, dịch vụ không nhận thì tự thử lại json_object một lần.
// Secret cố định theo nhà cung cấp (không cấu hình được tên — tránh trỏ sang secret khác của function, như khoá service_role). Ảnh (PDF scan): base64.
// Thuần (không Deno API) để unit test bằng node (frontend/tests/tro-ly-ai.test.mjs); fetch truyền vào.

export const NHA_CUNG_CAP = {
  anthropic: { ten: 'Claude (Anthropic)', khoa: 'AI_KEY_ANTHROPIC', dia_chi: 'https://api.anthropic.com', kieu: 'anthropic' },
  openai: { ten: 'ChatGPT (OpenAI)', khoa: 'AI_KEY_OPENAI', dia_chi: 'https://api.openai.com/v1', kieu: 'openai' },
  gemini: { ten: 'Gemini (Google)', khoa: 'AI_KEY_GEMINI', dia_chi: 'https://generativelanguage.googleapis.com/v1beta/openai', kieu: 'openai' },
  khac: { ten: 'Dịch vụ khác theo chuẩn OpenAI', khoa: 'AI_KEY_KHAC', dia_chi: null, kieu: 'openai' },
  gia_lap: { ten: 'Giả lập (chỉ kiểm thử cục bộ)', khoa: null, dia_chi: null, kieu: 'gia_lap' },
};

// vao / ra: token đã tính phí của lượt lỗi (kết quả bị cắt, từ chối, không đọc được JSON) — nhật ký AI ghi cả lượt lỗi (đợt sửa gộp 18/10/2026).
export class LoiAi extends Error {
  /** @param {string} message @param {{ status?: number, ma?: string, vao?: number | null, ra?: number | null }} [o] */
  constructor(message, { status = 502, ma = 'AI_LOI', vao = null, ra = null } = {}) { super(message); this.status = status; this.ma = ma; this.vao = vao; this.ra = ra; }
}
const kemToken = (docFn, vao, ra) => { try { return docFn(); } catch (e) { if (e instanceof LoiAi) Object.assign(e, { vao, ra }); throw e; } };

const coEffort = (moHinh) => /^claude-(opus|sonnet|haiku|fable|mythos)-(4-[6-9]|[5-9])/.test(String(moHinh || ''));
const boCheo = (s) => String(s || '').replace(/\/+$/, '');
export function diaChi(ch) {
  const p = NHA_CUNG_CAP[ch?.nha_cung_cap];
  if (!p) throw new LoiAi(`Nhà cung cấp "${ch?.nha_cung_cap}" không hỗ trợ.`, { status: 400, ma: 'CAU_HINH' });
  const d = ch.nha_cung_cap === 'khac' ? ch.dia_chi : p.dia_chi;
  if (p.kieu !== 'gia_lap' && !/^https:\/\//.test(String(d || ''))) throw new LoiAi('Chưa có địa chỉ https của dịch vụ AI.', { status: 400, ma: 'CAU_HINH' });
  return boCheo(d);
}

// yc: { heThong, noiDung, anh: [{ media, data }], schema, tenSchema, toiDa, mucSuyNghi }
export function yeuCauAnthropic(ch, yc, khoa) {
  const noiDung = [...(yc.anh || []).map((a) => ({ type: 'image', source: { type: 'base64', media_type: a.media, data: a.data } })), { type: 'text', text: yc.noiDung }];
  const outputConfig = { format: { type: 'json_schema', schema: yc.schema } };
  if (coEffort(ch.mo_hinh)) outputConfig.effort = yc.mucSuyNghi || ch.muc_suy_nghi || 'medium';
  return {
    url: `${diaChi(ch)}/v1/messages`,
    headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': khoa },
    body: { model: ch.mo_hinh, max_tokens: yc.toiDa || 8000, system: yc.heThong, messages: [{ role: 'user', content: noiDung }], output_config: outputConfig },
  };
}
export function yeuCauOpenAI(ch, yc, khoa, kieuJson = 'schema') {
  const noiDung = [{ type: 'text', text: yc.noiDung }, ...(yc.anh || []).map((a) => ({ type: 'image_url', image_url: { url: `data:${a.media};base64,${a.data}` } }))];
  const body = { model: ch.mo_hinh, messages: [{ role: 'system', content: yc.heThong }, { role: 'user', content: noiDung }],
    response_format: kieuJson === 'schema' ? { type: 'json_schema', json_schema: { name: yc.tenSchema || 'ket_qua', schema: yc.schema, strict: true } } : { type: 'json_object' } };
  body[ch.nha_cung_cap === 'openai' ? 'max_completion_tokens' : 'max_tokens'] = yc.toiDa || 8000;
  return { url: `${diaChi(ch)}/chat/completions`, headers: { 'content-type': 'application/json', authorization: `Bearer ${khoa}` }, body };
}

// Chữ JSON → đối tượng; mô hình trả kèm chữ ngoài JSON thì lấy khối {…} ngoài cùng.
export function docJson(chu) {
  const s = String(chu || '').trim();
  try { return JSON.parse(s); } catch { /* thử cắt khối */ }
  const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* rơi xuống lỗi */ } }
  throw new LoiAi('Dịch vụ AI trả kết quả không đọc được (không phải JSON).');
}
export function docKetQuaAnthropic(j) {
  const vao = j?.usage?.input_tokens ?? null; const ra = j?.usage?.output_tokens ?? null;
  if (j?.stop_reason === 'max_tokens') throw new LoiAi('Kết quả của AI bị cắt vì văn bản quá dài — hãy chọn ít trang hơn.', { status: 413, ma: 'QUA_DAI', vao, ra });
  if (j?.stop_reason === 'refusal') throw new LoiAi('Dịch vụ AI từ chối xử lý nội dung này.', { status: 422, ma: 'TU_CHOI', vao, ra });
  const chu = (j?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { json: kemToken(() => docJson(chu), vao, ra), vao, ra };
}
export function docKetQuaOpenAI(j) {
  const c = j?.choices?.[0]; const vao = j?.usage?.prompt_tokens ?? null; const ra = j?.usage?.completion_tokens ?? null;
  if (c?.finish_reason === 'length') throw new LoiAi('Kết quả của AI bị cắt vì văn bản quá dài — hãy chọn ít trang hơn.', { status: 413, ma: 'QUA_DAI', vao, ra });
  if (c?.message?.refusal) throw new LoiAi('Dịch vụ AI từ chối xử lý nội dung này.', { status: 422, ma: 'TU_CHOI', vao, ra });
  return { json: kemToken(() => docJson(c?.message?.content), vao, ra), vao, ra };
}

// Lỗi HTTP của nhà cung cấp → câu tiếng Việt (không chép nguyên thông báo dài, không lộ khoá).
export function loiHttp(status, j) {
  const goc = String(j?.error?.message || j?.error?.type || j?.message || '').slice(0, 160);
  if (status === 401 || status === 403) return new LoiAi('Khoá API của dịch vụ AI không hợp lệ hoặc đã hết hạn — quản trị hệ thống kiểm tra secret.', { status: 502, ma: 'KHOA' });
  if (status === 404) return new LoiAi(`Không tìm thấy mô hình hoặc địa chỉ dịch vụ AI (${goc || 'HTTP 404'}).`, { status: 502, ma: 'MO_HINH' });
  if (status === 413) return new LoiAi('Văn bản quá lớn để gửi cho dịch vụ AI — hãy chọn ít trang hơn.', { status: 413, ma: 'QUA_DAI' });
  if (status === 429) return new LoiAi('Dịch vụ AI đang giới hạn số lượt gọi — thử lại sau ít phút.', { status: 503, ma: 'GIOI_HAN' });
  if (status >= 500) return new LoiAi('Dịch vụ AI đang quá tải hoặc lỗi — thử lại sau.', { status: 503, ma: 'QUA_TAI' });
  return new LoiAi(`Dịch vụ AI từ chối yêu cầu (HTTP ${status}${goc ? `: ${goc}` : ''}).`, { status: 502, ma: 'YEU_CAU' });
}

async function gui(fetchFn, rq, hetGio) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), hetGio);
  try {
    const res = await fetchFn(rq.url, { method: 'POST', headers: rq.headers, body: JSON.stringify(rq.body), signal: ctl.signal });
    let j = null; try { j = await res.json(); } catch { j = null; }
    return { res, j };
  } catch (e) {
    if (e?.name === 'AbortError') throw new LoiAi('Dịch vụ AI phản hồi quá lâu — thử lại với ít trang hơn.', { status: 504, ma: 'HET_GIO' });
    throw new LoiAi('Không kết nối được dịch vụ AI.', { status: 502, ma: 'KET_NOI' });
  } finally { clearTimeout(t); }
}

// → { json, vao, ra }. giaLap(yc) chỉ dùng khi nha_cung_cap = gia_lap (index.ts đã kiểm biến môi trường cho phép).
/**
 * @param {Record<string, any>} ch @param {string | null} khoa @param {Record<string, any>} yc
 * @param {{ fetchFn?: typeof fetch, giaLap?: ((yc: any) => any) | null, hetGio?: number }} [tuyChon]
 * @returns {Promise<{ json: any, vao: number | null, ra: number | null }>}
 */
export async function goiAi(ch, khoa, yc, { fetchFn = fetch, giaLap = null, hetGio = 135000 } = {}) {
  const p = NHA_CUNG_CAP[ch?.nha_cung_cap];
  if (!p) throw new LoiAi(`Nhà cung cấp "${ch?.nha_cung_cap}" không hỗ trợ.`, { status: 400, ma: 'CAU_HINH' });
  if (p.kieu === 'gia_lap') { if (!giaLap) throw new LoiAi('Giả lập không được bật ở môi trường này.', { status: 400, ma: 'CAU_HINH' }); return giaLap(yc); }
  if (!khoa) throw new LoiAi(`Chưa có khoá API của ${p.ten} (secret ${p.khoa} của Edge Function).`, { status: 503, ma: 'CHUA_KHOA' });
  if (p.kieu === 'anthropic') {
    const { res, j } = await gui(fetchFn, yeuCauAnthropic(ch, yc, khoa), hetGio);
    if (!res.ok) throw loiHttp(res.status, j);
    return docKetQuaAnthropic(j);
  }
  const han = Date.now() + hetGio;   // một hạn chung cho cả lần thử lại (không nhân đôi thời gian chờ)
  let { res, j } = await gui(fetchFn, yeuCauOpenAI(ch, yc, khoa, 'schema'), hetGio);
  if (res.status === 400 && /response_format|json_schema|schema/i.test(JSON.stringify(j || ''))) {
    if (han - Date.now() < 5000) throw new LoiAi('Dịch vụ AI phản hồi quá lâu — thử lại với ít trang hơn.', { status: 504, ma: 'HET_GIO' });
    ({ res, j } = await gui(fetchFn, yeuCauOpenAI(ch, yc, khoa, 'object'), han - Date.now()));
  }
  if (!res.ok) throw loiHttp(res.status, j);
  return docKetQuaOpenAI(j);
}
