from sqlmodel import SQLModel, Field, Relationship
from decimal import Decimal
from typing import Annotated, TYPE_CHECKING

if TYPE_CHECKING:
    from .order_item import OrderItem

class ItemBase(SQLModel):
    name: Annotated[str, Field(max_length=64)]
    price: Annotated[Decimal, Field(max_digits=13, decimal_places=3,
                ge=Decimal(0.000), default=Decimal(0.000))]
    
    is_available: Annotated[bool, Field(default=True)]

class Item(ItemBase, table=True):
    id: Annotated[int | None, Field(primary_key=True, default=None)]

class ItemCreate(ItemBase):
    pass

class ItemPublic(ItemBase):
    id: Annotated[int, Field()]

class ItemUpdate(SQLModel):
    name: Annotated[str | None, Field(max_length=64, default=None)]
    price: Annotated[Decimal | None, Field(max_digits=13, decimal_places=3,
                                    ge=Decimal(0.000), default=None)]
    is_available: Annotated[bool | None, Field(default=None)]
    