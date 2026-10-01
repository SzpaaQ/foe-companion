@echo off
cd /d "%~dp0"
set "FOE_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%FOE_NODE%" (
  "%FOE_NODE%" dev-server.cjs
) else (
  node dev-server.cjs
)
pause
