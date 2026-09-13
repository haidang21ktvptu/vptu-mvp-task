# Kế hoạch phát hành Giai đoạn 2 — Supabase Auth lên production

Áp dụng cho project production `frwyxcmbonjaimziiuqr`. Ngày chuyển đổi: **ngay khi web app hoàn thành** (quyết định của chủ dự án) = ngày merge PR-A. Mọi bước dưới đây do người vận hành chạy tay, có chủ dự án xác nhận từng bước; không chạy tự động.

## Nguyên tắc
- Hai PR tách rời để có cửa sổ quay lui: **PR-A** chỉ *thêm* (migration `0004`, script, config, frontend); **PR-B** mới *xoá* (migration `0005`: cột `password`, hàm `verify_login`) và chỉ mở sau khi production ổn định ≥ 24 giờ.
- Trong cửa sổ 24 giờ, đăng nhập cũ (`verify_login` + cột `password`) vẫn còn nguyên trong DB → quay lui chỉ cần đưa frontend cũ lên lại.
- Chỉ chạy các lệnh dưới đây khi `supabase/.temp/project-ref` đúng project; luôn `supabase config diff` trước `config push`.

## Điều kiện trước khi phát hành
1. PR-A đã QA đủ trên staging (3 vai trò đăng nhập bằng mật khẩu tạm → bị bắt đổi → vào đúng view), CI xanh, `/code-review` không còn cảnh báo cao, **đã được duyệt trên GitHub nhưng chưa merge**.
2. Văn thư/Chánh Văn phòng sẵn sàng nhận file Excel mật khẩu tạm và phát cho 49 cán bộ trong ngày (kênh nội bộ, không gửi email).
3. Đã thông báo cho cán bộ: từ giờ G, đăng nhập bằng mật khẩu tạm được phát, phải đổi ngay lần đầu (≥ 8 ký tự, có chữ và số).

## Thứ tự thực hiện (migration → merge)
| Bước | Lệnh / việc | Kiểm tra sau bước | Ảnh hưởng người dùng |
|---|---|---|---|
| 1. Backup | `supabase db dump --data-only --project-ref frwyxcmbonjaimziiuqr -f <thư mục ngoài git>/prod-<ngày>.sql` (giữ 7 ngày, đây là bản còn cột `password`) | File tồn tại, có `INSERT INTO "public"."accounts"` | Không |
| 2. Migration 0004 | `git checkout feature/gd2-supabase-auth` → `supabase link --project-ref frwyxcmbonjaimziiuqr` → `supabase db push --dry-run` (chỉ thấy `0004`) → `supabase db push` | REST: `POST /rest/v1/rpc/verify_login` vẫn trả 200; `GET /rest/v1/accounts_public?select=must_change_password&limit=1` có cột mới | Không (chỉ thêm) |
| 3. Config Auth | `supabase config diff` (xem kỹ) → `supabase config push` | `POST /auth/v1/signup` trả `signup_disabled` | Không |
| 4. Tạo 49 auth user | `cd scripts && node create-auth-users.mjs --project-ref frwyxcmbonjaimziiuqr` → file `scripts/out/mat-khau-tam-frwyxcmbonjaimziiuqr-*.xlsx` | Console: "Tạo mới: 49"; `supabase db query --linked "select count(*) from auth.users"` = số `accounts`; chủ dự án tự thử `POST /auth/v1/token?grant_type=password` bằng tài khoản của mình | Không (app cũ chưa dùng Auth) |
| 5. Bàn giao mật khẩu | Chuyển file Excel cho Văn thư/Chánh VP; **xoá file khỏi máy** sau khi bàn giao (`scripts/out/` không commit) | — | — |
| 6. Link lại staging | `supabase link --project-ref vojmrjezspdftovzinek` | `cat supabase/.temp/project-ref` = staging | — |
| 7. **Merge PR-A** | Bấm Merge trên GitHub (ruleset: CI xanh) → GitHub Pages deploy ~1–2 phút | Mở trang live: màn đăng nhập mới, đăng nhập bằng mật khẩu tạm → bắt đổi → vào view | **Giờ G**: mật khẩu cũ `123456` không còn dùng được |
| 8. Theo dõi 24h | Supabase Dashboard → Auth → Logs; phản ánh của cán bộ; `select count(*) from auth.users where last_sign_in_at is not null` | Không có lỗi hàng loạt | — |
| 9. PR-B (sau ≥ 24h) | Nhánh `feature/gd2-don-dep`: migration `0005` (`DROP FUNCTION verify_login`, `ALTER TABLE accounts DROP COLUMN password`), sửa `supabase/seed.sql` bỏ cột `password`; áp staging → CI → duyệt → merge → `db push` production | `GET /rest/v1/rpc/verify_login` trả 404; `accounts.password` không còn | Không |

## Quay lui trong 24 giờ (trước bước 9)
| Tình huống | Cách quay lui | Thời gian |
|---|---|---|
| Cán bộ không đăng nhập được hàng loạt sau bước 7 | **R1**: mở PR `git revert -m 1 <merge-commit PR-A>` → merge → Pages deploy lại bản cũ. Đăng nhập cũ (`verify_login`, mật khẩu cũ) hoạt động ngay vì DB chưa xoá gì. | ≈ 5 phút |
| Cần xoá luôn tài khoản Auth đã tạo | **R2** (tuỳ chọn): `node create-auth-users.mjs --project-ref frwyxcmbonjaimziiuqr --rollback` (xoá 49 `auth.users`, `accounts` giữ nguyên). Config Auth có thể để nguyên (không ảnh hưởng app cũ). | ≈ 2 phút |
| Cần bỏ schema 0004 | **R3**: không cần — 0004 chỉ thêm cột/bảng/trigger, app cũ không đụng. Nếu bắt buộc, viết migration `0006` mới để xoá (không sửa 0004 đã commit). | — |

**Sau bước 9 (đã xoá cột `password`)**: quay lui phải khôi phục từ backup bước 1 (`supabase db query --linked -f prod-<ngày>.sql` sau khi tạo lại cột) — coi đây là **điểm không quay lui nhanh**; chỉ làm bước 9 khi thật ổn định.

## Hạn chế đã biết (cần quyết định)
- Khoá tài khoản 15 phút sau 5 lần sai (AUTH-3) đã có sẵn trong DB (hook `hook_password_verification_attempt`) nhưng **gói Supabase Free không cho bật hook** (API trả 402). Hiện chỉ có giới hạn theo IP (30 lần/5 phút/IP). Bật lại khi lên gói Pro: `enabled = true` trong `config.toml` → `supabase config push`.
- `config push` cũng đồng bộ một số mục Auth phụ (site_url, redirect, MFA, OTP) theo `config.toml`; các mục này không dùng trong luồng email + mật khẩu, đã xem diff trên staging.
