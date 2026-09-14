@echo off
rem Chạy scripts/tai-backup.sh bằng Git Bash và ghi log vào ..\vptu-backup\tai-backup.log.
rem Dùng cho Windows Task Scheduler (docs/sao-luu-khoi-phuc.md mục 3) hoặc chạy tay: scripts\tai-backup.cmd
rem Không xoá gì (muốn giữ N bản thì tự thêm --giu N vào dòng lệnh bash bên dưới).
chcp 65001 >nul
setlocal
set "BASH=%ProgramFiles%\Git\bin\bash.exe"
if not exist "%BASH%" (
  echo Không thấy Git Bash tại "%BASH%" — cài Git for Windows rồi chạy lại.
  exit /b 1
)
set "REPO=%~dp0.."
if not exist "%REPO%\..\vptu-backup" mkdir "%REPO%\..\vptu-backup"
"%BASH%" -lc "cd \"$(cygpath -u '%REPO%')\" && { echo \"===== $(date '+%%Y-%%m-%%d %%H:%%M:%%S')\"; bash scripts/tai-backup.sh; echo \"===== mã thoát $?\"; } >> ../vptu-backup/tai-backup.log 2>&1"
set "MA=%ERRORLEVEL%"
echo Đã chạy tai-backup.sh (mã thoát %MA%) — xem "%REPO%\..\vptu-backup\tai-backup.log"
exit /b %MA%
