import redis.asyncio as redis
import json
from typing import AsyncGenerator

from .connect_manager import manager

redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)

async def publish_event(event: str, payload: dict, channel: str):
    message = {
        "event": event,
        "data": payload
    }
    await redis_client.publish(channel, json.dumps(message))

async def subscribe(channel: str) -> AsyncGenerator[dict, None]:
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(channel)

    async for message in pubsub.listen():
        if message["type"] == "message":
            yield json.loads(message["data"])

async def redis_listener():
    async for message in subscribe("order_service"):
        # if message["target_role"] == "chef":
            # data = json.loads(message["data"])

            # initiator_role = data["initiator_role"]
            # message = data["message"]
            # target_role = "chef" if initiator_role == "waiter" or initiator_role == "manager" else "waiter"
            
            # await manager.broadcast_to_role(message, target_role)
        print("MESSAGE: ", message)
        await manager.broadcast_to_role(message, message["data"]["target_role"])




