@echo off
cd /d "%~dp0"
python foe_nego.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Blad uruchomienia. Sprawdz czy Python jest zainstalowany i czy masz wymagane biblioteki:
    echo   pip install pyautogui opencv-python pillow
    pause
)
