from decimal import Decimal
from typing import Annotated
from datetime import datetime
from enum import Enum
from sqlmodel import SQLModel, Field, Relationship

class OrderSessionStatus(str, Enum):
    opening = "opening"
    closed = "closed"
    canceled = "canceled"

class OrderSessionBase(SQLModel):
    table_id: Annotated[int, Field()]
'''
Some fields have default value should be put inside Model Table
If putting it in Base or Create (when is it, those also accept None, like int | None)
    if don't set those fields, it will be assigned on default value
    but when set those ones, it could be invaild initial value, such as
    when creating new order, its status could be "closed"
'''
class OrderSession(OrderSessionBase, table=True):
    __tablename__ = "order_session"

    id: Annotated[int | None, 
                    Field(primary_key=True, default=None)]
    server_id: Annotated[int, Field()]
    status: Annotated[OrderSessionStatus, 
                    Field(default=OrderSessionStatus.opening)]
    is_paid: Annotated[bool, Field(default=False)]
    total_amount: Annotated[Decimal, 
                    Field(max_digits=13, decimal_places=3,
                        ge=Decimal(0.000), default=Decimal(0.000))]
    created_at: Annotated[datetime, Field(default=datetime.now())]
    closed_at: Annotated[datetime | None, Field(default=None)]
    order_items: list["OrderItem"] = Relationship(back_populates="order")

class OrderSessionCreate(OrderSessionBase):
    order_items: Annotated[list["OrderItemCreate"], Field(min_length=1)]

class OrderSessionPublic(OrderSessionBase):
    id: Annotated[int, Field()]
    server_id: Annotated[int, Field()]
    status: Annotated[OrderSessionStatus, Field()]
    is_paid: Annotated[bool, Field()]
    total_amount: Annotated[Decimal, Field()]
    created_at: Annotated[datetime, Field()]
    closed_at: Annotated[datetime | None, Field()]
    order_items: Annotated[list["OrderItemPublicV1"], Field()]

class OrderSessionUpdate(SQLModel):
    # tabel_id: Annotated[int | None, Field()]
    is_paid: Annotated[bool | None, Field(default=None)]
    total_amount: Annotated[Decimal | None, 
                            Field(max_digits=13, decimal_places=3,
                                ge=Decimal(0.000), default=None)]
    closed_at: Annotated[datetime | None, Field(default=None)]

    # server_id

# This is for select a single object
# class OrderSessionPublicWithOrderItems(OrderSessionPublic):
#     order_items: list["OrderItem"]

class OrderItemStatus(str, Enum):
    pending = "pending"
    received = "received"
    completed = "completed"
    canceled = "canceled"

class OrderItemBase(SQLModel):
    item_id: Annotated[int, Field()]
    quantity: Annotated[int, Field(ge=1, default=1)]
    note: Annotated[str | None, Field(default=None)]

# Don't use Annotated[smth, Relationship(smth)]
class OrderItem(OrderItemBase, table=True):
    __tablename__ = "order_item"

    id: Annotated[int, Field(primary_key=True, default=None)]
    order_id: Annotated[int, 
                    Field(default=None, foreign_key="order_session.id")]
    status: Annotated[OrderItemStatus, Field(default="pending")]
    
    order: "OrderSession" = Relationship(back_populates="order_items")

class OrderItemCreate(OrderItemBase):
    pass

'''
Not having order_id field. This is for showing list of order items 
in specific order
'''
class OrderItemPublicV1(OrderItemBase):
    id: Annotated[int, Field()]
    status: Annotated[OrderItemStatus, Field()]

'''
Having order_id field. This is for show list of order items
in database (like SELECT * FROM order_item) or just showing
information of an order item.
'''
class OrderItemPublicV2(OrderItemPublicV1):
    order_id: Annotated[int, Field()] 

class OrderItemUpdate(SQLModel):
    quantity: Annotated[int | None, Field(ge=1, default=None)]
    status: Annotated[OrderItemStatus | None, Field(default=None)]
    note: Annotated[str | None, Field(default=None)]