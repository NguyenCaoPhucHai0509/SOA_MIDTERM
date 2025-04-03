from fastapi import (
    Depends, Query, Body, 
    Path, Header, HTTPException
)
from fastapi.routing import APIRouter
from sqlmodel import Session, select, Field
from sqlalchemy.exc import DBAPIError
from typing import Annotated, TYPE_CHECKING

from .models import (
    OrderSession, OrderSessionCreate, 
    OrderSessionPublic, OrderSessionUpdate,
    OrderItem, OrderItemPublic, OrderItemCreate,
    OrderItemUpdate
)
from .database import get_session

router = APIRouter()

@router.post("/", response_model=OrderSessionPublic)
async def create_order(
    *,
    session: Annotated[Session, Depends(get_session)],
    x_staff_id: Annotated[int, Header()],
    order: Annotated[OrderSessionCreate, Body()]
):
    
    try:
        list_order_items = []
        for order_item in order.order_items:
            list_order_items.append(
                OrderItem(**order_item.model_dump(exclude_unset=True))
            )

        order_db = OrderSession(
            table_id=order.table_id,
            server_id=x_staff_id,
            order_items=list_order_items
        )
        
        session.add(order_db)
        session.commit()
    except DBAPIError as e:
        # raise HTTPException(status_code=400, detail=str(e.orig))
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
 

@router.get("/{order_id}", response_model=OrderSessionPublic)
async def read_order(
    *,
    session: Annotated[Session, Depends(get_session)],
    order_id: Annotated[int, Path()]
):
    order_db = session.get(OrderSession, order_id)
    if not order_db:
        raise HTTPException(
            status_code=404, 
            detail="Order not found"
        )
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
        raise HTTPException(status_code=404, 
                            detail="Order not found")
    order_data = order.model_dump(exclude_unset=True)
    order_db.sqlmodel_update(order_data)
    session.add(order_db)
    session.commit()
    session.refresh(order_db)
    return order_db

# Adding order items to existed order
@router.put("/{order_id}/extend/", response_model=OrderSessionPublic)
async def add_more_order_items(
    *,
    session: Annotated[Session, Depends(get_session)],
    order_id: Annotated[int, Path()],
    order_items: Annotated[list[OrderItemCreate], Body()]
):
    order_db = session.get(OrderSession, order_id)
    if not order_db:
        raise HTTPException(status_code=404, detail="Order not found")
    
    for order_item in order_items:
        order_item_data = order_item.model_dump()
        order_item_data.update({"order_id": order_id})
        order_item_db = OrderItem.model_validate(
            order_item_data
        )
        order_db.order_items.append(order_item_db)

    session.add(order_db)
    session.commit()
    session.refresh(order_db)
    return order_db

@router.get("/order-items/", response_model=list[OrderItemPublic])
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

# @router.get("{order_id}/order-items/{order_item_id}", response_model=OrderItemPublic)
# async def read_order_item(
#     *,
#     session: Annotated[Session, Depends(get_session)],
#     order_id
#     order_item_id: Annotated[int, Path()]
# ):
#     order_db = session.exec(Order, order_item_id)
#     if not order_item_id:
#         raise HTTPException(status_code=404, 
#                             detail="Order Item not found")
#     return order_items_db

# @router.put("/order-items/{order_item_id}", response_model=OrderItemPublic)
# async def update_order_item(
#     *,
#     session: Annotated[Session, Depends(get_session)],
#     order_item_id: Annotated[int, Path()],
#     order_item: OrderItemUpdate
# ): 
#     order_item_db = session.get(OrderItem, order_item_id)
#     if not order_item_db:
#         raise HTTPException(status_code=404, 
#                             detail="Order Item not found")
    
#     order_item_data = order_item.model_dump(exclude_unset=True)
#     order_item_db.sqlmodel_update(order_item_data)
#     session.add(order_item_db)
#     session.commit()
#     session.refresh(order_item_db)
#     return order_item_db