from fastapi import FastAPI
from contextlib import asynccontextmanager

from .routes import router
from .database import create_db_and_tables

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("START: TABLE SERVICE")
    create_db_and_tables()
    yield
    print("Sayonaraaaa!")

app = FastAPI(lifespan=lifespan)

app.include_router(router, prefix="/tables", tags=["Tables"])