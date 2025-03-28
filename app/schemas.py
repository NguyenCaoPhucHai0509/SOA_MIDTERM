from pydantic import BaseModel

class Token(BaseModel):
    access_token: str
    token_type: str

# TokenData doesn't inherit Token
class TokenData(BaseModel):
    username: str | None = None 
