from datetime import timedelta
from typing import Annotated
from fastapi import (
    Depends, Query, Body, Path, 
    Request, HTTPException, status
)
from fastapi.responses import RedirectResponse
from fastapi.routing import APIRouter
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from .config import get_settings
from .models import (
    Staff, StaffCreate, 
    StaffPublic
)
from .utils import (
    get_password_hash,
    create_access_token,
    authenticate_staff
)
from .database import get_session


ACCESS_TOKEN_EXPIRE_MINUTES = get_settings().ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter()

@router.post("/", response_model=StaffPublic)
async def create_staff(
    *,
    session: Annotated[Session, Depends(get_session)],
    staff: Annotated[StaffCreate, Body()]
):
    hashed_password = get_password_hash(staff.password)
    extra_data = {"hashed_password": hashed_password}
    staff_db = Staff.model_validate(staff, update=extra_data)
    session.add(staff_db)
    session.commit()
    session.refresh(staff_db)
    return staff_db

@router.post("/login")
async def login_submit(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: Annotated[Session, Depends(get_session)]
):
    staff = await authenticate_staff(
        session=session,
        username=form_data.username,
        password=form_data.password
    )

    if not staff:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # set expired time
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": str(staff.id), 
            "role": staff.role, 
            "name": staff.name,
        },
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


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

# @router.get("/{staff_id}", 
#         response_model=StaffPublicWithOrderSessions)
# async def read_staff(
#     *,
#     session: Annotated[Session, Depends(get_session)],
#     staff_id: Annotated[int, Path()]
# ):
#     staff_db = session.get(Staff, staff_id)
#     if not staff_db:
#         raise HTTPException(status_code=404, 
#                             detail="Staff not found")
#     return staff_db