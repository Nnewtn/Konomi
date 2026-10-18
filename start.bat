@echo off
setlocal
cd /d "%~dp0"
if not exist .venv (
  py -3 -m venv .venv
  if errorlevel 1 goto fail
)
.venv\Scripts\python.exe -m pip install --disable-pip-version-check -r backend\requirements.txt
if errorlevel 1 goto fail
if not exist backend\.env copy backend\.env.example backend\.env >nul
echo Guest menu: http://127.0.0.1:8000
echo Admin panel: http://127.0.0.1:8000/admin
echo First-start admin password appears in the server output below.
cd backend
..\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
pause
exit /b
:fail
echo Setup failed. Install Python 3.12 with pip and retry.
pause
exit /b 1
