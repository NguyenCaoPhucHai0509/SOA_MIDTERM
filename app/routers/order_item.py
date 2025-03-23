from fastapi import Depends, Query, Body, Path, HTTPException
from fastapi.routing import APIRouter
from sqlmodel import Session, select
from typing import Annotated

from ..models.order_item import (OrderItem, OrderItemCreate, 
                                OrderItemPublic, OrderItemUpdate)
from ..database import get_session

router = APIRouter(
    prefix="/order-items",
    tags=["Order Items"]
)

@router.post("/", response_model=OrderItemPublic)
async def create_order_item(
    *,
    session: Annotated[Session, Depends(get_session)],
    order_item: Annotated[OrderItemCreate, Body()]
):
    order_item_db = OrderItem.model_validate(order_item)
    session.add(order_item_db)
    session.commit()
    session.refresh(order_item_db)
    return order_item_db

@router.get("/", response_model=list[OrderItemPublic])
async def read_order_items(
    *,
    session: Annotated[Session, Depends(get_session)],
    offset: Annotated[int, Query()] = 0,
    limit: Annotated[int, Query(le=100)] = 100
):
    order_items = session.exec(select(OrderItem)
                 .offset(offset)
                 .limit(limit)
                ).all()
    return order_items

@router.get("/{order_id}/{item_id}", response_model=OrderItemPublic)
async def read_order_item(
    *,
    session: Annotated[Session, Depends(get_session)],
    order_id: Annotated[int, Path()],
    item_id: Annotated[int, Path()]
):
    order_items_db = session.exec(
        select(OrderItem)
        .where(OrderItem.order_id == order_id, 
               OrderItem.item_id == item_id)
    ).one()
    
    return order_items_db

@router.put("/{order_id}/{item_id}", response_model=OrderItemPublic)
async def update_order_item(
    *,
    order_id: Annotated[int, Path()],
    item_id: Annotated[int, Path()],
    order_item: Annotated[OrderItemUpdate, Body()]
): 
    