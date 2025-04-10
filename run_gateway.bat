@echo off

SET IGNORE_CTRL_C=1

start /B cmd /C uvicorn gateway.main:app --host 0.0.0.0 --port 8000 --reload

exit /B 0