from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.routing import APIRouter
from sqlmodel import Session, select

from .database import get_session
from .models import Table, TablePublic
router = APIRouter()

@router.get("/", response_model=list[TablePublic])
async def read_table(session: Annotated[Session, Depends(get_session)]):
    tables_db = session.exec(select(Table)).all()
    if not tables_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="There is no existed table"
        )
    return tables_db
    