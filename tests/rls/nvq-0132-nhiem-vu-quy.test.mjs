// 0132–0139 (v3.35, chủ dự án 13/11/2026 — CAU-HOI nhóm U): phân hệ Nhiệm vụ quý của Ban Thường vụ. Quy tắc kiểm: mọi cán bộ đọc toàn bộ (anon không);
// quản lý danh mục = Chánh Văn phòng / đầu mối tổng hợp (Chánh VP chỉ định); cập nhật = chủ trì theo dõi (người cập nhật chính), phối hợp, cán bộ phòng được
// giao, Trưởng phòng của người chủ trì, lãnh đạo Văn phòng, đầu mối — Thường trực không cập nhật; chỉ đạo: Thường trực, lãnh đạo Văn phòng, đầu mối; văn bản
// "hoàn thành" phải có số / kết quả; chốt tuần (ảnh chụp số liệu), đánh giá (đề xuất / chốt, lý do bắt buộc), chốt quý (không cập nhật được nữa), chuyển quý
// sau (không tạo trùng), hoàn tác lô nhập, tệp (kho nvq-tep), nhắc tự động (chỉ service_role). Dữ liệu thử: Quý I, II năm 2025 (quý đã qua — không đụng quý
// thật); tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, anonClient, assertOk, assertDenied, IDS, CHI_CUC_BO } from './lib.mjs';

const db = () => adminClient();
const NAM = 2025;
const coBang = async () => !(await db().from('nvq_ky').select('id').limit(1)).error;
const SKIP = !(await coBang()) ? 'Chưa có migration 0132–0139 (phân hệ Nhiệm vụ quý) trên project này.' : false;
const goi = async (u, ham, p = {}) => (await userClient(u)).rpc(ham, p);
const ma22 = (r, label, mau) => { assert.equal(r.error?.code, '22023', `${label}: ${r.error?.code} ${r.error?.message}`); if (mau) assert.match(r.error.message, mau); };
const don = async () => {
  await db().from('nvq_ky').delete().eq('nam', NAM).in('quy', [1, 2]);   // Quý IV/2025: e2e nhiem-vu-quy.spec.js
  await db().from('nvq_phan_quyen').delete().eq('tai_khoan', IDS.cv2);
};
const s = {};   // id quý, nhiệm vụ, kết quả / sản phẩm, văn bản
const nv = (truc) => db().from('v_nvq_nhiem_vu').select('*').eq('ky_id', s.ky).eq('truc_so', truc).eq('nguon', 'NHAP').single();

describe('Nhiệm vụ quý BTV (0132–0139): quyền, cập nhật, chỉ đạo, chốt tuần / quý, chuyển quý', { skip: SKIP, concurrency: false }, () => {
  before(don);
  after(don);

  test('1. Chỉ Chánh VP / đầu mối quản lý danh mục: chuyên viên không tạo quý; Chánh VP tạo quý (tuần báo cáo kết thúc thứ Năm), chỉ định đầu mối', async () => {
    assertDenied(await goi('demo_cv1', 'nvq_ky_luu', { p: { nam: NAM, quy: 1 } }), 'chuyên viên tạo quý');
    assertDenied(await goi('demo_cv2', 'nvq_phan_quyen_dat', { p_tai_khoan: IDS.cv2, p_bat: true }), 'chuyên viên tự chỉ định đầu mối');
    const k = await goi('demo_cvp', 'nvq_ky_luu', { p: { nam: NAM, quy: 1, han_bao_cao_ket_qua: '2025-03-20' } });
    assertOk(k, 'Chánh VP tạo quý'); s.ky = k.data;
    ma22(await goi('demo_cvp', 'nvq_ky_luu', { p: { nam: NAM, quy: 1 } }), 'tạo trùng quý', /Đã có Quý I năm 2025/);
    const tuan = (await db().from('nvq_tuan').select('so, tu_ngay, den_ngay').eq('ky_id', s.ky).order('so')).data;
    assert.ok(tuan.length >= 12 && tuan.length <= 14, `số tuần ${tuan.length}`);
    tuan.forEach((w) => assert.equal(new Date(`${w.den_ngay}T00:00:00Z`).getUTCDay(), 4, `tuần ${w.so} kết thúc thứ Năm`));
    assert.equal(tuan[0].den_ngay, '2025-01-09', 'tuần 1 tới thứ Năm đầu tiên sau 6 ngày đầu quý'); assert.ok(tuan.at(-1).den_ngay >= '2025-03-31', 'tuần cuối phủ hết quý');
    s.tuan1 = (await db().from('nvq_tuan').select('id').eq('ky_id', s.ky).eq('so', 1).single()).data.id;
    assertDenied(await goi('demo_qtht', 'nvq_phan_quyen_dat', { p_tai_khoan: IDS.qtht, p_bat: true }), 'quản trị hệ thống tự chỉ định mình');
    assertOk(await goi('demo_cvp', 'nvq_phan_quyen_dat', { p_tai_khoan: IDS.cv2, p_bat: true }), 'chỉ định cv2 làm đầu mối');
    const q = await goi('demo_cv2', 'nvq_quyen_cua_toi');
    assertOk(q, 'quyền'); assert.equal(q.data.quan_ly, true); assert.equal((await goi('demo_cv1', 'nvq_quyen_cua_toi')).data.quan_ly, false);
    const vb = await goi('demo_cv2', 'nvq_van_ban_luu', { p: { ky_id: s.ky, loai: 'DIEU_CHINH', so_ky_hieu: 'RLS-01-CV/TU', ngay: '2025-02-01' } });
    assertOk(vb, 'văn bản điều chỉnh'); s.vb = vb.data;
  });

  test('2. Đầu mối nhập danh mục một lô: chủ trì / phối hợp theo dõi, kết quả đã cập nhật, sản phẩm đã ban hành; nhập lại cùng vị trí → sửa thông tin giao', async () => {
    const dong = [
      { truc_so: 1, nhom: 'TRONG_CT', stt: 1, noi_dung: 'RLS chỉ đạo tăng trưởng', lanh_dao_ma: ['BI_THU', 'PBT_UBND'], don_vi: [{ ma: 'DU_UBND', vai_tro: 'CHU_TRI' }],
        chu_tri_theo_doi: IDS.cv1, phoi_hop_theo_doi: [IDS.truongphong],
        san_pham: [{ thu_tu: 1, mo_ta: 'GRDP quý I', loai: 'CHI_TIEU', chi_tieu_co_ban: 'GRDP', don_vi_tinh: '%', muc_tieu: 8, han: '2025-03-31' },
          { thu_tu: 2, mo_ta: 'Văn bản chỉ đạo', loai: 'VAN_BAN', han: '2025-03-10' }],
        cap_nhat_dau: { ket_qua_thuc_hien: 'Đã ban hành 2 văn bản chỉ đạo' } },
      { truc_so: 4, nhom: 'NGOAI_CT', stt: 3, noi_dung: 'RLS kế hoạch hội thảo', chu_tri_theo_doi: IDS.cv1,
        san_pham: [{ mo_ta: 'Ban hành Kế hoạch', loai: 'VAN_BAN', han: '2025-01-31', trang_thai: 'HOAN_THANH', kq_so_ky_hieu: '99-KH/TU' }] },
      { truc_so: 6, nhom: 'TRONG_CT', stt: 12, noi_dung: 'RLS xử lý đơn thư', tinh_chat: 'THUONG_XUYEN', san_pham: [{ mo_ta: 'Tiếp nhận, xử lý đơn thư thường xuyên', loai: 'KHAC' }] },
    ];
    assertDenied(await goi('demo_cv1', 'nvq_nhap_danh_muc', { p_ky: s.ky, p_dong: dong }), 'chuyên viên nhập danh mục');
    const r = await goi('demo_cv2', 'nvq_nhap_danh_muc', { p_ky: s.ky, p_dong: dong, p_ten_tep: 'rls.docx' });
    assertOk(r, 'nhập'); assert.deepEqual([r.data.so_moi, r.data.so_sua], [3, 0]);
    const a = (await nv(1)).data; const b = (await nv(4)).data; const c = (await nv(6)).data;
    Object.assign(s, { nv1: a.id, nv4: b.id, nv6: c.id });
    assert.deepEqual([a.chu_tri_theo_doi, a.phoi_hop_theo_doi], [IDS.cv1, [IDS.truongphong]]);
    assert.equal(a.ket_qua_thuc_hien, 'Đã ban hành 2 văn bản chỉ đạo');
    assert.equal(b.trang_thai, 'HOAN_THANH'); assert.equal(c.trang_thai, 'THUONG_XUYEN');
    const sp = (await db().from('nvq_san_pham').select('id, loai').eq('nhiem_vu_id', s.nv1)).data;
    s.spCt = sp.find((x) => x.loai === 'CHI_TIEU').id; s.spVb = sp.find((x) => x.loai === 'VAN_BAN').id;
    const lai = await goi('demo_cv2', 'nvq_nhap_danh_muc', { p_ky: s.ky, p_dong: [{ ...dong[2], noi_dung: 'RLS xử lý đơn thư, khiếu nại' }] });
    assertOk(lai, 'nhập lại'); assert.deepEqual([lai.data.so_moi, lai.data.so_sua], [0, 1]);
    assert.equal((await nv(6)).data.noi_dung, 'RLS xử lý đơn thư, khiếu nại');
    const lo = await goi('demo_cv2', 'nvq_nhap_danh_muc', { p_ky: s.ky, p_dong: [{ truc_so: 2, nhom: 'TRONG_CT', stt: 1, noi_dung: 'RLS lô hoàn tác' }] });
    assertOk(lo, 'lô thứ ba');
    assertDenied(await goi('demo_cv1', 'nvq_hoan_tac_lo', { p_lo: lo.data.lo_id }), 'chuyên viên hoàn tác lô');
    const ht = await goi('demo_cv2', 'nvq_hoan_tac_lo', { p_lo: lo.data.lo_id });
    assertOk(ht, 'hoàn tác'); assert.equal(ht.data, 1);
    assert.equal((await db().from('nvq_nhiem_vu').select('id').eq('ky_id', s.ky).eq('truc_so', 2)).data.length, 0);
  });

  test('3. Mọi cán bộ đọc toàn bộ danh mục (chuyên viên phòng khác, Thường trực); anon không đọc được', async () => {
    for (const u of ['demo_qtht', 'demo_a0', 'demo_cv2', 'demo_truongphong']) {
      const r = await (await userClient(u)).from('v_nvq_nhiem_vu').select('id').eq('ky_id', s.ky);
      assertOk(r, `${u} đọc`); assert.equal(r.data.length, 3, `${u} thấy đủ 3 nhiệm vụ`);
    }
    const an = await anonClient().from('nvq_nhiem_vu').select('id').eq('ky_id', s.ky);
    assert.ok(an.error || an.data.length === 0, 'anon không đọc được');
  });

  test('4. Cập nhật tiến độ: chủ trì theo dõi được; văn bản "hoàn thành" phải có số; Thường trực, cán bộ không liên quan bị chặn; Trưởng phòng của chủ trì được', async () => {
    assertDenied(await goi('demo_a0', 'nvq_cap_nhat_gui', { p: { nhiem_vu_id: s.nv1, khong_thay_doi: true } }), 'Thường trực cập nhật');
    assertDenied(await goi('demo_qtht', 'nvq_cap_nhat_gui', { p: { nhiem_vu_id: s.nv1, khong_thay_doi: true } }), 'chuyên viên không liên quan');
    ma22(await goi('demo_cv1', 'nvq_cap_nhat_gui', { p: { nhiem_vu_id: s.nv1, san_pham: [{ id: s.spVb, trang_thai: 'HOAN_THANH' }] } }), 'văn bản không số');
    const r = await goi('demo_cv1', 'nvq_cap_nhat_gui', { p: { nhiem_vu_id: s.nv1, noi_dung: 'Trong tuần ban hành CV 900', ket_qua_thuc_hien: 'Đã ban hành CV 900-CV/TU; GRDP ước 7,5%',
      vuong_mac: 'Chưa có số liệu chính thức', san_pham: [{ id: s.spVb, trang_thai: 'HOAN_THANH', kq_so_ky_hieu: '900-CV/TU', kq_ngay: '2025-03-12' }],
      so_lieu: [{ san_pham_id: s.spCt, gia_tri: 7.5, ngay_so_lieu: '2025-03-25', uoc_tinh: true, nguon: 'Cục Thống kê' }] } });
    assertOk(r, 'chủ trì cập nhật'); assert.ok(r.data.id && r.data.tuan, 'gắn tuần báo cáo');
    const sp = (await db().from('v_nvq_san_pham').select('id, trang_thai, kq_so_ky_hieu, thuc_hien, dat_muc_tieu').eq('nhiem_vu_id', s.nv1)).data;
    assert.equal(sp.find((x) => x.id === s.spVb).kq_so_ky_hieu, '900-CV/TU');
    assert.deepEqual([Number(sp.find((x) => x.id === s.spCt).thuc_hien), sp.find((x) => x.id === s.spCt).dat_muc_tieu], [7.5, false]);
    const a = (await nv(1)).data;
    assert.equal(a.ket_qua_thuc_hien, 'Đã ban hành CV 900-CV/TU; GRDP ước 7,5%'); assert.equal(a.vuong_mac, 'Chưa có số liệu chính thức');
    assertOk(await goi('demo_truongphong', 'nvq_cap_nhat_gui', { p: { nhiem_vu_id: s.nv1, noi_dung: 'Trưởng phòng bổ sung' } }), 'Trưởng phòng của chủ trì');
    const ls = (await db().from('nvq_lich_su').select('hanh_dong').eq('nhiem_vu_id', s.nv1)).data.map((x) => x.hanh_dong);
    assert.ok(ls.length >= 2, 'lịch sử ghi lần cập nhật');
  });

  test('5. Ý kiến chỉ đạo: Thường trực chỉ đạo → người theo dõi nhận tin (chuông dùng chung); chủ trì trả lời; cán bộ không liên quan không trao đổi', async () => {
    const yk = await goi('demo_a0', 'nvq_y_kien_gui', { p: { nhiem_vu_id: s.nv1, loai: 'CHI_DAO', noi_dung: 'Đôn đốc số liệu GRDP' } });
    assertOk(yk, 'Thường trực chỉ đạo');
    const tin = (await db().from('direct_messages').select('receiver_id, is_read').eq('nvq_nhiem_vu_id', s.nv1)).data;
    assert.ok(tin.some((t) => t.receiver_id === IDS.cv1), 'chủ trì nhận tin'); assert.ok(tin.some((t) => t.receiver_id === IDS.truongphong), 'phối hợp nhận tin');
    assertOk(await goi('demo_cv1', 'nvq_y_kien_gui', { p: { nhiem_vu_id: s.nv1, loai: 'TRAO_DOI', tra_loi_cho: yk.data, noi_dung: 'Đã đôn đốc Sở Tài chính' } }), 'chủ trì trả lời');
    assertDenied(await goi('demo_qtht', 'nvq_y_kien_gui', { p: { nhiem_vu_id: s.nv1, loai: 'TRAO_DOI', noi_dung: 'x' } }), 'không liên quan trao đổi');
    assertOk(await goi('demo_cv1', 'nvq_tin_da_doc', { p_nv: s.nv1 }), 'đánh dấu đã đọc');
    const con = (await db().from('direct_messages').select('id').eq('nvq_nhiem_vu_id', s.nv1).eq('receiver_id', IDS.cv1).eq('is_read', false)).data;
    assert.equal(con.length, 0);
    assert.equal((await nv(1)).data.so_chi_dao_mo, 1);
    assertOk(await goi('demo_a0', 'nvq_y_kien_xong', { p_id: yk.data }), 'người chỉ đạo đánh dấu đã xử lý');
    assert.equal((await nv(1)).data.so_chi_dao_mo, 0);
  });

  test('6. Phân công cho phòng: cán bộ phòng được giao cập nhật được; chuyên viên không phân công được; đổi người chủ trì phải có lý do', async () => {
    assertDenied(await goi('demo_cv1', 'nvq_phan_cong', { p_ids: [s.nv6], p: { phong: 'CDS_CY' } }), 'chuyên viên phân công');
    assertOk(await goi('demo_cv2', 'nvq_phan_cong', { p_ids: [s.nv6], p: { phong: 'CDS_CY' } }), 'giao phòng CĐS-CY');
    assertOk(await goi('demo_qtht', 'nvq_cap_nhat_gui', { p: { nhiem_vu_id: s.nv6, khong_thay_doi: true } }), 'cán bộ phòng được giao');
    ma22(await goi('demo_cv2', 'nvq_phan_cong', { p_ids: [s.nv4], p: { chu_tri: IDS.qtht } }), 'đổi chủ trì không lý do');
    assertOk(await goi('demo_cv2', 'nvq_phan_cong', { p_ids: [s.nv4], p: { chu_tri: IDS.qtht }, p_ly_do: 'Điều chỉnh phân công' }), 'đổi chủ trì có lý do');
    assert.equal((await nv(4)).data.chu_tri_theo_doi, IDS.qtht);
    ma22(await goi('demo_cv2', 'nvq_dieu_chinh', { p_id: s.nv4, p_loai: 'RUT', p_van_ban: s.vb, p_ly_do: '' }), 'rút không lý do');
    assertOk(await goi('demo_cv2', 'nvq_dieu_chinh', { p_id: s.nv4, p_loai: 'RUT', p_van_ban: s.vb, p_ly_do: 'Đã hoàn thành ở quý trước' }), 'rút khỏi danh mục');
    assert.equal((await nv(4)).data.trang_thai, 'RUT');
    assertDenied(await goi('demo_qtht', 'nvq_cap_nhat_gui', { p: { nhiem_vu_id: s.nv4, khong_thay_doi: true } }), 'cập nhật nhiệm vụ đã rút');
  });

  test('7. Chốt tuần (ảnh chụp số liệu) chỉ đầu mối; mở lại phải có lý do', async () => {
    assertDenied(await goi('demo_cv1', 'nvq_tuan_chot', { p_tuan: s.tuan1 }), 'chuyên viên chốt tuần');
    const r = await goi('demo_cv2', 'nvq_tuan_chot', { p_tuan: s.tuan1, p_nhan_xet: 'Tuần 1' });
    assertOk(r, 'chốt tuần 1');
    const w = (await db().from('nvq_tuan').select('trang_thai, so_lieu').eq('id', s.tuan1).single()).data;
    assert.equal(w.trang_thai, 'DA_CHOT'); assert.ok(w.so_lieu && w.so_lieu.tong >= 2, 'có ảnh chụp số liệu');
    assert.ok((await db().from('nvq_tuan_anh').select('nhiem_vu_id').eq('tuan_id', s.tuan1)).data.length >= 2, 'ảnh chụp từng nhiệm vụ');
    ma22(await goi('demo_cv2', 'nvq_tuan_mo_lai', { p_tuan: s.tuan1, p_ly_do: '' }), 'mở lại không lý do');
    assertOk(await goi('demo_cv2', 'nvq_tuan_mo_lai', { p_tuan: s.tuan1, p_ly_do: 'Bổ sung số liệu' }), 'mở lại tuần');
  });

  test('8. Đánh giá: chủ trì đề xuất, đầu mối chốt (lý do bắt buộc khi chưa hoàn thành); chuyển quý sau không tạo trùng', async () => {
    assertOk(await goi('demo_cv1', 'nvq_danh_gia', { p_id: s.nv1, p_muc: 'CHUA_HOAN_THANH', p_ly_do: 'Chưa có số liệu chính thức', p_chot: false, p_chuyen: true }), 'chủ trì đề xuất');
    assertDenied(await goi('demo_cv1', 'nvq_danh_gia', { p_id: s.nv1, p_muc: 'HOAN_THANH', p_chot: true }), 'chủ trì chốt');
    ma22(await goi('demo_cv2', 'nvq_danh_gia', { p_id: s.nv1, p_muc: 'CHUA_HOAN_THANH', p_ly_do: '', p_chot: true }), 'chốt không lý do');
    ma22(await goi('demo_cv2', 'nvq_danh_gia', { p_id: s.nv6, p_muc: 'HOAN_THANH', p_chot: true, p_chuyen: true }), 'chuyển việc đã hoàn thành');
    assertOk(await goi('demo_cv2', 'nvq_danh_gia', { p_id: s.nv1, p_muc: 'CHUA_HOAN_THANH', p_ly_do: 'Chưa có số liệu chính thức', p_chot: true, p_chuyen: true }), 'đầu mối chốt');
    const a = (await nv(1)).data; assert.deepEqual([a.danh_gia, a.danh_gia_de_xuat, a.chuyen_ky_sau], ['CHUA_HOAN_THANH', 'CHUA_HOAN_THANH', true]);
    ma22(await goi('demo_cv1', 'nvq_danh_gia', { p_id: s.nv1, p_muc: 'HOAN_THANH', p_chot: false, p_chuyen: false }), 'đề xuất sau khi đầu mối đã chốt', /đã chốt đánh giá/);
    const k2 = await goi('demo_cv2', 'nvq_ky_luu', { p: { nam: NAM, quy: 2 } });
    assertOk(k2, 'tạo Quý II'); s.ky2 = k2.data;
    const c = await goi('demo_cv2', 'nvq_chuyen_ky', { p_ids: [s.nv1], p_ky_moi: s.ky2 });
    assertOk(c, 'chuyển'); assert.equal(c.data, 1);
    assert.equal((await goi('demo_cv2', 'nvq_chuyen_ky', { p_ids: [s.nv1], p_ky_moi: s.ky2 })).data, 0, 'lần hai không tạo trùng');
    const moi = (await db().from('v_nvq_nhiem_vu').select('id, tu_nhiem_vu_id, chu_tri_theo_doi, nguon, stt').eq('ky_id', s.ky2)).data;
    assert.equal(moi.length, 1); assert.deepEqual([moi[0].tu_nhiem_vu_id, moi[0].chu_tri_theo_doi, moi[0].nguon, moi[0].stt], [s.nv1, IDS.cv1, 'CHUYEN_KY', 101]);
    ma22(await goi('demo_cv2', 'nvq_chuyen_ky', { p_ids: [s.nv4], p_ky_moi: s.ky2 }), 'chuyển việc đã rút khỏi danh mục', /không chuyển/);
    const spMoi = (await db().from('nvq_san_pham').select('mo_ta').eq('nhiem_vu_id', moi[0].id)).data.map((x) => x.mo_ta);
    assert.deepEqual(spMoi, ['GRDP quý I'], 'chỉ chép kết quả chưa xong');
  });

  test('9. Chốt quý: nhiệm vụ chưa đánh giá nhận mức theo trạng thái; sau chốt không cập nhật được; mở lại phải có lý do', async () => {
    assertDenied(await goi('demo_cv1', 'nvq_ky_chot', { p_ky: s.ky }), 'chuyên viên chốt quý');
    const r = await goi('demo_cv2', 'nvq_ky_chot', { p_ky: s.ky, p_nhan_xet: 'Chốt quý thử' });
    assertOk(r, 'chốt quý'); assert.equal(r.data.chua_hoan_thanh, 1); assert.equal(r.data.hoan_thanh, 1, 'việc thường xuyên → hoàn thành');
    assert.equal((await nv(6)).data.danh_gia, 'HOAN_THANH');
    assertDenied(await goi('demo_cv1', 'nvq_cap_nhat_gui', { p: { nhiem_vu_id: s.nv1, khong_thay_doi: true } }), 'cập nhật sau chốt quý');
    ma22(await goi('demo_cv2', 'nvq_ky_mo_lai', { p_ky: s.ky, p_ly_do: '' }), 'mở lại không lý do');
    assertOk(await goi('demo_cv2', 'nvq_ky_mo_lai', { p_ky: s.ky, p_ly_do: 'Bổ sung kết quả' }), 'mở lại quý');
    assert.equal((await nv(6)).data.danh_gia, null, 'mức do chốt quý tự điền được bỏ khi mở lại');
    assert.equal((await nv(1)).data.danh_gia, 'CHUA_HOAN_THANH', 'mức đầu mối đã chốt giữ nguyên');
    assertOk(await goi('demo_cv1', 'nvq_cap_nhat_gui', { p: { nhiem_vu_id: s.nv1, khong_thay_doi: true } }), 'cập nhật lại được');
  });

  test('10. Tệp: chủ trì tải lên kho nvq-tep và gắn; cán bộ không liên quan không gắn / gỡ được', async () => {
    const duong = `${s.nv1}/rls-${Date.now()}.pdf`;
    const c1 = await userClient('demo_cv1');
    assertOk(await c1.storage.from('nvq-tep').upload(duong, new Blob(['%PDF-1.4 thu'], { type: 'application/pdf' }), { contentType: 'application/pdf' }), 'tải lên');
    const la = await (await userClient('demo_qtht')).storage.from('nvq-tep').upload(`${s.nv1}/la.pdf`, new Blob(['x'], { type: 'application/pdf' }), { contentType: 'application/pdf' });
    assert.ok(la.error, 'không liên quan không tải lên được');
    const g = await goi('demo_cv1', 'nvq_tep_gan', { p: { duong_dan: duong, ten: 'Báo cáo.pdf', kich_thuoc: 12 } });
    assertOk(g, 'gắn tệp');
    assertDenied(await goi('demo_qtht', 'nvq_tep_xoa', { p_id: g.data }), 'không liên quan gỡ tệp');
    assertOk(await goi('demo_cv1', 'nvq_tep_xoa', { p_id: g.data }), 'người đính kèm gỡ');
    await db().storage.from('nvq-tep').remove([duong]);
  });

  test('11. Nhắc tự động chỉ chạy bằng service_role, chạy lại cùng ngày không nhắc trùng', { skip: CHI_CUC_BO }, async () => {   // quét mọi quý đang mở: chỉ CI cục bộ
    assertDenied(await goi('demo_cvp', 'nvq_nhac_quet', { p_ngay: '2025-03-20' }), 'người dùng gọi nhắc');
    const a = await db().rpc('nvq_nhac_quet', { p_ngay: '2025-03-20' });
    assertOk(a, 'lần 1');
    const b = await db().rpc('nvq_nhac_quet', { p_ngay: '2025-03-20' });
    assertOk(b, 'lần 2');
    const tong = (x) => Object.values(x || {}).reduce((n, v) => n + (typeof v === 'number' ? v : 0), 0);
    assert.equal(tong(b.data), 0, `lần hai không nhắc: ${JSON.stringify(b.data)}`);
  });
});
