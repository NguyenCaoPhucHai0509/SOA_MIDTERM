from typing import Annotated
from fastapi import Depends, HTTPException, status, Body, Path
from fastapi.routing import APIRouter
from sqlmodel import Session, select

from .database import get_session
from .models import Table, TablePublic
router = APIRouter()

@router.get("/", response_model=list[TablePublic])
async def read_table(session: Annotated[Session, Depends(get_session)]):
    tables_db = session.exec(select(Table)).all()
    if not tables_db:
        # Tạo mặc định 10 bàn nếu chưa có bàn nào
        for i in range(1, 11):
            new_table = Table(is_available=True)
            session.add(new_table)
        session.commit()
        tables_db = session.exec(select(Table)).all()
    return tables_db

@router.post("/", response_model=TablePublic)
async def create_table(
    *,
    session: Annotated[Session, Depends(get_session)],
    data: Annotated[dict, Body()],
):
    """Tạo bàn mới"""
    is_available = data.get("is_available", True)
    
    new_table = Table(is_available=is_available)
    session.add(new_table)
    session.commit()
    session.refresh(new_table)
    return new_table

@router.put("/{table_id}", response_model=TablePublic)
async def update_table(
    *,
    session: Annotated[Session, Depends(get_session)],
    table_id: Annotated[int, Path()],
    data: Annotated[dict, Body()],
):
    """Cập nhật trạng thái bàn"""
    table = session.get(Table, table_id)
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Không tìm thấy bàn"
        )
    
    # Cập nhật trạng thái
    is_available = data.get("is_available")
    if is_available is not None:
        table.is_available = is_available
    
    session.add(table)
    session.commit()
    session.refresh(table)
    return table

@router.delete("/{table_id}", response_model=dict)
async def delete_table(
    *,
    session: Annotated[Session, Depends(get_session)],
    table_id: Annotated[int, Path()],
):
    """Xóa bàn"""
    table = session.get(Table, table_id)
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Không tìm thấy bàn"
        )
    
    session.delete(table)
    session.commit()
    return {"message": "Đã xóa bàn thành công"}