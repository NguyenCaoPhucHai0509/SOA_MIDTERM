from sqlmodel import SQLModel, Field, Relationship
from enum import Enum
from typing import Annotated, TYPE_CHECKING
from .order import OrderSession, OrderSessionPublic

class StaffRole(str, Enum):
    waiter = "waiter"
    chef = "chef"
    manager = "manager"

class StaffBase(SQLModel):
    name: Annotated[str, Field(max_length=64)]
    role: Annotated[StaffRole, Field()]
    username: Annotated[str, Field()]

class Staff(StaffBase, table=True):
    id: Annotated[int | None, Field(primary_key=True, default=None)]
    orders: list["OrderSession"] = Relationship(back_populates="server")
    hashed_password: Annotated[str, Field()]

class StaffPublic(StaffBase):
    id: Annotated[int, Field()]

class StaffCreate(StaffBase):
    password: Annotated[str, Field()]

# This is for selecting a single object
class StaffPublicWithOrderSessions(StaffPublic):
    orders: Annotated[list["OrderSessionPublic"], Field()]

Staff.model_rebuild()
StaffPublicWithOrderSessions.model_rebuild()