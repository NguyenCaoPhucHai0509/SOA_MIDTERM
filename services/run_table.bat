@echo off

uvicorn table_service.main:app --host 0.0.0.0 --port 8004 --reload