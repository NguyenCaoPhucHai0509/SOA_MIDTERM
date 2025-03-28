from datetime import timedelta
from fastapi import Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from fastapi.routing import APIRouter
from sqlmodel import Session, Field, select
from typing import Annotated
from fastapi.security import (
    OAuth2PasswordRequestForm, 
    OAuth2PasswordBearer
)
from ..templates import templates
from ..models.staff import Staff
from ..database import get_session
from ..security import (
    verify_password, 
    create_access_token,
    decode_access_token, 
    ACCESS_TOKEN_EXPIRE_MINUTES
)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="./token")

async def get_staff_by_username(
    session: Annotated[Session, Depends(get_session)], 
    username: Annotated[str, Field()]
) -> Staff:
    staff = session.exec(
        select(Staff)
        .where(Staff.username == username)
    ).first()

    return staff
    
async def authenticate_staff(
    *,
    session: Annotated[Session, Depends(get_session)],
    username: Annotated[str, Field()],
    password: Annotated[str, Field()]
):
    staff = await get_staff_by_username(session, username)
    if not staff:
        return False
    if not verify_password(password, staff.hashed_password):
        return False
    return staff

# async def get_current_staff(
#     token: Annotated[str, Depends(oauth2_scheme)],
#     session: Annotated[Session, Depends(get_session)]
# ):
#     username = decode_access_token(token)
#     # TokenData for validation
#     token_data = TokenData(username=username)
#     staff = get_staff_by_username(session=session, 
#                         username=token_data.username)
#     if staff is None:
#         raise  HTTPException(
#         status_code=status.HTTP_401_UNAUTHORIZED,
#         detail="Could not validate credentials",
#         headers={"WWWW-Authenticate": "Bearer"}
#     )
#     return staff
@router.get("/login")
async def login_form(request: Request):
    return templates.TemplateResponse(
        name="login.html",
        request=request
    )

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

    assert staff is not None, print("Staff is not None")

    if not staff:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # set expired time
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": staff.username},
        expires_delta=access_token_expires
    )
    response = RedirectResponse(url="/menu", status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True
    )
    return response