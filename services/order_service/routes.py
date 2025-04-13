from fastapi import (
    Depends, Query, Body, 
    Path, Header, HTTPException
)
from fastapi.routing import APIRouter
from sqlmodel import Session, select, Field
from sqlalchemy.exc import DBAPIError
from typing import Annotated, TYPE_CHECKING
import json
from decimal import Decimal
import httpx

from .models import (
    OrderSession, OrderSessionCreate, 
    OrderSessionPublic, OrderSessionUpdate,
    OrderItem, OrderItemPublicV1, OrderItemPublicV2,
    OrderItemCreate, OrderItemUpdate, OrderItemStatus
)
from .database import get_session
from .pubsub import publish_event
from .utils import make_json_serializable
from .connect_manager import manager

router = APIRouter()

MENU_URL = "http://localhost:8002/items"

# Hàm helper để lấy giá của món ăn từ menu service
async def get_item_price(item_id: int, headers: dict) -> Decimal:
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{MENU_URL}/{item_id}", headers=headers)
            if response.status_code == 200:
                item_data = response.json()
                return Decimal(item_data.get("price", 0))
            return Decimal(0)
    except Exception as e:
        print(f"Error fetching item price: {e}")
        return Decimal(0)

# Hàm tính tổng tiền cho đơn hàng
async def calculate_order_total(order_items: list[OrderItem], headers: dict) -> Decimal:
    total = Decimal(0)
    for item in order_items:
        price = await get_item_price(item.item_id, headers)
        total += price * Decimal(item.quantity)
    return total

'''
Create an order. 1 Table - 1 Order
'''
@router.post("/", response_model=OrderSessionPublic)
async def create_order(
    *,
    session: Annotated[Session, Depends(get_session)],
    x_staff_id: Annotated[int, Header()],
    x_staff_role: Annotated[str, Header()],
    x_staff_name: Annotated[str, Header()],
    order: Annotated[OrderSessionCreate, Body()]
):
    
    try:
        # Chuẩn bị headers để gọi đến menu service
        headers = {
            "X-Staff-ID": str(x_staff_id),
            "X-Staff-Role": x_staff_role,
            "X-Staff-Name": x_staff_name
        }
        
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
        
        # Tính tổng tiền cho đơn hàng
        total_amount = await calculate_order_total(list_order_items, headers)
        order_db.total_amount = total_amount
        
        session.add(order_db)
        session.commit()
    except DBAPIError as e:
        # raise HTTPException(status_code=400, detail=str(e.orig))
        raise HTTPException(status_code=500, detail="Database error")
    
    session.refresh(order_db)

    order_data = make_json_serializable(order_db.model_dump())

    # Gửi sự kiện cho đầu bếp
    await publish_event(
        event="order_created", 
        payload=order_data,
        target_role="chef"
    )
    
    # Gửi sự kiện cho quản lý
    await publish_event(
        event="order_created", 
        payload=order_data,
        target_role="manager"
    )

    # Gửi thông báo qua WebSocket
    await manager.broadcast_to_role(
        message={
            "event": "order_created", 
            "data": order_data
        },
        role="chef"
    )

    # Cập nhật trạng thái bàn
    try:
        async with httpx.AsyncClient() as client:
            await client.put(
                f"http://localhost:8004/tables/{order.table_id}/",
                headers=headers,
                json={"is_available": False}
            )
    except Exception as e:
        print(f"Error updating table status: {e}")
    
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

'''
Don't put this function below "/{order_id}/" function
'''
@router.get("/order-items/", response_model=list[OrderItemPublicV2])
async def read_order_items(
    *,
    session: Annotated[Session, Depends(get_session)],
    offset: Annotated[int | None, Query()] = 0,
    limit: Annotated[int | None, Query()] = 100
):
    order_items_db = session.exec(
        select(OrderItem)
        .offset(offset)
        .limit(limit)
    ).all()

    return order_items_db
 

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
    order: Annotated[OrderSessionUpdate, Body()],
    x_staff_id: Annotated[int, Header()],
    x_staff_role: Annotated[str, Header()],
    x_staff_name: Annotated[str, Header()],
):
    order_db = session.get(OrderSession, order_id)
    if not order_db:
        raise HTTPException(status_code=404, 
                            detail="Order not found")
    
    headers = {
        "X-Staff-ID": str(x_staff_id),
        "X-Staff-Role": x_staff_role,
        "X-Staff-Name": x_staff_name
    }
    
    order_data = order.model_dump(exclude_unset=True)
    
    # Nếu đơn hàng thay đổi từ mở -> đóng hoặc hủy, cập nhật trạng thái bàn
    if 'status' in order_data and order_data['status'] in ['closed', 'canceled'] and order_db.status == 'opening':
        try:
            async with httpx.AsyncClient() as client:
                await client.put(
                    f"http://localhost:8004/tables/{order_db.table_id}/",
                    headers=headers,
                    json={"is_available": True}
                )
        except Exception as e:
            print(f"Error updating table status: {e}")
    
    order_db.sqlmodel_update(order_data)
    session.add(order_db)
    session.commit()
    session.refresh(order_db)
    
    # Gửi thông báo khi cập nhật đơn hàng
    order_data = make_json_serializable(order_db.model_dump())
    await publish_event(
        event="order_updated", 
        payload=order_data,
        target_role="chef"
    )
    await publish_event(
        event="order_updated", 
        payload=order_data,
        target_role="manager"
    )
    
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
    order_items: Annotated[list[OrderItemCreate], Body()],
    x_staff_id: Annotated[int, Header()],
    x_staff_role: Annotated[str, Header()],
    x_staff_name: Annotated[str, Header()]
):
    order_db = session.get(OrderSession, order_id)
    if not order_db:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Chuẩn bị headers cho API call
    headers = {
        "X-Staff-ID": str(x_staff_id),
        "X-Staff-Role": x_staff_role,
        "X-Staff-Name": x_staff_name
    }
    
    # Tính toán tổng tiền cho các món mới
    new_items = []
    for order_item in order_items:
        # Lấy giá của món từ menu service
        item_price = await get_item_price(order_item.item_id, headers)
        
        order_item_data = order_item.model_dump()
        order_item_data.update({"order_id": order_id})
        order_item_db = OrderItem.model_validate(order_item_data)
        
        # Tính giá cho món này và cộng vào tổng
        item_total = item_price * Decimal(order_item.quantity)
        order_db.total_amount += item_total
        
        order_db.order_items.append(order_item_db)
        new_items.append(order_item_db)
    
    session.add(order_db)
    session.commit()
    session.refresh(order_db)
    
    # Gửi thông báo về món ăn mới
    order_data = make_json_serializable(order_db.model_dump())
    await publish_event(
        event="order_item_added", 
        payload=order_data,
        target_role="chef"
    )
    
    # Thông báo qua WebSocket
    await manager.broadcast_to_role(
        message={
            "event": "order_item_added", 
            "data": order_data
        },
        role="chef"
    )
    
    return order_db

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
    order_item: OrderItemUpdate,
    x_staff_role: Annotated[str, Header()]
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
        
        # Kiểm tra quyền truy cập nếu đang cập nhật trạng thái
        if (order_item.status == 'received' or order_item.status == 'completed') and x_staff_role != 'chef' and x_staff_role != 'manager':
            raise HTTPException(
                status_code=403,
                detail="Only chef or manager can update item status to received or completed"
            )

    order_item_data = order_item.model_dump(exclude_unset=True)
    order_item_db.sqlmodel_update(order_item_data)
    session.add(order_item_db)
    session.commit()
    session.refresh(order_item_db)
    
    # Thông báo khi cập nhật trạng thái món ăn
    if 'status' in order_item_data:
        # Lấy thông tin đơn hàng đầy đủ
        order_db = session.get(OrderSession, order_id)
        order_data = make_json_serializable(order_db.model_dump())
        
        # Thêm thông tin món ăn đã cập nhật
        item_data = make_json_serializable(order_item_db.model_dump())
        
        await publish_event(
            event="order_item_updated",
            payload={
                "order": order_data,
                "updated_item": item_data
            },
            target_role="chef" if x_staff_role != "chef" else "waiter"
        )
        
        await manager.broadcast_to_role(
            message={
                "event": "order_item_updated",
                "data": {
                    "order": order_data,
                    "updated_item": item_data
                }
            },
            role="chef" if x_staff_role != "chef" else "waiter"
        )
    
    return order_item_db


# Thêm API để lấy danh sách đơn hàng theo trạng thái
@router.get("/by-status/{status}", response_model=list[OrderSessionPublic])
async def read_orders_by_status(
    *,
    session: Annotated[Session, Depends(get_session)],
    status: Annotated[str, Path()],
    offset: Annotated[int, Query()] = 0,
    limit: Annotated[int, Query(le=100)] = 100
):
    orders = session.exec(select(OrderSession)
                 .where(OrderSession.status == status)
                 .offset(offset)
                 .limit(limit)
                ).all()
    return orders

# Thêm API để lấy danh sách đơn hàng theo ngày
@router.get("/by-date/{date}", response_model=list[OrderSessionPublic])
async def read_orders_by_date(
    *,
    session: Annotated[Session, Depends(get_session)],
    date: Annotated[str, Path()],  # Format: YYYY-MM-DD
    offset: Annotated[int, Query()] = 0,
    limit: Annotated[int, Query(le=100)] = 100
):
    # Tạo khoảng thời gian cho ngày cụ thể (00:00:00 đến 23:59:59)
    start_date = f"{date} 00:00:00"
    end_date = f"{date} 23:59:59"
    
    orders = session.exec(select(OrderSession)
                 .where(OrderSession.created_at >= start_date,
                        OrderSession.created_at <= end_date)
                 .offset(offset)
                 .limit(limit)
                ).all()
    return orders

# Thêm API để cập nhật trạng thái nhiều món ăn cùng lúc
@router.put("/batch-update-items", response_model=list[OrderItemPublicV2])
async def batch_update_order_items(
    *,
    session: Annotated[Session, Depends(get_session)],
    items: Annotated[list[dict], Body()],
    x_staff_role: Annotated[str, Header()]
):
    """
    Cập nhật trạng thái nhiều món ăn cùng lúc
    
    Mỗi phần tử trong danh sách items phải có:
    - order_id: ID của đơn hàng
    - item_id: ID của món ăn
    - status: Trạng thái mới
    """
    # Kiểm tra quyền truy cập
    if x_staff_role != 'chef' and x_staff_role != 'manager':
        raise HTTPException(
            status_code=403,
            detail="Only chef or manager can batch update order items"
        )
    
    updated_items = []
    
    for item_data in items:
        order_id = item_data.get("order_id")
        item_id = item_data.get("item_id")
        new_status = item_data.get("status")
        
        if not all([order_id, item_id, new_status]):
            continue
        
        # Tìm order item
        order_item = session.exec(
            select(OrderItem)
            .where(OrderItem.order_id == order_id, 
                    OrderItem.item_id == item_id)
        ).first()
        
        if not order_item:
            continue
        
        # Kiểm tra trạng thái hợp lệ
        try:
            validate_status_transition(order_item.status, new_status)
        except HTTPException:
            continue
        
        # Cập nhật trạng thái
        order_item.status = new_status
        session.add(order_item)
        updated_items.append(order_item)
    
    session.commit()
    
    # Refresh các order item đã cập nhật
    for item in updated_items:
        session.refresh(item)
    
    # Thông báo cập nhật hàng loạt
    if updated_items:
        for item in updated_items:
            order_db = session.get(OrderSession, item.order_id)
            order_data = make_json_serializable(order_db.model_dump())
            item_data = make_json_serializable(item.model_dump())
            
            await publish_event(
                event="order_item_updated",
                payload={
                    "order": order_data,
                    "updated_item": item_data
                },
                target_role="chef" if x_staff_role != "chef" else "waiter"
            )
    
    return updated_items

# API để hủy đơn hàng
@router.put("/{order_id}/cancel", response_model=OrderSessionPublic)
async def cancel_order(
    *,
    session: Annotated[Session, Depends(get_session)],
    order_id: Annotated[int, Path()],
    x_staff_id: Annotated[int, Header()],
    x_staff_role: Annotated[str, Header()],
    x_staff_name: Annotated[str, Header()]
):
    """
    Hủy đơn hàng và cập nhật trạng thái bàn
    """
    order_db = session.get(OrderSession, order_id)
    if not order_db:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Chỉ có thể hủy đơn hàng ở trạng thái "opening"
    if order_db.status != "opening":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel order with status {order_db.status}"
        )
    
    # Cập nhật trạng thái đơn hàng
    order_db.status = "canceled"
    
    # Cập nhật trạng thái tất cả các món ăn đang chờ thành "canceled"
    for item in order_db.order_items:
        if item.status == "pending" or item.status == "received":
            item.status = "canceled"
    
    session.add(order_db)
    session.commit()
    session.refresh(order_db)
    
    # Cập nhật trạng thái bàn thành "available"
    headers = {
        "X-Staff-ID": str(x_staff_id),
        "X-Staff-Role": x_staff_role,
        "X-Staff-Name": x_staff_name
    }
    
    try:
        async with httpx.AsyncClient() as client:
            await client.put(
                f"http://localhost:8004/tables/{order_db.table_id}/",
                headers=headers,
                json={"is_available": True}
            )
    except Exception as e:
        print(f"Error updating table status: {e}")
    
    # Gửi thông báo
    order_data = make_json_serializable(order_db.model_dump())
    await publish_event(
        event="order_canceled",
        payload=order_data,
        target_role="chef"
    )
    await publish_event(
        event="order_canceled",
        payload=order_data,
        target_role="manager"
    )
    
    # Thông báo qua WebSocket
    await manager.broadcast_to_role(
        message={
            "event": "order_canceled",
            "data": order_data
        },
        role="chef"
    )
    
    return order_db