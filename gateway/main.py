from contextlib import asynccontextmanager
from typing import Annotated
import jwt
from jwt.exceptions import InvalidTokenError
import httpx

from fastapi import (
    FastAPI, HTTPException, Request,
    Depends, Form, Path, Response, status
)
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel


from .config import get_settings

settings = get_settings()
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM

SERVICES = {
    "staffs": "http://localhost:8001/staffs",
    "menu": "http://localhost:8002/items",
    "orders": "http://localhost:8003/orders",
    "tables": "http://localhost:8004/tables"
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("API GATEWAY: WELCOME")
    yield
    print("Sayonaraaaa!")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# tokenUrl is just for Swagger UI
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

class LoginData(BaseModel):
    username: str
    password: str

@app.post("/login")
async def login(form_data: Annotated[LoginData, Form()]):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SERVICES['staffs']}/login",
            data={
                "username": form_data.username,
                "password": form_data.password
            }
        )
    if response.status_code == 200:
        return response.json()
    
    raise HTTPException(
        status_code=response.status_code,
        detail="Login failed"
    )

def decode_access_token(token: Annotated[str, Depends(oauth2_scheme)]):
    try:
        # Decoding JWT
        payload: dict = jwt.decode(
                    token, 
                    SECRET_KEY, 
                    algorithms=[ALGORITHM]
                )
        
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )

'''
This function helps to get an image without Authorization Header.
If there is too many image's request, will it be crashed?
'''
@app.get("/{service}/images/{filename}")
async def get_image(
    service: Annotated[str, Path()], 
    filename: Annotated[str, Path()]
):
    # print("SERVICE: ", service)
    # print("FILENAME: ", filename)
    service_url = SERVICES[service]
    if not service_url:
        raise HTTPException(
            status_code=404,
            detail="Service not found"
        )
    
    async with httpx.AsyncClient() as client:
        img_url = f"{service_url}/images/{filename}"
        response = await client.get(img_url)

    if response.status_code != 200:
        raise HTTPException(
        status_code=404,
        detail="Image not found"
    )
    
    return Response(
        content=response.content, 
        media_type=response.headers.get("content-type")
    )
    
    
async def proxy_request(
    service_url: str, 
    path: str, 
    request: Request, 
    staff_info: dict
):
    async with httpx.AsyncClient() as client:

        method = request.method
        url = f"{service_url}/{path}"
        headers = dict(request.headers)
        # Using payload to get staff info and put all of them in headers.
        # First try.
        headers["X-Staff-ID"] = str(staff_info["sub"])
        headers["X-Staff-Role"] = str(staff_info["role"])
        headers["X-Staff-Name"] = str(staff_info["name"])

        params = request.query_params
        
        if request.method in ["POST", "PUT"]:
            try:
                json_body = await request.json()
                response = await client.request(
                    method, url, headers=headers, 
                    params=params, json=json_body
                )
            except Exception:
                content_body = await request.body()
                response = await client.request(
                    method, url, headers=headers, 
                    params=params, content=content_body
                )
        else:
            response = await client.request(
                method, url, headers=headers, params=params
            )

        # print("RESPONSE STATUS CODE:", response.status_code)
        try:
            response_content = response.json()
            # print("RESPONSE BODY:", response_content) 
        except Exception:
            response_content = \
                {"message": "Empty or invalid response" + 
                            " from downstream service"}
            # print("RESPONSE BODY ERROR:", response.text)

        return JSONResponse(
            content=response_content, 
            status_code=response.status_code
        )
    
@app.api_route("/{service}/{path:path}", 
    methods=["GET", "POST", "PUT", "DELETE"]
)
async def gateway_proxy(
    service: str, 
    path: str, 
    request: Request, 
    staff_info: dict = Depends(decode_access_token)
):
    print("SERVICE: ", service)
    print("TOKEN: ", staff_info)
    
    if service not in SERVICES:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Service not found"
        )
    return await proxy_request(SERVICES[service], path, request, staff_info)
    
