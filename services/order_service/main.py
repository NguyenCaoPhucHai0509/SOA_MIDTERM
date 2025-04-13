from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, status
from contextlib import asynccontextmanager
import redis.asyncio as redis
import json
import asyncio

from .connect_manager import manager
from .routes import router
from .database import create_db_and_tables
from .pubsub import redis_listener

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("START: ORDER SERVICE")

    create_db_and_tables()
    listener_task = asyncio.create_task(redis_listener())
    try:
        yield
    finally:
        listener_task.cancel()
        try:
            await listener_task
        except asyncio.CancelledError:
            print("Redis listener stopped")

        print("GOODBYE")

app = FastAPI(lifespan=lifespan)

# WebSocket endpoint
@app.websocket("/ws/{role}")
async def websocket_endpoint(websocket: WebSocket, role: str):
    if role not in ["waiter", "manager", "chef"]:
        await websocket.close(code=1008, reason="Invalid role")

    await manager.connect(websocket, role)
    try:
        while True:
            # Keep the connection alive by listening for messages from the client
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket, role)

app.include_router(router, prefix="/orders", tags=["Orders"])

