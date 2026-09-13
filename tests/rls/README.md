# tests/rls/

Test chứng minh chính sách Row Level Security (RLS-2…8 trong `docs/SPEC.md` mục 3.2) sẽ được thêm ở **Giai đoạn 3**.

Mỗi quy tắc phân quyền cần ít nhất một test "được phép" và một test "bị chặn", chạy bằng anon key + token thật của 4 tài khoản mẫu (CVP, PCVP, A2, A3) trên project staging — xem `docs/PROMPTS.md` mục "Giai đoạn 3".
