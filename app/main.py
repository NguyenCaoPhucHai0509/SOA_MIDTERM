from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.templating import Jinja2Templates

from .routers import auth, staff, item, order, order_item
from .database import create_db_and_tables

templates = Jinja2Templates(directory="app/templates")

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield
    print("Sayonaraaaa!")


app = FastAPI(lifespan=lifespan)

app.include_router(auth.router)
app.include_router(staff.router)
app.include_router(item.router)
app.include_router(order.router)
app.include_router(order_item.router)