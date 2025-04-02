from fastapi import Depends, Query, Body
from fastapi.routing import APIRouter
from sqlmodel import Session, select, Field
from typing import Annotated

from .models import Item, ItemCreate, ItemPublic
from .database import get_session

router = APIRouter()

@router.post("/", response_model=ItemPublic)
async def create_item(
    *,
    session: Annotated[Session, Depends(get_session)],
    item: Annotated[ItemCreate, Body()]
):
   
    item_db = Item.model_validate(item)
    session.add(item_db)
    session.commit()
    session.refresh(item_db)
    return item_db
    # return items

@router.get("/", response_model=list[ItemPublic])
async def read_items(
    *,
    session: Annotated[Session, Depends(get_session)],
    offset: Annotated[int, Field()] = 0,
    limit: Annotated[int, Field()] = 100
):
    items = session.exec(
        select(Item).offset(offset).limit(limit)
    ).all()

    return items