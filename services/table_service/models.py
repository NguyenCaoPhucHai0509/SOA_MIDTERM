from decimal import Decimal
from typing import Annotated
from datetime import datetime
from enum import Enum
from sqlmodel import SQLModel, Field, Relationship

class Table(SQLModel, table=True):
    id: Annotated[int, Field(default=None, primary_key=True)]
    is_available: Annotated[bool, Field(default=True)]


class TablePublic(Table):
    pass