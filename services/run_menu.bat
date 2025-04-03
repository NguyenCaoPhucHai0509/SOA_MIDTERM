@echo off

SET IGNORE_CTRL_C=1

start /B cmd /C uvicorn menu_service.main:app --host 0.0.0.0 --port 8002 --reload

exit /B 0
