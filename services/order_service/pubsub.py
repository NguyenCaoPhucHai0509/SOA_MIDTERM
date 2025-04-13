import redis.asyncio as redis
import json
from typing import AsyncGenerator

from .connect_manager import manager

redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)

async def publish_event(event: str, payload: dict, target_role: str):
    message = {
        "event": event,
        "data": {
            "payload": payload,
            "target_role": target_role
        }
    }
    await redis_client.publish("order_service", json.dumps(message))

async def subscribe(channel: str) -> AsyncGenerator[dict, None]:
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(channel)

    async for message in pubsub.listen():
        if message["type"] == "message":
            yield json.loads(message["data"])

async def redis_listener():
    async for message in subscribe("order_service"):
        target_role = message["data"]["target_role"]
        await manager.broadcast_to_role(message, target_role)