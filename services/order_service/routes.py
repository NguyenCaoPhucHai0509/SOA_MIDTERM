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
    OrderItem, OrderItemPublicV1, OrderItemPublicV2,
    OrderItemCreate, OrderItemUpdate, OrderItemStatus
)
from .database import get_session

router = APIRouter()

# async def validate_table(
#     session: Annotated[Session, Depends(get_session)],
#     table_id: int,
# ):
#     table_id = session.get(OrderSession, )


'''
Create an order. 1 Table - 1 Order
'''
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
 

@router.get("/{order_id}/", response_model=OrderSessionPublic)
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

@router.put("/{order_id}/", response_model=OrderSessionPublic)
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

'''
Adding order items to existed order
This is different to vanila update function, bc. update function
overwrites some field, but for adding more order items, we can only
append to existed order item list of that order
'''
@router.put("/{order_id}/extend", response_model=OrderSessionPublic)
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

# @router.get("/{order_id}/order-items/{order_item_id}", 
#     response_model=OrderItemPublicV2
# )
# async def read_order_item(
#     *,
#     session: Annotated[Session, Depends(get_session)],
#     order_id: Annotated[int, Path()],
#     order_item_id: Annotated[int, Path()]
# ):
#     pass



def validate_status_transition(
    current_status: OrderItemStatus,
    new_status: OrderItemStatus
):
    valid_transitions = {
        OrderItemStatus.pending: {OrderItemStatus.received, OrderItemStatus.canceled},
        OrderItemStatus.received: {OrderItemStatus.completed},
        OrderItemStatus.completed: set(),
        OrderItemStatus.canceled: set()
    }
    if new_status not in valid_transitions[current_status]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition from {current_status.value} to {new_status.value}"
        )
    
'''
Updating only 1 order item. This is for waiters, they only update for each one
'''
@router.put("/{order_id}/order-items/{order_item_id}/", 
    response_model=OrderItemPublicV2
)
async def update_order_item(
    *,
    session: Annotated[Session, Depends(get_session)],
    order_id: Annotated[int, Path()],
    order_item_id: Annotated[int, Path()],
    order_item: OrderItemUpdate
): 
    # print("DEBUG: ", order_id, order_item_id)
    order_item_db = session.exec(
        select(OrderItem)
        .where(OrderItem.id == order_item_id, 
            OrderItem.order_id == order_id)
    ).first()


    if not order_item_db:
        raise HTTPException(
            status_code=404, 
            detail="Order Item not found"
        )
    
    if order_item.status:
        validate_status_transition(order_item_db.status, order_item.status)

    order_item_data = order_item.model_dump(exclude_unset=True)
    order_item_db.sqlmodel_update(order_item_data)
    session.add(order_item_db)
    session.commit()
    session.refresh(order_item_db)
    return order_item_db