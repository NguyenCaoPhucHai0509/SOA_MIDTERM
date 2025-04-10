@echo off

uvicorn staff_service.main:app --host 0.0.0.0 --port 8001 --reload