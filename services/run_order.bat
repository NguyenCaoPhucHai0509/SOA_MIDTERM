@echo off

uvicorn order_service.main:app --host 0.0.0.0 --port 8003 --reload