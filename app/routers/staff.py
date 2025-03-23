from fastapi import Depends, Query, Body, Path, HTTPException
from fastapi.routing import APIRouter
from sqlmodel import Session, select
from typing import Annotated

from ..models.staff import (Staff, StaffCreate, 
            StaffPublic, StaffPublicWithOrderSessions)
    
from ..database import get_session

router = APIRouter(
    prefix="/staffs",
    tags=["Staffs"]
)

@router.post("/", response_model=StaffPublic)
async def create_staff(
    *,
    session: Annotated[Session, Depends(get_session)],
    staff: Annotated[StaffCreate, Body()]
):
    staff_db = Staff.model_validate(staff)
    session.add(staff_db)
    session.commit()
    session.refresh(staff_db)
    return staff_db

@router.get("/", response_model=list[StaffPublic])
async def read_staffs(
    *,
    session: Annotated[Session, Depends(get_session)],
    offset: Annotated[int, Query()] = 0,
    limit: Annotated[int, Query(le=100)] = 100
):
    staffs = session.exec(select(Staff)
                 .offset(offset)
                 .limit(limit)
                ).all()
    return staffs

@router.get("/{staff_id}", response_model=StaffPublicWithOrderSessions)
async def read_staff(
    *,
    session: Annotated[Session, Depends(get_session)],
    staff_id: Annotated[int, Path()]
):
    staff_db = session.get(Staff, staff_id)
    if not staff_db:
        raise HTTPException(status_code=404, detail="Staff not found")
    return staff_db