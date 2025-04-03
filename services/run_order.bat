@echo off

SET IGNORE_CTRL_C=1

start /B cmd /C uvicorn order_service.main:app --host 0.0.0.0 --port 8003 --reload

exit /B 0