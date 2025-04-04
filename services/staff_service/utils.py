from datetime import datetime, timedelta, timezone
from typing import Annotated
import jwt
from fastapi import Depends
from sqlmodel import Session, Field, select
from typing import Annotated
import bcrypt

from .config import get_settings
from .models import Staff
from .database import get_session

settings = get_settings()
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM


def get_password_hash(password):
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password=pwd_bytes, 
                                    salt=salt)
    return hashed_password

def verify_password(plain_password, hashed_password):
    password_bytes_enc = plain_password.encode("utf-8")
    hashed_password_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password=password_bytes_enc, 
                    hashed_password=hashed_password_bytes)

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

def create_access_token( 
    data: dict,
    expires_delta: timedelta | None = None
):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        # if there is no expires_delta, just set expire time is 15 mins
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encode_jwt = jwt.encode(
                    to_encode, 
                    settings.SECRET_KEY, 
                    algorithm=settings.ALGORITHM
                )
    return encode_jwt

