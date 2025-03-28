from fastapi import Depends, Query, Body, Request
from fastapi.routing import APIRouter
from sqlmodel import Session, select
from typing import Annotated

from ..templates import templates
from ..models.item import Item, ItemCreate, ItemPublic
from ..database import get_session

router = APIRouter(
    prefix="/items",
    tags=["Items"]
)


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

@router.get("/", response_model=list[ItemPublic])
async def read_items(
    *,
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    offset: Annotated[int, Query()] = 0,
    limit: Annotated[int, Query(le=100)] = 100
):
    items = session.exec(select(Item)
                 .offset(offset)
                 .limit(limit)
                ).all()
    templates.TemplateResponse(
        name="menu.html",
        request=request,
        context={"items": items}
    )
    # return items