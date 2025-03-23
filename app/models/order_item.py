from sqlmodel import SQLModel, Field, Relationship
from enum import Enum
from typing import Annotated, TYPE_CHECKING 

if TYPE_CHECKING:  
    from .order import OrderSession

class OrderItemStatus(str, Enum):
    pending = "pending"
    received = "received"
    canceled = "canceled"

class OrderItemBase(SQLModel):
    order_id: Annotated[int, Field(primary_key=True, 
                                   foreign_key="order_session.id")]
    item_id: Annotated[int, Field(primary_key=True, 
                                  foreign_key="item.id")]
    quantity: Annotated[int, Field(ge=1, default=1)]
    note: Annotated[str | None, Field(default=None)]

    

# Don't use Annotated[smth, Relationship(smth)]
class OrderItem(OrderItemBase, table=True):
    __tablename__ = "order_item"
    status: Annotated[OrderItemStatus, Field(default="pending")]
    
    order: "OrderSession" = Relationship(back_populates="order_items")

class OrderItemCreate(OrderItemBase):
    pass

class OrderItemPublic(OrderItemBase):
    status: Annotated[OrderItemStatus, Field()]
    # order: Annotated["OrderSession", Field()]
    # item: Annotated["Item", Field()]

class OrderItemUpdate(SQLModel):
    quantity: Annotated[int | None, Field(ge=1)]
    status: Annotated[OrderItemStatus | None, Field()]
