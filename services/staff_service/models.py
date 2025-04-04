from sqlmodel import SQLModel, Field
from enum import Enum
from typing import Annotated
# from .order import OrderSession, OrderSessionPublic

class Token(SQLModel):
    access_token: str
    token_type: str

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
    hashed_password: Annotated[str, Field()]

class StaffPublic(StaffBase):
    id: Annotated[int, Field()]

class StaffCreate(StaffBase):
    password: Annotated[str, Field()]

# This is for selecting a single object
# class StaffPublicWithOrderSessions(StaffPublic):
#     orders: Annotated[list["OrderSessionPublic"], Field()]

Staff.model_rebuild()
# StaffPublicWithOrderSessions.model_rebuild()