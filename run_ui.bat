@echo off
SET IGNORE_CTRL_C=1
start /B cmd /C python -m http.server 5500 --directory frontend
exit /B