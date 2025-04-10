from decimal import Decimal
from typing import Annotated
from datetime import datetime
from enum import Enum
from sqlmodel import SQLModel, Field, Relationship

class OrderSessionBase(SQLModel):
    table_id: Annotated[int, Field()]

class OrderSession(OrderSessionBase, table=True):
    __tablename__ = "order_session"

    id: Annotated[int | None, Field(primary_key=True, default=None)]
    server_id: Annotated[int, Field()]
    is_paid: Annotated[bool, Field()] = False
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
    is_paid: Annotated[bool, Field()]
    total_amount: Annotated[Decimal, Field()]
    created_at: Annotated[datetime, Field()]
    closed_at: Annotated[datetime | None, Field()]
    order_items: Annotated[list["OrderItemPublic"], Field()]

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
    order_id: Annotated[int, Field(default=None, foreign_key="order_session.id")]
    status: Annotated[OrderItemStatus, Field(default="pending")]
    
    order: "OrderSession" = Relationship(back_populates="order_items")

class OrderItemCreate(OrderItemBase):
    pass

class OrderItemPublic(OrderItemBase):
    id: Annotated[int, Field()]
    # order_id: Annotated[int, Field()]
    status: Annotated[OrderItemStatus, Field()]
    # order: Annotated["OrderSession", Field()]
    # item: Annotated["Item", Field()]

class OrderItemUpdate(SQLModel):
    quantity: Annotated[int | None, Field(ge=1, default=None)]
    status: Annotated[OrderItemStatus | None, Field(default=None)]