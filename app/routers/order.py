from fastapi import (Depends, Query, Body, 
                     Path, HTTPException)
from fastapi.routing import APIRouter
from sqlmodel import Session, select
import psycopg2
from sqlalchemy.exc import DBAPIError
from typing import Annotated, TYPE_CHECKING

from ..models.order import (OrderSession, OrderSessionCreate, 
                            OrderSessionPublic, OrderSessionUpdate,
                            OrderSessionPublicWithOrderItems)

from ..database import get_session

router = APIRouter(
    prefix="/orders",
    tags=["Orders"]
)

@router.post("/", response_model=OrderSessionPublic)
async def create_order(
    *,
    session: Annotated[Session, Depends(get_session)],
    order: Annotated[OrderSessionCreate, Body()]
):
    order_db = OrderSession.model_validate(order)

    try:
        session.add(order_db)
        session.commit()
    except DBAPIError as e:
        if isinstance(e.orig, psycopg2.errors.RaiseException):
            raise HTTPException(status_code=400, detail=str(e.orig))
        raise HTTPException(status_code=500, detail="Database error")
    
    session.refresh(order_db)
    return order_db

@router.get("/", response_model=list[OrderSessionPublic])
async def read_orders(
    *,
    session: Annotated[Session, Depends(get_session)],
    offset: Annotated[int, Query()] = 0,
    limit: Annotated[int, Query(le=100)] = 100
):
    orders = session.exec(select(OrderSession)
                 .offset(offset)
                 .limit(limit)
                ).all()
    return orders

@router.get("/{order_id}", response_model=OrderSessionPublicWithOrderItems)
async def read_order(
    *,
    session: Annotated[Session, Depends(get_session)],
    order_id: Annotated[int, Path()]
):
    order_db = session.get(OrderSession, order_id)
    if not order_db:
        raise HTTPException(status_code=404, detail="Order not found")
    return order_db

@router.put("/{order_id}", response_model=OrderSessionPublic)
async def update_order(
    *,
    session: Annotated[Session, Depends(get_session)],
    order_id: Annotated[int, Path()],
    order: Annotated[OrderSessionUpdate, Body()]
):
    order_db = session.get(OrderSession, order_id)
    if not order_db:
        raise HTTPException(status_code=404, detail="Order not found")
    order_data = order.model_dump(unset_exclude=True)
    order_db.sqlmodel_update(order_data)
    session.add(order_db)
    session.commit()
    session.refresh(order_db)
    return order_db