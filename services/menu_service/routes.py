from fastapi import Depends, Query, Body, Path, HTTPException
from fastapi.responses import FileResponse
from fastapi.routing import APIRouter
from sqlmodel import Session, select, Field
from typing import Annotated
import os

from .models import Item, ItemCreate, ItemPublic, ItemUpdate
from .database import get_session

CURRENT_DIR = os.path.dirname(__file__)
STATIC_DIR = f"{CURRENT_DIR}/static"

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

@router.get("/", response_model=list[ItemPublic])
async def read_items(
    *,
    session: Annotated[Session, Depends(get_session)],
    offset: Annotated[int, Query()] = 0,
    limit: Annotated[int, Query()] = 100
):
    items = session.exec(
        select(Item).offset(offset).limit(limit)
    ).all()

    return items

@router.get("/{item_id}", response_model=ItemPublic)
async def read_item(
    *,
    session: Annotated[Session, Depends(get_session)],
    item_id: Annotated[int, Path()]
):
    item = session.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.put("/{item_id}", response_model=ItemPublic)
async def update_item(
    *,
    session: Annotated[Session, Depends(get_session)],
    item_id: Annotated[int, Path()],
    item: Annotated[ItemUpdate, Body()]
):
    db_item = session.get(Item, item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    item_data = item.model_dump(exclude_unset=True)
    db_item.sqlmodel_update(item_data)
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item

@router.delete("/{item_id}", response_model=dict)
async def delete_item(
    *,
    session: Annotated[Session, Depends(get_session)],
    item_id: Annotated[int, Path()]
):
    item = session.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    session.delete(item)
    session.commit()
    return {"message": "Item deleted successfully"}

@router.get("/images/{filename}")
async def get_image(filename: Annotated[str, Path()]):
    real_img_path = os.path.join(STATIC_DIR, "images", filename)
    if not os.path.exists(real_img_path):
        raise HTTPException(
            status_code=404, 
            detail="Image not found"
        )
    return FileResponse(real_img_path)