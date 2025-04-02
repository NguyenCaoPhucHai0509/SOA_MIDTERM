@echo off
SET IGNORE_CTRL_C=1

start /B cmd /C uvicorn services.staff_service.main:app --host 0.0.0.0 --port 8001 --reload

exit /B 0