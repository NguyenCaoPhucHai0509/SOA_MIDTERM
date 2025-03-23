from sqlmodel import SQLModel, Field, Relationship
from decimal import Decimal
from typing import Annotated, TYPE_CHECKING
from .order_item import OrderItem

if TYPE_CHECKING:
    from .staff import Staff 

class OrderSessionBase(SQLModel):
    table_id: Annotated[int, Field()]
    server_id: Annotated[int, Field(foreign_key="staff.id")]

class OrderSession(OrderSessionBase, table=True):
    __tablename__ = "order_session"
    id: Annotated[int | None, Field(primary_key=True, default=None)]
    is_paid: Annotated[bool, Field()] = False
    total_amount: Annotated[Decimal, Field(max_digits=13, decimal_places=3,
                            ge=Decimal(0.000), default=Decimal(0.000))]

    server: "Staff" = Relationship(back_populates="orders")
    order_items: list["OrderItem"] = Relationship(back_populates="order")

class OrderSessionCreate(OrderSessionBase):
    pass

class OrderSessionPublic(OrderSessionBase):
    id: Annotated[int, Field()]
    is_paid: Annotated[bool, Field()]
    total_amount: Annotated[Decimal, Field(max_digits=13, decimal_places=3,
                            ge=Decimal(0.000), default=Decimal(0.000))]

class OrderSessionUpdate(SQLModel):
    tabel_id: Annotated[int | None, Field()]
    is_paid: Annotated[int | None, Field(max_digits=13, decimal_places=3,
                                    ge=Decimal(0.000), default=None)]
    total_amount: Annotated[Decimal | None, Field()]

    # server_id

# This is for select a single object
class OrderSessionPublicWithOrderItems(OrderSessionPublic):
    order_items: list["OrderItem"]

OrderSession.model_rebuild()
OrderSessionPublicWithOrderItems.model_rebuild()