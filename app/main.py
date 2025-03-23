from contextlib import asynccontextmanager
from fastapi import FastAPI
from .routers import staff, item, order, order_item
from .database import create_db_and_tables

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield
    print("Sayonaraaaa!")

app = FastAPI(lifespan=lifespan)
app.include_router(staff.router)
app.include_router(item.router)
app.include_router(order.router)
app.include_router(order_item.router)